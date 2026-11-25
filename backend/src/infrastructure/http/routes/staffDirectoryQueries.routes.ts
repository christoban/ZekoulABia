import { Router } from 'express';
import type { StaffDirectoryQueriesController } from '../controllers/StaffDirectoryQueriesController.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerStaffDirectoryQueriesRoutes(controller: StaffDirectoryQueriesController): Router {
  const router = Router();

  router.get('/users', requireAuth, controller.listUsers);
  router.get(
    '/classes/:id/students-directory',
    requireAuth,
    requireRole('ADMIN', 'STAFF', 'TEACHER'),
    controller.getClassStudentsDirectory,
  );
  router.patch(
    '/students/:id/official-photo',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.updateStudentOfficialPhoto,
  );
  router.patch('/school/profile', requireAuth, requireRole('ADMIN'), controller.updateSchoolProfile);
  router.get('/finance/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listFeePlans);
  router.get('/finance/invoices', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listInvoices);

  return router;
}
