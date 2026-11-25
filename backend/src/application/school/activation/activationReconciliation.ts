import type { SchoolActivationTx, SchoolActivationData } from '@domain/ports/repositories/SchoolActivationRepository';
import { NIVEAU_MAP } from '../SubjectAssignmentHelper';

export interface ReconciliationParams {
  tx: SchoolActivationTx;
  school: SchoolActivationData;
  config: Record<string, unknown>;
  templateCode: string | undefined;
  hasPEBSFrancophone: boolean;
  hasPEBSAnglophone: boolean;
  periodsCount: number;
  finalPassMark: number;
  langMode: string;
  bulletinTemplate: string;
  gradesPerTerm: number;
  isTechnique: boolean;
  isAnglophone: boolean;
  isPrimaire: boolean;
}

export async function appliquerReconciliationEtFinalisation(params: ReconciliationParams): Promise<{ subjectCountAdded: number }> {
  const {
    tx,
    school,
    config,
    templateCode,
    hasPEBSFrancophone,
    hasPEBSAnglophone,
    periodsCount,
    finalPassMark,
    langMode,
    bulletinTemplate,
    gradesPerTerm,
    isTechnique,
    isAnglophone,
    isPrimaire,
  } = params;

  let subjectCountAdded = 0;

  // 5. Cloner la GradeFormula adaptée
  if (school.templateCode) {
    const formulaId = isTechnique ? 'default-technique-fr' : isAnglophone ? 'default-en' : 'default-fr';
    const formula = await tx.findGradeFormula(formulaId);
    if (formula) {
      await tx.creerGradeFormula({ label: formula.label, evaluations: formula.evaluations });
    }

    // 6. Cloner la MentionRule adaptée
    const mentionId = isPrimaire ? 'default-apc-mentions' : isAnglophone ? 'default-en-mentions' : 'default-fr-mentions';
    const rule = await tx.findMentionRule(mentionId);
    if (rule) {
      await tx.creerMentionRule({ rules: rule.rules });
    }
  }

  // 7. Créer SchoolConfig
  await tx.creerSchoolConfig({
    passMark: finalPassMark,
    councilPassMark: finalPassMark,
    termsPerYear: periodsCount,
    maxAbsences: 10,
    gradesPerTerm,
    attendanceLateAsAbsence: true,
    schoolLanguageMode: langMode,
    bulletinTemplate,
  });

  // 8. Créer SchoolSettings
  await tx.creerSchoolSettings({
    timezone: 'Africa/Douala',
    locale: 'fr-CM',
    currency: 'XAF',
  });

  // ── 8b. LV2 : réconcilier la matière générique "LV2" ──
  {
    const PREMIER_CYCLE_LV2_LEVELS = ['4e', '3e'];
    const abstractLV2 = await tx.findMatiereParNom('LV2');

    if (abstractLV2) {
      const premierCoeffs = await tx.findCoefficientsMatiere(abstractLV2.id, PREMIER_CYCLE_LV2_LEVELS);
      const languesActives: string[] =
        config?.lv2Active === true && Array.isArray(config?.lv2Languages)
          ? (config.lv2Languages as unknown[])
              .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
              .map((l) => l.trim())
          : [];

      if (languesActives.length > 0 && premierCoeffs.length > 0) {
        const langDept = await tx.findDepartementParNom(['Langues Vivantes', 'Languages']);
        const lv2Coeff = abstractLV2.coefficient ?? 2;
        const lv2Hours = abstractLV2.hoursPerWeek ?? 2;

        for (const langue of languesActives) {
          const existing = await tx.findMatiereParNom(langue);
          const langSubject =
            existing ??
            (await tx.creerMatiere({
              name: langue,
              code: langue.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
              coefficient: lv2Coeff,
              hoursPerWeek: lv2Hours,
              departmentId: langDept?.id ?? null,
              isLV2: true,
            }));
          if (existing) {
            await tx.mettreAJourMatiere(langSubject.id, {
              isLV2: true,
              ...(langDept ? { departmentId: langDept.id } : {}),
            });
          }
        }

        const lv2Org = (config?.lv2Organisation ?? []) as Array<{
          className?: string | null;
          level: string;
          langue?: string | null;
          langues?: string[];
          organisation: string;
        }>;
        const hasPerClassConfig = lv2Org.some((r) => r.className);

        if (hasPerClassConfig) {
          const classes = await tx.findClasses(PREMIER_CYCLE_LV2_LEVELS);
          const langSubjects = await tx.findMatieres({ onlyLV2: true });
          const langSubjectByName = new Map(langSubjects.map((s) => [s.name, s.id]));

          for (const cls of classes) {
            const rule =
              lv2Org.find((r) => r.className === cls.name) ??
              lv2Org.find((r) => !r.className && r.level === cls.level);
            if (!rule) continue;

            const targetLangues =
              rule.organisation === 'MIXTE' ? (rule.langues ?? []) : rule.langue ? [rule.langue] : [];

            for (const langue of targetLangues) {
              const sid = langSubjectByName.get(langue);
              if (!sid) continue;
              const exists = await tx.findClassSubjectOverride(cls.id, sid);
              if (!exists) {
                await tx.creerClassSubjectOverride({ classId: cls.id, subjectId: sid, coefficient: lv2Coeff });
              }
            }
          }
        } else {
          const globalRule = lv2Org.find((r) => !r.className && r.organisation === 'UNIFORME' && r.langue);
          const globalLangues = globalRule?.langue ? [globalRule.langue] : languesActives;
          for (const pc of premierCoeffs) {
            for (const langue of globalLangues) {
              const langSubject = await tx.findMatiereParNom(langue, true);
              if (!langSubject) continue;
              const already = await tx.findCoefficient(langSubject.id, pc.classLevel, pc.serieCode);
              if (!already) {
                await tx.creerCoefficient({
                  subjectId: langSubject.id,
                  classLevel: pc.classLevel,
                  serieCode: pc.serieCode,
                  coefficient: pc.coefficient,
                });
              }
            }
          }
        }
      }

      if (premierCoeffs.length > 0) {
        await tx.supprimerCoefficientsMatiere(abstractLV2.id, PREMIER_CYCLE_LV2_LEVELS);
      }
      const remaining = await tx.compterCoefficientsMatiere(abstractLV2.id);
      if (remaining === 0) {
        await tx.supprimerMatiere(abstractLV2.id);
      }
    }
  }

  // ── 8c. PEBS MIXTE : ajouter les matières PEBS aux classes mixtes ──
  {
    const pebsOrg = (config?.pebsOrganisation ?? []) as Array<{
      className: string;
      level: string;
      statut: string;
    }>;
    const mixteRules = pebsOrg.filter((r) => r.statut === 'MIXTE');
    if (mixteRules.length > 0 && hasPEBSFrancophone) {
      const schoolClasses = await tx.findClasses();
      const allSubjects = await tx.findMatieres();
      const subjectByName = new Map(allSubjects.map((s) => [s.name, s.id]));

      for (const rule of mixteRules) {
        const cls = schoolClasses.find((c) => c.name === rule.className);
        if (!cls) continue;

        const niveauBac = NIVEAU_MAP[cls.level];
        const isSecondCycle = !!niveauBac;

        type PebsSubj = { subjectName: string; coefficient: number; weeklyPeriods: number | null };
        let pebsSubjects: PebsSubj[];
        let generalSerieCode: string;

        if (isSecondCycle) {
          const bacCoeffs = await tx.subjectAssignment().findBacCoefficients('ABI', niveauBac, templateCode ?? '');
          pebsSubjects = bacCoeffs.map((bc) => ({
            subjectName: bc.subjectName,
            coefficient: bc.coefficient,
            weeklyPeriods: null,
          }));
          generalSerieCode = cls.serie ?? '';
        } else {
          const cycleCoeffs = await tx.subjectAssignment().findCycleCoefficients(templateCode ?? '', cls.level, 'FR_PEBS');
          pebsSubjects = cycleCoeffs.map((cc) => ({
            subjectName: cc.subjectName,
            coefficient: cc.coefficient,
            weeklyPeriods: cc.weeklyPeriods,
          }));
          generalSerieCode = 'FR_GENERAL';
        }
        if (pebsSubjects.length === 0) continue;

        const generalSubjIds = await tx.findSubjectsCoefficient(cls.level, generalSerieCode);
        const generalSubjSet = new Set(generalSubjIds.map((s) => s.subjectId));

        for (const ps of pebsSubjects) {
          let subjId = subjectByName.get(ps.subjectName);
          if (!subjId) {
            const created = await tx.creerMatiere({
              name: ps.subjectName,
              code: ps.subjectName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
              coefficient: ps.coefficient,
              hoursPerWeek: ps.weeklyPeriods ?? 2,
            });
            subjId = created.id;
            subjectByName.set(ps.subjectName, subjId);
            subjectCountAdded++;
          }

          if (generalSubjSet.has(subjId)) continue;

          const exists = await tx.findClassSubjectOverride(cls.id, subjId);
          if (!exists) {
            await tx.creerClassSubjectOverride({ classId: cls.id, subjectId: subjId, coefficient: ps.coefficient });
          }
        }
      }
    }
  }

  // ── Frais / FeePlans ──
  if (Array.isArray(config?.feesTypes) && config.feesTypes.length > 0) {
    const FEE_MAP: Record<string, { feeType: string; name: string; refundable?: boolean }> = {
      TUITION: { feeType: 'TUITION', name: 'Frais de scolarité' },
      APEE_PTA: { feeType: 'APEE_PTA', name: 'Frais APEE / PTA' },
      EXAM: { feeType: 'EXAM', name: "Frais d'examen" },
      UNIFORM: { feeType: 'UNIFORM', name: "Frais d'uniforme" },
      INSCRIPTION: { feeType: 'INSCRIPTION', name: "Frais d'inscription / réinscription" },
      CAUTION: { feeType: 'CAUTION', name: 'Caution', refundable: true },
      DEVELOPMENT_LEVY: { feeType: 'DEVELOPMENT_LEVY', name: 'Frais de développement' },
      SPORTS_LEVY: { feeType: 'SPORTS_LEVY', name: 'Frais de sport / activités' },
    };
    for (const t of config.feesTypes as string[]) {
      const def = FEE_MAP[t];
      if (!def) continue;
      const exists = await tx.findFeePlan(def.feeType);
      if (exists) continue;
      await tx.creerFeePlan({
        name: def.name,
        amount: 0,
        feeType: def.feeType,
        isRefundable: def.refundable ?? false,
        description: 'Créé à la configuration — montant à définir',
      });
    }
  }

  // ── Services & direction ──
  const featuresPatch: Record<string, unknown> = {};
  const hasServiceFlags = ['hasCanteen', 'hasTransport', 'hasLibrary', 'hasBoarding'].some(
    (k) => typeof config[k] === 'boolean',
  );
  if (hasServiceFlags) {
    featuresPatch['services'] = {
      canteen: !!config?.hasCanteen,
      transport: !!config?.hasTransport,
      library: !!config?.hasLibrary,
      boarding: !!config?.hasBoarding,
    };
  }
  if (config?.directionRoles && typeof config.directionRoles === 'object') {
    featuresPatch['directionRoles'] = config.directionRoles;
  }
  if (config?.paymentTranches) {
    featuresPatch['paymentTranches'] = Number(config.paymentTranches) || 1;
  }

  // 9. Passer le statut à ACTIVE + sauvegarder les flags PEBS
  const mergedFeatures =
    Object.keys(featuresPatch).length > 0
      ? {
          ...(typeof school.features === 'object' && school.features
            ? (school.features as Record<string, unknown>)
            : {}),
          ...featuresPatch,
        }
      : undefined;

  await tx.mettreAJourEcole({
    status: 'ACTIVE',
    hasPEBSFrancophone,
    hasPEBSAnglophone,
    ...(mergedFeatures ? { features: mergedFeatures } : {}),
  });

  // 10. Marquer le formulaire de configuration comme complété
  if (school.configurationForm) {
    await tx.marquerFormulaireComplet();
  }

  return { subjectCountAdded };
}
