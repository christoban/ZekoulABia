import type { Prisma, PrismaClient } from '@prisma/client';
import {
  CYCLE2_LEVELS,
  parseSerie,
} from '@application/school/SubjectAssignmentHelper';
import { SchedulingGridAdapter } from '@infrastructure/scheduling/SchedulingGridAdapter';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import { calculerCapaciteDisponible, LIMITE_AP_HEURES } from '@domain/rules/CapaciteEmploiDuTemps';
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
      select: {
        subjectId: true,
        teacherId: true,
        source: true,
        createdAt: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').AffectationAvecEnseignant[]>;
  }

  async listerIssuesAffectations(params: { schoolId: string; academicYearId?: string; status?: string }) {
    const issues = await this.prisma.teachingAssignmentIssue.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.academicYearId && { academicYearId: params.academicYearId }),
        ...(params.status && { status: params.status }),
      },
      select: { id: true, classId: true, subjectId: true, reason: true, status: true, detectedAt: true, resolvedAt: true },
      orderBy: { detectedAt: 'desc' },
    });
    const classIds = [...new Set(issues.map(issue => issue.classId))];
    const subjectIds = [...new Set(issues.map(issue => issue.subjectId))];
    const [classes, subjects] = await Promise.all([
      this.prisma.class.findMany({ where: { id: { in: classIds }, schoolId: params.schoolId }, select: { id: true, name: true } }),
      this.prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId: params.schoolId }, select: { id: true, name: true } }),
    ]);
    const classNames = new Map(classes.map(classe => [classe.id, classe.name]));
    const subjectNames = new Map(subjects.map(subject => [subject.id, subject.name]));
    return issues.map(issue => ({
      ...issue,
      className: classNames.get(issue.classId) ?? 'Classe inconnue',
      subjectName: subjectNames.get(issue.subjectId) ?? 'Matière inconnue',
    }));
  }

  async enregistrerIssueAffectation(params: {
    schoolId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    reason: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.teachingAssignmentIssue.upsert({
      where: {
        schoolId_academicYearId_classId_subjectId: {
          schoolId: params.schoolId,
          academicYearId: params.academicYearId,
          classId: params.classId,
          subjectId: params.subjectId,
        },
      },
      create: {
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
        classId: params.classId,
        subjectId: params.subjectId,
        reason: params.reason,
        details: params.details as Prisma.InputJsonValue | undefined,
      },
      update: {
        reason: params.reason,
        status: 'OPEN',
        details: params.details as Prisma.InputJsonValue | undefined,
        detectedAt: new Date(),
        resolvedAt: null,
        resolvedById: null,
      },
    });
  }

  async listerUtilisateursAffectations(schoolId: string): Promise<{ id: string }[]> {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        isActive: true,
        staffProfile: { permissions: { some: { permission: 'MANAGE_TEACHING_ASSIGNMENTS' } } },
      },
      select: { id: true },
    });
  }

  async listerEnseignantsEligibles(schoolId: string, subjectId: string) {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'TEACHER',
        isActive: true,
        teacherProfile: { teacherSubjects: { some: { subjectId } } },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }) as Promise<import('@domain/ports/repositories/RattachementEnseignantRepository').EnseignantEligible[]>;
  }

  async verifierEnseignant(teacherId: string, schoolId: string): Promise<boolean> {
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, schoolId, role: 'TEACHER', isActive: true },
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
        source: 'MANUAL',
        createdAt: new Date(),
      },
      update: { teacherId: params.teacherId, source: 'MANUAL', createdAt: new Date() },
    });
  }

  async retirer(params: { classId: string; subjectId: string; schoolId: string }): Promise<void> {
    await this.prisma.teachingAssignment.deleteMany({
      where: { classId: params.classId, subjectId: params.subjectId, schoolId: params.schoolId },
    });
  }

  async supprimerToutesLesAffectationsDeLaClasse(params: { classId: string; schoolId: string }): Promise<number> {
    const resultat = await this.prisma.teachingAssignment.deleteMany({
      where: { classId: params.classId, schoolId: params.schoolId },
    });
    return resultat.count;
  }

  async supprimerToutesLesAffectationsDeLEtablissement(params: { schoolId: string; academicYearId: string }): Promise<number> {
    const resultat = await this.prisma.teachingAssignment.deleteMany({
      where: { schoolId: params.schoolId, academicYearId: params.academicYearId },
    });
    return resultat.count;
  }

  async resoudreIssueAffectation(params: {
    schoolId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    userId: string;
  }): Promise<void> {
    await this.prisma.teachingAssignmentIssue.updateMany({
      where: {
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
        classId: params.classId,
        subjectId: params.subjectId,
        status: 'OPEN',
      },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: params.userId },
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
    const currentLoad = await this.calculerChargeEnseignant(params.teacherId, params.schoolId, params.academicYearId, {
      classId: params.classId,
      subjectId: params.subjectId,
    });
    const capacity = await this.calculerCapaciteDisponible(params.teacherId, params.schoolId);
    const apExceeded = isAP && currentLoad + candidateLoad > LIMITE_AP_HEURES;
    const capacityExceeded = capacity !== null && currentLoad + candidateLoad > capacity;
    if (!apExceeded && !capacityExceeded) {
      return { ok: true };
    }

    const eligible = await this.listerEnseignantsEligibles(params.schoolId, params.subjectId);
    const suggestions: SuggestionEnseignant[] = [];
    for (const teacher of eligible) {
      if (teacher.id === params.teacherId) continue;
      const load = await this.calculerChargeEnseignant(teacher.id, params.schoolId, params.academicYearId);
      const teacherCapacity = await this.calculerCapaciteDisponible(teacher.id, params.schoolId);
      const teacherAP = await this.estEnseignantAP(teacher.id);
      if (teacherCapacity !== null && load + candidateLoad > teacherCapacity) continue;
      if (teacherAP && load + candidateLoad > LIMITE_AP_HEURES) continue;
      suggestions.push({
        teacherId: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        chargeHeures: load,
      });
    }
    suggestions.sort((a, b) => a.chargeHeures - b.chargeHeures || a.teacherId.localeCompare(b.teacherId));

    return {
      ok: false,
      code: apExceeded ? 'AP_WEEKLY_CAP_EXCEEDED' : 'TEACHER_WEEKLY_CAP_EXCEEDED',
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

  private async calculerCapaciteDisponible(teacherId: string, schoolId: string): Promise<number | null> {
    const [school, teacherProfile, grid, indisponibilites] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { defaultMaxWeeklyHours: true } }),
      this.prisma.teacherProfile.findUnique({ where: { userId: teacherId }, select: { maxWeeklyHours: true } }),
      this.prisma.timetableGridConfig.findUnique({ where: { schoolId } }),
      this.prisma.teacherUnavailability.findMany({
        where: { schoolId, teacherId, active: true },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      }),
    ]);
    const configuredCapacity = teacherProfile?.maxWeeklyHours ?? school?.defaultMaxWeeklyHours ?? null;
    if (!grid) return configuredCapacity;

    const gridAdapter = new SchedulingGridAdapter();
    const cases = grid.joursActifs.flatMap((jour) => {
      const dayOfWeek = joursActifsVersIndex([jour])[0]!;
      return gridAdapter
        .calculerSqelette({ ...grid, periodesCoursParJour: (grid.periodesCoursParJour ?? {}) as Record<string, number> }, jour)
        .filter((periode) => periode.type === 'COURS')
        .map((periode) => ({ dayOfWeek, startTime: periode.debut, endTime: periode.fin }));
    });
    const gridCapacity = calculerCapaciteDisponible(cases, indisponibilites.map((indisponibilite) => ({ ...indisponibilite, teacherId })), [], teacherId);
    return configuredCapacity === null ? gridCapacity : Math.min(gridCapacity, configuredCapacity);
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

  private async calculerChargeEnseignant(
    teacherId: string,
    schoolId: string,
    academicYearId: string,
    exclude?: { classId: string; subjectId: string },
  ): Promise<number> {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: {
        teacherId,
        schoolId,
        academicYearId,
        ...(exclude && { NOT: { classId: exclude.classId, subjectId: exclude.subjectId } }),
      },
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
