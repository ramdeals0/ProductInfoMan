import "dotenv/config";
import { BIGBOX_CATEGORIES } from "./bigbox/config.js";
import { disconnectDb, prisma } from "./lib/db.js";
import { seedBigBoxProducts } from "./lib/seed-bigbox-catalog.js";
import { reindexViaApi } from "./lib/reindex-via-api.js";

type CliOptions = {
  orgSlug: string;
  perCategory: number;
  reindex: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    orgSlug: process.env.SEED_ORG_SLUG ?? "demo",
    perCategory: 50,
    reindex: !argv.includes("--no-reindex"),
  };

  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  if (orgArg) options.orgSlug = orgArg.split("=")[1] ?? options.orgSlug;

  const countArg = argv.find((arg) => arg.startsWith("--per-category="));
  if (countArg) {
    const parsed = Number.parseInt(countArg.split("=")[1] ?? "", 10);
    if (!Number.isNaN(parsed) && parsed > 0) options.perCategory = parsed;
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const expectedTotal = BIGBOX_CATEGORIES.length * options.perCategory;

  console.log(
    `Seeding Big Box Store catalog: ${BIGBOX_CATEGORIES.length} categories × ${options.perCategory} = ${expectedTotal} products (org=${options.orgSlug})`,
  );

  const org = await prisma.organization.upsert({
    where: { slug: options.orgSlug },
    create: { name: "Demo Retailer", slug: options.orgSlug },
    update: {},
  });

  const result = await seedBigBoxProducts(prisma, org.id, {
    perCategory: options.perCategory,
    publish: true,
  });

  console.log(`Categories ensured: ${result.categoriesEnsured}`);
  console.log(`Products seeded: ${result.created} created, ${result.updated} updated (${result.total} total)`);

  if (options.reindex) {
    const runId = await reindexViaApi(options.orgSlug);
    console.log(`Search reindex triggered via API (run ${runId})`);
  }

  console.log("Big Box Store catalog seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
