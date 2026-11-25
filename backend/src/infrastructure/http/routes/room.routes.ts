import { Router } from 'express';
import type { RoomController } from '@infrastructure/http/controllers/RoomController';
import { requireAuth, requirePermission } from '../middlewares/auth.ts';

export function creerRoomRoutes(controller: RoomController): Router {
  const router = Router();

  router.post('/', requireAuth, requirePermission('MANAGE_CLASSES'), controller.creerSalle);
  router.put('/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.modifierSalle);
  router.delete('/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.supprimerSalle);

  return router;
}
