export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: 1;
  organizationId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  actorId?: string;
  payload: T;
}

export type ProductCreatedPayload = {
  productId: string;
  sku: string;
  productType: string;
  status: string;
};

export type ProductUpdatedPayload = {
  productId: string;
  changedFields: string[];
};

export type ProductStatusChangedPayload = {
  productId: string;
  fromStatus: string;
  toStatus: string;
  actionType: string;
};

export type ProductAttributesChangedPayload = {
  productId: string;
  attributeKeys: string[];
};

export function createEvent<T>(
  eventType: string,
  organizationId: string,
  payload: T,
  options?: { correlationId?: string; actorId?: string },
): DomainEvent<T> {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    eventVersion: 1,
    organizationId,
    occurredAt: new Date().toISOString(),
    correlationId: options?.correlationId ?? crypto.randomUUID(),
    actorId: options?.actorId,
    payload,
  };
}
