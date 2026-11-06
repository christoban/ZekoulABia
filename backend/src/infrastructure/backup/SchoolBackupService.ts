import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';

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

const BACKUP_ROOT = join(process.cwd(), 'backups', 'schools');
const BACKUP_RETENTION_DAYS = 30;

const getSchoolDir = (schoolId: string) => join(BACKUP_ROOT, schoolId);

const ensureDir = async (path: string) => {
  await mkdir(path, { recursive: true });
};

const exists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const toStamp = (date: Date) => date.toISOString().replace(/[:.]/g, '-');

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

const cleanupExpiredBackups = async (schoolId: string) => {
  const dir = getSchoolDir(schoolId);
  if (!(await exists(dir))) return;

  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = await readdir(dir, { withFileTypes: true });

  await Promise.all(files.map(async (file) => {
    if (!file.isFile() || !file.name.endsWith('.json')) return;
    const filePath = join(dir, file.name);
    const stats = await stat(filePath);
    if (stats.mtime.getTime() < cutoff) {
      await rm(filePath, { force: true });
    }
  }));
};

interface BackupMeta {
  schoolId: string;
  requestedByMasterId?: string | null;
  source?: BackupSource;
  createdAt: string;
}

const readBackupMeta = async (filePath: string): Promise<BackupMeta | null> => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { meta?: BackupMeta };
    return parsed?.meta ?? null;
  } catch {
    return null;
  }
};

export const createSchoolBackup = async (prisma: PrismaClient, request: SchoolBackupRequest) => {
  const schoolDir = getSchoolDir(request.schoolId);
  await ensureDir(schoolDir);

  const createdAt = new Date();
  const fileName = `${request.schoolId}_${toStamp(createdAt)}.json`;
  const filePath = join(schoolDir, fileName);

  const document = {
    meta: {
      schoolId: request.schoolId,
      requestedByMasterId: request.requestedByMasterId ?? null,
      source: request.source ?? 'manual',
      createdAt: createdAt.toISOString(),
    },
    data: await buildPayload(prisma, request.schoolId),
  };

  await writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8');

  await prisma.schoolSettings.upsert({
    where: { schoolId: request.schoolId },
    update: { lastBackupAt: createdAt, lastBackupFile: filePath },
    create: { schoolId: request.schoolId, lastBackupAt: createdAt, lastBackupFile: filePath },
  });

  await cleanupExpiredBackups(request.schoolId);

  return { schoolId: request.schoolId, fileName, filePath, createdAt: createdAt.toISOString() };
};

export const listSchoolBackups = async (schoolId?: string): Promise<SchoolBackupEntry[]> => {
  const dirs = schoolId ? [getSchoolDir(schoolId)] : [];

  if (!schoolId) {
    if (!(await exists(BACKUP_ROOT))) return [];
    const rootEntries = await readdir(BACKUP_ROOT, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isDirectory()) {
        dirs.push(join(BACKUP_ROOT, entry.name));
      }
    }
  }

  const backups: SchoolBackupEntry[] = [];
  for (const dir of dirs) {
    if (!(await exists(dir))) continue;
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      const filePath = join(dir, file.name);
      const stats = await stat(filePath);
      const meta = await readBackupMeta(filePath);
      backups.push({
        schoolId: meta?.schoolId ?? file.name.split('_')[0] ?? 'unknown',
        fileName: file.name,
        filePath,
        createdAt: meta?.createdAt ?? stats.mtime.toISOString(),
        size: stats.size,
      });
    }
  }

  return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getLatestSchoolBackup = async (schoolId: string) => {
  const backups = await listSchoolBackups(schoolId);
  return backups[0] ?? null;
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