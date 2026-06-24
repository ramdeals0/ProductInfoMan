import "dotenv/config";
import { disconnectDb, prisma } from "./lib/db.js";
import { seedDemoProducts } from "./lib/seed-demo-products.js";
import { reindexViaApi } from "./lib/reindex-via-api.js";

type CliOptions = {
  orgSlug: string;
  count: number;
  reindex: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    orgSlug: process.env.SEED_ORG_SLUG ?? "demo",
    count: 500,
    reindex: !argv.includes("--no-reindex"),
  };

  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  if (orgArg) options.orgSlug = orgArg.split("=")[1] ?? options.orgSlug;

  const countArg = argv.find((arg) => arg.startsWith("--count="));
  if (countArg) {
    const parsed = Number.parseInt(countArg.split("=")[1] ?? "", 10);
    if (!Number.isNaN(parsed) && parsed > 0) options.count = parsed;
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Seeding ${options.count} demo products (org=${options.orgSlug})`);

  const org = await prisma.organization.upsert({
    where: { slug: options.orgSlug },
    create: { name: "Demo Retailer", slug: options.orgSlug },
    update: {},
  });

  const result = await seedDemoProducts(prisma, org.id, {
    count: options.count,
    publish: true,
  });

  console.log(`Products seeded: ${result.created} created, ${result.updated} updated (${result.total} total)`);

  if (options.reindex) {
    const runId = await reindexViaApi(options.orgSlug);
    console.log(`Search reindex triggered via API (run ${runId})`);
  }

  console.log("Demo products seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
