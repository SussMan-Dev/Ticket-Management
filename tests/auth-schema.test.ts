import { describe, expect, it } from "vitest";
import { registerSchema } from "../src/modules/auth/auth.schema.js";

describe("authentication schemas", () => {
  it("normalizes a valid customer registration", () => {
    const parsed = registerSchema.parse({
      body: {
        fullName: "  Nguyen Van A  ",
        email: "USER@EXAMPLE.COM",
        phone: "0901234567",
        password: "Password123",
      },
    });

    expect(parsed.body.fullName).toBe("Nguyen Van A");
    expect(parsed.body.email).toBe("user@example.com");
  });

  it("rejects client-controlled role and status fields", () => {
    expect(() =>
      registerSchema.parse({
        body: {
          fullName: "Nguyen Van A",
          email: "user@example.com",
          password: "Password123",
          role: "ADMIN",
        },
      }),
    ).toThrow();
  });

  it("rejects weak and bcrypt-oversized passwords", () => {
    const base = {
      fullName: "Nguyen Van A",
      email: "user@example.com",
    };

    expect(() => registerSchema.parse({ body: { ...base, password: "password" } })).toThrow();
    expect(() =>
      registerSchema.parse({ body: { ...base, password: `Password1${"a".repeat(70)}` } }),
    ).toThrow();
  });
});
