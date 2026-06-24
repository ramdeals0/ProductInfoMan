import type {
  ProductMatchCandidateEntity,
  ProductSourceRecordDetailEntity,
  ProductSourceRecordEntity,
  ProductSystemIdEntity,
  SurvivorshipRuleEntity,
} from "@productinfoman/domain";
import type {
  CreateProductSystemIdInput,
  DefineSurvivorshipRuleInput,
  InboundProductInput,
  ListSourceRecordsQuery,
  RegisterSourceRecordInput,
  ResolveMatchDecisionInput,
} from "@productinfoman/validation";
import { createEvent } from "@productinfoman/contracts";
import { prisma } from "@productinfoman/db";
import {
  applySurvivorshipRule,
  findDeterministicMatches,
  normalizeSourcePayload,
  resolveMatchStatus,
  type NormalizedSourcePayload,
} from "@productinfoman/mdm-engine";
import { appError, recordChange } from "@productinfoman/shared";
import type { Prisma } from "../../../../generated/prisma/client.js";
import { emitEvent } from "../../lib/events.js";
import { createProduct, setProductAttributes, updateProduct } from "../product-core/product.service.js";

function toSystemIdDto(row: {
  id: string;
  organizationId: string;
  productId: string;
  systemCode: string;
  externalKey: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductSystemIdEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    productId: row.productId,
    systemCode: row.systemCode,
    externalKey: row.externalKey,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSourceRecordDto(row: {
  id: string;
  organizationId: string;
  productId: string | null;
  sourceSystem: string;
  sourceRecordId: string;
  rawPayloadJson: unknown;
  normalizedPayloadJson: unknown;
  status: "UNMATCHED" | "MATCHED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
}): ProductSourceRecordEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    productId: row.productId,
    sourceSystem: row.sourceSystem,
    sourceRecordId: row.sourceRecordId,
    rawPayloadJson: row.rawPayloadJson as Record<string, unknown>,
    normalizedPayloadJson: row.normalizedPayloadJson as Record<string, unknown> | null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMatchCandidateDto(row: {
  id: string;
  sourceRecordId: string;
  candidateProductId: string;
  matchScore: Prisma.Decimal;
  matchReason: string;
  createdAt: Date;
}): ProductMatchCandidateEntity {
  return {
    id: row.id,
    sourceRecordId: row.sourceRecordId,
    candidateProductId: row.candidateProductId,
    matchScore: Number(row.matchScore),
    matchReason: row.matchReason,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSurvivorshipRuleDto(row: {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  entityType: string;
  attributeCode: string;
  ruleType: "SOURCE_PRIORITY" | "MOST_RECENT" | "MOST_COMPLETE";
  ruleConfigJson: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SurvivorshipRuleEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    entityType: row.entityType,
    attributeCode: row.attributeCode,
    ruleType: row.ruleType,
    ruleConfigJson: row.ruleConfigJson as Record<string, unknown>,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function buildMatchContext(organizationId: string, sourceSystem: string) {
  const [systemIds, products, attributeDefs] = await Promise.all([
    prisma.productSystemId.findMany({ where: { organizationId } }),
    prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        brand: true,
        attributeValues: {
          include: { attributeDefinition: { select: { id: true, key: true } } },
        },
      },
    }),
    prisma.attributeDefinition.findMany({
      where: { organizationId, key: { in: ["gtin", "upc", "mpn"] } },
      select: { id: true, key: true },
    }),
  ]);

  const externalIdToProductId = new Map<string, string>();
  for (const entry of systemIds) {
    externalIdToProductId.set(
      `${entry.systemCode}::${entry.externalKey}`,
      entry.productId,
    );
  }

  const gtinKeys = new Set(
    attributeDefs.filter((def) => def.key === "gtin" || def.key === "upc").map((def) => def.id),
  );
  const mpnKeys = new Set(attributeDefs.filter((def) => def.key === "mpn").map((def) => def.id));

  const gtinToProductId = new Map<string, string>();
  const brandMpnToProductId = new Map<string, string>();
  const skuToProductId = new Map<string, string>();

  for (const product of products) {
    skuToProductId.set(product.sku, product.id);
    let gtin: string | undefined;
    let mpn: string | undefined;

    for (const attr of product.attributeValues) {
      const key = attr.attributeDefinition.key;
      if (gtinKeys.has(attr.attributeDefinition.id) && attr.value != null) {
        gtin = String(attr.value);
      }
      if (mpnKeys.has(attr.attributeDefinition.id) && attr.value != null) {
        mpn = String(attr.value);
      }
      if (!gtin && (key === "gtin" || key === "upc") && attr.value != null) {
        gtin = String(attr.value);
      }
      if (!mpn && key === "mpn" && attr.value != null) {
        mpn = String(attr.value);
      }
    }

    if (gtin) gtinToProductId.set(gtin.trim().toLowerCase(), product.id);
    if (product.brand && mpn) {
      brandMpnToProductId.set(
        `${product.brand.trim().toLowerCase()}::${mpn.trim().toLowerCase()}`,
        product.id,
      );
    }
  }

  return {
    sourceSystem,
    externalIdToProductId,
    gtinToProductId,
    brandMpnToProductId,
    skuToProductId,
  };
}

async function ensureSystemId(
  organizationId: string,
  productId: string,
  systemCode: string,
  externalKey: string,
) {
  await prisma.productSystemId.upsert({
    where: {
      organizationId_systemCode_externalKey: {
        organizationId,
        systemCode,
        externalKey,
      },
    },
    create: {
      organizationId,
      productId,
      systemCode,
      externalKey,
      isPrimary: true,
    },
    update: { productId, isPrimary: true },
  });
}

export async function listProductSystemIds(
  productId: string,
  organizationId: string,
): Promise<ProductSystemIdEntity[]> {
  const rows = await prisma.productSystemId.findMany({
    where: { organizationId, productId },
    orderBy: [{ systemCode: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toSystemIdDto);
}

export async function upsertProductSystemId(
  productId: string,
  organizationId: string,
  input: CreateProductSystemIdInput,
): Promise<ProductSystemIdEntity> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
  });
  if (!product) throw appError("Product not found", 404);

  const row = await prisma.productSystemId.upsert({
    where: {
      organizationId_systemCode_externalKey: {
        organizationId,
        systemCode: input.systemCode,
        externalKey: input.externalKey,
      },
    },
    create: {
      organizationId,
      productId,
      systemCode: input.systemCode,
      externalKey: input.externalKey,
      isPrimary: input.isPrimary ?? true,
    },
    update: {
      productId,
      isPrimary: input.isPrimary ?? true,
    },
  });

  return toSystemIdDto(row);
}

export async function registerSourceRecord(
  organizationId: string,
  input: RegisterSourceRecordInput,
): Promise<ProductSourceRecordEntity> {
  const normalized =
    input.normalizedPayloadJson ?? normalizeSourcePayload(input.rawPayloadJson);

  const row = await prisma.productSourceRecord.upsert({
    where: {
      organizationId_sourceSystem_sourceRecordId: {
        organizationId,
        sourceSystem: input.sourceSystem,
        sourceRecordId: input.sourceRecordId,
      },
    },
    create: {
      organizationId,
      sourceSystem: input.sourceSystem,
      sourceRecordId: input.sourceRecordId,
      rawPayloadJson: input.rawPayloadJson as Prisma.InputJsonValue,
      normalizedPayloadJson: normalized as Prisma.InputJsonValue,
      status: "UNMATCHED",
    },
    update: {
      rawPayloadJson: input.rawPayloadJson as Prisma.InputJsonValue,
      normalizedPayloadJson: normalized as Prisma.InputJsonValue,
      status: "UNMATCHED",
      productId: null,
    },
  });

  return toSourceRecordDto(row);
}

export async function matchSourceRecordToProduct(
  sourceRecordId: string,
  organizationId: string,
): Promise<ProductSourceRecordEntity> {
  const sourceRecord = await prisma.productSourceRecord.findFirst({
    where: { id: sourceRecordId, organizationId },
  });
  if (!sourceRecord) throw appError("Source record not found", 404);

  const normalized = (sourceRecord.normalizedPayloadJson ??
    normalizeSourcePayload(sourceRecord.rawPayloadJson as Record<string, unknown>)) as NormalizedSourcePayload;

  const context = await buildMatchContext(organizationId, sourceRecord.sourceSystem);
  const matches = findDeterministicMatches(normalized, context);
  const status = resolveMatchStatus(matches);

  await prisma.productMatchCandidate.deleteMany({ where: { sourceRecordId } });

  if (matches.length > 0) {
    await prisma.productMatchCandidate.createMany({
      data: matches.map((match) => ({
        sourceRecordId,
        candidateProductId: match.productId,
        matchScore: match.matchScore,
        matchReason:
          status === "ambiguous" ? `multiple_exact_keys:${match.matchReason}` : match.matchReason,
      })),
    });
  }

  if (status === "matched") {
    const productId = matches[0]!.productId;
    const updated = await prisma.productSourceRecord.update({
      where: { id: sourceRecordId },
      data: { productId, status: "MATCHED" },
    });

    if (normalized.externalId) {
      await ensureSystemId(
        organizationId,
        productId,
        sourceRecord.sourceSystem,
        normalized.externalId,
      );
    }

    await emitEvent(
      createEvent("product.mdm.matched", organizationId, {
        productId,
        sourceRecordId,
        sourceSystem: sourceRecord.sourceSystem,
      }),
    );

    return toSourceRecordDto(updated);
  }

  const updated = await prisma.productSourceRecord.update({
    where: { id: sourceRecordId },
    data: { status: "UNMATCHED", productId: null },
  });
  return toSourceRecordDto(updated);
}

export async function applySurvivorshipRules(
  productId: string,
  organizationId: string,
  sourceRecordId: string,
): Promise<{ changedFields: string[] }> {
  const [product, sourceRecord, rules, relatedSourceRecords] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
      },
    }),
    prisma.productSourceRecord.findFirst({ where: { id: sourceRecordId, organizationId } }),
    prisma.survivorshipRule.findMany({
      where: { organizationId, entityType: "product", isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.productSourceRecord.findMany({
      where: { organizationId, productId, status: "MATCHED" },
    }),
  ]);

  if (!product) throw appError("Product not found", 404);
  if (!sourceRecord) throw appError("Source record not found", 404);

  const changedFields: string[] = [];
  const attributeUpdates: Record<string, unknown> = {};
  const coreUpdates: {
    title?: string;
    description?: string | null;
    brand?: string | null;
  } = {};

  const masterAttributes = new Map(
    product.attributeValues.map((attr) => [attr.attributeDefinition.key, attr.value]),
  );

  const buildCandidates = (attributeCode: string) => {
    const values = relatedSourceRecords.map((record) => {
      const normalized = (record.normalizedPayloadJson ??
        normalizeSourcePayload(record.rawPayloadJson as Record<string, unknown>)) as NormalizedSourcePayload;
      const coreValue =
        attributeCode === "title"
          ? normalized.title
          : attributeCode === "description"
            ? normalized.description
            : attributeCode === "brand"
              ? normalized.brand
              : normalized.attributes?.[attributeCode];
      return {
        sourceSystem: record.sourceSystem,
        value: coreValue,
        updatedAt: record.updatedAt.toISOString(),
      };
    });
    return values;
  };

  for (const rule of rules) {
    const candidates = buildCandidates(rule.attributeCode);
    const outcome = applySurvivorshipRule(
      {
        attributeCode: rule.attributeCode,
        ruleType: rule.ruleType,
        ruleConfigJson: rule.ruleConfigJson as Record<string, unknown>,
      },
      candidates,
      ["title", "description", "brand"].includes(rule.attributeCode)
        ? rule.attributeCode === "title"
          ? product.title
          : rule.attributeCode === "description"
            ? product.description
            : product.brand
        : masterAttributes.get(rule.attributeCode),
    );

    if (outcome.value == null || outcome.winningSource == null) continue;

    if (rule.attributeCode === "title" && outcome.value !== product.title) {
      coreUpdates.title = String(outcome.value);
      changedFields.push("title");
    } else if (rule.attributeCode === "description" && outcome.value !== product.description) {
      coreUpdates.description = outcome.value == null ? null : String(outcome.value);
      changedFields.push("description");
    } else if (rule.attributeCode === "brand" && outcome.value !== product.brand) {
      coreUpdates.brand = outcome.value == null ? null : String(outcome.value);
      changedFields.push("brand");
    } else if (
      masterAttributes.get(rule.attributeCode) !== outcome.value &&
      !["title", "description", "brand"].includes(rule.attributeCode)
    ) {
      attributeUpdates[rule.attributeCode] = outcome.value;
      changedFields.push(rule.attributeCode);
    }

    await recordChange({
      organizationId,
      entityType: "Product",
      entityId: productId,
      productId,
      action: "UPDATE",
      source: "mdm",
      changes: {
        survivorshipRule: rule.code,
        attributeCode: rule.attributeCode,
        winningSource: outcome.winningSource,
        reason: outcome.reason,
        sourceRecordId,
      },
    });
  }

  if (Object.keys(coreUpdates).length > 0) {
    await updateProduct(productId, organizationId, coreUpdates);
  }

  if (Object.keys(attributeUpdates).length > 0) {
    await setProductAttributes(productId, organizationId, { attributes: attributeUpdates });
  }

  if (changedFields.length > 0) {
    await emitEvent(
      createEvent("product.mdm.merged", organizationId, {
        productId,
        sourceRecordId,
        changedFields,
      }),
    );

    for (const field of changedFields) {
      await emitEvent(
        createEvent("product.mdm.attribute_overridden", organizationId, {
          productId,
          attributeCode: field,
          sourceRecordId,
          sourceSystem: sourceRecord.sourceSystem,
        }),
      );
    }
  }

  return { changedFields };
}

export async function listSourceRecords(
  organizationId: string,
  query: ListSourceRecordsQuery,
): Promise<{ items: ProductSourceRecordEntity[]; total: number; page: number; pageSize: number }> {
  const where = {
    organizationId,
    ...(query.sourceSystem ? { sourceSystem: query.sourceSystem } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.productSourceRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.productSourceRecord.count({ where }),
  ]);

  return {
    items: rows.map(toSourceRecordDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getSourceRecord(
  sourceRecordId: string,
  organizationId: string,
): Promise<ProductSourceRecordDetailEntity> {
  const row = await prisma.productSourceRecord.findFirst({
    where: { id: sourceRecordId, organizationId },
    include: { matchCandidates: { orderBy: { matchScore: "desc" } } },
  });
  if (!row) throw appError("Source record not found", 404);

  return {
    ...toSourceRecordDto(row),
    matchCandidates: row.matchCandidates.map(toMatchCandidateDto),
  };
}

export async function resolveMatchDecision(
  sourceRecordId: string,
  organizationId: string,
  input: ResolveMatchDecisionInput,
): Promise<ProductSourceRecordEntity> {
  const sourceRecord = await prisma.productSourceRecord.findFirst({
    where: { id: sourceRecordId, organizationId },
  });
  if (!sourceRecord) throw appError("Source record not found", 404);

  if (input.action === "ignore") {
    const updated = await prisma.productSourceRecord.update({
      where: { id: sourceRecordId },
      data: { status: "REJECTED" },
    });
    return toSourceRecordDto(updated);
  }

  if (input.action === "create_new_product") {
    const normalized = (sourceRecord.normalizedPayloadJson ??
      normalizeSourcePayload(sourceRecord.rawPayloadJson as Record<string, unknown>)) as NormalizedSourcePayload;

    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: normalized.sku ?? `${sourceRecord.sourceSystem}-${sourceRecord.sourceRecordId}`,
      title: normalized.title ?? normalized.sku ?? sourceRecord.sourceRecordId,
      description: normalized.description,
      brand: normalized.brand,
    });

    if (normalized.attributes && Object.keys(normalized.attributes).length > 0) {
      await setProductAttributes(product.id, organizationId, { attributes: normalized.attributes });
    }

    if (normalized.externalId) {
      await ensureSystemId(
        organizationId,
        product.id,
        sourceRecord.sourceSystem,
        normalized.externalId,
      );
    }

    const updated = await prisma.productSourceRecord.update({
      where: { id: sourceRecordId },
      data: { productId: product.id, status: "MATCHED" },
    });

    await applySurvivorshipRules(product.id, organizationId, sourceRecordId);
    await emitEvent(
      createEvent("product.mdm.matched", organizationId, {
        productId: product.id,
        sourceRecordId,
        sourceSystem: sourceRecord.sourceSystem,
      }),
    );

    return toSourceRecordDto(updated);
  }

  if (!input.productId) throw appError("productId is required for link action", 400);

  const updated = await prisma.productSourceRecord.update({
    where: { id: sourceRecordId },
    data: { productId: input.productId, status: "MATCHED" },
  });

  const normalized = (sourceRecord.normalizedPayloadJson ??
    normalizeSourcePayload(sourceRecord.rawPayloadJson as Record<string, unknown>)) as NormalizedSourcePayload;
  if (normalized.externalId) {
    await ensureSystemId(
      organizationId,
      input.productId,
      sourceRecord.sourceSystem,
      normalized.externalId,
    );
  }

  await applySurvivorshipRules(input.productId, organizationId, sourceRecordId);
  await emitEvent(
    createEvent("product.mdm.matched", organizationId, {
      productId: input.productId,
      sourceRecordId,
      sourceSystem: sourceRecord.sourceSystem,
    }),
  );

  return toSourceRecordDto(updated);
}

export async function listSurvivorshipRules(
  organizationId: string,
): Promise<SurvivorshipRuleEntity[]> {
  const rows = await prisma.survivorshipRule.findMany({
    where: { organizationId },
    orderBy: { code: "asc" },
  });
  return rows.map(toSurvivorshipRuleDto);
}

export async function createSurvivorshipRule(
  organizationId: string,
  input: DefineSurvivorshipRuleInput,
): Promise<SurvivorshipRuleEntity> {
  const row = await prisma.survivorshipRule.create({
    data: {
      organizationId,
      code: input.code,
      name: input.name,
      entityType: input.entityType,
      attributeCode: input.attributeCode,
      ruleType: input.ruleType,
      ruleConfigJson: input.ruleConfigJson as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
    },
  });
  return toSurvivorshipRuleDto(row);
}

export async function processInboundProduct(
  organizationId: string,
  input: InboundProductInput,
): Promise<{ sourceRecord: ProductSourceRecordEntity; productId: string | null }> {
  const normalized = normalizeSourcePayload(input.payload);
  const sourceRecord = await registerSourceRecord(organizationId, {
    sourceSystem: input.sourceSystem,
    sourceRecordId: input.sourceRecordId,
    rawPayloadJson: input.payload,
    normalizedPayloadJson: normalized,
  });

  const matched = await matchSourceRecordToProduct(sourceRecord.id, organizationId);

  if (matched.status === "MATCHED" && matched.productId) {
    await applySurvivorshipRules(matched.productId, organizationId, matched.id);
    return { sourceRecord: matched, productId: matched.productId };
  }

  if (matched.status === "UNMATCHED" && input.createIfUnmatched) {
    const created = await resolveMatchDecision(matched.id, organizationId, {
      action: "create_new_product",
    });
    return { sourceRecord: created, productId: created.productId };
  }

  return { sourceRecord: matched, productId: matched.productId };
}

export async function processImportRowThroughMdm(params: {
  organizationId: string;
  sourceSystem: string;
  sourceRecordId: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: NormalizedSourcePayload;
  createIfUnmatched?: boolean;
}): Promise<{ productId: string | null; sourceRecordId: string; status: string }> {
  const sourceRecord = await registerSourceRecord(params.organizationId, {
    sourceSystem: params.sourceSystem,
    sourceRecordId: params.sourceRecordId,
    rawPayloadJson: params.rawPayload,
    normalizedPayloadJson: params.normalizedPayload,
  });

  const matched = await matchSourceRecordToProduct(sourceRecord.id, params.organizationId);

  if (matched.status === "MATCHED" && matched.productId) {
    await applySurvivorshipRules(matched.productId, params.organizationId, matched.id);
    return {
      productId: matched.productId,
      sourceRecordId: matched.id,
      status: matched.status,
    };
  }

  if (matched.status === "UNMATCHED" && params.createIfUnmatched) {
    const created = await resolveMatchDecision(matched.id, params.organizationId, {
      action: "create_new_product",
    });
    return {
      productId: created.productId,
      sourceRecordId: created.id,
      status: created.status,
    };
  }

  return {
    productId: matched.productId,
    sourceRecordId: matched.id,
    status: matched.status,
  };
}
