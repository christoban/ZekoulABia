export interface RealtimeSocketPort {
  emitter(salon: string, event: string, data: unknown): void;
}
