/**
 * INFRASTRUCTURE LAYER — Adapter TabPFN v2 pour PredictionService (Partie B du plan)
 *
 * Client HTTP vers le microservice Python (ml-service/main.py). AUCUN résultat de cet adapter
 * ne pilote de notification, alerte ou décision réelle — voir PLAN_IMPLEMENTATION_CLAUDE_CODE.md
 * B.5. Il existe pour être comparé à RulesBasedPredictionService (Phase 8, outil de comparaison),
 * pas pour remplacer la voie de production actuelle.
 *
 * Le port PredictionService parle "features métier" (EleveFeatures, etc.) ; le microservice
 * parle "vecteurs génériques" (context_features/query_features). Cet adapter fait la conversion
 * dans les deux sens et n'a pas de dataset de contexte étiqueté réel aujourd'hui — il appelle
 * donc le service SANS context_features/context_labels, qui répondra systématiquement
 * insufficient_context: true tant qu'un tel dataset n'existe pas (comportement honnête et
 * attendu, pas un bug).
 */
import type {
  PredictionService, EleveFeatures, PaiementFeatures, OrientationFeatures,
  RiskScore, TrackScores, NiveauRisque,
} from '@domain/ports/services/PredictionService';

const BASE_URL = process.env.TABPFN_SERVICE_URL ?? 'http://localhost:8001';
const TIMEOUT_MS = 10000;

interface PredictionResponseDTO {
  insufficient_context: boolean;
  context_size: number;
  model_version: string;
  class_probabilities: Array<Record<string, number>> | null;
}

function niveauRisqueDepuisScore(risque: number): NiveauRisque {
  if (risque >= 70) return 'CRITIQUE';
  if (risque >= 50) return 'ELEVE';
  if (risque >= 30) return 'MOYEN';
  return 'FAIBLE';
}

export class TabPfnServiceUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Microservice TabPFN indisponible (${BASE_URL})`);
    this.name = 'TabPfnServiceUnavailableError';
    this.cause = cause;
  }
}

export class TabPfnPredictionService implements PredictionService {
  private async appelerService(endpoint: string, queryFeatures: number[][]): Promise<PredictionResponseDTO> {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query_features: queryFeatures }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new TabPfnServiceUnavailableError(err);
    }

    if (!response.ok) {
      throw new TabPfnServiceUnavailableError(`HTTP ${response.status}`);
    }

    return response.json() as Promise<PredictionResponseDTO>;
  }

  async predireRisqueEleve(features: EleveFeatures): Promise<RiskScore> {
    const dto = await this.appelerService('/predict/risque-eleve', [[
      features.moyenneGenerale,
      features.tauxPresence,
      features.tendanceMoyennes.at(-1) ?? 0,
      features.nombreSanctions,
      features.nombrePeriodes,
      features.tauxPaiement,
    ]]);

    // insufficient_context est le comportement attendu (pas de dataset étiqueté réel encore) —
    // on renvoie un score neutre plutôt que d'inventer une valeur.
    if (dto.insufficient_context || !dto.class_probabilities) {
      return { score: 0, niveau: 'FAIBLE', source: 'TABPFN' };
    }

    const risque = this.scoreRisqueDepuisProbabilites(dto.class_probabilities[0]);
    return { score: risque, niveau: niveauRisqueDepuisScore(risque), source: 'TABPFN' };
  }

  async predireRisqueImpaye(features: PaiementFeatures): Promise<RiskScore> {
    const dto = await this.appelerService('/predict/risque-impaye', [[
      features.montantDu,
      features.joursRetard,
      features.echeancesRespectees,
      features.echeancesTotal,
      features.montantMoyenPaiement,
    ]]);

    if (dto.insufficient_context || !dto.class_probabilities) {
      return { score: 0, niveau: 'FAIBLE', source: 'TABPFN' };
    }

    const risque = this.scoreRisqueDepuisProbabilites(dto.class_probabilities[0]);
    return { score: risque, niveau: niveauRisqueDepuisScore(risque), source: 'TABPFN' };
  }

  async recommanderSerieOrientation(features: OrientationFeatures): Promise<TrackScores> {
    const matieres = Object.values(features.moyennesMatieres);
    const moyenneMatieres = matieres.length > 0 ? matieres.reduce((a, b) => a + b, 0) / matieres.length : 0;
    const dto = await this.appelerService('/predict/orientation', [[
      moyenneMatieres,
      features.scientificAptitude ?? 0,
      features.literaryAptitude ?? 0,
      features.technicalAptitude ?? 0,
    ]]);

    if (dto.insufficient_context || !dto.class_probabilities) {
      return { scores: [], source: 'TABPFN' };
    }

    const probas = dto.class_probabilities[0] ?? {};
    const scores = Object.entries(probas)
      .map(([track, proba]) => ({ track, score: Math.round(proba * 100) }))
      .sort((a, b) => b.score - a.score);

    return { scores, source: 'TABPFN' };
  }

  /** class_probabilities est indexé par label de classe (ex: "RISQUE"/"OK") — on prend la
   * probabilité de la classe "à risque" comme score 0-100. Convention attendue du microservice :
   * la classe positive est nommée "RISQUE" côté contexte d'entraînement fourni. */
  private scoreRisqueDepuisProbabilites(probabilites: Record<string, number>): number {
    const probaRisque = probabilites['RISQUE'] ?? Math.max(...Object.values(probabilites), 0);
    return Math.round(probaRisque * 100);
  }
}
