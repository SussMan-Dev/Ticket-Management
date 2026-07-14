import mysql from "mysql2/promise";
import { env } from "./env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: "utf8mb4",
  decimalNumbers: true,
  timezone: "Z",
});

export async function verifyDatabaseConnection(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
