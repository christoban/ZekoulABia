import { Router } from 'express';
import type { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import { protectMaster, authorizeMaster } from '../middlewares/authMultiTenant.ts';
import { requireMasterSensitiveAuth } from '../middlewares/masterSensitiveAuth.ts';

const ALL_MASTER_ROLES = ['super_admin', 'platform_admin', 'school_manager', 'support'] as const;
const SCHOOL_OPS_ROLES = ['super_admin', 'platform_admin', 'school_manager'] as const;
const ADMIN_ROLES = ['super_admin', 'platform_admin'] as const;

export function creerMasterAdminHexRoutes(controller: MasterAdminHexController): Router {
  const router = Router();

  router.use(protectMaster);
  router.use(authorizeMaster([...ALL_MASTER_ROLES]));

  router.get('/schools',      controller.listerEcoles);
  router.get('/schools/:id',  controller.detailEcole);
  router.get('/auth/logs',    authorizeMaster([...ALL_MASTER_ROLES]), controller.listerLogs);
  router.get('/email-logs',   authorizeMaster([...ADMIN_ROLES]), controller.listerEmailLogs);
  router.get('/backup/list',  authorizeMaster([...ADMIN_ROLES]), controller.listerSauvegardes);
  router.get('/security-audit-log', authorizeMaster([...ADMIN_ROLES]), controller.listerJournalSecuriteIA);
  router.patch('/schools/:id/plan', authorizeMaster([...SCHOOL_OPS_ROLES]), controller.changerPlanEcole);

  // ── Actions décisives — vérification identité obligatoire ──────────────
  router.post('/schools/invite',              authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.inviterEcole);
  router.post('/schools/:id/reject',          authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.rejeterEcole);
  router.post('/schools/:id/suspend',         authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.suspendreEcole);
  router.post('/schools/:id/reactivate',      authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.reactiverEcole);
  router.post('/schools/:id/cancel-approval', authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.annulerApprobationEcole);
  router.post('/schools/:id/reexamine',       authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.reexaminerEcole);
  router.post('/schools/:id/sync-subjects',   authorizeMaster([...SCHOOL_OPS_ROLES]), controller.syncSubjects);
  router.post('/schools/:id/resend-invite',   authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.renvoyerInvitation);
  router.post('/backup/trigger',              authorizeMaster(['super_admin']), requireMasterSensitiveAuth, controller.declencherSauvegarde);
  router.post('/users/mfa-reset',             authorizeMaster([...ALL_MASTER_ROLES]), requireMasterSensitiveAuth, controller.reinitialiserMfaUtilisateur);
  router.delete('/schools/:id',               authorizeMaster([...SCHOOL_OPS_ROLES]), requireMasterSensitiveAuth, controller.supprimerEcole);

  return router;
}
