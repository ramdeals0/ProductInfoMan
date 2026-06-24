import { siteConfig } from "./site";

function trim(url: string): string {
  return url.replace(/\/$/, "");
}

export function apiRootUrl(): string {
  return trim(siteConfig.apiBaseUrl).replace(/\/api\/v1$/, "");
}

export function adminUrl(path = ""): string {
  const base = trim(siteConfig.adminUrl);
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function storefrontUrl(path = ""): string {
  const base = trim(siteConfig.storefrontUrl);
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Replace placeholder / legacy URLs in doc examples with configured deployment URLs. */
export function resolveDocUrls(text: string): string {
  const api = trim(siteConfig.apiBaseUrl);
  const sandbox = trim(siteConfig.apiSandboxUrl);
  const admin = trim(siteConfig.adminUrl);
  const store = trim(siteConfig.storefrontUrl);
  const apiRoot = api.replace(/\/api\/v1$/, "");

  return text
    .replaceAll("https://api.yourpim.com/api/v1", api)
    .replaceAll("https://sandbox-api.yourpim.com/api/v1", sandbox)
    .replaceAll("http://localhost:3001/api/v1", api)
    .replaceAll("https://admin.yourpim.com", admin)
    .replaceAll("https://sandbox-admin.yourpim.com", admin)
    .replaceAll("http://localhost:3000", admin)
    .replaceAll("https://shop.yourpim.com", store)
    .replaceAll("https://sandbox-shop.yourpim.com", store)
    .replaceAll("http://localhost:3002", store)
    .replaceAll("https://api.yourpim.com", apiRoot)
    .replaceAll("http://localhost:3001", apiRoot);
}
