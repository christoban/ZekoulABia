import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { MatriculeController } from '../controllers/MatriculeController';

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

export function creerMatriculeRoutes(controller: MatriculeController): Router {
  const router = Router();

  // Import matricules
  router.post('/import', requireAuth, requireRole('ADMIN'), upload.single('file'), controller.importMatricules);
  router.get('/import-jobs/:schoolId', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listJobs);
  router.get('/import-jobs/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getJob);
  router.post('/manual-match', requireAuth, requireRole('ADMIN', 'STAFF'), controller.manualMatch);

  // Correspondances approximatives (fuzzy matching) — confirmation/signalement admin
  router.post('/fuzzy-matches/:jobId/:ligne/confirm', requireAuth, requireRole('ADMIN', 'STAFF'), controller.confirmerFuzzy);
  router.post('/fuzzy-matches/:jobId/:ligne/flag', requireAuth, requireRole('ADMIN', 'STAFF'), controller.signalerErreurFuzzy);

  // Vérification matricule
  router.post('/verify/:studentId', requireAuth, requireRole('ADMIN', 'STAFF'), controller.verifierMatricule);

  // Sync cartescolaire.cm
  router.post('/sync', requireAuth, requireRole('ADMIN'), controller.syncCarteScolaire);

  // Vérification reçu
  router.post('/verify-recu/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.verifierRecu);

  return router;
}
