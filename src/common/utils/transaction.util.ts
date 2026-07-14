import type { Pool, PoolConnection } from "mysql2/promise";
import { logger } from "./logger.js";
import { pool } from "../../config/database.js";

export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
  transactionPool: Pool = pool,
): Promise<T> {
  const connection = await transactionPool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error("Database transaction rollback failed", {
        message: rollbackError instanceof Error ? rollbackError.message : "Unknown error",
      });
    }

    throw error;
  } finally {
    connection.release();
  }
}
