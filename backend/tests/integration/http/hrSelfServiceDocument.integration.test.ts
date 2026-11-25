/**
 * Test d'intégration — HRSelfServiceController.uploadMyDocument/downloadMyDocument, touché
 * par le retrait du cast `(this.prisma as any)` sur la colonne JSON
 * `EmployeeFile.documentsUrls` (tableau de `{ type, label, url, uploadedAt }`, typé
 * précisément en `EmployeeDocumentEntry[]` au lieu d'un `JsonValue` opaque). Vérifie sur la
 * vraie base + le vrai système de fichiers que l'écriture (upload) et la relecture
 * (download, qui accède à `doc.url`) fonctionnent toujours après ce typage.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

const DOCUMENTS_DIR = path.resolve(process.cwd(), 'storage', 'hr-documents');

let server: Server;
let baseUrl: string;
let schoolId: string;
let staffUserId: string;
let staffToken: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'hrDocuments');
  schoolId = school.id;

  const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF' });
  staffUserId = staff.id;
  staffToken = jwt.sign(
    { userId: staff.id, schoolId, role: 'STAFF', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.employeeFile.deleteMany({ where: { userId: staffUserId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
  const userDir = path.join(DOCUMENTS_DIR, staffUserId);
  if (fs.existsSync(userDir)) fs.rmSync(userDir, { recursive: true, force: true });
});

describe('HRSelfServiceController — upload puis download d\'un document (EmployeeFile.documentsUrls)', () => {
  it('POST /hr-self-service/me/document persiste {type,label,url,uploadedAt}, GET .../download relit doc.url', async () => {
    const form = new FormData();
    form.append('type', 'PIECE_IDENTITE');
    form.append('label', 'CNI recto-verso');
    form.append('file', new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }), 'cni.jpg');

    const resUpload = await fetch(`${baseUrl}/hr-self-service/me/document`, {
      method: 'POST',
      headers: { Cookie: `access_token=${staffToken}` },
      body: form,
    });
    const bodyUpload = await resUpload.json() as { success: boolean; message?: string };
    if (!bodyUpload.success) throw new Error(`Échec upload : ${bodyUpload.message ?? JSON.stringify(bodyUpload)}`);
    expect(resUpload.status).toBe(200);

    const fileRow = await prismaTest.employeeFile.findUnique({ where: { userId: staffUserId } });
    const documents = fileRow?.documentsUrls as unknown as { type: string; label: string; url: string; uploadedAt: string }[];
    expect(documents).toHaveLength(1);
    expect(documents[0].type).toBe('PIECE_IDENTITE');
    expect(documents[0].label).toBe('CNI recto-verso');
    expect(fs.existsSync(documents[0].url)).toBe(true);

    const resDownload = await fetch(`${baseUrl}/hr-self-service/me/document/0/download`, {
      method: 'GET',
      headers: { Cookie: `access_token=${staffToken}` },
    });
    expect(resDownload.status).toBe(200);
    const buffer = Buffer.from(await resDownload.arrayBuffer());
    expect(buffer.length).toBe(4);
  });
});
