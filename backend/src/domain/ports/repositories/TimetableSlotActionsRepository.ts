/**
 * DOMAIN LAYER — Port Repository TimetableSlotActions
 * Encapsule les requêtes d'actions rapides sur les emplois du temps et créneaux
 * (génération de squelette, détection de conflits et mise à jour de créneau).
 */
import type { SlotKind, TimetableStatus } from '@domain/types/enums';

export interface SkeletonTimetableSlotRecord {
  id: string;
  timetableId: string;
  subjectId: string | null;
  teacherId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId: string | null;
  kind: SlotKind;
  subGroupId: string | null;
  isLV2Slot: boolean;
  isElectiveSlot: boolean;
  managedBySolver: boolean;
  groupId: string | null;
}

export interface SkeletonTimetableRecord {
  id: string;
  schoolId: string;
  classId: string;
  academicYearId: string;
  status: TimetableStatus;
  generatedByAI: boolean;
  createdAt: Date;
  class: { id: string; name: string };
  slots: SkeletonTimetableSlotRecord[];
}

export interface SlotWithTimetableRecord {
  id: string;
  dayOfWeek: number;
  startTime: string;
  timetable: {
    schoolId: string;
    classId: string;
    status: TimetableStatus;
  };
}

export interface TeacherSlotConflictParams {
  schoolId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  excludeSlotId?: string;
}

export interface TeacherSlotConflictResult {
  hasConflict: boolean;
  conflictClassName?: string;
}

export interface UpdateTimetableSlotInput {
  subjectId: string | null;
  teacherId: string | null;
  kind: SlotKind;
  isLV2Slot?: boolean;
}

export interface UpdatedTimetableSlotRecord extends SkeletonTimetableSlotRecord {
  subject: { id: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
}

export interface TimetableSlotActionsRepository {
  findTimetableDetailsForSkeleton(timetableId: string): Promise<SkeletonTimetableRecord | null>;
  findExistingTimetableIdForCurrentYear(schoolId: string, classId: string): Promise<string | null>;
  findTeacherSlotConflict(params: TeacherSlotConflictParams): Promise<TeacherSlotConflictResult>;
  findSlotWithTimetable(slotId: string): Promise<SlotWithTimetableRecord | null>;
  findTeachingAssignment(classId: string, subjectId: string): Promise<{ teacherId: string } | null>;
  isAnimateurPedagogique(schoolId: string, teacherId: string): Promise<boolean>;
  countTeacherSlotsExcluding(schoolId: string, teacherId: string, excludeSlotId: string): Promise<number>;
  getGridPeriodDuration(schoolId: string): Promise<number>;
  updateSlot(slotId: string, input: UpdateTimetableSlotInput): Promise<UpdatedTimetableSlotRecord>;
}
