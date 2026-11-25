import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { HRSelfServiceController } from '../controllers/HRSelfServiceController';

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

export function creerHrSelfServiceRoutes(controller: HRSelfServiceController): Router {
  const router = Router();
  const roles = ['ADMIN', 'STAFF', 'TEACHER'] as const;

  router.get('/me', requireAuth, requireRole(...roles), controller.getMyFile);
  router.patch('/me', requireAuth, requireRole(...roles), controller.updateMyFile);
  router.post('/me/document', requireAuth, requireRole(...roles), upload.single('file'), controller.uploadMyDocument);
  router.post('/me/analyser-diplome', requireAuth, requireRole(...roles), upload.single('file'), controller.analyserDiplomeDocument);
  router.get('/me/document/:index/download', requireAuth, requireRole(...roles), controller.downloadMyDocument);

  return router;
}
