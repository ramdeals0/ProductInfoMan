import "dotenv/config";
import {
  attributeSeeds,
  DEMO_CATEGORY_SEEDS,
  facetDefinitionSeeds,
} from "../packages/config/facets.config.js";
import { disconnectDb, prisma } from "./lib/db.js";

const FLEET_FARM_ROOT_CODE = "fleetfarm-demo";
const FLEET_FARM_CHILD_CODES = DEMO_CATEGORY_SEEDS.map((category) => category.code);

const PRESERVED_ATTRIBUTE_KEYS = new Set(["brand", "color", "size", "fabric"]);
const PRESERVED_FACET_KEYS = new Set(["color", "size"]);

const FLEET_FARM_ATTRIBUTE_KEYS = attributeSeeds
  .map((seed) => seed.code)
  .filter((key) => !PRESERVED_ATTRIBUTE_KEYS.has(key));

const FLEET_FARM_FACET_KEYS = facetDefinitionSeeds
  .map((seed) => seed.code)
  .filter((key) => !PRESERVED_FACET_KEYS.has(key));

const FLEET_FARM_GROUP_CODES = ["general", "specs", "fit"] as const;

function parseOrgSlug(argv: string[]): string {
  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  return orgArg?.split("=")[1] ?? process.env.SEED_ORG_SLUG ?? "demo";
}

async function main() {
  const orgSlug = parseOrgSlug(process.argv.slice(2));
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    console.log(`Organization "${orgSlug}" not found — nothing to purge.`);
    return;
  }

  console.log(`Purging Fleet Farm demo data (org=${orgSlug})...`);

  const fleetFarmCategories = await prisma.category.findMany({
    where: {
      organizationId: org.id,
      code: { in: [FLEET_FARM_ROOT_CODE, ...FLEET_FARM_CHILD_CODES] },
    },
    select: { id: true, code: true },
  });
  const fleetFarmCategoryIds = fleetFarmCategories.map((category) => category.id);

  const fleetFarmProducts = await prisma.product.deleteMany({
    where: {
      organizationId: org.id,
      OR: [
        { sku: { startsWith: "FF-" } },
        ...(fleetFarmCategoryIds.length > 0
          ? [{ primaryCategoryId: { in: fleetFarmCategoryIds } }]
          : []),
      ],
    },
  });
  console.log(`  Deleted ${fleetFarmProducts.count} Fleet Farm products`);

  const fleetFarmSystemIds = await prisma.productSystemId.deleteMany({
    where: {
      organizationId: org.id,
      systemCode: "FLEETFARM",
    },
  });
  console.log(`  Deleted ${fleetFarmSystemIds.count} FLEETFARM system IDs`);

  const fleetFarmFacets = await prisma.facetDefinition.findMany({
    where: {
      organizationId: org.id,
      OR: [
        { key: { in: FLEET_FARM_FACET_KEYS } },
        ...(fleetFarmCategoryIds.length > 0 ? [{ categoryId: { in: fleetFarmCategoryIds } }] : []),
      ],
    },
    select: { id: true },
  });

  if (fleetFarmFacets.length > 0) {
    await prisma.facetRule.deleteMany({
      where: { facetDefinitionId: { in: fleetFarmFacets.map((facet) => facet.id) } },
    });
    await prisma.facetValue.deleteMany({
      where: { facetDefinitionId: { in: fleetFarmFacets.map((facet) => facet.id) } },
    });
    await prisma.facetDefinition.deleteMany({
      where: { id: { in: fleetFarmFacets.map((facet) => facet.id) } },
    });
  }
  console.log(`  Deleted ${fleetFarmFacets.length} Fleet Farm facet definitions`);

  const childCategories = fleetFarmCategories.filter((category) => category.code !== FLEET_FARM_ROOT_CODE);
  const rootCategory = fleetFarmCategories.find((category) => category.code === FLEET_FARM_ROOT_CODE);

  if (fleetFarmCategoryIds.length > 0) {
    await prisma.categoryAttributeBinding.deleteMany({
      where: { categoryAttributeSet: { categoryId: { in: fleetFarmCategoryIds } } },
    });
    await prisma.categoryAttributeSet.deleteMany({
      where: { categoryId: { in: fleetFarmCategoryIds } },
    });
    await prisma.categoryAttributeGroup.deleteMany({
      where: { categoryId: { in: fleetFarmCategoryIds } },
    });
  }

  for (const category of childCategories) {
    await prisma.category.delete({ where: { id: category.id } });
  }
  if (rootCategory) {
    await prisma.category.delete({ where: { id: rootCategory.id } });
  }
  console.log(`  Deleted ${fleetFarmCategories.length} Fleet Farm categories`);

  const fleetFarmAttributes = await prisma.attributeDefinition.findMany({
    where: {
      organizationId: org.id,
      key: { in: FLEET_FARM_ATTRIBUTE_KEYS },
    },
    select: { id: true },
  });

  if (fleetFarmAttributes.length > 0) {
    const attributeIds = fleetFarmAttributes.map((attribute) => attribute.id);
    await prisma.productAttributeValue.deleteMany({
      where: { attributeDefinitionId: { in: attributeIds } },
    });
    await prisma.categoryAttributeBinding.deleteMany({
      where: { attributeDefinitionId: { in: attributeIds } },
    });
    await prisma.facetRule.deleteMany({
      where: { attributeDefinitionId: { in: attributeIds } },
    });
    await prisma.attributeEnumValue.deleteMany({
      where: { attributeDefinitionId: { in: attributeIds } },
    });
    await prisma.attributeDefinition.deleteMany({
      where: { id: { in: attributeIds } },
    });
  }
  console.log(`  Deleted ${fleetFarmAttributes.length} Fleet Farm attributes`);

  const fleetFarmGroups = await prisma.attributeGroup.deleteMany({
    where: {
      organizationId: org.id,
      code: { in: [...FLEET_FARM_GROUP_CODES] },
    },
  });
  console.log(`  Deleted ${fleetFarmGroups.count} Fleet Farm attribute groups`);

  console.log("Fleet Farm purge complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
