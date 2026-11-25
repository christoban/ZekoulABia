import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { DisciplineCouncilController } from '@infrastructure/http/controllers/DisciplineCouncilController';

export function creerDisciplineCouncilRoutes(controller: DisciplineCouncilController): Router {
  const router = Router();
  const gestionnaires = ['ADMIN', 'STAFF'] as const;

  router.post('/convoquer', requireAuth, requireRole(...gestionnaires), controller.convoquerConseil);
  router.post('/:id/tenir', requireAuth, requireRole(...gestionnaires), controller.tenirConseil);
  router.get('/', requireAuth, requireRole(...gestionnaires), controller.list);
  router.get('/:id/pv.pdf', requireAuth, requireRole(...gestionnaires), controller.pvPdf);

  return router;
}
