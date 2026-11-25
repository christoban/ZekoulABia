import type { MetricCachePort } from '@domain/ports/cache/MetricCachePort';
import type { MetricRegistryPort, MetricKey, MetricDimensions, MetricComputeContext } from '@domain/reporting/MetricRegistry';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { StatisticsQueryRepository } from '@domain/ports/repositories/StatisticsQueryRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface GetMetricCommand {
  key: MetricKey;
  dimensions: MetricDimensions;
  forceRefresh?: boolean;
}

export interface GetMetricResult {
  value: number;
  fromCache: boolean;
  computedAt: Date;
}

export class GetMetricUseCase {
  private readonly computeContext: MetricComputeContext;

  constructor(
    private readonly cache: MetricCachePort,
    private readonly registry: MetricRegistryPort,
    presenceRepository: PresenceRepository,
    noteRepository: NoteRepository,
    statisticsQueryRepository: StatisticsQueryRepository,
    schoolRepository: SchoolRepository,
    classeRepository: ClasseRepository,
  ) {
    this.computeContext = { presenceRepository, noteRepository, statisticsQueryRepository, schoolRepository, classeRepository };
  }

  async execute(cmd: GetMetricCommand): Promise<GetMetricResult> {
    this.registry.validateDimensions(cmd.key, cmd.dimensions);

    if (!cmd.forceRefresh) {
      const hit = await this.cache.get(cmd.key, cmd.dimensions);
      if (hit) {
        return { value: hit.value, fromCache: true, computedAt: hit.computedAt };
      }
    }

    const fn = this.registry.getComputeFn(cmd.key);
    const value = await fn(cmd.dimensions, this.computeContext);

    await this.cache.set(cmd.key, cmd.dimensions, value);

    // Re-lire pour computedAt cohérent (set vient de créer expiresAt)
    const entry = await this.cache.get(cmd.key, cmd.dimensions);
    return { value, fromCache: false, computedAt: entry?.computedAt ?? new Date() };
  }
}