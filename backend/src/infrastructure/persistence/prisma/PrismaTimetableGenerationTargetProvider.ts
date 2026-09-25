import type { PrismaClient } from '@prisma/client';
import { SchedulingGridAdapter } from '@infrastructure/scheduling/SchedulingGridAdapter';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import { calculerCapaciteDisponible } from '@domain/rules/CapaciteEmploiDuTemps';
import type { TargetClass, TimetableGenerationTargetProvider } from '@domain/ports/services/TimetableGenerationTargetProvider';

export class PrismaTimetableGenerationTargetProvider implements TimetableGenerationTargetProvider {
  constructor(private readonly prisma: PrismaClient) {}

  async listTargets(schoolId: string, academicYearId: string, classIds?: string[]): Promise<TargetClass[]> {
    const classes = await this.prisma.class.findMany({
      where: { schoolId, academicYearId, status: 'ACTIVE', ...(classIds?.length ? { id: { in: classIds } } : {}) },
      select: {
        id: true,
         name: true,
         level: true,
         timetables: { where: { academicYearId }, select: { id: true, status: true } },
      },
      orderBy: { name: 'asc' },
    });
    const [assignments, grid] = await Promise.all([
      this.prisma.teachingAssignment.findMany({
        where: { schoolId, academicYearId, classId: { in: classes.map(c => c.id) } },
        select: {
          classId: true,
          subject: {
            select: {
              hoursPerWeek: true,
              subjectCoefficients: {
                where: { schoolId, serieCode: null },
                select: { classLevel: true, weeklyPeriods: true },
              },
            },
          },
        },
      }),
      this.prisma.timetableGridConfig.findUnique({ where: { schoolId }, select: { joursActifs: true, periodesCoursParJour: true } }),
    ]);
    const hoursByClass = new Map<string, number>();
    const classById = new Map(classes.map(classe => [classe.id, classe]));
    for (const assignment of assignments) {
      const level = classById.get(assignment.classId)?.level ?? '';
      const coefficient = assignment.subject.subjectCoefficients.find(item => item.classLevel === level);
      const hours = coefficient?.weeklyPeriods ?? assignment.subject.hoursPerWeek ?? 0;
      hoursByClass.set(assignment.classId, (hoursByClass.get(assignment.classId) ?? 0) + hours);
    }
    const periodesParJour = (grid?.periodesCoursParJour as Record<string, number> | null) ?? {};
    const capacity = grid?.joursActifs.reduce((sum, day) => sum + (periodesParJour[day] ?? 0), 0) ?? 0;
    const targets = classes.map(classe => {
      const requiredHours = hoursByClass.get(classe.id) ?? 0;
      return {
        classId: classe.id,
        className: classe.name,
        timetableId: classe.timetables[0]?.id,
        status: classe.timetables[0]?.status,
        requiredHours,
        difficultyScore: capacity > 0 ? requiredHours / capacity : requiredHours,
      };
    });
    // Limitation connue : ce score ne capture pas la rareté/saturation des enseignants partagés
    // entre classes ; un affinement futur pourra pondérer requiredHours par cette saturation.
    return targets.sort((a, b) => b.difficultyScore! - a.difficultyScore! || a.className.localeCompare(b.className, 'fr'));
  }

  async buildPreflight(schoolId: string, academicYearId: string, targets: TargetClass[]): Promise<Record<string, unknown>> {
    const [assignments, grid, indisponibilites, occupationFixe] = await Promise.all([
      this.prisma.teachingAssignment.findMany({
        where: { schoolId, academicYearId, classId: { in: targets.map(t => t.classId) } },
        select: {
          teacherId: true,
          subject: { select: { name: true, hoursPerWeek: true, subjectCoefficients: { where: { schoolId, classLevel: { in: ['3e', '4e', '5e', '6e'] }, serieCode: null }, select: { classLevel: true, weeklyPeriods: true } } } },
          class: { select: { name: true, level: true } },
        },
      }),
      this.prisma.timetableGridConfig.findUnique({ where: { schoolId } }),
      this.prisma.teacherUnavailability.findMany({ where: { schoolId, active: true }, select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true } }),
      this.prisma.timetableSlot.findMany({ where: { kind: 'CLASS', subjectId: { not: null }, managedBySolver: false, timetable: { schoolId, academicYearId } }, select: { teacherId: true, roomId: true, dayOfWeek: true, startTime: true, endTime: true } }),
    ]);
    const periodesParJour = (grid?.periodesCoursParJour as Record<string, number> | null) ?? {};
    const gridAdapter = new SchedulingGridAdapter();
    const cases = grid?.joursActifs.flatMap(jour => {
      const dayOfWeek = joursActifsVersIndex([jour])[0]!;
      return gridAdapter.calculerSqelette({ ...grid, periodesCoursParJour: periodesParJour }, jour).filter(periode => periode.type === 'COURS').map(periode => ({ dayOfWeek, startTime: periode.debut, endTime: periode.fin }));
    }) ?? [];
    const capacity = calculerCapaciteDisponible(cases, [], []);
    const byTeacher = new Map<string, { hours: number; details: string[] }>();
    for (const assignment of assignments) {
      const coefficient = assignment.subject.subjectCoefficients.find(item => item.classLevel === assignment.class.level);
      const hours = coefficient?.weeklyPeriods ?? assignment.subject.hoursPerWeek ?? 0;
      const entry = byTeacher.get(assignment.teacherId) ?? { hours: 0, details: [] };
      entry.hours += hours;
      entry.details.push(`${assignment.class.name} — ${assignment.subject.name} (${hours}h)`);
      byTeacher.set(assignment.teacherId, entry);
    }
    const teacherIds = [...byTeacher.keys()];
    const teachers = teacherIds.length ? await this.prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const teacherNames = new Map(teachers.map(t => [t.id, `${t.firstName} ${t.lastName}`]));
    const overloaded = [...byTeacher.entries()].map(([teacherId, entry]) => {
      const teacherCapacity = calculerCapaciteDisponible(cases, indisponibilites, [], teacherId);
      return { teacherId, name: teacherNames.get(teacherId) ?? teacherId, hours: entry.hours, capacity: teacherCapacity, overloaded: entry.hours > teacherCapacity, deficitHours: Math.max(0, entry.hours - teacherCapacity), details: entry.details };
    }).filter(entry => entry.overloaded);
    return { capacity, gridCases: cases.length, fixedOccupationCases: occupationFixe.length, unavailableCases: indisponibilites.length, overloaded, generatedAt: new Date().toISOString(), periodesParJour };
  }
}
