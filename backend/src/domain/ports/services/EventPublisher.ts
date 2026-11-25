/**
 * DOMAIN LAYER — Port Service Event Publisher
 *
 * Abstraction d'émission d'événements asynchrones (outbox événementiel). Le domaine ne connaît
 * pas le mécanisme de transport (Inngest, file de messages, etc.) — il dépend uniquement de cette
 * interface. L'adapter concret (InngestEventPublisher) vit dans infrastructure/.
 */
export interface EventPublisher {
  emit(eventName: string, data: Record<string, unknown>): Promise<void>;
}