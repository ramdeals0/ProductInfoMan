import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createImportTemplate,
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
  const header = "sku,product_type,title,parent_sku,category_code,color";
  const body = rows.map((row) => row.join(",")).join("\n");
  return Buffer.from(`${header}\n${body}`, "utf8");
}

describe("Import and Validation", () => {
  // Phase 3 spec §8: Uploading a CSV and creating an import_job.
  it("uploads a CSV and creates an import job", async () => {
    const ts = Date.now();
    const csv = buildCsv([[`UP-${ts}`, "SIMPLE", "Upload Test", "", shirtsCategoryCode, ""]]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `upload-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    expect(uploaded.id).toBeTruthy();
    expect(uploaded.status).toBe("UPLOADED");
    expect(uploaded.fileName).toBe(`upload-${ts}.csv`);
  });

  // Phase 3 spec §8: Missing required fields.
  it("rejects rows with missing required fields", async () => {
    const ts = Date.now();
    const csv = buildCsv([[`REQ-${ts}`, "SIMPLE", "", "", shirtsCategoryCode, ""]]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `required-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.invalidRows).toBeGreaterThanOrEqual(1);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors.some((error) => error.errorCode === "REQUIRED_FIELD")).toBe(true);
  });

  // Phase 3 spec §8: Invalid category code.
  it("rejects invalid category codes", async () => {
    const ts = Date.now();
    const csv = buildCsv([
      [`CAT-${ts}`, "SIMPLE", "Bad Category", "", "not-a-real-category", ""],
    ]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `category-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(0);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors.some((error) => error.errorCode === "INVALID_CATEGORY")).toBe(true);
  });

  // Phase 3 spec §8: Invalid attribute code.
  it("rejects unknown attribute keys", async () => {
    const ts = Date.now();
    const template = await createImportTemplate(organizationId, {
      code: `attr-tpl-${ts}`,
      name: "Attribute validation template",
      mappings: [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "title", targetField: "title", isRequired: true },
        { sourceColumn: "parent_sku", targetField: "parent_sku" },
        { sourceColumn: "category_code", targetField: "category_code" },
        { sourceColumn: "unknown_attr", targetField: "unknown_attr" },
      ],
    });

    const customCsv = Buffer.from(
      `sku,product_type,title,parent_sku,category_code,unknown_attr\nATTR-${ts},SIMPLE,Bad Attribute,,${shirtsCategoryCode},value`,
      "utf8",
    );

    const uploaded = await uploadImport(organizationId, {
      fileName: `attribute-${ts}.csv`,
      fileBuffer: customCsv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
      importTemplateId: template.id,
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(0);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors.some((error) => error.errorCode === "UNKNOWN_ATTRIBUTE")).toBe(true);
  });

  // Phase 3 spec §8: Duplicate external_id/sku within file.
  it("rejects duplicate skus within the file", async () => {
    const ts = Date.now();
    const csv = buildCsv([
      [`DUP-${ts}`, "SIMPLE", "First", "", shirtsCategoryCode, ""],
      [`DUP-${ts}`, "SIMPLE", "Second", "", shirtsCategoryCode, ""],
    ]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `dup-file-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(1);
    expect(validated.invalidRows).toBe(1);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors.some((error) => error.errorCode === "DUPLICATE_KEY")).toBe(true);
  });

  // Phase 3 spec §8: Invalid parent reference.
  it("rejects invalid parent references", async () => {
    const ts = Date.now();
    const csv = buildCsv([
      [`VP-${ts}`, "VARIANT", "Orphan Variant", "MISSING-PARENT", shirtsCategoryCode, ""],
    ]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `parent-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(0);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors.some((error) => error.errorCode === "INVALID_PARENT_REFERENCE")).toBe(true);
  });

  // Phase 3 spec §8: Rejects duplicate sku already in catalog.
  it("rejects duplicate skus already in the catalog", async () => {
    const ts = Date.now();
    await prisma.product.create({
      data: {
        organizationId,
        productType: "SIMPLE",
        sku: `EXISTING-${ts}`,
        title: "Existing Product",
      },
    });

    const csv = buildCsv([[`EXISTING-${ts}`, "SIMPLE", "Duplicate Existing", "", "", ""]]);
    const uploaded = await uploadImport(organizationId, {
      fileName: `duplicate-db-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(0);

    const errors = await getImportErrors(uploaded.id, organizationId);
    expect(errors[0]).toMatchObject({
      errorCode: "DUPLICATE_KEY",
      fieldName: "sku",
    });
  });

  // Phase 3 spec §8: Processing creates new products when mode allows.
  it("processes valid rows and creates products", async () => {
    const ts = Date.now();
    const parentSku = `IMP-P-${ts}`;
    const variantSku = `IMP-V-${ts}`;

    const csv = buildCsv([
      [parentSku, "PARENT", "Imported Parent", "", shirtsCategoryCode, ""],
      [variantSku, "VARIANT", "Imported Variant", parentSku, shirtsCategoryCode, "blue"],
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

  // Phase 3 spec §8: Error report CSV is downloadable.
  it("returns a CSV error report", async () => {
    const ts = Date.now();
    const csv = buildCsv([[`RPT-${ts}`, "SIMPLE", "", "", shirtsCategoryCode, ""]]);

    const uploaded = await uploadImport(organizationId, {
      fileName: `report-${ts}.csv`,
      fileBuffer: csv,
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    await validateImport(uploaded.id, organizationId);
    const report = await getImportReport(uploaded.id, organizationId);
    expect(report).toContain("row_number,field_name,error_code,error_message,raw_value");
    expect(report).toContain("REQUIRED_FIELD");
  });

  it("uploads JSON and validates product rows", async () => {
    const ts = Date.now();
    const payload = Buffer.from(
      JSON.stringify([
        {
          sku: `JSON-${ts}`,
          product_type: "SIMPLE",
          title: "JSON Import Product",
          category_code: shirtsCategoryCode,
          attributes: { color: "Blue", size: "M" },
        },
      ]),
      "utf8",
    );

    const template = await createImportTemplate(organizationId, {
      code: `json-tpl-${ts}`,
      name: "JSON nested attributes",
      sourceFormat: "JSON",
      mappings: [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "title", targetField: "title", isRequired: true },
        { sourceColumn: "category_code", targetField: "category_code" },
        { sourceColumn: "attributes.color", targetField: "color" },
        { sourceColumn: "attributes.size", targetField: "size" },
      ],
    });

    const uploaded = await uploadImport(organizationId, {
      fileName: `products-${ts}.json`,
      fileBuffer: payload,
      fileType: "JSON",
      importType: "CREATE",
      duplicatePolicy: "REJECT",
      importTemplateId: template.id,
    });

    expect(uploaded.fileType).toBe("JSON");
    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(1);
    expect(validated.status).toBe("VALIDATED");
  });

  it("fails validation for malformed JSON files", async () => {
    const ts = Date.now();
    const uploaded = await uploadImport(organizationId, {
      fileName: `broken-${ts}.json`,
      fileBuffer: Buffer.from("{not-json", "utf8"),
      fileType: "JSON",
      importType: "CREATE",
    });

    await expect(validateImport(uploaded.id, organizationId)).rejects.toThrow(/Malformed JSON/);
    const job = await getImportJob(uploaded.id, organizationId);
    expect(job.status).toBe("VALIDATION_FAILED");
    expect(job.errorMessage).toContain("Malformed JSON");
  });

  it("uploads XML and validates product rows with the default template", async () => {
    const ts = Date.now();
    const xml = Buffer.from(
      `<?xml version="1.0"?><products><product><sku>XML-DEF-${ts}</sku><product_type>SIMPLE</product_type><title>XML Default Template Product</title><category_code>${shirtsCategoryCode}</category_code><attributes><color>Red</color><size>L</size><fabric>Cotton</fabric></attributes></product></products>`,
      "utf8",
    );

    const uploaded = await uploadImport(organizationId, {
      fileName: `products-default-${ts}.xml`,
      fileBuffer: xml,
      fileType: "XML",
      importType: "CREATE",
      duplicatePolicy: "REJECT",
    });

    expect(uploaded.fileType).toBe("XML");
    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(1);
    expect(validated.status).toBe("VALIDATED");
  });

  it("uploads XML and validates product rows", async () => {
    const ts = Date.now();
    const xml = Buffer.from(
      `<?xml version="1.0"?><products><product><sku>XML-${ts}</sku><product_type>SIMPLE</product_type><title>XML Product</title><category_code>${shirtsCategoryCode}</category_code><attributes><color>Red</color><size>L</size></attributes></product></products>`,
      "utf8",
    );

    const template = await createImportTemplate(organizationId, {
      code: `xml-tpl-${ts}`,
      name: "XML nested attributes",
      sourceFormat: "XML",
      mappings: [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "title", targetField: "title", isRequired: true },
        { sourceColumn: "category_code", targetField: "category_code" },
        { sourceColumn: "attributes.color", targetField: "color" },
        { sourceColumn: "attributes.size", targetField: "size" },
      ],
    });

    const uploaded = await uploadImport(organizationId, {
      fileName: `products-${ts}.xml`,
      fileBuffer: xml,
      fileType: "XML",
      importType: "CREATE",
      duplicatePolicy: "REJECT",
      importTemplateId: template.id,
    });

    expect(uploaded.fileType).toBe("XML");
    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(1);
    expect(validated.status).toBe("VALIDATED");
  });

  it("commits XML merchandising fields even when the template lacks those mappings", async () => {
    const ts = Date.now();
    const sku = `XML-0011-${ts}`;
    const xml = Buffer.from(
      `<?xml version="1.0"?><products><product><sku>${sku}</sku><product_type>SIMPLE</product_type><title>XML Merch Product</title><description>Full description</description><brand>Demo Brand</brand><category_code>${shirtsCategoryCode}</category_code><summary>Imported summary text</summary><selling_points>Point one|Point two</selling_points><start_date>2025-03-01</start_date><discontinue_date>2028-03-01</discontinue_date><attributes><color>Blue</color><size>M</size></attributes></product></products>`,
      "utf8",
    );

    const template = await createImportTemplate(organizationId, {
      code: `xml-legacy-${ts}`,
      name: "Legacy XML template",
      sourceFormat: "XML",
      mappings: [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "title", targetField: "title", isRequired: true },
        { sourceColumn: "description", targetField: "description" },
        { sourceColumn: "brand", targetField: "brand" },
        { sourceColumn: "category_code", targetField: "category_code" },
        { sourceColumn: "attributes.color", targetField: "color" },
        { sourceColumn: "attributes.size", targetField: "size" },
      ],
    });

    const uploaded = await uploadImport(organizationId, {
      fileName: `products-${ts}.xml`,
      fileBuffer: xml,
      fileType: "XML",
      importType: "CREATE",
      duplicatePolicy: "REJECT",
      importTemplateId: template.id,
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(1);

    await processImportJob(uploaded.id, organizationId);

    const product = await prisma.product.findFirst({
      where: { organizationId, sku },
    });

    expect(product).not.toBeNull();
    expect(product?.summary).toBe("Imported summary text");
    expect(product?.sellingPoints).toEqual(["Point one", "Point two"]);
    expect(product?.startDate?.toISOString()).toBe("2025-03-01T00:00:00.000Z");
    expect(product?.discontinueDate?.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  it("updates merchandising fields on UPSERT for an existing SKU", async () => {
    const ts = Date.now();
    const sku = `XML-UPSERT-${ts}`;

    await prisma.product.create({
      data: {
        organizationId,
        productType: "SIMPLE",
        sku,
        title: "Existing Product",
      },
    });

    const xml = Buffer.from(
      `<?xml version="1.0"?><products><product><sku>${sku}</sku><product_type>SIMPLE</product_type><title>Updated Product</title><category_code>${shirtsCategoryCode}</category_code><summary>Updated summary</summary><selling_points>Alpha|Beta</selling_points><start_date>2025-04-01</start_date><discontinue_date>2029-04-01</discontinue_date></product></products>`,
      "utf8",
    );

    const uploaded = await uploadImport(organizationId, {
      fileName: `upsert-${ts}.xml`,
      fileBuffer: xml,
      fileType: "XML",
      importType: "UPSERT",
      duplicatePolicy: "REJECT",
    });

    const validated = await validateImport(uploaded.id, organizationId);
    expect(validated.validRows).toBe(1);

    await processImportJob(uploaded.id, organizationId);

    const product = await prisma.product.findFirst({
      where: { organizationId, sku },
    });

    expect(product?.title).toBe("Updated Product");
    expect(product?.summary).toBe("Updated summary");
    expect(product?.sellingPoints).toEqual(["Alpha", "Beta"]);
    expect(product?.startDate?.toISOString()).toBe("2025-04-01T00:00:00.000Z");
    expect(product?.discontinueDate?.toISOString()).toBe("2029-04-01T00:00:00.000Z");
  });
});
