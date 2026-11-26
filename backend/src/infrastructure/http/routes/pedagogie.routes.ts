import { Router } from 'express';
import multer from 'multer';
import type { PedagogieController } from '@infrastructure/http/controllers/PedagogieController';
import type { PedagogieMaterialisationController } from '@infrastructure/http/controllers/PedagogieMaterialisationController';
import type { PedagogieSynchronisationController } from '@infrastructure/http/controllers/PedagogieSynchronisationController';
import { requirePermission, requireRole } from '@infrastructure/http/middlewares/auth';
import { requireOfficialProgrammesMaterialisation } from '@infrastructure/config/featureFlags';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function creerPedagogieRoutes(
  ctrl: PedagogieController,
  materialisationCtrl?: PedagogieMaterialisationController,
  syncCtrl?: PedagogieSynchronisationController,
): Router {
  const router = Router();

  // Programmes
  router.get('/programmes', ctrl.listProgrammes);
  router.post('/programmes', ctrl.createProgramme);
  router.patch('/programmes/:id', ctrl.updateProgramme);
  router.delete('/programmes/:id', ctrl.deleteProgramme);

  // Chapitres (sous un programme)
  router.post('/programmes/:programmeId/chapitres', ctrl.addChapitre);
  router.patch('/chapitres/:id', ctrl.updateChapitre);
  router.delete('/chapitres/:id', ctrl.deleteChapitre);

  // Cahier de texte
  router.post('/cahier-de-texte', ctrl.createCahierDeTexte);
  router.get('/cahier-de-texte', ctrl.listCahierDeTexte);

  // Scan photo via Groq Vision (multipart)
  router.post('/scan', upload.single('image'), ctrl.scanCahier);

  // Slot du jour (pré-remplissage automatique)
  router.get('/today-slot', ctrl.getTodaySlot);

  // Vérification programme par matière
  router.get('/subjects/:subjectId/has-programme', ctrl.getSubjectHasProgramme);

  // Analyse pédagogique
  router.get('/progression', ctrl.getProgression);
  router.get('/alertes-retard', ctrl.getAlertesRetard);
  router.get('/rapports', ctrl.getRapport);

  // Matérialisation programmes nationaux (Lot 1 — protégé par feature flag + RBAC)
  if (materialisationCtrl) {
    router.get('/materialisation/status', materialisationCtrl.getStatus);

    router.post(
      '/classes/:classId/initialiser-programmes/propose',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      materialisationCtrl.proposerInitialisationClasse,
    );
    router.post(
      '/classes/:classId/initialiser-programmes/apply',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      materialisationCtrl.appliquerInitialisationClasse,
    );
    router.put(
      '/chapitres/:chapitreId/avancement',
      requireOfficialProgrammesMaterialisation,
      requireRole('TEACHER', 'STAFF'),
      materialisationCtrl.basculerAvancementChapitre,
    );
    router.put(
      '/programmes/:programmeId/modules/:moduleOrdre/statut',
      requireOfficialProgrammesMaterialisation,
      requireRole('TEACHER', 'STAFF'),
      materialisationCtrl.basculerModuleActif,
    );
  }

  // Lot 2 : Initialisation en lot d'école, détection de dérive & synchronisation différentielle
  if (syncCtrl) {
    router.post(
      '/ecole/initialiser-programmes/propose',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      syncCtrl.proposerInitialisationEcole,
    );
    router.post(
      '/ecole/initialiser-programmes/apply',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      syncCtrl.appliquerInitialisationEcole,
    );
    router.get(
      '/programmes/derives',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      syncCtrl.listerDerivesEcole,
    );
    router.post(
      '/programmes/:programmeId/synchroniser/propose',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      syncCtrl.proposerSynchronisationProgramme,
    );
    router.post(
      '/programmes/:programmeId/synchroniser/apply',
      requireOfficialProgrammesMaterialisation,
      requirePermission('MANAGE_CLASSES'),
      syncCtrl.appliquerSynchronisationProgramme,
    );
  }

  return router;
}
