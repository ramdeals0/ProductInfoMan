import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./jwt.js";

describe("jwt helpers", () => {
  it("signs and verifies tokens with role claims", async () => {
    const token = await signToken({
      sub: "user-1",
      email: "admin@demo.local",
      organizationId: "org-1",
      organizationSlug: "demo",
      roles: ["admin"],
    });

    const payload = await verifyToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("admin@demo.local");
    expect(payload.roles).toEqual(["admin"]);
  });
});
