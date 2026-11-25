import { describe, it, expect } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import {
  createSchoolBackup,
  getLatestSchoolBackup,
  listSchoolBackups,
} from '@infrastructure/backup/SchoolBackupService';
import { SchoolAdminQueriesController } from '@infrastructure/http/controllers/SchoolAdminQueriesController';
import type { SchoolAdminQueriesRepository } from '@domain/ports/repositories/SchoolAdminQueriesRepository';
import type {
  FileStoragePort,
  FileStorageMetadata,
  FileStorageReadResult,
  StoredFileObject,
} from '@domain/ports/services/FileStoragePort';

function createMemoryStorage(): FileStoragePort & {
  store: Map<string, { buffer: Buffer; contentType: string; metadata?: FileStorageMetadata }>;
} {
  const store = new Map<string, { buffer: Buffer; contentType: string; metadata?: FileStorageMetadata }>();
  return {
    driverName: 'local',
    store,
    async put(key: string, buffer: Buffer, contentType: string, metadata?: FileStorageMetadata): Promise<StoredFileObject> {
      store.set(key, { buffer: Buffer.from(buffer), contentType, metadata });
      return { key, size: buffer.length, contentType, metadata };
    },
    async get(key: string): Promise<FileStorageReadResult | null> {
      const entry = store.get(key);
      if (!entry) return null;
      return { buffer: Buffer.from(entry.buffer), contentType: entry.contentType, metadata: entry.metadata };
    },
    async exists(key: string): Promise<boolean> {
      return store.has(key);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

function createFakePrisma(upserts: Array<{ schoolId: string; lastBackupFile: string }>): PrismaClient {
  const emptyFindMany = async () => [];
  const emptyFindUnique = async () => null;
  return {
    school: { findUnique: async () => ({ id: 'school_alpha', name: 'Lycée Alpha' }) },
    schoolSettings: {
      findUnique: emptyFindUnique,
      upsert: async (args: { create: { schoolId: string; lastBackupFile: string } }) => {
        upserts.push({ schoolId: args.create.schoolId, lastBackupFile: args.create.lastBackupFile });
        return args.create;
      },
    },
    schoolNotificationSettings: { findUnique: emptyFindUnique },
    schoolConfigurationForm: { findUnique: emptyFindUnique },
    user: { findMany: emptyFindMany },
    class: { findMany: emptyFindMany },
    subject: { findMany: emptyFindMany },
    department: { findMany: emptyFindMany },
    academicYear: { findMany: emptyFindMany },
    academicSequence: { findMany: emptyFindMany },
    attendance: { findMany: emptyFindMany },
    grade: { findMany: emptyFindMany },
    reportCard: { findMany: emptyFindMany },
    invoice: { findMany: emptyFindMany },
    payment: { findMany: emptyFindMany },
    feePlan: { findMany: emptyFindMany },
    notification: { findMany: emptyFindMany },
    activitiesLog: { findMany: emptyFindMany },
    emailLog: { findMany: emptyFindMany },
    smsLog: { findMany: emptyFindMany },
    timetable: { findMany: emptyFindMany },
    timetableGridConfig: { findUnique: emptyFindUnique },
    staffProfile: { findMany: emptyFindMany },
    employeeFile: { findMany: emptyFindMany },
    careerEvent: { findMany: emptyFindMany },
    staffAttendance: { findMany: emptyFindMany },
    leaveRequest: { findMany: emptyFindMany },
    leaveBalance: { findMany: emptyFindMany },
    missionOrder: { findMany: emptyFindMany },
  } as unknown as PrismaClient;
}

describe('Phase S2.6 — SchoolBackupService via FileStoragePort', () => {
  it('stocke une sauvegarde JSON sous {schoolId}/school-backups/{uuid}.json, maintient le manifeste et purge les sauvegardes expirées (>30j)', async () => {
    const storage = createMemoryStorage();
    const upserts: Array<{ schoolId: string; lastBackupFile: string }> = [];
    const fakePrisma = createFakePrisma(upserts);

    // Pré-insérer une sauvegarde expirée de 45 jours dans le stockage + manifeste
    const expiredKey = 'school_alpha/school-backups/00000000-0000-0000-0000-000000000000.json';
    await storage.put(expiredKey, Buffer.from('{}'), 'application/json');
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    await storage.put(
      'school_alpha/school-backups/manifest.json',
      Buffer.from(JSON.stringify([{ schoolId: 'school_alpha', fileName: 'old.json', filePath: expiredKey, createdAt: oldDate, size: 2 }])),
      'application/json',
    );

    const created = await createSchoolBackup(fakePrisma, { schoolId: 'school_alpha', source: 'manual' }, storage);
    expect(created.filePath).toMatch(/^school_alpha\/school-backups\/[0-9a-f-]+\.json$/);
    expect(storage.store.has(created.filePath)).toBe(true);
    expect(upserts[0]?.lastBackupFile).toBe(created.filePath);

    // La sauvegarde expirée a été purgée du stockage et du manifeste
    expect(storage.store.has(expiredKey)).toBe(false);
    const entries = await listSchoolBackups(storage, { schoolId: 'school_alpha' });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.filePath).toBe(created.filePath);

    const latest = await getLatestSchoolBackup('school_alpha', storage);
    expect(latest?.filePath).toBe(created.filePath);
  });

  it('SchoolAdminQueriesController.getLastBackup renvoie latestFileExists=false sans erreur 500 si lastBackupFile est un chemin disque hérité', async () => {
    const storage = createMemoryStorage();
    const repo = {
      findLastBackupSettings: async () => ({
        lastBackupAt: new Date('2026-01-01T03:00:00Z'),
        lastBackupFile: '/app/backups/schools/school_alpha/school_alpha_2026-01-01.json',
      }),
    } as unknown as SchoolAdminQueriesRepository;

    const ctrl = new SchoolAdminQueriesController(repo, {} as never, storage);
    let body: unknown;
    const res = {
      json(payload: unknown) { body = payload; return this; },
    } as unknown as Response;

    const noopNext: NextFunction = (err?: unknown) => { if (err) throw err; };
    await ctrl.getLastBackup(
      { user: { schoolId: 'school_alpha', userId: 'admin-1', role: 'ADMIN' } } as unknown as Request,
      res,
      noopNext,
    );

    const data = (body as { success: boolean; data: { latestFileExists: boolean } }).data;
    expect(data.latestFileExists).toBe(false);
  });
});
