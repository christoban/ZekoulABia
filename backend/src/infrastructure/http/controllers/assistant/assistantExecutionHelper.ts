import type { Request, Response } from 'express';
import { z } from 'zod';
import { messageErreur } from '@application/shared/messageErreur';
import {
  filterCatalogForUser,
  type ActionContext,
  type ActionDefinition,
} from '@infrastructure/assistant/catalog/catalogShared';
import type { AssistantContextQueryRepository } from '@domain/ports/repositories/AssistantContextQueryRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

/** Fenêtre pendant laquelle une action non-destructive reste annulable (5 minutes). */
const UNDO_WINDOW_MS = 5 * 60 * 1000;

/**
 * Détecte quand le modèle a recopié la description Zod d'un champ au lieu
 * d'une valeur réelle fournie par l'utilisateur.
 */
export function detecterParametreHallucine(
  action: ActionDefinition,
  input: Record<string, unknown>,
): string | null {
  const schema = action.inputSchema;
  if (!(schema instanceof z.ZodObject)) return null;
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') continue;
    const description = shape[key]?.description;
    if (!description) continue;
    const v = value.trim().toLowerCase();
    const d = description.trim().toLowerCase();
    if (v.length >= 8 && d.includes(v)) {
      return description;
    }
  }
  return null;
}

export interface AssistantActionHelperDeps {
  contextRepo: AssistantContextQueryRepository;
  catalog: ActionDefinition[];
  audit: AIActionAuditPort;
  buildContext: (req: Request) => ActionContext;
}

export async function executerConfirmationAction(
  req: Request,
  res: Response,
  deps: AssistantActionHelperDeps,
): Promise<void> {
  const user = req.user!;
  const { pendingActionId, confirmed } = req.body as { pendingActionId?: string; confirmed?: boolean };
  if (!pendingActionId) {
    res.status(400).json({ success: false, message: 'pendingActionId requis' });
    return;
  }

  const log = await deps.contextRepo.findActionLogById(pendingActionId);
  if (!log || log.schoolId !== user.schoolId) {
    res.status(404).json({ success: false, message: 'Action introuvable' });
    return;
  }
  if (log.status !== 'PENDING_CONFIRMATION') {
    res.status(409).json({ success: false, message: 'Cette action n\'est plus en attente de confirmation.' });
    return;
  }

  if (!confirmed) {
    await deps.contextRepo.updateActionLog(log.id, { status: 'CANCELLED' });
    res.json({ success: true, cancelled: true });
    return;
  }

  const allowed = filterCatalogForUser(deps.catalog, user);
  const action = allowed.find((a) => a.name === log.actionType);
  if (!action || !action.destructive) {
    deps.audit.journaliser({
      actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
      actionName: log.actionType, origin: 'AI_ASSISTANT', outcome: 'REFUSE',
      refusalReason: 'action_hors_catalogue_autorise', parametersSummary: log.parameters,
    });
    res.status(403).json({ success: false, message: 'Action non autorisée.' });
    return;
  }

  try {
    const r = await action.execute(log.parameters, deps.buildContext(req));
    await deps.contextRepo.updateActionLog(log.id, {
      status: 'EXECUTED', resultLabel: r.resultLabel, executedAt: new Date(),
    });
    deps.audit.journaliser({
      actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
      actionName: action.name, origin: 'AI_ASSISTANT', outcome: 'SUCCES', parametersSummary: log.parameters,
    });
    res.json({
      success: true,
      executed: { actionLogId: log.id, label: r.resultLabel, section: r.section ?? null, entity: r.entity ?? null },
    });
  } catch (e) {
    deps.audit.journaliser({
      actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
      actionName: action.name, origin: 'AI_ASSISTANT', outcome: 'ERREUR',
      refusalReason: messageErreur(e), parametersSummary: log.parameters,
    });
    res.status(400).json({ success: false, message: messageErreur(e) ?? 'Échec de la suppression.' });
  }
}

export async function executerAnnulationAction(
  req: Request,
  res: Response,
  deps: AssistantActionHelperDeps,
): Promise<void> {
  const user = req.user!;
  const { actionLogId } = req.body as { actionLogId?: string };
  if (!actionLogId) {
    res.status(400).json({ success: false, message: 'actionLogId requis' });
    return;
  }

  const log = await deps.contextRepo.findActionLogById(actionLogId);
  if (!log || log.schoolId !== user.schoolId) {
    res.status(404).json({ success: false, message: 'Action introuvable' });
    return;
  }
  if (log.status !== 'EXECUTED' || !log.undoable || log.destructive) {
    res.status(409).json({ success: false, message: 'Cette action ne peut pas être annulée.' });
    return;
  }
  if (Date.now() - new Date(log.executedAt).getTime() > UNDO_WINDOW_MS) {
    res.status(409).json({ success: false, message: 'La fenêtre d\'annulation (5 minutes) est dépassée.' });
    return;
  }

  const allowed = filterCatalogForUser(deps.catalog, user);
  const action = allowed.find((a) => a.name === log.actionType);
  if (!action) {
    res.status(403).json({ success: false, message: 'Action non autorisée.' });
    return;
  }

  const undoData = (log.undoData ?? {}) as Record<string, unknown>;
  try {
    await action.undo(log.parameters, undoData, deps.buildContext(req));
    await deps.contextRepo.updateActionLog(log.id, { status: 'UNDONE', undoneAt: new Date() });
    res.json({ success: true, undone: true, section: undoData.__section ?? null, entity: undoData.__entity ?? null });
  } catch (e) {
    res.status(400).json({ success: false, message: messageErreur(e) ?? 'Échec de l\'annulation.' });
  }
}

