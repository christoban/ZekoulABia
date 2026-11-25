import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';

interface Anomalie {
  type: 'DOUBLON' | 'SCORE_SUSPECT' | 'CAS_LIMITE' | 'SCORE_MANQUANT';
  severity: 'warning' | 'error';
  message: string;
  candidateIds: string[];
}

export class DetecterAnomaliesConcoursUseCase {
  constructor(private readonly entranceRepository: EntranceExamRepository) {}

  async execute(schoolId: string, sessionId: string): Promise<{ anomalies: Anomalie[] }> {
    const session = await this.entranceRepository.trouverSession(sessionId);
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    const candidates = await this.entranceRepository.listerCandidats(sessionId);

    const anomalies: Anomalie[] = [];
    const threshold = session.admissionThreshold;

    // 1. Doublons potentiels (même nom + même prénom)
    const nameMap = new Map<string, string[]>();
    for (const c of candidates) {
      const key = `${c.firstName.toLowerCase().trim()}|${c.lastName.toLowerCase().trim()}`;
      const ids = nameMap.get(key) ?? [];
      ids.push(c.id);
      nameMap.set(key, ids);
    }
    for (const [, ids] of nameMap) {
      if (ids.length > 1) {
        anomalies.push({
          type: 'DOUBLON',
          severity: 'warning',
          message: `Même nom détecté ${ids.length} fois — vérifiez les doublons`,
          candidateIds: ids,
        });
      }
    }

    // 2. Scores suspects (hors plage 0-20 ou 0-100)
    for (const c of candidates) {
      if (c.examScore !== null && c.examScore !== undefined) {
        if (c.examScore < 0 || c.examScore > 100) {
          anomalies.push({
            type: 'SCORE_SUSPECT',
            severity: 'error',
            message: `${c.firstName} ${c.lastName} : note ${c.examScore} hors plage (0-100)`,
            candidateIds: [c.id],
          });
        }
      }
    }

    // 3. Scores manquants
    const noScore = candidates.filter(c => c.examScore === null || c.examScore === undefined);
    if (noScore.length > 0) {
      anomalies.push({
        type: 'SCORE_MANQUANT',
        severity: 'warning',
        message: `${noScore.length} candidat(s) sans note saisie`,
        candidateIds: noScore.map(c => c.id),
      });
    }

    // 4. Cas limites au seuil (±2 points du seuil)
    if (threshold !== null && threshold !== undefined) {
      const borderline = candidates.filter(c =>
        c.examScore !== null &&
        c.examScore !== undefined &&
        Math.abs(c.examScore - threshold) <= 2
      );
      if (borderline.length > 0) {
        anomalies.push({
          type: 'CAS_LIMITE',
          severity: 'warning',
          message: `${borderline.length} candidat(s) à ±2 points du seuil (${threshold}) — vérifiez manuellement`,
          candidateIds: borderline.map(c => c.id),
        });
      }
    }

    return { anomalies };
  }
}
