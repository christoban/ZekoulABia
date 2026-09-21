import type {
  EntranceExamRepository,
  EntranceCandidateData,
} from '@domain/ports/repositories/EntranceExamRepository';

export interface ItemSaisieLotCep {
  candidateId?: string;
  candidateNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | Date;
  cepResult: 'REUSSI' | 'ECHOUE';
}

export interface ProposerSaisieLotCepCommande {
  schoolId: string;
  sessionId: string;
  items: ItemSaisieLotCep[];
}

export interface CandidatRapproche {
  candidateId: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  currentStatus: string;
  proposedStatus: 'CONFIRME' | 'ANNULE';
  cepResult: 'REUSSI' | 'ECHOUE';
  parentPhone: string | null;
}

export interface CandidatNonRapproche {
  item: ItemSaisieLotCep;
  motif: string;
}

export interface CandidatPromotion {
  candidateId: string;
  firstName: string;
  lastName: string;
  rank: number | null;
  examScore: number | null;
  parentPhone: string | null;
}

export interface PropositionSaisieLotCepResult {
  rapproches: CandidatRapproche[];
  nonRapproches: CandidatNonRapproche[];
  places: {
    totalProvisoires: number;
    reussis: number;
    echoues: number;
    placesLiberees: number;
  };
  promotionsProposees: CandidatPromotion[];
}

export class ProposerSaisieLotCepUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(cmd: ProposerSaisieLotCepCommande): Promise<PropositionSaisieLotCepResult> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const tousCandidats = await this.entranceRepository.listerCandidats(cmd.sessionId);
    const candidatsProvisoires = tousCandidats.filter(
      (c) => c.admissionStatus === 'ADMIS_PROVISOIRE'
    );
    const candidatsListeAttente = tousCandidats
      .filter((c) => c.admissionStatus === 'LISTE_ATTENTE')
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (b.examScore ?? 0) - (a.examScore ?? 0));

    const rapproches: CandidatRapproche[] = [];
    const nonRapproches: CandidatNonRapproche[] = [];

    const normalize = (str?: string | null) =>
      str ? str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

    for (const item of cmd.items) {
      let matchedCand: EntranceCandidateData | undefined;

      // 1. Recherche par ID direct
      if (item.candidateId) {
        matchedCand = tousCandidats.find((c) => c.id === item.candidateId);
      }

      // 2. Recherche par numéro de candidat
      if (!matchedCand && item.candidateNumber) {
        matchedCand = tousCandidats.find(
          (c) => normalize(c.candidateNumber) === normalize(item.candidateNumber)
        );
      }

      // 3. Recherche par Nom + Prénom (+ date de naissance si présente)
      if (!matchedCand && item.lastName) {
        const itemNom = normalize(item.lastName);
        const itemPrenom = normalize(item.firstName);

        matchedCand = tousCandidats.find((c) => {
          const cNom = normalize(c.lastName);
          const cPrenom = normalize(c.firstName);
          const nomMatch =
            (cNom === itemNom && (!itemPrenom || cPrenom.includes(itemPrenom))) ||
            (cNom.includes(itemNom) && cPrenom === itemPrenom);

          if (!nomMatch) return false;

          // Si date de naissance fournie dans le fichier, vérifier l'année ou la date
          if (item.dateOfBirth && c.dateOfBirth) {
            const itemDob = new Date(item.dateOfBirth);
            const cDob = new Date(c.dateOfBirth);
            if (!isNaN(itemDob.getTime()) && !isNaN(cDob.getTime())) {
              return itemDob.getFullYear() === cDob.getFullYear();
            }
          }
          return true;
        });
      }

      if (!matchedCand) {
        nonRapproches.push({
          item,
          motif: 'Aucun candidat correspondant trouvé dans cette session',
        });
        continue;
      }

      if (matchedCand.admissionStatus !== 'ADMIS_PROVISOIRE') {
        nonRapproches.push({
          item,
          motif: `Statut actuel invalide (${matchedCand.admissionStatus}) : seuls les candidats ADMIS_PROVISOIRE peuvent recevoir un résultat`,
        });
        continue;
      }

      rapproches.push({
        candidateId: matchedCand.id,
        candidateNumber: matchedCand.candidateNumber ?? null,
        firstName: matchedCand.firstName,
        lastName: matchedCand.lastName,
        currentStatus: matchedCand.admissionStatus,
        proposedStatus: item.cepResult === 'REUSSI' ? 'CONFIRME' : 'ANNULE',
        cepResult: item.cepResult,
        parentPhone: matchedCand.parentPhone ?? null,
      });
    }

    const reussis = rapproches.filter((r) => r.cepResult === 'REUSSI').length;
    const echoues = rapproches.filter((r) => r.cepResult === 'ECHOUE').length;
    const placesLiberees = echoues;

    // Proposer la promotion des N premiers candidats de la liste d'attente
    const promotionsProposees: CandidatPromotion[] = candidatsListeAttente
      .slice(0, placesLiberees)
      .map((c) => ({
        candidateId: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        rank: c.rank ?? null,
        examScore: c.examScore ?? null,
        parentPhone: c.parentPhone ?? null,
      }));

    return {
      rapproches,
      nonRapproches,
      places: {
        totalProvisoires: candidatsProvisoires.length,
        reussis,
        echoues,
        placesLiberees,
      },
      promotionsProposees,
    };
  }
}
