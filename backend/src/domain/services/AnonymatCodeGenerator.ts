import { randomInt } from 'crypto';

/** Lettres sans I/O ; chiffres sans 0/1 → lisibilité maximale */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/**
 * Format imposé : 2 lettres + 2 chiffres (ex: KP73, AX92, MH48)
 * Unique au sein d'un Set fourni (la session).
 */
export function generateAnonymatCode(existingCodes: Set<string>): string {
  const MAX_ATTEMPTS = 200;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code =
      LETTERS[randomInt(LETTERS.length)] +
      LETTERS[randomInt(LETTERS.length)] +
      DIGITS[randomInt(DIGITS.length)] +
      DIGITS[randomInt(DIGITS.length)];
    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
  }
  throw new Error("Impossible de générer un code d'anonymat unique (espace saturé)");
}

/** Génère N codes uniques d'un coup */
export function generateAnonymatCodes(count: number): string[] {
  const set = new Set<string>();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateAnonymatCode(set));
  }
  return codes;
}
