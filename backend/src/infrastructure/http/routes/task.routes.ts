import { Router } from 'express';
import type { CreerTaskUseCase } from '@application/task/CreerTaskUseCase';
import type { ListerTasksUseCase } from '@application/task/ListerTasksUseCase';
import type { MettreAJourStatutTaskUseCase } from '@application/task/MettreAJourStatutTaskUseCase';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerTaskRoutes(
  creerTask: CreerTaskUseCase,
  listerTasks: ListerTasksUseCase,
  mettreAJourStatut: MettreAJourStatutTaskUseCase,
): Router {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN', 'STAFF'));

  router.post('/', async (req, res, next) => {
    try {
      const result = await creerTask.execute({
        schoolId: req.user!.schoolId,
        title: req.body.title,
        description: req.body.description,
        assignedById: req.user!.userId,
        assignedToId: req.body.assignedToId,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        attachments: req.body.attachments,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const scope = req.query.scope === 'PERSONNEL' ? 'PERSONNEL' : 'ECOLE';
      const status = req.query.status as string | undefined;
      const tasks = await listerTasks.execute({
        schoolId: req.user!.schoolId,
        scope,
        userId: req.user!.userId,
        status: status as Parameters<ListerTasksUseCase['execute']>[0]['status'],
      });
      res.json({ success: true, data: tasks.map((t) => t.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/status', async (req, res, next) => {
    try {
      await mettreAJourStatut.execute({
        taskId: req.params.id,
        schoolId: req.user!.schoolId,
        nouveauStatut: req.body.status,
        acteurId: req.user!.userId,
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}