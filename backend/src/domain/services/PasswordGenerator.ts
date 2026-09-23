import { randomInt } from 'crypto';

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*';
const ALL_CHARACTERS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

function choisir(caracteres: string): string {
  return caracteres[randomInt(caracteres.length)] ?? caracteres[0];
}

const DEV_DEFAULT_PASSWORD = 'Menedona@2005';

function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Génère un mot de passe temporaire lisible et composé de quatre catégories de caractères.
 *  En mode développement, retourne un mot de passe par défaut connu pour faciliter les tests. */
export function generateTemporaryPassword(length = 10): string {
  if (isDevMode()) {
    return DEV_DEFAULT_PASSWORD;
  }

  if (!Number.isInteger(length) || length < 4) {
    throw new Error('La longueur du mot de passe temporaire doit être au moins de 4 caractères');
  }

  const caracteres = [
    choisir(UPPERCASE),
    choisir(LOWERCASE),
    choisir(DIGITS),
    choisir(SYMBOLS),
  ];

  while (caracteres.length < length) caracteres.push(choisir(ALL_CHARACTERS));

  for (let index = caracteres.length - 1; index > 0; index -= 1) {
    const autreIndex = randomInt(index + 1);
    [caracteres[index], caracteres[autreIndex]] = [caracteres[autreIndex], caracteres[index]];
  }

  return caracteres.join('');
}