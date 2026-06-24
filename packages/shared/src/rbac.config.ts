/**
 * Centralized RBAC capability definitions.
 * Roles map to capabilities; guards call requireCapabilities() instead of ad-hoc role lists.
 */

export const CAPABILITIES = [
  "products.read",
  "products.edit",
  "products.submit",
  "workflow.view",
  "workflow.approve",
  "workflow.reject",
  "workflow.publish",
  "taxonomy.read",
  "taxonomy.edit",
  "imports.manage",
  "publishing.manage",
  "search.manage",
  "events.manage",
  "mdm.read",
  "mdm.edit",
  "audit.read",
  "reports.read",
  "users.manage",
  "security.read",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<string, readonly Capability[] | ["*"]> = {
  admin: ["*"],
  product_editor: [
    "products.read",
    "products.edit",
    "products.submit",
    "workflow.view",
    "taxonomy.read",
    "audit.read",
    "reports.read",
  ],
  product_approver: [
    "products.read",
    "workflow.view",
    "workflow.approve",
    "workflow.reject",
    "workflow.publish",
    "taxonomy.read",
    "audit.read",
    "reports.read",
  ],
  ops: [
    "products.read",
    "workflow.view",
    "imports.manage",
    "publishing.manage",
    "search.manage",
    "events.manage",
    "mdm.read",
    "audit.read",
    "reports.read",
  ],
  readonly: [
    "products.read",
    "workflow.view",
    "taxonomy.read",
    "mdm.read",
    "audit.read",
    "reports.read",
  ],
};

/** Maps legacy ROLE_GROUPS keys to required capabilities. */
export const ROLE_GROUP_CAPABILITIES = {
  READ: ["products.read", "workflow.view", "taxonomy.read", "audit.read", "reports.read"] as const,
  PRODUCT_WRITE: ["products.edit"] as const,
  WORKFLOW_SUBMIT: ["products.submit"] as const,
  WORKFLOW_APPROVE: ["workflow.approve", "workflow.reject", "workflow.publish"] as const,
  TAXONOMY_WRITE: ["taxonomy.edit"] as const,
  IMPORT_OPS: ["imports.manage"] as const,
  PUBLISH_OPS: ["publishing.manage"] as const,
  SEARCH_OPS: ["search.manage"] as const,
  EVENT_OPS: ["events.manage"] as const,
  MDM_WRITE: ["mdm.edit"] as const,
  ADMIN_ONLY: ["users.manage"] as const,
} as const;

function expandRoleCapabilities(roles: string[]): Set<Capability> {
  const capabilities = new Set<Capability>();
  for (const role of roles) {
    const mapped = ROLE_CAPABILITIES[role];
    if (!mapped) continue;
    if (mapped[0] === "*") {
      for (const cap of CAPABILITIES) capabilities.add(cap);
      return capabilities;
    }
    for (const cap of mapped as readonly Capability[]) capabilities.add(cap);
  }
  return capabilities;
}

export function hasCapability(userRoles: string[], required: Capability | readonly Capability[]): boolean {
  if (userRoles.includes("admin")) return true;
  const needed = Array.isArray(required) ? required : [required];
  const granted = expandRoleCapabilities(userRoles);
  return needed.every((cap) => granted.has(cap));
}

/** True if the user has any capability in the group (matches legacy ROLE_GROUPS semantics). */
export function hasCapabilityGroup(
  userRoles: string[],
  group: keyof typeof ROLE_GROUP_CAPABILITIES,
): boolean {
  if (userRoles.includes("admin")) return true;
  const needed = ROLE_GROUP_CAPABILITIES[group];
  const granted = expandRoleCapabilities(userRoles);
  return needed.some((cap) => granted.has(cap));
}

export function listCapabilitiesForRoles(roles: string[]): Capability[] {
  return [...expandRoleCapabilities(roles)];
}
