import { describe, expect, it } from "vitest";
import { buildRequestHeaders } from "./request-headers";

describe("buildRequestHeaders", () => {
  const config = {
    organizationSlug: "demo",
    accessToken: "token-1",
    userEmail: "admin@demo.local",
    actorRole: "ADMIN",
  };

  it("does not set Content-Type on GET requests without a body", () => {
    const headers = buildRequestHeaders(config, { method: "GET" });
    expect(headers).not.toHaveProperty("Content-Type");
    expect(headers).toMatchObject({
      "X-Organization-Slug": "demo",
      Authorization: "Bearer token-1",
    });
  });

  it("sets Content-Type for JSON request bodies", () => {
    const headers = buildRequestHeaders(config, {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does not set Content-Type for bodyless POST requests", () => {
    const headers = buildRequestHeaders(config, { method: "POST" });
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it("does not set Content-Type for multipart form uploads", () => {
    const formData = new FormData();
    formData.append("file", new Blob(["a"]), "a.csv");
    const headers = buildRequestHeaders(config, { method: "POST", body: formData });
    expect(headers).not.toHaveProperty("Content-Type");
  });
});
