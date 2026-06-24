import { hasAnyRole, ROLE_GROUPS, type RbacRoleCode } from "@productinfoman/shared/rbac";

export function canReadCatalog(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.READ);
}

export function canEditProducts(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.PRODUCT_WRITE);
}

export function canSubmitForReview(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.WORKFLOW_SUBMIT);
}

export function canApproveWorkflow(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.WORKFLOW_APPROVE);
}

export function canManageTaxonomy(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.TAXONOMY_WRITE);
}

export function canManageImports(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.IMPORT_OPS);
}

export function canManagePublishing(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.PUBLISH_OPS);
}

export function canManageEvents(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.EVENT_OPS);
}

export function canManageMdm(roles: string[]): boolean {
  return hasAnyRole(roles, ROLE_GROUPS.MDM_WRITE);
}

export function canAccessAdminRoute(pathname: string, roles: string[]): boolean {
  if (!canReadCatalog(roles)) return false;

  if (pathname.startsWith("/admin/taxonomy")) return canManageTaxonomy(roles);
  if (pathname.startsWith("/admin/imports")) return canManageImports(roles) || canReadCatalog(roles);
  if (pathname.startsWith("/admin/publishing")) return canManagePublishing(roles) || canReadCatalog(roles);
  if (pathname.startsWith("/admin/mdm")) return canManageMdm(roles) || canReadCatalog(roles);

  return true;
}

export function formatRoleLabel(code: RbacRoleCode): string {
  return code.replace(/_/g, " ");
}
