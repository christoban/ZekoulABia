import { describe, it, expect, afterEach } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Bulletin } from '@domain/entities/Bulletin';
import {
  buildLongTokenVerifyUrl,
  canonicalHashSnapshot,
  deriveShortVerifyCode,
  isLongVerifyToken,
  isShortVerifyCode,
} from '@domain/policies/BulletinVerifyCrypto';
import { genererVerifyToken, resoudreVerifyBaseUrl } from '@application/reportCard/bulletinEnrichmentHelpers';
import { sealAndStoreBulletinsForClass } from '@application/reportCard/bulletinPdfLifecycle';
import { resolveTrustProxyConfig } from '@infrastructure/config/EnvAppConfig';
import { verifyPublicDocumentOp } from '@infrastructure/http/controllers/helpers/verifyPublicDocumentOp';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { InMemoryBulletinRepository } from '../../helpers/repositories/InMemoryBulletinRepository';
import type { StudentDocumentRepository } from '@domain/ports/repositories/StudentDocumentRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import type { SchoolIdentityKitRecord } from '@domain/ports/repositories/SchoolIdentityKitRepository';

function makeSnapshot(avg = 15.75, rank = 2): StudentBulletinSnapshot {
  return {
    studentId: 'stu-1',
    computationVersion: 2,
    templateVersion: 1,
    generalAverage: avg,
    totalCoefficient: 4,
    totalWeightedScore: avg * 4,
    rank,
    totalStudents: 42,
    mainTeacherName: 'Mme ONDOA',
    studentIdentity: {
      studentId: 'stu-1',
      fullName: 'KAMGA Jean-Baptiste',
      firstName: 'Jean-Baptiste',
      lastName: 'KAMGA',
      matricule: '26-SECRET-009',
      dateOfBirth: '2011-05-03T00:00:00.000Z',
      placeOfBirth: 'Douala',
      gender: 'M',
      isRepeater: false,
      photoUrl: null,
    },
    conduct: {
      justifiedAbsenceHours: 3,
      unjustifiedAbsenceHours: 1,
      totalAbsenceHours: 4,
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
      classSize: 42,
      classAverage: 12.1,
      topAverage: 17.9,
      lowAverage: 6.4,
      passCount: 33,
      passRate: 78.57,
    },
    subjectLines: [
      {
        subjectId: 'sub-math',
        subjectName: 'Mathématiques Secrètes',
        coefficient: 4,
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        seq1Score: avg,
        seq2Score: avg,
        subjectAverage: avg,
        weightedScore: avg * 4,
        subjectRank: rank,
        subjectTotalStudents: 42,
        classSubjectAverage: 12.0,
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
        groupRank: rank,
        groupTotalStudents: 42,
      },
    ],
  };
}

describe('Étape 5 bis — QR jeton long configurable, /verify deux niveaux, POST reprint audité, trust proxy et cache lot', () => {
  const savedEnv = process.env.PUBLIC_VERIFY_BASE_URL;

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.PUBLIC_VERIFY_BASE_URL;
    else process.env.PUBLIC_VERIFY_BASE_URL = savedEnv;
  });

  it('Point 1 : QR encode uniquement /verify/<verifyToken long >= 128 bits> depuis PUBLIC_VERIFY_BASE_URL et rejette tout code court', () => {
    process.env.PUBLIC_VERIFY_BASE_URL = 'https://verify.zekoulabia.cm/';
    const base = resoudreVerifyBaseUrl();
    expect(base).toBe('https://verify.zekoulabia.cm');

    const longToken = genererVerifyToken();
    expect(isLongVerifyToken(longToken)).toBe(true);
    const qrUrl = buildLongTokenVerifyUrl(base, longToken);
    expect(qrUrl).toBe(`https://verify.zekoulabia.cm/verify/${longToken}`);

    // Log informatif de l'URL réelle générée pour le rapport
    console.log('ETAPE5BIS_REAL_QR_URL=', qrUrl);

    // Doit échouer si le QR contient un code court ZK-... ou un ID trop court
    const shortCode = deriveShortVerifyCode(longToken);
    expect(isShortVerifyCode(shortCode)).toBe(true);
    expect(() => buildLongTokenVerifyUrl(base, shortCode)).toThrow(/jeton cryptographique >= 128 bits/);
    expect(() => buildLongTokenVerifyUrl(base, 'short-id-123')).toThrow(/jeton cryptographique >= 128 bits/);
  });

  it('Point 2 : /verify par jeton long affiche MOYENNE GÉNÉRALE + RANG (sans notes/matricule), par code court renvoie uniquement le STATUT', async () => {
    const repo = new InMemoryBulletinRepository();
    repo.definirStudentName('stu-1', 'Jean-Baptiste', 'KAMGA');
    repo.definirClasseEleve('stu-1', '3ème Bilingue');

    const token = genererVerifyToken();
    const snap = makeSnapshot(15.75, 2);
    const bulletin = Bulletin.create({
      schoolId: 'sch-1',
      studentId: 'stu-1',
      academicYearId: '2026-2027',
      academicPeriodId: 'Trimestre 2',
      template: 'FR_SECONDARY',
    });
    bulletin.definirLignesMatiere([{ id: 'l1', subjectId: 'math', subjectName: 'Maths', coefficient: 4, subjectAverage: 15.75, weightedScore: 63 }]);
    bulletin.definirResultats({ generalAverage: 15.75, rank: 2, totalStudents: 42, mention: 'Bien', absenceCount: 4 });
    bulletin.scellerSnapshot({
      snapshotData: snap,
      contentHash: canonicalHashSnapshot(snap),
      verifyToken: token,
      computationVersion: 2,
    });
    bulletin.marquerGenere('k-1');
    await repo.save(bulletin);

    const emptyDocRepo = { findById: async () => null } as unknown as StudentDocumentRepository;
    const schoolRepo = { findById: async () => null } as unknown as SchoolRepository;

    // Chemin 1 : ouverture via jeton long du QR
    const longRes = await verifyPublicDocumentOp({
      documentId: token,
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    expect(longRes.statusCode).toBe(200);
    const longDoc = longRes.body.document as Record<string, unknown>;
    expect(longDoc.lookupMode).toBe('LONG_TOKEN');
    expect(longDoc.status).toBe('AUTHENTIC');
    expect(longDoc.school).toBe('Établissement Test');
    expect(longDoc.className).toBe('3ème Bilingue');
    expect(longDoc.periodName).toBe('Trimestre 2');
    expect(longDoc.studentMaskedName).toBe('KAMGA J.');
    expect(longDoc.generalAverage).toBe(15.75);
    expect(longDoc.generalAverageDisplay).toBe('15,75 / 20');
    expect(longDoc.rank).toBe(2);
    expect(longDoc.rankDisplay).toBe('2e / 42');
    expect(typeof longDoc.issuedAt).toBe('string');

    // Aucune note par matière, matricule ni conduite ne doit fuiter
    const longJson = JSON.stringify(longDoc);
    expect(longJson).not.toContain('Mathématiques Secrètes');
    expect(longJson).not.toContain('26-SECRET-009');
    expect(longJson).not.toContain('consignes');

    // Chemin 2 : recherche manuelle via code court ZK-XXXX-XXXX -> statut uniquement, ZERO chiffre
    const shortCode = deriveShortVerifyCode(token);
    const shortRes = await verifyPublicDocumentOp({
      documentId: shortCode,
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    expect(shortRes.statusCode).toBe(200);
    const shortDoc = shortRes.body.document as Record<string, unknown>;
    expect(shortDoc.lookupMode).toBe('SHORT_CODE');
    expect(shortDoc.status).toBe('AUTHENTIC');
    expect(shortDoc.authentic).toBe(true);
    expect(shortDoc.generalAverage).toBeUndefined();
    expect(shortDoc.rank).toBeUndefined();
    expect(shortDoc.studentMaskedName).toBeUndefined();
    expect(shortDoc.school).toBeUndefined();

    // Code court inexistant -> INTROUVABLE
    const unknownShort = await verifyPublicDocumentOp({
      documentId: 'ZK-0000-FFFF',
      documentRepository: emptyDocRepo,
      bulletinRepository: repo,
      schoolRepository: schoolRepo,
    });
    expect(unknownShort.statusCode).toBe(404);
    expect(unknownShort.body.status).toBe('NOT_FOUND');
  });

  it('Point 3 : téléchargement simple GET n’incrémente jamais le compteur ; POST /reprint exige motif, audite et un rechargement ne réincrémente pas', async () => {
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const auditLogs: Array<Record<string, unknown>> = [];
    const memoryPdf = new Map<string, Buffer>();
    const pdfStorage: FileStoragePort = {
      driverName: 'local',
      put: async (key, buf, contentType) => { memoryPdf.set(key, buf); return { key, size: buf.length, contentType }; },
      get: async (key) => { const b = memoryPdf.get(key); return b ? { buffer: b, contentType: 'application/pdf' } : null; },
      exists: async (key) => memoryPdf.has(key),
      delete: async (key) => { memoryPdf.delete(key); },
    };

    const repo = new InMemoryBulletinRepository();
    const snap = makeSnapshot(14.5, 4);
    const token = genererVerifyToken();
    const bulletin = Bulletin.create({
      schoolId: 'sch-1',
      studentId: 'stu-1',
      academicYearId: 'yr-1',
      academicPeriodId: 'per-1',
      template: 'FR_SECONDARY',
    });
    bulletin.definirLignesMatiere([{ id: 'l1', subjectId: 'math', subjectName: 'Maths', coefficient: 4, subjectAverage: 14.5, weightedScore: 58 }]);
    bulletin.definirResultats({ generalAverage: 14.5, rank: 4, totalStudents: 42, mention: 'Bien', absenceCount: 0 });
    bulletin.scellerSnapshot({
      snapshotData: snap,
      contentHash: canonicalHashSnapshot(snap),
      verifyToken: token,
      computationVersion: 2,
      templateSpecId: 'GENERAL_GROUPED_V1',
      templateVersion: 1,
    });
    bulletin.marquerGenere(`sch-1/bulletins/per-1/${bulletin.id}_v1.pdf`);
    await repo.save(bulletin);

    repo.findForPdf = async (bulletinId, schoolId): Promise<BulletinExportData | null> => {
      const b = await repo.findById(bulletinId);
      if (!b || b.schoolId !== schoolId) return null;
      const o = b.toObject();
      return {
        id: o.id,
        schoolId: o.schoolId,
        studentId: o.studentId,
        academicYearId: o.academicYearId,
        academicPeriodId: o.academicPeriodId,
        template: o.template,
        templateSpecId: o.templateSpecId,
        templateVersion: o.templateVersion,
        computationVersion: o.computationVersion,
        snapshotData: o.snapshotData,
        contentHash: o.contentHash,
        verifyToken: o.verifyToken,
        shortVerifyCode: o.shortVerifyCode,
        reprintCount: o.reprintCount ?? 0,
        pdfUrl: o.pdfUrl,
        generalAverage: o.generalAverage ?? null,
        rank: o.rank ?? null,
        totalStudents: o.totalStudents ?? null,
        absenceCount: o.absenceCount,
        mention: o.mention ?? null,
        classMasterComment: null,
        academicYear: { id: 'yr-1', name: '2026-2027' },
        academicPeriod: { id: 'per-1', name: 'Trimestre 1' },
        student: {
          id: 'stu-1', firstName: 'Jean', lastName: 'KAMGA',
          studentProfile: { enrollmentsYearScoped: [{ class: { name: '3e A', level: '3e', section: { code: 'FR' } } }] },
        },
        subjectLines: [],
        school: {
          id: 'sch-1', name: 'Collège Test', subsystem: 'FRANCOPHONE',
          schoolConfig: { useMeasuredBulletinRenderer: true },
          schoolSettings: null, identityKit: null,
        },
        section: { code: 'FR' },
      };
    };

    const controller = new ReportCardController(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      repo,
      { aAccesEleve: async () => true } as never,
      { journaliser: (p: Record<string, unknown>) => auditLogs.push(p) },
      undefined, undefined, undefined, undefined,
      renderer, pdfStorage,
    );

    const callEndpoint = async (
      fn: typeof controller.telechargerPdf,
      reqPatch: Partial<import('express').Request>,
    ) => {
      let status = 200;
      let jsonBody: unknown = null;
      let endedBuf: Buffer | null = null;
      const headers = new Map<string, string>();
      const req = { params: { id: bulletin.id }, query: {}, body: {}, ...reqPatch } as unknown as import('express').Request;
      const res = {
        status(s: number) { status = s; return this; },
        json(b: unknown) { jsonBody = b; return this; },
        setHeader(k: string, v: string | number) { headers.set(k.toLowerCase(), String(v)); },
        end(b: Buffer) { endedBuf = b; },
      } as unknown as import('express').Response;
      await fn(req, res, (err) => { if (err) throw err; });
      return { status, jsonBody, endedBuf, headers };
    };

    // 1. Téléchargements parents successifs (?reprint=true même tenté en query ne doit rien changer)
    const p1 = await callEndpoint(controller.telechargerPdf, {
      user: { userId: 'par-1', schoolId: 'sch-1', role: 'PARENT', permissions: [], tokenType: 'access' },
      query: { reprint: 'true' },
    });
    expect(p1.status).toBe(200);
    expect((await repo.findById(bulletin.id))!.reprintCount).toBe(0);

    // 2. Parent refusé sur POST /reprint (403)
    const pReprintForbidden = await callEndpoint(controller.reimprimerDuplicata, {
      user: { userId: 'par-1', schoolId: 'sch-1', role: 'PARENT', permissions: [], tokenType: 'access' },
      body: { motif: 'Test' },
    });
    expect(pReprintForbidden.status).toBe(403);

    // 3. Admin sans motif refusé (400)
    const adminNoMotif = await callEndpoint(controller.reimprimerDuplicata, {
      user: { userId: 'adm-1', schoolId: 'sch-1', role: 'ADMIN', permissions: [], tokenType: 'access' },
      body: { motif: '   ' },
    });
    expect(adminNoMotif.status).toBe(400);

    // 4. Admin avec motif valide -> incrément 0 -> 1, DUPLICATA n° 1 et audit log écrit
    const drawnTexts: string[] = [];
    const origText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t?: string, ...rest: unknown[]) {
      if (typeof t === 'string') drawnTexts.push(t);
      return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
    } as typeof PDFDocument.prototype.text;
    try {
      const adminOk = await callEndpoint(controller.reimprimerDuplicata, {
        user: { userId: 'adm-1', schoolId: 'sch-1', role: 'ADMIN', permissions: [], tokenType: 'access' },
        body: { motif: 'Bulletin perdu par la famille' },
      });
      expect(adminOk.status).toBe(200);
      expect(adminOk.headers.get('x-reprint-count')).toBe('1');
      expect((await repo.findById(bulletin.id))!.reprintCount).toBe(1);
      expect(drawnTexts.some((t) => t.includes('DUPLICATA n° 1'))).toBe(true);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]!.actionName).toBe('reimprimer_duplicata_bulletin');
      expect(auditLogs[0]!.actorUserId).toBe('adm-1');
      expect((auditLogs[0]!.parametersSummary as Record<string, unknown>).motif).toBe('Bulletin perdu par la famille');
    } finally {
      PDFDocument.prototype.text = origText;
    }

    // 5. Rechargement GET /:id/pdf après réédition -> ne réincrémente pas (reste à 1)
    await callEndpoint(controller.telechargerPdf, {
      user: { userId: 'adm-1', schoolId: 'sch-1', role: 'ADMIN', permissions: [], tokenType: 'access' },
    });
    expect((await repo.findById(bulletin.id))!.reprintCount).toBe(1);
  });

  it('Point 4 : resolveTrustProxyConfig active trust proxy sur Railway et sépare les limites par X-Forwarded-For', async () => {
    expect(resolveTrustProxyConfig({} as NodeJS.ProcessEnv)).toBe(false);
    expect(resolveTrustProxyConfig({ RAILWAY_ENVIRONMENT: 'production' } as NodeJS.ProcessEnv)).toBe(1);
    expect(resolveTrustProxyConfig({ TRUST_PROXY: '1' } as NodeJS.ProcessEnv)).toBe(1);
    expect(resolveTrustProxyConfig({ TRUST_PROXY: 'false', RAILWAY_ENVIRONMENT: 'production' } as NodeJS.ProcessEnv)).toBe(false);

    const app = express();
    app.set('trust proxy', 1);
    const limiter = rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false });
    app.get('/test-verify/:id', limiter, (req, res) => {
      res.json({ ip: req.ip });
    });

    const srv: Server = app.listen(0);
    try {
      const { port } = srv.address() as AddressInfo;
      const callFrom = async (ip: string) =>
        fetch(`http://127.0.0.1:${port}/test-verify/abc`, { headers: { 'X-Forwarded-For': ip } });

      expect((await callFrom('198.51.100.1')).status).toBe(200);
      expect((await callFrom('198.51.100.1')).status).toBe(200);
      // 3e requête du même IP proxyfié -> 429
      expect((await callFrom('198.51.100.1')).status).toBe(429);
      // Un autre client derrière le même reverse proxy n'est pas bloqué -> 200
      const other = await callFrom('198.51.100.2');
      expect(other.status).toBe(200);
      expect(((await other.json()) as { ip: string }).ip).toBe('198.51.100.2');
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it('Point 6 : cache les images du kit identité (1 seule lecture par média pour un lot de 15 élèves)', async () => {
    const tinyPng = await QRCode.toBuffer('IMG', { type: 'png', width: 48, margin: 1 });
    let readCalls = 0;
    const assetReads = new Map<string, number>();

    const fileStorage: FileStoragePort = {
      driverName: 'local',
      put: async (key, buf, contentType) => ({ key, size: buf.length, contentType }),
      get: async (key) => {
        if (key.includes('/school-assets/')) {
          readCalls++;
          assetReads.set(key, (assetReads.get(key) ?? 0) + 1);
          return { buffer: tinyPng, contentType: 'image/png' };
        }
        return null;
      },
      exists: async () => false,
      delete: async () => {},
    };

    const kit: SchoolIdentityKitRecord = {
      id: 'kit-batch', schoolId: 'sch-1',
      regionalDelegationFr: 'DRES Nord', regionalDelegationEn: null,
      departmentalDelegationFr: 'DDES Bénoué', departmentalDelegationEn: null,
      mottoFr: 'Travail — Excellence', mottoEn: null,
      poBox: '101', city: 'Garoua', phone: null,
      foundingYear: 1995, authorizationNumber: null, accentColor: '#e2e8f0',
      logoAssetKey: 'sch-1/school-assets/logo.png',
      coatOfArmsAssetKey: 'sch-1/school-assets/coat.png',
      stampAssetKey: 'sch-1/school-assets/stamp.png',
      principalSignatureAssetKey: 'sch-1/school-assets/sigp.png',
      censorSignatureAssetKey: 'sch-1/school-assets/sigc.png',
      useCoatOfArms: true,
      updatedById: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const snap = makeSnapshot(14, 1);
    const rows: BulletinExportData[] = Array.from({ length: 15 }, (_, idx) => {
      const token = genererVerifyToken();
      return {
        id: `bul-${idx + 1}`,
        schoolId: 'sch-1',
        studentId: `stu-${idx + 1}`,
        academicYearId: 'yr-1',
        academicPeriodId: 'per-1',
        template: 'FR_SECONDARY',
        templateSpecId: 'GENERAL_GROUPED_V1',
        templateVersion: 1,
        computationVersion: 2,
        snapshotData: snap,
        contentHash: canonicalHashSnapshot(snap),
        verifyToken: token,
        shortVerifyCode: deriveShortVerifyCode(token),
        reprintCount: 0,
        pdfUrl: null,
        generalAverage: 14,
        rank: 1,
        totalStudents: 15,
        absenceCount: 0,
        mention: 'Bien',
        classMasterComment: null,
        academicYear: { id: 'yr-1', name: '2026-2027' },
        academicPeriod: { id: 'per-1', name: 'Trimestre 1' },
        student: {
          id: `stu-${idx + 1}`, firstName: `Eleve${idx + 1}`, lastName: 'TEST',
          studentProfile: { enrollmentsYearScoped: [{ class: { name: '3e A', level: '3e', section: { code: 'FR' } } }] },
        },
        subjectLines: [],
        school: {
          id: 'sch-1', name: 'Lycée Garoua', subsystem: 'FRANCOPHONE',
          schoolConfig: { useMeasuredBulletinRenderer: true },
          schoolSettings: null,
          identityKit: kit,
        },
        section: { code: 'FR' },
      };
    });

    const repo = new InMemoryBulletinRepository();
    repo.findForExport = async () => rows;
    repo.updatePdfMetadata = async () => {};

    const res = await sealAndStoreBulletinsForClass({
      classId: 'cls-1',
      academicPeriodId: 'per-1',
      schoolId: 'sch-1',
      bulletinRepository: repo,
      bulletinRenderer: new MeasuredPdfKitBulletinRenderer(),
      fileStorage,
      verifyBaseUrl: 'https://verify.zekoulabia.cm',
    });

    expect(res.sealedCount).toBe(15);
    // 5 médias configurés sur le kit => 5 lectures totales au lieu de 15 × 5 = 75
    expect(readCalls).toBe(5);
    for (const count of assetReads.values()) {
      expect(count).toBe(1);
    }
  });
});
