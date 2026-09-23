import type { PrismaClient } from '@prisma/client';
import {
  CYCLE2_LEVELS,
  parseSerie,
} from '@application/school/SubjectAssignmentHelper';
import type {
  RattachementEnseignantRepository,
  VerifierRattachementOptions,
  ValidationAffectationResultat,
  SuggestionEnseignant,
} from '@domain/ports/repositories/RattachementEnseignantRepository';

export class PrismaRattachementEnseignantRepository implements RattachementEnseignantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverClasse(classId: string, schoolId: string) {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true, level: true, serie: true, filiere: true, academicYearId: true },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').ClassePourAffectation | null>;
  }

  async listerCoefficients(params: { schoolId: string; classLevel?: string | null; serieCode: string | null }) {
    return this.prisma.subjectCoefficient.findMany({
      where: {
        schoolId: params.schoolId,
        classLevel: params.classLevel ?? undefined,
        OR: params.serieCode ? [{ serieCode: params.serieCode }, { serieCode: null }] : [{ serieCode: null }],
      },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: 'asc' } },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').CoefficientAvecMatiere[]>;
  }

  async listerOverrides(classId: string, schoolId: string) {
    return this.prisma.classSubjectOverride.findMany({
      where: { classId, schoolId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: 'asc' } },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').OverrideAvecMatiere[]>;
  }

  async listerAffectations(classId: string, schoolId: string) {
    return this.prisma.teachingAssignment.findMany({
      where: { classId, schoolId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').AffectationAvecEnseignant[]>;
  }

  async listerEnseignantsEligibles(schoolId: string, subjectId: string) {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'TEACHER',
        teacherProfile: { teacherSubjects: { some: { subjectId } } },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').EnseignantEligible[]>;
  }

  async verifierEnseignant(teacherId: string, schoolId: string): Promise<boolean> {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, schoolId, role: 'TEACHER' },
      select: { id: true },
    });
    return !!teacher;
  }

  async assigner(params: { classId: string; subjectId: string; teacherId: string; schoolId: string; academicYearId: string }): Promise<void> {
    await this.prisma.teachingAssignment.upsert({
      where: { classId_subjectId: { classId: params.classId, subjectId: params.subjectId } },
      create: {
        classId: params.classId,
        subjectId: params.subjectId,
        teacherId: params.teacherId,
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
      },
      update: { teacherId: params.teacherId },
    });
  }

  async retirer(params: { classId: string; subjectId: string; schoolId: string }): Promise<void> {
    await this.prisma.teachingAssignment.deleteMany({
      where: { classId: params.classId, subjectId: params.subjectId, schoolId: params.schoolId },
    });
  }

  async estRattacheALaClasse(
    teacherId: string,
    classId: string,
    subjectId: string | undefined,
    options: VerifierRattachementOptions,
  ): Promise<boolean> {
    const assignation = await this.prisma.teachingAssignment.findFirst({
      where: { teacherId, classId, ...(subjectId ? { subjectId } : {}) },
      select: { id: true },
    });
    if (assignation) return true;
    if (!options.autoriserProfesseurPrincipal) return false;

    const estProfPrincipal = await this.prisma.class.findFirst({
      where: { id: classId, professorPrincipalId: teacherId },
      select: { id: true },
    });
    return !!estProfPrincipal;
  }

  async validerAffectationPossible(params: {
    classId: string;
    subjectId: string;
    teacherId: string;
    schoolId: string;
    academicYearId: string;
  }): Promise<ValidationAffectationResultat> {
    const candidateLoad = await this.trouverVolumeHoraireMatiere(params.schoolId, params.classId, params.subjectId);
    if (candidateLoad === null) {
      // Pas de volume horaire fiable pour cette matière → on ne bloque pas l'affectation manuelle.
      return { ok: true };
    }

    const isAP = await this.estEnseignantAP(params.teacherId);
    if (!isAP) {
      return { ok: true };
    }

    const currentLoad = await this.calculerChargeEnseignant(params.teacherId, params.schoolId, params.academicYearId);
    if (currentLoad + candidateLoad <= 14) {
      return { ok: true };
    }

    const eligible = await this.listerEnseignantsEligibles(params.schoolId, params.subjectId);
    const suggestions: SuggestionEnseignant[] = [];
    for (const teacher of eligible) {
      if (teacher.id === params.teacherId) continue;
      const load = await this.calculerChargeEnseignant(teacher.id, params.schoolId, params.academicYearId);
      if (load + candidateLoad <= 14) {
        suggestions.push({
          teacherId: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          chargeHeures: load,
        });
      }
    }
    suggestions.sort((a, b) => a.chargeHeures - b.chargeHeures || a.teacherId.localeCompare(b.teacherId));

    return {
      ok: false,
      code: 'AP_WEEKLY_CAP_EXCEEDED',
      currentLoad,
      candidateLoad,
      suggestions,
    };
  }

  private async trouverVolumeHoraireMatiere(schoolId: string, classId: string, subjectId: string): Promise<number | null> {
    const cls = await this.trouverClasse(classId, schoolId);
    if (!cls || !cls.level) return null;

    const resolvedSerie =
      cls.serie ??
      cls.filiere ??
      ((CYCLE2_LEVELS as string[]).includes(cls.level) ? parseSerie(cls.name, cls.level) : null);

    const coefficients = await this.prisma.subjectCoefficient.findMany({
      where: {
        schoolId,
        subjectId,
        classLevel: cls.level,
        OR: resolvedSerie ? [{ serieCode: resolvedSerie }, { serieCode: null }] : [{ serieCode: null }],
      },
    });

    const exact = coefficients.find((c) => c.serieCode === resolvedSerie);
    const generic = coefficients.find((c) => c.serieCode === null);
    return (exact ?? generic)?.weeklyPeriods ?? null;
  }

  private async estEnseignantAP(teacherId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: teacherId },
      include: {
        staffProfile: {
          include: { permissions: { select: { permission: true } } },
        },
      },
    });
    const permissions = user?.staffProfile?.permissions.map((p) => p.permission) ?? [];
    return permissions.includes('SUPERVISE_TEACHERS') || permissions.includes('SUPERVISE_DEPARTMENT_TEACHERS');
  }

  private async calculerChargeEnseignant(teacherId: string, schoolId: string, academicYearId: string): Promise<number> {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId, academicYearId },
      select: { classId: true, subjectId: true },
    });

    let total = 0;
    for (const assignment of assignments) {
      const wp = await this.trouverVolumeHoraireMatiere(schoolId, assignment.classId, assignment.subjectId);
      total += wp ?? 0;
    }
    return total;
  }
}
