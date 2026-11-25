import type { Request, Response, NextFunction } from 'express';
import type { InviterEcoleUseCase } from '@application/masterAdmin/InviterEcoleUseCase';
import type { SuspendreEcoleUseCase } from '@application/masterAdmin/SuspendreEcoleUseCase';
import type { ReactiverEcoleUseCase } from '@application/masterAdmin/ReactiverEcoleUseCase';
import type { RejeterEcoleUseCase } from '@application/masterAdmin/RejeterEcoleUseCase';
import type { ChangerPlanAbonnementUseCase } from '@application/masterAdmin/ChangerPlanAbonnementUseCase';
import type { SupprimerEcoleUseCase } from '@application/masterAdmin/SupprimerEcoleUseCase';
import type { RenvoyerInvitationEcoleUseCase } from '@application/masterAdmin/RenvoyerInvitationEcoleUseCase';
import type { ChangerStatutEcoleUseCase } from '@application/masterAdmin/ChangerStatutEcoleUseCase';
import type { SynchroniserMatieresEcoleUseCase } from '@application/masterAdmin/SynchroniserMatieresEcoleUseCase';
import type { ReinitialiserMfaUtilisateurUseCase } from '@application/masterAdmin/ReinitialiserMfaUtilisateurUseCase';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import { logMasterAction } from '../../services/audit/MasterAuthAuditService';
import {
  annulerApprobationEcoleAction,
  changerPlanEcoleAction,
  gererErreurMasterAdmin,
  inviterEcoleAction,
  reactiverEcoleAction,
  reexaminerEcoleAction,
  rejeterEcoleAction,
  renvoyerInvitationAction,
  supprimerEcoleAction,
  suspendreEcoleAction,
  syncSubjectsAction,
  type MasterAdminSchoolDeps,
} from './helpers/masterAdminSchoolHelper';
import {
  detailEcoleAction,
  listerEcolesAction,
  listerEmailLogsAction,
  listerJournalSecuriteIAAction,
  listerLogsAction,
  listerSauvegardesAction,
} from './helpers/masterAdminQueryHelper';

export class MasterAdminHexController {
  constructor(
    private readonly inviter: InviterEcoleUseCase,
    private readonly suspendre: SuspendreEcoleUseCase,
    private readonly reactiver: ReactiverEcoleUseCase,
    private readonly rejeter: RejeterEcoleUseCase,
    private readonly changerPlan: ChangerPlanAbonnementUseCase,
    private readonly queryRepo: MasterAdminQueryRepository,
    private readonly supprimerEcoleUC: SupprimerEcoleUseCase,
    private readonly renvoyerInvitationUC: RenvoyerInvitationEcoleUseCase,
    private readonly changerStatutUC: ChangerStatutEcoleUseCase,
    private readonly synchroniserMatieresUC: SynchroniserMatieresEcoleUseCase,
    private readonly reinitialiserMfaUC: ReinitialiserMfaUtilisateurUseCase,
    private readonly eventPublisher?: EventPublisher,
    private readonly fileStorage?: import('@domain/ports/services/FileStoragePort').FileStoragePort,
  ) {}

  private get schoolDeps(): MasterAdminSchoolDeps {
    return {
      inviter: this.inviter,
      suspendre: this.suspendre,
      reactiver: this.reactiver,
      rejeter: this.rejeter,
      changerPlan: this.changerPlan,
      queryRepo: this.queryRepo,
      supprimerEcoleUC: this.supprimerEcoleUC,
      renvoyerInvitationUC: this.renvoyerInvitationUC,
      changerStatutUC: this.changerStatutUC,
      synchroniserMatieresUC: this.synchroniserMatieresUC,
    };
  }

  // POST /api/v2/master/schools/invite
  inviterEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    inviterEcoleAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/schools/:id/suspend
  suspendreEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    suspendreEcoleAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/schools/:id/reactivate
  reactiverEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    reactiverEcoleAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/schools/:id/reject
  rejeterEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    rejeterEcoleAction(this.schoolDeps, req, res, next);

  // PATCH /api/v2/master/schools/:id/plan
  changerPlanEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    changerPlanEcoleAction(this.schoolDeps, req, res, next);

  // GET /api/v2/master/schools
  listerEcoles = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    listerEcolesAction(this.queryRepo, req, res, next);

  // GET /api/v2/master/schools/:id
  detailEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    detailEcoleAction(this.queryRepo, req, res, next);

  // DELETE /api/v2/master/schools/:id
  supprimerEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    supprimerEcoleAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/schools/:id/resend-invite
  renvoyerInvitation = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    renvoyerInvitationAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/schools/:id/cancel-approval
  annulerApprobationEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    annulerApprobationEcoleAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/schools/:id/reexamine
  reexaminerEcole = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    reexaminerEcoleAction(this.schoolDeps, req, res, next);

  // GET /api/v2/master/auth/logs?type=auth|actions|all
  listerLogs = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    listerLogsAction(this.queryRepo, req, res, next);

  // GET /api/v2/master/email-logs — logs email cross-schools pour le master admin
  listerEmailLogs = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    listerEmailLogsAction(this.queryRepo, req, res, next);

  // POST /api/v2/master/schools/:id/sync-subjects
  syncSubjects = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    syncSubjectsAction(this.schoolDeps, req, res, next);

  // POST /api/v2/master/backup/trigger
  declencherSauvegarde = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const schoolId = typeof req.body?.schoolId === 'string' && req.body.schoolId.trim() ? req.body.schoolId.trim() : undefined;

      await this.eventPublisher?.emit('backup/school.requested', {
        schoolId,
        requestedByMasterId: master?.id ?? null,
        source: 'manual',
      } as unknown as Record<string, unknown>);

      void logMasterAction({
        req,
        masterUserId: master?.id,
        action: 'backup_triggered',
        targetId: schoolId ?? 'all-schools',
        description: schoolId ? `Sauvegarde déclenchée pour l'école ${schoolId}` : 'Sauvegarde globale déclenchée',
      });

      res.status(202).json({ success: true, message: 'Sauvegarde déclenchée', data: { eventId: null } });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/users/mfa-reset — débloque un compte Admin/Staff/Teacher ayant perdu
  // l'accès à son authenticator ET à ses codes de récupération. Le compte devra reconfigurer
  // le MFA depuis zéro (nouveau QR) à sa prochaine connexion — geste sensible, jamais silencieux.
  reinitialiserMfaUtilisateur = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { subdomain, email } = req.body as { subdomain?: string; email?: string };
      if (!subdomain || !email) {
        res.status(400).json({ success: false, message: 'subdomain et email requis' });
        return;
      }

      const resultat = await this.reinitialiserMfaUC.execute(subdomain, email);

      void logMasterAction({
        req,
        masterUserId: master?.id,
        action: 'user_mfa_reset',
        targetId: resultat.userId,
        description: `MFA réinitialisé pour ${resultat.userEmail} (${resultat.userRole}) — ${resultat.schoolName}. Reconfiguration obligatoire à la prochaine connexion.`,
      });

      res.json({ success: true, message: 'MFA réinitialisé — ce compte devra le reconfigurer à sa prochaine connexion.' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/backup/list
  listerSauvegardes = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    listerSauvegardesAction(this.queryRepo, this.fileStorage, req, res, next);

  // GET /api/v2/master/security-audit-log — vue "Sécurité plateforme" (assistant IA)
  listerJournalSecuriteIA = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    listerJournalSecuriteIAAction(this.queryRepo, req, res, next);

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    gererErreurMasterAdmin(error, res, next);
  }
}
