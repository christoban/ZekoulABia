/**
 * APPLICATION — Use case : tenir un Conseil de Discipline déjà convoqué et acter sa décision.
 * Revérifie le délai légal de 72h AU MOMENT DE LA TENUE (pas seulement à la convocation) —
 * empêche de contourner la règle en convoquant avec une date lointaine puis en tenant le
 * conseil immédiatement quand même. C'est cette vérification-ci, pas celle de la convocation,
 * qui protège réellement contre le contournement.
 */
import type { DisciplineRepository } from '@domain/ports/repositories/DisciplineRepository';

const DELAI_LEGAL_HEURES = 72;

export interface TenirConseilDisciplineCommande {
  schoolId: string;
  sessionId: string;
  decision: 'COUNCIL_DECISION' | 'PERMANENT_EXCLUSION';
  pv: string;
  startDate?: Date;
  endDate?: Date;
}

export class TenirConseilDisciplineUseCase {
  constructor(private readonly disciplineRepository: DisciplineRepository) {}

  async execute(cmd: TenirConseilDisciplineCommande) {
    const session = await this.disciplineRepository.trouverSession(cmd.sessionId, cmd.schoolId);
    if (!session) throw new Error('Conseil de discipline introuvable.');
    if (session.status !== 'CONVOQUE') {
      throw new Error('Ce conseil a déjà été tenu ou annulé.');
    }
    if (!cmd.pv.trim()) {
      throw new Error('Le procès-verbal (PV) est requis pour acter la décision.');
    }

    const now = new Date();
    const delaiMs = DELAI_LEGAL_HEURES * 60 * 60 * 1000;
    if (now.getTime() - new Date(session.parentNotifiedAt).getTime() < delaiMs) {
      throw new Error(
        `Impossible de tenir ce conseil maintenant : le délai légal de ${DELAI_LEGAL_HEURES}h depuis la ` +
        `convocation des parents (Art. 30) n'est pas encore écoulé.`
      );
    }

    const record = await this.disciplineRepository.creerRecord({
      schoolId: cmd.schoolId,
      studentId: session.studentId,
      type: cmd.decision,
      reason: session.motif,
      decidedById: session.presidedById,
      ...(cmd.startDate ? { startDate: cmd.startDate } : {}),
      ...(cmd.endDate ? { endDate: cmd.endDate } : {}),
    });

    return this.disciplineRepository.mettreAJourSession(session.id, {
      heldAt: now,
      decision: cmd.decision,
      pv: cmd.pv.trim(),
      status: 'TENU',
      disciplineRecordId: record.id,
    });
  }
}
