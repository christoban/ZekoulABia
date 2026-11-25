import type { IOrientationRepository, EleveAOrienterDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { OrientationCheckpointType } from '@domain/entities/FicheOrientation';

export type { EleveAOrienterDetail as EleveAOrienter };

/**
 * Détermine les élèves éligibles à un checkpoint (niveau/série de leur classe actuelle) et
 * indique s'ils ont déjà une recommandation — sert à la fois de filet de sécurité pour le
 * conseiller (A.1.3 point 5) et de base au déclenchement automatique du moteur (Phase 4).
 */
export class ListerElevesAOrienterUseCase {
  constructor(private readonly orientationRepo: IOrientationRepository) {}

  static eligibiliteWhere(checkpointType: OrientationCheckpointType) {
    return checkpointType === 'FIN_TROISIEME'
      ? { level: '3e' }
      : { level: '2nde', serie: 'C' };
  }

  async execute(params: { schoolId: string; checkpointType: OrientationCheckpointType; academicYearId: string }): Promise<EleveAOrienterDetail[]> {
    return this.orientationRepo.listElevesAOrienter(params.schoolId, params.checkpointType, params.academicYearId);
  }
}
