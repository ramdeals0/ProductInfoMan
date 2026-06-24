/**
 * RBAC role codes and permission groups for ProductInfoMan.
 *
 * Role → action mapping (enforced in API guards + admin UI):
 * - admin: full access
 * - product_editor: create/edit products, submit workflow
 * - product_approver: approve/reject/publish workflow
 * - ops: imports, publishing, search reindex
 * - readonly: GET endpoints only
 */

export const RBAC_ROLE_CODES = [
  "admin",
  "product_editor",
  "product_approver",
  "ops",
  "readonly",
] as const;

export type RbacRoleCode = (typeof RBAC_ROLE_CODES)[number];

export const ROLE_GROUPS = {
  /** Any authenticated or storefront read user */
  READ: ["admin", "product_editor", "product_approver", "ops", "readonly"] as RbacRoleCode[],
  /** Product create/update/delete */
  PRODUCT_WRITE: ["admin", "product_editor"] as RbacRoleCode[],
  /** Workflow submit */
  WORKFLOW_SUBMIT: ["admin", "product_editor"] as RbacRoleCode[],
  /** Workflow approve/reject/publish */
  WORKFLOW_APPROVE: ["admin", "product_approver"] as RbacRoleCode[],
  /** Taxonomy configuration */
  TAXONOMY_WRITE: ["admin"] as RbacRoleCode[],
  /** Facet rule create/edit/submit */
  FACET_RULE_WRITE: ["admin", "product_editor"] as RbacRoleCode[],
  /** Facet rule approve/reject/deprecate */
  FACET_RULE_APPROVE: ["admin", "product_approver"] as RbacRoleCode[],
  /** Imports */
  IMPORT_OPS: ["admin", "ops"] as RbacRoleCode[],
  /** Publishing & channels */
  PUBLISH_OPS: ["admin", "ops"] as RbacRoleCode[],
  /** Search reindex / debug */
  SEARCH_OPS: ["admin", "ops"] as RbacRoleCode[],
  /** Events replay / retry */
  EVENT_OPS: ["admin", "ops"] as RbacRoleCode[],
  /** MDM configuration */
  MDM_WRITE: ["admin"] as RbacRoleCode[],
  /** Platform admin only */
  ADMIN_ONLY: ["admin"] as RbacRoleCode[],
} as const;

/** Maps RBAC codes to legacy workflow UserRole enum (single primary role). */
export function primaryLegacyRole(roles: string[]): string {
  if (roles.includes("admin")) return "ADMIN";
  if (roles.includes("product_approver")) return "REVIEWER";
  if (roles.includes("ops")) return "CATALOG_MANAGER";
  if (roles.includes("product_editor")) return "EDITOR";
  return "VIEWER";
}

export function hasAnyRole(userRoles: string[], required: readonly string[]): boolean {
  if (userRoles.includes("admin")) return true;
  return required.some((role) => userRoles.includes(role));
}

export const ROLE_SEEDS: Array<{ code: RbacRoleCode; name: string; description: string }> = [
  { code: "admin", name: "Administrator", description: "Full platform access" },
  { code: "product_editor", name: "Product Editor", description: "Edit products and submit for review" },
  { code: "product_approver", name: "Product Approver", description: "Approve, reject, and publish products" },
  { code: "ops", name: "Operations", description: "Imports, publishing, and search operations" },
  { code: "readonly", name: "Read Only", description: "View-only access to catalog and reports" },
];
