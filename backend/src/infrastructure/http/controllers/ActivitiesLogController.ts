import type { Request, Response, NextFunction } from 'express';
import type { ActivitiesLogQueryRepository } from '@domain/ports/repositories/ActivitiesLogQueryRepository';

export class ActivitiesLogController {
  constructor(private readonly activitiesLogRepository: ActivitiesLogQueryRepository) {}

  getTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const { activities, aiActions, emails } = await this.activitiesLogRepository.findTimeline(user.schoolId, limit);
      const timeline = [
        ...activities.map(a => ({ id: a.id, type: 'ACTIVITY' as const, timestamp: a.createdAt, title: a.action, details: a.description, raw: a })),
        ...aiActions.map(a => ({ id: a.id, type: 'AI_ACTION' as const, timestamp: a.timestamp, title: a.actionName, details: a.refusalReason ?? a.outcome, raw: a })),
        ...emails.map(e => ({ id: e.id, type: 'EMAIL' as const, timestamp: e.createdAt, title: e.subject, details: `${e.to} — ${e.status}`, raw: e })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
      res.json({ timeline, total: timeline.length });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = String(req.query.search || '').trim();
      const skip = (page - 1) * limit;

      const [count, logs] = await Promise.all([
        this.activitiesLogRepository.countAll({ schoolId: user.schoolId, userId: user.role === 'TEACHER' ? user.userId : null, search }),
        this.activitiesLogRepository.findAll({ schoolId: user.schoolId, userId: user.role === 'TEACHER' ? user.userId : null, search, skip, limit }),
      ]);

      res.json({ logs, page, pages: Math.ceil(count / limit), total: count });
    } catch (error) {
      next(error);
    }
  };
}
