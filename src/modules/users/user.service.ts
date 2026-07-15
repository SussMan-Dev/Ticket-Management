import type { PoolConnection } from "mysql2/promise";
import { ConflictError } from "../../common/errors/conflict-error.js";
import { ForbiddenError } from "../../common/errors/forbidden-error.js";
import { NotFoundError } from "../../common/errors/not-found-error.js";
import {
  auditLogRepository,
  type AuditLogRepository,
} from "../../common/repositories/audit-log.repository.js";
import {
  imageStorageService,
  type ImageStorage,
} from "../../common/services/image-storage.service.js";
import {
  duplicateEntryField,
  isDuplicateEntryError,
} from "../../common/utils/database-error.util.js";
import { hashPassword } from "../../common/utils/password.util.js";
import { logger } from "../../common/utils/logger.js";
import { withTransaction } from "../../common/utils/transaction.util.js";
import { pool } from "../../config/database.js";
import type { RequestMetadata } from "../auth/auth.dto.js";
import {
  authRepository,
  type AuthRepository,
} from "../auth/auth.repository.js";
import type {
  CreateStaffDto,
  ListUsersQuery,
  ListUsersResult,
  UpdateUserDto,
} from "./user.dto.js";
import { toSafeUser, type SafeUser, type UserAccountStatus } from "./user.model.js";
import {
  userRepository,
  type UserRepository,
} from "./user.repository.js";

type TransactionRunner = <T>(
  callback: (connection: PoolConnection) => Promise<T>,
) => Promise<T>;

export interface SeedAdminInput {
  fullName: string;
  email: string;
  password: string;
}

export interface SeedAdminResult {
  user: SafeUser;
  created: boolean;
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

export class UserService {
  public constructor(
    private readonly repository: UserRepository = userRepository,
    private readonly sessions: AuthRepository = authRepository,
    private readonly auditLogs: AuditLogRepository = auditLogRepository,
    private readonly runInTransaction: TransactionRunner = withTransaction,
    private readonly images: ImageStorage = imageStorageService,
  ) {}

  public async list(query: ListUsersQuery): Promise<ListUsersResult> {
    const result = await this.repository.list(query);
    return {
      users: result.rows.map(toSafeUser),
      total: result.total,
    };
  }

  public async getById(userId: number): Promise<SafeUser> {
    const user = await this.repository.findById(pool, userId);

    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    return toSafeUser(user);
  }

  public async createStaff(
    actor: Express.AuthenticatedUser,
    input: CreateStaffDto,
    metadata: RequestMetadata,
  ): Promise<SafeUser> {
    const passwordHash = await hashPassword(input.password);
    const requestMetadata = normalizeMetadata(metadata);

    try {
      return await this.runInTransaction(async (connection) => {
        const role = await this.repository.findRole(connection, input.role);

        if (!role) {
          throw new NotFoundError("Role not found", "ROLE_NOT_FOUND");
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

        const userId = await this.repository.create(connection, {
          ...input,
          roleId: role.id,
          passwordHash,
        });
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "STAFF_USER_CREATED",
          entityType: "USER",
          entityId: userId,
          newData: { email: input.email, role: input.role },
          ...requestMetadata,
        });
        const created = await this.repository.findById(connection, userId);

        if (!created) {
          throw new NotFoundError("Created user could not be loaded", "USER_NOT_FOUND");
        }

        return toSafeUser(created);
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
    userId: number,
    input: UpdateUserDto,
    metadata: RequestMetadata,
  ): Promise<SafeUser> {
    if (actor.role !== "ADMIN" && actor.id !== userId) {
      throw new ForbiddenError("You may update only your own profile", "FORBIDDEN");
    }

    const requestMetadata = normalizeMetadata(metadata);

    try {
      return await this.runInTransaction(async (connection) => {
        const current = await this.repository.findById(connection, userId, true);

        if (!current) {
          throw new NotFoundError("User not found", "USER_NOT_FOUND");
        }

        if (
          input.phone &&
          await this.repository.phoneUsedByAnotherUser(connection, input.phone, userId)
        ) {
          throw new ConflictError("Phone is already in use", "PHONE_ALREADY_EXISTS");
        }

        await this.repository.updateProfile(connection, userId, input);
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "USER_PROFILE_UPDATED",
          entityType: "USER",
          entityId: userId,
          oldData: {
            fullName: current.full_name,
            phone: current.phone,
            avatarUrl: current.avatar_url,
          },
          newData: input,
          ...requestMetadata,
        });
        const updated = await this.repository.findById(connection, userId);

        if (!updated) {
          throw new NotFoundError("User not found", "USER_NOT_FOUND");
        }

        return toSafeUser(updated);
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw duplicateIdentityError(error);
      }

      throw error;
    }
  }

  public async updateAvatar(
    actor: Express.AuthenticatedUser,
    userId: number,
    bytes: Buffer,
    mimeType: string,
    metadata: RequestMetadata,
  ): Promise<SafeUser> {
    if (actor.role !== "ADMIN" && actor.id !== userId) {
      throw new ForbiddenError("You may update only your own avatar", "FORBIDDEN");
    }

    const storedImage = await this.images.storeAvatar(userId, bytes, mimeType);
    const requestMetadata = normalizeMetadata(metadata);
    let previousAvatarUrl: string | null = null;

    try {
      const updated = await this.runInTransaction(async (connection) => {
        const current = await this.repository.findById(connection, userId, true);

        if (!current) {
          throw new NotFoundError("User not found", "USER_NOT_FOUND");
        }

        previousAvatarUrl = current.avatar_url;
        await this.repository.updateProfile(connection, userId, { avatarUrl: storedImage.url });
        await this.auditLogs.create(connection, {
          userId: actor.id,
          action: "USER_AVATAR_UPDATED",
          entityType: "USER",
          entityId: userId,
          oldData: { avatarUrl: current.avatar_url },
          newData: { avatarUrl: storedImage.url },
          ...requestMetadata,
        });
        const result = await this.repository.findById(connection, userId);

        if (!result) {
          throw new NotFoundError("User not found", "USER_NOT_FOUND");
        }

        return toSafeUser(result);
      });

      if (previousAvatarUrl && previousAvatarUrl !== storedImage.url) {
        await this.removeStoredImage(previousAvatarUrl);
      }

      return updated;
    } catch (error) {
      await this.removeStoredImage(storedImage.url);
      throw error;
    }
  }

  private async removeStoredImage(url: string): Promise<void> {
    try {
      await this.images.deleteByUrl(url);
    } catch (error) {
      logger.warn("Failed to remove stored avatar image", {
        url,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public async updateStatus(
    actor: Express.AuthenticatedUser,
    userId: number,
    status: UserAccountStatus,
    metadata: RequestMetadata,
  ): Promise<SafeUser> {
    if (actor.id === userId && status !== "ACTIVE") {
      throw new ForbiddenError(
        "Administrators cannot disable their own account",
        "CANNOT_DISABLE_SELF",
      );
    }

    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const current = await this.repository.findById(connection, userId, true);

      if (!current) {
        throw new NotFoundError("User not found", "USER_NOT_FOUND");
      }

      if (current.status === status) {
        return toSafeUser(current);
      }

      if (current.role === "ADMIN" && current.status === "ACTIVE" && status !== "ACTIVE") {
        const activeAdminIds = await this.repository.findActiveAdminIdsForUpdate(connection);

        if (activeAdminIds.length <= 1) {
          throw new ConflictError(
            "The last active administrator cannot be disabled",
            "LAST_ACTIVE_ADMIN",
          );
        }
      }

      await this.repository.updateStatus(connection, userId, status);
      let revokedSessions = 0;

      if (status !== "ACTIVE") {
        revokedSessions = await this.sessions.revokeAllSessions(connection, userId);
      }

      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "USER_STATUS_CHANGED",
        entityType: "USER",
        entityId: userId,
        oldData: { status: current.status },
        newData: { status, revokedSessions },
        ...requestMetadata,
      });
      const updated = await this.repository.findById(connection, userId);

      if (!updated) {
        throw new NotFoundError("User not found", "USER_NOT_FOUND");
      }

      return toSafeUser(updated);
    });
  }

  public async updateRole(
    actor: Express.AuthenticatedUser,
    userId: number,
    roleCode: Parameters<UserRepository["findRole"]>[1],
    metadata: RequestMetadata,
  ): Promise<SafeUser> {
    const requestMetadata = normalizeMetadata(metadata);
    return this.runInTransaction(async (connection) => {
      const current = await this.repository.findById(connection, userId, true);

      if (!current) {
        throw new NotFoundError("User not found", "USER_NOT_FOUND");
      }

      if (actor.id === userId && current.role === "ADMIN" && roleCode !== "ADMIN") {
        throw new ForbiddenError(
          "Administrators cannot change their own role",
          "CANNOT_MODIFY_SELF_ROLE",
        );
      }

      const role = await this.repository.findRole(connection, roleCode);

      if (!role) {
        throw new NotFoundError("Role not found", "ROLE_NOT_FOUND");
      }

      if (current.role === roleCode) {
        return toSafeUser(current);
      }

      if (current.role === "ADMIN" && current.status === "ACTIVE" && roleCode !== "ADMIN") {
        const activeAdminIds = await this.repository.findActiveAdminIdsForUpdate(connection);

        if (activeAdminIds.length <= 1) {
          throw new ConflictError(
            "The last active administrator cannot change role",
            "LAST_ACTIVE_ADMIN",
          );
        }
      }

      await this.repository.updateRole(connection, userId, role.id);
      const revokedSessions = await this.sessions.revokeAllSessions(connection, userId);
      await this.auditLogs.create(connection, {
        userId: actor.id,
        action: "USER_ROLE_CHANGED",
        entityType: "USER",
        entityId: userId,
        oldData: { role: current.role },
        newData: { role: roleCode, revokedSessions },
        ...requestMetadata,
      });
      const updated = await this.repository.findById(connection, userId);

      if (!updated) {
        throw new NotFoundError("User not found", "USER_NOT_FOUND");
      }

      return toSafeUser(updated);
    });
  }

  public async seedAdmin(input: SeedAdminInput): Promise<SeedAdminResult> {
    const passwordHash = await hashPassword(input.password);

    return this.runInTransaction(async (connection) => {
      const role = await this.repository.findRole(connection, "ADMIN");

      if (!role) {
        throw new NotFoundError("Admin role is not configured", "ROLE_NOT_FOUND");
      }

      const existing = await this.repository.findByEmailForUpdate(connection, input.email);

      if (existing) {
        if (existing.role !== "ADMIN") {
          throw new ConflictError(
            "The configured admin email belongs to a non-admin user",
            "EMAIL_ALREADY_EXISTS",
          );
        }

        return { user: toSafeUser(existing), created: false };
      }

      const userId = await this.repository.create(connection, {
        fullName: input.fullName,
        email: input.email,
        passwordHash,
        role: "ADMIN",
        roleId: role.id,
      });
      await this.auditLogs.create(connection, {
        userId: null,
        action: "INITIAL_ADMIN_SEEDED",
        entityType: "USER",
        entityId: userId,
        newData: { email: input.email, role: "ADMIN" },
      });
      const created = await this.repository.findById(connection, userId);

      if (!created) {
        throw new NotFoundError("Created admin could not be loaded", "USER_NOT_FOUND");
      }

      return { user: toSafeUser(created), created: true };
    });
  }
}

export const userService = new UserService();
