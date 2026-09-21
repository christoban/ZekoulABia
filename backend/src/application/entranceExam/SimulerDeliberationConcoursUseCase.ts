import type {
  EntranceExamRepository,
  EntranceAdmissionStatus,
} from '@domain/ports/repositories/EntranceExamRepository';
import {
  EntranceExamScoringEngine,
  type DeliberationSimulationOutcome,
} from '@domain/services/EntranceExamScoringEngine';

export interface SimulerDeliberationCommande {
  schoolId: string;
  sessionId: string;
  admissionThreshold?: number | null;
  availableSeats?: number | null;
  waitingListSeats?: number | null;
  appliquer?: boolean;
}

export interface SimulerDeliberationResultat {
  outcome: DeliberationSimulationOutcome;
  applied: boolean;
}

export class SimulerDeliberationConcoursUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: SimulerDeliberationCommande): Promise<SimulerDeliberationResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const subjects = this.entranceRepository.listerMatieres
      ? await this.entranceRepository.listerMatieres(cmd.sessionId)
      : [];

    const candidats = await this.entranceRepository.listerCandidats(cmd.sessionId);
    if (candidats.length === 0) {
      throw new Error('Aucun candidat inscrit dans cette session');
    }

    // Évaluation de chaque candidat
    const evaluatedCandidates = candidats.map((cand) => {
      const gradesInput = cand.grades?.map((g) => ({
        subjectId: g.subjectId,
        score: g.score,
        isAbsent: g.isAbsent,
      })) || [];

      return EntranceExamScoringEngine.evaluerCandidat(
        {
          candidateId: cand.id,
          dateOfBirth: cand.dateOfBirth,
          grades: gradesInput,
        },
        subjects
      );
    });

    // Classement officiel
    const rankedCandidates = EntranceExamScoringEngine.classerCandidats(evaluatedCandidates, subjects);

    // Mettre à jour le rang et la moyenne en base pour chaque candidat
    if (this.entranceRepository.mettreAJourScoreEtRangCandidat) {
      for (const rc of rankedCandidates) {
        await this.entranceRepository.mettreAJourScoreEtRangCandidat(
          rc.candidateId,
          rc.totalAverage,
          rc.rank ?? null
        );
      }
    }

    // Paramètres effectifs
    const threshold = cmd.admissionThreshold !== undefined && cmd.admissionThreshold !== null
      ? cmd.admissionThreshold
      : session.admissionThreshold;

    const seats = cmd.availableSeats !== undefined && cmd.availableSeats !== null
      ? cmd.availableSeats
      : session.availableSeats;

    const waitingSeats = cmd.waitingListSeats ?? 0;

    // Simulation
    const outcome = EntranceExamScoringEngine.simulerDeliberation({
      scoredCandidates: rankedCandidates,
      availableSeats: seats,
      admissionThreshold: threshold,
      waitingListSeats: waitingSeats,
    });

    let applied = false;

    // Si confirmation d'application
    if (cmd.appliquer && this.entranceRepository.appliquerDeliberation) {
      const days = session.seatReservationDays || 14;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const admissions: { candidateId: string; status: EntranceAdmissionStatus; reservationExpiresAt?: Date | null }[] = [];

      for (const admId of outcome.admisIds) {
        // Si le CEP est obligatoire et non réussi, admission provisoire, sinon ADMIS
        const candData = candidats.find(c => c.id === admId);
        const status: EntranceAdmissionStatus = session.requireCepForAdmission && candData?.cepResult !== 'REUSSI'
          ? 'ADMIS_PROVISOIRE'
          : 'ADMIS';

        admissions.push({
          candidateId: admId,
          status,
          reservationExpiresAt: expiresAt,
        });
      }

      for (const wId of outcome.listeAttenteIds) {
        admissions.push({
          candidateId: wId,
          status: 'LISTE_ATTENTE',
          reservationExpiresAt: null,
        });
      }

      for (const refId of outcome.refusesIds) {
        admissions.push({
          candidateId: refId,
          status: 'REFUSE',
          reservationExpiresAt: null,
        });
      }

      await this.entranceRepository.appliquerDeliberation(cmd.sessionId, admissions);
      await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'DELIBERATION', {
        deliberatedAt: new Date(),
      });
      applied = true;
    }

    return {
      outcome,
      applied,
    };
  }
}
