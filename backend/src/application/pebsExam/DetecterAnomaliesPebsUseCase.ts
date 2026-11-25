import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';

interface Anomalie {
  type: 'DOUBLON' | 'SCORE_SUSPECT' | 'CAS_LIMITE' | 'SCORE_MANQUANT';
  severity: 'warning' | 'error';
  message: string;
  candidateIds: string[];
}

export class DetecterAnomaliesPebsUseCase {
  constructor(private readonly pebsRepository: PebsExamRepository) {}

  async execute(schoolId: string, sessionId: string): Promise<{ anomalies: Anomalie[] }> {
    const session = await this.pebsRepository.trouverSession(sessionId);
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    // Récupérer les candidats avec noms
    const rawCandidates = await this.pebsRepository.listerCandidatsAvecProfil(sessionId);

    const candidates = rawCandidates.map(c => ({
      id: c.id,
      firstName: c.studentProfile?.user?.firstName ?? '',
      lastName: c.studentProfile?.user?.lastName ?? '',
      examScore: c.examScore,
    }));

    const anomalies: Anomalie[] = [];
    const threshold = session.selectionThreshold;

    // 1. Doublons (même profil)
    const profileMap = new Map<string, string[]>();
    for (const c of rawCandidates) {
      const ids = profileMap.get(c.studentProfileId) ?? [];
      ids.push(c.id);
      profileMap.set(c.studentProfileId, ids);
    }
    for (const [, ids] of profileMap) {
      if (ids.length > 1) {
        anomalies.push({
          type: 'DOUBLON', severity: 'warning',
          message: `Même élève inscrit ${ids.length} fois`,
          candidateIds: ids,
        });
      }
    }

    // 2. Scores suspects
    for (const c of candidates) {
      if (c.examScore !== null && c.examScore !== undefined) {
        if (c.examScore < 0 || c.examScore > 100) {
          anomalies.push({
            type: 'SCORE_SUSPECT', severity: 'error',
            message: `${c.firstName} ${c.lastName} : note ${c.examScore} hors plage`,
            candidateIds: [c.id],
          });
        }
      }
    }

    // 3. Scores manquants
    const noScore = candidates.filter(c => c.examScore === null || c.examScore === undefined);
    if (noScore.length > 0) {
      anomalies.push({
        type: 'SCORE_MANQUANT', severity: 'warning',
        message: `${noScore.length} candidat(s) sans note`,
        candidateIds: noScore.map(c => c.id),
      });
    }

    // 4. Cas limites au seuil
    if (threshold !== null && threshold !== undefined) {
      const borderline = candidates.filter(c =>
        c.examScore !== null && c.examScore !== undefined && Math.abs(c.examScore - threshold) <= 2
      );
      if (borderline.length > 0) {
        anomalies.push({
          type: 'CAS_LIMITE', severity: 'warning',
          message: `${borderline.length} candidat(s) à ±2 points du seuil (${threshold})`,
          candidateIds: borderline.map(c => c.id),
        });
      }
    }

    return { anomalies };
  }
}
