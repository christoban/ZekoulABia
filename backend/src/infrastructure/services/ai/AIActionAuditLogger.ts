/**
 * INFRASTRUCTURE LAYER — Journal d'audit des actions sensibles (chantier "Sécurité de
 * l'assistant IA"). Source unique d'écriture dans AIActionAuditLog, appelée depuis
 * AssistantController (origin=AI_ASSISTANT) et, pour les actions du catalogue copilot qui ont
 * un équivalent en route HTTP classique, depuis ces mêmes contrôleurs (origin=UI_DIRECT) — pour
 * que la comparaison "même action, IA vs UI" (vue Sécurité plateforme) soit possible.
 *
 * Fire-and-forget, comme saveTurn()/notifier() ailleurs dans le projet : une panne du journal ne
 * doit jamais bloquer l'action métier elle-même.
 */
import type { PrismaClient, Prisma } from '@prisma/client';
import { messageErreur } from '@application/shared/messageErreur';

export type AIActionOrigin = 'UI_DIRECT' | 'AI_ASSISTANT';
export type AIActionOutcome = 'SUCCES' | 'REFUSE' | 'ERREUR';

export interface JournaliserActionParams {
  actorUserId: string;
  actorRole: string;
  schoolId?: string | null;
  actionName: string;
  targetType?: string | null;
  targetId?: string | null;
  origin: AIActionOrigin;
  outcome: AIActionOutcome;
  refusalReason?: string | null;
  parametersSummary?: unknown;
  /** Uniquement pour origin=AI_ASSISTANT : le message ayant déclenché l'appel. */
  triggeringMessage?: string | null;
}

// Rédaction défensive — le catalogue audité (section 1) ne manipule aujourd'hui aucun secret,
// mais un futur ajout d'action ne doit jamais pouvoir faire fuiter un mot de passe/jeton/OTP
// dans ce journal, même par erreur, même dans un cas refusé.
const CLES_SENSIBLES = /password|motdepasse|mot_de_passe|secret|token|jeton|otp|pin|credential|identifiant/i;

function sanitizeParams(params: unknown): Record<string, unknown> | undefined {
  if (!params || typeof params !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    out[k] = CLES_SENSIBLES.test(k) ? '[rédigé]' : v;
  }
  return out;
}

export function journaliserActionIA(prisma: PrismaClient, params: JournaliserActionParams): void {
  prisma.aIActionAuditLog
    .create({
      data: {
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        schoolId: params.schoolId ?? undefined,
        actionName: params.actionName,
        targetType: params.targetType ?? undefined,
        targetId: params.targetId ?? undefined,
        origin: params.origin,
        outcome: params.outcome,
        refusalReason: params.refusalReason ?? undefined,
        // parametersSummary est délibérément `unknown` côté appelant (dizaines de sites, formes
        // variées) — sanitizeParams() ne fait que rédiger les clés sensibles, le résultat reste
        // un simple objet de résumé (primitives), jamais une valeur non sérialisable en JSON.
        parametersSummary: sanitizeParams(params.parametersSummary) as Prisma.InputJsonValue | undefined,
        triggeringMessage: params.triggeringMessage ?? undefined,
      },
    })
    .catch((e) => console.error('[AIActionAuditLog]', messageErreur(e)));
}
