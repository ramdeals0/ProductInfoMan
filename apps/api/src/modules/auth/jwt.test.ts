import { describe, expect, it } from "vitest";
import { signAccessToken, verifyToken } from "./jwt.js";

describe("jwt helpers", () => {
  it("signs and verifies tokens with role and token version claims", async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "admin@demo.local",
      organizationId: "org-1",
      organizationSlug: "demo",
      roles: ["admin"],
      tokenVersion: 2,
    });

    const payload = await verifyToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("admin@demo.local");
    expect(payload.roles).toEqual(["admin"]);
    expect(payload.tokenVersion).toBe(2);
  });
});
