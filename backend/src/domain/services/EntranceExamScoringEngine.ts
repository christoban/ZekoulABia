/**
 * EntranceExamScoringEngine — Moteur de notation, classement et simulation de délibération des concours
 * Conforme aux pratiques scolaires camerounaises (pondération, notes éliminatoires, départage ex æquo, tranches de distribution)
 */

export interface SubjectConfig {
  id: string;
  name: string;
  coefficient: number;
  maxScore: number;
  eliminatoryScore?: number | null;
  orderIndex?: number;
}

export interface CandidateGradeInput {
  subjectId: string;
  score?: number | null;
  isAbsent?: boolean;
}

export interface CandidateEvaluationInput {
  candidateId: string;
  dateOfBirth?: Date | null;
  grades: CandidateGradeInput[];
}

export interface CandidateSubjectResult {
  subjectId: string;
  subjectName: string;
  rawScore: number | null;
  maxScore: number;
  normalizedScore: number | null; // ramené sur 20
  coefficient: number;
  isAbsent: boolean;
  isEliminatory: boolean;
}

export interface CandidateScoredResult {
  candidateId: string;
  totalAverage: number | null; // moyenne générale sur 20
  isComplete: boolean;
  isEliminated: boolean;
  eliminationReason?: string;
  subjectResults: CandidateSubjectResult[];
  dateOfBirth?: Date | null;
  rank?: number;
}

export interface DeliberationSimulationParams {
  scoredCandidates: CandidateScoredResult[];
  availableSeats?: number | null;
  admissionThreshold?: number | null;
  waitingListSeats?: number | null;
}

export interface DeliberationSimulationOutcome {
  admisIds: string[];
  listeAttenteIds: string[];
  refusesIds: string[];
  effectiveThreshold: number | null;
  cutOffTieDetected: boolean;
  tieCandidateIdsAtCutOff: string[];
  totalCandidates: number;
  admisCount: number;
  listeAttenteCount: number;
  refusesCount: number;
  eliminatedCount: number;
  gradeDistribution: { range: string; count: number }[];
}

export class EntranceExamScoringEngine {
  /**
   * Calcule la moyenne pondérée et détecte les notes éliminatoires pour un candidat
   */
  public static evaluerCandidat(
    candidat: CandidateEvaluationInput,
    subjects: SubjectConfig[]
  ): CandidateScoredResult {
    if (!subjects || subjects.length === 0) {
      return {
        candidateId: candidat.candidateId,
        totalAverage: null,
        isComplete: false,
        isEliminated: false,
        subjectResults: [],
        dateOfBirth: candidat.dateOfBirth,
      };
    }

    const gradeMap = new Map<string, CandidateGradeInput>();
    for (const g of candidat.grades) {
      gradeMap.set(g.subjectId, g);
    }

    let totalPoints = 0;
    let totalCoeffs = 0;
    let isComplete = true;
    let isEliminated = false;
    let eliminationReason: string | undefined;

    const subjectResults: CandidateSubjectResult[] = [];

    for (const subj of subjects) {
      const entry = gradeMap.get(subj.id);
      const isAbsent = entry?.isAbsent ?? false;
      const rawScore = entry?.score ?? null;

      let normalizedScore: number | null = null;
      let isSubjectEliminatory = false;

      if (isAbsent) {
        normalizedScore = 0;
        if (subj.eliminatoryScore !== null && subj.eliminatoryScore !== undefined && 0 < subj.eliminatoryScore) {
          isSubjectEliminatory = true;
          isEliminated = true;
          eliminationReason = `Absent à l'épreuve éliminatoire : ${subj.name}`;
        }
      } else if (rawScore !== null && rawScore !== undefined) {
        const clampedScore = Math.max(0, Math.min(subj.maxScore, rawScore));
        normalizedScore = Math.round(((clampedScore / subj.maxScore) * 20) * 100) / 100;

        if (
          subj.eliminatoryScore !== null &&
          subj.eliminatoryScore !== undefined &&
          normalizedScore < subj.eliminatoryScore
        ) {
          isSubjectEliminatory = true;
          isEliminated = true;
          eliminationReason = `Note éliminatoire en ${subj.name} (${normalizedScore}/20 < ${subj.eliminatoryScore}/20)`;
        }
      } else {
        isComplete = false;
      }

      subjectResults.push({
        subjectId: subj.id,
        subjectName: subj.name,
        rawScore,
        maxScore: subj.maxScore,
        normalizedScore,
        coefficient: subj.coefficient,
        isAbsent,
        isEliminatory: isSubjectEliminatory,
      });

      if (normalizedScore !== null) {
        totalPoints += normalizedScore * subj.coefficient;
        totalCoeffs += subj.coefficient;
      }
    }

    const totalAverage =
      totalCoeffs > 0 && isComplete
        ? Math.round((totalPoints / totalCoeffs) * 100) / 100
        : null;

    return {
      candidateId: candidat.candidateId,
      totalAverage,
      isComplete,
      isEliminated,
      eliminationReason,
      subjectResults,
      dateOfBirth: candidat.dateOfBirth,
    };
  }

  /**
   * Classe les candidats avec gestion du départage d'ex æquo :
   * 1. Moyenne générale décroissante
   * 2. Éliminés en fin de liste
   * 3. Départage par note de l'épreuve au coefficient le plus élevé
   * 4. Départage par l'âge (le candidat le plus jeune en premier)
   */
  public static classerCandidats(
    candidatsScores: CandidateScoredResult[],
    subjects: SubjectConfig[]
  ): CandidateScoredResult[] {
    // Trier les matières par coefficient décroissant pour le départage
    const sortedSubjects = [...subjects].sort((a, b) => b.coefficient - a.coefficient);

    const sorted = [...candidatsScores].sort((a, b) => {
      // 1. Éliminés systématiquement après les non-éliminés
      if (a.isEliminated !== b.isEliminated) {
        return a.isEliminated ? 1 : -1;
      }

      // 2. Moyenne générale décroissante
      const avgA = a.totalAverage ?? -1;
      const avgB = b.totalAverage ?? -1;
      if (avgA !== avgB) {
        return avgB - avgA;
      }

      // 3. Départage par les matières à fort coefficient
      for (const subj of sortedSubjects) {
        const gradeA = a.subjectResults.find(s => s.subjectId === subj.id)?.normalizedScore ?? 0;
        const gradeB = b.subjectResults.find(s => s.subjectId === subj.id)?.normalizedScore ?? 0;
        if (gradeA !== gradeB) {
          return gradeB - gradeA;
        }
      }

      // 4. Départage par l'âge : le plus jeune d'abord (dateOfBirth la plus récente = valeur timestamp la plus élevée)
      const dobA = a.dateOfBirth ? new Date(a.dateOfBirth).getTime() : 0;
      const dobB = b.dateOfBirth ? new Date(b.dateOfBirth).getTime() : 0;
      if (dobA !== dobB) {
        return dobB - dobA;
      }

      return 0;
    });

    // Attribution du rang (1, 2, 3...)
    return sorted.map((cand, index) => ({
      ...cand,
      rank: index + 1,
    }));
  }

  /**
   * Simule la délibération et calcule la répartition des admis / liste d'attente / refusés
   */
  public static simulerDeliberation(
    params: DeliberationSimulationParams
  ): DeliberationSimulationOutcome {
    const {
      scoredCandidates,
      availableSeats = null,
      admissionThreshold = null,
      waitingListSeats = 0,
    } = params;

    const admisIds: string[] = [];
    const listeAttenteIds: string[] = [];
    const refusesIds: string[] = [];
    const tieCandidateIdsAtCutOff: string[] = [];
    let cutOffTieDetected = false;

    // Filtrer les candidats classés
    const nonElimines = scoredCandidates.filter(c => !c.isEliminated && c.totalAverage !== null);
    const elimines = scoredCandidates.filter(c => c.isEliminated || c.totalAverage === null);

    // Seuil minimal applicable
    const seuilMin = admissionThreshold !== null && admissionThreshold !== undefined ? admissionThreshold : 10.0;

    // Candidats éligibles par la moyenne
    const eligibles = nonElimines.filter(c => (c.totalAverage ?? 0) >= seuilMin);
    const nonEligibles = nonElimines.filter(c => (c.totalAverage ?? 0) < seuilMin);

    // Si des places sont définies
    const maxAdmis = availableSeats !== null && availableSeats !== undefined && availableSeats > 0
      ? Math.min(availableSeats, eligibles.length)
      : eligibles.length;

    for (let i = 0; i < eligibles.length; i++) {
      const c = eligibles[i];
      if (i < maxAdmis) {
        admisIds.push(c.candidateId);
      } else if (i < maxAdmis + (waitingListSeats ?? 0)) {
        listeAttenteIds.push(c.candidateId);
      } else {
        refusesIds.push(c.candidateId);
      }
    }

    // Détection d'ex æquo strict à la limite des places admises
    if (maxAdmis > 0 && maxAdmis < eligibles.length) {
      const dernierAdmis = eligibles[maxAdmis - 1];
      const premierExclu = eligibles[maxAdmis];

      if (dernierAdmis.totalAverage === premierExclu.totalAverage) {
        cutOffTieDetected = true;
        for (const cand of eligibles) {
          if (cand.totalAverage === dernierAdmis.totalAverage) {
            tieCandidateIdsAtCutOff.push(cand.candidateId);
          }
        }
      }
    }

    // Tous les non-éligibles et éliminés sont refusés
    for (const c of nonEligibles) {
      refusesIds.push(c.candidateId);
    }
    for (const c of elimines) {
      refusesIds.push(c.candidateId);
    }

    // Seuil effectif du dernier admis
    let effectiveThreshold: number | null = null;
    if (admisIds.length > 0) {
      const dernier = eligibles[admisIds.length - 1];
      effectiveThreshold = dernier.totalAverage;
    }

    // Distribution des notes par tranches de 2 points
    const distributionMap = [
      { range: '0-2', count: 0 },
      { range: '2-4', count: 0 },
      { range: '4-6', count: 0 },
      { range: '6-8', count: 0 },
      { range: '8-10', count: 0 },
      { range: '10-12', count: 0 },
      { range: '12-14', count: 0 },
      { range: '14-16', count: 0 },
      { range: '16-18', count: 0 },
      { range: '18-20', count: 0 },
    ];

    for (const c of scoredCandidates) {
      if (c.totalAverage !== null) {
        const avg = Math.min(19.99, Math.max(0, c.totalAverage));
        const idx = Math.floor(avg / 2);
        if (distributionMap[idx]) {
          distributionMap[idx].count++;
        }
      }
    }

    return {
      admisIds,
      listeAttenteIds,
      refusesIds,
      effectiveThreshold,
      cutOffTieDetected,
      tieCandidateIdsAtCutOff,
      totalCandidates: scoredCandidates.length,
      admisCount: admisIds.length,
      listeAttenteCount: listeAttenteIds.length,
      refusesCount: refusesIds.length,
      eliminatedCount: elimines.length,
      gradeDistribution: distributionMap,
    };
  }
}
