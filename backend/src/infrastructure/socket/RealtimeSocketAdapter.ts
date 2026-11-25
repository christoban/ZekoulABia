import type { RealtimeSocketPort } from '@domain/ports/services/RealtimeSocketPort';
import { getIO } from './SocketServer';

export class RealtimeSocketAdapter implements RealtimeSocketPort {
  emitter(salon: string, event: string, data: unknown): void {
    getIO()?.to(salon).emit(event, data);
  }
}
