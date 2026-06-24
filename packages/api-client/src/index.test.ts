import { describe, expect, it } from "vitest";
import { ApiClient } from "./index.js";

describe("ApiClient", () => {
  it("builds request paths with organization header", () => {
    const client = new ApiClient({
      baseUrl: "http://localhost:3001",
      organizationSlug: "demo",
      userEmail: "admin@demo.local",
      actorRole: "ADMIN",
    });

    expect(client).toBeDefined();
    expect(client.getPublishArtifactUrl("job-1")).toBe(
      "http://localhost:3001/api/v1/publish/jobs/job-1/artifact",
    );
  });
});
