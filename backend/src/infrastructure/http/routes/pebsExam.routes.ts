import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { PebsExamController } from '../controllers/PebsExamController';

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

export function creerPebsExamRoutes(controller: PebsExamController): Router {
  const router = Router();

  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.lister);
  router.post('/', requireAuth, requireRole('ADMIN'), controller.creer);
  router.post('/:id/candidates', requireAuth, requireRole('ADMIN'), controller.ajouterCandidats);
  router.post('/:id/candidates/import', requireAuth, requireRole('ADMIN'), upload.single('file'), controller.importCandidats);
  router.post('/:id/candidates/scan', requireAuth, requireRole('ADMIN'), controller.scanner);
  router.post('/:id/compute-selection', requireAuth, requireRole('ADMIN'), controller.calculer);
  router.post('/:id/detect-anomalies', requireAuth, requireRole('ADMIN'), controller.detecterAnomalies);
  router.post('/:id/apply-transfer', requireAuth, requireRole('ADMIN'), controller.appliquerTransfert);
  router.get('/:id/summary', requireAuth, requireRole('ADMIN', 'STAFF'), controller.resume);

  return router;
}
