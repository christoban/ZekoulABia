import { Router } from 'express';
import type { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { requireAuth, requireRole, requirePermission } from '../middlewares/auth.ts';

export function creerAcademicYearRoutes(controller: AcademicYearController): Router {
  const router = Router();

  // Ops quotidiennes (classes ACTIVE année courante) -> MANAGE_CLASSES, immédiat + audit
  // Ops sensibles (structure N+1) -> propose STAFF/ADMIN, validate ADMIN only (DRAFT->ACTIVE)

  router.post('/', requireAuth, requireRole('ADMIN'), controller.creerAnnee);
  router.patch('/periods/:id/set-current', requireAuth, requireRole('ADMIN'), controller.definirPeriodeCourante);
  router.patch('/sequences/:id/set-current', requireAuth, requireRole('ADMIN'), controller.definirSequenceCourante);
  router.post('/:id/pre-close-check', requireAuth, requireRole('ADMIN'), controller.verifierAvantCloture);

  // Proposer et annuler la structure N+1 : Censeur (MANAGE_CLASSES ou VALIDATE_GRADES) ou ADMIN (bypass requirePermission)
  router.post('/:id/propose-next-structure', requireAuth, requirePermission('MANAGE_CLASSES', 'VALIDATE_GRADES'), controller.proposerStructureAnneeSuivante);
  router.post('/:id/validate-structure', requireAuth, requireRole('ADMIN'), controller.validerStructureAnneeSuivante);
  router.post('/:id/cancel-proposed-structure', requireAuth, requirePermission('MANAGE_CLASSES', 'VALIDATE_GRADES'), controller.annulerStructureAnneeSuivante);

  // Clôture d'année : Proviseur (ADMIN) uniquement
  router.post('/:id/close', requireAuth, requireRole('ADMIN'), controller.cloturerAnnee);
  router.put('/:id/calendar', requireAuth, requireRole('ADMIN'), controller.mettreAJourCalendrierScolaire);

  return router;
}
