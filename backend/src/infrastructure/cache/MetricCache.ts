import type { MetricCachePort, MetricCacheEntry } from '@domain/ports/cache/MetricCachePort';
import type { MetricKey, MetricDimensions } from '@domain/reporting/MetricRegistry';
import { METRIC_DEFINITIONS } from '@domain/reporting/MetricDefinitions';

function stableKey(key: MetricKey, dims: MetricDimensions): string {
  const ordered: Record<string, unknown> = {};
  const keys = Object.keys(dims).sort();
  for (const k of keys) (ordered as Record<string, unknown>)[k] = (dims as unknown as Record<string, unknown>)[k];
  return `${key}:${JSON.stringify(ordered)}`;
}

function dimsMatchPrefix(entryDims: MetricDimensions, prefix: Partial<MetricDimensions>): boolean {
  for (const [k, v] of Object.entries(prefix)) {
    if (v === undefined) continue;
    const ev = (entryDims as unknown as Record<string, unknown>)[k];
    if (ev === undefined) return false;
    if (typeof v === 'object' && v !== null) {
      if (JSON.stringify(ev) !== JSON.stringify(v)) return false;
    } else if (ev !== v) return false;
  }
  return true;
}

export class MetricCache implements MetricCachePort {
  private store = new Map<string, { entry: MetricCacheEntry; dims: MetricDimensions; key: MetricKey }>();

  // Note : la Map peut grossir sans purge active en v1. Acceptable vu le volume
  // (2 métriques, TTL court 2min) — à revisiter si le footprint mémoire devient mesuré.
  // La Map est en mémoire process : perdue au restart (pas de persistance, choix v1).

  async get(key: MetricKey, dims: MetricDimensions): Promise<MetricCacheEntry | null> {
    const k = stableKey(key, dims);
    const found = this.store.get(k);
    if (!found) {
      console.info(`[MetricCache] metric_miss key=${key} schoolId=${dims.schoolId}`);
      return null;
    }
    if (found.entry.expiresAt.getTime() <= Date.now()) {
      this.store.delete(k);
      console.info(`[MetricCache] metric_miss key=${key} schoolId=${dims.schoolId} (expired)`);
      return null;
    }
    console.info(`[MetricCache] metric_hit key=${key} schoolId=${dims.schoolId}`);
    return found.entry;
  }

  async set(key: MetricKey, dims: MetricDimensions, value: number): Promise<void> {
    const def = METRIC_DEFINITIONS[key];
    const ttl = def?.defaultTtlMs ?? 2 * 60 * 1000;
    const now = new Date();
    const entry: MetricCacheEntry = {
      value,
      computedAt: now,
      expiresAt: new Date(now.getTime() + ttl),
    };
    const k = stableKey(key, dims);
    this.store.set(k, { entry, dims: { ...dims }, key });
  }

  async invalidate(key: MetricKey, dimsPrefix: Partial<MetricDimensions>): Promise<number> {
    let count = 0;
    for (const [k, v] of [...this.store.entries()]) {
      if (v.key !== key) continue;
      if (dimsMatchPrefix(v.dims, dimsPrefix)) {
        this.store.delete(k);
        count++;
      }
    }
    if (count > 0) console.info(`[MetricCache] invalidate key=${key} prefix=${JSON.stringify(dimsPrefix)} count=${count}`);
    return count;
  }

  async invalidateBySchool(schoolId: string): Promise<number> {
    let count = 0;
    for (const [k, v] of [...this.store.entries()]) {
      if (v.dims.schoolId === schoolId) {
        this.store.delete(k);
        count++;
      }
    }
    if (count > 0) console.info(`[MetricCache] invalidateBySchool schoolId=${schoolId} count=${count}`);
    return count;
  }

  // Pour tests : taille
  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}