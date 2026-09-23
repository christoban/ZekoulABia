import type { PrismaClient } from '@prisma/client';
import {
  CYCLE2_LEVELS,
  parseSerie,
} from '@application/school/SubjectAssignmentHelper';
import type {
  TeachingAssignmentGeneratorRepository,
  DonneesGenerationAffectations,
  AssignmentACreerPayload,
  ClassePourGeneration,
  MatiereCandidateGeneration,
} from '@domain/ports/repositories/TeachingAssignmentGeneratorRepository';

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

    const enseignants: DonneesGenerationAffectations['enseignants'] = [];
    if (candidateSubjectIds.size > 0) {
      const teacherSubjects = await this.prisma.teacherSubject.findMany({
        where: {
          subjectId: { in: Array.from(candidateSubjectIds) },
          teacherProfile: { user: { schoolId } },
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

      for (const ts of teacherSubjects) {
        const user = ts.teacherProfile.user;
        const permissions = user.staffProfile?.permissions.map((p) => p.permission) ?? [];
        const estAP = permissions.some((p) => AP_PERMISSIONS.has(p));
        enseignants.push({
          teacherId: user.id,
          subjectId: ts.subjectId,
          estAP,
        });
      }
    }

    const affectations = await this.prisma.teachingAssignment.findMany({
      where: { schoolId, academicYearId },
      select: { classId: true, subjectId: true, teacherId: true },
    });

    return {
      classes: classes as ClassePourGeneration[],
      matieres,
      enseignants,
      affectations,
    };
  }

  async createAssignmentsInTransaction(assignments: AssignmentACreerPayload[]): Promise<number> {
    if (assignments.length === 0) return 0;
    const result = await this.prisma.$transaction((tx) =>
      tx.teachingAssignment.createMany({ data: assignments }),
    );
    return result.count;
  }
}
