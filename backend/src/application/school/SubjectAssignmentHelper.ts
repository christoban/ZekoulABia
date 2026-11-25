/**
 * Helpers pour l'assignation des matières et coefficients par classe.
 * Utilisé par ActiverEtablissementUseCase (activation) et
 * la route POST /api/v2/schools/:id/sync-subjects (rattrapage).
 */
import type { SubjectAssignmentRepository } from '@domain/ports/repositories/SubjectAssignmentRepository';
import { CycleResolver } from '@domain/services/CycleResolver';

export const CYCLE1_ORDER: ReadonlyArray<string> = ['6e', '5e', '4e', '3e'];
export const CYCLE2_LEVELS: ReadonlyArray<string> = ['2nde', '1ere', '1ère', 'Tle'];

export const NIVEAU_MAP: Readonly<Record<string, string>> = {
  '2nde': 'SECONDE',
  '1ere': 'PREMIERE',
  '1ère': 'PREMIERE',
  'Tle':  'TERMINALE',
};

/**
 * Parse le code série depuis le nom d'une classe de 2e cycle.
 * "1ère A4-Arabe" → "A4" ; "Tle C A" → "C" ; "6e A" → null
 */
export function parseSerie(className: string, level: string): string | null {
  if (!CycleResolver.isSecondCycle(level) && !(CYCLE2_LEVELS as string[]).includes(level)) return null;
  const parts = className.split(' ');
  const raw = parts[1];
  if (!raw) return null;
  const dashIdx = raw.indexOf('-');
  return dashIdx >= 0 ? raw.slice(0, dashIdx) : raw;
}

// Matières 1er cycle FR — données dans curriculum/francophone/premier-cycle.ts
// Le seed peuple CycleCoefficient depuis ce fichier → ce fallback n'est plus nécessaire
// (gardé vide pour compatibilité si CycleCoefficient non encore seedé)
type SubjectDef = { name: string; coefficient: number; hoursPerWeek: number }
const CYCLE1_FR_SUBJECTS: Record<string, SubjectDef[]> = {};

// ─────────────────────────────────────────────
// Sous-ensembles Sixth Form (Arts / Sciences)
// ─────────────────────────────────────────────
const MATIERES_SIXTH_ARTS = [
  "English Language","Literature in English","French","History",
  "Geography","Economics","Philosophy","Additional Mathematics"
]

const MATIERES_SIXTH_SCIENCES = [
  "Mathematics","Physics","Chemistry","Biology",
  "Computer Science","Geology","Additional Mathematics"
]

/**
 * Crée le Subject s'il n'existe pas encore (par nom, dans l'école).
 * Retourne l'id dans tous les cas.
 */
export async function getOrCreateSubject(
  repo: SubjectAssignmentRepository,
  schoolId: string,
  name: string,
  coefficient: number,
  subjectByName: Map<string, string>,
  subjectCountRef: { value: number },
  hoursPerWeek: number = 2,
): Promise<string> {
  let id = subjectByName.get(name);
  if (!id) {
    const code = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    const created = await repo.createSubject(schoolId, { name, code, coefficient, hoursPerWeek });
    id = created.id;
    subjectByName.set(name, id);
    subjectCountRef.value++;
  }
  return id;
}

/**
 * Crée les SubjectCoefficients pour une classe donnée.
 *
 * B.1 — 1er cycle (6e/5e/4e/3e) : pack fixe 8 matières + LV2 si applicable
 * B.2 — 2e cycle (2nde/1ère/Tle) : BacCoefficients, LV2→langue réelle pour A4
 * B.3 — Anglophone (Form1→U6) : coefficients officiels GCE Board
 *
 * Idempotent grâce aux upserts (safe à appeler plusieurs fois pour le même niveau).
 */
export async function assignerMatieresPourClasse(
  repo: SubjectAssignmentRepository,
  classe: { name: string; level: string; filiere?: string | null },
  schoolId: string,
  config: Record<string, unknown>,
  isAnglophone: boolean,
  subjectByName: Map<string, string>,
  subjectCountRef: { value: number },
  templateCode: string = '',
): Promise<void> {
  const { level, filiere } = classe;

  async function assignerMatieresAnglophones() {
    if (!templateCode) return;
    const loads = await repo.findAnglophoneSubjectLoads(templateCode, level, filiere ?? 'EN_GENERAL');
    if (loads.length === 0) return;

    const loadMap = new Map<string, { coefficient: number; weeklyPeriods: number | null }>();
    for (const load of loads) {
      loadMap.set(load.subjectName, { coefficient: load.coefficient, weeklyPeriods: load.weeklyPeriods });
    }

    let subjectNames: string[];
    if (level === "LowerSixth" || level === "UpperSixth") {
      if (classe.name.includes("Arts") || /\bA[1-4]\b/.test(classe.name)) {
        subjectNames = MATIERES_SIXTH_ARTS;
      } else if (classe.name.includes("Sciences") || /\bS[1-4]\b/.test(classe.name)) {
        subjectNames = MATIERES_SIXTH_SCIENCES;
      } else {
        subjectNames = Array.from(loadMap.keys());
      }
    } else {
      subjectNames = Array.from(loadMap.keys());
    }

    for (const nomMatiere of subjectNames) {
      const entry = loadMap.get(nomMatiere);
      if (!entry) continue;
      const subjectId = await getOrCreateSubject(repo, schoolId, nomMatiere, entry.coefficient, subjectByName, subjectCountRef, entry.weeklyPeriods ?? 2);
      await repo.upsertSubjectCoefficient(schoolId, subjectId, level, null, entry.coefficient, entry.weeklyPeriods);
    }
  }

  // ── Fonction de rattrapage : crée SubjectCoefficients depuis toutes les matières ──
  // si aucune référence n'a matché (utile pour technique, primaire, etc.)
  async function ensureCoefficients() {
    const existing = await repo.findAnySubjectCoefficient(schoolId, level);
    if (!existing) {
      const allSubjects = await repo.findSubjects(schoolId);
      for (const subj of allSubjects) {
        const subjectId = await getOrCreateSubject(repo, schoolId, subj.name, subj.coefficient, subjectByName, subjectCountRef);
        await repo.upsertSubjectCoefficient(schoolId, subjectId, level, null, subj.coefficient, null);
      }
    }
  }

  // ── B.3 Anglophone ────────────────────────────────────────────────────────
  if (isAnglophone) {
    await assignerMatieresAnglophones();
    await ensureCoefficients();
    return;
  }

  // ── B.3b Bilingual EN section (LYCEE_BILINGUE classes with EN levels) ──
  if (templateCode === 'LYCEE_BILINGUE') {
    const hasEnLoads = await repo.findAnglophoneSubjectLoadExists(templateCode, level);
    if (hasEnLoads) {
      await assignerMatieresAnglophones();
      await ensureCoefficients();
      return;
    }
  }

  // ── B.1 Premier cycle ─────────────────────────────────────────────────────
  const niveaux1er: string[] = (config['niveaux1erCycle'] as string[] | undefined) ?? [...CYCLE1_ORDER];
  if (niveaux1er.includes(level)) {
    const filiere1er = filiere ?? 'FR_GENERAL';
    const cycleCoeffs = await repo.findCycleCoefficients(templateCode, level, filiere1er);

    if (cycleCoeffs.length > 0) {
      // Données officielles depuis CycleCoefficient (DB)
      for (const cc of cycleCoeffs) {
        const subjectId = await getOrCreateSubject(repo, schoolId, cc.subjectName, cc.coefficient, subjectByName, subjectCountRef, cc.weeklyPeriods ?? 2);
        await repo.upsertSubjectCoefficient(schoolId, subjectId, level, filiere1er, cc.coefficient, cc.weeklyPeriods);
      }
    } else if (!isAnglophone && CYCLE1_FR_SUBJECTS[level]) {
      // Fallback : programme 1er cycle FR en dur (CycleCoefficient non encore seedé)
      for (const def of CYCLE1_FR_SUBJECTS[level]!) {
        const subjectId = await getOrCreateSubject(repo, schoolId, def.name, def.coefficient, subjectByName, subjectCountRef, def.hoursPerWeek);
        await repo.upsertSubjectCoefficient(schoolId, subjectId, level, filiere1er, def.coefficient);
      }
    }
    // Si aucune donnée disponible → on ne touche rien (évite la contamination cross-niveau)
    return;
  }

  // ── B.2 Deuxième cycle ────────────────────────────────────────────────────
  const niveauBac = NIVEAU_MAP[level];
  if (!niveauBac) {
    // Niveau inconnu (technique, primaire, etc.) — c'est précisément le cas d'usage documenté
    // pour ensureCoefficients() ("utile pour technique, primaire, etc.", voir plus haut), mais
    // rien ne l'appelait ici jusqu'ici : ces classes ne recevaient jamais aucun SubjectCoefficient.
    await ensureCoefficients();
    return;
  }

  // "Tle A4-Arabe" → seriePart="A4", langueA4="Arabe"
  // "1ère C A"     → seriePart="C",  langueA4=null
  const nameParts = classe.name.split(' ');
  const serieRaw  = nameParts[1];
  if (!serieRaw) return; // Nom de classe malformé → on skip

  const dashIdx   = serieRaw.indexOf('-');
  const seriePart = dashIdx >= 0 ? serieRaw.slice(0, dashIdx) : serieRaw;
  const langueA4  = seriePart === 'A4' && dashIdx >= 0 ? serieRaw.slice(dashIdx + 1) : null;

  const bacCoeffs = await repo.findBacCoefficients(seriePart, niveauBac, templateCode);

  for (const bc of bacCoeffs) {
    // Pour A4 : "LV2" → langue réelle (ex. "Arabe")
    const subjectName = seriePart === 'A4' && bc.subjectName === 'LV2' && langueA4
      ? langueA4
      : bc.subjectName;

    const subjectId = await getOrCreateSubject(repo, schoolId, subjectName, bc.coefficient, subjectByName, subjectCountRef);
    const effectiveSerieCode = seriePart === 'A4' ? serieRaw : seriePart;
    await repo.upsertSubjectCoefficient(schoolId, subjectId, level, effectiveSerieCode, bc.coefficient, null);
  }
  // Pas de fallback ensureCoefficients() ici — évite la contamination cross-série
}
