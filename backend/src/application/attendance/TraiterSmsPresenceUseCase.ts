import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

/**
 * Use case — Traite un SMS de présence entrant (format PRES#CLASSE#1,0,1,...) envoyé par un
 * enseignant : localise la classe, mappe les présences/absences et crée/maj les enregistrements
 * d'assiduité du jour. Logique métier extraite de l'ancien `services/smsService.ts` (point 7 de
 * l'audit : un service technique ne doit pas contenir d'opérations métier).
 */
export type ParsedAttendance = {
  className: string;
  phoneNumber: string;
  records: { index: number; status: 'PRESENT' | 'ABSENT' }[];
  rawMessage: string;
};

export function parseSMSAttendance(message: string, senderPhone: string): ParsedAttendance | null {
  try {
    const parts = message.trim().toUpperCase().split('#');
    if (parts.length < 3 || parts[0] !== 'PRES') return null;

    const className = parts[1];
    const statusList = parts[2].split(',');

    const records = statusList.map((status, index) => ({
      index,
      status: status.trim() === '1' ? 'PRESENT' as const : 'ABSENT' as const,
    }));

    return {
      className,
      phoneNumber: senderPhone,
      records,
      rawMessage: message,
    };
  } catch {
    return null;
  }
}

export class TraiterSmsPresenceUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly userRepository: UserRepository,
    private readonly presenceRepository: PresenceRepository,
  ) {}

  async execute(
    message: string,
    senderPhone: string,
    schoolId: string
  ): Promise<{ success: boolean; message: string }> {
    const parsed = parseSMSAttendance(message, senderPhone);

    if (!parsed) {
      return { success: false, message: 'Format SMS invalide. Utilisez: PRES#CLASSE#1,0,1,...' };
    }

    const cls = await this.classeRepository.findByNameContient(schoolId, parsed.className);

    if (!cls) {
      return { success: false, message: `Classe "${parsed.className}" introuvable` };
    }

    const studentUserIds = await this.enrollmentRepository.getEleveUserIdsParClasseOrdonnes(cls.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const teacher = await this.userRepository.findByPhoneContient(senderPhone.replace('237', ''), schoolId);

    const attendanceRecords = parsed.records
      .filter((record) => record.index < studentUserIds.length)
      .map((record) => ({
        schoolId,
        studentId: studentUserIds[record.index],
        classId: cls.id,
        date: today,
        status: record.status,
        period: 'MORNING' as const,
        recordedById: teacher?.id ?? null,
        teacherId: teacher?.id ?? null,
      }));

    await this.presenceRepository.synchroniserPresencesSms(attendanceRecords);

    return {
      success: true,
      message: `✅ ${attendanceRecords.length} présences enregistrées pour ${cls.name}`,
    };
  }
}