import "dotenv/config";
import { disconnectDb, prisma } from "./lib/db.js";
import { seedDemoAttributesAndFacets, seedDemoCategories, seedScrapedProducts } from "./lib/seed-catalog.js";
import { seedFleetFarmProducts } from "./seed-fleetfarm.js";

type CliOptions = {
  orgSlug: string;
  live: boolean;
  reindex: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    orgSlug: process.env.SEED_ORG_SLUG ?? "demo",
    live: argv.includes("--live"),
    reindex: !argv.includes("--no-reindex"),
  };

  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  if (orgArg) options.orgSlug = orgArg.split("=")[1] ?? options.orgSlug;

  return options;
}

async function reindexOrganization(organizationId: string): Promise<number> {
  process.env.SEARCH_SYNC = "true";

  const { startReindex } = await import("../apps/api/src/modules/search/search.service.js");
  const run = await startReindex(organizationId);

  const productIds = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: { in: ["APPROVED", "PUBLISH_READY", "PUBLISHED"] },
      sku: { startsWith: "FF-" },
    },
    select: { id: true },
  });

  console.log(`Search reindex queued (run ${run.id}) for ${productIds.length} FleetFarm demo products`);
  return productIds.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Seeding Fleet Farm demo catalog (org=${options.orgSlug}, live=${options.live})`);

  const org = await prisma.organization.upsert({
    where: { slug: options.orgSlug },
    create: { name: "Demo Retailer", slug: options.orgSlug },
    update: {},
  });

  const categoryByCode = await seedDemoCategories(prisma, org.id);
  const attrByKey = await seedDemoAttributesAndFacets(prisma, org.id, categoryByCode);

  const products = await seedFleetFarmProducts({ live: options.live });
  console.log(`Loaded ${products.length} FleetFarm-inspired products`);

  const result = await seedScrapedProducts(prisma, org.id, products, categoryByCode, attrByKey);
  console.log(`Products seeded: ${result.created} created, ${result.updated} updated (${result.total} total)`);

  if (options.reindex) {
    await reindexOrganization(org.id);
  } else {
    console.log("Skipped search reindex (--no-reindex). Call POST /api/v1/search/reindex after API start.");
  }

  console.log("Fleet Farm demo catalog seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
