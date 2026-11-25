import type { AIActionAuditQueryPort } from '@domain/ports/repositories/AIActionAuditQueryPort';
import type { EmailService } from '@domain/ports/services/EmailService';
import { prisma } from '../../config/prisma.ts';

const FENETRE_ALERTE_MS = 10 * 60 * 1000;
const SEUIL_REFUS = 3;

export interface DetecterPatternSuspicieuxParams {
  schoolId?: string;
}

export interface DetecterPatternSuspicieuxResult {
  detected: boolean;
  alertedUsers: string[];
}

export class DetecterPatternSuspicieuxUseCase {
  constructor(
    private readonly auditQueryPort: AIActionAuditQueryPort,
    private readonly emailService: EmailService,
  ) {}

  async execute(params: DetecterPatternSuspicieuxParams = {}): Promise<DetecterPatternSuspicieuxResult> {
    const depuis = new Date(Date.now() - FENETRE_ALERTE_MS);

    let recent = await this.auditQueryPort.findRecent(depuis);

    if (params.schoolId) {
      recent = recent.filter((e) => e.schoolId === params.schoolId);
    }

    const byActor = new Map<string, typeof recent>();
    for (const e of recent) {
      const list = byActor.get(e.actorUserId) ?? [];
      list.push(e);
      byActor.set(e.actorUserId, list);
    }

    const groupes = [...byActor.entries()].filter(([, entries]) => entries.length >= SEUIL_REFUS);
    if (groupes.length === 0) return { detected: false, alertedUsers: [] };

    const operateurs = await prisma.masterUser.findMany({
      where: { isSuperAdmin: true },
      select: { id: true, email: true, name: true },
    });
    if (operateurs.length === 0) return { detected: false, alertedUsers: [] };

    const alertedUsers: string[] = [];

    for (const [actorUserId, entries] of groupes) {
      const dejaAlerte = await prisma.aISecurityAlert.findFirst({
        where: { actorUserId, notifiedAt: { gte: depuis } },
      });
      if (dejaAlerte) continue;

      const dernieresEntrees = [...entries]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);

      const actorRole = dernieresEntrees[0]?.actorRole ?? 'INCONNU';
      const schoolId = dernieresEntrees[0]?.schoolId ?? null;
      const refuseCount = entries.length;

      await prisma.aISecurityAlert.create({
        data: { actorUserId, actorRole, schoolId, refuseCount },
      });

      const detail = dernieresEntrees
        .map((e) => `- ${e.actionName} (${e.origin}) — ${e.refusalReason ?? 'sans motif'}`)
        .join('<br>');

      for (const operateur of operateurs) {
        if (!operateur.email) continue;
        await this.emailService.envoyer({
          destinataire: operateur.email,
          sujet: `[Sécurité IA] ${refuseCount} actions refusées en 10 min — utilisateur ${actorUserId}`,
          contenuHtml: `<p>Bonjour ${operateur.name ?? ''},<br><br>L'utilisateur <b>${actorUserId}</b> (rôle ${actorRole}${schoolId ? `, établissement ${schoolId}` : ''}) a déclenché <b>${refuseCount} refus</b> en moins de 10 minutes.</p><p>${detail}</p><p>Consultez la vue Sécurité plateforme pour le détail complet.</p>`,
          contenuTexte: `${refuseCount} actions refusées en 10 min pour l'utilisateur ${actorUserId} (rôle ${actorRole}).`,
          eventType: 'ai_security_suspicious_pattern',
        });
      }

      alertedUsers.push(actorUserId);
    }

    return { detected: alertedUsers.length > 0, alertedUsers };
  }
}
