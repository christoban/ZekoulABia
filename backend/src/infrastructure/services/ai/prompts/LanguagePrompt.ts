import type { Language } from '@domain/policies/LanguagePolicy';

/** Instruction de langue à injecter dans un prompt système Groq. */
export function instructionLangue(lang: Language): string {
  return lang === "fr" ? "Réponds toujours en français." : "Answer always in English.";
}
