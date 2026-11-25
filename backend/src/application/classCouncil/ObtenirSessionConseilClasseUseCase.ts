import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import { resolveRiskAlertLevel } from '@domain/policies/StudentRiskAlertPolicy';

export interface ObtenirSessionCommande {
  sessionId: string;
  schoolId: string;
  userRole: string;
  userId: string;
}

export class ObtenirSessionConseilClasseUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: ObtenirSessionCommande) {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) return null;

    const config = await this.repo.obtenirConfigAlertes(commande.schoolId);
    const warningThreshold = config?.aiRiskThreshold ?? 50;
    const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

    const decisions = (session.decisions ?? []).map(d => {
      const score = d.student?.studentProfile?.healthScore ?? 75;
      const { studentProfile, ...studentSansProfile } = d.student ?? {};
      return {
        ...d,
        student: studentSansProfile,
        healthScore: score,
        alertLevel: resolveRiskAlertLevel(score, warningThreshold, criticalThreshold),
      };
    });

    const role = commande.userRole.toUpperCase();

    if (role === 'STUDENT') {
      const myDecision = decisions.find(d => d.studentId === commande.userId);
      return { session: { ...session, decisions: myDecision ? [myDecision] : [] } };
    }

    if (role === 'PARENT') {
      const childIds = await this.repo.obtenirEnfantsParent(commande.userId);
      return { session: { ...session, decisions: decisions.filter(d => childIds.includes(d.studentId)) } };
    }

    return { session: { ...session, decisions } };
  }
}
