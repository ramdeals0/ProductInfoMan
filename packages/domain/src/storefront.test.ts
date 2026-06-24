import { describe, expect, it } from "vitest";
import { isStorefrontVisible } from "./storefront.js";

describe("isStorefrontVisible", () => {
  it("requires published status and active date window", () => {
    expect(
      isStorefrontVisible({
        status: "PUBLISHED",
        startDate: "2020-01-01",
        discontinueDate: "2030-01-01",
      }),
    ).toBe(true);

    expect(
      isStorefrontVisible(
        {
          status: "PUBLISHED",
          startDate: "2099-01-01",
          discontinueDate: "2100-01-01",
        },
        new Date("2026-06-01"),
      ),
    ).toBe(false);

    expect(
      isStorefrontVisible(
        {
          status: "PUBLISHED",
          startDate: "2020-01-01",
          discontinueDate: "2025-01-01",
        },
        new Date("2026-06-01"),
      ),
    ).toBe(false);

    expect(
      isStorefrontVisible({
        status: "DRAFT",
        startDate: "2020-01-01",
        discontinueDate: "2030-01-01",
      }),
    ).toBe(false);
  });
});
