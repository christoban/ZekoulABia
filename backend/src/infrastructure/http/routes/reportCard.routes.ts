import { Router } from 'express';
import type { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { sensitiveWriteLimiter } from '../middlewares/rateLimit.ts';

export function creerReportCardRoutes(controller: ReportCardController): Router {
  const router = Router();

  // Vérification pré-génération
  router.get('/check/:classId', requireAuth, controller.verifierDisponibilite);

  // Génération via use case hexagonal (remplace l'ancien /generate/:classId + Inngest trigger)
  router.post('/generate', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.genererBulletins);

  // Export ZIP en masse
  router.post('/export/:classId', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.exporterZip);

  // Envoi aux parents via use case hexagonal
  router.post('/send', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.envoyerBulletins);

  // Commentaire du Professeur Principal (écrit APRÈS génération, AVANT envoi aux parents)
  router.patch('/:id/comment', requireAuth, controller.ajouterCommentaire);

  // Suggestion de commentaire par IA (le PP la relit et la modifie via /comment ci-dessus)
  router.post('/:id/generate-comment', sensitiveWriteLimiter, requireAuth, controller.genererCommentaireIA);

  // Vue élève (avant GET / pour éviter que "my" soit traité comme un :id)
  router.get('/my', requireAuth, controller.mesBulletins);

  // Historique bulletins
  router.get('/', requireAuth, controller.lister);

  // Téléchargement PDF individuel (lecture simple : n'incrémente jamais le compteur duplicata)
  router.get('/:id/pdf', requireAuth, controller.telechargerPdf);

  // Réédition contrôlée d'un duplicata officiel (ADMIN / STAFF, motif obligatoire + journal d'audit)
  router.post('/:id/reprint', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.reimprimerDuplicata);

  return router;
}
