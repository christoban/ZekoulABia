import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export interface VerrouillerCommande {
  sessionId: string;
  schoolId: string;
  userId: string;
}

export class VerrouillerConseilClasseUseCase {
  constructor(
    private readonly repo: ClassCouncilRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(commande: VerrouillerCommande) {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) throw new Error('Session introuvable');
    if (session.status === 'LOCKED') throw new Error('Session déjà verrouillée');

    const decisionCount = await this.repo.compterDecisions(commande.sessionId);
    if (decisionCount === 0) throw new Error('Impossible de verrouiller une session sans décisions');

    const updated = await this.repo.verrouillerSession(commande.sessionId);

    this.activityLog.log({
      userId: commande.userId,
      schoolId: commande.schoolId,
      action: 'Class council session locked',
      details: `Session ${commande.sessionId}`,
    });

    return { session: updated, message: 'Session verrouillée' };
  }
}
