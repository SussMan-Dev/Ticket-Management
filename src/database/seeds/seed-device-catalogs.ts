import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { logger } from "../../common/utils/logger.js";
import { closeDatabasePool, pool } from "../../config/database.js";

async function seedDeviceCatalogs(): Promise<void> {
  const sql = await readFile(
    resolve(process.cwd(), "src/database/seeds/002_device_catalogs.sql"),
    "utf8",
  );
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/u)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const statement of statements) {
      await connection.query(statement);
    }

    await connection.commit();
    logger.info("Device catalogs seeded", { statements: statements.length });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

void seedDeviceCatalogs()
  .catch((error: unknown) => {
    logger.error("Device catalog seed failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
