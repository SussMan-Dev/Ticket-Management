import bcrypt from "bcrypt";
import { env } from "../../config/env.js";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "DummyPassword123!NeverUseThisValue",
  env.BCRYPT_SALT_ROUNDS,
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function comparePasswordAgainstDummy(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}
