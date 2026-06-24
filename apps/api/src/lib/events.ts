import { EventEmitter } from "node:events";
import type { DomainEvent } from "@productinfoman/contracts";

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export function emitEvent(event: DomainEvent): void {
  eventBus.emit(event.eventType, event);
  eventBus.emit("*", event);
}
