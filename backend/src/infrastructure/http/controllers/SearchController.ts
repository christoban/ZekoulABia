import type { Request, Response, NextFunction } from 'express';
import type { SearchQueryRepository } from '@domain/ports/repositories/SearchQueryRepository';

export class SearchController {
  constructor(private readonly searchRepo: SearchQueryRepository) {}

  globalSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const q = String(req.query.q || '').trim();
      const schoolId = req.user!.schoolId;

      if (!q) {
        res.json({ query: q, results: [], pagination: { total: 0, page, pages: 0, limit }, totalsByType: { users: 0, classes: 0, subjects: 0, activities: 0 } });
        return;
      }

      const [users, classes, subjects, activities] = await Promise.all([
        this.searchRepo.searchUsers(schoolId, q, 100),
        this.searchRepo.searchClasses(schoolId, q, 100),
        this.searchRepo.searchSubjects(schoolId, q, 100),
        this.searchRepo.searchActivities(schoolId, q, 100),
      ]);

      const merged = [
        ...users.map((u) => ({ id: u.id, type: 'user' as const, title: `${u.firstName} ${u.lastName}`.trim(), subtitle: `${u.email} (${u.role})`, createdAt: u.createdAt })),
        ...classes.map((c) => ({ id: c.id, type: 'class' as const, title: c.name, subtitle: 'Classe', createdAt: c.createdAt })),
        ...subjects.map((s) => ({ id: s.id, type: 'subject' as const, title: s.name, subtitle: s.code, createdAt: s.createdAt })),
        ...activities.map((a) => ({ id: a.id, type: 'activity' as const, title: a.action, subtitle: a.description || undefined, createdAt: a.createdAt })),
      ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      const total = merged.length;
      const start = (page - 1) * limit;

      res.json({
        query: q,
        results: merged.slice(start, start + limit),
        pagination: { total, page, pages: Math.ceil(total / limit), limit },
        totalsByType: { users: users.length, classes: classes.length, subjects: subjects.length, activities: activities.length },
      });
    } catch (error) {
      next(error);
    }
  };
}
