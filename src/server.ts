import type { Server } from "node:http";
import { app } from "./app.js";
import { closeDatabasePool, verifyDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./common/utils/logger.js";

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Graceful shutdown started", { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  await closeDatabasePool();
  clearTimeout(forceExitTimer);
  logger.info("Graceful shutdown completed");
}

async function bootstrap(): Promise<void> {
  await verifyDatabaseConnection();

  server = app.listen(env.PORT, () => {
    logger.info("Repair Ticket Management System started", {
      environment: env.NODE_ENV,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
    });
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error("Graceful shutdown failed", {
          message: error instanceof Error ? error.message : "Unknown error",
        });
        process.exit(1);
      });
  });
}

void bootstrap().catch((error: unknown) => {
  logger.error("Application startup failed", {
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
