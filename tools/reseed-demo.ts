import "dotenv/config";
import { execSync } from "node:child_process";
import { disconnectDb, prisma } from "./lib/db.js";
import { seedDemoProducts } from "./lib/seed-demo-products.js";
import { reindexViaApi } from "./lib/reindex-via-api.js";

const DEFAULT_DEMO_PRODUCT_COUNT = 500;

function parseOrgSlug(argv: string[]): string {
  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  return orgArg?.split("=")[1] ?? process.env.SEED_ORG_SLUG ?? "demo";
}

function parseCount(argv: string[]): number {
  const countArg = argv.find((arg) => arg.startsWith("--count="));
  if (!countArg) return DEFAULT_DEMO_PRODUCT_COUNT;
  const parsed = Number.parseInt(countArg.split("=")[1] ?? "", 10);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : DEFAULT_DEMO_PRODUCT_COUNT;
}

async function publishDemoParentCatalog(organizationId: string): Promise<number> {
  const parentSkus = ["SHIRT-001", "POLO-001", "FLANNEL-001", "DRESS-001", "BTN-001"];
  const result = await prisma.product.updateMany({
    where: {
      organizationId,
      OR: [
        { sku: { in: parentSkus } },
        { sku: { startsWith: "SHIRT-001-" } },
        { sku: { startsWith: "POLO-001-" } },
        { sku: { startsWith: "FLANNEL-001-" } },
        { sku: { startsWith: "DRESS-001-" } },
        { sku: { startsWith: "BTN-001-" } },
      ],
      deletedAt: null,
    },
    data: { status: "PUBLISHED" },
  });
  return result.count;
}

async function main() {
  const argv = process.argv.slice(2);
  const orgSlug = parseOrgSlug(argv);
  const productCount = parseCount(argv);

  console.log(`==> Purging Fleet Farm data (org=${orgSlug})`);
  execSync("tsx tools/purge-fleetfarm-data.ts", { stdio: "inherit" });

  console.log("==> Seeding base demo catalog (prisma/seed.ts)");
  execSync("pnpm db:seed", { stdio: "inherit" });

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } });
  const published = await publishDemoParentCatalog(org.id);
  console.log(`==> Published ${published} parent/variant catalog products`);

  console.log(`==> Seeding ${productCount} demo products (DEMO-*)`);
  const demoResult = await seedDemoProducts(prisma, org.id, { count: productCount, publish: true });
  console.log(
    `    ${demoResult.created} created, ${demoResult.updated} updated (${demoResult.total} SIMPLE) + ${demoResult.parentFamilies} parent families (${demoResult.variants} variants)`,
  );

  console.log("==> Reindexing search via running API");
  const runId = await reindexViaApi(orgSlug);
  console.log(`Search reindex triggered via API (run ${runId})`);

  console.log(
    `Demo reseed complete (${productCount} DEMO SIMPLE products + ${demoResult.parentFamilies} parent families / ${demoResult.variants} variants, Fleet Farm removed).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
