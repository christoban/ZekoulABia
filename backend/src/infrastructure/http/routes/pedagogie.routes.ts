import { Router } from 'express';
import multer from 'multer';
import type { PedagogieController } from '@infrastructure/http/controllers/PedagogieController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function creerPedagogieRoutes(ctrl: PedagogieController): Router {
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

  return router;
}
