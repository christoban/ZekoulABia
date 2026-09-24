import type { CaseGrille, ExigenceSeance, SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';

const CATEGORIE_EPS_TM = 'EPS_TM' as const;

/**
 * Variantes reconnues après normalisation FR/EN. Le type de matière n'entre jamais dans la
 * décision : EPS = éducation physique ; TM = travaux manuels.
 */
const NOMS_EPS_TM = new Set([
  'eps',
  'tm',
  'education physique et sportive',
  'education physique',
  'sport',
  'physical and health education',
  'physical development and games',
  'expression corporelle eps',
  'sport and physical education',
  'physical education',
  'physical education and sports',
  'travaux manuels',
  'travail manuel',
  'travaux manuels technologie',
  'dessin travaux manuels',
  'manual work',
  'manual work and technology',
  'technical and manual work',
  'vocational studies',
]);

export function calculerCategorieJoursDistincts(subjectName: string): 'EPS_TM' | undefined {
  const nomNormalise = subjectName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return NOMS_EPS_TM.has(nomNormalise) ? CATEGORIE_EPS_TM : undefined;
}

export function exigeDeuxJours(exigence: Pick<ExigenceSeance, 'categorieJoursDistincts' | 'nbOccurrencesHebdomadaires'>): boolean {
  return exigence.categorieJoursDistincts === CATEGORIE_EPS_TM && exigence.nbOccurrencesHebdomadaires === 2;
}

export function validerReglesPedagogiquesProposition(
  seances: SeanceProposee[],
  exigences: ExigenceSeance[],
  grille: CaseGrille[],
): void {
  const attenduParMatiere = new Map<string, ExigenceSeance>();
  for (const exigence of exigences) {
    if (!attenduParMatiere.has(exigence.subjectId)) attenduParMatiere.set(exigence.subjectId, exigence);
  }

  const positions = new Map<string, number>();
  const casesParJour = new Map<number, number[]>();
  for (const [index, cas] of grille.entries()) {
    const cases = casesParJour.get(cas.dayOfWeek) ?? [];
    cases.push(index);
    casesParJour.set(cas.dayOfWeek, cases);
  }
  for (const cases of casesParJour.values()) {
    cases.sort((a, b) => grille[a]!.startTime.localeCompare(grille[b]!.startTime));
    cases.forEach((index, position) => {
      const cas = grille[index]!;
      positions.set(cleCas(cas.dayOfWeek, cas.startTime, cas.endTime), position);
    });
  }

  const casesOccupees = new Set<string>();
  const seancesParMatiere = new Map<string, SeanceProposee[]>();
  for (const seance of seances) {
    const cle = cleCas(seance.dayOfWeek, seance.startTime, seance.endTime);
    if (!positions.has(cle)) throw new Error(`Proposition invalide : créneau hors grille pour la matière ${seance.subjectId}`);
    if (casesOccupees.has(cle)) throw new Error('Proposition invalide : plusieurs matières sur une même case de cours');
    casesOccupees.add(cle);

    const attendu = attenduParMatiere.get(seance.subjectId);
    if (!attendu) throw new Error(`Proposition invalide : matière ${seance.subjectId} absente des affectations de la classe`);

    const groupe = seancesParMatiere.get(seance.subjectId) ?? [];
    groupe.push(seance);
    seancesParMatiere.set(seance.subjectId, groupe);
  }

  for (const [subjectId, attendu] of attenduParMatiere) {
    const groupe = seancesParMatiere.get(subjectId) ?? [];
    const nbAttendues = attendu.nbOccurrencesHebdomadaires;
    if (nbAttendues != null && groupe.length !== nbAttendues) {
      throw new Error(`Proposition invalide : la matière ${sujet(attendu)} attend ${nbAttendues} occurrence(s), mais ${groupe.length} sont fournies`);
    }
    const parJour = new Map<number, SeanceProposee[]>();
    for (const seance of groupe) {
      const seancesJour = parJour.get(seance.dayOfWeek) ?? [];
      seancesJour.push(seance);
      parJour.set(seance.dayOfWeek, seancesJour);
    }
    for (const seancesJour of parJour.values()) {
      if (seancesJour.length > 2) {
        throw new Error(`Proposition invalide : la matière ${sujet(attendu)} dépasse 2 occurrences dans une journée`);
      }
      if (seancesJour.length === 2) {
        const cases = seancesJour
          .map(seance => positions.get(cleCas(seance.dayOfWeek, seance.startTime, seance.endTime))!)
          .sort((a, b) => a - b);
        if (cases[1]! - cases[0]! !== 1) {
          throw new Error(`Proposition invalide : les occurrences de la matière ${sujet(attendu)} ne sont pas contiguës dans la grille de cours`);
        }
      }
    }

    if (exigeDeuxJours(attendu) && parJour.size !== 2) {
      throw new Error(`Proposition invalide : la matière ${sujet(attendu)} doit être répartie sur deux jours différents`);
    }
  }
}

function cleCas(dayOfWeek: number, startTime: string, endTime: string): string {
  return `${dayOfWeek}|${startTime}|${endTime}`;
}

function sujet(exigence: ExigenceSeance): string {
  return exigence.subjectName ?? exigence.subjectId;
}
