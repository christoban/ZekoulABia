/**
 * INFRASTRUCTURE LAYER — Adaptateur AutoMaterialisationProgrammesPort guardé par
 * le feature flag ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION.
 *
 * Comportement :
 * - Flag OFF (défaut) : no-op immédiat, zéro requête DB.
 * - Flag ON : matérialisation silencieuse, idempotente et non bloquante (try/catch).
 */
import type { AutoMaterialisationProgrammesPort } from '@domain/ports/services/AutoMaterialisationProgrammesPort';
import type { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import type { InitialiserProgrammesEcoleUseCase } from '@application/pedagogie/InitialiserProgrammesEcoleUseCase';
import { isOfficialProgrammesMaterialisationEnabled } from '@infrastructure/config/featureFlags';

export class FeatureFlaggedAutoMaterialisationService
  implements AutoMaterialisationProgrammesPort
{
  constructor(
    private readonly appliquerClasse: AppliquerInitialisationProgrammesClasseUseCase,
    private readonly initialiserEcole: InitialiserProgrammesEcoleUseCase,
  ) {}

  async materialiserPourClasseSiActif(params: {
    schoolId: string;
    classId: string;
    academicYearId?: string;
  }): Promise<void> {
    if (!isOfficialProgrammesMaterialisationEnabled(params.schoolId)) return;
    try {
      await this.appliquerClasse.execute({
        schoolId: params.schoolId,
        classId: params.classId,
        academicYearId: params.academicYearId,
      });
    } catch (err) {
      console.warn(
        '[AutoMaterialisationProgrammes] Échec non bloquant sur classe',
        params.classId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  async materialiserPourEcoleSiActif(params: {
    schoolId: string;
    academicYearId?: string;
  }): Promise<void> {
    if (!isOfficialProgrammesMaterialisationEnabled(params.schoolId)) return;
    try {
      await this.initialiserEcole.appliquer({
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
      });
    } catch (err) {
      console.warn(
        '[AutoMaterialisationProgrammes] Échec non bloquant sur école',
        params.schoolId,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
