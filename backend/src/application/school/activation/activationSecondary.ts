import type { SchoolActivationTx, SchoolActivationData } from '@domain/ports/repositories/SchoolActivationRepository';
import { assignerMatieresPourClasse, parseSerie } from '../SubjectAssignmentHelper';
import type { ClasseDefinition } from './activationClasses';

export interface SecondarySubjectsParams {
  tx: SchoolActivationTx;
  school: SchoolActivationData;
  config: Record<string, unknown>;
  templateCode: string | undefined;
  classesACreer: ClasseDefinition[];
  enSixthClassNames: Set<string>;
  isPrimaire: boolean;
  isAnglophone: boolean;
}

export async function creerMatieresEtCoefficientsSecondaire(
  params: SecondarySubjectsParams,
): Promise<{ subjectCount: number }> {
  const {
    tx,
    school,
    config,
    templateCode,
    classesACreer,
    enSixthClassNames,
    isPrimaire,
    isAnglophone,
  } = params;

  let subjectCount = 0;

  // 4f-bis. Secondaire/Technique — créer les matières depuis template.config.defaultSubjects
  let effectiveTemplate: { config: unknown } | null = school.template;
  if (!effectiveTemplate && templateCode) {
    effectiveTemplate = await tx.findSchoolTemplate(templateCode);
  }
  const TEMPLATES_WITH_REFERENCE_DATA = [
    'LYCEE_FR',
    'CES_FR',
    'PRIVE_FR',
    'GHS_EN',
    'GSS_EN',
    'PRIVE_EN',
    'LYCEE_BILINGUE',
    'COMPLEXE_SCOLAIRE',
  ];
  const hasReferenceData = templateCode && TEMPLATES_WITH_REFERENCE_DATA.includes(templateCode);
  if (effectiveTemplate && !hasReferenceData && !isPrimaire) {
    const tCfg = (effectiveTemplate.config ?? {}) as Record<string, unknown>;
    interface TemplateSubjectDef {
      name: string;
      code: string;
      coefficient: number;
      hoursPerWeek?: number;
      subjectType?: string;
    }
    const frSubjects = (tCfg.defaultSubjects as TemplateSubjectDef[] | undefined) ?? [];
    const enSubjects = (tCfg.defaultSubjectsEN as TemplateSubjectDef[] | undefined) ?? [];

    for (const s of frSubjects) {
      await tx.creerMatiere({
        name: s.name,
        code: s.code,
        coefficient: s.coefficient,
        hoursPerWeek: s.hoursPerWeek ?? 2,
        subjectType: s.subjectType ?? 'THEORETICAL',
      });
    }
    for (const s of enSubjects) {
      await tx.creerMatiere({
        name: frSubjects.length > 0 ? `${s.name} (EN)` : s.name,
        code: frSubjects.length > 0 ? `${s.code}_EN` : s.code,
        coefficient: s.coefficient,
        hoursPerWeek: s.hoursPerWeek ?? 2,
        subjectType: s.subjectType ?? 'THEORETICAL',
      });
    }
    subjectCount += frSubjects.length + enSubjects.length;
  }

  // 4g. SubjectCoefficients pour toutes les classes — secondaire uniquement
  if (classesACreer.length > 0 && !isPrimaire) {
    const schoolSubjects = await tx.findMatieres();
    const subjectByName = new Map(schoolSubjects.map((s) => [s.name, s.id]));
    const subjectCountRef = { value: 0 };

    const processedKeys = new Set<string>();
    for (const c of classesACreer) {
      if (enSixthClassNames.has(c.name)) continue;
      const seriePart = parseSerie(c.name, c.level);
      const dedupKey =
        seriePart === 'A4'
          ? `${c.level}|${c.name}`
          : seriePart
            ? `${c.level}|${seriePart}`
            : `${c.level}|${c.filiere ?? ''}`;
      if (processedKeys.has(dedupKey)) continue;
      processedKeys.add(dedupKey);

      await assignerMatieresPourClasse(
        tx.subjectAssignment(),
        c,
        school.id,
        config,
        isAnglophone,
        subjectByName,
        subjectCountRef,
        school.templateCode ?? '',
      );
    }
    subjectCount += subjectCountRef.value;
  }

  // 4g-EN. Matières Sixth Form anglophone (stream combinations)
  if (Array.isArray(config?.anglophoneStreams) && config.anglophoneStreams.length > 0 && templateCode) {
    const comboCodes = config.anglophoneStreams as string[];
    const sixthLevels: string[] = (config.niveauxSixth as string[] | undefined)?.length
      ? (config.niveauxSixth as string[])
      : ['LowerSixth', 'UpperSixth'];

    const combos = await tx.findAnglophoneStreamCombinations(comboCodes);
    const existingSubjects = await tx.findMatieres();
    const subjectByName = new Map(existingSubjects.map((s) => [s.name, s.id]));

    for (const niveau of sixthLevels) {
      const levelNorm = niveau.replace(/\s+/g, '');
      const loads = await tx.findAnglophoneSubjectLoads(templateCode, levelNorm, 'EN_GENERAL');
      const loadMap = new Map(loads.map((l) => [l.subjectName, l]));

      for (const combo of combos) {
        const core = Array.isArray(combo.coreSubjects) ? (combo.coreSubjects as string[]) : [];
        const electives: string[] = Array.isArray(combo.electiveGroup)
          ? (combo.electiveGroup as string[][]).map((g) => (Array.isArray(g) ? g[0] : null)).filter((x): x is string => !!x)
          : [];
        const subjectNames = [...new Set([...core, ...electives])];

        for (const name of subjectNames) {
          const load = loadMap.get(name);
          const coeff = load?.coefficient ?? 1;
          const hours = load?.weeklyPeriods ?? 2;

          let subjectId = subjectByName.get(name);
          if (!subjectId) {
            const created = await tx.creerMatiere({
              name,
              code: name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
              coefficient: coeff,
              hoursPerWeek: hours,
            });
            subjectId = created.id;
            subjectByName.set(name, subjectId);
            subjectCount++;
          }

          const existing = await tx.findCoefficient(subjectId, levelNorm, combo.filiere);
          if (!existing) {
            await tx.creerCoefficient({ subjectId, classLevel: levelNorm, serieCode: combo.filiere, coefficient: coeff });
          }
        }
      }
    }
  }

  return { subjectCount };
}

export async function creerDepartementsSecondaire(
  tx: SchoolActivationTx,
  templateCode: string | undefined,
  isPrimaire: boolean,
  apcSubjectIds: string[],
): Promise<void> {
  if (templateCode && !isPrimaire) {
    const schoolSubjects = await tx.findMatieres(
      apcSubjectIds.length > 0 ? { excludeIds: apcSubjectIds } : undefined,
    );
    const DEPT_MERGE: Record<string, string> = {
      'Sciences': 'SVT',
      'SVTEEHB': 'SVT',
      'Physique-Chimie-Technologie': 'PCT',
      'Physique': 'PCT',
      'Chimie': 'PCT',
      'Anglais': 'Anglais',
      'English Language': 'Anglais',
      'Intensive English': 'Anglais',
      'Literature in English': 'Anglais',
      'Français': 'Français',
      'Langue Française': 'Français',
      'Littérature': 'Français',
    };
    const DEPT_COLORS = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
      '#14b8a6', '#f43f5e', '#d946ef', '#0ea5e9', '#22c55e',
    ];

    const subjectDeptMap = new Map<string, string>();
    for (const subj of schoolSubjects) {
      subjectDeptMap.set(subj.id, DEPT_MERGE[subj.name] ?? subj.name);
    }

    const deptGroups = new Map<string, string[]>();
    for (const [subjectId, deptName] of subjectDeptMap) {
      const group = deptGroups.get(deptName) ?? [];
      group.push(subjectId);
      deptGroups.set(deptName, group);
    }

    let colorIdx = 0;
    const sortedDeptNames = [...deptGroups.keys()].sort((a, b) => a.localeCompare(b));
    for (const deptName of sortedDeptNames) {
      const color = DEPT_COLORS[colorIdx % DEPT_COLORS.length];
      colorIdx++;
      const department = await tx.creerDepartement({ name: deptName, color });
      for (const subjectId of deptGroups.get(deptName)!) {
        await tx.mettreAJourMatiere(subjectId, { departmentId: department.id });
      }
    }
  }
}
