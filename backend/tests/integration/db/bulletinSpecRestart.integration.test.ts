import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import PDFDocument from 'pdfkit';
import { Bulletin } from '@domain/entities/Bulletin';
import { GENERAL_GROUPED_V1, clearCustomTemplateSpecsForRestartSimulation, getPublishedTemplateSpec, getTemplateSpecAnyStatus } from '@domain/templates/bulletinCatalog';
import { canonicalHashSnapshot, deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { genererVerifyToken } from '@application/reportCard/bulletinEnrichmentHelpers';
import { getOrRegenerateSealedBulletinPdf } from '@application/reportCard/bulletinPdfLifecycle';
import { PrismaBulletinRepository } from '@infrastructure/persistence/prisma/PrismaBulletinRepository';
import { PrismaBulletinTemplateSpecRepository } from '@infrastructure/persistence/prisma/PrismaBulletinTemplateSpecRepository';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { LocalDiskBulletinPdfStorageAdapter } from '@infrastructure/services/storage/LocalDiskBulletinPdfStorageAdapter';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const bulletinRepo = new PrismaBulletinRepository(prismaTest);
const specRepo = new PrismaBulletinTemplateSpecRepository(prismaTest);
const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

function captureDrawnPdfTexts<T>(fn: () => Promise<T>): Promise<{ result: T; texts: string[] }> {
  const texts: string[] = [];
  const orig = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t?: string, ...rest: unknown[]) {
    if (typeof t === 'string') texts.push(t);
    return (orig as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
  } as typeof PDFDocument.prototype.text;
  return fn().then(
    (result) => { PDFDocument.prototype.text = orig; return { result, texts }; },
    (err) => { PDFDocument.prototype.text = orig; throw err; },
  );
}

describe('Étape 8.1 PostgreSQL — Persistance DB des specs DRAFT/PUBLISHED & survie au redémarrage', () => {
  const createdSchoolIds: string[] = [];
  const createdSpecIds: string[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    clearCustomTemplateSpecsForRestartSimulation();
    for (const sid of createdSchoolIds.splice(0)) {
      await prismaTest.reportCard.deleteMany({ where: { schoolId: sid } });
      await prismaTest.enrollment.deleteMany({ where: { schoolId: sid } });
      await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId: sid } } });
      await prismaTest.class.deleteMany({ where: { schoolId: sid } });
      await prismaTest.subject.deleteMany({ where: { schoolId: sid } });
      await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId: sid } } });
      await prismaTest.academicYear.deleteMany({ where: { schoolId: sid } });
      await prismaTest.user.deleteMany({ where: { schoolId: sid } });
      await nettoyerEcole(prismaTest, sid);
    }
    if (createdSpecIds.length > 0) {
      await prismaTest.bulletinTemplateSpecRecord.deleteMany({
        where: { specId: { in: createdSpecIds.splice(0) } },
      });
    }
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('persiste v2 PUBLISHED et v3 DRAFT en PostgreSQL, survit au redémarrage simulé et régénère le PDF scellé à l’identique', async () => {
    const suffix = String(Date.now());
    const school = await creerEcoleTest(prismaTest, `spec-restart-${suffix}`);
    createdSchoolIds.push(school.id);

    await prismaTest.schoolConfig.create({
      data: { schoolId: school.id, useMeasuredBulletinRenderer: true, bulletinGroupingScheme: 'SCI_LIT_OTHER' },
    });

    const admin = await creerUtilisateurTest(prismaTest, school.id, { role: 'ADMIN', suffix: `adm-${suffix}` });
    const student = await creerUtilisateurTest(prismaTest, school.id, { role: 'STUDENT', suffix: `stu-${suffix}` });
    const year = await prismaTest.academicYear.create({
      data: { schoolId: school.id, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30'), isCurrent: true },
    });
    const classe = await prismaTest.class.create({
      data: { schoolId: school.id, academicYearId: year.id, name: '3ème A Restart', level: '3e' },
    });
    await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId: classe.id, enrolledById: admin.id });
    const period = await prismaTest.academicPeriod.create({
      data: { academicYearId: year.id, name: 'Trimestre 1', type: 'TRIMESTER', orderIndex: 1, startDate: new Date('2026-09-01'), endDate: new Date('2026-12-15'), isCurrent: true },
    });
    const subject = await prismaTest.subject.create({
      data: { schoolId: school.id, name: 'Mathématiques', code: 'MATH', coefficient: 4, hoursPerWeek: 4 },
    });

    // 1. Créer et persister en DB une spec v2 PUBLISHED (et v3 DRAFT)
    const specId = `SPEC_RESTART_${suffix}`;
    createdSpecIds.push(specId);
    const v2Base = structuredClone(GENERAL_GROUPED_V1);
    const v2Spec = {
      ...v2Base,
      id: specId,
      version: 2,
      status: 'PUBLISHED' as const,
      validationStatus: 'VALIDATED' as const,
      name: 'Spec Restart V2 Publiée',
      language: 'en' as const,
      blocks: v2Base.blocks.map((b) =>
        b.type === 'subjectTable' ? { ...b, formulaHint: `CALIBRATION V2 ${suffix}` } : b,
      ),
    };
    await specRepo.saveVersion(v2Spec, admin.id);

    const v3Draft = {
      ...structuredClone(v2Spec),
      version: 3,
      status: 'DRAFT' as const,
      name: 'Spec Brouillon V3 Non Publiée',
    };
    await specRepo.saveVersion(v3Draft, admin.id);

    // Immuabilité : impossible d'écraser v2 déjà publiée en base
    await expect(specRepo.saveVersion(v2Spec, admin.id)).rejects.toThrow(/immuable/);

    // 2. Sceller un bulletin avec (specId, templateVersion: 2)
    const preview = buildFictitiousPreviewSnapshot(v2Spec);
    const snapshotData = { ...preview.snapshot, studentId: student.id, templateVersion: 2 };
    const verifyToken = genererVerifyToken();
    const shortVerifyCode = deriveShortVerifyCode(verifyToken);

    const bulletin = Bulletin.create({
      schoolId: school.id,
      studentId: student.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      template: 'FR_SECONDARY',
    });
    bulletin.definirLignesMatiere([
      {
        id: crypto.randomUUID(),
        subjectId: subject.id,
        subjectName: 'Mathématiques',
        coefficient: 4,
        seq1Score: 15,
        seq2Score: 17,
        subjectAverage: 16,
        weightedScore: 64,
        subjectRank: 1,
        groupKey: 'SCI',
        groupLabel: 'Sciences',
        groupOrder: 1,
      },
    ]);
    bulletin.definirResultats({ generalAverage: 16, rank: 1, totalStudents: 25, mention: 'Très Bien', absenceCount: 0 });
    bulletin.scellerSnapshot({
      snapshotData,
      contentHash: canonicalHashSnapshot(snapshotData),
      verifyToken,
      shortVerifyCode,
      computationVersion: 2,
      templateSpecId: specId,
      templateVersion: 2,
    });

    const storageDir = await mkdtemp(path.join(os.tmpdir(), 'zk-spec-restart-'));
    tempDirs.push(storageDir);
    const pdfStorage = new LocalDiskBulletinPdfStorageAdapter(storageDir);
    const storageKey = pdfStorage.buildStorageKey({
      schoolId: school.id,
      academicPeriodId: period.id,
      bulletinId: bulletin.id,
      templateVersion: 2,
    });
    bulletin.marquerGenere(storageKey);
    await bulletinRepo.save(bulletin);

    // Premier rendu avec v2 active en mémoire -> stockage sur disque
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const loadedBefore = await bulletinRepo.findForPdf(bulletin.id, school.id);
    expect(loadedBefore).not.toBeNull();
    const beforeRun = await captureDrawnPdfTexts(() =>
      getOrRegenerateSealedBulletinPdf({
        reportCard: loadedBefore!,
        role: 'ADMIN',
        language: 'en',
        verifyBaseUrl: 'https://verify.zekoulabia.cm',
        bulletinRenderer: renderer,
        bulletinPdfStorage: pdfStorage,
        templateSpecRepository: specRepo,
        forceRegenerateFromSnapshot: true,
        persistRegeneratedPdf: true,
      }),
    );
    expect(beforeRun.result?.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(beforeRun.texts.some((t) => t.includes(`CALIBRATION V2 ${suffix}`))).toBe(true);

    // 3. Simuler redémarrage complet du process (mémoire vidée + PDF supprimé du disque)
    clearCustomTemplateSpecsForRestartSimulation();
    await rm(storageDir, { recursive: true, force: true });
    expect(getPublishedTemplateSpec(specId, 2)).toBeNull();
    expect(getTemplateSpecAnyStatus(specId, 3)).toBeNull();

    // 4. Régénération à la demande : rechargement automatique depuis PostgreSQL (BulletinTemplateSpecRecord)
    const freshSpecRepo = new PrismaBulletinTemplateSpecRepository(prismaTest);
    const freshPdfStorage = new LocalDiskBulletinPdfStorageAdapter(storageDir);
    const loadedAfter = await bulletinRepo.findForPdf(bulletin.id, school.id);
    expect(loadedAfter).not.toBeNull();

    const afterRun = await captureDrawnPdfTexts(() =>
      getOrRegenerateSealedBulletinPdf({
        reportCard: loadedAfter!,
        role: 'ADMIN',
        language: 'en',
        verifyBaseUrl: 'https://verify.zekoulabia.cm',
        bulletinRenderer: renderer,
        bulletinPdfStorage: freshPdfStorage,
        templateSpecRepository: freshSpecRepo,
      }),
    );

    expect(afterRun.result?.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(afterRun.texts).toEqual(beforeRun.texts);
    expect(getPublishedTemplateSpec(specId, 2)?.name).toBe('Spec Restart V2 Publiée');
    // Le brouillon v3 reste isolé tant qu'il n'est pas chargé/publié
    expect(getPublishedTemplateSpec(specId, 3)).toBeNull();
    const allFromDb = await freshSpecRepo.findAll();
    expect(allFromDb.some((s) => s.id === specId && s.version === 3 && s.status === 'DRAFT')).toBe(true);
  });
});
