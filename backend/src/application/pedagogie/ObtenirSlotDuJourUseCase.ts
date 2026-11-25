import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';

export interface SlotDuJour {
  classId: string;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  startTime: string;
  endTime: string;
}

export interface ObtenirSlotDuJourInput {
  teacherId: string;
  schoolId: string;
  academicYearId?: string;
}

export class ObtenirSlotDuJourUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  async execute(input: ObtenirSlotDuJourInput): Promise<SlotDuJour | null> {
    const dayOfWeek = new Date().getDay();
    const currentTime = new Date().toTimeString().slice(0, 5);

    const anneeId = input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id;

    const slots = await this.timetableRepository.findSlotsEnseignantJour(
      input.teacherId,
      dayOfWeek,
      input.schoolId,
      anneeId,
    );

    if (!slots.length) return null;

    const past = slots.filter(s => s.startTime <= currentTime);
    const slot = past.length > 0 ? past[past.length - 1] : slots[0];

    if (!slot?.subjectId || !slot?.classId) return null;

    return {
      classId: slot.classId,
      className: slot.className,
      subjectId: slot.subjectId,
      subjectName: slot.subjectName,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
  }
}
