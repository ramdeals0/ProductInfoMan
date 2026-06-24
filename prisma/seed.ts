import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    create: { name: "Demo Retailer", slug: "demo" },
    update: {},
  });

  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "admin@demo.local" } },
    create: {
      organizationId: org.id,
      email: "admin@demo.local",
      name: "Demo Admin",
      role: "ADMIN",
    },
    update: {},
  });

  const specsGroup = await prisma.attributeGroup.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Specifications" } },
    create: { organizationId: org.id, name: "Specifications", sortOrder: 1 },
    update: {},
  });

  const marketingGroup = await prisma.attributeGroup.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Marketing" } },
    create: { organizationId: org.id, name: "Marketing", sortOrder: 0 },
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
    },
    update: {},
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
    },
    update: {},
  });

  const fabricAttr = await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "fabric" } },
    create: {
      organizationId: org.id,
      attributeGroupId: specsGroup.id,
      key: "fabric",
      label: "Fabric",
      dataType: "TEXT",
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
    where: { organizationId_path: { organizationId: org.id, path: "/apparel" } },
    create: {
      organizationId: org.id,
      name: "Apparel",
      slug: "apparel",
      path: "/apparel",
      depth: 0,
    },
    update: {},
  });

  const mens = await prisma.category.upsert({
    where: { organizationId_path: { organizationId: org.id, path: "/apparel/mens" } },
    create: {
      organizationId: org.id,
      parentId: apparel.id,
      name: "Mens",
      slug: "mens",
      path: "/apparel/mens",
      depth: 1,
    },
    update: {},
  });

  const shirts = await prisma.category.upsert({
    where: { organizationId_path: { organizationId: org.id, path: "/apparel/mens/shirts" } },
    create: {
      organizationId: org.id,
      parentId: mens.id,
      name: "Shirts",
      slug: "shirts",
      path: "/apparel/mens/shirts",
      depth: 2,
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

  await prisma.facetDefinition.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "color" } },
    create: {
      organizationId: org.id,
      key: "color",
      label: "Color",
      sourceAttributeId: colorAttr.id,
      categoryId: shirts.id,
      scope: "CATEGORY",
    },
    update: {},
  });

  const colorFacet = await prisma.facetDefinition.findUniqueOrThrow({
    where: { organizationId_key: { organizationId: org.id, key: "color" } },
  });

  const existingRule = await prisma.facetRule.findFirst({
    where: { facetDefinitionId: colorFacet.id },
  });
  if (!existingRule) {
    await prisma.facetRule.create({
      data: { facetDefinitionId: colorFacet.id, ruleType: "DIRECT" },
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

  console.log("Seed complete: demo org, apparel/shirts taxonomy, SHIRT-001 + 3 variants");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
