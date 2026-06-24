export const siteConfig = {
  name: "ProductInfoMan Developer Portal",
  description: "API documentation for the ProductInfoMan PIM platform",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.yourpim.com/api/v1",
  apiSandboxUrl: process.env.NEXT_PUBLIC_API_SANDBOX_URL ?? "https://sandbox-api.yourpim.com/api/v1",
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000",
  storefrontUrl: process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3002",
  defaultOrgSlug: process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "demo",
};

export function apiUrl(path = ""): string {
  const base = siteConfig.apiBaseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
