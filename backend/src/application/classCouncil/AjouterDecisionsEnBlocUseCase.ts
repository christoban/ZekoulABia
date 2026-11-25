import type { CouncilDecision } from '@domain/types/enums';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import { isValidDecision } from '@domain/policies/ClassCouncilDecisionPolicy';

export interface AjouterDecisionsEnBlocCommande {
  sessionId: string;
  decisions: { studentId: string; decision: string; observations?: string }[];
  schoolId: string;
}

export class AjouterDecisionsEnBlocUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: AjouterDecisionsEnBlocCommande) {
    if (!commande.decisions.length) throw new Error('decisions (tableau) est requis');

    const invalide = commande.decisions.find(d => !isValidDecision(d.decision));
    if (invalide) {
      throw new Error(`decision doit être : PASS, REPEAT, DELIBERATION (reçu "${invalide.decision}" pour l'élève ${invalide.studentId})`);
    }

    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) throw new Error('Session introuvable');
    if (session.status === 'LOCKED') throw new Error('Session verrouillée');

    const count = await this.repo.upsertDecisionsEnBloc(
      commande.sessionId,
      commande.decisions.map(d => ({
        studentId: d.studentId,
        decision: d.decision as CouncilDecision,
        observations: d.observations,
      })),
    );

    return { message: `${count} décision(s) enregistrée(s)`, count };
  }
}
