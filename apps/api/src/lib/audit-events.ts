import { createEvent } from "@productinfoman/contracts";
import { emitEvent } from "./events.js";

export async function emitAuditRecordEvent(params: {
  organizationId: string;
  auditLogId: string;
  entityType: string;
  entityId: string;
  action: string;
  productId?: string | null;
}): Promise<void> {
  await emitEvent(
    createEvent("audit.record.created", params.organizationId, {
      auditLogId: params.auditLogId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      productId: params.productId ?? null,
    }),
  );
}
