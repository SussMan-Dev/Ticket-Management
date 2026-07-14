import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

type DatabaseExecutor = Pool | PoolConnection;

export interface CreateAuditLogInput {
  userId: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditLogRepository {
  public async create(
    executor: DatabaseExecutor,
    input: CreateAuditLogInput,
  ): Promise<number> {
    const [result] = await executor.execute<ResultSetHeader>(
      `
        INSERT INTO audit_logs (
          user_id,
          action,
          entity_type,
          entity_id,
          old_data,
          new_data,
          ip_address,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId,
        input.action,
        input.entityType,
        input.entityId === undefined || input.entityId === null
          ? null
          : String(input.entityId),
        input.oldData === undefined ? null : JSON.stringify(input.oldData),
        input.newData === undefined ? null : JSON.stringify(input.newData),
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );

    return result.insertId;
  }
}

export const auditLogRepository = new AuditLogRepository();
