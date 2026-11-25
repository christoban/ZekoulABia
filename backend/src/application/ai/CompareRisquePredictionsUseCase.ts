/**
 * APPLICATION LAYER — Use Case : Comparer les prédictions RULES vs TABPFN (Partie B du plan, B.6.6)
 *
 * Outil interne (admin technique) qui exécute les deux adapters PredictionService sur les mêmes
 * données réelles courantes et renvoie les deux résultats côte à côte. ZekoulABia n'a pas encore
 * de résultats historiques étiquetés (élève réellement décroché, réellement réussi...), donc ce
 * use case compare des PRÉDICTIONS ACTUELLES entre elles — ce n'est pas un backtest contre une
 * vérité terrain, et il ne doit pas être présenté comme tel (voir plan B.5).
 *
 * Ne pilote aucune notification ni décision — lecture seule, à but d'observation.
 */
import type { SanteEleveRepository } from '@domain/ports/repositories/SanteEleveRepository';
import type { PredictionService, RiskScore } from '@domain/ports/services/PredictionService';
import { calculerComposantesSante } from '@domain/rules/IndiceSanteRules';

export interface CompareRisquePredictionsCommande {
  studentId: string;
  schoolId: string;
  academicYearId: string;
}

export interface CompareRisquePredictionsResultat {
  rules: RiskScore;
  tabpfn: RiskScore | { indisponible: true; raison: string };
}

export class CompareRisquePredictionsUseCase {
  constructor(
    private readonly santeRepository: SanteEleveRepository,
    private readonly rulesService: PredictionService,
    private readonly tabpfnService: PredictionService,
  ) {}

  async execute(commande: CompareRisquePredictionsCommande): Promise<CompareRisquePredictionsResultat> {
    const donnees = await this.santeRepository.getDonneesSante(
      commande.studentId, commande.schoolId, commande.academicYearId
    );
    if (!donnees) {
      throw new Error(`Données de santé introuvables pour l'élève : ${commande.studentId}`);
    }

    const composantes = calculerComposantesSante(donnees);
    const features = {
      moyenneGenerale: donnees.moyenneGenerale,
      tauxPresence: composantes.tauxPresence,
      tendanceMoyennes: donnees.moyennesPrecedentes,
      nombreSanctions: donnees.nombreSanctions,
      nombrePeriodes: donnees.nombrePeriodes,
      tauxPaiement: composantes.scorePaiements,
    };

    const rules = await this.rulesService.predireRisqueEleve(features);

    let tabpfn: CompareRisquePredictionsResultat['tabpfn'];
    try {
      tabpfn = await this.tabpfnService.predireRisqueEleve(features);
    } catch (err) {
      // Le microservice Python est optionnel/expérimental — son indisponibilité ne doit jamais
      // faire échouer cet outil d'observation, juste être rapportée honnêtement.
      tabpfn = { indisponible: true, raison: err instanceof Error ? err.message : 'erreur inconnue' };
    }

    return { rules, tabpfn };
  }
}
