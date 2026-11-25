/**
 * APPLICATION — Similarité de noms pour le matching approximatif (fuzzy matching).
 *
 * Pipeline conforme aux pratiques des systèmes de réconciliation d'identité réels
 * (pas une simple distance caractère par caractère sur la chaîne complète) :
 *   1. Normalisation (accents, casse, tirets, espaces multiples)
 *   2. Tokenisation en mots individuels
 *   3. Comparaison en "sac de mots" (chaque mot cherche son meilleur appariement
 *      dans l'autre liste) — insensible à l'ORDRE des mots, donc gère nativement
 *      "Jean Pierre Ndzi" vs "Pierre Jean Ndzi", pas seulement l'inversion nom/prénom.
 *   4. Similarité mot-à-mot via Jaro-Winkler, plus adapté que Levenshtein pour des
 *      noms courts (donne plus de poids aux préfixes communs — les fautes de frappe
 *      sur un nom sont plus souvent en fin qu'en début de mot).
 *
 * Aucune librairie externe : algorithmes courts, projet sans dépendances superflues
 * pour ce type d'utilitaire (voir CONVENTIONS.md).
 */

/** Normalise pour comparaison : casse, accents, tirets/apostrophes, espaces multiples. */
export function normalizeForMatch(s: string): string {
  const stripped = s.trim().toLowerCase().normalize('NFD').split('').filter(ch => {
    const code = ch.charCodeAt(0);
    return code < 0x0300 || code > 0x036f; // retire les diacritiques combinants
  }).join('');
  return stripped
    .replace(/[-']/g, ' ')   // "Marie-Claire" / "M'Barga" → mots séparés
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeForMatch(s).split(' ').filter(Boolean);
}

/** Distance de Levenshtein classique (programmation dynamique). Conservée comme utilitaire général. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(
        prevRow[j] + 1,       // suppression
        currRow[j - 1] + 1,   // insertion
        prevRow[j - 1] + cost // substitution
      ));
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
}

/** Similarité normalisée (0-1) basée sur Levenshtein, après normalisation accents/casse. */
export function stringSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(na, nb) / maxLen;
}

/**
 * Similarité de Jaro (0-1) — algorithme standard (Jaro, 1989).
 * Compare deux chaînes en cherchant les caractères communs dans une fenêtre de
 * proximité, puis pénalise les transpositions. Bien plus adapté que Levenshtein
 * aux noms courts avec petites variations.
 */
function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length, lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(lenA, lenB) / 2) - 1);
  const aMatches = new Array(lenA).fill(false);
  const bMatches = new Array(lenB).fill(false);
  let matches = 0;

  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, lenB);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions = Math.floor(transpositions / 2);

  return (matches / lenA + matches / lenB + (matches - transpositions) / matches) / 3;
}

/**
 * Similarité de Jaro-Winkler (0-1) — bonifie le score de Jaro selon la longueur du
 * préfixe commun (jusqu'à 4 caractères), reflétant le fait qu'un préfixe partagé est
 * un signal fort de parenté entre deux noms.
 */
function jaroWinklerSimilarity(a: string, b: string): number {
  const jaro = jaroSimilarity(a, b);
  const maxPrefix = 4;
  let prefixLen = 0;
  for (let i = 0; i < Math.min(maxPrefix, a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    prefixLen++;
  }
  return jaro + prefixLen * 0.1 * (1 - jaro);
}

function bestWordMatch(word: string, candidates: string[]): number {
  let best = 0;
  for (const c of candidates) {
    const sim = jaroWinklerSimilarity(word, c);
    if (sim > best) best = sim;
  }
  return best;
}

/**
 * Compare (nom, prénom) d'une ligne importée à (nom, prénom) d'un profil existant,
 * en traitant l'ensemble comme un "sac de mots" plutôt que deux champs figés.
 * Insensible à l'ordre : "Jean Pierre Ndzi" vs "Ndzi Pierre Jean" obtient le même
 * score. Chaque mot d'un côté cherche son meilleur appariement de l'autre côté ;
 * le score final est le MINIMUM des deux moyennes directionnelles (pas la moyenne
 * des deux) — un mot en trop ou manquant d'un côté doit faire baisser le score,
 * pas être noyé par les autres mots qui matchent bien. Volontairement conservateur :
 * mieux vaut rater une correspondance probable que valider un faux rapprochement.
 */
export function compareNames(rowNom: string, rowPrenom: string, refNom: string, refPrenom: string): number {
  const wordsRow = [...tokenize(rowNom), ...tokenize(rowPrenom)];
  const wordsRef = [...tokenize(refNom), ...tokenize(refPrenom)];
  if (wordsRow.length === 0 || wordsRef.length === 0) return 0;

  const avg = (words: string[], against: string[]) =>
    words.map(w => bestWordMatch(w, against)).reduce((s, x) => s + x, 0) / words.length;

  return Math.min(avg(wordsRow, wordsRef), avg(wordsRef, wordsRow));
}
