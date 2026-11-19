import { describe, it, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { MatiereSansGroupeError } from '@domain/errors/MatiereSansGroupeError';
import { resolveGroupBySubjectCode } from '@domain/services/bulletin/bulletinGroupingSchemes';
import { resolveCurriculumSubjectConfig } from '@domain/services/bulletin/bulletinSnapshotMath';
import {
  GENERAL_GROUPED_V1,
  createNewTemplateSpecVersion,
  getPublishedTemplateSpec,
} from '@domain/templates/bulletinCatalog';
import {
  assertValidClassLevel,
  resolveEffectiveTemplateAssignment,
} from '@domain/policies/BulletinTemplatePolicy';
import {
  sanitizePhotoReferenceForSnapshot,
  decodeBase64PhotoUrl,
} from '@application/reportCard/bulletinEnrichmentHelpers';
import {
  getOrRegenerateSealedBulletinPdf,
  sealAndStoreBulletinsForClass,
} from '@application/reportCard/bulletinPdfLifecycle';
import { LocalDiskBulletinPdfStorageAdapter } from '@infrastructure/services/storage/LocalDiskBulletinPdfStorageAdapter';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { renderReportCardPdfBuffer } from '@infrastructure/http/controllers/helpers/reportCardControllerHelpers';
import { InMemoryBulletinRepository } from '../../helpers/repositories/InMemoryBulletinRepository';
import { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';

const createdTempDirs: string[] = [];

afterAll(() => {
  for (const dir of createdTempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildSealedSnapshot(studentAverage = 16): StudentBulletinSnapshot {
  return {
    studentId: 'stu-1',
    computationVersion: 2,
    templateVersion: 1,
    generalAverage: studentAverage,
    totalCoefficient: 4,
    totalWeightedScore: studentAverage * 4,
    rank: 1,
    totalStudents: 25,
    mainTeacherName: 'M. NGAH',
    studentIdentity: {
      studentId: 'stu-1',
      fullName: 'KAMGA Jean',
      firstName: 'Jean',
      lastName: 'KAMGA',
      matricule: '26-001',
      dateOfBirth: '2012-04-15T00:00:00.000Z',
      placeOfBirth: 'Yaoundé',
      gender: 'M',
      isRepeater: false,
      photoUrl: 'ref:student-photo:stu-1',
    },
    conduct: {
      justifiedAbsenceHours: null,
      unjustifiedAbsenceHours: null,
      totalAbsenceHours: null,
      totalAbsenceDays: 0,
      lateCount: 1,
      warningsCount: 0,
      blamesCount: 0,
      exclusionsCount: 0,
      consignesCount: 0,
      sanctions: [],
    },
    councilDecision: {
      decision: 'PASS',
      observations: 'Félicitations du conseil.',
      honorRoll: true,
      encouragements: true,
      congratulations: true,
    },
    classProfile: {
      classSize: 25,
      classAverage: 12.5,
      topAverage: studentAverage,
      lowAverage: 8.2,
      passCount: 22,
      passRate: 88,
    },
    subjectLines: [
      {
        subjectId: 'math',
        subjectName: 'Mathématiques',
        coefficient: 4,
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        seq1Score: studentAverage,
        seq2Score: studentAverage,
        subjectAverage: studentAverage,
        weightedScore: studentAverage * 4,
        subjectRank: 1,
        subjectTotalStudents: 25,
        classSubjectAverage: 12,
        minSubjectAverage: 7,
        maxSubjectAverage: studentAverage,
        teacherComment: 'Excellent trimestre.',
        teacherName: 'M. MBARGA',
      },
    ],
    groupSummaries: [
      {
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        totalCoefficient: 4,
        totalWeightedScore: studentAverage * 4,
        groupAverage: studentAverage,
        groupRank: 1,
        groupTotalStudents: 25,
      },
    ],
  };
}

function buildExportDataFromBulletin(bulletin: Bulletin, useMeasured: boolean): BulletinExportData {
  const obj = bulletin.toObject();
  return {
    id: obj.id,
    schoolId: obj.schoolId,
    studentId: obj.studentId,
    academicYearId: obj.academicYearId,
    academicPeriodId: obj.academicPeriodId,
    template: obj.template,
    templateSpecId: obj.templateSpecId ?? null,
    templateVersion: obj.templateVersion ?? 1,
    computationVersion: obj.computationVersion ?? 2,
    snapshotData: obj.snapshotData,
    contentHash: obj.contentHash ?? null,
    verifyToken: obj.verifyToken ?? null,
    reprintCount: obj.reprintCount ?? 0,
    pdfUrl: obj.pdfUrl ?? null,
    generalAverage: obj.generalAverage ?? null,
    rank: obj.rank ?? null,
    totalStudents: obj.totalStudents ?? null,
    absenceCount: obj.absenceCount,
    mention: obj.mention ?? null,
    classMasterComment: obj.classMasterComment ?? null,
    academicYear: { id: obj.academicYearId, name: '2026-2027' },
    academicPeriod: { id: obj.academicPeriodId, name: 'Trimestre 1' },
    student: {
      id: obj.studentId,
      firstName: 'Jean',
      lastName: 'KAMGA',
      studentProfile: {
        matricule: '26-001',
        enrollmentsYearScoped: [{ class: { id: 'cls-3e', name: '3ème A', level: '3e', section: { code: 'FR' } } }],
      },
    },
    subjectLines: [],
    school: {
      id: obj.schoolId,
      name: 'Collège Le Québécois',
      city: 'Yaoundé',
      subsystem: 'FRANCOPHONE',
      schoolConfig: {
        bulletinTemplate: 'FR_SECONDARY',
        bulletinGroupingScheme: 'SCI_LIT_OTHER',
        useMeasuredBulletinRenderer: useMeasured,
      },
      schoolSettings: { schoolMotto: 'Travail et Succès' },
    },
    section: { code: 'FR' },
  };
}

describe('Étape 4 — Regroupements par code, Famille A immuable, Affectations et Stockage PDF', () => {
  it('résout les groupes par CODE matière sans jamais se baser sur le libellé', () => {
    expect(resolveGroupBySubjectCode('SCI_LIT_OTHER', 'MATHS')?.groupKey).toBe('SCIENTIFIQUE');
    expect(resolveGroupBySubjectCode('SCI_LIT_OTHER', 'FR')?.groupKey).toBe('LITTERAIRE');
    expect(resolveGroupBySubjectCode('SCI_LIT_OTHER', 'EPS')?.groupKey).toBe('AUTRE');

    expect(resolveGroupBySubjectCode('GROUP_1_2_3', 'FR')?.groupKey).toBe('GROUPE_1');
    expect(resolveGroupBySubjectCode('GROUP_1_2_3', 'MATHS')?.groupKey).toBe('GROUPE_2');
    expect(resolveGroupBySubjectCode('GROUP_1_2_3', 'EPS')?.groupKey).toBe('GROUPE_3');

    expect(resolveGroupBySubjectCode('TECH_GEN_PRO_DIV', 'TECHNOLO')?.groupKey).toBe('PROFESSIONNEL');
    expect(resolveGroupBySubjectCode('TECH_GEN_PRO_DIV', 'EPS')?.groupKey).toBe('DIVERS');

    // Un libellé trompeur avec un code inconnu ne doit jamais être deviné
    expect(() =>
      resolveCurriculumSubjectConfig({
        subject: { id: 'sub-x', name: 'Mathématiques avancées', code: 'CUSTOM_XYZ', coefficient: 2 },
        groupingScheme: 'SCI_LIT_OTHER',
      }),
    ).toThrow(MatiereSansGroupeError);
  });

  it('respecte la priorité de surcharge établissement et reste sans erreur en mode FLAT', () => {
    const overridden = resolveCurriculumSubjectConfig({
      subject: { id: 'sub-1', name: 'Art Oratoire', code: 'INCONNU', coefficient: 2 },
      levelCoeff: { coefficient: 3, groupKey: 'LITTERAIRE', groupLabel: 'Matières Littéraires', groupOrder: 2 },
      groupingScheme: 'SCI_LIT_OTHER',
    });
    expect(overridden.groupKey).toBe('LITTERAIRE');
    expect(overridden.coefficient).toBe(3);

    const flat = resolveCurriculumSubjectConfig({
      subject: { id: 'sub-2', name: 'Option libre', code: null, coefficient: 1 },
      groupingScheme: 'FLAT',
    });
    expect(flat.groupKey).toBe('DEFAULT');
  });

  it('rend GENERAL_GROUPED_V1 profondément immuable et incrémente la version à toute évolution', () => {
    expect(GENERAL_GROUPED_V1.id).toBe('GENERAL_GROUPED_V1');
    expect(GENERAL_GROUPED_V1.version).toBe(1);
    expect(Object.isFrozen(GENERAL_GROUPED_V1)).toBe(true);
    expect(Object.isFrozen(GENERAL_GROUPED_V1.blocks)).toBe(true);

    expect(() => {
      (GENERAL_GROUPED_V1 as { name: string }).name = 'Modifié';
    }).toThrow(TypeError);

    const v2 = createNewTemplateSpecVersion(GENERAL_GROUPED_V1, {
      name: 'Famille A v2',
      language: 'fr',
    });
    expect(v2.version).toBe(2);
    expect(v2.id).toBe('GENERAL_GROUPED_V1');
    expect(Object.isFrozen(v2)).toBe(true);
    expect(GENERAL_GROUPED_V1.version).toBe(1);
    expect(getPublishedTemplateSpec('GENERAL_GROUPED_V1', 1)?.version).toBe(1);
  });

  it('valide classLevel sur les valeurs connues de Class.level et résout les affectations par priorité', () => {
    expect(assertValidClassLevel('3e')).toBe('3e');
    expect(assertValidClassLevel('Form5')).toBe('Form5');
    expect(assertValidClassLevel(null)).toBeNull();
    expect(() => assertValidClassLevel('Troisième Texte Libre')).toThrow(/Niveau de classe invalide/);

    const resolved = resolveEffectiveTemplateAssignment({
      assignments: [
        {
          id: 'a-school', schoolId: 's1', classLevel: null, classId: null, periodKind: 'SEQUENCE',
          template: 'FR_SECONDARY', templateSpecId: 'GENERAL_GROUPED_V1', templateVersion: 1,
          groupingScheme: 'GROUP_1_2_3', isActive: true,
        },
        {
          id: 'a-level', schoolId: 's1', classLevel: '3e', classId: null, periodKind: 'SEQUENCE',
          template: 'FR_SECONDARY', templateSpecId: 'GENERAL_GROUPED_V1', templateVersion: 1,
          groupingScheme: 'SCI_LIT_OTHER', isActive: true,
        },
      ],
      classId: 'cls-3e-a',
      classLevel: '3e',
      periodKind: 'SEQUENCE',
      defaultTemplate: 'FR_SECONDARY',
      defaultGroupingScheme: 'FLAT',
    });
    expect(resolved.source).toBe('level_assignment');
    expect(resolved.groupingScheme).toBe('SCI_LIT_OTHER');
    expect(resolved.templateSpecId).toBe('GENERAL_GROUPED_V1');
  });

  it('ne copie jamais de photo Base64 dans snapshotData', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(sanitizePhotoReferenceForSnapshot(dataUri, 'stu-99')).toBe('ref:student-photo:stu-99');
    expect(sanitizePhotoReferenceForSnapshot('https://cdn.example/p.jpg', 'stu-99')).toBe('https://cdn.example/p.jpg');
    expect(decodeBase64PhotoUrl(dataUri)).toBeInstanceOf(Buffer);
  });

  it('stocke le PDF à la validation, le sert sans régénérer, puis régénère depuis snapshotData si le fichier est supprimé', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'zekoulabia-pdf-storage-'));
    createdTempDirs.push(tmpDir);
    const storage = new LocalDiskBulletinPdfStorageAdapter(tmpDir);
    const realRenderer = new MeasuredPdfKitBulletinRenderer();
    let renderCalls = 0;

    const spyRenderer: MeasuredPdfKitBulletinRenderer = {
      engineName: realRenderer.engineName,
      async render(snapshot, spec, opts) {
        renderCalls++;
        return realRenderer.render(snapshot, spec, opts);
      },
      renderBatch: realRenderer.renderBatch.bind(realRenderer),
    } as MeasuredPdfKitBulletinRenderer;

    const bulletin = Bulletin.create({
      schoolId: 'school-1',
      studentId: 'stu-1',
      academicYearId: 'yr-1',
      academicPeriodId: 'per-1',
      template: 'FR_SECONDARY',
    });
    const sealedSnapshot = buildSealedSnapshot(16.0);
    bulletin.definirLignesMatiere([
      { id: 'l1', subjectId: 'math', subjectName: 'Mathématiques', coefficient: 4, subjectAverage: 16, weightedScore: 64 },
    ]);
    bulletin.definirResultats({ generalAverage: 16, rank: 1, totalStudents: 25, mention: 'Très Bien', absenceCount: 0 });
    bulletin.scellerSnapshot({
      snapshotData: sealedSnapshot,
      contentHash: 'hash-1',
      verifyToken: 'tok-abc-123',
      computationVersion: 2,
      templateSpecId: 'GENERAL_GROUPED_V1',
      templateVersion: 1,
    });
    bulletin.marquerGenere('pending-key');

    const repo = new InMemoryBulletinRepository();
    await repo.save(bulletin);
    // Remplir findForExport avec l'export complet attendu par sealAndStoreBulletinsForClass
    const exportRow = buildExportDataFromBulletin(bulletin, true);
    repo.findForExport = async () => [exportRow];

    // 1. Scellement / stockage lors de la validation
    const sealed = await sealAndStoreBulletinsForClass({
      classId: 'cls-3e',
      academicPeriodId: 'per-1',
      schoolId: 'school-1',
      bulletinRepository: repo,
      bulletinRenderer: spyRenderer,
      bulletinPdfStorage: storage,
      schoolConfigRepository: {
        findBySchool: async () => ({ aiAlertsEnabled: true, subjectDropThreshold: 3, useMeasuredBulletinRenderer: true }),
        findBySchoolId: async () => ({ aiAlertsEnabled: true, subjectDropThreshold: 3, useMeasuredBulletinRenderer: true }),
      },
    });
    expect(sealed.sealedCount).toBe(1);
    expect(renderCalls).toBe(1);

    const updatedBulletin = await repo.findById(bulletin.id);
    const storedKey = updatedBulletin!.pdfUrl!;
    const diskPath = path.join(tmpDir, storedKey);
    expect(existsSync(diskPath)).toBe(true);
    exportRow.pdfUrl = storedKey;

    // 2. Téléchargement : sert directement le PDF stocké sans régénérer
    const cachedBuf = await getOrRegenerateSealedBulletinPdf({
      reportCard: exportRow,
      role: 'PARENT',
      language: 'fr',
      verifyBaseUrl: 'https://zekoulabia.chri.app',
      bulletinRenderer: spyRenderer,
      bulletinPdfStorage: storage,
    });
    expect(cachedBuf).not.toBeNull();
    expect(renderCalls).toBe(1);

    // 3. Suppression du PDF stocké + altération simulée de subjectLines vivantes -> régénération stricte depuis snapshotData (16.00) puis re-stockage
    unlinkSync(diskPath);
    expect(existsSync(diskPath)).toBe(false);
    exportRow.subjectLines = [
      {
        subjectId: 'math', subjectName: 'Mathématiques LIVE MODIFIÉE', coefficient: 4,
        seq1Score: 2, seq2Score: 2, compositionScore: null, seq3Score: null, seq4Score: null, seq5Score: null, seq6Score: null,
        classTestScore: null, terminalExamScore: null, theoreticalScore: null, practicalScore: null, professionalAttitude: null,
        oralScore: null, selfDevelopmentScore: null, subjectAverage: 2, weightedScore: 8, teacherComment: 'Piraté', competenceLabel: null,
      },
    ];

    const drawnTexts: string[] = [];
    const origText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t?: string, ...rest: unknown[]) {
      if (typeof t === 'string') drawnTexts.push(t);
      return (origText as (...args: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
    } as typeof PDFDocument.prototype.text;

    try {
      const regeneratedBuf = await getOrRegenerateSealedBulletinPdf({
        reportCard: exportRow,
        role: 'PARENT',
        language: 'fr',
        verifyBaseUrl: 'https://zekoulabia.chri.app',
        bulletinRenderer: spyRenderer,
        bulletinPdfStorage: storage,
      });
      expect(regeneratedBuf).not.toBeNull();
      expect(renderCalls).toBe(2);
      expect(existsSync(diskPath)).toBe(true);
      expect(drawnTexts.some((t) => t.includes('16,00'))).toBe(true);
      expect(drawnTexts.some((t) => t.includes('LIVE MODIFIÉE'))).toBe(false);
    } finally {
      PDFDocument.prototype.text = origText;
    }

    // 4. Repli automatique vers l'ancien rendu quand useMeasuredBulletinRenderer === false
    const legacyRow = buildExportDataFromBulletin(bulletin, false);
    const legacyResult = await renderReportCardPdfBuffer(legacyRow, 'school-1', 'ADMIN', {
      schoolName: 'Collège Le Québécois',
      schoolMotto: '',
      schoolLogoUrl: '',
      academicCalendarType: 'trimester',
      preferredLanguage: 'fr',
      schoolLanguageMode: 'francophone',
      mode: 'simple_fr',
      cycles: ['secondaire_1'],
      hasMultipleCycles: false,
      officialLanguages: ['fr'],
      attendanceLateAsAbsence: false,
      attendanceExcusedCountsAsAbsence: false,
      councilDecisionMode: 'automatic',
      councilPassAverageThreshold: 50,
      councilMaxAbsences: 10,
      bulletinBlockOnUnpaidFees: false,
      bulletinAllowedOutstandingBalance: 0,
      timezone: 'Africa/Douala',
      locale: 'fr-CM',
      currency: 'XAF',
      maxAbsences: 10,
      bulletinTemplate: 'FR_SECONDARY',
    }, { bulletinRenderer: spyRenderer, bulletinPdfStorage: storage });
    expect(legacyResult.pdfBuffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(renderCalls).toBe(2);
  });
});

