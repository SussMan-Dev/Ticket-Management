import type { PoolConnection } from "mysql2/promise";
import { BadRequestError } from "../../common/errors/bad-request-error.js";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type {
  CreateDeviceDto,
  ListDevicesQuery,
  ListDevicesResult,
  UpdateDeviceDto,
} from "./device.dto.js";
import {
  toCatalogItem,
  toDevice,
  type CatalogItem,
  type Device,
  type DeviceRow,
} from "./device.model.js";
import {
  deviceRepository,
  type DeviceRepository,
} from "./device.repository.js";

type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

const DEVICE_STAFF_ROLES = new Set(["RECEPTIONIST", "MANAGER"]);

function isDeviceStaff(actor: Express.AuthenticatedUser): boolean {
  return DEVICE_STAFF_ROLES.has(actor.role);
}

function assertCustomerScope(actor: Express.AuthenticatedUser, customerId: number): void {
  if (isDeviceStaff(actor)) {
    return;
  }

  if (actor.role !== "CUSTOMER" || actor.id !== customerId) {
    throw new ForbiddenError("You may access only your own devices", "FORBIDDEN");
  }
}

function assertDeviceAccess(actor: Express.AuthenticatedUser, device: DeviceRow): void {
  assertCustomerScope(actor, device.customer_id);
}

export class DeviceService {
  public constructor(
    private readonly repository: DeviceRepository = deviceRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
  ) {}

  public async list(
    actor: Express.AuthenticatedUser,
    query: ListDevicesQuery,
  ): Promise<ListDevicesResult> {
    if (
      actor.role === "CUSTOMER" &&
      query.customerId !== undefined &&
      query.customerId !== actor.id
    ) {
      throw new ForbiddenError("You may access only your own devices", "FORBIDDEN");
    }

    const scopedQuery: ListDevicesQuery = {
      ...query,
      customerId: actor.role === "CUSTOMER" ? actor.id : query.customerId,
    };
    const result = await this.repository.list(scopedQuery);
    return {
      devices: result.rows.map(toDevice),
      total: result.total,
    };
  }

  public async listForCustomer(
    actor: Express.AuthenticatedUser,
    customerId: number,
    query: Omit<ListDevicesQuery, "customerId">,
  ): Promise<ListDevicesResult> {
    assertCustomerScope(actor, customerId);
    const customer = await this.repository.findCustomer(pool, customerId);

    if (!customer) {
      throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
    }

    return this.list(actor, { ...query, customerId });
  }

  public async getById(
    actor: Express.AuthenticatedUser,
    deviceId: number,
  ): Promise<Device> {
    const device = await this.repository.findById(pool, deviceId);

    if (!device) {
      throw new NotFoundError("Device not found", "DEVICE_NOT_FOUND");
    }

    assertDeviceAccess(actor, device);
    return toDevice(device);
  }

  public async create(
    actor: Express.AuthenticatedUser,
    input: CreateDeviceDto,
  ): Promise<Device> {
    let customerId: number;

    if (actor.role === "CUSTOMER") {
      if (input.customerId !== undefined && input.customerId !== actor.id) {
        throw new ForbiddenError("You may create devices only for yourself", "FORBIDDEN");
      }

      customerId = actor.id;
    } else if (isDeviceStaff(actor)) {
      if (input.customerId === undefined) {
        throw new BadRequestError(
          "customerId is required when staff create a device",
          "CUSTOMER_ID_REQUIRED",
        );
      }

      customerId = input.customerId;
    } else {
      throw new ForbiddenError("You are not allowed to create devices", "FORBIDDEN");
    }

    return this.runInTransaction(async (connection) => {
      const customer = await this.repository.findCustomer(connection, customerId, true);

      if (!customer) {
        throw new NotFoundError("Customer not found", "CUSTOMER_NOT_FOUND");
      }

      if (customer.status !== "ACTIVE") {
        throw new ConflictError("Customer account is not active", "CUSTOMER_NOT_ACTIVE");
      }

      await this.requireActiveCategory(connection, input.categoryId);

      if (input.brandId !== undefined && input.brandId !== null) {
        await this.requireActiveBrand(connection, input.brandId);
      }

      const deviceId = await this.repository.create(connection, {
        ...input,
        customerId,
      });
      const created = await this.repository.findById(connection, deviceId);

      if (!created) {
        throw new NotFoundError("Created device could not be loaded", "DEVICE_NOT_FOUND");
      }

      return toDevice(created);
    });
  }

  public async update(
    actor: Express.AuthenticatedUser,
    deviceId: number,
    input: UpdateDeviceDto,
  ): Promise<Device> {
    return this.runInTransaction(async (connection) => {
      const current = await this.repository.findById(connection, deviceId, true);

      if (!current) {
        throw new NotFoundError("Device not found", "DEVICE_NOT_FOUND");
      }

      assertDeviceAccess(actor, current);

      if (input.categoryId !== undefined) {
        await this.requireActiveCategory(connection, input.categoryId);
      }

      if (input.brandId !== undefined && input.brandId !== null) {
        await this.requireActiveBrand(connection, input.brandId);
      }

      await this.repository.update(connection, deviceId, input);
      const updated = await this.repository.findById(connection, deviceId);

      if (!updated) {
        throw new NotFoundError("Device not found", "DEVICE_NOT_FOUND");
      }

      return toDevice(updated);
    });
  }

  public async delete(actor: Express.AuthenticatedUser, deviceId: number): Promise<void> {
    await this.runInTransaction(async (connection) => {
      const device = await this.repository.findById(connection, deviceId, true);

      if (!device) {
        throw new NotFoundError("Device not found", "DEVICE_NOT_FOUND");
      }

      assertDeviceAccess(actor, device);
      await this.repository.softDelete(connection, deviceId);
    });
  }

  public async listCategories(): Promise<CatalogItem[]> {
    const rows = await this.repository.listActiveCategories();
    return rows.map(toCatalogItem);
  }

  public async listBrands(): Promise<CatalogItem[]> {
    const rows = await this.repository.listActiveBrands();
    return rows.map(toCatalogItem);
  }

  private async requireActiveCategory(
    connection: PoolConnection,
    categoryId: number,
  ): Promise<void> {
    const category = await this.repository.findActiveCategory(connection, categoryId);

    if (!category) {
      throw new NotFoundError(
        "Active device category not found",
        "DEVICE_CATEGORY_NOT_FOUND",
      );
    }
  }

  private async requireActiveBrand(
    connection: PoolConnection,
    brandId: number,
  ): Promise<void> {
    const brand = await this.repository.findActiveBrand(connection, brandId);

    if (!brand) {
      throw new NotFoundError("Active device brand not found", "DEVICE_BRAND_NOT_FOUND");
    }
  }
}

export const deviceService = new DeviceService();
