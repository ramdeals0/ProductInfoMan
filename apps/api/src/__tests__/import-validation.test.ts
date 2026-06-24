import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  getImportErrors,
  getImportJob,
  getImportReport,
  processImportJob,
  uploadImport,
  validateImport,
} from "../modules/import/import.service.js";
import { prisma } from "@productinfoman/db";

const ORG_SLUG = "demo";
let organizationId: string;
let shirtsCategoryCode: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const shirts = await prisma.category.findFirst({
    where: { organizationId, code: "shirts" },
  });
  shirtsCategoryCode = shirts?.code ?? "shirts";
});

afterAll(async () => {
  await prisma.$disconnect();
});

function buildCsv(rows: string[][]): Buffer {
  const header = "sku,product_type,title,parent_sku,category_code";
  const body = rows.map((row) => row.join(",")).join("\n");
  return Buffer.from(`${header}\n${body}`, "utf8");
}

describe("Import and Validation", () => {
  it("validates duplicates, missing required fields, and invalid parent references", async () => {
    const ts = Date.now();
    const csv = buildCsv([
      [`P-${ts}`, "PARENT", "Parent Shirt", "", shirtsCategoryCode],
      [`V-${ts}`, "VARIANT", "Blue M", `P-${ts}`, shirtsCategoryCode],
      [`V-${ts}`, "VARIANT", "Duplicate Variant", `P-${ts}`, shirtsCategoryCode],
      [`V-BAD-${ts}`, "VARIANT", "Missing Parent", "MISSING-PARENT", shirtsCategoryCode],
      [`S-${ts}`, "SIMPLE", "", "", shirtsCategoryCode],
    ]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `validation-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.totalRows).toBe(5);
    expect(validated.validRows).toBe(2);
    expect(validated.invalidRows).toBe(3);
    expect(["VALIDATED", "VALIDATION_FAILED"]).toContain(validated.status);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors.some((error) => error.errorCode === "DUPLICATE_KEY")).toBe(true);
    expect(errors.some((error) => error.errorCode === "REQUIRED_FIELD")).toBe(true);
    expect(errors.some((error) => error.errorCode === "INVALID_PARENT_REFERENCE")).toBe(true);

    const report = await getImportReport(uploaded.id, organizationId);
    expect(report).toContain("row_number,field_name,error_code,error_message,raw_value");
    expect(report).toContain("DUPLICATE_KEY");
  });

  it("commits valid rows asynchronously and stores a job summary", async () => {
    const ts = Date.now();
    const parentSku = `IMP-P-${ts}`;
    const variantSku = `IMP-V-${ts}`;

    const csv = buildCsv([
      [parentSku, "PARENT", "Imported Parent", "", shirtsCategoryCode],
      [variantSku, "VARIANT", "Imported Variant", parentSku, shirtsCategoryCode],
    ]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `commit-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(2);
    expect(validated.status).toBe("VALIDATED");

    await processImportJob(uploaded.id, organizationId);

    const job = await getImportJob(uploaded.id, organizationId);
    expect(job.status).toBe("COMPLETED");
    expect(job.committedRows).toBe(2);
    expect(job.summary?.committedRows).toBe(2);

    const parent = await prisma.product.findFirst({
      where: { organizationId, sku: parentSku },
    });
    const variant = await prisma.product.findFirst({
      where: { organizationId, sku: variantSku },
    });
    expect(parent?.productType).toBe("PARENT");
    expect(variant?.productType).toBe("VARIANT");
    expect(variant?.parentId).toBe(parent?.id);
  });

  it("rejects duplicate SKUs already in the catalog", async () => {
    const ts = Date.now();
    await prisma.product.create({
      data: {
        organizationId,
        productType: "SIMPLE",
        sku: `EXISTING-${ts}`,
        title: "Existing Product",
      },
    });

    const csv = buildCsv([[`EXISTING-${ts}`, "SIMPLE", "Duplicate Existing", "", ""]]);
    const uploaded = await uploadImport(organizationId, {
      fileName: `duplicate-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(0);
    expect(validated.invalidRows).toBe(1);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors[0]).toMatchObject({
      errorCode: "DUPLICATE_KEY",
      fieldName: "sku",
    });
  });
});
