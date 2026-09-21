/**
 * APPLICATION — Use case : Valider par lot plusieurs dossiers d'inscription complets.
 *
 * Responsabilités :
 * - Exécuté uniquement par un rôle ADMIN
 * - Tente la validation atomique de chaque dossier individuel
 * - Isole les erreurs sans faire échouer les autres dossiers valides
 * - Retourne un bilan détaillé (dossiers validés, dossiers rejetés avec motif)
 */
import { InscrireEleveUseCase } from './InscrireEleveUseCase';

export interface ValiderLotCommande {
  schoolId: string;
  onboardingIds: string[];
  validatedById: string;
  validatorRole: string;
}

export interface BilanValidationLot {
  total: number;
  validesCount: number;
  echecsCount: number;
  valides: string[];
  echecs: Array<{ id: string; motif: string }>;
}

export class ValiderLotOnboardingUseCase {
  constructor(private readonly inscrireEleveUseCase: InscrireEleveUseCase) {}

  async execute(cmd: ValiderLotCommande): Promise<BilanValidationLot> {
    if (cmd.validatorRole !== 'ADMIN') {
      throw new Error('Seul l’administrateur peut valider des dossiers par lot.');
    }

    if (!Array.isArray(cmd.onboardingIds) || cmd.onboardingIds.length === 0) {
      throw new Error('La liste des dossiers à valider ne peut pas être vide.');
    }

    const valides: string[] = [];
    const echecs: Array<{ id: string; motif: string }> = [];

    for (const id of cmd.onboardingIds) {
      try {
        await this.inscrireEleveUseCase.execute({
          schoolId: cmd.schoolId,
          onboardingId: id,
          validatedById: cmd.validatedById,
          validatorRole: cmd.validatorRole,
        });
        valides.push(id);
      } catch (err: any) {
        echecs.push({
          id,
          motif: err?.message || 'Erreur lors de la validation',
        });
      }
    }

    return {
      total: cmd.onboardingIds.length,
      validesCount: valides.length,
      echecsCount: echecs.length,
      valides,
      echecs,
    };
  }
}
