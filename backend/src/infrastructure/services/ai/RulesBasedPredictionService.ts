/**
 * INFRASTRUCTURE LAYER — Adapter à seuils/règles pour PredictionService (Partie B du plan)
 *
 * predireRisqueEleve() réutilise EXACTEMENT la formule pondérée déjà en production
 * (domain/rules/IndiceSanteRules.ts, extraite de CalculerIndiceSanteUseCase sans changement de
 * comportement) — c'est la seule voie qui pilote réellement les alertes aujourd'hui, via
 * CalculerIndiceSanteUseCase directement, PAS via cet adapter. Cet adapter existe pour que le
 * port PredictionService ait une implémentation de référence comparable à TabPfnPredictionService,
 * conformément à la Definition of Done (B.7) — il n'est branché à aucune notification réelle.
 *
 * predireRisqueImpaye() et recommanderSerieOrientation() sont des heuristiques simples et
 * honnêtes, écrites pour ce chantier (rien d'équivalent n'existait avant) — à ne pas confondre
 * avec le vrai moteur d'orientation de la Partie A (GenererRecommandationOrientationUseCase),
 * qui reste l'unique source de vérité pour les recommandations réellement envoyées aux élèves.
 */
import type {
  PredictionService, EleveFeatures, PaiementFeatures, OrientationFeatures,
  RiskScore, TrackScores, NiveauRisque,
} from '@domain/ports/services/PredictionService';
import { calculerScoreDepuisTaux } from '@domain/rules/IndiceSanteRules';

function niveauRisqueDepuisScore(risque: number): NiveauRisque {
  if (risque >= 70) return 'CRITIQUE';
  if (risque >= 50) return 'ELEVE';
  if (risque >= 30) return 'MOYEN';
  return 'FAIBLE';
}

export class RulesBasedPredictionService implements PredictionService {
  async predireRisqueEleve(features: EleveFeatures): Promise<RiskScore> {
    const scoreSante = calculerScoreDepuisTaux({
      moyenneGenerale: features.moyenneGenerale,
      tauxPresence: features.tauxPresence,
      tendanceMoyennes: features.tendanceMoyennes,
      nombreSanctions: features.nombreSanctions,
      nombrePeriodes: features.nombrePeriodes,
      tauxPaiement: features.tauxPaiement,
    });
    // Le score de santé (0-100, 100=excellent) s'inverse en score de RISQUE (0-100, 100=critique)
    // pour respecter le contrat du port, commun avec l'adapter TabPFN.
    const risque = 100 - scoreSante;
    return { score: risque, niveau: niveauRisqueDepuisScore(risque), source: 'RULES' };
  }

  async predireRisqueImpaye(features: PaiementFeatures): Promise<RiskScore> {
    const tauxRespect = features.echeancesTotal > 0
      ? features.echeancesRespectees / features.echeancesTotal
      : 1;
    // Retard normalisé sur 90 jours (au-delà, considéré maximal) + historique de respect des
    // échéances — heuristique simple, jamais utilisée pour une vraie relance aujourd'hui.
    const scoreRetard = Math.min(100, (Math.max(0, features.joursRetard) / 90) * 100);
    const scoreHistorique = (1 - tauxRespect) * 100;
    const risque = Math.round(scoreRetard * 0.6 + scoreHistorique * 0.4);
    return { score: risque, niveau: niveauRisqueDepuisScore(risque), source: 'RULES' };
  }

  async recommanderSerieOrientation(features: OrientationFeatures): Promise<TrackScores> {
    // Heuristique volontairement minimale — le vrai moteur d'orientation (Partie A) opère à un
    // niveau de détail que ce port générique features→score ne cherche pas à reproduire ici.
    // moyennesMatieres est sur /20 (même échelle que EleveFeatures.moyenneGenerale) — normalisé
    // sur 0-100 avant d'être combiné aux aptitudes de test (déjà sur 0-100).
    const scientifique = features.scientificAptitude ?? this.moyenneSujetsSur100(features, ['Mathématiques', 'Physique-Chimie-Technologie', 'SVTEEHB']);
    const litteraire = features.literaryAptitude ?? this.moyenneSujetsSur100(features, ['Français', 'Histoire-Géographie', 'Anglais']);
    const technique = features.technicalAptitude ?? scientifique * 0.8;

    const scores = [
      { track: 'C', score: Math.round(scientifique) },
      { track: 'A', score: Math.round(litteraire) },
      { track: 'TI', score: Math.round(technique) },
    ].sort((a, b) => b.score - a.score);

    return { scores, source: 'RULES' };
  }

  private moyenneSujetsSur100(features: OrientationFeatures, sujets: string[]): number {
    const valeurs = sujets.map((s) => features.moyennesMatieres[s]).filter((v): v is number => v != null);
    if (valeurs.length === 0) return 50;
    const moyenneSur20 = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    return Math.min(100, (moyenneSur20 / 20) * 100);
  }
}
