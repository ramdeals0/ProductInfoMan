import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { ROLE_SEEDS } from "../packages/shared/src/rbac.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedRoles() {
  for (const roleSeed of ROLE_SEEDS) {
    await prisma.role.upsert({
      where: { code: roleSeed.code },
      create: {
        code: roleSeed.code,
        name: roleSeed.name,
        description: roleSeed.description,
      },
      update: {
        name: roleSeed.name,
        description: roleSeed.description,
      },
    });
  }
}

async function seedRoleUser(
  organizationId: string,
  input: {
    email: string;
    name: string;
    password: string;
    legacyRole: "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER";
    roleCode: string;
  },
) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: input.email } },
    create: {
      organizationId,
      email: input.email,
      name: input.name,
      role: input.legacyRole,
      passwordHash,
      isActive: true,
    },
    update: {
      name: input.name,
      passwordHash,
      isActive: true,
      role: input.legacyRole,
    },
  });

  const role = await prisma.role.findUniqueOrThrow({ where: { code: input.roleCode } });
  await prisma.userRoleMembership.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
}

async function seedAdminUser(organizationId: string) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@demo.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!@#demo";
  await seedRoleUser(organizationId, {
    email: adminEmail,
    name: "Demo Admin",
    password: adminPassword,
    legacyRole: "ADMIN",
    roleCode: "admin",
  });
}

async function seedDemoUsers(organizationId: string) {
  await seedAdminUser(organizationId);

  const demoPassword =
    process.env.DEMO_USER_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "Admin123!@#demo";
  await seedRoleUser(organizationId, {
    email: "editor@demo.local",
    name: "Demo Editor",
    password: demoPassword,
    legacyRole: "EDITOR",
    roleCode: "product_editor",
  });
  await seedRoleUser(organizationId, {
    email: "approver@demo.local",
    name: "Demo Approver",
    password: demoPassword,
    legacyRole: "REVIEWER",
    roleCode: "product_approver",
  });
  await seedRoleUser(organizationId, {
    email: "ops@demo.local",
    name: "Demo Ops",
    password: demoPassword,
    legacyRole: "VIEWER",
    roleCode: "ops",
  });
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    create: { name: "Demo Retailer", slug: "demo" },
    update: {},
  });

  await seedRoles();
  await seedDemoUsers(org.id);

  const specsGroup = await prisma.attributeGroup.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "specifications" } },
    create: {
      organizationId: org.id,
      code: "specifications",
      name: "Specifications",
      description: "Core product specifications",
      sortOrder: 1,
    },
    update: {},
  });

  const marketingGroup = await prisma.attributeGroup.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "marketing" } },
    create: {
      organizationId: org.id,
      code: "marketing",
      name: "Marketing",
      description: "Marketing and merchandising attributes",
      sortOrder: 0,
    },
    update: {},
  });

  const brandAttr = await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "brand" } },
    create: {
      organizationId: org.id,
      attributeGroupId: marketingGroup.id,
      key: "brand",
      label: "Brand",
      dataType: "TEXT",
      isGlobal: true,
      isRequired: true,
      isSearchable: true,
    },
    update: {},
  });

  const colorAttr = await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "color" } },
    create: {
      organizationId: org.id,
      attributeGroupId: specsGroup.id,
      key: "color",
      label: "Color",
      dataType: "ENUM",
      isVariantAxis: true,
      isFilterable: true,
      isSearchable: true,
      allowedValuesType: "CONTROLLED_LIST",
    },
    update: {
      isFilterable: true,
      isSearchable: true,
      allowedValuesType: "CONTROLLED_LIST",
    },
  });

  const sizeAttr = await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "size" } },
    create: {
      organizationId: org.id,
      attributeGroupId: specsGroup.id,
      key: "size",
      label: "Size",
      dataType: "ENUM",
      isVariantAxis: true,
      isFilterable: true,
      allowedValuesType: "CONTROLLED_LIST",
    },
    update: {
      isFilterable: true,
      allowedValuesType: "CONTROLLED_LIST",
    },
  });

  const fabricAttr = await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "fabric" } },
    create: {
      organizationId: org.id,
      attributeGroupId: specsGroup.id,
      key: "fabric",
      label: "Fabric",
      dataType: "TEXT",
      isSearchable: true,
    },
    update: {},
  });

  for (const [attr, values] of [
    [colorAttr, ["Blue", "White", "Navy"]],
    [sizeAttr, ["S", "M", "L"]],
  ] as const) {
    for (let i = 0; i < values.length; i++) {
      await prisma.attributeEnumValue.upsert({
        where: {
          attributeDefinitionId_value: {
            attributeDefinitionId: attr.id,
            value: values[i],
          },
        },
        create: {
          attributeDefinitionId: attr.id,
          value: values[i],
          label: values[i],
          sortOrder: i,
        },
        update: {},
      });
    }
  }

  const apparel = await prisma.category.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "apparel" } },
    create: {
      organizationId: org.id,
      code: "apparel",
      name: "Apparel",
      slug: "apparel",
      path: "/apparel",
      depth: 0,
    },
    update: {},
  });

  const mens = await prisma.category.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "mens" } },
    create: {
      organizationId: org.id,
      parentId: apparel.id,
      code: "mens",
      name: "Mens",
      slug: "mens",
      path: "/apparel/mens",
      depth: 1,
    },
    update: {},
  });

  const shirts = await prisma.category.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "shirts" } },
    create: {
      organizationId: org.id,
      parentId: mens.id,
      code: "shirts",
      name: "Shirts",
      slug: "shirts",
      path: "/apparel/mens/shirts",
      depth: 2,
    },
    update: {},
  });

  await prisma.categoryAttributeGroup.upsert({
    where: {
      categoryId_attributeGroupId: {
        categoryId: shirts.id,
        attributeGroupId: specsGroup.id,
      },
    },
    create: {
      categoryId: shirts.id,
      attributeGroupId: specsGroup.id,
      sortOrder: 0,
    },
    update: {},
  });

  await prisma.categoryAttributeGroup.upsert({
    where: {
      categoryId_attributeGroupId: {
        categoryId: shirts.id,
        attributeGroupId: marketingGroup.id,
      },
    },
    create: {
      categoryId: shirts.id,
      attributeGroupId: marketingGroup.id,
      sortOrder: 1,
    },
    update: {},
  });

  const attrSet = await prisma.categoryAttributeSet.upsert({
    where: { categoryId: shirts.id },
    create: { categoryId: shirts.id },
    update: {},
  });

  for (const [attr, req, inherit] of [
    [colorAttr, "REQUIRED", false],
    [sizeAttr, "REQUIRED", false],
    [fabricAttr, "OPTIONAL", true],
    [brandAttr, "REQUIRED", true],
  ] as const) {
    await prisma.categoryAttributeBinding.upsert({
      where: {
        categoryAttributeSetId_attributeDefinitionId: {
          categoryAttributeSetId: attrSet.id,
          attributeDefinitionId: attr.id,
        },
      },
      create: {
        categoryAttributeSetId: attrSet.id,
        attributeDefinitionId: attr.id,
        requirement: req,
        inheritFromParent: inherit,
      },
      update: { requirement: req, inheritFromParent: inherit },
    });
  }

  const colorFacet = await prisma.facetDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "color" } },
    create: {
      organizationId: org.id,
      key: "color",
      label: "Color",
      sourceAttributeId: colorAttr.id,
      categoryId: shirts.id,
      scope: "CATEGORY",
      sortOrder: 1,
    },
    update: {},
  });

  const sizeFacet = await prisma.facetDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "size" } },
    create: {
      organizationId: org.id,
      key: "size",
      label: "Size",
      sourceAttributeId: sizeAttr.id,
      categoryId: shirts.id,
      scope: "CATEGORY",
      sortOrder: 2,
    },
    update: {},
  });

  for (const [facet, enumValues] of [
    [colorFacet, ["Blue", "White", "Navy"]],
    [sizeFacet, ["S", "M", "L"]],
  ] as const) {
    const sourceAttr = facet.key === "color" ? colorAttr : sizeAttr;
    const values = await prisma.attributeEnumValue.findMany({
      where: { attributeDefinitionId: sourceAttr.id },
    });

    for (const enumValue of values) {
      await prisma.facetValue.upsert({
        where: {
          facetDefinitionId_value: {
            facetDefinitionId: facet.id,
            value: enumValue.value,
          },
        },
        create: {
          facetDefinitionId: facet.id,
          value: enumValue.value,
          label: enumValue.label,
          sortOrder: enumValue.sortOrder,
          sourceEnumValueId: enumValue.id,
        },
        update: {
          label: enumValue.label,
          sortOrder: enumValue.sortOrder,
          sourceEnumValueId: enumValue.id,
        },
      });
    }
  }

  const existingColorRule = await prisma.facetRule.findFirst({
    where: { facetDefinitionId: colorFacet.id, categoryId: shirts.id },
  });
  if (!existingColorRule) {
    await prisma.facetRule.create({
      data: {
        organizationId: org.id,
        categoryId: shirts.id,
        attributeDefinitionId: colorAttr.id,
        facetDefinitionId: colorFacet.id,
        ruleType: "DIRECT",
      },
    });
  }

  const existingSizeRule = await prisma.facetRule.findFirst({
    where: { facetDefinitionId: sizeFacet.id, categoryId: shirts.id },
  });
  if (!existingSizeRule) {
    await prisma.facetRule.create({
      data: {
        organizationId: org.id,
        categoryId: shirts.id,
        attributeDefinitionId: sizeAttr.id,
        facetDefinitionId: sizeFacet.id,
        ruleType: "DIRECT",
      },
    });
  }

  const parent = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: org.id, sku: "SHIRT-001" } },
    create: {
      organizationId: org.id,
      productType: "PARENT",
      sku: "SHIRT-001",
      title: "Classic Oxford Shirt",
      description: "Long sleeve oxford shirt",
      brand: "Acme",
      primaryCategoryId: shirts.id,
    },
    update: {},
  });

  await prisma.productAttributeValue.upsert({
    where: {
      productId_attributeDefinitionId: {
        productId: parent.id,
        attributeDefinitionId: brandAttr.id,
      },
    },
    create: {
      productId: parent.id,
      attributeDefinitionId: brandAttr.id,
      value: "Acme",
      source: "LOCAL",
    },
    update: { value: "Acme" },
  });

  await prisma.productAttributeValue.upsert({
    where: {
      productId_attributeDefinitionId: {
        productId: parent.id,
        attributeDefinitionId: fabricAttr.id,
      },
    },
    create: {
      productId: parent.id,
      attributeDefinitionId: fabricAttr.id,
      value: "Cotton",
      source: "LOCAL",
    },
    update: { value: "Cotton" },
  });

  const variants = [
    { sku: "SHIRT-001-BL-M", color: "Blue", size: "M" },
    { sku: "SHIRT-001-BL-L", color: "Blue", size: "L" },
    { sku: "SHIRT-001-WH-M", color: "White", size: "M" },
  ];

  for (const v of variants) {
    const variant = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: org.id, sku: v.sku } },
      create: {
        organizationId: org.id,
        productType: "VARIANT",
        sku: v.sku,
        parentId: parent.id,
        title: parent.title,
        description: parent.description,
        brand: parent.brand,
        primaryCategoryId: shirts.id,
      },
      update: {},
    });

    await prisma.productAttributeValue.upsert({
      where: {
        productId_attributeDefinitionId: {
          productId: variant.id,
          attributeDefinitionId: colorAttr.id,
        },
      },
      create: {
        productId: variant.id,
        attributeDefinitionId: colorAttr.id,
        value: v.color,
        source: "LOCAL",
      },
      update: { value: v.color },
    });

    await prisma.productAttributeValue.upsert({
      where: {
        productId_attributeDefinitionId: {
          productId: variant.id,
          attributeDefinitionId: sizeAttr.id,
        },
      },
      create: {
        productId: variant.id,
        attributeDefinitionId: sizeAttr.id,
        value: v.size,
        source: "LOCAL",
      },
      update: { value: v.size },
    });
  }

  const importTemplate = await prisma.importTemplate.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "mvp-product-csv" } },
    create: {
      organizationId: org.id,
      code: "mvp-product-csv",
      name: "MVP Product CSV",
      entityType: "PRODUCT",
      sourceFormat: "CSV",
      isDefault: true,
      configJson: {
        blankCellPolicy: "IGNORE",
        duplicatePolicy: "REJECT",
      },
    },
    update: { isDefault: true },
  });

  const templateMappings = [
    ["sku", "sku", true],
    ["product_type", "product_type", true],
    ["title", "title", true],
    ["description", "description", false],
    ["brand", "brand", false],
    ["parent_sku", "parent_sku", false],
    ["category_code", "category_code", false],
    ["color", "color", false],
    ["size", "size", false],
  ] as const;

  for (const [index, [sourceColumn, targetField, isRequired]] of templateMappings.entries()) {
    await prisma.importTemplateMapping.upsert({
      where: {
        importTemplateId_sourceColumn: {
          importTemplateId: importTemplate.id,
          sourceColumn,
        },
      },
      create: {
        importTemplateId: importTemplate.id,
        sourceColumn,
        targetField,
        isRequired,
        sortOrder: index,
      },
      update: { targetField, isRequired, sortOrder: index },
    });
  }

  const validationRuleDefs = [
    {
      code: "product-title-required",
      name: "Product title required",
      ruleType: "REQUIRED_FIELD" as const,
      ruleConfig: { productType: "SIMPLE", fields: ["sku", "product_type", "title"] },
    },
    {
      code: "parent-title-required",
      name: "Parent title required",
      ruleType: "REQUIRED_FIELD" as const,
      ruleConfig: { productType: "PARENT", fields: ["sku", "product_type", "title"] },
    },
    {
      code: "variant-parent-required",
      name: "Variant parent required",
      ruleType: "REQUIRED_FIELD" as const,
      ruleConfig: { productType: "VARIANT", fields: ["sku", "product_type", "parent_sku"] },
    },
    {
      code: "product-sku-unique",
      name: "Reject duplicate SKUs",
      ruleType: "DUPLICATE_KEY" as const,
      ruleConfig: { field: "sku", policy: "REJECT" },
    },
  ];

  for (const rule of validationRuleDefs) {
    await prisma.validationRule.upsert({
      where: { organizationId_code: { organizationId: org.id, code: rule.code } },
      create: {
        organizationId: org.id,
        code: rule.code,
        name: rule.name,
        entityType: "PRODUCT",
        ruleType: rule.ruleType,
        ruleConfig: rule.ruleConfig,
      },
      update: {
        name: rule.name,
        ruleType: rule.ruleType,
        ruleConfig: rule.ruleConfig,
        isActive: true,
      },
    });
  }

  const workflow = await prisma.workflowDefinition.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "mvp-product-lifecycle" } },
    create: {
      organizationId: org.id,
      code: "mvp-product-lifecycle",
      name: "MVP Product Lifecycle",
      entityType: "PRODUCT",
      isActive: true,
    },
    update: { isActive: true },
  });

  const workflowStates = [
    { code: "DRAFT", name: "Draft", productStatus: "DRAFT" as const, isInitial: true, isTerminal: false, sortOrder: 0 },
    { code: "IN_REVIEW", name: "In Review", productStatus: "IN_REVIEW" as const, isInitial: false, isTerminal: false, sortOrder: 1 },
    { code: "APPROVED", name: "Approved", productStatus: "APPROVED" as const, isInitial: false, isTerminal: false, sortOrder: 2 },
    { code: "PUBLISHED", name: "Published", productStatus: "PUBLISHED" as const, isInitial: false, isTerminal: true, sortOrder: 3 },
    { code: "REJECTED", name: "Rejected", productStatus: "REJECTED" as const, isInitial: false, isTerminal: false, sortOrder: 4 },
  ];

  const stateIds = new Map<string, string>();
  for (const state of workflowStates) {
    const record = await prisma.workflowState.upsert({
      where: {
        workflowDefinitionId_code: {
          workflowDefinitionId: workflow.id,
          code: state.code,
        },
      },
      create: {
        workflowDefinitionId: workflow.id,
        ...state,
      },
      update: state,
    });
    stateIds.set(state.code, record.id);
  }

  const transitionDefs = [
    {
      from: "DRAFT",
      to: "IN_REVIEW",
      actionType: "SUBMIT",
      allowedRoles: ["EDITOR", "CATALOG_MANAGER", "ADMIN"],
      requiresApproval: false,
      requiresJustification: false,
    },
    {
      from: "REJECTED",
      to: "IN_REVIEW",
      actionType: "SUBMIT",
      allowedRoles: ["EDITOR", "CATALOG_MANAGER", "ADMIN"],
      requiresApproval: false,
      requiresJustification: false,
    },
    {
      from: "IN_REVIEW",
      to: "APPROVED",
      actionType: "APPROVE",
      allowedRoles: ["REVIEWER", "ADMIN"],
      requiresApproval: true,
      requiresJustification: false,
    },
    {
      from: "IN_REVIEW",
      to: "REJECTED",
      actionType: "REJECT",
      allowedRoles: ["REVIEWER", "ADMIN"],
      requiresApproval: true,
      requiresJustification: true,
    },
    {
      from: "APPROVED",
      to: "PUBLISHED",
      actionType: "PUBLISH",
      allowedRoles: ["CATALOG_MANAGER", "ADMIN"],
      requiresApproval: false,
      requiresJustification: false,
    },
  ] as const;

  for (const transition of transitionDefs) {
    const fromStateId = stateIds.get(transition.from)!;
    const toStateId = stateIds.get(transition.to)!;
    const existing = await prisma.workflowTransition.findFirst({
      where: {
        workflowDefinitionId: workflow.id,
        fromStateId,
        actionType: transition.actionType,
      },
    });
    if (!existing) {
      await prisma.workflowTransition.create({
        data: {
          workflowDefinitionId: workflow.id,
          fromStateId,
          toStateId,
          actionType: transition.actionType,
          allowedRoles: transition.allowedRoles,
          requiresApproval: transition.requiresApproval,
          requiresJustification: transition.requiresJustification,
        },
      });
    } else {
      await prisma.workflowTransition.update({
        where: { id: existing.id },
        data: {
          toStateId,
          allowedRoles: transition.allowedRoles,
          requiresApproval: transition.requiresApproval,
          requiresJustification: transition.requiresJustification,
          isActive: true,
        },
      });
    }
  }

  const assignmentRules = [
    {
      name: "Review all parent products",
      assignToRole: "REVIEWER" as const,
      productTypes: ["PARENT", "SIMPLE"],
      categoryCodes: null,
      priority: 0,
    },
    {
      name: "Review shirts category",
      assignToRole: "REVIEWER" as const,
      productTypes: null,
      categoryCodes: ["shirts"],
      priority: 10,
    },
  ];

  for (const rule of assignmentRules) {
    const existing = await prisma.workflowAssignmentRule.findFirst({
      where: { workflowDefinitionId: workflow.id, name: rule.name },
    });
    if (!existing) {
      await prisma.workflowAssignmentRule.create({
        data: {
          workflowDefinitionId: workflow.id,
          name: rule.name,
          assignToRole: rule.assignToRole,
          productTypes: rule.productTypes,
          categoryCodes: rule.categoryCodes,
          priority: rule.priority,
        },
      });
    }
  }

  const { PRODUCT_SEARCH_INDEX_MAPPING, defaultIndexName } = await import(
    "../packages/search-projection/src/index.js"
  );

  await prisma.searchIndexVersion.upsert({
    where: {
      organizationId_indexName_version: {
        organizationId: org.id,
        indexName: defaultIndexName(org.id),
        version: 1,
      },
    },
    create: {
      organizationId: org.id,
      indexName: defaultIndexName(org.id),
      version: 1,
      mappingJson: PRODUCT_SEARCH_INDEX_MAPPING,
      isActive: true,
    },
    update: {
      mappingJson: PRODUCT_SEARCH_INDEX_MAPPING,
      isActive: true,
    },
  });

  const demoStore = await prisma.channel.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "demo-store" } },
    create: {
      organizationId: org.id,
      code: "demo-store",
      name: "Demo Ecommerce Store",
      type: "ECOMMERCE",
      destinationType: "CSV",
      configJson: { format: "shopify-product-csv", delimiter: "," },
      isActive: true,
    },
    update: { isActive: true },
  });

  const mappingVersion = await prisma.channelMappingVersion.upsert({
    where: { channelId_version: { channelId: demoStore.id, version: 1 } },
    create: { channelId: demoStore.id, version: 1, isActive: true },
    update: { isActive: true },
  });

  const exportMappings = [
    ["sku", "Variant SKU", true, 0],
    ["title", "Title", true, 1],
    ["description", "Body (HTML)", false, 2],
    ["brand", "Vendor", false, 3],
    ["attributes.color", "Color", false, 4],
    ["attributes.size", "Size", false, 5],
    ["parent_sku", "Handle", false, 6],
    ["category_code", "Product Type", false, 7],
  ] as const;

  for (const [sourceField, targetField, isRequired, sortOrder] of exportMappings) {
    await prisma.channelFieldMapping.upsert({
      where: {
        mappingVersionId_targetField: {
          mappingVersionId: mappingVersion.id,
          targetField,
        },
      },
      create: {
        channelId: demoStore.id,
        mappingVersionId: mappingVersion.id,
        sourceField,
        targetField,
        transformType: "DIRECT",
        isRequired,
        sortOrder,
      },
      update: { sourceField, isRequired, sortOrder },
    });
  }

  await prisma.channelValidationRule.upsert({
    where: { channelId_code: { channelId: demoStore.id, code: "allowed-status" } },
    create: {
      organizationId: org.id,
      channelId: demoStore.id,
      code: "allowed-status",
      name: "Allowed publish statuses",
      ruleType: "ALLOWED_STATUS",
      ruleConfig: { statuses: ["APPROVED", "PUBLISH_READY", "PUBLISHED"] },
    },
    update: { isActive: true },
  });

  await prisma.channelValidationRule.upsert({
    where: { channelId_code: { channelId: demoStore.id, code: "required-core-fields" } },
    create: {
      organizationId: org.id,
      channelId: demoStore.id,
      code: "required-core-fields",
      name: "Required core export fields",
      ruleType: "REQUIRED_FIELD",
      ruleConfig: { fields: ["sku", "title"] },
    },
    update: { isActive: true },
  });

  console.log(
    "Seed complete: demo org, taxonomy, facets, import template, workflow, search index mapping, demo-store channel, SHIRT-001 + 3 variants",
  );

  await prisma.integrationEndpoint.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "internal-reporting" } },
    create: {
      organizationId: org.id,
      code: "internal-reporting",
      name: "Internal Reporting Hook",
      endpointType: "INTERNAL",
      configJson: { consumer: "reporting-sync" },
      isActive: true,
    },
    update: { isActive: true },
  });

  const parentProduct = await prisma.product.findFirst({
    where: { organizationId: org.id, sku: "SHIRT-001" },
  });

  if (parentProduct) {
    const sampleEvents = [
      {
        eventType: "product.created",
        aggregateType: "Product",
        aggregateId: parentProduct.id,
        payloadJson: {
          productId: parentProduct.id,
          sku: parentProduct.sku,
          productType: parentProduct.productType,
          status: parentProduct.status,
        },
      },
      {
        eventType: "workflow.state.changed",
        aggregateType: "Product",
        aggregateId: parentProduct.id,
        payloadJson: {
          productId: parentProduct.id,
          fromState: "DRAFT",
          toState: "APPROVED",
          fromStatus: "DRAFT",
          toStatus: "APPROVED",
          actionType: "APPROVE",
        },
      },
      {
        eventType: "search.index.requested",
        aggregateType: "Product",
        aggregateId: parentProduct.id,
        payloadJson: {
          productId: parentProduct.id,
          sourceEvent: "seed.search.index.requested",
        },
      },
    ] as const;

    for (const sample of sampleEvents) {
      const existing = await prisma.outboxEvent.findFirst({
        where: {
          organizationId: org.id,
          eventType: sample.eventType,
          aggregateId: sample.aggregateId,
        },
      });
      if (!existing) {
        await prisma.outboxEvent.create({
          data: {
            organizationId: org.id,
            eventType: sample.eventType,
            eventVersion: 1,
            aggregateType: sample.aggregateType,
            aggregateId: sample.aggregateId,
            payloadJson: sample.payloadJson,
            metadataJson: { source: "seed" },
            status: "PUBLISHED",
            occurredAt: new Date(),
            publishedAt: new Date(),
          },
        });
      }
    }
  }

  const survivorshipRules = [
    {
      code: "title",
      name: "Product title",
      attributeCode: "title",
      ruleType: "SOURCE_PRIORITY" as const,
      ruleConfigJson: { source_priority: ["PLM", "ERP", "SUPPLIER_FEED"] },
    },
    {
      code: "brand",
      name: "Brand",
      attributeCode: "brand",
      ruleType: "SOURCE_PRIORITY" as const,
      ruleConfigJson: { source_priority: ["PLM", "ERP", "SUPPLIER_FEED"] },
    },
    {
      code: "description",
      name: "Description",
      attributeCode: "description",
      ruleType: "MOST_RECENT" as const,
      ruleConfigJson: {},
    },
    {
      code: "gtin",
      name: "GTIN",
      attributeCode: "gtin",
      ruleType: "SOURCE_PRIORITY" as const,
      ruleConfigJson: { source_priority: ["PLM", "ERP", "SUPPLIER_FEED"] },
    },
  ];

  for (const rule of survivorshipRules) {
    await prisma.survivorshipRule.upsert({
      where: { organizationId_code: { organizationId: org.id, code: rule.code } },
      create: {
        organizationId: org.id,
        ...rule,
      },
      update: {
        name: rule.name,
        attributeCode: rule.attributeCode,
        ruleType: rule.ruleType,
        ruleConfigJson: rule.ruleConfigJson,
        isActive: true,
      },
    });
  }

  if (parentProduct) {
    await prisma.productSystemId.upsert({
      where: {
        organizationId_systemCode_externalKey: {
          organizationId: org.id,
          systemCode: "ERP",
          externalKey: "ERP-SHIRT-001",
        },
      },
      create: {
        organizationId: org.id,
        productId: parentProduct.id,
        systemCode: "ERP",
        externalKey: "ERP-SHIRT-001",
        isPrimary: true,
      },
      update: { productId: parentProduct.id, isPrimary: true },
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
