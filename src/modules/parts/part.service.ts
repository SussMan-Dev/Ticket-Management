import type { PoolConnection } from "mysql2/promise";
import { BadRequestError } from "../../common/errors/bad-request-error.js";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import {
  auditLogRepository,
  type AuditLogRepository,
} from "../../common/repositories/audit-log.repository.js";
import { isDuplicateEntryError } from "../../common/utils/database-error.util.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  AdjustStockDto,
  CreatePartDto,
  ListInventoryTransactionsQuery,
  ListInventoryTransactionsResult,
  ListPartsQuery,
  ListPartsResult,
  StockInDto,
  UpdatePartDto,
} from "./part.dto.js";
import {
  toInventoryTransaction,
  toPart,
  toTechnicianPart,
  type Part,
  type TechnicianPart,
} from "./part.model.js";
import {
  partRepository,
  type PartRepository,
} from "./part.repository.js";

type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

const MAX_STOCK = 2_147_483_647;

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

export class PartService {
  public constructor(
    private readonly repository: PartRepository = partRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    query: ListPartsQuery,
  ): Promise<ListPartsResult> {
    this.assertReader(actor);
    const scopedQuery = actor.role === "TECHNICIAN"
      ? { ...query, isActive: true }
      : query;
    const result = await this.repository.list(scopedQuery);
    const parts = result.rows.map(toPart);
    return {
      parts: actor.role === "TECHNICIAN"
        ? parts.map(toTechnicianPart)
        : parts,
      total: result.total,
    };
  }

  public async getById(
    actor: Express.AuthenticatedUser,
    partId: number,
  ): Promise<Part | TechnicianPart> {
    this.assertReader(actor);
    const row = await this.repository.findById(pool, partId);
    if (!row || (actor.role === "TECHNICIAN" && !row.is_active)) {
      throw new NotFoundError("Part not found", "PART_NOT_FOUND");
    }
    const part = toPart(row);
    return actor.role === "TECHNICIAN" ? toTechnicianPart(part) : part;
  }

  public async create(
    actor: Express.AuthenticatedUser,
    input: CreatePartDto,
    metadata: RequestMetadata,
  ): Promise<Part> {
    this.assertInventoryStaff(actor);
    const requestMetadata = normalizeMetadata(metadata);
    try {
      return await this.runInTransaction(async (connection) => {
        const partId = await this.repository.create(connection, input);
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "PART_CREATED",
          entityType: "PART",
          entityId: partId,
          newData: { ...input, quantityOnHand: 0 },
          ...requestMetadata,
        });
        return this.requirePart(connection, partId);
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new ConflictError("SKU is already in use", "PART_SKU_EXISTS");
      }
      throw error;
    }
  }

  public async update(
    actor: Express.AuthenticatedUser,
    partId: number,
    input: UpdatePartDto,
    metadata: RequestMetadata,
  ): Promise<Part> {
    this.assertInventoryStaff(actor);
    const requestMetadata = normalizeMetadata(metadata);
    try {
      return await this.runInTransaction(async (connection) => {
        const current = await this.requirePart(connection, partId, true);
        await this.repository.update(connection, partId, input);
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "PART_UPDATED",
          entityType: "PART",
          entityId: partId,
          oldData: current,
          newData: input,
          ...requestMetadata,
        });
        return this.requirePart(connection, partId);
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new ConflictError("SKU is already in use", "PART_SKU_EXISTS");
      }
      throw error;
    }
  }

  public async stockIn(
    actor: Express.AuthenticatedUser,
    partId: number,
    input: StockInDto,
    metadata: RequestMetadata,
  ): Promise<Part> {
    return this.changeStock(
      actor,
      partId,
      input.quantity,
      "STOCK_IN",
      input.note,
      metadata,
    );
  }

  public async adjustStock(
    actor: Express.AuthenticatedUser,
    partId: number,
    input: AdjustStockDto,
    metadata: RequestMetadata,
  ): Promise<Part> {
    return this.changeStock(
      actor,
      partId,
      input.quantityChange,
      input.quantityChange > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      input.note,
      metadata,
    );
  }

  public async listTransactions(
    actor: Express.AuthenticatedUser,
    partId: number,
    query: ListInventoryTransactionsQuery,
  ): Promise<ListInventoryTransactionsResult> {
    if (actor.role !== "INVENTORY_STAFF" && actor.role !== "MANAGER") {
      throw new ForbiddenError(
        "Only inventory staff and managers may view stock history",
        "FORBIDDEN",
      );
    }
    await this.requirePart(pool, partId);
    const result = await this.repository.listInventoryTransactions(partId, query);
    return {
      transactions: result.rows.map(toInventoryTransaction),
      total: result.total,
    };
  }

  private async changeStock(
    actor: Express.AuthenticatedUser,
    partId: number,
    quantityChange: number,
    transactionType: "STOCK_IN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT",
    note: string,
    metadata: RequestMetadata,
  ): Promise<Part> {
    this.assertInventoryStaff(actor);
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const current = await this.requirePart(connection, partId, true);
      const quantityAfter = current.quantityOnHand + quantityChange;
      if (quantityAfter < 0) {
        throw new ConflictError(
          "Stock adjustment would make inventory negative",
          "INSUFFICIENT_STOCK",
        );
      }
      if (quantityAfter > MAX_STOCK) {
        throw new BadRequestError(
          "Stock quantity exceeds the supported limit",
          "STOCK_LIMIT_EXCEEDED",
        );
      }

      await this.repository.updateStock(connection, partId, quantityAfter);
      const transactionId = await this.repository.createInventoryTransaction(
        connection,
        {
          partId,
          transactionType,
          quantity: Math.abs(quantityChange),
          quantityBefore: current.quantityOnHand,
          quantityAfter,
          performedBy: actor.id,
          note,
        },
      );
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: transactionType,
        entityType: "INVENTORY_TRANSACTION",
        entityId: transactionId,
        oldData: { partId, quantityOnHand: current.quantityOnHand },
        newData: { partId, quantityOnHand: quantityAfter, note },
        ...requestMetadata,
      });
      return this.requirePart(connection, partId);
    });
  }

  private assertReader(actor: Express.AuthenticatedUser): void {
    if (!["TECHNICIAN", "INVENTORY_STAFF", "MANAGER"].includes(actor.role)) {
      throw new ForbiddenError("You are not allowed to view parts", "FORBIDDEN");
    }
  }

  private assertInventoryStaff(actor: Express.AuthenticatedUser): void {
    if (actor.role !== "INVENTORY_STAFF") {
      throw new ForbiddenError(
        "Only inventory staff may manage parts and stock",
        "FORBIDDEN",
      );
    }
  }

  private async requirePart(
    executor: Parameters<PartRepository["findById"]>[0],
    partId: number,
    lockForUpdate = false,
  ): Promise<Part> {
    const row = await this.repository.findById(executor, partId, lockForUpdate);
    if (!row) throw new NotFoundError("Part not found", "PART_NOT_FOUND");
    return toPart(row);
  }
}

export const partService = new PartService();

