/**
 * APPLICATION LAYER — Use Case : Calculer l'indice de santé scolaire
 *
 * 5 composantes pondérées (source : ZekoulABia spec) :
 * - Notes        : 35% — moyenne générale normalisée (0-20 → 0-100)
 * - Assiduité    : 25% — (jours présent / jours total) × 100
 * - Tendance     : 20% — évolution sur 3 dernières périodes
 * - Comportement : 10% — sanctions / nombre de périodes
 * - Paiements    : 10% — frais réglés / frais totaux
 *
 * Niveaux : 0-30 CRITIQUE | 31-50 ELEVE | 51-70 MOYEN | 71-85 STABLE | 86-100 PROGRESSION
 */
import type { IAService, ResultatIndiceSante } from '@domain/ports/services/IAService';
import type { SanteEleveRepository } from '@domain/ports/repositories/SanteEleveRepository';
import { calculerComposantesSante, niveauDepuisScore } from '@domain/rules/IndiceSanteRules';

export interface CalculerIndiceSanteCommande {
  studentId: string;
  schoolId: string;
  academicYearId: string;
  sauvegarderScore?: boolean; // Si true → persiste le score dans studentProfile
  langue?: 'fr' | 'en';       // langue des recommandations IA (résolue par l'appelant via resolveLanguage)
}

export class CalculerIndiceSanteUseCase {
  constructor(
    private readonly santeRepository: SanteEleveRepository,
    private readonly iaService: IAService,
  ) {}

  async execute(commande: CalculerIndiceSanteCommande): Promise<ResultatIndiceSante> {
    // 1. Récupérer les données
    const donnees = await this.santeRepository.getDonneesSante(
      commande.studentId,
      commande.schoolId,
      commande.academicYearId
    );

    if (!donnees) {
      throw new Error(`Données de santé introuvables pour l'élève : ${commande.studentId}`);
    }

    // 2. Composantes + score pondéré (partagé avec calculerScoreSeulement, source unique —
    // voir domain/rules/IndiceSanteRules.ts, aussi réutilisé par RulesBasedPredictionService)
    const composantes = calculerComposantesSante(donnees);

    // 3. Déléguer l'analyse narrative et les recommandations à l'IA
    const resultat = await this.iaService.calculerIndiceSante({
      moyenneGenerale: donnees.moyenneGenerale,
      tauxPresence: composantes.tauxPresence,
      tendanceMoyennes: donnees.moyennesPrecedentes,
      nombreSanctions: donnees.nombreSanctions,
      tauxPaiement: composantes.scorePaiements,
      langue: commande.langue,
    });

    // 4. Sauvegarder si demandé
    if (commande.sauvegarderScore) {
      await this.santeRepository.sauvegarderScore(commande.studentId, composantes.score);
    }

    return {
      score: composantes.score,
      niveau: resultat.niveau,
      recommandations: resultat.recommandations,
    };
  }

  /**
   * Calcule et persiste le score numérique SEUL, sans appel IA — pour le job nocturne qui
   * recalcule des centaines d'élèves : un appel Groq par élève chaque nuit serait coûteux et
   * inutile (la narration n'a de valeur que pour un élève qu'un humain regarde réellement,
   * via execute() ci-dessus, ex. detectRisk). Seule source de vérité du calcul numérique —
   * remplace l'ancienne logique dupliquée dans inngest/functions.ts.
   */
  async calculerScoreSeulement(
    studentId: string,
    schoolId: string,
    academicYearId: string,
  ): Promise<{ score: number; niveau: string; tendancePositive: boolean }> {
    const donnees = await this.santeRepository.getDonneesSante(studentId, schoolId, academicYearId);
    if (!donnees) {
      throw new Error(`Données de santé introuvables pour l'élève : ${studentId}`);
    }

    const composantes = calculerComposantesSante(donnees);
    await this.santeRepository.sauvegarderScore(studentId, composantes.score);

    // Hausse significative et non compensée par une baisse ailleurs dans la fenêtre — cf.
    // calculerTendance (75 = au moins un +25 net, sans redescendre sous la neutralité 50).
    const tendancePositive = composantes.scoreTendance >= 75;

    return { score: composantes.score, niveau: niveauDepuisScore(composantes.score), tendancePositive };
  }
}
