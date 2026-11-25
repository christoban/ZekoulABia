import { Router } from 'express';
import type { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { requireAuth, requirePermission } from '../middlewares/auth.ts';

export function creerClasseRoutes(controller: ClasseController): Router {
  const router = Router();

  // Organisation pédagogique — Censeur (perm) ou ADMIN (bypass)
  router.post('/', requireAuth, requirePermission('MANAGE_CLASSES'), controller.creerClasse);
  router.put('/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.modifierClasse);
  router.delete('/:id', requireAuth, requirePermission('MANAGE_CLASSES'), controller.supprimerClasse);
  router.patch(
    '/:id/professor-principal',
    requireAuth,
    requirePermission('MANAGE_CLASSES'),
    controller.assignerProfesseurPrincipal,
  );

  // Lecture : tout utilisateur authentifié de l'école (inchangé)
  router.get('/:id/students', requireAuth, controller.getStudents);
  router.get('/:id/tableau-honneur', requireAuth, controller.tableauHonneur);
  router.get('/:id/tableau-honneur-annuel', requireAuth, controller.tableauHonneurAnnuel);

  router.post(
    '/:id/subgroups',
    requireAuth,
    requirePermission('MANAGE_CLASSES'),
    controller.creerSousGroupeTP,
  );
  router.post(
    '/subgroups/:subGroupId/students',
    requireAuth,
    requirePermission('MANAGE_STUDENT_ASSIGNMENTS'),
    controller.assignerElevesAuSousGroupe,
  );
  router.post(
    '/:classId/subjects',
    requireAuth,
    requirePermission('MANAGE_CLASSES'),
    controller.ajouterMatiereClasse,
  );
  router.delete(
    '/:classId/subjects/:subjectId',
    requireAuth,
    requirePermission('MANAGE_CLASSES'),
    controller.supprimerMatiereClasse,
  );
  router.put(
    '/:id/room-assignment',
    requireAuth,
    requirePermission('MANAGE_CLASSES'),
    controller.assignerSalleClasse,
  );
  router.delete(
    '/:id/room-assignment',
    requireAuth,
    requirePermission('MANAGE_CLASSES'),
    controller.retirerAssignationSalleClasse,
  );

  return router;
}
