import type { PrismaClient } from '@prisma/client';
import type {
  Lv2ChoiceRepository,
  Lv2ChoiceWindowRef,
  Lv2ChoiceSubmissionRef,
} from '@domain/ports/repositories/Lv2ChoiceRepository';

export class PrismaLv2ChoiceRepository implements Lv2ChoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverFenetre(fenetreId: string): Promise<Lv2ChoiceWindowRef | null> {
    return this.prisma.lv2ChoiceWindow.findUnique({ where: { id: fenetreId } }) as Promise<Lv2ChoiceWindowRef | null>;
  }

  async listerFenetres(schoolId: string): Promise<Lv2ChoiceWindowRef[]> {
    return this.prisma.lv2ChoiceWindow.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' } }) as Promise<Lv2ChoiceWindowRef[]>;
  }

  async trouverProfilEleveAvecClasse(userId: string, schoolId: string): Promise<{ id: string; classId: string | null; level: string | null } | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user: { id: userId, schoolId } },
      select: { id: true, enrollmentsYearScoped: { where: { status: 'ACTIVE', academicYear: { isCurrent: true } }, select: { class: { select: { id: true, level: true } } }, take: 1 } },
    });
    if (!profile) return null;
    const cls = profile.enrollmentsYearScoped?.[0]?.class;
    return { id: profile.id, classId: cls?.id ?? null, level: cls?.level ?? null };
  }

  async trouverFenetreOuverteParNiveauExacte(schoolId: string, level: string): Promise<Lv2ChoiceWindowRef | null> {
    return this.prisma.lv2ChoiceWindow.findFirst({
      where: { schoolId, level, status: 'OPEN', openDate: { lte: new Date() }, closeDate: { gte: new Date() } },
    }) as Promise<Lv2ChoiceWindowRef | null>;
  }

  async trouverSoumission(windowId: string, studentProfileId: string): Promise<Lv2ChoiceSubmissionRef | null> {
    return this.prisma.lv2ChoiceSubmission.findUnique({
      where: { windowId_studentProfileId: { windowId, studentProfileId } },
      include: { chosenSubject: { select: { id: true, name: true } } },
    }) as Promise<Lv2ChoiceSubmissionRef | null>;
  }

  async listerMatieresLV2(schoolId: string): Promise<{ id: string; name: string }[]> {
    return this.prisma.subject.findMany({ where: { schoolId, isLV2: true }, select: { id: true, name: true } }) as Promise<{ id: string; name: string }[]>;
  }

  async trouverFenetreOuverteParNiveau(schoolId: string, level: string, academicYearId: string): Promise<Lv2ChoiceWindowRef | null> {
    return this.prisma.lv2ChoiceWindow.findFirst({
      where: { schoolId, level, academicYearId, status: 'OPEN' },
    }) as Promise<Lv2ChoiceWindowRef | null>;
  }

  async trouverFenetreOuverteActive(schoolId: string, level: string): Promise<Lv2ChoiceWindowRef | null> {
    return this.prisma.lv2ChoiceWindow.findFirst({
      where: {
        schoolId,
        level,
        status: 'OPEN',
        openDate: { lte: new Date() },
        closeDate: { gte: new Date() },
      },
    }) as Promise<Lv2ChoiceWindowRef | null>;
  }

  async creerFenetre(data: { schoolId: string; level: string; academicYearId: string; openDate: Date; closeDate: Date }): Promise<Lv2ChoiceWindowRef> {
    return this.prisma.lv2ChoiceWindow.create({
      data: { ...data, status: 'OPEN' },
    }) as Promise<Lv2ChoiceWindowRef>;
  }

  async cloreFenetre(fenetreId: string): Promise<void> {
    await this.prisma.lv2ChoiceWindow.update({
      where: { id: fenetreId },
      data: { status: 'CLOSED' },
    });
  }

  async mettreAJourCloture(fenetreId: string, closeDate: Date): Promise<void> {
    await this.prisma.lv2ChoiceWindow.update({
      where: { id: fenetreId },
      data: { closeDate },
    });
  }

  async listerSoumissions(fenetreId: string): Promise<Lv2ChoiceSubmissionRef[]> {
    return this.prisma.lv2ChoiceSubmission.findMany({
      where: { windowId: fenetreId },
    }) as Promise<Lv2ChoiceSubmissionRef[]>;
  }

  async upsertSoumission(data: {
    windowId: string;
    studentProfileId: string;
    chosenSubjectId: string;
    submissionMethod: string;
    submittedByUserId?: string;
  }): Promise<void> {
    await this.prisma.lv2ChoiceSubmission.upsert({
      where: {
        windowId_studentProfileId: { windowId: data.windowId, studentProfileId: data.studentProfileId },
      },
      create: {
        windowId: data.windowId,
        studentProfileId: data.studentProfileId,
        chosenSubjectId: data.chosenSubjectId,
        submissionMethod: data.submissionMethod as 'ADMIN_MANUAL' | 'STUDENT_DIRECT',
        submittedByUserId: data.submittedByUserId,
      },
      update: {
        chosenSubjectId: data.chosenSubjectId,
        submissionMethod: data.submissionMethod as 'ADMIN_MANUAL' | 'STUDENT_DIRECT',
        ...(data.submittedByUserId ? { submittedByUserId: data.submittedByUserId } : {}),
        submittedAt: new Date(),
      },
    });
  }

  async listerElevesDuNiveau(schoolId: string, level: string): Promise<{ studentUserId: string; studentName: string }[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: {
        user: { schoolId },
        enrollmentsYearScoped: {
          some: { status: 'ACTIVE', academicYear: { isCurrent: true }, class: { level } },
        },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    return eleves
      .filter((e) => e.user)
      .map((e) => ({ studentUserId: e.user.id, studentName: `${e.user.firstName} ${e.user.lastName}` }));
  }

  async suivreFenetre(fenetreId: string, schoolId: string): Promise<{
    window: { id: string; level: string; status: string; openDate: Date; closeDate: Date };
    total: number;
    submitted: number;
    pending: number;
    students: {
      studentProfileId: string;
      userId: string;
      firstName: string;
      lastName: string;
      className: string;
      hasSubmitted: boolean;
      submissionMethod?: string;
      chosenSubjectName?: string;
    }[];
  }> {
    const window = await this.prisma.lv2ChoiceWindow.findUnique({ where: { id: fenetreId } });
    if (!window) throw new Error('Fenêtre de choix introuvable');
    if (window.schoolId !== schoolId) throw new Error('Accès refusé');

    const classes = await this.prisma.class.findMany({
      where: { schoolId, level: window.level },
      select: { id: true, name: true },
    });
    const classIds = classes.map((c) => c.id);
    const classByName = new Map(classes.map((c) => [c.id, c.name]));

    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        enrollmentsYearScoped: {
          some: { classId: { in: classIds }, status: 'ACTIVE', academicYear: { isCurrent: true } },
        },
        studentStatus: 'ACTIVE',
      },
      select: {
        id: true,
        userId: true,
        enrollmentsYearScoped: {
          where: { classId: { in: classIds }, status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { classId: true },
          take: 1,
        },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const submissions = await this.prisma.lv2ChoiceSubmission.findMany({
      where: { windowId: fenetreId },
      include: { chosenSubject: { select: { name: true } } },
    });
    const subByStudent = new Map(submissions.map((s) => [s.studentProfileId, s]));

    const students = profiles.map((p) => {
      const sub = subByStudent.get(p.id);
      const studentClassId = p.enrollmentsYearScoped?.[0]?.classId;
      return {
        studentProfileId: p.id,
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        className: (studentClassId ? classByName.get(studentClassId) : '') ?? '',
        hasSubmitted: !!sub,
        submissionMethod: sub?.submissionMethod,
        chosenSubjectName: sub?.chosenSubject?.name,
      };
    });

    const submitted = students.filter((s) => s.hasSubmitted).length;

    return {
      window: { id: window.id, level: window.level, status: window.status, openDate: window.openDate, closeDate: window.closeDate },
      total: students.length,
      submitted,
      pending: students.length - submitted,
      students,
    };
  }
}