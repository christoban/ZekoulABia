import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';

export interface ConsulterResultatPublicCommande {
  sessionId: string;
  candidateNumber: string;
  dateOfBirth: Date;
}

export interface ResultatPublicConsultation {
  candidateNumber: string;
  candidateFullName: string;
  admissionStatus: string;
  totalAverage: number | null;
  rank: number | null;
  grades: { subjectName: string; score: number | null; maxScore: number }[];
  reservationExpiresAt: Date | null;
  message: string;
}

export class ConsulterResultatPublicUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: ConsulterResultatPublicCommande): Promise<ResultatPublicConsultation> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session) {
      throw new Error('Session de concours introuvable');
    }

    if (session.status !== 'PUBLISHED' && session.status !== 'CLOSED') {
      throw new Error('Les résultats de cette session de concours ne sont pas encore publiés');
    }

    if (!this.entranceRepository.trouverCandidatParCodeEtDateNaissance) {
      throw new Error('Fonctionnalité de recherche de candidat non disponible');
    }

    const cand = await this.entranceRepository.trouverCandidatParCodeEtDateNaissance(
      cmd.sessionId,
      cmd.candidateNumber,
      cmd.dateOfBirth
    );

    if (!cand) {
      throw new Error('Aucun candidat ne correspond au code et à la date de naissance saisis');
    }

    let message = '';
    const expiryStr = cand.reservationExpiresAt
      ? new Date(cand.reservationExpiresAt).toLocaleDateString('fr-FR')
      : null;

    switch (cand.admissionStatus) {
      case 'ADMIS':
        message = expiryStr
          ? `Félicitations ! Vous êtes admis(e). Veuillez confirmer votre inscription avant le ${expiryStr}.`
          : 'Félicitations ! Vous êtes admis(e) au concours d\'entrée.';
        break;
      case 'ADMIS_PROVISOIRE':
        message = 'Félicitations ! Vous êtes admis(e) sous réserve de présentation de votre attestation de réussite au CEP.';
        break;
      case 'LISTE_ATTENTE':
        message = `Vous êtes inscrit(e) sur la liste d'attente${cand.rank ? ` (rang ${cand.rank})` : ''}. Vous serez contacté(e) en cas de désistement.`;
        break;
      case 'REFUSE':
        message = 'Le candidat n\'a pas été retenu pour cette session de concours.';
        break;
      case 'INSCRIT':
        message = 'Votre dossier d\'inscription a été validé avec succès.';
        break;
      default:
        message = 'Résultat en cours de traitement.';
    }

    const grades = (cand.grades || []).map((g) => ({
      subjectName: g.subject?.name || 'Épreuve',
      score: g.score,
      maxScore: g.subject?.maxScore || 20,
    }));

    return {
      candidateNumber: cand.candidateNumber || cmd.candidateNumber,
      candidateFullName: `${cand.firstName} ${cand.lastName}`,
      admissionStatus: cand.admissionStatus,
      totalAverage: cand.totalAverage,
      rank: cand.rank ?? null,
      grades,
      reservationExpiresAt: cand.reservationExpiresAt,
      message,
    };
  }
}
