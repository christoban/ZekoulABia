import type { PrismaClient } from '@prisma/client';
import type {
  StaffAttendanceRepository,
  StaffAttendanceData,
  CreerStaffAttendanceInput,
  StaffAttendanceSettingsData,
  StaffAttendanceRoomConfig,
  StaffAttendanceSlotCourant,
  MiseAJourStaffAttendanceSettings,
  StaffAttendanceStatut,
} from '@domain/ports/repositories/StaffAttendanceRepository';

export class PrismaStaffAttendanceRepository implements StaffAttendanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(data: { userId: string; schoolId: string; date: Date; statut: string; note?: string }): Promise<StaffAttendanceData> {
    return this.prisma.staffAttendance.upsert({
      where: { userId_date: { userId: data.userId, date: data.date } },
      create: { userId: data.userId, schoolId: data.schoolId, date: data.date, statut: data.statut as StaffAttendanceStatut, note: data.note ?? null },
      update: { statut: data.statut as StaffAttendanceStatut, note: data.note ?? null },
    });
  }

  async pointer(data: CreerStaffAttendanceInput): Promise<StaffAttendanceData> {
    return this.prisma.staffAttendance.upsert({
      where: { userId_date: { userId: data.userId, date: data.date } },
      create: {
        userId: data.userId,
        schoolId: data.schoolId,
        date: data.date,
        statut: data.statut,
        note: data.note ?? null,
        mode: data.mode ?? null,
        roomId: data.roomId ?? null,
        timetableSlotId: data.timetableSlotId ?? null,
        qrToken: data.qrToken ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
      update: {
        statut: data.statut,
        note: data.note ?? null,
        mode: data.mode ?? null,
        roomId: data.roomId ?? null,
        timetableSlotId: data.timetableSlotId ?? null,
        qrToken: data.qrToken ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });
  }

  async findBySchool(schoolId: string, filters?: { userId?: string; debut?: Date; fin?: Date; statut?: StaffAttendanceStatut }): Promise<StaffAttendanceData[]> {
    return this.prisma.staffAttendance.findMany({
      where: {
        schoolId,
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(filters?.debut || filters?.fin ? { date: { ...(filters.debut ? { gte: filters.debut } : {}), ...(filters.fin ? { lte: filters.fin } : {}) } } : {}),
        ...(filters?.statut ? { statut: filters.statut } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async trouverPresencePourCreneau(
    userId: string,
    schoolId: string,
    date: Date,
    timetableSlotId: string,
  ): Promise<StaffAttendanceData | null> {
    return this.prisma.staffAttendance.findFirst({
      where: { userId, schoolId, date, timetableSlotId },
    });
  }

  async requalifier(id: string, schoolId: string, statut: StaffAttendanceStatut, verifiedById: string): Promise<StaffAttendanceData> {
    return this.prisma.staffAttendance.update({
      where: { id },
      data: { statut, verifiedById, verifiedAt: new Date() },
    });
  }

  async getSettings(schoolId: string): Promise<StaffAttendanceSettingsData> {
    const settings = await this.prisma.staffAttendanceSettings.findUnique({ where: { schoolId } });
    return {
      schoolId,
      gpsRadiusMeters: settings?.gpsRadiusMeters ?? 75,
      qrTokenTtlSeconds: settings?.qrTokenTtlSeconds ?? 120,
      schoolLatitude: settings?.schoolLatitude ?? null,
      schoolLongitude: settings?.schoolLongitude ?? null,
    };
  }

  async salleQrEnabled(roomId: string, schoolId: string): Promise<boolean> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, schoolId },
      select: { qrEnabled: true },
    });
    return room?.qrEnabled ?? false;
  }

  async listerSalles(schoolId: string): Promise<StaffAttendanceRoomConfig[]> {
    return this.prisma.room.findMany({
      where: { schoolId },
      select: { id: true, name: true, qrEnabled: true },
      orderBy: { name: 'asc' },
    });
  }

  async trouverCreneauCourant(teacherId: string, schoolId: string, maintenant: Date): Promise<StaffAttendanceSlotCourant | null> {
    const dayOfWeek = (maintenant.getDay() + 6) % 7;
    const nowHHMM = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`;
    const slot = await this.prisma.timetableSlot.findFirst({
      where: {
        teacherId,
        dayOfWeek,
        startTime: { lte: nowHHMM },
        endTime: { gt: nowHHMM },
        timetable: { schoolId, status: 'PUBLISHED' },
      },
      include: {
        subject: { select: { name: true } },
        timetable: { select: { class: { select: { name: true } } } },
        room: { select: { id: true, name: true, qrEnabled: true } },
      },
    });
    if (!slot) return null;
    return {
      id: slot.id,
      subjectName: slot.subject?.name ?? null,
      className: slot.timetable?.class?.name ?? null,
      roomId: slot.room?.id ?? null,
      roomName: slot.room?.name ?? null,
      qrEnabled: slot.room?.qrEnabled ?? false,
    };
  }

  async mettreAJourSettings(schoolId: string, data: MiseAJourStaffAttendanceSettings): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.staffAttendanceSettings.upsert({
        where: { schoolId },
        create: {
          schoolId,
          gpsRadiusMeters: data.gpsRadiusMeters ?? 75,
          qrTokenTtlSeconds: data.qrTokenTtlSeconds ?? 120,
          schoolLatitude: data.schoolLatitude ?? null,
          schoolLongitude: data.schoolLongitude ?? null,
        },
        update: {
          ...(data.gpsRadiusMeters !== undefined ? { gpsRadiusMeters: data.gpsRadiusMeters } : {}),
          ...(data.qrTokenTtlSeconds !== undefined ? { qrTokenTtlSeconds: data.qrTokenTtlSeconds } : {}),
          ...(data.schoolLatitude !== undefined ? { schoolLatitude: data.schoolLatitude } : {}),
          ...(data.schoolLongitude !== undefined ? { schoolLongitude: data.schoolLongitude } : {}),
        },
      });
      if (Array.isArray(data.roomsQrConfig)) {
        for (const item of data.roomsQrConfig) {
          await tx.room.updateMany({
            where: { id: item.roomId, schoolId },
            data: { qrEnabled: item.qrEnabled },
          });
        }
      }
    });
  }
}