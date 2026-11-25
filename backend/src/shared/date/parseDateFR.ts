/**
 * UTILS — Parsing de dates de naissance venant de sources externes (Excel, IA, formulaires).
 *
 * Toujours construire en UTC (Date.UTC), jamais new Date(année, mois, jour) en heure
 * locale : le serveur tourne en Africa/Lagos (UTC+1), et une construction en heure locale
 * se retrouve décalée d'un jour en arrière une fois stockée/affichée en UTC. Source unique
 * de cette logique — ne pas la réimplémenter ailleurs (déjà dupliquée 2 fois avant ce fichier).
 *
 * Accepte ISO (AAAA-MM-JJ) et JJ/MM/AAAA (format le plus courant dans les fichiers
 * camerounais). Retourne null si le format n'est reconnu — à l'appelant de décider
 * s'il faut lever une erreur ou ignorer silencieusement (contextes différents selon
 * qu'une date est obligatoire ou juste un signal de matching optionnel).
 */
export function parseDateFR(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return isValidUtcDate(d, Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) ? d : null;
  }

  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const day = Number(fr[1]), month = Number(fr[2]) - 1, year = Number(fr[3]);
    const d = new Date(Date.UTC(year, month, day));
    return isValidUtcDate(d, year, month, day) ? d : null;
  }

  return null;
}

function isValidUtcDate(d: Date, year: number, month: number, day: number): boolean {
  return !isNaN(d.getTime()) && d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}
