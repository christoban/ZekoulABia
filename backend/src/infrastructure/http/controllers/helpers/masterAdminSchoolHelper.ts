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
import { MasterAdminNotFoundError, MasterAdminValidationError } from '@application/masterAdmin/errors';
import { verifierAccesGestionEcoleMaster } from '@application/masterAdmin/masterSchoolAccess';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import type { PlanType, SchoolSubsystem } from '@domain/types/enums';
import { sendTransactionalEmail } from '../../../services/email/EmailService.ts';
import { logMasterAction } from '../../../services/audit/MasterAuthAuditService';

export interface MasterAdminSchoolDeps {
  inviter: InviterEcoleUseCase;
  suspendre: SuspendreEcoleUseCase;
  reactiver: ReactiverEcoleUseCase;
  rejeter: RejeterEcoleUseCase;
  changerPlan: ChangerPlanAbonnementUseCase;
  queryRepo: MasterAdminQueryRepository;
  supprimerEcoleUC: SupprimerEcoleUseCase;
  renvoyerInvitationUC: RenvoyerInvitationEcoleUseCase;
  changerStatutUC: ChangerStatutEcoleUseCase;
  synchroniserMatieresUC: SynchroniserMatieresEcoleUseCase;
}

export function gererErreurMasterAdmin(error: unknown, res: Response, next: NextFunction): void {
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

async function verifierAccesGestion(
  queryRepo: MasterAdminQueryRepository,
  req: Request,
  res: Response,
  schoolId: string,
): Promise<boolean> {
  const check = await verifierAccesGestionEcoleMaster(queryRepo, req.masterUser, schoolId);
  if (check.introuvable) {
    res.status(404).json({ success: false, message: 'École introuvable' });
    return false;
  }
  if (!check.autorise) {
    res.status(403).json({
      success: false,
      message: "Vous n'êtes autorisé à gérer que les établissements que vous avez créés ou qui vous sont assignés",
    });
    return false;
  }
  return true;
}

async function executerActionCycleVieEcole(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
  action: string,
  operation: (id: string) => Promise<{ description: string; message: string }>,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!(await verifierAccesGestion(deps.queryRepo, req, res, id))) return;
    const master = req.masterUser;
    const { description, message } = await operation(id);
    void logMasterAction({ req, masterUserId: master?.id, action, targetId: id, description });
    res.json({ success: true, message });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export async function inviterEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const master = req.masterUser;
    const { email, schoolName, plan, notes, subsystem } = req.body;

    if (!email || !schoolName) {
      res.status(400).json({ success: false, message: 'email et schoolName requis' });
      return;
    }

    const resultat = await deps.inviter.execute({
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
    gererErreurMasterAdmin(error, res, next);
  }
}

export function suspendreEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return executerActionCycleVieEcole(deps, req, res, next, 'school_suspended', async (id) => {
    await deps.suspendre.execute(id);
    return { description: `École ${id} suspendue`, message: 'École suspendue' };
  });
}

export function reactiverEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return executerActionCycleVieEcole(deps, req, res, next, 'school_reactivated', async (id) => {
    await deps.reactiver.execute(id);
    return { description: `École ${id} réactivée`, message: 'École réactivée' };
  });
}

export async function rejeterEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!(await verifierAccesGestion(deps.queryRepo, req, res, id))) return;
    const master = req.masterUser;
    const { motif } = req.body;
    if (!motif) {
      res.status(400).json({ success: false, message: 'Le motif est obligatoire' });
      return;
    }
    await deps.rejeter.execute({ schoolId: id, motif });
    void logMasterAction({ req, masterUserId: master?.id, action: 'school_rejected', targetId: id, description: `École ${id} rejetée — motif: ${motif}` });
    res.json({ success: true, message: 'École rejetée' });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export async function changerPlanEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!(await verifierAccesGestion(deps.queryRepo, req, res, id))) return;
    const { plan } = req.body;
    if (!plan) {
      res.status(400).json({ success: false, message: 'plan requis (DISCOVERY/STANDARD/PREMIUM/ETABLISSEMENT_PLUS)' });
      return;
    }
    await deps.changerPlan.execute({
      schoolId: id,
      nouveauPlan: plan as PlanType,
    });
    res.json({ success: true, message: `Plan changé vers ${plan}` });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export function supprimerEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return executerActionCycleVieEcole(deps, req, res, next, 'school_deleted', async (id) => {
    const { schoolName } = await deps.supprimerEcoleUC.execute(id);
    return { description: `«${schoolName}» supprimée définitivement`, message: 'École supprimée définitivement' };
  });
}

export async function renvoyerInvitationAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!(await verifierAccesGestion(deps.queryRepo, req, res, id))) return;
    const { email, schoolName, newToken } = await deps.renvoyerInvitationUC.execute(id);

    const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const activationUrl = `${frontendUrl}/onboarding/${newToken}`;

    const master = req.masterUser;
    void logMasterAction({ req, masterUserId: master?.id, action: 'school_invite_resent', targetId: id, description: `Invitation renvoyée à ${email} pour «${schoolName}»` });

    // Répondre immédiatement — l'email s'envoie en arrière-plan
    res.json({ success: true, message: `Invitation renvoyée à ${email}`, data: { activationUrl, token: newToken } });

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
      metadata: { schoolId: id },
    }).catch(err => console.error('[Email] Échec renvoi invitation:', err));
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export function annulerApprobationEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return executerActionCycleVieEcole(deps, req, res, next, 'school_approval_cancelled', async (id) => {
    const { schoolName } = await deps.changerStatutUC.annulerApprobation(id);
    return {
      description: `«${schoolName}» approbation annulée (APPROVED → PENDING)`,
      message: `L'approbation de ${schoolName} a été annulée — elle repasse en attente`,
    };
  });
}

export function reexaminerEcoleAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return executerActionCycleVieEcole(deps, req, res, next, 'school_reexamined', async (id) => {
    const { schoolName } = await deps.changerStatutUC.reexaminer(id);
    return {
      description: `«${schoolName}» remise en examen (REJECTED → PENDING)`,
      message: `La demande de ${schoolName} est remise en examen`,
    };
  });
}

// Rattrapage : crée les matières et SubjectCoefficients pour une école ACTIVE
// dont l'activation s'est faite avant que ces étapes soient en place.
export async function syncSubjectsAction(
  deps: MasterAdminSchoolDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!(await verifierAccesGestion(deps.queryRepo, req, res, id))) return;

    const resultat = await deps.synchroniserMatieresUC.execute(id);

    res.json({
      success: true,
      message: `Synchronisation terminée pour "${resultat.schoolName}"`,
      data: { subjectsCreated: resultat.subjectsCreated, subjectCoefficientsUpserted: resultat.subjectCoefficientsUpserted },
    });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}
