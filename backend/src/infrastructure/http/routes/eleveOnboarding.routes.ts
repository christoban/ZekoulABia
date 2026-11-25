import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { authLimiter } from '../middlewares/rateLimit.ts';
import type { EleveOnboardingController } from '../controllers/EleveOnboardingController';
import type { EleveOnboardingDossierController } from '../controllers/EleveOnboardingDossierController';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function creerEleveOnboardingRoutes(
  controller: EleveOnboardingController,
  dossierController?: EleveOnboardingDossierController,
): Router {
  const router = Router();

  // Création / gestion — établissement authentifié
  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creer);
  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.lister);
  router.get('/settings', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getSettings);
  router.patch('/settings', requireAuth, requireRole('ADMIN'), controller.updateSettings);
  router.patch('/admin-gestion', requireAuth, requireRole('ADMIN'), controller.toggleAdminGestion);

  // Dossier V2 — Suggestions de classes & Validation par lot
  if (dossierController) {
    router.get('/classes-suggestions', requireAuth, requireRole('ADMIN', 'STAFF'), dossierController.suggererClasses);
    router.post('/bulk-validate', requireAuth, requireRole('ADMIN'), dossierController.validerLot);
  }

  router.post('/:id/submit', requireAuth, requireRole('ADMIN', 'STAFF'), controller.soumettreDossier);
  router.post('/:id/return', requireAuth, requireRole('ADMIN'), controller.renvoyerDossier);
  router.post('/:id/inscrire', requireAuth, requireRole('ADMIN'), controller.inscrire);
  router.post('/:id/validate', requireAuth, requireRole('ADMIN'), controller.valider);
  router.post('/:id/reject', requireAuth, requireRole('ADMIN', 'STAFF'), controller.rejeter);
  router.post('/:id/resend-link', requireAuth, requireRole('ADMIN', 'STAFF'), controller.renvoyerLien);
  router.get('/:id/pdf', requireAuth, requireRole('ADMIN', 'STAFF'), controller.exporterPdf);

  // Dossier V2 — Pièces justificatives & Fiche PDF officielle
  if (dossierController) {
    router.post('/:id/pieces/init', requireAuth, requireRole('ADMIN', 'STAFF'), dossierController.initialiserPieces);
    router.get('/:id/pieces', requireAuth, requireRole('ADMIN', 'STAFF'), dossierController.listerPieces);
    router.patch('/:id/pieces/:code', requireAuth, requireRole('ADMIN', 'STAFF'), dossierController.marquerPiece);
    router.post('/:id/pieces/:code/upload', requireAuth, requireRole('ADMIN', 'STAFF'), upload.single('file'), dossierController.uploadPiece);
    router.get('/:id/pieces/:code/file', requireAuth, requireRole('ADMIN', 'STAFF'), dossierController.telechargerPiece);
    router.get('/fiche-vierge-pdf', requireAuth, requireRole('ADMIN', 'STAFF'), (req, res, next) => {
      req.params['id'] = 'vierge';
      return dossierController.exporterFichePdf(req, res, next);
    });
    router.get('/:id/fiche-pdf', requireAuth, requireRole('ADMIN', 'STAFF'), dossierController.exporterFichePdf);
  }

  // Formulaire élève/parent — public, protégé par le token lui-même (rate-limité contre le brute-force)
  router.get('/token/:token', authLimiter, controller.getByToken);
  router.post('/token/:token/submit', authLimiter, controller.soumettre);

  return router;
}
