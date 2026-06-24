export async function reindexViaApi(orgSlug: string): Promise<string> {
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
  return run.id;
}
