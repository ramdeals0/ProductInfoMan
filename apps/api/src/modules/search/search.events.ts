import type { DomainEvent } from "@productinfoman/contracts";
import { eventBus } from "../../lib/events.js";
import { handleProductChange } from "./search.service.js";

type ProductEventPayload = {
  productId: string;
  status?: string;
};

function getProductId(event: DomainEvent): string | undefined {
  const payload = event.payload as ProductEventPayload;
  return payload.productId;
}

async function onProductEvent(event: DomainEvent, sourceEvent: string): Promise<void> {
  const productId = getProductId(event);
  if (!productId) return;
  await handleProductChange(event.organizationId, productId, sourceEvent);
}

export function registerSearchEventHandlers(): void {
  eventBus.on("product.created", (event: DomainEvent) => {
    void onProductEvent(event, "product.created");
  });

  eventBus.on("product.updated", (event: DomainEvent) => {
    void onProductEvent(event, "product.updated");
  });

  eventBus.on("product.deleted", (event: DomainEvent) => {
    void onProductEvent(event, "product.deleted");
  });

  eventBus.on("product.status_changed", (event: DomainEvent) => {
    void onProductEvent(event, "product.status_changed");
  });
}
