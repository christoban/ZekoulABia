import { Router } from 'express';
import type { GroupTransferController } from '../controllers/GroupTransferController';
import { protectGroupOwner } from '../middlewares/authMultiTenant.ts';

export function creerGroupTransferRoutes(controller: GroupTransferController): Router {
  const router = Router();

  router.use(protectGroupOwner);

  router.get('/', controller.lister);
  router.post('/', controller.creerDemande);
  router.get('/search', controller.rechercherPersonne);

  return router;
}
