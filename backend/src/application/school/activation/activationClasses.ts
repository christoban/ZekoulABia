import type { SchoolActivationTx } from '@domain/ports/repositories/SchoolActivationRepository';
import { NIVEAU_MAP } from '../SubjectAssignmentHelper';

export interface ClasseDefinition {
  name: string;
  level: string;
  schoolId: string;
  serie?: string | null;
  filiere?: string | null;
  pebsMixte?: boolean;
}

export interface ClassesCreationParams {
  tx: SchoolActivationTx;
  config: Record<string, unknown>;
  schoolId: string;
  academicYearId: string;
  templateCode: string | undefined;
  isTechnique: boolean;
  isAnglophone: boolean;
  isComplexe: boolean;
  hasPEBSFrancophone: boolean;
  hasPEBSAnglophone: boolean;
}

export interface ClassesCreationResult {
  classesACreer: ClasseDefinition[];
  enSixthClassNames: Set<string>;
  classCount: number;
}

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const FILIERES_TECHNIQUES_PATTERNS = [/^TI/, /F · G · H/, /technique/i];
function estFiliereTechnique(filiereLabel: string): boolean {
  return FILIERES_TECHNIQUES_PATTERNS.some((p) => p.test(filiereLabel));
}
function extraireSerie(filiereLabel: string): string {
  const m = filiereLabel.match(/^([A-Z0-9]+)/);
  return m?.[1] ?? filiereLabel;
}

export async function genererEtSauvegarderClasses(params: ClassesCreationParams): Promise<ClassesCreationResult> {
  const {
    tx,
    config,
    schoolId,
    academicYearId,
    templateCode,
    isTechnique,
    isAnglophone,
    isComplexe,
    hasPEBSFrancophone,
    hasPEBSAnglophone,
  } = params;

  const classesACreer: ClasseDefinition[] = [];
  const enSixthClassNames = new Set<string>();

  // 4a. 1er cycle (filière technique propre OU filière PEBS/GENERAL)
  const niveaux1erCycle = (config.niveaux1erCycle as string[] | undefined) ?? [];
  if (niveaux1erCycle.length > 0) {
    const conv = (config.conventionNommage as string | undefined) ?? 'LETTRES';
    const filieresTech: string[] = (config.filieresTechniques as string[] | undefined) ?? [];
    for (const niveau of niveaux1erCycle) {
      if (isTechnique && filieresTech.length > 0) {
        const levelNormTech = isAnglophone ? niveau.replace(/\s+/g, '') : niveau;
        for (const fil of filieresTech) {
          classesACreer.push({ name: `${niveau} ${fil}`, level: levelNormTech, schoolId, filiere: fil });
        }
      } else {
        const count = (config.classesParNiveau as Record<string, number> | undefined)?.[niveau] ?? 2;
        const levelNorm = isAnglophone ? niveau.replace(/\s+/g, '') : niveau;
        const pebsIndex: Record<string, string> = {};
        if (Array.isArray(config.pebsOrganisation)) {
          for (const rule of config.pebsOrganisation as Array<{ className: string; statut: string }>) {
            pebsIndex[rule.className] = rule.statut;
          }
        }
        for (let i = 0; i < Math.min(count, 26); i++) {
          const suffix = conv === 'LETTRES' ? LETTRES[i] : conv === 'CHIFFRES' ? `${i + 1}` : `${LETTRES[i]}1`;
          const className = `${niveau} ${suffix}`;
          const pebsStatut = pebsIndex[className];
          let filiere: string;
          if (pebsStatut === 'PEBS_PUR') {
            filiere = isAnglophone ? 'EN_PEBS' : 'FR_PEBS';
          } else if (pebsStatut === 'MIXTE') {
            filiere = isAnglophone ? 'EN_GENERAL' : 'FR_GENERAL';
            classesACreer.push({ name: className, level: levelNorm, schoolId, filiere, pebsMixte: true });
            continue;
          } else if (pebsStatut === 'NON_PEBS') {
            filiere = isAnglophone ? 'EN_GENERAL' : 'FR_GENERAL';
          } else {
            const isPEBSClass =
              i === 0 &&
              ((hasPEBSFrancophone && !isAnglophone) || (hasPEBSAnglophone && isAnglophone));
            filiere = isPEBSClass
              ? isAnglophone
                ? 'EN_PEBS'
                : 'FR_PEBS'
              : isAnglophone
                ? 'EN_GENERAL'
                : 'FR_GENERAL';
          }
          classesACreer.push({ name: className, level: levelNorm, schoolId, filiere });
        }
      }
    }
  }

  // 4b. 2e cycle
  let filieres = (config.filieres as string[] | undefined) ?? [];
  if (hasPEBSFrancophone) {
    const hasABI = filieres.some((f: string) => /^ABI/.test(f));
    if (!hasABI) {
      filieres = [...filieres, 'ABI — A Bilingue (Intensive English)'];
    }
  }

  const niveaux2eCycle = (config.niveaux2eCycle as string[] | undefined) ?? [];
  const classesParFiliere = config.classesParFiliere as string | undefined;
  if (niveaux2eCycle.length > 0 && filieres.length > 0) {
    const nbClasses = classesParFiliere === '3+' ? 3 : parseInt(classesParFiliere ?? '1');
    const bacCombosRaw = await tx.findBacCombos();
    const validBacCombos = new Set(bacCombosRaw.map((b) => `${b.niveau}|${b.serie}`));

    const EN_LEVEL_ORDER = ['Form4', 'Form5', 'LowerSixth', 'UpperSixth'];
    const streamStartMap: Record<string, string> = { FORM4: 'Form4', FORM5: 'Form5', SIXTH: 'LowerSixth' };
    const streamThreshold: string | null =
      isAnglophone && config.enStreamStartLevel ? streamStartMap[config.enStreamStartLevel as string] ?? null : null;

    for (const niveau of niveaux2eCycle) {
      const niveauBac = NIVEAU_MAP[niveau];
      const levelNorm2 = isAnglophone ? niveau.replace(/\s+/g, '') : niveau;

      if (streamThreshold) {
        const levelIdx = EN_LEVEL_ORDER.indexOf(levelNorm2);
        const threshIdx = EN_LEVEL_ORDER.indexOf(streamThreshold);
        if (levelIdx >= 0 && levelIdx < threshIdx) {
          classesACreer.push({ name: niveau, level: levelNorm2, schoolId });
          continue;
        }
      }

      for (const filiere of filieres) {
        if (niveau === '2nde' && estFiliereTechnique(filiere)) continue;

        if (filiere.startsWith('A4') || filiere.includes('A4')) {
          if (niveauBac && !validBacCombos.has(`${niveauBac}|A4`)) continue;
          const a4Languages = config.a4Languages as string[] | undefined;
          const langs = a4Languages?.length ? a4Languages : ['LV'];
          for (const lang of langs) {
            classesACreer.push({ name: `${niveau} A4-${lang}`, level: levelNorm2, schoolId, serie: `A4-${lang}` });
          }
        } else {
          const serie = extraireSerie(filiere);
          if (niveauBac && !validBacCombos.has(`${niveauBac}|${serie}`)) continue;
          for (let i = 0; i < nbClasses; i++) {
            const suffix = nbClasses > 1 ? ` ${LETTRES[i]}` : '';
            classesACreer.push({ name: `${niveau} ${serie}${suffix}`, level: levelNorm2, schoolId, serie });
          }
        }
      }
    }
  }

  // 4b-bis. GTC_GTHS_EN — 2e cycle technique anglophone
  if (templateCode === 'GTC_GTHS_EN' && niveaux2eCycle.length > 0) {
    const filieresTechGths: string[] = (config.filieresTechniques as string[] | undefined) ?? [];
    for (const niveau of niveaux2eCycle) {
      const levelNormTech2 = niveau.replace(/\s+/g, '');
      for (const fil of filieresTechGths) {
        classesACreer.push({ name: `${niveau} ${fil}`, level: levelNormTech2, schoolId, filiere: fil });
      }
    }
  }

  // 4c. LYCEE_BILINGUE — EN section classes
  const bilingualEnLevels = (config.bilingualEnLevels as string[] | undefined) ?? [];
  if (templateCode === 'LYCEE_BILINGUE' && bilingualEnLevels.length > 0) {
    const enFilieres: string[] = (config.bilingualEnFilieres as string[] | undefined) ?? [];
    for (const niveau of bilingualEnLevels) {
      const levelNormEn = niveau.replace(/\s+/g, '');
      if (enFilieres.length === 0) {
        classesACreer.push({ name: `${niveau} EN`, level: levelNormEn, schoolId });
      } else {
        for (const filiere of enFilieres) {
          const serie = filiere.match(/^([A-Z][0-9])/)?.[1] ?? filiere;
          classesACreer.push({ name: `${niveau} ${serie}`, level: levelNormEn, schoolId });
        }
      }
    }
  }

  // 4d. PRIMARY_BILINGUAL — EN section classes
  if (templateCode === 'PRIMARY_BILINGUAL' && bilingualEnLevels.length > 0) {
    for (const niveau of bilingualEnLevels) {
      classesACreer.push({ name: `${niveau} EN`, level: niveau.replace(/\s+/g, ''), schoolId });
    }
  }

  // 4e. Primaire
  const niveauxPrimaire = (config.niveauxPrimaire as string[] | undefined) ?? [];
  const classesParNiveauPrimaire =
    (config.classesParNiveauPrimaire as Record<string, number> | undefined) ?? {};
  if (niveauxPrimaire.length > 0) {
    for (const niveau of niveauxPrimaire) {
      const count = classesParNiveauPrimaire[niveau] ?? 1;
      for (let i = 0; i < Math.min(count, 26); i++) {
        classesACreer.push({ name: `${niveau} ${LETTRES[i]}`, level: niveau, schoolId });
      }
    }
  }

  // 4e-pro. SAR_SM + CFM
  if (templateCode === 'SAR_SM') {
    for (const fil of ['SAR', 'SM'] as const) {
      classesACreer.push({ name: `Année1 ${fil}`, level: 'Année1', schoolId, filiere: fil });
      classesACreer.push({ name: `Année2 ${fil}`, level: 'Année2', schoolId, filiere: fil });
    }
  }
  if (templateCode === 'CFM') {
    const cfmFils: string[] = (config.cfmFilieres as string[] | undefined)?.length
      ? (config.cfmFilieres as string[])
      : ['SAR', 'SM', 'COUTURE'];
    for (const fil of cfmFils) {
      classesACreer.push({ name: `Année1 ${fil}`, level: 'Année1', schoolId, filiere: fil });
      classesACreer.push({ name: `Année2 ${fil}`, level: 'Année2', schoolId, filiere: fil });
    }
  }

  // 4e-nur. Nursery_EN
  if (templateCode === 'NURSERY_EN' && (config.nurseryLevels as string[] | undefined)?.length) {
    for (const lvl of config.nurseryLevels as string[]) {
      classesACreer.push({ name: lvl, level: lvl.replace(/\s+/g, ''), schoolId });
    }
  }

  // 4e-mat. Maternelle_FR
  if ((templateCode === 'MATERNELLE_FR' || isComplexe) && (config.maternelleSections as string[] | undefined)?.length) {
    for (const section of config.maternelleSections as string[]) {
      classesACreer.push({ name: section, level: section, schoolId });
    }
  }

  // 4e-EN. Second cycle anglophone (Sixth Form)
  if (Array.isArray(config.anglophoneStreams) && (config.anglophoneStreams as string[]).length > 0) {
    const sixthLevels: string[] = (config.niveauxSixth as string[] | undefined)?.length
      ? (config.niveauxSixth as string[])
      : ['LowerSixth', 'UpperSixth'];
    for (const niveau of sixthLevels) {
      const levelNorm = niveau.replace(/\s+/g, '');
      for (const combo of config.anglophoneStreams as string[]) {
        const name = `${levelNorm} ${combo}`;
        enSixthClassNames.add(name);
        classesACreer.push({ name, level: levelNorm, schoolId, serie: combo, filiere: 'EN_GENERAL' });
      }
    }
  }

  // Sauvegarder toutes les classes
  for (const c of classesACreer) {
    await tx.creerClasse({
      name: c.name,
      level: c.level,
      academicYearId,
      serie: c.serie ?? null,
      filiere: c.filiere ?? null,
      pebsMixte: c.pebsMixte ?? false,
    });
  }

  return { classesACreer, enSixthClassNames, classCount: classesACreer.length };
}
