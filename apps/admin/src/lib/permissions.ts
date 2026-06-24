import { hasCapabilityGroup } from "@productinfoman/shared/rbac.config";
import type { RbacRoleCode } from "@productinfoman/shared/rbac";

export function canReadCatalog(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "READ");
}

export function canEditProducts(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "PRODUCT_WRITE");
}

export function canSubmitForReview(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "WORKFLOW_SUBMIT");
}

export function canApproveWorkflow(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "WORKFLOW_APPROVE");
}

export function canManageTaxonomy(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "TAXONOMY_WRITE");
}

export function canManageImports(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "IMPORT_OPS");
}

export function canManagePublishing(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "PUBLISH_OPS");
}

export function canManageEvents(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "EVENT_OPS");
}

export function canManageMdm(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "MDM_WRITE");
}

export function canManageUsers(roles: string[]): boolean {
  return hasCapabilityGroup(roles, "ADMIN_ONLY");
}

export function canViewSecuritySettings(roles: string[]): boolean {
  return roles.includes("admin");
}

export function canAccessAdminRoute(pathname: string, roles: string[]): boolean {
  if (!canReadCatalog(roles)) return false;
  if (pathname.startsWith("/admin/users")) return canManageUsers(roles);
  if (pathname.startsWith("/admin/security")) return canViewSecuritySettings(roles);
  if (pathname.startsWith("/admin/taxonomy")) return canManageTaxonomy(roles);
  if (pathname.startsWith("/admin/imports")) return canManageImports(roles) || canReadCatalog(roles);
  if (pathname.startsWith("/admin/publishing")) return canManagePublishing(roles) || canReadCatalog(roles);
  if (pathname.startsWith("/admin/mdm")) return canManageMdm(roles) || canReadCatalog(roles);
  return true;
}

export function formatRoleLabel(code: RbacRoleCode): string {
  return code.replace(/_/g, " ");
}
