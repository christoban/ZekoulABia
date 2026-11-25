import { Router } from 'express';
import type { PushNotificationController } from '@infrastructure/http/controllers/PushNotificationController';
import { requireAuth } from '../middlewares/auth.ts';

export function creerPushNotificationRoutes(controller: PushNotificationController): Router {
  const router = Router();

  router.post('/subscribe', requireAuth, controller.subscribe);
  router.delete('/unsubscribe', requireAuth, controller.unsubscribe);
  router.get('/vapid-public-key', controller.vapidPublicKey);

  return router;
}
