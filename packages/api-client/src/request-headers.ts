export type OrganizationHeadersConfig = {
  organizationSlug: string;
  accessToken?: string;
  userEmail?: string;
  actorRole?: string;
};

export function buildRequestHeaders(
  config: OrganizationHeadersConfig,
  init?: RequestInit,
): HeadersInit {
  const headers: Record<string, string> = {
    "X-Organization-Slug": config.organizationSlug,
  };

  if (config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`;
  }
  if (config.userEmail) {
    headers["X-User-Email"] = config.userEmail;
  }
  if (config.actorRole) {
    headers["X-Actor-Role"] = config.actorRole;
  }

  if (typeof init?.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => {
      headers[key] = value;
    });
  }

  return headers;
}
