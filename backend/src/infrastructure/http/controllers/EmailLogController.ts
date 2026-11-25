import type { Request, Response, NextFunction } from 'express';
import type { EmailLogQueryRepository } from '@domain/ports/repositories/EmailLogQueryRepository';

export class EmailLogController {
  constructor(private readonly emailLogRepository: EmailLogQueryRepository) {}

  getLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 15;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const schoolId = req.user!.schoolId;

      const { logs, total } = await this.emailLogRepository.listBySchool({ schoolId, status, search, skip: (page - 1) * limit, limit });

      res.json({ logs, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
    } catch (error) {
      next(error);
    }
  };
}
