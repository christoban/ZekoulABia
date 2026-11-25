/**
 * Test d'intégration — ReportCardController.exporterZip, touché par le retrait de 5 casts
 * `as any`. Révèle et vérifie le correctif d'un bug indépendant trouvé au passage : le champ
 * `className` du PDF exporté lisait `(reportCard as any).class?.name`, mais ReportCard n'a
 * AUCUNE relation `class` directe (uniquement via student.studentProfile.class) — le champ
 * était donc toujours `undefined`, chaque bulletin exporté en ZIP affichait "—" au lieu du
 * vrai nom de classe, quelle que soit la classe réelle de l'élève.
 *
 * Le contenu du PDF/ZIP n'est pas parsé ici (hors périmètre raisonnable) — le test vérifie
 * directement, avec la même requête Prisma (mêmes include) que le contrôleur corrigé, que
 * `reportCard.student.studentProfile.class.name` résout bien vers le vrai nom de classe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let classId: string;
let academicPeriodId: string;
let studentId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'reportCardZip');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  const classe = await prismaTest.class.create({ data: { schoolId, academicYearId: annee.id, name: '4ème Export Zip', level: '4ème' } });
  classId = classe.id;
  const periode = await prismaTest.academicPeriod.create({
    data: { name: 'Trimestre 1', academicYearId: annee.id, orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-15') },
  });
  academicPeriodId = periode.id;

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'export-zip' });
  studentId = student.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId, enrolledById: student.id });

  await prismaTest.reportCard.create({
    data: {
      schoolId, studentId, academicYearId: annee.id, academicPeriodId,
      generalAverage: 13.5, rank: 1, totalStudents: 1, template: 'FR_SECONDARY',
    },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.reportCard.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId: { in: (await prismaTest.academicYear.findMany({ where: { schoolId }, select: { id: true } })).map(a => a.id) } } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('ReportCardController.exporterZip — résolution className via Enrollment year-scoped', () => {
  it('la requête Prisma corrigée (mêmes include que le contrôleur) résout le vrai nom de classe', async () => {
    const reportCard = await prismaTest.reportCard.findFirst({
      where: { schoolId, academicPeriodId },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true,
            studentProfile: {
              select: {
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  select: { class: { select: { name: true } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    expect(reportCard).not.toBeNull();
    // Avant le correctif, (reportCard as any).class?.name était toujours undefined → '—'.
    expect(reportCard!.student.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name).toBe('4ème Export Zip');
  });

  it("POST /report-cards/export/:classId répond 200 avec un ZIP", async () => {
    const res = await fetch(`${baseUrl}/report-cards/export/${classId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ academicPeriodId }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
  });
});
