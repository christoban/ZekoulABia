import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import { CandidateCodeGenerator } from '@domain/services/CandidateCodeGenerator';

export interface InscrireCandidatCommande {
  schoolId: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
  originSchool?: string | null;
  parentPhone?: string | null;
  schoolCodeOrName?: string;
}

export interface InscrireCandidatResultat {
  candidateId: string;
  candidateNumber: string;
  firstName: string;
  lastName: string;
}

export class InscrireCandidatConcoursUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: InscrireCandidatCommande): Promise<InscrireCandidatResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    // Vérifier la date limite si configurée
    if (session.registrationDeadline && new Date() > new Date(session.registrationDeadline)) {
      throw new Error('La date limite des inscriptions pour ce concours est dépassée');
    }

    // Vérifier le statut de la session
    const statutsPermis = ['DRAFT', 'REGISTRATION_OPEN'];
    if (!statutsPermis.includes(session.status)) {
      throw new Error(`Les inscriptions ne sont plus acceptées pour cette session (statut: ${session.status})`);
    }

    // Détection de doublons (nom, prénom et date de naissance)
    const candidatsExistants = await this.entranceRepository.listerCandidats(cmd.sessionId);
    const nomNorm = cmd.lastName.trim().toLowerCase();
    const prenomNorm = cmd.firstName.trim().toLowerCase();

    const doublon = candidatsExistants.find((c) => {
      const matchNom = c.lastName.trim().toLowerCase() === nomNorm;
      const matchPrenom = c.firstName.trim().toLowerCase() === prenomNorm;
      if (!matchNom || !matchPrenom) return false;

      // Si date de naissance présente chez les deux, comparer
      if (cmd.dateOfBirth && c.dateOfBirth) {
        return new Date(cmd.dateOfBirth).toDateString() === new Date(c.dateOfBirth).toDateString();
      }
      return true;
    });

    if (doublon) {
      throw new Error(
        `Un candidat portant le même nom et prénom est déjà inscrit sous le code ${doublon.candidateNumber ?? doublon.id}`
      );
    }

    // Générer le code candidat unique
    const count = this.entranceRepository.trouverDernierNumeroSequence
      ? await this.entranceRepository.trouverDernierNumeroSequence(cmd.sessionId)
      : candidatsExistants.length;
    const seq = count + 1;
    const schoolRef = cmd.schoolCodeOrName || session.name || 'CONCOURS';
    const candidateNumber = CandidateCodeGenerator.genererCode(schoolRef, seq);

    const candidatCree = await this.entranceRepository.creerCandidat({
      sessionId: cmd.sessionId,
      candidateNumber,
      firstName: cmd.firstName.trim(),
      lastName: cmd.lastName.trim(),
      dateOfBirth: cmd.dateOfBirth ?? null,
      originSchool: cmd.originSchool?.trim() ?? null,
      parentPhone: cmd.parentPhone?.trim() ?? null,
    });

    return {
      candidateId: candidatCree.id,
      candidateNumber: candidatCree.candidateNumber ?? candidateNumber,
      firstName: cmd.firstName.trim(),
      lastName: cmd.lastName.trim(),
    };
  }
}
