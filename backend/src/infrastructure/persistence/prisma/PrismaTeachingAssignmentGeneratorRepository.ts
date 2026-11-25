import type { PrismaClient } from '@prisma/client';
import {
  CYCLE2_LEVELS,
  parseSerie,
} from '@application/school/SubjectAssignmentHelper';
import { SchedulingGridAdapter } from '@infrastructure/scheduling/SchedulingGridAdapter';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import { calculerCapaciteDisponible } from '@domain/rules/CapaciteEmploiDuTemps';
import type {
  TeachingAssignmentGeneratorRepository,
  DonneesGenerationAffectations,
  AssignmentACreerPayload,
  AssignmentAModifierPayload,
  IssueAffectationGeneration,
  ClassePourGeneration,
  MatiereCandidateGeneration,
} from '@domain/ports/repositories/TeachingAssignmentGeneratorRepository';

const LV2_GROUPSET_CODE = 'LV2';
const LV2_GENERIC_SUBJECT_NAME = 'LV2';

const AP_PERMISSIONS = new Set(['SUPERVISE_TEACHERS', 'SUPERVISE_DEPARTMENT_TEACHERS']);

function resoudreSerie(cls: ClassePourGeneration): string | null {
  return cls.serie ?? cls.filiere ?? (cls.level && (CYCLE2_LEVELS as string[]).includes(cls.level)
    ? parseSerie(cls.name, cls.level)
    : null);
}

export class PrismaTeachingAssignmentGeneratorRepository implements TeachingAssignmentGeneratorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async loadGenerationData(
    schoolId: string,
    academicYearId: string,
    classId?: string,
  ): Promise<DonneesGenerationAffectations> {
    const classes = await this.prisma.class.findMany({
      where: { schoolId, academicYearId, ...(classId ? { id: classId } : {}) },
      select: { id: true, name: true, level: true, serie: true, filiere: true, academicYearId: true },
      orderBy: { name: 'asc' },
    });

    if (classes.length === 0) {
      return { classes: [], matieres: [], enseignants: [], affectations: [] };
    }

    const classById = new Map(classes.map((c) => [c.id, c]));
    const classLevels = new Set(classes.map((c) => c.level).filter((l): l is string => !!l));
    const serieCodes = new Set<string>();
    for (const cls of classes) {
      const serie = resoudreSerie(cls);
      if (serie) serieCodes.add(serie);
    }

    const subjectCoefficients = await this.prisma.subjectCoefficient.findMany({
      where: {
        schoolId,
        classLevel: classLevels.size > 0 ? { in: Array.from(classLevels) } : undefined,
        OR: serieCodes.size > 0
          ? [{ serieCode: null }, { serieCode: { in: Array.from(serieCodes) } }]
          : [{ serieCode: null }],
        subject: { restrictedToGroupId: null, studentGroups: { none: {} } },
      },
      include: { subject: { select: { id: true, name: true } } },
    });

    const matieres: MatiereCandidateGeneration[] = [];
    const candidateSubjectIds = new Set<string>();

    for (const cls of classes) {
      const resolvedSerie = resoudreSerie(cls);
      const matchingCoeffs = subjectCoefficients.filter(
        (sc) =>
          sc.classLevel === cls.level &&
          (sc.serieCode === resolvedSerie || sc.serieCode === null),
      );

      const chosenBySubject = new Map<string, (typeof matchingCoeffs)[number]>();
      for (const sc of matchingCoeffs) {
        const existing = chosenBySubject.get(sc.subjectId);
        // On préfère le coefficient exact (série) au générique (serieCode null)
        if (!existing || (existing.serieCode === null && sc.serieCode !== null)) {
          chosenBySubject.set(sc.subjectId, sc);
        }
      }

      for (const sc of chosenBySubject.values()) {
        matieres.push({
          classId: cls.id,
          className: cls.name,
          subjectId: sc.subjectId,
          subjectName: sc.subject.name,
          weeklyPeriods: sc.weeklyPeriods,
        });
        candidateSubjectIds.add(sc.subjectId);
      }
    }

    // ── Candidats LV2 : un couple (classe, langue) dès qu'au moins un élève inscrit l'a choisi ──
    const [school, lv2Subjects] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { templateCode: true, defaultMaxWeeklyHours: true } }),
      this.prisma.subject.findMany({
        where: { schoolId, isLV2: true, deletedAt: null },
        select: { id: true, name: true, hoursPerWeek: true },
      }),
    ]);

    if (lv2Subjects.length > 0 && classes.length > 0) {
      const lv2SubjectById = new Map(lv2Subjects.map((s) => [s.id, s]));
      const classIds = classes.map((c) => c.id);
      const lv2Enrollments = await this.prisma.enrollment.findMany({
        where: {
          schoolId,
          academicYearId,
          classId: { in: classIds },
          status: 'ACTIVE',
          student: { lv2SubjectId: { not: null } },
        },
        select: {
          classId: true,
          student: { select: { lv2SubjectId: true } },
        },
      });

      const lv2ChoicesByClass = new Map<string, Map<string, number>>();
      for (const e of lv2Enrollments) {
        const subjectId = e.student.lv2SubjectId!;
        const bySubject = lv2ChoicesByClass.get(e.classId) ?? new Map<string, number>();
        bySubject.set(subjectId, (bySubject.get(subjectId) ?? 0) + 1);
        lv2ChoicesByClass.set(e.classId, bySubject);
      }

      const lv2HoursByClass = new Map<string, number | null>();
      for (const cls of classes) {
        const serie = resoudreSerie(cls) ?? cls.filiere ?? 'FR_GENERAL';
        const cc = school?.templateCode
          ? await this.prisma.cycleCoefficient.findFirst({
              where: {
                templateCode: school.templateCode,
                classLevel: cls.level,
                filiere: serie,
                subjectName: LV2_GENERIC_SUBJECT_NAME,
              },
              select: { weeklyPeriods: true },
            })
          : null;
        lv2HoursByClass.set(cls.id, cc?.weeklyPeriods ?? null);
      }

      for (const cls of classes) {
        const bySubject = lv2ChoicesByClass.get(cls.id);
        if (!bySubject) continue;
        const genericHours = lv2HoursByClass.get(cls.id);
        for (const [subjectId, count] of bySubject.entries()) {
          if (count === 0) continue;
          const subject = lv2SubjectById.get(subjectId);
          if (!subject) continue;
          matieres.push({
            classId: cls.id,
            className: cls.name,
            subjectId,
            subjectName: subject.name,
            weeklyPeriods: genericHours ?? subject.hoursPerWeek ?? 2,
          });
          candidateSubjectIds.add(subjectId);
        }
      }
    }

    const enseignants: DonneesGenerationAffectations['enseignants'] = [];
    if (candidateSubjectIds.size > 0) {
      const teacherSubjects = await this.prisma.teacherSubject.findMany({
        where: {
          subjectId: { in: Array.from(candidateSubjectIds) },
          teacherProfile: { user: { schoolId, isActive: true } },
        },
        include: {
          teacherProfile: {
            include: {
              user: {
                include: {
                  staffProfile: {
                    include: { permissions: { select: { permission: true } } },
                  },
                },
              },
            },
          },
        },
      });

      const [grid, indisponibilites] = await Promise.all([
        this.prisma.timetableGridConfig.findUnique({ where: { schoolId } }),
        this.prisma.teacherUnavailability.findMany({
          where: { schoolId, active: true },
          select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true },
        }),
      ]);
      const gridAdapter = new SchedulingGridAdapter();
      const gridConfig = grid;
      const cases = gridConfig ? gridConfig.joursActifs.flatMap((jour) => {
        const dayOfWeek = joursActifsVersIndex([jour])[0]!;
        return gridAdapter
          .calculerSqelette({ ...gridConfig, periodesCoursParJour: (gridConfig.periodesCoursParJour ?? {}) as Record<string, number> }, jour)
          .filter((periode) => periode.type === 'COURS')
          .map((periode) => ({ dayOfWeek, startTime: periode.debut, endTime: periode.fin }));
      }) : [];
      const capaciteParEnseignant = new Map<string, number>();
      for (const teacherSubject of teacherSubjects) {
        const teacherId = teacherSubject.teacherProfile.user.id;
        if (capaciteParEnseignant.has(teacherId)) continue;
        const gridCapacity = grid ? calculerCapaciteDisponible(cases, indisponibilites, [], teacherId) : undefined;
        const configuredCapacity = teacherSubject.teacherProfile.maxWeeklyHours ?? school?.defaultMaxWeeklyHours ?? null;
        if (configuredCapacity === null) {
          if (gridCapacity !== undefined) capaciteParEnseignant.set(teacherId, gridCapacity);
        } else if (gridCapacity === undefined) {
          capaciteParEnseignant.set(teacherId, configuredCapacity);
        } else {
          capaciteParEnseignant.set(teacherId, Math.min(gridCapacity, configuredCapacity));
        }
      }

      for (const ts of teacherSubjects) {
        const user = ts.teacherProfile.user;
        const permissions = user.staffProfile?.permissions.map((p) => p.permission) ?? [];
        const estAP = permissions.some((p) => AP_PERMISSIONS.has(p));
        enseignants.push({
          teacherId: user.id,
          subjectId: ts.subjectId,
          estAP,
          capaciteHeures: capaciteParEnseignant.get(user.id),
          maxWeeklyHours: ts.teacherProfile.maxWeeklyHours,
          defaultMaxWeeklyHours: school?.defaultMaxWeeklyHours,
        });
      }
    }

    const affectations = await this.prisma.teachingAssignment.findMany({
      where: { schoolId, academicYearId },
      select: { id: true, classId: true, subjectId: true, teacherId: true, source: true, subject: { select: { hoursPerWeek: true } } },
    });

    return {
      classes: classes as ClassePourGeneration[],
      matieres,
      enseignants,
      affectations: affectations.map(affectation => ({
        id: affectation.id,
        classId: affectation.classId,
        subjectId: affectation.subjectId,
        teacherId: affectation.teacherId,
        source: affectation.source,
        subjectHoursPerWeek: affectation.subject.hoursPerWeek,
      })),
    };
  }

  async createAssignmentsInTransaction(assignments: AssignmentACreerPayload[]): Promise<number> {
    if (assignments.length === 0) return 0;
    const result = await this.prisma.$transaction((tx) =>
      tx.teachingAssignment.createMany({
        data: assignments.map((assignment) => ({ ...assignment, source: 'GENERATED' as const, createdAt: new Date() })),
      }),
    );
    return result.count;
  }

  async updateAssignmentsInTransaction(assignments: AssignmentAModifierPayload[]): Promise<number> {
    if (assignments.length === 0) return 0;
    const updated = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const assignment of assignments) {
        const result = await tx.teachingAssignment.updateMany({ where: { id: assignment.id }, data: { teacherId: assignment.teacherId } });
        count += result.count;
      }
      return count;
    });
    return updated;
  }

  async persistIssues(params: {
    schoolId: string;
    academicYearId: string;
    issues: IssueAffectationGeneration[];
  }): Promise<number> {
    if (params.issues.length === 0) return 0;
    await this.prisma.$transaction(
      params.issues.map(issue => this.prisma.teachingAssignmentIssue.upsert({
        where: {
          schoolId_academicYearId_classId_subjectId: {
            schoolId: params.schoolId,
            academicYearId: params.academicYearId,
            classId: issue.classId,
            subjectId: issue.subjectId,
          },
        },
        create: {
          schoolId: params.schoolId,
          academicYearId: params.academicYearId,
          classId: issue.classId,
          subjectId: issue.subjectId,
          reason: issue.reason,
        },
        update: {
          reason: issue.reason,
          status: 'OPEN',
          detectedAt: new Date(),
          resolvedAt: null,
          resolvedById: null,
        },
      })),
    );
    return params.issues.length;
  }

  async syncLv2Groups(schoolId: string, academicYearId: string): Promise<void> {
    const lv2Subjects = await this.prisma.subject.findMany({
      where: { schoolId, isLV2: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (lv2Subjects.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const groupSet = await tx.studentGroupSet.upsert({
        where: { schoolId_code: { schoolId, code: LV2_GROUPSET_CODE } },
        create: { schoolId, code: LV2_GROUPSET_CODE, name: 'Langues vivantes 2' },
        update: {},
      });

      const existingGroups = await tx.studentGroup.findMany({
        where: { groupSetId: groupSet.id },
        select: { id: true, subjectId: true },
      });
      const groupIdBySubjectId = new Map<string, string>();
      for (const g of existingGroups) {
        if (g.subjectId) groupIdBySubjectId.set(g.subjectId, g.id);
      }

      for (const subject of lv2Subjects) {
        if (!groupIdBySubjectId.has(subject.id)) {
          const created = await tx.studentGroup.create({
            data: { groupSetId: groupSet.id, name: subject.name, subjectId: subject.id },
          });
          groupIdBySubjectId.set(subject.id, created.id);
        }
      }

      const enrollments = await tx.enrollment.findMany({
        where: {
          schoolId,
          academicYearId,
          status: 'ACTIVE',
          student: { lv2SubjectId: { not: null } },
        },
        select: { studentId: true, student: { select: { lv2SubjectId: true } } },
      });

      await tx.studentGroupMembership.deleteMany({
        where: { groupSetId: groupSet.id, academicYearId },
      });

      const memberships = enrollments
        .map((e) => {
          const groupId = e.student.lv2SubjectId
            ? groupIdBySubjectId.get(e.student.lv2SubjectId)
            : undefined;
          if (!groupId) return null;
          return {
            studentProfileId: e.studentId,
            groupId,
            groupSetId: groupSet.id,
            academicYearId,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      if (memberships.length > 0) {
        await tx.studentGroupMembership.createMany({ data: memberships });
      }
    });
  }
}
