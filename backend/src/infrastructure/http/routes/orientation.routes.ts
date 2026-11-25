import { Router } from 'express';
import type { OrientationController } from '@infrastructure/http/controllers/OrientationController';
import { requireAuth } from '../middlewares/auth.ts';

export function creerOrientationRoutes(controller: OrientationController): Router {
  const router = Router();

  // Stats
  router.get('/stats', requireAuth, controller.obtenirStats);

  // Fiches
  router.get('/fiches',     requireAuth, controller.lister);
  router.post('/fiches',    requireAuth, controller.creer);
  router.get('/fiches/:id', requireAuth, controller.detail);

  // Entretiens
  router.post('/fiches/:id/entretiens',  requireAuth, controller.ajouterEntretienHandler);
  router.patch('/entretiens/:id',         requireAuth, controller.modifierEntretien);

  // Tests d'aptitude
  router.post('/fiches/:id/tests', requireAuth, controller.ajouterTestHandler);

  // Recommandation série
  router.post('/fiches/:id/recommandation-serie',      requireAuth, controller.creerRecommandationHandler);
  router.patch('/recommandations/:id/valider',          requireAuth, controller.validerRecommandation);

  // Suivis
  router.post('/fiches/:id/suivis', requireAuth, controller.ajouterSuiviHandler);

  // Aspirations élève
  router.post('/aspirations',                    requireAuth, controller.saisirAspirationHandler);
  router.get('/aspirations/:checkpointType',      requireAuth, controller.obtenirAspiration);

  // Moteur de checkpoints
  router.post('/checkpoints/:type/generer',       requireAuth, controller.genererRecommandationHandler);
  router.get('/checkpoints/:type/config',         requireAuth, controller.obtenirConfigCheckpoint);
  router.put('/checkpoints/:type/config',         requireAuth, controller.configurerCheckpointHandler);
  router.get('/eleves-a-orienter',                requireAuth, controller.elevesAOrienterHandler);

  // Workflow de décision (conseiller puis élève)
  router.patch('/recommandations/:id/valider-conseiller', requireAuth, controller.validerRecommandationConseillerHandler);
  router.patch('/recommandations/:id/proposer-eleve',     requireAuth, controller.proposerRecommandationEleveHandler);
  router.patch('/recommandations/:id/choisir-piste',      requireAuth, controller.choisirPisteEleveHandler);
  router.get('/ma-recommandation/:checkpointType',        requireAuth, controller.maRecommandation);

  return router;
}
