/**
 * Language resolution policy — SOURCE UNIQUE DE VÉRITÉ pour la résolution de
 * langue d'affichage / communication dans tout le projet.
 *
 * Utilise `School.subsystem` et (pour les établissements bilingues) `Section.code`.
 * NE PAS créer d'autre fonction de résolution de langue — toujours passer par ici.
 */

export type Language = "fr" | "en";

/** Valeurs telles que stockées : enum `SchoolSubsystem`. */
export type Subsystem = "FRANCOPHONE" | "ANGLOPHONE" | "BILINGUAL";
/** Valeurs telles que stockées : enum `SectionLanguage`. */
export type SectionCode = "FR" | "EN";

/**
 * Résout la langue d'affichage/communication — UNIQUE point d'entrée.
 * @param subsystem   `School.subsystem` (FRANCOPHONE | ANGLOPHONE | BILINGUAL)
 * @param sectionCode `Section.code` (FR | EN) de l'utilisateur/élève concerné —
 *                    utile uniquement en établissement bilingue.
 *
 * Règle : ANGLOPHONE → 'en' ; BILINGUAL + section EN → 'en', sinon → 'fr' ;
 * FRANCOPHONE / défaut → 'fr'.
 */
export function resolveLanguage(
  subsystem: Subsystem | string | null | undefined,
  sectionCode?: SectionCode | string | null,
): Language {
  if (subsystem === "ANGLOPHONE") return "en";
  if (subsystem === "BILINGUAL") return sectionCode === "EN" ? "en" : "fr";
  return "fr";
}
