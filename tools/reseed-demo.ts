import "dotenv/config";
import { execSync } from "node:child_process";
import { disconnectDb, prisma } from "./lib/db.js";

function parseOrgSlug(argv: string[]): string {
  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  return orgArg?.split("=")[1] ?? process.env.SEED_ORG_SLUG ?? "demo";
}

async function publishDemoShirtCatalog(organizationId: string): Promise<number> {
  const result = await prisma.product.updateMany({
    where: {
      organizationId,
      sku: { startsWith: "SHIRT-" },
      deletedAt: null,
    },
    data: { status: "PUBLISHED" },
  });
  return result.count;
}

async function reindexDemoCatalog(organizationId: string): Promise<void> {
  process.env.SEARCH_SYNC = "true";
  const { startReindex } = await import("../apps/api/src/modules/search/search.service.js");
  const run = await startReindex(organizationId);
  console.log(`Search reindex queued (run ${run.id})`);
}

async function main() {
  const orgSlug = parseOrgSlug(process.argv.slice(2));
  console.log(`==> Purging Fleet Farm data (org=${orgSlug})`);
  execSync("tsx tools/purge-fleetfarm-data.ts", { stdio: "inherit" });

  console.log("==> Seeding base demo catalog (prisma/seed.ts)");
  execSync("pnpm db:seed", { stdio: "inherit" });

  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } });
  const published = await publishDemoShirtCatalog(org.id);
  console.log(`==> Published ${published} SHIRT-* products for storefront search`);

  console.log("==> Reindexing search");
  await reindexDemoCatalog(org.id);

  console.log("Demo reseed complete (Fleet Farm removed, base apparel catalog only).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
