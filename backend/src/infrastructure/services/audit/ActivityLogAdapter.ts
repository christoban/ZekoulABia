import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { logActivity } from './ActivityLogService';

export class ActivityLogAdapter implements ActivityLogPort {
  async log(params: { userId: string; schoolId: string; action: string; details?: string }): Promise<void> {
    logActivity(params).catch(() => {});
  }
}
