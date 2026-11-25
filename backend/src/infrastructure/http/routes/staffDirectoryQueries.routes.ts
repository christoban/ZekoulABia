import { Router } from 'express';
import multer from 'multer';
import type { StaffDirectoryQueriesController } from '../controllers/StaffDirectoryQueriesController.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

export function creerStaffDirectoryQueriesRoutes(controller: StaffDirectoryQueriesController): Router {
  const router = Router();

  router.get('/users', requireAuth, controller.listUsers);
  router.get(
    '/classes/:id/students-directory',
    requireAuth,
    requireRole('ADMIN', 'STAFF', 'TEACHER'),
    controller.getClassStudentsDirectory,
  );
  router.get(
    '/students/:id/photo',
    requireAuth,
    requireRole('ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'),
    controller.getStudentPhoto,
  );
  router.patch(
    '/students/:id/official-photo',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    photoUpload.single('file'),
    controller.updateStudentOfficialPhoto,
  );
  router.patch('/school/profile', requireAuth, requireRole('ADMIN'), controller.updateSchoolProfile);
  router.get('/finance/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listFeePlans);
  router.get('/finance/invoices', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listInvoices);

  return router;
}
