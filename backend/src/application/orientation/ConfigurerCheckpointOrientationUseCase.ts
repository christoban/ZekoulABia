import type { IOrientationRepository, CheckpointConfigDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { OrientationCheckpointType } from '@domain/entities/FicheOrientation';
import { defaultConfigFor } from './checkpointScoringConfig';

export interface ConfigurerCheckpointCommande {
  schoolId: string;
  type: OrientationCheckpointType;
  possibleTracks?: string[];
  relevantSubjects?: unknown;
  psychotechnicalTestRequired: boolean;
  windowStartMonth?: number;
  windowStartDay?: number;
  windowEndMonth?: number;
  windowEndDay?: number;
  responseDeadlineDays?: number;
}

const DEFAULT_TRACKS: Record<OrientationCheckpointType, string[]> = {
  FIN_TROISIEME: ['A', 'SES', 'C'],
  FIN_SECONDE_C: ['C', 'D', 'TI'],
};

export class ConfigurerCheckpointOrientationUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: ConfigurerCheckpointCommande): Promise<CheckpointConfigDetail> {
    return this.repo.upsertCheckpointConfig(cmd.schoolId, cmd.type, {
      possibleTracks: cmd.possibleTracks ?? DEFAULT_TRACKS[cmd.type],
      relevantSubjects: cmd.relevantSubjects ?? defaultConfigFor(cmd.type),
      psychotechnicalTestRequired: cmd.psychotechnicalTestRequired,
      windowStartMonth: cmd.windowStartMonth ?? 3,
      windowStartDay: cmd.windowStartDay ?? 1,
      windowEndMonth: cmd.windowEndMonth ?? 5,
      windowEndDay: cmd.windowEndDay ?? 31,
      responseDeadlineDays: cmd.responseDeadlineDays ?? 15,
    });
  }
}
