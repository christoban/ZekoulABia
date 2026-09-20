/**
 * INFRASTRUCTURE LAYER — Adapter EventPublisher vers Inngest
 *
 * Implémente le port EventPublisher en délégant au client Inngest existant. Point unique où le
 * SDK Inngest est couplé à l'émission — les use cases/contrôleurs dépendront du port, jamais du
 * SDK directement (architecture hexagonale).
 */
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import { inngest } from '../inngest/client';

export class InngestEventPublisher implements EventPublisher {
  async emit(eventName: string, data: Record<string, unknown>): Promise<void> {
    try {
      await inngest.send({ name: eventName, data });
    } catch (err: any) {
      console.warn(`[InngestEventPublisher] Événement '${eventName}' non transmis (Inngest hors ligne ou clé absente):`, err?.message || err);
    }
  }
}