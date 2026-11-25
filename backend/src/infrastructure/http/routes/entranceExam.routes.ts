import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { resultatsConcoursLimiter } from '../middlewares/rateLimit.ts';
import type { EntranceExamController } from '../controllers/EntranceExamController';
import type { EntranceExamPublicController } from '../controllers/EntranceExamPublicController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format de fichier non supporté'));
  },
});

export function creerEntranceExamRoutes(
  controller: EntranceExamController,
  publicController?: EntranceExamPublicController
): Router {
  const router = Router();

  // Consultation publique des résultats (avec rate limiter dédié)
  if (publicController) {
    router.post('/public/resultats', resultatsConcoursLimiter, publicController.consulter);
  }

  // Sessions
  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.lister);
  router.post('/', requireAuth, requireRole('ADMIN'), controller.creer);
  router.get('/:id/details', requireAuth, requireRole('ADMIN', 'STAFF'), controller.details);
  router.get('/:id/summary', requireAuth, requireRole('ADMIN', 'STAFF'), controller.resume);

  // Configuration des épreuves & salles (ADMIN + STAFF pour répartition)
  router.post('/:id/subjects', requireAuth, requireRole('ADMIN'), controller.configurerMatieres);
  router.post('/:id/rooms', requireAuth, requireRole('ADMIN'), controller.creerSalle);
  router.post('/:id/rooms/assign', requireAuth, requireRole('ADMIN', 'STAFF'), controller.repartirSalles);

  // Inscriptions au guichet, import et scan (ADMIN + STAFF)
  router.post('/:id/candidates/register', requireAuth, requireRole('ADMIN', 'STAFF'), controller.inscrireCandidatGuichet);
  router.post('/:id/candidates', requireAuth, requireRole('ADMIN', 'STAFF'), controller.ajouterCandidats);
  router.post('/:id/candidates/import', requireAuth, requireRole('ADMIN', 'STAFF'), upload.single('file'), controller.importCandidats);
  router.post('/:id/candidates/scan', requireAuth, requireRole('ADMIN', 'STAFF'), controller.scanner);
  router.post('/:id/detect-anomalies', requireAuth, requireRole('ADMIN', 'STAFF'), controller.detecterAnomalies);

  // Convocations & Listes d'émargement PDF (ADMIN + STAFF)
  router.get('/candidates/:id/convocation-pdf', requireAuth, requireRole('ADMIN', 'STAFF'), controller.genererConvocationPdf);
  router.get('/:id/rooms/:roomId/emargement-pdf', requireAuth, requireRole('ADMIN', 'STAFF'), controller.genererEmargementPdf);
  router.post('/:id/emargement', requireAuth, requireRole('ADMIN', 'STAFF'), controller.enregistrerPresence);

  // Notation (ADMIN + STAFF)
  router.post('/candidates/:id/grades', requireAuth, requireRole('ADMIN', 'STAFF'), controller.saisirNotes);

  // Délibération & Simulation (ADMIN)
  router.post('/:id/deliberation/simulate', requireAuth, requireRole('ADMIN'), controller.simulerDeliberation);
  router.post('/:id/compute-admission', requireAuth, requireRole('ADMIN'), controller.calculer);
  router.get('/:id/publish/estimate-sms', requireAuth, requireRole('ADMIN'), controller.estimerCampagneSms);
  router.post('/:id/publish', requireAuth, requireRole('ADMIN'), controller.publierResultats);

  // Finalisation admissions vers Onboarding (ADMIN + STAFF — sans re-validation de la direction)
  router.post('/:id/finalize-admissions', requireAuth, requireRole('ADMIN', 'STAFF'), controller.finaliserAdmissions);

  // CEP (Unitaire & En Lot avec workflow Secrétaire -> Admin)
  router.patch('/candidates/:id/cep-result', requireAuth, requireRole('ADMIN'), controller.enregistrerCep);
  router.post('/:id/cep-batch/propose', requireAuth, requireRole('ADMIN', 'STAFF'), controller.proposerLotCep);
  router.post('/:id/cep-batch/apply', requireAuth, requireRole('ADMIN'), controller.appliquerLotCep);

  return router;
}
