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

async function reindexDemoCatalog(orgSlug: string): Promise<void> {
  const apiUrl = process.env.RESEED_API_URL ?? process.env.API_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3001"}`;
  const email = process.env.ADMIN_EMAIL ?? "admin@demo.local";
  const password = process.env.ADMIN_PASSWORD ?? "Admin123!@#demo";

  const loginResponse = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, organizationSlug: orgSlug }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Login failed for reindex: ${loginResponse.status} ${await loginResponse.text()}`);
  }

  const loginPayload = (await loginResponse.json()) as { token?: string; accessToken?: string };
  const accessToken = loginPayload.accessToken ?? loginPayload.token;
  if (!accessToken) {
    throw new Error("Login response missing access token");
  }

  const reindexResponse = await fetch(`${apiUrl}/api/v1/search/reindex`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Organization-Slug": orgSlug,
    },
  });
  if (!reindexResponse.ok) {
    throw new Error(`Reindex failed: ${reindexResponse.status} ${await reindexResponse.text()}`);
  }

  const run = (await reindexResponse.json()) as { id: string };
  console.log(`Search reindex triggered via API (run ${run.id})`);
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

  console.log("==> Reindexing search via running API");
  await reindexDemoCatalog(orgSlug);

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
