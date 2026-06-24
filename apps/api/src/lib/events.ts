import type { DomainEvent } from "@productinfoman/contracts";
import { publishDomainEvent } from "../modules/integration/integration.publisher.js";

export async function emitEvent(event: DomainEvent): Promise<void> {
  await publishDomainEvent(event);
}
