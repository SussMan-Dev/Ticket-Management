import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/common/utils/jwt.util.js";
import {
  comparePassword,
  hashPassword,
} from "../src/common/utils/password.util.js";
import {
  hashRefreshToken,
  refreshTokenHashMatches,
} from "../src/common/utils/refresh-token.util.js";

const sessionId = "c41456d7-dbc8-42df-8668-cce2a7cb35f1";

describe("authentication utilities", () => {
  it("hashes and compares passwords without retaining plaintext", async () => {
    const password = "Password123";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    await expect(comparePassword(password, hash)).resolves.toBe(true);
    await expect(comparePassword("WrongPassword123", hash)).resolves.toBe(false);
  });

  it("signs and verifies access token claims", () => {
    const signed = signAccessToken({
      sub: 10,
      email: "admin@example.com",
      role: "ADMIN",
      sessionId,
    });

    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(verifyAccessToken(signed.token)).toEqual({
      sub: 10,
      email: "admin@example.com",
      role: "ADMIN",
      sessionId,
    });
  });

  it("keeps refresh claims separate from access claims", () => {
    const signed = signRefreshToken({ sub: 10, sessionId, type: "refresh" });

    expect(verifyRefreshToken(signed.token)).toEqual({
      sub: 10,
      sessionId,
      type: "refresh",
    });
    expect(() => verifyAccessToken(signed.token)).toThrow();
  });

  it("hashes refresh tokens deterministically and compares in constant-time form", () => {
    const token = "high-entropy-refresh-token";
    const hash = hashRefreshToken(token);

    expect(hash).toHaveLength(64);
    expect(refreshTokenHashMatches(token, hash)).toBe(true);
    expect(refreshTokenHashMatches("different-token", hash)).toBe(false);
  });
});
