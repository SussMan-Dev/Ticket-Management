import type { Pool, PoolConnection } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";
import { withTransaction } from "../src/common/utils/transaction.util.js";

function createDatabaseDoubles(): {
  pool: Pool;
  connection: PoolConnection;
  beginTransaction: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const beginTransaction = vi.fn().mockResolvedValue(undefined);
  const commit = vi.fn().mockResolvedValue(undefined);
  const rollback = vi.fn().mockResolvedValue(undefined);
  const release = vi.fn();
  const connection = {
    beginTransaction,
    commit,
    rollback,
    release,
  } as unknown as PoolConnection;
  const pool = {
    getConnection: vi.fn().mockResolvedValue(connection),
  } as unknown as Pool;

  return { pool, connection, beginTransaction, commit, rollback, release };
}

describe("withTransaction", () => {
  it("commits the callback result and always releases the connection", async () => {
    const doubles = createDatabaseDoubles();

    const result = await withTransaction(async (connection) => {
      expect(connection).toBe(doubles.connection);
      return "committed";
    }, doubles.pool);

    expect(result).toBe("committed");
    expect(doubles.beginTransaction).toHaveBeenCalledOnce();
    expect(doubles.commit).toHaveBeenCalledOnce();
    expect(doubles.rollback).not.toHaveBeenCalled();
    expect(doubles.release).toHaveBeenCalledOnce();
  });

  it("rolls back, releases, and preserves the original callback error", async () => {
    const doubles = createDatabaseDoubles();
    const expectedError = new Error("operation failed");

    await expect(
      withTransaction(async () => {
        throw expectedError;
      }, doubles.pool),
    ).rejects.toBe(expectedError);

    expect(doubles.beginTransaction).toHaveBeenCalledOnce();
    expect(doubles.commit).not.toHaveBeenCalled();
    expect(doubles.rollback).toHaveBeenCalledOnce();
    expect(doubles.release).toHaveBeenCalledOnce();
  });
});
