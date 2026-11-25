import type { IOrientationRepository, AspirationDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { OrientationCheckpointType } from '@domain/entities/FicheOrientation';

export interface SaisirAspirationCommande {
  studentId: string;
  schoolId: string;
  checkpointType: OrientationCheckpointType;
  desiredTrack?: string;
  careerInterest?: string;
}

export class SaisirAspirationsEleveUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: SaisirAspirationCommande): Promise<AspirationDetail> {
    return this.repo.createOrUpdateAspiration(cmd.studentId, cmd.schoolId, cmd.checkpointType, {
      desiredTrack: cmd.desiredTrack,
      careerInterest: cmd.careerInterest,
    });
  }
}
