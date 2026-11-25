/**
 * DOMAIN LAYER — Règle métier V2.2 « config locale > template »
 *
 * Invariant : une mise à jour de template ne réécrit JAMAIS un champ qu'un établissement
 * a personnalisé localement. Le registre `configOverrides` (SchoolConfig) liste les champs
 * personnalisés ; `fusionnerConfigLocaleTemplate` applique l'invariant.
 *
 * Volontairement NON générique : seuls les champs SchoolConfig réellement personnalisables
 * sont couverts (liste blanche ci-dessous), pas un moteur clé/valeur quelconque.
 */

export const CHAMPS_CONFIG_LOCALE = [
  'schoolLanguageMode',
  'passMark',
  'councilPassMark',
  'maxAbsences',
  'attendanceLateAsAbsence',
  'legalMaxContributionFirstCycle',
  'legalMaxContributionSecondCycle',
  'bulletinBlockOnUnpaidFees',
  'smsEnabled',
  'offlineModeEnabled',
  'aiAlertsEnabled',
  'messageModeration',
] as const;

export type ChampConfigLocale = (typeof CHAMPS_CONFIG_LOCALE)[number];

/** Champs de la liste blanche réellement présents (non `undefined`) dans une commande de mise à jour. */
export function extraireChampsConfigModifies(input: Record<string, unknown>): ChampConfigLocale[] {
  return CHAMPS_CONFIG_LOCALE.filter((c) => input[c] !== undefined);
}

/** Union sans doublon de deux listes de champs overridés. */
export function ajouterOverrides(existants: readonly string[], nouveaux: readonly string[]): string[] {
  return [...new Set([...existants, ...nouveaux])];
}

/**
 * Fusion « locale > template » : les champs overridés gardent la valeur locale,
 * tous les autres prennent la valeur par défaut du template.
 */
export function fusionnerConfigLocaleTemplate<T extends Record<string, unknown>>(
  templateDefaults: T,
  local: T,
  overrides: readonly string[],
): T {
  const result: Record<string, unknown> = { ...templateDefaults };
  for (const champ of overrides) {
    if (champ in local) result[champ] = local[champ];
  }
  return result as T;
}

/**
 * Defaults SchoolConfig par famille de template — source unique,
 * utilisée par le seed et la publication de version (V0.4).
 *
 * Les valeurs sont alignées sur les @default du schéma Prisma SchoolConfig
 * et sur les calculs d'ActiverEtablissementUseCase (passMark, schoolLanguageMode).
 */
export function defaultsConfigLocalePourTemplate(meta: {
  isAnglophone: boolean;
  isPrimaire: boolean;
  langMode: 'francophone' | 'anglophone' | 'bilingual';
}): Record<ChampConfigLocale, unknown> {
  const passMark = meta.isAnglophone ? 50 : 10; // /100 EN vs /20 FR (cf. ActiverEtablissementUseCase.ts:48)
  return {
    schoolLanguageMode: meta.langMode,
    passMark,
    councilPassMark: 10,
    maxAbsences: 10,
    // true = un retard compte comme une absence pour le calcul de décision du conseil de classe
    attendanceLateAsAbsence: true,
    legalMaxContributionFirstCycle: 7500,
    legalMaxContributionSecondCycle: 10000,
    bulletinBlockOnUnpaidFees: false,
    smsEnabled: false,
    offlineModeEnabled: true,
    aiAlertsEnabled: true,
    messageModeration: false,
  };
}
