/**
 * DOMAIN LAYER — Règle métier pure d'expansion des postes génériques/composites
 * pour l'import du référentiel national (OfficialProgrammeProgression).
 *
 * Décisions métier actées (Phase 2A) :
 * - "LV2" est REMPLACÉ par les 5 langues vivantes II officielles MINESEC :
 *   Allemand, Arabe, Chinois, Espagnol, Italien.
 * - "Lettres classiques (Latin/Grec)" est REMPLACÉ par :
 *   - Latin uniquement en 6e et 5e ;
 *   - Latin et Grec en 4e et 3e.
 * - Aucune expansion n'a lieu si le catalogue du scope ne contient pas ces postes
 *   (ex. 2nde–Tle série A1 possède déjà Latin et Grec concrets ; C/D/TI n'ont ni LV2 ni classiques).
 * - "LV3" (série A5) n'est pas étendu ici.
 */

export const CONCRETE_LV2_SUBJECTS = [
  'Allemand',
  'Arabe',
  'Chinois',
  'Espagnol',
  'Italien',
] as const;

export const CONCRETE_CLASSICAL_SUBJECTS = ['Latin', 'Grec'] as const;

export const ABSTRACT_LV2_LABEL = 'LV2';
export const COMPOSITE_CLASSICAL_LABEL = 'Lettres classiques (Latin/Grec)';

function normaliserCle(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const CLE_LV2 = normaliserCle(ABSTRACT_LV2_LABEL);
const CLE_LETTRES_CLASSIQUES = normaliserCle(COMPOSITE_CLASSICAL_LABEL);

const NIVEAU_CANONIQUE_MAP: Record<string, string> = {
  '6e': '6e',
  '6eme': '6e',
  sixieme: '6e',
  '5e': '5e',
  '5eme': '5e',
  cinquieme: '5e',
  '4e': '4e',
  '4eme': '4e',
  quatrieme: '4e',
  '3e': '3e',
  '3eme': '3e',
  troisieme: '3e',
  '2nde': '2nde',
  seconde: '2nde',
  '1ere': '1ere',
  premiere: '1ere',
  tle: 'Tle',
  terminale: 'Tle',
};

/** Normalise une variante de libellé de niveau (ex. "4ème" → "4e", "1ère" → "1ere"). */
export function normaliserNiveauScolaire(level: string): string {
  const cle = normaliserCle(level);
  return NIVEAU_CANONIQUE_MAP[cle] ?? level.trim();
}

function estNiveauPremierCycleAvecGrec(level: string): boolean {
  const norm = normaliserNiveauScolaire(level);
  return norm === '4e' || norm === '3e';
}

function nomsClassiquesPourNiveau(level: string): readonly string[] {
  return estNiveauPremierCycleAvecGrec(level) ? CONCRETE_CLASSICAL_SUBJECTS : ['Latin'];
}

/**
 * Étend et déduplique la liste brute des matières officielles d'un scope (templateCode, level, filiere) :
 * - remplace "LV2" par les 5 langues vivantes concrètes ;
 * - remplace "Lettres classiques (Latin/Grec)" par "Latin" (6e–3e) et "Grec" (4e–3e uniquement) ;
 * - garantit zéro doublon (insensible à la casse/accents/espaces).
 */
export function etendreMatieresReferenceImport(
  matieresBrutes: readonly string[],
  level: string,
): string[] {
  const vues = new Set<string>();
  const resultat: string[] = [];

  const ajouterUnique = (nom: string) => {
    const canon = nom.trim();
    if (!canon) return;
    const cle = normaliserCle(canon);
    if (vues.has(cle)) return;
    vues.add(cle);
    resultat.push(canon);
  };

  for (const brute of matieresBrutes) {
    const cle = normaliserCle(brute);
    if (!cle) continue;

    if (cle === CLE_LV2) {
      for (const langue of CONCRETE_LV2_SUBJECTS) {
        ajouterUnique(langue);
      }
      continue;
    }

    if (cle === CLE_LETTRES_CLASSIQUES) {
      for (const classique of nomsClassiquesPourNiveau(level)) {
        ajouterUnique(classique);
      }
      continue;
    }

    ajouterUnique(brute);
  }

  return resultat;
}

/**
 * Retourne un message de rejet explicite si le nom envoyé correspond à un poste abstrait/composite
 * remplacé dans ce scope ("LV2" ou "Lettres classiques (Latin/Grec)"), en listant les noms concrets acceptés.
 */
export function expliquerRejetLibelleAbstrait(
  subjectNameBrut: string,
  matieresBrutesDuScope: readonly string[],
  level: string,
): string | null {
  const cleSaisie = normaliserCle(subjectNameBrut);
  const clesBrutes = new Set(matieresBrutesDuScope.map(normaliserCle));

  if (cleSaisie === CLE_LV2 && clesBrutes.has(CLE_LV2)) {
    return `Libellé générique « LV2 » non accepté à l'import : utilisez un nom concret (${CONCRETE_LV2_SUBJECTS.join(', ')}).`;
  }

  if (cleSaisie === CLE_LETTRES_CLASSIQUES && clesBrutes.has(CLE_LETTRES_CLASSIQUES)) {
    const acceptes = nomsClassiquesPourNiveau(level);
    return `Libellé composite « Lettres classiques (Latin/Grec) » non accepté à l'import : utilisez un nom séparé (${acceptes.join(', ')}).`;
  }

  return null;
}

