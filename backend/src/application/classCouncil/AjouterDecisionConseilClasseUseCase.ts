import type { CouncilDecision } from '@domain/types/enums';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import { isValidDecision } from '@domain/policies/ClassCouncilDecisionPolicy';

export interface AjouterDecisionCommande {
  sessionId: string;
  studentId: string;
  decision: string;
  observations?: string | null;
  schoolId: string;
}

export class AjouterDecisionConseilClasseUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: AjouterDecisionCommande) {
    if (!isValidDecision(commande.decision)) {
      throw new Error(`decision doit être : PASS, REPEAT, DELIBERATION (reçu "${commande.decision}")`);
    }

    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) throw new Error('Session introuvable');
    if (session.status === 'LOCKED') throw new Error('Cette session est verrouillée. Aucune modification possible.');

    const belongs = await this.repo.eleveDansClasse(commande.studentId, session.classId);
    if (!belongs) throw new Error("Cet élève n'appartient pas à cette classe");

    const decision = await this.repo.upsertDecision(
      commande.sessionId,
      commande.studentId,
      commande.decision as CouncilDecision,
      commande.observations,
    );

    return { decision };
  }
}
