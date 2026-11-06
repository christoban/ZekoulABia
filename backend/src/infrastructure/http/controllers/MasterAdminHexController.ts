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
import { MasterAdminNotFoundError, MasterAdminValidationError } from '@application/masterAdmin/errors';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import type { PlanType, SchoolSubsystem } from '@domain/types/enums';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';
import { listSchoolBackups } from '../../backup/SchoolBackupService';
import { logMasterAction } from '../../services/audit/MasterAuthAuditService';

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
  ) {}

  // POST /api/v2/master/schools/invite
  inviterEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser;
      const { email, schoolName, plan, notes, subsystem } = req.body;

      if (!email || !schoolName) {
        res.status(400).json({ success: false, message: 'email et schoolName requis' });
        return;
      }

      const resultat = await this.inviter.execute({
        email,
        schoolName,
        plan: (plan ?? 'DISCOVERY') as PlanType,
        masterAdminId: master.id,
        notes,
        subsystem: subsystem as SchoolSubsystem | undefined,
      });

      void logMasterAction({ req, masterUserId: master.id, action: 'school_invite_sent', description: `Invitation envoyée à ${email} pour «${schoolName}»` });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/suspend
  suspendreEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;
      await this.suspendre.execute(id);
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_suspended', targetId: id, description: `École ${id} suspendue` });
      res.json({ success: true, message: 'École suspendue' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reactivate
  reactiverEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;
      await this.reactiver.execute(id);
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_reactivated', targetId: id, description: `École ${id} réactivée` });
      res.json({ success: true, message: 'École réactivée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reject
  rejeterEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;
      const { motif } = req.body;
      if (!motif) {
        res.status(400).json({ success: false, message: 'Le motif est obligatoire' });
        return;
      }
      await this.rejeter.execute({ schoolId: id, motif });
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_rejected', targetId: id, description: `École ${id} rejetée — motif: ${motif}` });
      res.json({ success: true, message: 'École rejetée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/master/schools/:id/plan
  changerPlanEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plan } = req.body;
      if (!plan) {
        res.status(400).json({ success: false, message: 'plan requis (DISCOVERY/STANDARD/PREMIUM/ETABLISSEMENT_PLUS)' });
        return;
      }
      await this.changerPlan.execute({
        schoolId: req.params.id as string,
        nouveauPlan: plan as PlanType,
      });
      res.json({ success: true, message: `Plan changé vers ${plan}` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/schools
  listerEcoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, search, page = '1', limit = '50' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { subdomain: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [schools, total] = await Promise.all([
        this.queryRepo.listSchools(where, skip, take),
        this.queryRepo.countSchools(where),
      ]);

      res.json({
        success: true,
        data: schools,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/schools/:id
  detailEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const school = await this.queryRepo.findSchoolWithDetail(req.params.id as string);

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      res.json({ success: true, data: school });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /api/v2/master/schools/:id
  supprimerEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const master = req.masterUser;

      const { schoolName } = await this.supprimerEcoleUC.execute(id);

      void logMasterAction({ req, masterUserId: master?.id, action: 'school_deleted', targetId: id, description: `«${schoolName}» supprimée définitivement` });
      res.json({ success: true, message: 'École supprimée définitivement' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/resend-invite
  renvoyerInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { email, schoolName, newToken } = await this.renvoyerInvitationUC.execute(id);

      const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const activationUrl = `${frontendUrl}/onboarding/${newToken}`;

      const master = req.masterUser;
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_invite_resent', targetId: id, description: `Invitation renvoyée à ${email} pour «${schoolName}»` });

      // Répondre immédiatement — l'email s'envoie en arrière-plan
      res.json({ success: true, message: `Invitation renvoyée à ${email}` });

      sendTransactionalEmail({
        recipientEmail: email,
        subject: `ZekoulABia — Renvoi d'invitation : ${schoolName}`,
        html: `
          <p>Bonjour,</p>
          <p>Votre invitation pour l'établissement <strong>${schoolName}</strong> a été renvoyée.</p>
          <p>Cliquez sur le lien ci-dessous pour activer votre espace (lien valable 72h) :</p>
          <p><a href="${activationUrl}" style="background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Activer mon espace ZekoulABia</a></p>
          <p style="color:#888;font-size:13px">Lien direct : ${activationUrl}</p>
        `,
        template: 'school_invite',
        eventType: 'school_invite',
      }).catch(err => console.error('[Email] Échec renvoi invitation:', err));
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/cancel-approval
  annulerApprobationEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { schoolName } = await this.changerStatutUC.annulerApprobation(id);
      const master = req.masterUser;
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_approval_cancelled', targetId: id, description: `«${schoolName}» approbation annulée (APPROVED → PENDING)` });
      res.json({ success: true, message: `L'approbation de ${schoolName} a été annulée — elle repasse en attente` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/reexamine
  reexaminerEcole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { schoolName } = await this.changerStatutUC.reexaminer(id);
      const master = req.masterUser;
      void logMasterAction({ req, masterUserId: master?.id, action: 'school_reexamined', targetId: id, description: `«${schoolName}» remise en examen (REJECTED → PENDING)` });
      res.json({ success: true, message: `La demande de ${schoolName} est remise en examen` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/auth/logs?type=auth|actions|all
  listerLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { action, page = '1', limit = '50', type = 'all' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: Record<string, unknown> = {};
      if (action) {
        where.action = action;
      } else if (type === 'auth') {
        where.NOT = { action: { startsWith: 'action:' } };
      } else if (type === 'actions') {
        where.action = { startsWith: 'action:' };
      }

      const [logs, total] = await Promise.all([
        this.queryRepo.listMasterAuthAudit(where, skip, take),
        this.queryRepo.countMasterAuthAudit(where),
      ]);

      res.json({
        success: true,
        data: logs,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/email-logs — logs email cross-schools pour le master admin
  listerEmailLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = '1', limit = '50', search = '', schoolId } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: Record<string, unknown> = {};
      if (schoolId) where.schoolId = schoolId;
      if (search) {
        where.OR = [
          { to: { contains: search as string, mode: 'insensitive' } },
          { subject: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [emailLogs, total] = await Promise.all([
        this.queryRepo.listEmailLogs(where, skip, take),
        this.queryRepo.countEmailLogs(where),
      ]);

      res.json({
        success: true,
        data: emailLogs,
        pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/master/schools/:id/sync-subjects
  // Rattrapage : crée les matières et SubjectCoefficients pour une école ACTIVE
  // dont l'activation s'est faite avant que ces étapes soient en place.
  syncSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;

      const resultat = await this.synchroniserMatieresUC.execute(id);

      res.json({
        success: true,
        message: `Synchronisation terminée pour "${resultat.schoolName}"`,
        data: { subjectsCreated: resultat.subjectsCreated, subjectCoefficientsUpserted: resultat.subjectCoefficientsUpserted },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

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
  listerSauvegardes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = typeof req.query.schoolId === 'string' && req.query.schoolId.trim() ? req.query.schoolId.trim() : undefined;
      const backups = await listSchoolBackups(schoolId);
      res.json({ success: true, data: backups });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/master/security-audit-log — vue "Sécurité plateforme" (chantier Sécurité de
  // l'assistant IA). Transversale à tous les établissements, mais concentrée par défaut sur les
  // refus (outcome=REFUSE) — la redevabilité métier détaillée de chaque école reste la vue
  // "Journal d'établissement" côté admin d'école, jamais fusionnée avec celle-ci.
  listerJournalSecuriteIA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { schoolId, outcome, actorRole, origin, actionName, page = '1', limit = '50' } = req.query as Record<string, string>;
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = parseInt(limit, 10);

      const where: Record<string, unknown> = {};
      if (schoolId) where.schoolId = schoolId;
      if (outcome) where.outcome = outcome;
      if (actorRole) where.actorRole = actorRole;
      if (origin) where.origin = origin;
      if (actionName) where.actionName = actionName;

      const [entries, total] = await Promise.all([
        this.queryRepo.listAiActionAudit(where, skip, take),
        this.queryRepo.countAiActionAudit(where),
      ]);

      res.json({
        success: true,
        data: entries,
        pagination: { page: parseInt(page, 10), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof MasterAdminValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof MasterAdminNotFoundError) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Impossible')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
