import type { MetricRegistryPort, MetricKey, MetricDimensions, MetricDefinition, MetricComputeFn } from './MetricRegistry';
import { METRIC_DEFINITIONS, METRIC_COMPUTE_FNS } from './MetricDefinitions';

export class MetricRegistry implements MetricRegistryPort {
  getDefinition(key: MetricKey): MetricDefinition | undefined {
    return METRIC_DEFINITIONS[key];
  }

  getComputeFn(key: MetricKey): MetricComputeFn {
    const fn = METRIC_COMPUTE_FNS[key];
    if (!fn) throw new Error(`Aucune fonction de calcul pour la métrique ${key}`);
    return fn;
  }

  validateDimensions(key: MetricKey, dims: MetricDimensions): void {
    if (!dims.schoolId) throw new Error(`schoolId requis pour la métrique ${key}`);
    const def = METRIC_DEFINITIONS[key];
    if (!def) throw new Error(`Métrique inconnue ${key}`);
    if (!def.enabled) throw new Error(`Métrique ${key} désactivée`);
    const allowed = new Set(def.dimensions);
    for (const k of Object.keys(dims)) {
      if (!allowed.has(k as keyof MetricDimensions)) {
        throw new Error(`Dimension '${k}' non autorisée pour la métrique ${key}. Autorisées: ${def.dimensions.join(', ')}`);
      }
    }
  }
}