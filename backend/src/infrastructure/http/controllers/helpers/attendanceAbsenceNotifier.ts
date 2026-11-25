import type { AttendancePeriod, AttendanceStatus } from '@domain/types/enums';
import type { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { PresenceRepository, FiltrePresences } from '@domain/ports/repositories/PresenceRepository';
import type { CarnetLiaisonRepository } from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import { notifyAbsenceSms } from '@infrastructure/services/sms/SmsNotificationService';
import { notifierParentsPushDabord } from '@infrastructure/services/notification/PushFirstNotifier';

export const startOfDayUtc = (dateString: string) => {
  const [y = 0, m = 1, d = 1] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

export const endOfDayUtc = (dateString: string) => {
  const [y = 0, m = 1, d = 1] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
};

export const parseOptionalDate = (val: unknown): Date | undefined => {
  if (!val || typeof val !== 'string') return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const normalizeAttendanceStatus = (s: string): AttendanceStatus =>
  s === 'EXCUSED' ? 'ABSENT_JUSTIFIED' : (s as AttendanceStatus);

export interface AbsenceNotificationParams {
  schoolId: string;
  classId: string;
  subjectId?: string;
  dateObj: Date;
  period: AttendancePeriod;
  absentIds: string[];
  authorId: string;
  authorRole: string;
  clientRecordedAt?: Date;
  userRepository: UserRepository;
  matiereRepository: MatiereRepository;
  presenceRepository: PresenceRepository;
  carnetRepository?: CarnetLiaisonRepository;
  creerEntreeCarnet?: CreerEntreeCarnetUseCase;
}

/** Envoie en tâche de fond les alertes Push/SMS aux parents et l'entrée Carnet primaire pour les absents. */
export async function dispatchAbsenceNotifications(params: AbsenceNotificationParams): Promise<void> {
  try {
    const foundUsers = await Promise.all(params.absentIds.map((id) => params.userRepository.findById(id)));
    const students = foundUsers.filter((s): s is User => s !== null);
    const subjectName = params.subjectId ? (await params.matiereRepository.findById(params.subjectId))?.name : undefined;
    const isPrimary = params.carnetRepository
      ? await params.carnetRepository.estNiveauPrimaire(params.schoolId, params.classId).catch(() => false)
      : false;
    const dayPresences = isPrimary && params.creerEntreeCarnet
      ? await params.presenceRepository.findByClasse(params.classId, params.dateObj, params.period).catch(() => [])
      : [];

    const dateStr = params.dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await Promise.all(
      students.map(async (s) => {
        const studentName = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
        const { phonesSansPush } = await notifierParentsPushDabord({
          schoolId: params.schoolId,
          studentId: s.id,
          type: 'ABSENCE_ALERT',
          titre: 'Absence signalée',
          corps: `${studentName} a été marqué(e) absent(e) le ${dateStr}${subjectName ? ` en ${subjectName}` : ''}.`,
        });
        await notifyAbsenceSms({
          schoolId: params.schoolId,
          studentId: s.id,
          studentName,
          date: params.dateObj,
          subjectName,
          phones: phonesSansPush,
        });

        if (isPrimary && params.creerEntreeCarnet) {
          const matchingAttendance = dayPresences.find((dp) => dp.studentId === s.id);
          await params.creerEntreeCarnet.execute({
            schoolId: params.schoolId,
            authorId: params.authorId,
            authorRole: params.authorRole,
            studentId: s.id,
            classId: params.classId,
            category: 'ABSENCE',
            title: `Absence signalée le ${dateStr}`,
            content: `${studentName} a été marqué(e) absent(e) le ${dateStr} (${params.period === 'MORNING' ? 'Matin' : 'Après-midi'})${subjectName ? ` en ${subjectName}` : ''}. Merci d'en prendre connaissance ou de transmettre un justificatif.`,
            requiresConfirmation: true,
            confirmationPrompt: "J'ai pris connaissance de cette absence",
            attendanceId: matchingAttendance?.id,
            clientRecordedAt: params.clientRecordedAt,
          }).catch((err) => {
            console.warn('[AttendanceController] Carnet auto-absence non bloquant:', err instanceof Error ? err.message : String(err));
          });
        }
      }),
    );
  } catch (err) {
    console.error('[SMS Attendance fire-and-forget]', err);
  }
}

export async function buildAttendanceUserMaps(
  userRepository: UserRepository,
  studentIds: string[],
  recorderIds: string[],
) {
  const [students, recorders] = await Promise.all([
    Promise.all(studentIds.map((id) => userRepository.findById(id))),
    recorderIds.length ? Promise.all(recorderIds.map((id) => userRepository.findById(id))) : Promise.resolve([]),
  ]);
  const studentMap = new Map(
    students.filter((s): s is User => s !== null).map((s) => [
      s.id,
      { id: s.id, firstName: s.firstName, lastName: s.lastName, email: s.email ?? null, name: `${s.firstName} ${s.lastName}`.trim() },
    ]),
  );
  const recorderMap = new Map(
    recorders.filter((u): u is User => u !== null).map((u) => [
      u.id,
      { id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, name: `${u.firstName} ${u.lastName}`.trim() },
    ]),
  );
  return { studentMap, recorderMap };
}

export async function computeAttendanceStats(
  presenceRepository: PresenceRepository,
  schoolId: string,
  filtre: FiltrePresences,
) {
  const [total, present, absent, late, excused] = await Promise.all([
    presenceRepository.countByFiltre(schoolId, filtre),
    presenceRepository.countByFiltre(schoolId, { ...filtre, status: 'PRESENT' }),
    presenceRepository.countByFiltre(schoolId, { ...filtre, status: 'ABSENT' }),
    presenceRepository.countByFiltre(schoolId, { ...filtre, status: 'LATE' }),
    presenceRepository.countByFiltre(schoolId, { ...filtre, status: 'ABSENT_JUSTIFIED' }),
  ]);
  return {
    total,
    present,
    absent,
    late,
    excused,
    attendanceRate: total ? `${Math.round(((present + late) / total) * 100)}%` : '0%',
  };
}
