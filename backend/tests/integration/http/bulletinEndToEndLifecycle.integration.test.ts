import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import {
  definirOutboundMessagingPolicy,
  politiqueEnvoiSortantPlateforme,
} from '@infrastructure/services/outbound/OutboundMessagingPolicy';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { nettoyerEcole } from '../../helpers/dbFixtures.ts';
import { seedBulletinAtelierDemo, type SeedBulletinDemoResult } from '../../../scripts/seed-bulletin-atelier-demo.ts';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET requis dans .env.test pour exécuter le test E2E.');
}

let server: Server;
let baseUrl: string;
let tempPdfDir: string;
let prevStorageDir: string | undefined;
let seedData: SeedBulletinDemoResult;
let adminToken: string;
let teacherToken: string;
let parentToken: string;

const asCookie = (tok: string) => ({ Cookie: `access_token=${tok}`, 'Content-Type': 'application/json' });

describe('Étape 8.4 PostgreSQL + HTTP E2E — Parcours complet bulletin de bout en bout', () => {
  beforeAll(async () => {
    prevStorageDir = process.env.BULLETIN_PDF_STORAGE_DIR;
    tempPdfDir = await mkdtemp(path.join(os.tmpdir(), 'zk-e2e-bulletins-'));
    process.env.BULLETIN_PDF_STORAGE_DIR = tempPdfDir;

    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(cookieParser());
    bootstrapHexagonal(app);
    server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}/api/v2`;

    seedData = await seedBulletinAtelierDemo(prismaTest, { uniqueSuffix: `e2e-${Date.now()}` });
    definirOutboundMessagingPolicy({ estActive: async () => false });
    adminToken = jwt.sign(
      { userId: seedData.adminId, schoolId: seedData.schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
      process.env.JWT_SECRET!,
    );
    teacherToken = jwt.sign(
      { userId: seedData.teacherId, schoolId: seedData.schoolId, role: 'TEACHER', permissions: [], tokenType: 'access' },
      process.env.JWT_SECRET!,
    );
    parentToken = jwt.sign(
      { userId: seedData.parentId, schoolId: seedData.schoolId, role: 'PARENT', permissions: [], tokenType: 'access' },
      process.env.JWT_SECRET!,
    );
  });

  afterAll(async () => {
    definirOutboundMessagingPolicy(politiqueEnvoiSortantPlateforme);
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevStorageDir === undefined) delete process.env.BULLETIN_PDF_STORAGE_DIR;
    else process.env.BULLETIN_PDF_STORAGE_DIR = prevStorageDir;
    await rm(tempPdfDir, { recursive: true, force: true });

    if (seedData?.schoolId) {
      const sid = seedData.schoolId;
      await prismaTest.suppressedOutboundMessage.deleteMany({ where: { schoolId: sid } }).catch(() => {});
      await prismaTest.emailLog.deleteMany({ where: { schoolId: sid } }).catch(() => {});
      await prismaTest.notification.deleteMany({ where: { schoolId: sid } }).catch(() => {});
      await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId: sid } }).catch(() => {});
      await prismaTest.bulletinValidationSession.deleteMany({ where: { schoolId: sid } });
      await prismaTest.bulletinRevocationArchive.deleteMany({ where: { schoolId: sid } });
      await prismaTest.reportCard.deleteMany({ where: { schoolId: sid } });
      await prismaTest.classCouncilSession.deleteMany({ where: { schoolId: sid } });
      await prismaTest.grade.deleteMany({ where: { schoolId: sid } });
      await prismaTest.bulletinTemplateAssignment.deleteMany({ where: { schoolId: sid } });
      await prismaTest.schoolIdentityKit.deleteMany({ where: { schoolId: sid } });
      await prismaTest.schoolConfig.deleteMany({ where: { schoolId: sid } });
      await prismaTest.parentStudent.deleteMany({ where: { parentProfile: { user: { schoolId: sid } } } });
      await prismaTest.parentProfile.deleteMany({ where: { user: { schoolId: sid } } });
      await prismaTest.enrollment.deleteMany({ where: { schoolId: sid } });
      await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId: sid } } });
      await prismaTest.academicSequence.deleteMany({ where: { schoolId: sid } });
      await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId: sid } } });
      await prismaTest.class.deleteMany({ where: { schoolId: sid } });
      await prismaTest.section.deleteMany({ where: { schoolId: sid } });
      await prismaTest.subject.deleteMany({ where: { schoolId: sid } });
      await prismaTest.academicYear.deleteMany({ where: { schoolId: sid } });
      await prismaTest.user.deleteMany({ where: { schoolId: sid } });
      await nettoyerEcole(prismaTest, sid);
    }
  });

  it('enchaîne : notes LOCKED -> génération -> soumission -> validation -> publication -> PDF stocké -> /verify -> duplicata -> régénération (révocation) -> /verify REVOKED', async () => {
    const { schoolId, classId, academicPeriodId, academicYearId, studentIds, sequenceIds, mathSubjectId } = seedData;
    const aliceId = studentIds[0]!;

    // 1. Génération des bulletins (notes LOCKED + conseil LOCKED)
    const genRes = await fetch(`${baseUrl}/report-cards/generate`, {
      method: 'POST',
      headers: asCookie(adminToken),
      body: JSON.stringify({ classId, academicPeriodId, academicYearId, template: 'FR_SECONDARY' }),
    });
    const genJson = (await genRes.json()) as { success: boolean; data: { bulletinsGeneres: number } };
    expect(genRes.status).toBe(200);
    expect(genJson.data.bulletinsGeneres).toBe(3);

    const aliceBulletinV1 = await prismaTest.reportCard.findFirstOrThrow({
      where: { schoolId, studentId: aliceId, academicPeriodId },
    });
    expect(aliceBulletinV1.validationStatus).toBe('GENERATED');
    expect(aliceBulletinV1.verifyToken?.length).toBeGreaterThanOrEqual(48);
    expect(aliceBulletinV1.shortVerifyCode).toMatch(/^ZK-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(aliceBulletinV1.pdfUrl).toBeTruthy();

    const storedBytesV1 = await readFile(path.join(tempPdfDir, aliceBulletinV1.pdfUrl!));
    expect(storedBytesV1.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    console.log('[E2E 1-2] Générés:', genJson.data.bulletinsGeneres, '| pdfUrl:', aliceBulletinV1.pdfUrl, '| avgV1:', aliceBulletinV1.generalAverage);

    // 2. Soumission (TEACHER PP) -> Validation (ADMIN) -> Publication (ADMIN)
    const subRes = await fetch(`${baseUrl}/bulletin-validations`, {
      method: 'POST',
      headers: asCookie(teacherToken),
      body: JSON.stringify({ classId, academicPeriodId }),
    });
    const subJson = (await subRes.json()) as { success: boolean; data: { session: { id: string; status: string } } };
    expect(subRes.status).toBe(201);
    const sessionId = subJson.data.session.id;
    expect(subJson.data.session.status).toBe('SUBMITTED');

    const valRes = await fetch(`${baseUrl}/bulletin-validations/${sessionId}/validate`, {
      method: 'POST',
      headers: asCookie(adminToken),
      body: JSON.stringify({}),
    });
    const valJson = (await valRes.json()) as { data: { session: { status: string } } };
    expect(valRes.status).toBe(200);
    expect(valJson.data.session.status).toBe('VALIDATED');

    const pubRes = await fetch(`${baseUrl}/bulletin-validations/${sessionId}/publish`, {
      method: 'POST',
      headers: asCookie(adminToken),
      body: JSON.stringify({ classId, nomPeriode: 'Trimestre 1' }),
    });
    const pubJson = (await pubRes.json()) as { data: { session: { status: string } } };
    expect(pubRes.status).toBe(200);
    expect(pubJson.data.session.status).toBe('PUBLISHED');
    console.log('[E2E 3-4] Workflow:', subJson.data.session.status, '->', valJson.data.session.status, '->', pubJson.data.session.status);

    // 3. Téléchargement du PDF stocké par le parent -> reprintCount reste 0
    const dlRes = await fetch(`${baseUrl}/report-cards/${aliceBulletinV1.id}/pdf`, {
      headers: { Cookie: `access_token=${parentToken}` },
    });
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get('content-type')).toContain('application/pdf');
    const dlBuf = Buffer.from(await dlRes.arrayBuffer());
    expect(dlBuf.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const afterParentDl = await prismaTest.reportCard.findUniqueOrThrow({ where: { id: aliceBulletinV1.id } });
    expect(afterParentDl.reprintCount).toBe(0);
    console.log('[E2E 5] Téléchargement PDF parent OK (octets:', dlBuf.length, ') | reprintCount:', afterParentDl.reprintCount);

    // 4. Vérification publique /verify (jeton long vs code court)
    const oldToken = aliceBulletinV1.verifyToken!;
    const oldShortCode = aliceBulletinV1.shortVerifyCode!;

    const verLongRes = await fetch(`${baseUrl}/verify/${oldToken}`);
    const verLong = (await verLongRes.json()) as {
      document: { status: string; lookupMode: string; generalAverage: number; rank: number };
    };
    expect(verLongRes.status).toBe(200);
    expect(verLong.document.status).toBe('AUTHENTIC');
    expect(verLong.document.lookupMode).toBe('LONG_TOKEN');
    expect(verLong.document.generalAverage).toBe(aliceBulletinV1.generalAverage!);
    expect(verLong.document.rank).toBe(aliceBulletinV1.rank!);

    const verShortRes = await fetch(`${baseUrl}/verify/${oldShortCode}`);
    const verShort = (await verShortRes.json()) as {
      document: { status: string; lookupMode: string; generalAverage?: number; rank?: number };
    };
    expect(verShortRes.status).toBe(200);
    expect(verShort.document.status).toBe('AUTHENTIC');
    expect(verShort.document.lookupMode).toBe('SHORT_CODE');
    expect(verShort.document.generalAverage).toBeUndefined();
    expect(verShort.document.rank).toBeUndefined();
    console.log('[E2E 6] /verify AUTHENTIC OK | LONG avg:', verLong.document.generalAverage, '| SHORT lookupMode:', verShort.document.lookupMode);

    // 5. Duplicata contrôlé (POST /reprint avec motif) -> X-Reprint-Count: 1
    const dupRes = await fetch(`${baseUrl}/report-cards/${aliceBulletinV1.id}/reprint`, {
      method: 'POST',
      headers: asCookie(adminToken),
      body: JSON.stringify({ motif: 'Perte original parent' }),
    });
    expect(dupRes.status).toBe(200);
    expect(dupRes.headers.get('x-reprint-count')).toBe('1');
    const dupPdf = Buffer.from(await dupRes.arrayBuffer());
    expect(dupPdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    console.log('[E2E 7] Duplicata émis OK | X-Reprint-Count:', dupRes.headers.get('x-reprint-count'));

    // 6. Régénération contrôlée (révocation) après correction d'une note -> ancien token = REVOKED
    await prismaTest.grade.updateMany({
      where: { schoolId, studentId: aliceId, subjectId: mathSubjectId, sequenceId: sequenceIds[1] },
      data: { sequenceScore: 19, sequenceAverage: 19 },
    });

    const regenRes = await fetch(`${baseUrl}/report-cards/generate`, {
      method: 'POST',
      headers: asCookie(adminToken),
      body: JSON.stringify({
        classId,
        academicPeriodId,
        academicYearId,
        template: 'FR_SECONDARY',
        forceRegenerate: true,
        motifRegeneration: 'Correction erreur matérielle note Mathématiques Séquence 2',
      }),
    });
    const regenJson = (await regenRes.json()) as { success: boolean; data: { bulletinsGeneres: number } };
    expect(regenRes.status).toBe(200);
    expect(regenJson.data.bulletinsGeneres).toBe(3);

    const verOldLongRes = await fetch(`${baseUrl}/verify/${oldToken}`);
    const verOldLong = (await verOldLongRes.json()) as { document: { status: string; authentic: boolean } };
    expect(verOldLongRes.status).toBe(200);
    expect(verOldLong.document.status).toBe('REVOKED');
    expect(verOldLong.document.authentic).toBe(false);

    const verOldShortRes = await fetch(`${baseUrl}/verify/${oldShortCode}`);
    const verOldShort = (await verOldShortRes.json()) as { document: { status: string; authentic: boolean } };
    expect(verOldShortRes.status).toBe(200);
    expect(verOldShort.document.status).toBe('REVOKED');
    expect(verOldShort.document.authentic).toBe(false);

    const aliceBulletinV2 = await prismaTest.reportCard.findFirstOrThrow({
      where: { schoolId, studentId: aliceId, academicPeriodId },
    });
    expect(aliceBulletinV2.id).not.toBe(aliceBulletinV1.id);
    expect(aliceBulletinV2.verifyToken).not.toBe(oldToken);
    expect(aliceBulletinV2.generalAverage!).toBeGreaterThan(aliceBulletinV1.generalAverage!);

    const verNewRes = await fetch(`${baseUrl}/verify/${aliceBulletinV2.verifyToken!}`);
    const verNew = (await verNewRes.json()) as { document: { status: string; generalAverage: number } };
    expect(verNewRes.status).toBe(200);
    expect(verNew.document.status).toBe('AUTHENTIC');
    expect(verNew.document.generalAverage).toBe(aliceBulletinV2.generalAverage!);
    console.log('[E2E 8] Régénération & Révocation OK | oldStatus:', verOldLong.document.status, '| newAvg:', verNew.document.generalAverage);
  }, 25000);
});
