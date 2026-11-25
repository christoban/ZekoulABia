import type { PrismaClient } from '@prisma/client';
import type { SlotKind, TimetableStatus } from '@domain/types/enums';
import type {
  SkeletonTimetableRecord,
  SlotWithTimetableRecord,
  TeacherSlotConflictParams,
  TeacherSlotConflictResult,
  TimetableSlotActionsRepository,
  UpdatedTimetableSlotRecord,
  UpdateTimetableSlotInput,
} from '@domain/ports/repositories/TimetableSlotActionsRepository';

export class PrismaTimetableSlotActionsRepository implements TimetableSlotActionsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTimetableDetailsForSkeleton(timetableId: string): Promise<SkeletonTimetableRecord | null> {
    const timetable = await this.prisma.timetable.findUnique({
      where: { id: timetableId },
      include: {
        class: { select: { id: true, name: true } },
        slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });
    if (!timetable) return null;
    return {
      ...timetable,
      status: timetable.status as TimetableStatus,
      slots: timetable.slots.map((slot) => ({
        ...slot,
        kind: slot.kind as SlotKind,
      })),
    };
  }

  async findExistingTimetableIdForCurrentYear(schoolId: string, classId: string): Promise<string | null> {
    const annee = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    if (!annee) return null;
    const existing = await this.prisma.timetable.findFirst({
      where: { schoolId, classId, academicYearId: annee.id },
      select: { id: true },
    });
    return existing?.id ?? null;
  }

  async findTeacherSlotConflict(params: TeacherSlotConflictParams): Promise<TeacherSlotConflictResult> {
    const conflitSlot = await this.prisma.timetableSlot.findFirst({
      where: {
        teacherId: params.teacherId,
        dayOfWeek: params.dayOfWeek,
        startTime: params.startTime,
        ...(params.excludeSlotId ? { id: { not: params.excludeSlotId } } : {}),
        timetable: { is: { schoolId: params.schoolId } },
      },
      select: { timetableId: true },
    });
    if (!conflitSlot) {
      return { hasConflict: false };
    }
    const conflitTimetable = await this.prisma.timetable.findUnique({
      where: { id: conflitSlot.timetableId },
      include: { class: { select: { name: true } } },
    });
    return {
      hasConflict: true,
      conflictClassName: conflitTimetable?.class.name ?? 'inconnue',
    };
  }

  async findSlotWithTimetable(slotId: string): Promise<SlotWithTimetableRecord | null> {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id: slotId },
      include: { timetable: { select: { schoolId: true, classId: true, status: true } } },
    });
    if (!slot) return null;
    return {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      timetable: {
        schoolId: slot.timetable.schoolId,
        classId: slot.timetable.classId,
        status: slot.timetable.status as TimetableStatus,
      },
    };
  }

  async findTeachingAssignment(classId: string, subjectId: string): Promise<{ teacherId: string } | null> {
    return this.prisma.teachingAssignment.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: { teacherId: true },
    });
  }

  async isAnimateurPedagogique(schoolId: string, teacherId: string): Promise<boolean> {
    const [teacherProfile, isHeadOfDept] = await Promise.all([
      this.prisma.teacherProfile.findFirst({
        where: { userId: teacherId },
        select: { supervisedSubjectIds: true },
      }),
      this.prisma.department.findFirst({
        where: { headId: teacherId, schoolId },
        select: { id: true },
      }),
    ]);
    return (!!teacherProfile && teacherProfile.supervisedSubjectIds.length > 0) || !!isHeadOfDept;
  }

  async countTeacherSlotsExcluding(schoolId: string, teacherId: string, excludeSlotId: string): Promise<number> {
    return this.prisma.timetableSlot.count({
      where: { teacherId, id: { not: excludeSlotId }, timetable: { is: { schoolId } } },
    });
  }

  async getGridPeriodDuration(schoolId: string): Promise<number> {
    const gridConfig = await this.prisma.timetableGridConfig.findUnique({
      where: { schoolId },
      select: { dureePeriode: true },
    });
    return gridConfig?.dureePeriode ?? 55;
  }

  async updateSlot(slotId: string, input: UpdateTimetableSlotInput): Promise<UpdatedTimetableSlotRecord> {
    const updated = await this.prisma.timetableSlot.update({
      where: { id: slotId },
      data: {
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        kind: input.kind,
        ...(typeof input.isLV2Slot === 'boolean' ? { isLV2Slot: input.isLV2Slot } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return {
      ...updated,
      kind: updated.kind as SlotKind,
    };
  }
}
