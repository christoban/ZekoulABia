import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import { computeClassProfile } from '@domain/services/bulletin/bulletinSnapshotMath';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import { GENERAL_GROUPED_V1, createNewTemplateSpecVersion } from '@domain/templates/bulletinCatalog';
import { assertValidClassLevel, KNOWN_CLASS_LEVELS } from '@domain/policies/BulletinTemplatePolicy';
import { NIVEAUX_ESG, NIVEAUX_ESG_EN, NIVEAUX_PRIMAIRES } from '@domain/ports/repositories/StatisticalQueryPort';
import { MatiereSansGroupeError } from '@domain/errors/MatiereSansGroupeError';
import { buildConductForStudent, buildSubjectInputsWithCurriculum, formatAbsenceHoursDisplay } from '@application/reportCard/bulletinEnrichmentHelpers';
import {
  ForbiddenAttendanceConsolidationError,
  SaisirHeuresAbsenceSequenceUseCase,
} from '@application/attendance/SaisirHeuresAbsenceSequenceUseCase';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { buildDynamicFormulaHint } from '@infrastructure/pdf/renderer/measuredFormatHelpers';
import { Note } from '@domain/entities/Note';
import type { MatiereProps } from '@domain/ports/repositories/MatiereRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SequenceAbsenceSummaryRecord, SequenceAbsenceSummaryRepository } from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';

function makeSnapshot(overrides: Partial<StudentBulletinSnapshot> = {}): StudentBulletinSnapshot {
  return {
    studentId: 'stu-1',
    computationVersion: 2,
    templateVersion: 1,
    generalAverage: 15.5,
    totalCoefficient: 4,
    totalWeightedScore: 62,
    rank: 2,
    totalStudents: 54,
    mainTeacherName: 'Mme ONDOA',
    studentIdentity: {
      studentId: 'stu-1',
      fullName: 'MBALLA Jean',
      firstName: 'Jean',
      lastName: 'MBALLA',
      matricule: 'M-001',
      dateOfBirth: '2011-01-10T00:00:00.000Z',
      placeOfBirth: 'Yaoundé',
      gender: 'M',
      isRepeater: false,
      photoUrl: null,
    },
    conduct: {
      justifiedAbsenceHours: 2.5,
      unjustifiedAbsenceHours: 1,
      totalAbsenceHours: 3.5,
      totalAbsenceDays: 1,
      lateCount: 0,
      consignesCount: 2,
      warningsCount: 0,
      blamesCount: 0,
      exclusionsCount: 0,
      sanctions: [],
    },
    councilDecision: {
      decision: 'PASS',
      observations: 'Très bon trimestre.',
      honorRoll: true,
      encouragements: true,
      congratulations: false,
    },
    classProfile: {
      classSize: 54,
      classAverage: 11.4,
      topAverage: 17.8,
      lowAverage: 5.2,
      passCount: 41,
      passRate: 75.93,
    },
    subjectLines: [
      {
        subjectId: 'math',
        subjectName: 'Mathématiques',
        coefficient: 4,
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        seq1Score: 15,
        seq2Score: 16,
        subjectAverage: 15.5,
        weightedScore: 62,
        subjectRank: 2,
        subjectTotalStudents: 54,
        classSubjectAverage: 11.2,
        minSubjectAverage: 5,
        maxSubjectAverage: 19,
        teacherComment: 'Solide maîtrise.',
        teacherName: 'M. MBARGA',
      },
    ],
    groupSummaries: [
      {
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        totalCoefficient: 4,
        totalWeightedScore: 62,
        groupAverage: 15.5,
        groupRank: 2,
        groupTotalStudents: 54,
      },
    ],
    ...overrides,
  };
}

function capturePdfTexts(fn: () => Promise<Buffer>): Promise<string[]> {
  const texts: string[] = [];
  const orig = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t?: string, ...rest: unknown[]) {
    if (typeof t === 'string') texts.push(t);
    return (orig as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
  } as typeof PDFDocument.prototype.text;
  return fn().then(
    () => { PDFDocument.prototype.text = orig; return texts; },
    (err) => { PDFDocument.prototype.text = orig; throw err; },
  );
}

describe('Étape 4 bis — Corrections visuelles, cohérence données & heures consolidées', () => {
  it('Point 1 : calcule passRate = admis / effectif sans jamais afficher 100% pour 3/54', () => {
    const profilePartial = computeClassProfile([12.5, 14.0, 11.2], 10, 54);
    expect(profilePartial.passCount).toBe(3);
    expect(profilePartial.classSize).toBe(54);
    expect(profilePartial.passRate).toBe(5.56);

    const profileFull = computeClassProfile(
      [...Array.from({ length: 41 }, () => 12), ...Array.from({ length: 13 }, () => 8)],
      10,
    );
    expect(profileFull.passCount).toBe(41);
    expect(profileFull.classSize).toBe(54);
    expect(profileFull.passRate).toBe(75.93);
  });

  it('Points 2, 3, 4, 5, 6, 7, 8 : rendu FR/EN localisé, sans rang sous-total, sans Admis périodique, sans placeholder cachet', async () => {
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const specEval = createNewTemplateSpecVersion(GENERAL_GROUPED_V1, {
      blocks: GENERAL_GROUPED_V1.blocks.map((b) =>
        b.type === 'officialHeader' ? { ...b, periodLabelMode: 'EVALUATION' as const } : b,
      ),
    });

    const baseOpts: BulletinRenderOptions = {
      className: '3e A',
      periodName: 'Trimestre 2',
      yearName: '2026-2027',
      mention: 'Bien',
      classMasterComment: 'Poursuivez sur cette voie.',
      isAnnual: false,
      language: 'fr',
      gradingPolicy: { mode: 'weighted', classTestWeight: 30, terminalExamWeight: 70 },
      school: { schoolName: 'Collège Test', city: 'Yaoundé' },
    };

    const textsFr = await capturePdfTexts(() => renderer.render(makeSnapshot(), specEval, baseOpts));

    // Point 2 : aucun Rang dans les sous-totaux
    const subtotalLineFr = textsFr.find((t) => t.startsWith('Sous-total Matières Scientifiques'));
    expect(subtotalLineFr).toBeDefined();
    expect(subtotalLineFr).not.toContain('Rang');

    // Point 3 & 4 : règle calcul dynamique + virgule française + légende cotes FR
    expect(textsFr.some((t) => t.includes('EVA/20 = CC 30 % + DS 70 %') && t.includes('A [15-17,99]'))).toBe(true);
    expect(textsFr).toContain('15,50');
    expect(textsFr.some((t) => t.includes('Taux réussite : 75,93 %'))).toBe(true);

    // Point 5 : pas de "Admis(e) / Travail satisfaisant" sur bulletin périodique + items configurés
    expect(textsFr.some((t) => t.includes('Admis(e) / Travail satisfaisant'))).toBe(false);
    expect(textsFr.some((t) => t.includes('Avertissement travail') && t.includes('Conseil de discipline'))).toBe(true);

    // Point 6 : bloc fusionné, consignes et 3 cadres
    expect(textsFr.some((t) => t.startsWith('RÉSULTAT PÉRIODIQUE —'))).toBe(false);
    expect(textsFr.some((t) => t.startsWith('RÉSULTAT PÉRIODIQUE & PROFIL DE LA CLASSE'))).toBe(true);
    expect(textsFr.some((t) => t.includes('Consignes : 2'))).toBe(true);
    expect(textsFr).toContain('Appréciation du professeur titulaire');
    expect(textsFr).toContain('Observations et signature des parents');
    expect(textsFr).toContain("Observations et visa du chef d'établissement");

    // Point 7 : titre suivant periodLabelMode
    expect(textsFr.some((t) => t === 'BULLETIN SCOLAIRE — Évaluation 2 (2026-2027)')).toBe(true);

    // Point 8 : aucun placeholder "Cachet & Signature" à l'impression
    expect(textsFr.some((t) => t.includes('Cachet & Signature'))).toBe(false);

    // Vérification anglais (point décimal + formule EN)
    const textsEn = await capturePdfTexts(() => renderer.render(makeSnapshot(), specEval, { ...baseOpts, language: 'en' }));
    expect(textsEn).toContain('15.50');
    expect(textsEn.some((t) => t.includes('AVG/20 = CA 30% + EX 70%') && t.includes('A [15-17.99]'))).toBe(true);
    expect(textsEn.some((t) => t.includes('Pass Rate : 75.93%'))).toBe(true);

    // Formule simple moyenne si mode !== weighted/triple
    expect(buildDynamicFormulaHint({ mode: 'single' }, false, 'A+/A/ECA/NA')).toContain('moyenne simple');
  });

  it('Point 9 : MATIERE_SANS_GROUPE recense TOUTES les matières non classées dans missingSubjects', () => {
    const m1: MatiereProps = { id: 'sub-1', schoolId: 'sch-1', name: 'Astronomie', code: 'ASTRO', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL' };
    const m2: MatiereProps = { id: 'sub-2', schoolId: 'sch-1', name: 'Robotique', code: 'ROBO', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL' };
    const mMath: MatiereProps = { id: 'sub-3', schoolId: 'sch-1', name: 'Maths', code: 'MATH', coefficient: 4, hoursPerWeek: 4, subjectType: 'THEORETICAL' };
    const notes = [m1, m2, mMath].map((m, idx) =>
      Note.reconstituer({
        id: `n-${idx}`, schoolId: 'sch-1', studentId: 'stu-1', subjectId: m.id,
        classId: 'cls-1', academicYearId: 'yr-1', sequenceId: 'seq-1', recordedById: 'tch-1',
        sequenceScore: 14, coefficient: m.coefficient, maxValue: 20, validationStatus: 'LOCKED',
        isAbsentGrade: false, isOfflineSync: false, createdAt: new Date(),
      }),
    );

    let caught: unknown;
    try {
      buildSubjectInputsWithCurriculum({
        matieres: [m1, m2, mMath],
        notesDeClasse: notes,
        lv2SubjectIds: new Set(),
        overrideMap: new Map(),
        levelCoeffMap: new Map(),
        teacherBySubject: new Map(),
        educationType: 'GENERAL',
        groupingScheme: 'SCI_LIT_OTHER',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MatiereSansGroupeError);
    const errTyped = caught as MatiereSansGroupeError;
    expect(errTyped.missingSubjects).toHaveLength(2);
    expect(errTyped.missingSubjects.map((s) => s.subjectCode)).toEqual(['ASTRO', 'ROBO']);
    expect(errTyped.message).toContain('ASTRO');
    expect(errTyped.message).toContain('ROBO');
  });

  it('Point 10 : KNOWN_CLASS_LEVELS dérive des constantes curricula et accepte les niveaux réels en base', () => {
    for (const lvl of [...NIVEAUX_ESG, ...NIVEAUX_ESG_EN, ...NIVEAUX_PRIMAIRES]) {
      expect(KNOWN_CLASS_LEVELS).toContain(lvl);
    }
    expect(() => assertValidClassLevel('BacPro2')).toThrow();
    expect(assertValidClassLevel('BacPro2', ['BacPro2', '6e'])).toBe('BacPro2');
  });

  it('Point 12 : RBAC strict sur SaisirHeuresAbsenceSequenceUseCase et zéro heure estimée dans le snapshot', async () => {
    const store = new Map<string, SequenceAbsenceSummaryRecord>();
    const repo: SequenceAbsenceSummaryRepository = {
      async findByClassAndPeriods(schoolId, classId, periodIds) {
        return [...store.values()].filter((r) => r.schoolId === schoolId && r.classId === classId && periodIds.includes(r.academicPeriodId));
      },
      async upsertForSequence(input) {
        const rec: SequenceAbsenceSummaryRecord = {
          id: `id-${input.studentId}-${input.sequenceId}`,
          schoolId: input.schoolId,
          studentId: input.studentId,
          classId: input.classId,
          academicYearId: input.academicYearId,
          academicPeriodId: input.academicPeriodId,
          sequenceId: input.sequenceId,
          justifiedHours: input.justifiedHours,
          unjustifiedHours: input.unjustifiedHours,
          consignesCount: input.consignesCount ?? 0,
          recordedById: input.recordedById,
          updatedAt: new Date(),
        };
        store.set(`${input.studentId}:${input.sequenceId}`, rec);
        return rec;
      },
      async upsertBatchForSequence(records) {
        for (const r of records) {
          await repo.upsertForSequence(r);
        }
        return records.length;
      },
    };
    const fakeClasseRepo = {
      async findById(id: string) {
        return { id, schoolId: 'sch-1', academicYearId: 'yr-1', nomComplet: '3e A' };
      },
    } as unknown as ClasseRepository;
    const fakeAnneeRepo = {
      async findPeriodeById(id: string) {
        return { id, name: 'Trimestre 1' };
      },
      async findSequencesByPeriode() {
        return [{ id: 'seq-1', name: 'Séquence 1' }];
      },
    } as unknown as AnneeAcademiqueRepository;
    const uc = new SaisirHeuresAbsenceSequenceUseCase(repo, fakeClasseRepo, fakeAnneeRepo);

    // TEACHER, PARENT et STAFF sans MANAGE_ATTENDANCE -> 403
    for (const caller of [
      { userId: 'u1', role: 'TEACHER', permissions: [] },
      { userId: 'u2', role: 'PARENT', permissions: [] },
      { userId: 'u3', role: 'STAFF', permissions: ['VIEW_STUDENTS'] },
    ]) {
      await expect(
        uc.execute({
          schoolId: 'sch-1', classId: 'cls-1', academicPeriodId: 'per-1', sequenceId: 'seq-1',
          actorUserId: caller.userId, actorRole: caller.role, actorPermissions: caller.permissions,
          entries: [{ studentId: 'stu-1', justifiedHours: 2, unjustifiedHours: 4, consignesCount: 1 }],
        }),
      ).rejects.toThrow(ForbiddenAttendanceConsolidationError);
    }

    // STAFF avec MANAGE_ATTENDANCE & ADMIN autorisés
    const res = await uc.execute({
      schoolId: 'sch-1', classId: 'cls-1', academicPeriodId: 'per-1', sequenceId: 'seq-1',
      actorUserId: 'staff-1', actorRole: 'STAFF', actorPermissions: ['MANAGE_ATTENDANCE'],
      entries: [{ studentId: 'stu-1', justifiedHours: 2, unjustifiedHours: 4.5, consignesCount: 3 }],
    });
    expect(res.savedCount).toBe(1);
    const saved = await repo.findByClassAndPeriods('sch-1', 'cls-1', ['per-1']);
    expect(saved).toHaveLength(1);

    // Sans saisie consolidée : null -> "—" (aucune heure devinée "1h ou 4h")
    const emptyConduct = buildConductForStudent([], [], 2, []);
    expect(emptyConduct.justifiedAbsenceHours).toBeNull();
    expect(emptyConduct.unjustifiedAbsenceHours).toBeNull();
    expect(emptyConduct.totalAbsenceHours).toBeNull();
    expect(formatAbsenceHoursDisplay(emptyConduct.justifiedAbsenceHours, 'fr')).toBe('—');

    // Avec saisie consolidée : somme exacte et format localisé
    const realConduct = buildConductForStudent([], [], 2, saved);
    expect(realConduct.justifiedAbsenceHours).toBe(2);
    expect(realConduct.unjustifiedAbsenceHours).toBe(4.5);
    expect(realConduct.totalAbsenceHours).toBe(6.5);
    expect(realConduct.consignesCount).toBe(3);
    expect(formatAbsenceHoursDisplay(realConduct.unjustifiedAbsenceHours, 'fr')).toBe('4,50 h');
    expect(formatAbsenceHoursDisplay(realConduct.unjustifiedAbsenceHours, 'en')).toBe('4.50 h');

    // SnapshotBuilder reste déterministe avec consignesCount = 0 par défaut sans source consolidée
    const snapRes = BulletinSnapshotBuilder.buildClassSnapshots({
      students: [{ id: 'stu-1' }],
      subjects: [{ id: 's1', name: 'Maths', coefficient: 4 }],
      sequences: [{ id: 'seq-1', name: 'Seq1', orderIndex: 1 }],
      notes: [{ studentId: 'stu-1', subjectId: 's1', sequenceId: 'seq-1', coefficient: 4, sequenceScore: 14, validationStatus: 'LOCKED' }],
      hasCoefficientBySubject: true,
    });
    expect(snapRes.classProfile.passCount).toBe(1);
    expect(snapRes.classProfile.passRate).toBe(100);
  });
});
