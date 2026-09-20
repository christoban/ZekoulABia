/**
 * INFRASTRUCTURE LAYER — Routes HTTP du Babillard Officiel
 */

import { Router } from 'express';
import multer from 'multer';
import type { BabillardController } from '../controllers/BabillardController';
import { requireAuth } from '../middlewares/auth.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
});

export function creerBabillardRoutes(controller: BabillardController): Router {
  const router = Router();

  // Consultation et compteurs
  router.get('/', requireAuth, controller.lister);
  router.get('/compteurs', requireAuth, controller.compteurs);
  router.get('/non-lus/compteur', requireAuth, controller.compteurNonLus);
  router.get('/:id', requireAuth, controller.trouverParId);

  // Création & Gestion
  router.post('/', requireAuth, controller.creer);
  router.patch('/:id', requireAuth, controller.modifier);
  router.delete('/:id', requireAuth, controller.supprimer);

  // Actions de lecture, épinglage et statistiques
  router.post('/:id/lu', requireAuth, controller.marquerLu);
  router.post('/:id/epingler', requireAuth, controller.epingler);
  router.patch('/:id/epingler', requireAuth, controller.epingler);
  router.get('/:id/statistiques', requireAuth, controller.statistiques);

  // Pièces jointes
  router.post('/pieces-jointes', requireAuth, upload.single('file'), controller.uploadPieceJointe);
  router.get('/:id/pieces-jointes/:pjId', requireAuth, controller.telechargerPieceJointe);

  return router;
}
