import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { StudentDocumentController } from '@infrastructure/http/controllers/StudentDocumentController';

export function creerStudentDocumentRoutes(controller: StudentDocumentController): Router {
  const router = Router();

  // Documents de l'élève connecté — STUDENT
  router.get(
    '/students/me/certificat',
    requireAuth,
    requireRole('STUDENT'),
    controller.getMyCertificat
  );

  router.get(
    '/students/me/carte',
    requireAuth,
    requireRole('STUDENT'),
    controller.getMyCarte
  );

  // Documents individuels — ADMIN, STAFF ou PARENT (enfant rattaché)
  router.get(
    '/students/:id/certificat',
    requireAuth,
    requireRole('ADMIN', 'STAFF', 'PARENT'),
    controller.getCertificat
  );

  router.get(
    '/students/:id/carte',
    requireAuth,
    requireRole('ADMIN', 'STAFF', 'PARENT'),
    controller.getCarte
  );

  router.get(
    '/students/:id/lettre-transfert',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.getLettreTransfert
  );

  // Vérification publique — sans auth
  router.get('/verify/:documentId', controller.verifyDocument);

  return router;
}
