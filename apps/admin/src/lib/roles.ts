export type ActorRole =
  | "ADMIN"
  | "CATALOG_MANAGER"
  | "EDITOR"
  | "REVIEWER"
  | "OPERATIONS"
  | string;

export function canEditProducts(role: ActorRole): boolean {
  return ["ADMIN", "CATALOG_MANAGER", "EDITOR"].includes(role);
}

export function canSubmitForReview(role: ActorRole): boolean {
  return ["ADMIN", "CATALOG_MANAGER", "EDITOR"].includes(role);
}

export function canApproveWorkflow(role: ActorRole): boolean {
  return ["ADMIN", "CATALOG_MANAGER", "REVIEWER"].includes(role);
}

export function canPublishProducts(role: ActorRole): boolean {
  return ["ADMIN", "CATALOG_MANAGER"].includes(role);
}

export function canManageImports(role: ActorRole): boolean {
  return ["ADMIN", "CATALOG_MANAGER", "OPERATIONS", "EDITOR"].includes(role);
}

export function canManagePublishing(role: ActorRole): boolean {
  return ["ADMIN", "CATALOG_MANAGER", "OPERATIONS"].includes(role);
}
