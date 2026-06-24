import { describe, expect, it } from "vitest";
import { validatePassword } from "./password-policy.js";

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    const result = validatePassword("Admin123!@#demo");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects short and weak passwords", () => {
    const result = validatePassword("password");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
