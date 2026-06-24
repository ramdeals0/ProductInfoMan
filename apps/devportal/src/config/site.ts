export const siteConfig = {
  name: "ProductInfoMan Developer Portal",
  description: "API documentation for the ProductInfoMan PIM platform",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://pim-api.up.railway.app/api/v1",
  apiSandboxUrl:
    process.env.NEXT_PUBLIC_API_SANDBOX_URL ?? "https://pim-api.up.railway.app/api/v1",
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://pim-admin.up.railway.app",
  storefrontUrl: process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "https://pim-store.up.railway.app",
  defaultOrgSlug: process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "demo",
};

export function apiUrl(path = ""): string {
  const base = siteConfig.apiBaseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
