import { describe, expect, it } from "vitest";
import {
  applyChannelMappings,
  buildExportRows,
  isPublishableStatus,
  serializeExportCsv,
  validateChannelExport,
  type CanonicalProductRecord,
  type ChannelFieldMappingInput,
} from "./index.js";

const sampleRecord: CanonicalProductRecord = {
  product_id: "prod-1",
  sku: "SHIRT-001-BL-M",
  product_type: "VARIANT",
  status: "APPROVED",
  title: "Classic Oxford Shirt",
  description: "Long sleeve oxford shirt",
  brand: "Acme",
  parent_sku: "SHIRT-001",
  category_code: "shirts",
  category_path: "/apparel/mens/shirts",
  attributes: { color: "Blue", size: "M" },
};

const mappings: ChannelFieldMappingInput[] = [
  {
    sourceField: "sku",
    targetField: "Variant SKU",
    transformType: "DIRECT",
    isRequired: true,
    sortOrder: 0,
  },
  {
    sourceField: "title",
    targetField: "Title",
    transformType: "DIRECT",
    isRequired: true,
    sortOrder: 1,
  },
  {
    sourceField: "attributes.color",
    targetField: "Color",
    transformType: "LOOKUP",
    transformConfig: {
      lookup: { Blue: "Navy Blue", White: "White" },
    },
    isRequired: false,
    sortOrder: 2,
  },
  {
    sourceField: "brand",
    targetField: "Vendor",
    transformType: "DEFAULT",
    transformConfig: { defaultValue: "Unknown" },
    isRequired: false,
    sortOrder: 3,
  },
];

describe("isPublishableStatus", () => {
  it("allows approved and published statuses", () => {
    expect(isPublishableStatus("APPROVED")).toBe(true);
    expect(isPublishableStatus("PUBLISHED")).toBe(true);
    expect(isPublishableStatus("DRAFT")).toBe(false);
  });
});

describe("applyChannelMappings", () => {
  it("maps canonical fields to channel fields with transforms", () => {
    const row = applyChannelMappings(sampleRecord, mappings);
    expect(row.fields["Variant SKU"]).toBe("SHIRT-001-BL-M");
    expect(row.fields.Title).toBe("Classic Oxford Shirt");
    expect(row.fields.Color).toBe("Navy Blue");
    expect(row.fields.Vendor).toBe("Acme");
  });

  it("reports required field errors", () => {
    const row = applyChannelMappings(
      { ...sampleRecord, sku: "" },
      mappings,
    );
    expect(row.errors.some((error) => error.targetField === "Variant SKU")).toBe(true);
  });
});

describe("validateChannelExport", () => {
  it("rejects non-publishable statuses", () => {
    const errors = validateChannelExport(
      { ...sampleRecord, status: "DRAFT" },
      [{ code: "status", ruleType: "ALLOWED_STATUS", ruleConfig: { statuses: ["APPROVED"] } }],
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("buildExportRows and serializeExportCsv", () => {
  it("builds CSV export output", () => {
    const rows = buildExportRows([sampleRecord], mappings);
    const csv = serializeExportCsv(rows, ["Variant SKU", "Title", "Color", "Vendor"]);
    expect(csv).toContain("Variant SKU,Title,Color,Vendor");
    expect(csv).toContain("SHIRT-001-BL-M");
    expect(csv).toContain("Navy Blue");
  });
});
