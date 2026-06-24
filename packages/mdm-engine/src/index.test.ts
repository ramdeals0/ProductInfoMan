import { describe, expect, it } from "vitest";
import {
  applySurvivorshipRule,
  findDeterministicMatches,
  normalizeSourcePayload,
  resolveMatchStatus,
} from "./index";

describe("mdm-engine matching", () => {
  const context = {
    sourceSystem: "ERP",
    externalIdToProductId: new Map([["ERP::ERP-100", "prod-1"]]),
    gtinToProductId: new Map([["012345678905", "prod-2"]]),
    brandMpnToProductId: new Map([["acme::mpn-9", "prod-3"]]),
    skuToProductId: new Map([["SKU-ABC", "prod-4"]]),
  };

  it("matches by external id", () => {
    const payload = normalizeSourcePayload({ external_id: "ERP-100" });
    const matches = findDeterministicMatches(payload, context);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.productId).toBe("prod-1");
    expect(matches[0]?.matchReason).toBe("exact_external_id");
  });

  it("matches by gtin", () => {
    const payload = normalizeSourcePayload({ gtin: "012345678905" });
    const matches = findDeterministicMatches(payload, context);
    expect(matches[0]?.productId).toBe("prod-2");
  });

  it("returns unmatched when no keys hit", () => {
    const payload = normalizeSourcePayload({ title: "Unknown widget" });
    const matches = findDeterministicMatches(payload, context);
    expect(resolveMatchStatus(matches)).toBe("unmatched");
  });

  it("flags ambiguous when multiple exact keys hit different products", () => {
    const payload = normalizeSourcePayload({
      external_id: "ERP-100",
      gtin: "012345678905",
    });
    const matches = findDeterministicMatches(payload, context);
    expect(matches.length).toBeGreaterThan(1);
    expect(resolveMatchStatus(matches)).toBe("ambiguous");
  });
});

describe("mdm-engine survivorship", () => {
  it("applies source_priority with PLM winning over ERP", () => {
    const outcome = applySurvivorshipRule(
      {
        attributeCode: "title",
        ruleType: "SOURCE_PRIORITY",
        ruleConfigJson: { source_priority: ["PLM", "ERP", "SUPPLIER_FEED"] },
      },
      [
        { sourceSystem: "ERP", value: "ERP Title", updatedAt: "2026-01-01T00:00:00.000Z" },
        { sourceSystem: "PLM", value: "PLM Title", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      "Master Title",
    );

    expect(outcome.value).toBe("PLM Title");
    expect(outcome.winningSource).toBe("PLM");
  });

  it("falls back to ERP when PLM is missing", () => {
    const outcome = applySurvivorshipRule(
      {
        attributeCode: "title",
        ruleType: "SOURCE_PRIORITY",
        ruleConfigJson: { source_priority: ["PLM", "ERP", "SUPPLIER_FEED"] },
      },
      [{ sourceSystem: "ERP", value: "ERP Title", updatedAt: "2026-01-01T00:00:00.000Z" }],
      "Master Title",
    );

    expect(outcome.value).toBe("ERP Title");
    expect(outcome.winningSource).toBe("ERP");
  });

  it("applies most_recent", () => {
    const outcome = applySurvivorshipRule(
      {
        attributeCode: "description",
        ruleType: "MOST_RECENT",
        ruleConfigJson: {},
      },
      [
        { sourceSystem: "ERP", value: "Older", updatedAt: "2026-01-01T00:00:00.000Z" },
        { sourceSystem: "PLM", value: "Newer", updatedAt: "2026-06-01T00:00:00.000Z" },
      ],
    );

    expect(outcome.value).toBe("Newer");
    expect(outcome.reason).toBe("most_recent");
  });
});
