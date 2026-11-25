/**
 * APPLICATION — Use case : vérifier la complétude du formulaire complémentaire avant toute
 * génération de déclaration statistique. Les champs de Catégorie C (faits administratifs
 * rares : titre foncier, superficie, internat, poste comptable) sont saisis UNE FOIS et
 * vérifiés/ajustés à chaque campagne — jamais ressaisis depuis zéro (règle métier centrale
 * de ce chantier).
 */
import type { StatisticalCampaignRepository } from '@domain/ports/repositories/StatisticalCampaignRepository';
import type {
  ChampSupplementManquant,
  VerifierCompletudeSupplementCommande,
  VerifierCompletudeSupplementResultat,
} from './types';

const CHAMPS_OBLIGATOIRES: { champ: string; label: string }[] = [
  { champ: 'hasTitreFoncier', label: "Titre foncier (Oui/Non)" },
  { champ: 'siteProvisoire', label: 'Site provisoire (Oui/Non)' },
  { champ: 'superficieTerrainM2', label: 'Superficie totale du terrain (m²)' },
  { champ: 'hasInternat', label: "Dispose d'un internat (Oui/Non)" },
  { champ: 'posteComptable', label: 'Poste Comptable' },
];

export class VerifierCompletudeSupplementUseCase {
  constructor(private readonly campaignRepository: StatisticalCampaignRepository) {}

  async execute(cmd: VerifierCompletudeSupplementCommande): Promise<VerifierCompletudeSupplementResultat> {
    const supplement = await this.campaignRepository.trouverSupplement(cmd.schoolId);

    if (!supplement) {
      return {
        complet: false,
        champsManquants: CHAMPS_OBLIGATOIRES.map(({ champ, label }) => ({ champ, label })),
        supplementExiste: false,
        derniereMiseAJour: null,
      };
    }

    const champsManquants: ChampSupplementManquant[] = CHAMPS_OBLIGATOIRES.filter(
      ({ champ }) => supplement[champ] === null || supplement[champ] === undefined,
    ).map(({ champ, label }) => ({ champ, label }));

    return {
      complet: champsManquants.length === 0,
      champsManquants,
      supplementExiste: true,
      derniereMiseAJour: supplement.lastUpdatedAt,
    };
  }
}
