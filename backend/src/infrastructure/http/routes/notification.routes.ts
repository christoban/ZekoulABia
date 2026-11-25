import { Router } from 'express';
import type { NotificationController } from '@infrastructure/http/controllers/NotificationController';
import { requireAuth } from '../middlewares/auth.ts';

export function creerNotificationRoutes(controller: NotificationController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.list);
  router.post('/:id/read', requireAuth, controller.markAsRead);
  router.post('/:id/delivered', requireAuth, controller.markAsDelivered);
  router.post('/:id/confirm', requireAuth, controller.markAsConfirmed);
  router.post('/read-all', requireAuth, controller.markAllAsRead);

  return router;
}
