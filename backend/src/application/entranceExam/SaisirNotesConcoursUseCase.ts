import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import { EntranceExamScoringEngine } from '@domain/services/EntranceExamScoringEngine';

export interface SaisieNoteItem {
  subjectId: string;
  score?: number | null;
  isAbsent?: boolean;
}

export interface SaisirNotesCandidatCommande {
  schoolId: string;
  sessionId: string;
  candidateId: string;
  notes: SaisieNoteItem[];
}

export interface SaisirNotesCandidatResultat {
  candidateId: string;
  candidateNumber: string | null;
  totalAverage: number | null;
  isComplete: boolean;
  isEliminated: boolean;
  eliminationReason?: string;
}

export class SaisirNotesConcoursUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: SaisirNotesCandidatCommande): Promise<SaisirNotesCandidatResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const candidat = await this.entranceRepository.trouverCandidatAvecSession(cmd.candidateId);
    if (!candidat || candidat.sessionId !== cmd.sessionId) {
      throw new Error('Candidat introuvable dans cette session');
    }

    const subjects = this.entranceRepository.listerMatieres
      ? await this.entranceRepository.listerMatieres(cmd.sessionId)
      : [];

    if (subjects.length === 0) {
      throw new Error('Aucune épreuve n a été configurée pour cette session');
    }

    // Validation des bornes de chaque note
    for (const n of cmd.notes) {
      const subj = subjects.find(s => s.id === n.subjectId);
      if (!subj) {
        throw new Error(`Épreuve introuvable pour l'identifiant ${n.subjectId}`);
      }

      if (!n.isAbsent && n.score !== null && n.score !== undefined) {
        if (n.score < 0 || n.score > subj.maxScore) {
          throw new Error(
            `Note invalide pour ${subj.name} : ${n.score} (doit être comprise entre 0 et ${subj.maxScore})`
          );
        }
      }
    }

    // Sauvegarde des notes saisies
    if (this.entranceRepository.sauvegarderNotesCandidat) {
      await this.entranceRepository.sauvegarderNotesCandidat(cmd.candidateId, cmd.notes);
    }

    // Rechargement des notes consolidées
    const candidatMisAJour = await this.entranceRepository.trouverCandidatAvecSession(cmd.candidateId);
    const notesConsolidees = candidatMisAJour?.grades?.map(g => ({
      subjectId: g.subjectId,
      score: g.score,
      isAbsent: g.isAbsent,
    })) || cmd.notes;

    // Évaluation par le moteur de notation
    const evaluation = EntranceExamScoringEngine.evaluerCandidat(
      {
        candidateId: cmd.candidateId,
        dateOfBirth: candidat.dateOfBirth,
        grades: notesConsolidees,
      },
      subjects
    );

    // Mise à jour de la moyenne du candidat
    if (this.entranceRepository.mettreAJourScoreEtRangCandidat) {
      await this.entranceRepository.mettreAJourScoreEtRangCandidat(
        cmd.candidateId,
        evaluation.totalAverage,
        candidat.rank ?? null
      );
    }

    // Transition d'état de la session vers GRADING si approprié
    const statutsAvantGrading = ['DRAFT', 'REGISTRATION_OPEN', 'SEATS_ASSIGNED', 'IN_PROGRESS'];
    if (statutsAvantGrading.includes(session.status)) {
      await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'GRADING');
    }

    return {
      candidateId: cmd.candidateId,
      candidateNumber: candidat.candidateNumber ?? null,
      totalAverage: evaluation.totalAverage,
      isComplete: evaluation.isComplete,
      isEliminated: evaluation.isEliminated,
      eliminationReason: evaluation.eliminationReason,
    };
  }
}
