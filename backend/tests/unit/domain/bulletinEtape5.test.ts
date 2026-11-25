import { describe, it, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { Bulletin } from '@domain/entities/Bulletin';
import { SchoolAssetValidationError } from '@domain/errors/SchoolAssetValidationError';
import {
  canonicalHashSnapshot,
  deriveShortVerifyCode,
  maskStudentPublicName,
} from '@domain/policies/BulletinVerifyCrypto';
import { GENERAL_GROUPED_V1 } from '@domain/templates/bulletinCatalog';
import { genererVerifyToken } from '@application/reportCard/bulletinEnrichmentHelpers';
import {
  buildSchoolIdentityRenderContext,
  getOrRegenerateSealedBulletinPdf,
} from '@application/reportCard/bulletinPdfLifecycle';
import { LocalAndDataUriSchoolAssetStorageAdapter } from '@infrastructure/services/storage/LocalAndDataUriSchoolAssetStorageAdapter';
import { LocalDiskBulletinPdfStorageAdapter } from '@infrastructure/services/storage/LocalDiskBulletinPdfStorageAdapter';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { setVerifyNoIndexHeaders, verifyPublicDocumentOp } from '@infrastructure/http/controllers/helpers/verifyPublicDocumentOp';
import { InMemoryBulletinRepository } from '../../helpers/repositories/InMemoryBulletinRepository';
import type { StudentDocumentRepository } from '@domain/ports/repositories/StudentDocumentRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { SchoolIdentityKitRecord } from '@domain/ports/repositories/SchoolIdentityKitRepository';

const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

function buildTinyPngWithDimensions(width: number, height: number): Buffer {
  // Construit un header PNG valide minimal (signature + chunk IHDR CRC neutre + IEND)
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from('IHDR', 'ascii');
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  const crc = Buffer.alloc(4);
  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  return Buffer.concat([sig, ihdrLen, ihdrType, ihdrData, crc, iend]);
}

function buildMinimalJpeg(width: number, height: number): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const sof0 = Buffer.alloc(11);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(9, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3;
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, sof0, eoi]);
}

function buildSnapshot(avg = 15.25): StudentBulletinSnapshot {
  return {
    studentId: 'stu-1',
    computationVersion: 2,
    templateVersion: 1,
    generalAverage: avg,
    totalCoefficient: 4,
    totalWeightedScore: avg * 4,
    rank: 2,
    totalStudents: 40,
    mainTeacherName: 'Mme ONDOA',
    studentIdentity: {
      studentId: 'stu-1',
      fullName: 'KAMGA Jean-Baptiste',
      firstName: 'Jean-Baptiste',
      lastName: 'KAMGA',
      matricule: '26-0042',
      dateOfBirth: '2011-05-03T00:00:00.000Z',
      placeOfBirth: 'Douala',
      gender: 'M',
      isRepeater: false,
      photoUrl: null,
    },
    conduct: {
      justifiedAbsenceHours: 2,
      unjustifiedAbsenceHours: 0,
      totalAbsenceHours: 2,
      totalAbsenceDays: 0,
      lateCount: 1,
      consignesCount: 0,
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
      classSize: 40,
      classAverage: 11.8,
      topAverage: 17.5,
      lowAverage: 6.2,
      passCount: 30,
      passRate: 75,
    },
    subjectLines: [
      {
        subjectId: 'sub-math',
        subjectName: 'Mathématiques',
        coefficient: 4,
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        seq1Score: avg,
        seq2Score: avg,
        subjectAverage: avg,
        weightedScore: avg * 4,
        subjectRank: 2,
        subjectTotalStudents: 40,
        classSubjectAverage: 11.4,
        minSubjectAverage: 5,
        maxSubjectAverage: 19,
        teacherComment: 'Solide.',
        teacherName: 'M. MBARGA',
      },
    ],
    groupSummaries: [
      {
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        totalCoefficient: 4,
        totalWeightedScore: avg * 4,
        groupAverage: avg,
        groupRank: 2,
        groupTotalStudents: 40,
      },
    ],
  };
}

describe('Étape 5 — Identité école, Assets validés, QR >= 20 mm, /verify public & Duplicata', () => {
  it('Point A : valide PNG/JPEG réels par magic bytes et rejette > 300 Ko, > 1200x1200 px et faux formats', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zekoul-assets-'));
    tempDirs.push(dir);
    const storage = new LocalAndDataUriSchoolAssetStorageAdapter(dir);

    const validQrPng = await QRCode.toBuffer('VALID-PNG', { type: 'png', width: 120, margin: 1 });
    const storedPng = await storage.validateAndStoreAsset({ schoolId: 'sch-1', kind: 'logo', data: validQrPng });
    expect(storedPng.mimeType).toBe('image/png');
    expect(storedPng.width).toBe(120);
    expect(storedPng.height).toBe(120);
    const loadedBack = await storage.readAssetBuffer(storedPng.assetKey);
    expect(loadedBack?.equals(validQrPng)).toBe(true);

    const validJpeg = buildMinimalJpeg(400, 300);
    const storedJpeg = await storage.validateAndStoreAsset({ schoolId: 'sch-1', kind: 'stamp', data: validJpeg });
    expect(storedJpeg.mimeType).toBe('image/jpeg');
    expect(storedJpeg.width).toBe(400);

    // Faux PNG / texte brut déguisé
    await expect(
      storage.validateAndStoreAsset({ schoolId: 'sch-1', kind: 'logo', data: Buffer.from('<svg>hack</svg>') }),
    ).rejects.toThrow(SchoolAssetValidationError);

    // Dépassement taille > 300 Ko
    const tooBig = Buffer.concat([validQrPng, Buffer.alloc(310 * 1024)]);
    await expect(
      storage.validateAndStoreAsset({ schoolId: 'sch-1', kind: 'logo', data: tooBig }),
    ).rejects.toThrow(SchoolAssetValidationError);

    // Dépassement dimensions > 1200x1200 px
    const oversizedPng = buildTinyPngWithDimensions(1400, 800);
    await expect(
      storage.validateAndStoreAsset({ schoolId: 'sch-1', kind: 'coatOfArms', data: oversizedPng }),
    ).rejects.toThrow(SchoolAssetValidationError);
  });

  it('Point B : en-tête sans aucun texte par défaut inventé si SchoolIdentityKit a des champs vides', async () => {
    const ctx = await buildSchoolIdentityRenderContext({
      schoolName: 'Lycée Sans Kit',
      language: 'fr',
      fallbackMotto: '',
      fallbackCity: null,
      fallbackPhone: '   ',
      kit: null,
    });
    expect(ctx.regionalDelegation).toBeNull();
    expect(ctx.departmentalDelegation).toBeNull();
    expect(ctx.schoolMotto).toBeNull();
    expect(ctx.city).toBeNull();
    expect(ctx.phone).toBeNull();

    const renderer = new MeasuredPdfKitBulletinRenderer();
    const drawnTexts: string[] = [];
    const orig = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t?: string, ...rest: unknown[]) {
      if (typeof t === 'string') drawnTexts.push(t);
      return (orig as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
    } as typeof PDFDocument.prototype.text;

    try {
      await renderer.render(buildSnapshot(), GENERAL_GROUPED_V1, {
        className: '3e A',
        periodName: 'Trimestre 1',
        yearName: '2026-2027',
        mention: 'Bien',
        language: 'fr',
        school: ctx,
      });
    } finally {
      PDFDocument.prototype.text = orig;
    }

    expect(drawnTexts.some((t) => t.toLowerCase().includes('undefined') || t.includes('Délégation'))).toBe(false);
    expect(drawnTexts.some((t) => t.trim() === '' || t.trim() === '""')).toBe(false);
  });

  it('Point C : token >= 128 bits, shortVerifyCode distinct, contentHash canonique indépendant de l’ordre des clés, QR >= 20 mm décodable', async () => {
    const t1 = genererVerifyToken();
    const t2 = genererVerifyToken();
    expect(t1).not.toBe(t2);
    expect(Buffer.from(t1, 'hex').length).toBeGreaterThanOrEqual(16); // >= 128 bits

    const shortCode = deriveShortVerifyCode(t1);
    expect(shortCode).toMatch(/^ZK-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(t1.includes(shortCode)).toBe(false);

    const snapA = buildSnapshot(15.25);
    const snapB = {
      groupSummaries: snapA.groupSummaries,
      subjectLines: snapA.subjectLines,
      classProfile: snapA.classProfile,
      councilDecision: snapA.councilDecision,
      conduct: snapA.conduct,
      studentIdentity: snapA.studentIdentity,
      mainTeacherName: snapA.mainTeacherName,
      totalStudents: snapA.totalStudents,
      rank: snapA.rank,
      totalWeightedScore: snapA.totalWeightedScore,
      totalCoefficient: snapA.totalCoefficient,
      generalAverage: snapA.generalAverage,
      templateVersion: snapA.templateVersion,
      computationVersion: snapA.computationVersion,
      studentId: snapA.studentId,
    } as StudentBulletinSnapshot;
    expect(canonicalHashSnapshot(snapA)).toBe(canonicalHashSnapshot(snapB));

    // Vérification taille QR >= 20 mm (60 pt = 21,17 mm >= 20 mm) & décodage OpenCV du buffer QR généré
    let drawnQrFit: number[] | undefined;
    let capturedQrPng: Buffer | undefined;
    const origImage = PDFDocument.prototype.image;
    PDFDocument.prototype.image = function patchedImg(
      this: PDFKit.PDFDocument,
      src: unknown,
      x?: number,
      y?: number,
      opts?: { fit?: number[] },
    ) {
      if (Buffer.isBuffer(src) && opts?.fit && opts.fit[0] && opts.fit[0] >= 55) {
        drawnQrFit = opts.fit;
        capturedQrPng = src;
      }
      return origImage.call(this, src as string, x, y, opts as PDFKit.Mixins.ImageOption);
    } as typeof PDFDocument.prototype.image;

    try {
      const renderer = new MeasuredPdfKitBulletinRenderer();
      const verifyUrl = `https://zekoulabia.app/verify/${t1}`;
      await renderer.render(snapA, GENERAL_GROUPED_V1, {
        className: '3e A',
        periodName: 'Trimestre 1',
        yearName: '2026-2027',
        mention: 'Bien',
        language: 'fr',
        verifyUrl,
        verifyToken: t1,
        shortVerifyCode: shortCode,
        school: { schoolName: 'Collège Le Québécois' },
      });
      expect(drawnQrFit).toBeDefined();
      const mmWidth = (drawnQrFit![0]! * 25.4) / 72;
      expect(mmWidth).toBeGreaterThanOrEqual(20); // >= 20 mm obligatoires

      // Décodage 100 % JavaScript du PNG QR (pngjs + jsQR) sans OpenCV ni binaire externe
      expect(capturedQrPng).toBeDefined();
      const decodedPng = PNG.sync.read(capturedQrPng!);
      const qrResult = jsQR(new Uint8ClampedArray(decodedPng.data), decodedPng.width, decodedPng.height);
      expect(qrResult).not.toBeNull();
      expect(qrResult!.data).toBe(verifyUrl);
    } finally {
      PDFDocument.prototype.image = origImage;
    }
  });

  it('Points D & E : /verify distingue AUTHENTIQUE (v2 masqué + aucune note), Ancien format (v1), REVOKED et NOT_FOUND + noindex', async () => {
    const repo = new InMemoryBulletinRepository();
    repo.definirStudentName('stu-1', 'Jean-Baptiste', 'KAMGA');

    const emptyDocRepo = { findById: async () => null } as unknown as StudentDocumentRepository;
    const schoolRepo = { findById: async () => null } as unknown as SchoolRepository;

    // 1. Bulletin actif v2
    const tokV2 = genererVerifyToken();
    const snapV2 = buildSnapshot(16.5);
    const bV2 = Bulletin.create({
      schoolId: 'sch-1', studentId: 'stu-1', academicYearId: '2026-2027', academicPeriodId: 'Trimestre 1', template: 'FR_SECONDARY',
    });
    bV2.definirLignesMatiere([{ id: 'l1', subjectId: 'math', subjectName: 'Maths', coefficient: 4, subjectAverage: 16.5, weightedScore: 66 }]);
    bV2.definirResultats({ generalAverage: 16.5, rank: 1, totalStudents: 40, mention: 'Très Bien', absenceCount: 0 });
    bV2.scellerSnapshot({
      snapshotData: snapV2,
      contentHash: canonicalHashSnapshot(snapV2),
      verifyToken: tokV2,
      computationVersion: 2,
    });
    bV2.marquerGenere('k-1');
    await repo.save(bV2);

    const resV2 = await verifyPublicDocumentOp({
      documentId: tokV2,
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    expect(resV2.statusCode).toBe(200);
    const docV2 = resV2.body.document as Record<string, unknown>;
    expect(docV2.status).toBe('AUTHENTIC');
    expect(docV2.authentic).toBe(true);
    expect(docV2.studentMaskedName).toBe('KAMGA J.');
    expect(maskStudentPublicName('Jean-Baptiste', 'KAMGA')).toBe('KAMGA J.');
    expect(docV2.legacyFormat).toBe(false);
    // Étape 5 bis : le jeton long expose MOYENNE GÉNÉRALE + RANG + date d'émission (sans notes par matière, matricule ni conduite)
    expect(docV2.lookupMode).toBe('LONG_TOKEN');
    expect(docV2.generalAverage).toBe(16.5);
    expect(docV2.rank).toBe(1);
    expect(JSON.stringify(docV2)).not.toContain('Très Bien');
    expect(JSON.stringify(docV2)).not.toContain('Jean-Baptiste');
    expect(JSON.stringify(docV2)).not.toContain('MAT-001');

    // Vérification manuelle par shortVerifyCode ZK-XXXX-XXXX -> statut uniquement, ZERO chiffre
    const shortRes = await verifyPublicDocumentOp({
      documentId: deriveShortVerifyCode(tokV2),
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    const shortDoc = shortRes.body.document as Record<string, unknown>;
    expect(shortDoc.lookupMode).toBe('SHORT_CODE');
    expect(shortDoc.status).toBe('AUTHENTIC');
    expect(JSON.stringify(shortDoc)).not.toContain('16.5');
    expect(JSON.stringify(shortDoc)).not.toContain('KAMGA');

    // 2. Ancien format v1 sans snapshot
    const tokV1 = genererVerifyToken();
    const bV1 = Bulletin.reconstituer({
      id: 'bul-v1',
      schoolId: 'sch-1',
      studentId: 'stu-1',
      academicYearId: '2024-2025',
      academicPeriodId: 'Trimestre 1',
      template: 'FR_SECONDARY',
      computationVersion: 1,
      verifyToken: tokV1,
      shortVerifyCode: deriveShortVerifyCode(tokV1),
      validationStatus: 'GENERATED',
      isGenerated: true,
      absenceCount: 0,
      createdAt: new Date(),
      lignesMatiere: [],
    });
    await repo.save(bV1);
    const resV1 = await verifyPublicDocumentOp({
      documentId: tokV1,
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    const docV1 = resV1.body.document as Record<string, unknown>;
    expect(docV1.status).toBe('AUTHENTIC');
    expect(docV1.legacyFormat).toBe(true);
    expect(docV1.formatNotice).toContain('Ancien format');

    // 3. Révoqué / remplacé
    const tokOldRevoked = genererVerifyToken();
    bV2.revoquer({ revokedById: 'admin-1', reason: 'Correction note interne' });
    const replacement = Bulletin.create({
      schoolId: 'sch-1', studentId: 'stu-1', academicYearId: '2026-2027', academicPeriodId: 'Trimestre 1', template: 'FR_SECONDARY',
    });
    replacement.definirLignesMatiere([{ id: 'l2', subjectId: 'math', subjectName: 'Maths', coefficient: 4, subjectAverage: 17, weightedScore: 68 }]);
    replacement.definirResultats({ generalAverage: 17, rank: 1, totalStudents: 40, mention: 'Très Bien', absenceCount: 0 });
    replacement.scellerSnapshot({
      snapshotData: snapV2,
      contentHash: canonicalHashSnapshot(snapV2),
      verifyToken: tokOldRevoked,
      computationVersion: 2,
    });
    replacement.marquerGenere('k-2');
    // Force revoke original tokV2
    await repo.archiverEtRemplacerRevoque(bV2, replacement);

    const resRevoked = await verifyPublicDocumentOp({
      documentId: tokV2,
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    const docRev = resRevoked.body.document as Record<string, unknown>;
    expect(docRev.status).toBe('REVOKED');
    expect(docRev.authentic).toBe(false);
    expect(JSON.stringify(docRev)).not.toContain('Correction note interne');

    // 4. Introuvable + en-têtes noindex
    const resNotFound = await verifyPublicDocumentOp({
      documentId: 'token-inexistant-999',
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    expect(resNotFound.statusCode).toBe(404);
    expect(resNotFound.body.status).toBe('NOT_FOUND');

    const headers = new Map<string, string>();
    setVerifyNoIndexHeaders({
      setHeader(k: string, v: string) { headers.set(k, v); },
    } as unknown as import('express').Response);
    expect(headers.get('X-Robots-Tag')).toContain('noindex');
  });

  it('Point F : premier PDF sans DUPLICATA, puis reprintCount atomique + régénération depuis snapshotData avec DUPLICATA n° X', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zekoul-reprint-'));
    tempDirs.push(dir);
    const pdfStorage = new LocalDiskBulletinPdfStorageAdapter(dir);
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const repo = new InMemoryBulletinRepository();

    const snap = buildSnapshot(14.5);
    const bulletin = Bulletin.create({
      schoolId: 'sch-1', studentId: 'stu-1', academicYearId: 'yr-1', academicPeriodId: 'per-1', template: 'FR_SECONDARY',
    });
    bulletin.definirLignesMatiere([{ id: 'l1', subjectId: 'math', subjectName: 'Maths', coefficient: 4, subjectAverage: 14.5, weightedScore: 58 }]);
    bulletin.definirResultats({ generalAverage: 14.5, rank: 3, totalStudents: 40, mention: 'Bien', absenceCount: 0 });
    bulletin.scellerSnapshot({
      snapshotData: snap,
      contentHash: canonicalHashSnapshot(snap),
      verifyToken: genererVerifyToken(),
      computationVersion: 2,
      templateSpecId: 'GENERAL_GROUPED_V1',
      templateVersion: 1,
    });
    bulletin.marquerGenere('pending');
    await repo.save(bulletin);

    const kit: SchoolIdentityKitRecord = {
      id: 'kit-1', schoolId: 'sch-1',
      regionalDelegationFr: 'DRES Centre', regionalDelegationEn: 'RDSE Centre',
      departmentalDelegationFr: 'DDES Mfoundi', departmentalDelegationEn: 'DDSE Mfoundi',
      mottoFr: 'Discipline & Succès', mottoEn: 'Discipline & Success',
      poBox: '4021', city: 'Yaoundé', phone: '+237 677 00 00 00',
      foundingYear: 2005, authorizationNumber: 'MINESEC/045', accentColor: '#e2e8f0',
      logoAssetKey: null, coatOfArmsAssetKey: null, stampAssetKey: null,
      principalSignatureAssetKey: null, censorSignatureAssetKey: null,
      useCoatOfArms: false, updatedById: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const exportData: BulletinExportData = {
      id: bulletin.id,
      schoolId: 'sch-1',
      studentId: 'stu-1',
      academicYearId: 'yr-1',
      academicPeriodId: 'per-1',
      template: 'FR_SECONDARY',
      templateSpecId: 'GENERAL_GROUPED_V1',
      templateVersion: 1,
      computationVersion: 2,
      snapshotData: snap,
      contentHash: bulletin.contentHash,
      verifyToken: bulletin.verifyToken,
      shortVerifyCode: bulletin.shortVerifyCode,
      reprintCount: 0,
      pdfUrl: null,
      generalAverage: 14.5,
      rank: 3,
      totalStudents: 40,
      absenceCount: 0,
      mention: 'Bien',
      classMasterComment: 'Sérieux.',
      academicYear: { id: 'yr-1', name: '2026-2027' },
      academicPeriod: { id: 'per-1', name: 'Trimestre 1' },
      student: {
        id: 'stu-1',
        firstName: 'Jean',
        lastName: 'KAMGA',
        studentProfile: { enrollmentsYearScoped: [{ class: { name: '3e A', level: '3e', section: { code: 'FR' } } }] },
      },
      subjectLines: [],
      school: {
        id: 'sch-1',
        name: 'Collège Le Québécois',
        subsystem: 'FRANCOPHONE',
        schoolConfig: { useMeasuredBulletinRenderer: true },
        schoolSettings: null,
        identityKit: kit,
      },
      section: { code: 'FR' },
    };

    const captureTexts = async (forceReprint: boolean): Promise<string[]> => {
      const texts: string[] = [];
      const orig = PDFDocument.prototype.text;
      PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t?: string, ...rest: unknown[]) {
        if (typeof t === 'string') texts.push(t);
        return (orig as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
      } as typeof PDFDocument.prototype.text;
      try {
        await getOrRegenerateSealedBulletinPdf({
          reportCard: exportData,
          role: 'ADMIN',
          language: 'fr',
          verifyBaseUrl: 'https://zekoulabia.app',
          forceRegenerateFromSnapshot: forceReprint,
          bulletinRenderer: renderer,
          bulletinPdfStorage: pdfStorage,
        });
      } finally {
        PDFDocument.prototype.text = orig;
      }
      return texts;
    };

    // 1er téléchargement : aucune mention DUPLICATA + kit officiel appliqué
    const originalTexts = await captureTexts(false);
    expect(originalTexts.some((t) => t.includes('DUPLICATA'))).toBe(false);
    expect(originalTexts.some((t) => t.includes('DRES Centre'))).toBe(true);
    expect(originalTexts.some((t) => t.includes('Fondé en 2005'))).toBe(true);

    // 1re réédition (?reprint=true)
    exportData.reprintCount = await repo.incrementReprintCount(bulletin.id, 'sch-1');
    expect(exportData.reprintCount).toBe(1);
    const dup1Texts = await captureTexts(true);
    expect(dup1Texts.some((t) => t.includes('DUPLICATA n° 1'))).toBe(true);

    // 2e réédition (?reprint=true)
    exportData.reprintCount = await repo.incrementReprintCount(bulletin.id, 'sch-1');
    expect(exportData.reprintCount).toBe(2);
    const dup2Texts = await captureTexts(true);
    expect(dup2Texts.some((t) => t.includes('DUPLICATA n° 2'))).toBe(true);
  });
});
