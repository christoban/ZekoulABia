import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { APEEController } from '@infrastructure/http/controllers/APEEController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format de fichier non supporté (PDF, JPG, PNG uniquement)'));
  },
});

export function creerApeeRoutes(controller: APEEController): Router {
  const router = Router();
  const gestionnaires = ['ADMIN', 'STAFF'] as const;
  const lecteurs = ['ADMIN', 'STAFF', 'PARENT'] as const;

  router.post('/transactions', requireAuth, requireRole(...gestionnaires), controller.create);
  router.get('/transactions', requireAuth, requireRole(...lecteurs), controller.list);
  router.post('/transactions/:id/justificatif', requireAuth, requireRole(...gestionnaires), upload.single('file'), controller.uploadJustificatif);
  router.post('/transactions/:id/valider', requireAuth, requireRole(...gestionnaires), controller.valider);
  router.get('/solde', requireAuth, requireRole(...lecteurs), controller.solde);
  router.get('/rapport.pdf', requireAuth, requireRole(...lecteurs), controller.rapportPdf);

  return router;
}
