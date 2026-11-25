import type { SchoolStructureSyncRepository } from '@domain/ports/repositories/SchoolStructureSyncRepository';
import type { SubjectAssignmentRepository } from '@domain/ports/repositories/SubjectAssignmentRepository';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import {
  assignerMatieresPourClasse,
  CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS,
  parseSerie as syncParseSerie,
} from '@application/school/SubjectAssignmentHelper';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FR_DEPT_TEMPLATES = ['LYCEE_FR', 'PRIVE_FR', 'CES_FR', 'LYCEE_BILINGUE'];
const EN_DEPT_TEMPLATES = ['GHS_EN', 'GSS_EN', 'PRIVE_EN'];

interface DeptDef {
  name: string;
  color: string;
  keywords: string[];
}

function appendCycle1Classes(
  cfg: Record<string, unknown>,
  classes: { name: string; level: string }[],
): void {
  const niveaux1erCycle = cfg['niveaux1erCycle'] as string[] | undefined;
  const classesParNiveau = cfg['classesParNiveau'] as Record<string, number> | undefined;
  if (!niveaux1erCycle) return;

  const conv = (cfg['conventionNommage'] as string | undefined) ?? 'LETTRES';
  for (const n of niveaux1erCycle) {
    const c = classesParNiveau?.[n] ?? 2;
    for (let i = 0; i < Math.min(c, 26); i++) {
      const s = conv === 'LETTRES' ? ALPHABET[i]! : conv === 'CHIFFRES' ? `${i + 1}` : `${ALPHABET[i]!}1`;
      classes.push({ name: `${n} ${s}`, level: n });
    }
  }
}

function appendPrimaireClasses(
  cfg: Record<string, unknown>,
  classes: { name: string; level: string }[],
): void {
  const niveauxPrimaire = cfg['niveauxPrimaire'] as string[] | undefined;
  const classesParNiveauPrimaire = cfg['classesParNiveauPrimaire'] as Record<string, number> | undefined;
  if (!niveauxPrimaire) return;

  for (const n of niveauxPrimaire) {
    const c = classesParNiveauPrimaire?.[n] ?? 1;
    for (let i = 0; i < Math.min(c, 26); i++) {
      classes.push({ name: `${n} ${ALPHABET[i]!}`, level: n });
    }
  }
}

export function buildPreviewClassesFromConfig(cfg: Record<string, unknown>): { name: string; level: string }[] {
  const classes: { name: string; level: string }[] = [];
  appendCycle1Classes(cfg, classes);

  const niveaux2eCycle = cfg['niveaux2eCycle'] as string[] | undefined;
  const filieres = cfg['filieres'] as string[] | undefined;
  const classesParFiliere = cfg['classesParFiliere'] as string | undefined;
  const a4Languages = cfg['a4Languages'] as string[] | undefined;
  if (niveaux2eCycle && filieres) {
    const nb = classesParFiliere === '3+' ? 3 : parseInt(classesParFiliere ?? '1');
    for (const n of niveaux2eCycle) {
      for (const f of filieres) {
        if (n === '2nde' && (/^TI/.test(f) || /F\s*·\s*G\s*·\s*H/.test(f) || /technique/i.test(f))) continue;
        if (f.startsWith('A4') || f.includes('A4')) {
          for (const lang of (a4Languages?.length ? a4Languages : ['LV'])) {
            classes.push({ name: `${n} A4-${lang}`, level: n });
          }
        } else {
          const short = f.split('—')[0]?.trim() ?? f;
          for (let i = 0; i < nb; i++) {
            classes.push({ name: `${n} ${short}${nb > 1 ? ` ${ALPHABET[i]}` : ''}`, level: n });
          }
        }
      }
    }
  }

  appendPrimaireClasses(cfg, classes);
  return classes;
}

export function buildExpectedStructureClasses(cfg: Record<string, unknown>): { name: string; level: string }[] {
  const classes: { name: string; level: string }[] = [];
  appendCycle1Classes(cfg, classes);
  appendPrimaireClasses(cfg, classes);
  return classes;
}

function buildDeptDefinitions(templateCode: string, subjectNamesLower: Set<string>): DeptDef[] {
  const isFr = FR_DEPT_TEMPLATES.includes(templateCode);
  const deptDefs: DeptDef[] = isFr
    ? [
        { name: 'Lettres', color: '#3b82f6', keywords: ['français', 'littérature', 'philosophie', 'écriture', 'lecture', 'grammaire', 'francais', 'litterature'] },
        { name: 'Sciences Humaines', color: '#f59e0b', keywords: ['histoire', 'géographie', 'éducation civique', 'ecm', 'hgg', 'h-g', 'geographie'] },
        { name: 'Langues Vivantes', color: '#10b981', keywords: ['anglais', 'allemand', 'espagnol', 'langue vivante', 'lv1', 'lv2', 'lvent', 'lv', 'english'] },
        { name: 'Mathématiques et Sciences', color: '#ef4444', keywords: ['mathématiques', 'maths', 'math', 'physique', 'chimie', 'svt', 'science'] },
        { name: 'Arts et Culture', color: '#f97316', keywords: ['art', 'musique', 'danse', 'culture', 'éducation artistique', 'education artistique'] },
      ]
    : [
        { name: 'Languages', color: '#3b82f6', keywords: ['english', 'french', 'literature', 'language', 'linguistics'] },
        { name: 'Social Sciences', color: '#f59e0b', keywords: ['history', 'geography', 'social', 'civics', 'economics'] },
        { name: 'Sciences', color: '#ef4444', keywords: ['mathematics', 'math', 'physics', 'chemistry', 'biology', 'science'] },
        { name: 'Technical', color: '#8b5cf6', keywords: ['computer', 'ict', 'technology', 'technical', 'engineering', 'design'] },
        { name: 'PE & Arts', color: '#10b981', keywords: ['physical', 'pe', 'sport', 'art', 'music', 'drama', 'health'] },
      ];

  if (isFr && subjectNamesLower.has('informatique')) {
    deptDefs.push({ name: 'Informatique', color: '#8b5cf6', keywords: ['informatique', 'tic', 'ntic', 'computer', 'technologie'] });
  }
  deptDefs.push({ name: isFr ? 'Autres' : 'Others', color: '#9ca3af', keywords: [] });
  return deptDefs;
}

async function creerDepartementsSiAbsents(
  repo: SchoolStructureSyncRepository,
  schoolId: string,
  templateCode: string,
): Promise<void> {
  const deptCount = await repo.countDepartments(schoolId);
  if (deptCount !== 0 || !templateCode) return;

  const allTemplates = [...FR_DEPT_TEMPLATES, ...EN_DEPT_TEMPLATES];
  if (!allTemplates.includes(templateCode)) return;

  const meta = getTemplateMeta(templateCode);
  if (meta.isPrimaire) return;

  const allSubjects = await repo.findSubjectsSummary(schoolId);
  const subjectNamesLower = new Set(allSubjects.map((s) => s.name.toLowerCase()));
  const deptDefs = buildDeptDefinitions(templateCode, subjectNamesLower);

  const matchedSubjectIds = new Set<string>();
  const createdIds: { id: string; name: string }[] = [];
  for (const def of deptDefs) {
    const d = await repo.createDepartment(schoolId, def.name, def.color);
    createdIds.push({ id: d.id, name: def.name });
    if (def.keywords.length > 0) {
      const matching = allSubjects.filter(
        (s) => !matchedSubjectIds.has(s.id) && def.keywords.some((kw) => s.name.toLowerCase().includes(kw)),
      );
      for (const subj of matching) {
        matchedSubjectIds.add(subj.id);
        await repo.assignSubjectDepartment(subj.id, d.id);
      }
    }
  }

  const fallback = createdIds[createdIds.length - 1];
  if (fallback) {
    for (const subj of allSubjects) {
      if (!matchedSubjectIds.has(subj.id)) {
        await repo.assignSubjectDepartment(subj.id, fallback.id);
      }
    }
  }
}

export async function executerSyncSubjects(
  repo: SchoolStructureSyncRepository,
  subjectAssignmentRepo: SubjectAssignmentRepository,
  schoolId: string,
  config: Record<string, unknown>,
  templateCode: string,
): Promise<{
  classesTraitees: number;
  classesSkippees: number;
  subjectsCreated: number;
  coefficientsCreated: number;
  detail: { className: string; action: string }[];
}> {
  const isAnglophone = getTemplateMeta(templateCode).isAnglophone;
  const classes = await repo.findClassesForSync(schoolId);
  const schoolSubjects = await repo.findSubjectsSummary(schoolId);
  const subjectByName = new Map(schoolSubjects.map((s) => [s.name, s.id]));
  const subjectCountRef = { value: 0 };

  let classesTraitees = 0;
  let classesSkippees = 0;
  let coefficientsCreated = 0;
  const detail: { className: string; action: string }[] = [];

  for (const cls of classes) {
    if (!cls.level) {
      classesSkippees++;
      continue;
    }

    const seriePart = syncParseSerie(cls.name, cls.level);
    const nameParts = cls.name.split(' ');
    const rawSerie = (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level) ? (nameParts[1] ?? '') : '';
    const dashIdx = rawSerie.indexOf('-');
    const effectiveSerieCode = seriePart === 'A4' && dashIdx >= 0
      ? rawSerie
      : seriePart ?? cls.filiere ?? null;

    const existing = await repo.countSubjectCoefficients(schoolId, {
      classLevel: cls.level,
      serieCode: effectiveSerieCode ?? null,
    });
    if (existing > 0) {
      classesSkippees++;
      detail.push({ className: cls.name, action: 'skipped (coefficients already exist)' });
      continue;
    }

    if (!cls.serie && seriePart && (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level)) {
      await repo.updateClassSerie(cls.id, effectiveSerieCode);
    }

    const beforeCoeffs = await repo.countSubjectCoefficients(schoolId);

    await assignerMatieresPourClasse(
      subjectAssignmentRepo,
      { name: cls.name, level: cls.level, filiere: cls.filiere ?? undefined },
      schoolId,
      config,
      isAnglophone,
      subjectByName,
      subjectCountRef,
      templateCode,
    );

    const afterCoeffs = await repo.countSubjectCoefficients(schoolId);
    coefficientsCreated += afterCoeffs - beforeCoeffs;
    classesTraitees++;
    detail.push({ className: cls.name, action: 'processed' });
  }

  await creerDepartementsSiAbsents(repo, schoolId, templateCode);

  return {
    classesTraitees,
    classesSkippees,
    subjectsCreated: subjectCountRef.value,
    coefficientsCreated,
    detail,
  };
}
