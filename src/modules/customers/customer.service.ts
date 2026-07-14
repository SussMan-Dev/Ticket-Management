import type { PoolConnection } from "mysql2/promise";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import {
  auditLogRepository,
  type AuditLogRepository,
} from "../../common/repositories/audit-log.repository.js";
import {
  duplicateEntryField,
  isDuplicateEntryError,
} from "../../common/utils/database-error.util.js";
import { hashPassword } from "../../common/utils/password.util.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import type {
  CreateCustomerDto,
  ListCustomersQuery,
  ListCustomersResult,
  UpdateCustomerDto,
} from "./customer.dto.js";
import {
  toCustomerProfile,
  toCustomerSummary,
  type CustomerProfile,
} from "./customer.model.js";
import {
  customerRepository,
  type CustomerRepository,
} from "./customer.repository.js";

type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

const CUSTOMER_STAFF_ROLES = new Set(["RECEPTIONIST", "MANAGER"]);

function isCustomerStaff(actor: Express.AuthenticatedUser): boolean {
  return CUSTOMER_STAFF_ROLES.has(actor.role);
}

function assertCustomerAccess(actor: Express.AuthenticatedUser, customerId: number): void {
  if (isCustomerStaff(actor)) {
    return;
  }

  if (actor.role !== "CUSTOMER" || actor.id !== customerId) {
    throw new ForbiddenError("You may access only your own customer profile", "FORBIDDEN");
  }
}

function normalizeMetadata(metadata: RequestMetadata): RequestMetadata {
  return {
    ipAddress: metadata.ipAddress?.slice(0, 45) ?? null,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
  };
}

function duplicateIdentityError(error: unknown): ConflictError {
  const field = duplicateEntryField(error);
  return new ConflictError(
    field === "phone" ? "Phone is already in use" : "Email is already in use",
    field === "phone" ? "PHONE_ALREADY_EXISTS" : "EMAIL_ALREADY_EXISTS",
  );
}

export class CustomerService {
  public constructor(
    private readonly repository: CustomerRepository = customerRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async list(query: ListCustomersQuery): Promise<ListCustomersResult> {
    const result = await this.repository.list(query);
    return {
      customers: result.rows.map(toCustomerSummary),
      total: result.total,
    };
  }

  public async getById(
    actor: Express.AuthenticatedUser,
    customerId: number,
  ): Promise<CustomerProfile> {
    assertCustomerAccess(actor, customerId);
    const customer = await this.repository.findById(pool, customerId);

    if (!customer) {
      throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    return toCustomerProfile(customer, isCustomerStaff(actor));
  }

  public async create(
    actor: Express.AuthenticatedUser,
    input: CreateCustomerDto,
    metadata: RequestMetadata,
  ): Promise<CustomerProfile> {
    if (!isCustomerStaff(actor)) {
      throw new ForbiddenError("Only authorized staff may create customers", "FORBIDDEN");
    }

    const passwordHash = await hashPassword(input.password);
    const requestMetadata = normalizeMetadata(metadata);

    try {
      return await this.runInTransaction(async (connection) => {
        const roleId = await this.repository.findCustomerRoleId(connection);

        if (roleId === null) {
          throw new NotFoundError("Customer role is not configured", "ROLE_NOT_FOUND");
        }

        const conflicts = await this.repository.findIdentityConflicts(
          connection,
          input.email,
          input.phone ?? null,
        );

        if (conflicts.emailExists) {
          throw new ConflictError("Email is already in use", "EMAIL_ALREADY_EXISTS");
        }

        if (conflicts.phoneExists) {
          throw new ConflictError("Phone is already in use", "PHONE_ALREADY_EXISTS");
        }

        const customerId = await this.repository.createUser(connection, {
          roleId,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          passwordHash,
        });
        await this.repository.createProfile(
          connection,
          customerId,
          input.address ?? null,
          input.notes ?? null,
        );
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "CUSTOMER_CREATED_BY_STAFF",
          entityType: "USER",
          entityId: customerId,
          newData: { email: input.email, role: "CUSTOMER" },
          ...requestMetadata,
        });
        const created = await this.repository.findById(connection, customerId);

        if (!created) {
          throw new NotFoundError("Created customer could not be loaded", "CUSTOMER_NOT_FOUND");
        }

        return toCustomerProfile(created, true);
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw duplicateIdentityError(error);
      }

      throw error;
    }
  }

  public async update(
    actor: Express.AuthenticatedUser,
    customerId: number,
    input: UpdateCustomerDto,
    metadata: RequestMetadata,
  ): Promise<CustomerProfile> {
    assertCustomerAccess(actor, customerId);

    if (!isCustomerStaff(actor) && input.notes !== undefined) {
      throw new ForbiddenError("Customer notes are staff-only", "CUSTOMER_NOTES_FORBIDDEN");
    }

    const requestMetadata = normalizeMetadata(metadata);

    try {
      return await this.runInTransaction(async (connection) => {
        const current = await this.repository.findById(connection, customerId, true);

        if (!current) {
          throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
        }

        if (
          input.phone &&
          await this.repository.phoneUsedByAnotherUser(connection, input.phone, customerId)
        ) {
          throw new ConflictError("Phone is already in use", "PHONE_ALREADY_EXISTS");
        }

        await this.repository.update(connection, customerId, input);
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "CUSTOMER_PROFILE_UPDATED",
          entityType: "USER",
          entityId: customerId,
          newData: { changedFields: Object.keys(input) },
          ...requestMetadata,
        });
        const updated = await this.repository.findById(connection, customerId);

        if (!updated) {
          throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
        }

        return toCustomerProfile(updated, isCustomerStaff(actor));
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw duplicateIdentityError(error);
      }

      throw error;
    }
  }
}

export const customerService = new CustomerService();
