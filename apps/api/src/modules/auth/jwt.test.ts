import { describe, expect, it } from "vitest";
import { getRefreshTokenTtlMs, signAccessToken } from "./jwt.js";

describe("signAccessToken", () => {
  it("embeds organization and role claims", async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "admin@demo.local",
      organizationId: "org-1",
      organizationSlug: "demo",
      roles: ["admin"],
      tokenVersion: 0,
    });

    expect(token.split(".")).toHaveLength(3);
  });
});

describe("getRefreshTokenTtlMs", () => {
  it("uses privileged TTL for admin and approver roles", () => {
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    process.env.JWT_REFRESH_EXPIRES_IN_PRIVILEGED = "24h";

    expect(getRefreshTokenTtlMs(["product_editor"])).toBe(7 * 24 * 60 * 60 * 1000);
    expect(getRefreshTokenTtlMs(["admin"])).toBe(24 * 60 * 60 * 1000);
    expect(getRefreshTokenTtlMs(["product_approver"])).toBe(24 * 60 * 60 * 1000);
  });
});
