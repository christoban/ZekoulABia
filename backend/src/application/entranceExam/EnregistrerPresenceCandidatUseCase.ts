import type {
  EntranceExamRepository,
  CandidatePresence,
} from '@domain/ports/repositories/EntranceExamRepository';

export interface EnregistrerPresenceCommande {
  schoolId: string;
  sessionId: string;
  candidateId: string;
  presenceStatus: CandidatePresence;
}

export interface EnregistrerPresenceResultat {
  success: boolean;
  candidateId: string;
  presenceStatus: CandidatePresence;
}

export class EnregistrerPresenceCandidatUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: EnregistrerPresenceCommande): Promise<EnregistrerPresenceResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const candidat = await this.entranceRepository.trouverCandidatAvecSession(cmd.candidateId);
    if (!candidat || candidat.sessionId !== cmd.sessionId) {
      throw new Error('Candidat introuvable dans cette session de concours');
    }

    const presencesValides: CandidatePresence[] = ['PRESENT', 'ABSENT', 'ABANDON'];
    if (!presencesValides.includes(cmd.presenceStatus)) {
      throw new Error(`Statut de présence invalide : ${cmd.presenceStatus}`);
    }

    if (this.entranceRepository.enregistrerPresenceCandidat) {
      await this.entranceRepository.enregistrerPresenceCandidat(cmd.candidateId, cmd.presenceStatus);
    }

    return {
      success: true,
      candidateId: cmd.candidateId,
      presenceStatus: cmd.presenceStatus,
    };
  }
}
