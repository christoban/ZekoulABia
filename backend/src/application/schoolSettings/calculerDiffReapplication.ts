/**
 * APPLICATION — Logique partagée de calcul du diff de ré-application de template (V0.4).
 * Source unique utilisée par la ré-application ciblée (une école) et en masse
 * (toutes les écoles d'un template) — DRY §4.4.
 */
import { fusionnerConfigLocaleTemplate, CHAMPS_CONFIG_LOCALE } from '@domain/rules/configLocaleTemplate';

export interface DiffReapplication {
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
  champsReappliques: string[];
  champsPreserves: string[];
  /** true si au moins un champ ré-appliqué change réellement de valeur. */
  aChangement: boolean;
}

export function calculerDiffReapplication(
  versionConfig: Record<string, unknown>,
  configCourante: Record<string, unknown>,
  overrides: readonly string[],
): DiffReapplication {
  const configDefaults: Record<string, unknown> = {};
  for (const champ of CHAMPS_CONFIG_LOCALE) {
    configDefaults[champ] = versionConfig[champ] ?? configCourante[champ];
  }

  const configResultante = fusionnerConfigLocaleTemplate(configDefaults, configCourante, overrides);

  const champsReappliques = CHAMPS_CONFIG_LOCALE.filter((c) => !overrides.includes(c));
  const champsPreserves = CHAMPS_CONFIG_LOCALE.filter((c) => overrides.includes(c));
  const aChangement = champsReappliques.some((c) => configCourante[c] !== configResultante[c]);

  return {
    avant: configCourante,
    apres: configResultante,
    champsReappliques,
    champsPreserves,
    aChangement,
  };
}
