import type { PrismaClient } from '@prisma/client';
import type {
  ImportUtilisateursRepository,
  ImportContexte,
  AffectationPedagogiqueData,
  ImportContexteValidation,
} from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { PebsFiliere } from '@domain/types/enums';

export class PrismaImportUtilisateursRepository implements ImportUtilisateursRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async chargerContexte(schoolId: string): Promise<ImportContexte> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true, hasPEBSFrancophone: true, hasPEBSAnglophone: true },
    });
    const classesRaw = await this.prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        capacity: true,
        _count: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });
    const classes = classesRaw.map((c) => ({
      id: c.id,
      name: c.name,
      capacity: c.capacity,
      currentEnrollments: c._count.enrollments,
    }));
    const lv2Subjects = await this.prisma.subject.findMany({
      where: { schoolId, isLV2: true },
      select: { id: true, name: true },
    });
    return {
      schoolName: school?.name ?? 'ZekoulABia',
      hasPEBS: !!(school?.hasPEBSFrancophone || school?.hasPEBSAnglophone),
      classes,
      lv2Subjects,
    };
  }

  async findParentParEmail(schoolId: string, email: string): Promise<string | null> {
    const existingParent = await this.prisma.user.findFirst({
      where: { schoolId, email, role: 'PARENT' },
      select: { id: true },
    });
    return existingParent?.id ?? null;
  }

  async findStudentProfileId(userId: string): Promise<string | null> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async updatePeBSFiliere(userId: string, pebsFiliere: PebsFiliere): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { pebsFiliere },
    });
  }

  async updateLv2Subject(userId: string, lv2SubjectId: string): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { lv2SubjectId },
    });
  }

  async updatePeBSAndLv2(userId: string, pebsFiliere: PebsFiliere | null, lv2SubjectId: string | null): Promise<void> {
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { pebsFiliere, lv2SubjectId },
    });
  }

  async findSubjectsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]> {
    return this.prisma.subject.findMany({
      where: { schoolId, name: { in: noms } },
      select: { id: true, name: true },
    });
  }

  async findClassePourPP(schoolId: string, name: string): Promise<{ id: string; professorPrincipalId: string | null } | null> {
    return this.prisma.class.findFirst({
      where: { schoolId, name },
      select: { id: true, professorPrincipalId: true },
    });
  }

  async findNomProfesseurPrincipal(userId: string): Promise<string | null> {
    const pp = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return pp ? `${pp.firstName} ${pp.lastName}` : null;
  }

  async findAutreClasseDePP(teacherId: string, schoolId: string, excludeClassId: string): Promise<{ name: string } | null> {
    return this.prisma.class.findFirst({
      where: { professorPrincipalId: teacherId, schoolId, id: { not: excludeClassId } },
      select: { name: true },
    });
  }

  async assignerProfesseurPrincipal(classId: string, teacherId: string): Promise<void> {
    await this.prisma.class.update({
      where: { id: classId },
      data: { professorPrincipalId: teacherId },
    });
  }

  async findClasseProgramme(schoolId: string, name: string): Promise<{ id: string; level: string | null; serie: string | null; filiere: string | null; academicYearId: string } | null> {
    return this.prisma.class.findFirst({
      where: { schoolId, name },
      select: { id: true, level: true, serie: true, filiere: true, academicYearId: true },
    });
  }

  async findSubjectsDuProgramme(schoolId: string, level: string | null, codeSerie: string | null, classId: string): Promise<string[]> {
    const [coefficients, overrides] = await Promise.all([
      this.prisma.subjectCoefficient.findMany({
        where: {
          schoolId,
          classLevel: level ?? undefined,
          OR: [{ serieCode: codeSerie }, { serieCode: null }],
        },
        select: { subjectId: true },
      }),
      this.prisma.classSubjectOverride.findMany({
        where: { classId, schoolId },
        select: { subjectId: true },
      }),
    ]);
    return [...new Set([
      ...coefficients.map((c) => c.subjectId),
      ...overrides.map((o) => o.subjectId),
    ])];
  }

  async creerAffectations(assignments: AffectationPedagogiqueData[]): Promise<number> {
    if (assignments.length === 0) return 0;
    const result = await this.prisma.teachingAssignment.createMany({
      data: assignments.map((assignment) => ({ ...assignment, source: 'MANUAL' as const, createdAt: new Date() })),
      skipDuplicates: true,
    });
    return result.count;
  }

  // ── NOUVEAU (Étape 3 — support PARENT) ──────────────────────────────────
  async findStudentsParMatricules(schoolId: string, matricules: string[]): Promise<{ matricule: string; studentProfileId: string }[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: {
        user: { schoolId },
        matricule: { in: matricules },
      },
      select: { matricule: true, id: true },
    });
    return students.map((s) => ({ matricule: s.matricule, studentProfileId: s.id }));
  }

  async findStudentsParEmails(schoolId: string, emails: string[]): Promise<{ email: string; studentProfileId: string }[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: {
        user: {
          schoolId,
          email: { in: emails },
        },
      },
      select: { user: { select: { email: true } }, id: true },
    });
    return students.map((s) => ({ email: s.user.email, studentProfileId: s.id }));
  }

  async findSectionParNom(schoolId: string, nom: string): Promise<{ id: string } | null> {
    const section = await this.prisma.section.findFirst({
      where: { schoolId, name: nom },
      select: { id: true },
    });
    return section ? { id: section.id } : null;
  }

  async findDepartmentsParNoms(schoolId: string, noms: string[]): Promise<{ id: string; name: string }[]> {
    return this.prisma.department.findMany({
      where: { schoolId, name: { in: noms } },
      select: { id: true, name: true },
    });
  }

  async chargerContexteValidation(schoolId: string): Promise<ImportContexteValidation> {
    const [school, classes, lv2Subjects, subjects, departments, parents, students] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, hasPEBSFrancophone: true, hasPEBSAnglophone: true },
      }),
      this.prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, level: true, serie: true, filiere: true, academicYearId: true },
      }),
      this.prisma.subject.findMany({
        where: { schoolId, isLV2: true },
        select: { id: true, name: true },
      }),
      this.prisma.subject.findMany({
        where: { schoolId },
        select: { id: true, name: true },
      }),
      this.prisma.department.findMany({
        where: { schoolId },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { schoolId, role: 'PARENT', isActive: true },
        select: { email: true, id: true },
      }),
      this.prisma.studentProfile.findMany({
        where: { user: { schoolId } },
        select: { id: true, matricule: true, user: { select: { email: true } } },
      }),
    ]);

    const existingParents = new Map<string, string>();
    for (const p of parents) {
      if (p.email) existingParents.set(p.email, p.id);
    }

    return {
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        serie: c.serie,
        filiere: c.filiere,
        academicYearId: c.academicYearId,
      })),
      lv2Subjects,
      hasPEBS: !!(school?.hasPEBSFrancophone || school?.hasPEBSAnglophone),
      existingParents,
      existingStudents: students.map((s) => ({
        id: s.id,
        matricule: s.matricule ?? undefined,
        email: s.user?.email ?? undefined,
      })),
      subjects,
      departementsAp: departments,
    };
  }
}