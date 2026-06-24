import "dotenv/config";
import { disconnectDb, prisma } from "./lib/db.js";
import { seedAttributesAndFacets } from "./lib/seed-attributes-facets.js";

function parseOrgSlug(argv: string[]): string {
  const orgArg = argv.find((arg) => arg.startsWith("--org="));
  return orgArg?.split("=")[1] ?? process.env.SEED_ORG_SLUG ?? "demo";
}

async function main() {
  const orgSlug = parseOrgSlug(process.argv.slice(2));
  console.log(`Seeding attributes and facets (org=${orgSlug})`);

  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    create: { name: "Demo Retailer", slug: orgSlug },
    update: {},
  });

  const stats = await seedAttributesAndFacets(prisma, org.id);

  console.log("Seed complete:");
  console.log(`  Categories ensured: ${stats.categoriesEnsured}`);
  console.log(`  Attributes: ${stats.attributesCreated} created, ${stats.attributesUpdated} updated`);
  console.log(
    `  Facet definitions: ${stats.facetDefinitionsCreated} created, ${stats.facetDefinitionsUpdated} updated`,
  );
  console.log(`  Facet rules: ${stats.facetRulesCreated} created, ${stats.facetRulesUpdated} updated`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
