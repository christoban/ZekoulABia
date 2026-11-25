import type { PrismaClient } from '@prisma/client';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import { buildScopedStorageKey } from '@domain/services/storage/fileStorageValidation';

type BackupSource = 'cron' | 'manual';

export interface SchoolBackupRequest {
  schoolId: string;
  requestedByMasterId?: string | null;
  source?: BackupSource;
}

export interface SchoolBackupEntry {
  schoolId: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  size: number;
}

const BACKUP_RETENTION_DAYS = 30;

const toStamp = (date: Date) => date.toISOString().replace(/[:.]/g, '-');

const manifestKeyForSchool = (schoolId: string) =>
  buildScopedStorageKey({
    schoolId,
    domain: 'school-backups',
    extension: '.json',
    fileId: 'manifest',
  });

const readSchoolManifest = async (
  schoolId: string,
  fileStorage: FileStoragePort,
): Promise<SchoolBackupEntry[]> => {
  const stored = await fileStorage.get(manifestKeyForSchool(schoolId));
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored.buffer.toString('utf8')) as unknown;
    return Array.isArray(parsed) ? (parsed as SchoolBackupEntry[]) : [];
  } catch {
    return [];
  }
};

const writeSchoolManifest = async (
  schoolId: string,
  entries: SchoolBackupEntry[],
  fileStorage: FileStoragePort,
): Promise<void> => {
  const buffer = Buffer.from(JSON.stringify(entries, null, 2), 'utf8');
  await fileStorage.put(manifestKeyForSchool(schoolId), buffer, 'application/json', {
    schoolId,
    kind: 'backup-manifest',
  });
};

export const buildPayload = async (prisma: PrismaClient, schoolId: string) => {
  const db = prisma;
  const [
    school,
    schoolSettings,
    schoolNotificationSettings,
    schoolConfigurationForm,
    users,
    classes,
    subjects,
    departments,
    academicYears,
    sequences,
    attendances,
    grades,
    reportCards,
    invoices,
    payments,
    feePlans,
    notifications,
    activitiesLogs,
    emailLogs,
    smsLogs,
    timetable,
    timetableGridConfig,
    staffProfiles,
    employeeFiles,
    careerEvents,
    staffAttendances,
    leaveRequests,
    leaveBalances,
    missionOrders,
  ] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId } }),
    db.schoolSettings.findUnique({ where: { schoolId } }),
    db.schoolNotificationSettings.findUnique({ where: { schoolId } }),
    db.schoolConfigurationForm.findUnique({ where: { schoolId } }),
    db.user.findMany({ where: { schoolId } }),
    db.class.findMany({ where: { schoolId } }),
    db.subject.findMany({ where: { schoolId } }),
    db.department.findMany({ where: { schoolId } }),
    db.academicYear.findMany({ where: { schoolId } }),
    db.academicSequence.findMany({ where: { schoolId } }),
    db.attendance.findMany({ where: { schoolId } }),
    db.grade.findMany({ where: { schoolId } }),
    db.reportCard.findMany({ where: { schoolId } }),
    db.invoice.findMany({ where: { schoolId } }),
    db.payment.findMany({ where: { schoolId } }),
    db.feePlan.findMany({ where: { schoolId } }),
    db.notification.findMany({ where: { schoolId } }),
    db.activitiesLog.findMany({ where: { schoolId } }),
    db.emailLog.findMany({ where: { schoolId } }),
    db.smsLog.findMany({ where: { schoolId } }),
    db.timetable.findMany({ where: { schoolId } }),
    db.timetableGridConfig.findUnique({ where: { schoolId } }),
    db.staffProfile.findMany({ where: { schoolId } }),
    db.employeeFile.findMany({ where: { schoolId } }),
    db.careerEvent.findMany({ where: { schoolId } }),
    db.staffAttendance.findMany({ where: { schoolId } }),
    db.leaveRequest.findMany({ where: { schoolId } }),
    db.leaveBalance.findMany({ where: { schoolId } }),
    db.missionOrder.findMany({ where: { schoolId } }),
  ]);

  return {
    school,
    schoolSettings,
    schoolNotificationSettings,
    schoolConfigurationForm,
    users,
    classes,
    subjects,
    departments,
    academicYears,
    sequences,
    attendances,
    grades,
    reportCards,
    invoices,
    payments,
    feePlans,
    notifications,
    activitiesLogs,
    emailLogs,
    smsLogs,
    timetable,
    timetableGridConfig,
    staffProfiles,
    employeeFiles,
    careerEvents,
    staffAttendances,
    leaveRequests,
    leaveBalances,
    missionOrders,
  };
};

const cleanupAndPersistManifest = async (
  schoolId: string,
  newEntry: SchoolBackupEntry,
  fileStorage: FileStoragePort,
): Promise<void> => {
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const existing = await readSchoolManifest(schoolId, fileStorage);
  const combined = [newEntry, ...existing.filter((e) => e.filePath !== newEntry.filePath)];

  const kept: SchoolBackupEntry[] = [];
  const expired: SchoolBackupEntry[] = [];
  for (const entry of combined) {
    const ts = Date.parse(entry.createdAt);
    if (!Number.isNaN(ts) && ts < cutoff) {
      expired.push(entry);
    } else {
      kept.push(entry);
    }
  }

  await Promise.all(expired.map((entry) => fileStorage.delete(entry.filePath)));
  kept.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  await writeSchoolManifest(schoolId, kept, fileStorage);
};

export const createSchoolBackup = async (
  prisma: PrismaClient,
  request: SchoolBackupRequest,
  fileStorage: FileStoragePort,
) => {
  const createdAt = new Date();
  const fileName = `${request.schoolId}_${toStamp(createdAt)}.json`;
  const storageKey = buildScopedStorageKey({
    schoolId: request.schoolId,
    domain: 'school-backups',
    extension: '.json',
  });

  const document = {
    meta: {
      schoolId: request.schoolId,
      requestedByMasterId: request.requestedByMasterId ?? null,
      source: request.source ?? 'manual',
      createdAt: createdAt.toISOString(),
    },
    data: await buildPayload(prisma, request.schoolId),
  };

  const payloadBuffer = Buffer.from(JSON.stringify(document, null, 2), 'utf8');
  await fileStorage.put(storageKey, payloadBuffer, 'application/json', {
    originalName: fileName,
    schoolId: request.schoolId,
    source: request.source ?? 'manual',
    createdAt: createdAt.toISOString(),
  });

  await prisma.schoolSettings.upsert({
    where: { schoolId: request.schoolId },
    update: { lastBackupAt: createdAt, lastBackupFile: storageKey },
    create: { schoolId: request.schoolId, lastBackupAt: createdAt, lastBackupFile: storageKey },
  });

  await cleanupAndPersistManifest(
    request.schoolId,
    {
      schoolId: request.schoolId,
      fileName,
      filePath: storageKey,
      createdAt: createdAt.toISOString(),
      size: payloadBuffer.length,
    },
    fileStorage,
  );

  return { schoolId: request.schoolId, fileName, filePath: storageKey, createdAt: createdAt.toISOString() };
};

export const listSchoolBackups = async (
  fileStorage: FileStoragePort,
  options?: { schoolId?: string; schoolIds?: readonly string[] },
): Promise<SchoolBackupEntry[]> => {
  const targets = options?.schoolId
    ? [options.schoolId]
    : Array.from(new Set(options?.schoolIds ?? []));

  const backups: SchoolBackupEntry[] = [];
  for (const sid of targets) {
    const entries = await readSchoolManifest(sid, fileStorage);
    backups.push(...entries);
  }

  return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getLatestSchoolBackup = async (
  schoolId: string,
  fileStorage: FileStoragePort,
): Promise<SchoolBackupEntry | null> => {
  const backups = await listSchoolBackups(fileStorage, { schoolId });
  const latest = backups[0] ?? null;
  if (!latest) return null;
  const stillExists = await fileStorage.exists(latest.filePath);
  return stillExists ? latest : null;
};

// ActivitiesLog (audit trail) est délibérément exclu de cette purge : avec seulement
// 5 points d'écriture dans tout le backend à ce jour, une politique de rétention serait
// prématurée. Décision : tout conserver, ne rien purger, tant que ce log ne gagne pas
// significativement plus de points d'écriture.
export const purgeSchoolLogsByRetention = async (prisma: PrismaClient, schoolId: string) => {
  const db = prisma;
  const settings = await prisma.schoolSettings.findUnique({
    where: { schoolId },
    select: { logRetentionDays: true },
  });

  const logRetentionDays = (settings?.logRetentionDays as number | null) ?? 90;
  const cutoff = new Date(Date.now() - logRetentionDays * 24 * 60 * 60 * 1000);

  const [emailDeleted, smsDeleted] = await Promise.all([
    db.emailLog.deleteMany({ where: { schoolId, createdAt: { lt: cutoff } } }),
    db.smsLog.deleteMany({ where: { schoolId, createdAt: { lt: cutoff } } }),
  ]);

  return {
    schoolId,
    logRetentionDays,
    cutoff: cutoff.toISOString(),
    emailDeleted: emailDeleted.count,
    smsDeleted: smsDeleted.count,
  };
};