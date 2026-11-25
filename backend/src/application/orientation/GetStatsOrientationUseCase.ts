import type { IOrientationRepository, OrientationStats } from '@domain/ports/repositories/IOrientationRepository';

export interface GetStatsCommande {
  schoolId:        string;
  academicYearId?: string;
}

export class GetStatsOrientationUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: GetStatsCommande): Promise<OrientationStats> {
    return this.repo.getStats(cmd.schoolId, cmd.academicYearId);
  }
}
