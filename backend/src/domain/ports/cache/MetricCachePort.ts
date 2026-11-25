import type { MetricKey, MetricDimensions } from '@domain/reporting/MetricRegistry';

export interface MetricCacheEntry {
  value: number;
  computedAt: Date;
  expiresAt: Date;
}

export interface MetricCachePort {
  get(key: MetricKey, dims: MetricDimensions): Promise<MetricCacheEntry | null>;
  set(key: MetricKey, dims: MetricDimensions, value: number): Promise<void>;
  invalidate(key: MetricKey, dimsPrefix: Partial<MetricDimensions>): Promise<number>;
  invalidateBySchool(schoolId: string): Promise<number>;
}