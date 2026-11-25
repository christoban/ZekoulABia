import type { Request, Response, NextFunction } from 'express';
import type { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import type { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import type { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import type { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import type { IOrientationRepository } from '@domain/ports/repositories/IOrientationRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { AuthPayload } from '../../middlewares/auth';

export interface OrientationDossierDeps {
  ajouterEntretien: AjouterEntretienUseCase;
  ajouterTest: AjouterTestAptitudeUseCase;
  creerRecommandation: CreerRecommandationSerieUseCase;
  ajouterSuivi: AjouterSuiviUseCase;
  repo: IOrientationRepository;
  audit: AIActionAuditPort;
}

export function checkOrientationPermission(
  user: AuthPayload | undefined,
  res: Response,
): user is AuthPayload {
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentification requise' });
    return false;
  }
  if (user.role === 'ADMIN') return true;
  const perms: string[] = user.permissions ?? [];
  if (!perms.includes('MANAGE_ORIENTATION')) {
    res.status(403).json({ success: false, message: 'Permission MANAGE_ORIENTATION requise' });
    return false;
  }
  return true;
}

export function handleOrientationDomainError(
  err: unknown,
  res: Response,
  next: NextFunction,
  options: { handleClosed?: boolean } = {},
): void {
  if (err instanceof Error) {
    if (err.message.includes('introuvable')) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    if (options.handleClosed && err.message.includes('clôturée')) {
      res.status(422).json({ success: false, message: err.message });
      return;
    }
  }
  next(err);
}

export async function ajouterEntretienAction(
  deps: OrientationDossierDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const {
      date,
      type,
      motif,
      notes,
      recommendations,
      nextActions,
      parentNotified,
      followUpDate,
      status,
    } = req.body;
    if (!date || !type || !motif) {
      res.status(400).json({ success: false, message: 'date, type et motif requis' });
      return;
    }
    const entretien = await deps.ajouterEntretien.execute({
      ficheId: req.params.id as string,
      schoolId: user.schoolId,
      date: new Date(date),
      type,
      motif,
      notes,
      recommendations,
      nextActions,
      parentNotified: parentNotified === true || parentNotified === 'true',
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      status,
    });
    res.status(201).json({ success: true, data: entretien });
  } catch (err) {
    handleOrientationDomainError(err, res, next, { handleClosed: true });
  }
}

export async function modifierEntretienAction(
  deps: OrientationDossierDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { notes, recommendations, nextActions, parentNotified, followUpDate, status } = req.body;
    const updated = await deps.repo.updateEntretien(req.params.id as string, user.schoolId, {
      notes,
      recommendations,
      nextActions,
      ...(parentNotified !== undefined ? { parentNotified: parentNotified === true || parentNotified === 'true' } : {}),
      ...(followUpDate ? { followUpDate: new Date(followUpDate) } : {}),
      status,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    // Hors tenant ou inexistant : 404 indiscernables, pour ne pas révéler l'existence
    // d'une ressource appartenant à une autre école.
    handleOrientationDomainError(err, res, next);
  }
}

export async function ajouterTestAction(
  deps: OrientationDossierDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { type, datePassage, resultats, interpretation, scoreGlobal } = req.body;
    if (!type || !datePassage || !resultats) {
      res.status(400).json({ success: false, message: 'type, datePassage et resultats requis' });
      return;
    }
    const test = await deps.ajouterTest.execute({
      ficheId: req.params.id as string,
      schoolId: user.schoolId,
      type,
      datePassage: new Date(datePassage),
      resultats,
      interpretation,
      scoreGlobal: scoreGlobal != null ? parseInt(scoreGlobal) : undefined,
    });
    res.status(201).json({ success: true, data: test });
  } catch (err) {
    handleOrientationDomainError(err, res, next);
  }
}

export async function creerRecommandationAction(
  deps: OrientationDossierDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { serieActuelle, serieRecommandee, justification } = req.body;
    if (!serieActuelle || !serieRecommandee || !justification) {
      res.status(400).json({ success: false, message: 'serieActuelle, serieRecommandee et justification requis' });
      return;
    }
    const reco = await deps.creerRecommandation.execute({
      ficheId: req.params.id as string,
      schoolId: user.schoolId,
      serieActuelle,
      serieRecommandee,
      justification,
    });
    res.status(201).json({ success: true, data: reco });
  } catch (err) {
    handleOrientationDomainError(err, res, next, { handleClosed: true });
  }
}

export async function validerRecommandationAction(
  deps: OrientationDossierDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentification requise' });
      return;
    }
    if (user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Seul un ADMIN peut valider une recommandation de série' });
      return;
    }
    const updated = await deps.repo.validerRecommandation(req.params.id as string, user.schoolId);
    res.json({ success: true, data: updated });
  } catch (err) {
    // Hors tenant ou inexistant : 404 indiscernables, pour ne pas révéler l'existence
    // d'une ressource appartenant à une autre école.
    handleOrientationDomainError(err, res, next);
  }
}

export async function ajouterSuiviAction(
  deps: OrientationDossierDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!checkOrientationPermission(user, res)) return;
    const { riskLevel, mainConcern, interventions, prochainRdv, notes } = req.body;
    if (!riskLevel || !mainConcern) {
      res.status(400).json({ success: false, message: 'riskLevel et mainConcern requis' });
      return;
    }
    const suivi = await deps.ajouterSuivi.execute({
      ficheId: req.params.id as string,
      schoolId: user.schoolId,
      riskLevel,
      mainConcern,
      interventions,
      prochainRdv: prochainRdv ? new Date(prochainRdv) : undefined,
      notes,
    });
    deps.audit.journaliser({
      actorUserId: user.userId,
      actorRole: user.role,
      schoolId: user.schoolId,
      actionName: 'ajouter_suivi_orientation',
      targetType: 'OrientationFiche',
      targetId: req.params.id as string,
      origin: 'UI_DIRECT',
      outcome: 'SUCCES',
      parametersSummary: { ficheId: req.params.id, riskLevel, mainConcern },
    });
    res.status(201).json({ success: true, data: suivi });
  } catch (err) {
    const user = req.user;
    deps.audit.journaliser({
      actorUserId: user?.userId,
      actorRole: user?.role,
      schoolId: user?.schoolId,
      actionName: 'ajouter_suivi_orientation',
      targetType: 'OrientationFiche',
      targetId: req.params.id as string,
      origin: 'UI_DIRECT',
      outcome: 'ERREUR',
      refusalReason: err instanceof Error ? err.message : undefined,
      parametersSummary: req.body,
    });
    handleOrientationDomainError(err, res, next, { handleClosed: true });
  }
}
