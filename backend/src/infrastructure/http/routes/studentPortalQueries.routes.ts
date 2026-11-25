import { Router } from 'express';
import type { StudentPortalQueriesController } from '../controllers/StudentPortalQueriesController.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerStudentPortalQueriesRoutes(controller: StudentPortalQueriesController): Router {
  const router = Router();

  router.get('/users/me', requireAuth, controller.getMe);
  router.patch('/users/me/avatar', requireAuth, controller.updateMyAvatar);
  router.get(
    '/students/me/profile-completeness',
    requireAuth,
    requireRole('STUDENT'),
    controller.getMyProfileCompleteness,
  );
  router.patch('/students/me/profile', requireAuth, requireRole('STUDENT'), controller.updateMyProfile);
  router.patch(
    '/parent/children/:id/profile',
    requireAuth,
    requireRole('PARENT'),
    controller.updateChildProfile,
  );

  return router;
}
