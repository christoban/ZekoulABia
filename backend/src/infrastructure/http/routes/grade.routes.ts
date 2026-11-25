import { Router } from 'express';
import multer from 'multer';
import type { GradeController } from '@infrastructure/http/controllers/GradeController';
import { requireAuth } from '../middlewares/auth.ts';
import { sensitiveWriteLimiter } from '../middlewares/rateLimit.ts';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function creerGradeRoutes(controller: GradeController): Router {
  const router = Router();

  // Lecture
  router.get('/', requireAuth, controller.lister);
  router.get('/pending', requireAuth, controller.listerEnAttente);
  router.get('/status/:classId', requireAuth, controller.statutParClasse);
  router.get('/average/:studentId', requireAuth, controller.moyenneEleve);

  // Import Excel (template + upload)
  router.get('/template', requireAuth, controller.genererTemplate);
  router.post('/import', sensitiveWriteLimiter, requireAuth, upload.single('file'), controller.importerDepuisExcel);

  // Saisie et modification
  router.post('/', sensitiveWriteLimiter, requireAuth, controller.saisir);
  router.post('/draft', sensitiveWriteLimiter, requireAuth, controller.draftEnMasse);
  router.put('/:id', sensitiveWriteLimiter, requireAuth, controller.modifier);

  // Workflow de validation
  router.patch('/:id/lock', requireAuth, controller.verrouiller);
  router.post('/bulk-lock', sensitiveWriteLimiter, requireAuth, controller.verrouillerEnMasse);

  return router;
}
