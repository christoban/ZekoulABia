import { Router } from 'express';
import type { MasterTeamController } from '@infrastructure/http/controllers/MasterTeamController';
import { authorizeMaster, protectMaster } from '../middlewares/authMultiTenant';

export function creerMasterTeamRoutes(controller: MasterTeamController): Router {
  const router = Router();
  router.use(protectMaster);
  router.use(authorizeMaster(['super_admin']));

  router.get('/', controller.lister);
  router.post('/', controller.creer);
  router.patch('/:id', controller.modifier);
  router.post('/:id/reset-password', controller.reinitialiserMotDePasse);
  router.delete('/:id', controller.supprimer);

  return router;
}

