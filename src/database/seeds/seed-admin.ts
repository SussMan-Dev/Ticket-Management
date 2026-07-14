import "dotenv/config";
import { z } from "zod";
import { logger } from "../../common/utils/logger.js";
import { closeDatabasePool } from "../../config/database.js";
import { passwordSchema } from "../../modules/auth/auth.schema.js";
import { userService } from "../../modules/users/user.service.js";

const adminSeedSchema = z.object({
  ADMIN_FULL_NAME: z.string().trim().min(2).max(150),
  ADMIN_EMAIL: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  ADMIN_PASSWORD: passwordSchema,
});

async function seedAdmin(): Promise<void> {
  const input = adminSeedSchema.parse(process.env);
  const result = await userService.seedAdmin({
    fullName: input.ADMIN_FULL_NAME,
    email: input.ADMIN_EMAIL,
    password: input.ADMIN_PASSWORD,
  });

  logger.info(result.created ? "Initial admin created" : "Initial admin already exists", {
    userId: result.user.id,
    email: result.user.email,
  });
}

void seedAdmin()
  .catch((error: unknown) => {
    logger.error("Admin seed failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
