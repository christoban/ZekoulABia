import type { PrismaClient } from '@prisma/client';
import type {
  AnonymatCodeRecord,
  AnonymatListRow,
  AnonymatRepository,
  AnonymatTeamMemberRecord,
  CodeAvecProfil,
  CorrectionAssignmentRecord,
  CreateAnonymatCodeInput,
  CreateAnonymatTeamMemberInput,
  NoteAnonymeRecord,
  NoteAnonymeStatus,
  StudentGroupForAnonymat,
  UpsertNoteAnonymeInput,
} from '@domain/ports/repositories/AnonymatRepository';
import type { AnonymatTeamMemberStatus } from '@domain/types/enums';

export class PrismaAnonymatRepository implements AnonymatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCodesBySession(sessionId: string): Promise<AnonymatCodeRecord[]> {
    const codes = await this.prisma.anonymatCode.findMany({
      where: { assessmentSessionId: sessionId },
      orderBy: { code: 'asc' },
    });
    return codes.map((code) => ({ ...code }));
  }

  async replaceCodesForSession(sessionId: string, codes: CreateAnonymatCodeInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.anonymatCode.deleteMany({ where: { assessmentSessionId: sessionId } });
      if (codes.length === 0) return;
      await tx.anonymatCode.createMany({
        data: codes.map((code) => ({
          schoolId: code.schoolId,
          assessmentSessionId: code.assessmentSessionId,
          studentProfileId: code.studentProfileId,
          classId: code.classId,
          code: code.code,
          generatedByUserId: code.generatedByUserId,
        })),
      });
    });
  }

  async findStudentsForSessionGroupedByClass(params: {
    schoolId: string;
    classIds: string[];
  }): Promise<StudentGroupForAnonymat[]> {
    const result: StudentGroupForAnonymat[] = [];
    for (const classId of params.classIds) {
      const classe = await this.prisma.class.findFirst({
        where: { id: classId, schoolId: params.schoolId },
        select: { id: true, name: true },
      });
      if (!classe) continue;

      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          classId,
          schoolId: params.schoolId,
          status: 'ACTIVE',
          academicYear: { isCurrent: true },
        },
        select: {
          studentId: true,
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [
          { student: { user: { lastName: 'asc' } } },
          { student: { user: { firstName: 'asc' } } },
        ],
      });

      result.push({
        classId: classe.id,
        className: classe.name,
        students: enrollments.map((enrollment) => ({
          studentProfileId: enrollment.studentId,
          lastName: enrollment.student.user.lastName ?? '',
          firstName: enrollment.student.user.firstName ?? '',
        })),
      });
    }
    return result;
  }

  async createTeamMembers(members: CreateAnonymatTeamMemberInput[]): Promise<AnonymatTeamMemberRecord[]> {
    const created: AnonymatTeamMemberRecord[] = [];
    for (const member of members) {
      const record = await this.prisma.anonymatTeamMember.create({ data: member });
      created.push({ ...record, status: record.status as AnonymatTeamMemberStatus });
    }
    return created;
  }

  async findTeamMemberByTokenHash(tokenHash: string): Promise<AnonymatTeamMemberRecord | null> {
    const member = await this.prisma.anonymatTeamMember.findUnique({ where: { magicTokenHash: tokenHash } });
    return member ? { ...member, status: member.status as AnonymatTeamMemberStatus } : null;
  }

  async updateTeamMemberStatus(
    id: string,
    status: Extract<AnonymatTeamMemberStatus, 'IN_PROGRESS' | 'DONE'>,
    doneAt?: Date,
  ): Promise<void> {
    await this.prisma.anonymatTeamMember.update({
      where: { id },
      data: { status, doneAt: status === 'DONE' ? (doneAt ?? new Date()) : null },
    });
  }

  async countTeamMembersNotDone(sessionId: string): Promise<number> {
    return this.prisma.anonymatTeamMember.count({
      where: { assessmentSessionId: sessionId, status: { not: 'DONE' } },
    });
  }

  async getOrderedListForMember(memberId: string): Promise<AnonymatListRow[]> {
    const member = await this.prisma.anonymatTeamMember.findUniqueOrThrow({ where: { id: memberId } });
    const classes = await this.prisma.class.findMany({
      where: { id: { in: member.assignedClassIds } },
      select: { id: true, name: true },
    });
    const classNameById = new Map(classes.map((classe) => [classe.id, classe.name]));
    const codes = await this.prisma.anonymatCode.findMany({
      where: {
        assessmentSessionId: member.assessmentSessionId,
        classId: { in: member.assignedClassIds },
      },
      include: {
        studentProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    const byClass = new Map<string, typeof codes>();
    for (const code of codes) {
      const list = byClass.get(code.classId) ?? [];
      list.push(code);
      byClass.set(code.classId, list);
    }

    const shouldSlice = member.assignedClassIds.length === 1
      && member.classSliceStart != null
      && member.classSliceEnd != null;
    const rows: AnonymatListRow[] = [];
    for (const classId of member.assignedClassIds) {
      let list = (byClass.get(classId) ?? []).sort((left, right) => {
        const lastNameOrder = (left.studentProfile.user.lastName ?? '').localeCompare(right.studentProfile.user.lastName ?? '');
        return lastNameOrder !== 0
          ? lastNameOrder
          : (left.studentProfile.user.firstName ?? '').localeCompare(right.studentProfile.user.firstName ?? '');
      });
      if (shouldSlice) list = list.slice(member.classSliceStart! - 1, member.classSliceEnd!);
      list.forEach((code, index) => rows.push({
        code: code.code,
        studentLastName: code.studentProfile.user.lastName ?? '',
        studentFirstName: code.studentProfile.user.firstName ?? '',
        classId: code.classId,
        className: classNameById.get(code.classId) ?? '',
        orderInClass: index + 1,
      }));
    }
    return rows;
  }

  async findCodesWithUserIds(sessionId: string): Promise<CodeAvecProfil[]> {
    const codes = await this.prisma.anonymatCode.findMany({
      where: { assessmentSessionId: sessionId },
      include: {
        studentProfile: { select: { id: true, userId: true } },
      },
    });
    return codes.map((code) => ({
      code: code.code,
      classId: code.classId,
      studentProfileId: code.studentProfileId,
      userId: code.studentProfile.userId,
    }));
  }

  async findCodeBySessionAndCode(sessionId: string, code: string): Promise<AnonymatCodeRecord | null> {
    const c = await this.prisma.anonymatCode.findUnique({
      where: { assessmentSessionId_code: { assessmentSessionId: sessionId, code } },
    });
    return c ? { ...c } : null;
  }

  async upsertNotesAnonymes(notes: UpsertNoteAnonymeInput[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const note of notes) {
        const existing = await tx.noteAnonyme.findUnique({
          where: { assessmentSessionId_code: { assessmentSessionId: note.assessmentSessionId, code: note.code } },
        });
        if (existing && existing.status === 'SUBMITTED') {
          continue;
        }
        await tx.noteAnonyme.upsert({
          where: { assessmentSessionId_code: { assessmentSessionId: note.assessmentSessionId, code: note.code } },
          update: {
            score: note.score,
            isAbsent: note.isAbsent,
            isIllegible: note.isIllegible,
            maxValue: note.maxValue,
            correcteurId: note.correcteurId,
          },
          create: {
            schoolId: note.schoolId,
            assessmentSessionId: note.assessmentSessionId,
            code: note.code,
            score: note.score,
            maxValue: note.maxValue,
            isAbsent: note.isAbsent,
            isIllegible: note.isIllegible,
            correcteurId: note.correcteurId,
            status: 'DRAFT',
          },
        });
      }
    });
  }

  async findNotesAnonymesBySession(sessionId: string): Promise<NoteAnonymeRecord[]> {
    const notes = await this.prisma.noteAnonyme.findMany({
      where: { assessmentSessionId: sessionId },
    });
    return notes.map((n) => ({
      id: n.id,
      schoolId: n.schoolId,
      assessmentSessionId: n.assessmentSessionId,
      code: n.code,
      score: n.score,
      maxValue: n.maxValue,
      isAbsent: n.isAbsent,
      isIllegible: n.isIllegible,
      correcteurId: n.correcteurId,
      submittedAt: n.submittedAt,
      status: n.status as NoteAnonymeStatus,
    }));
  }

  async findNotesAnonymesByCorrecteur(sessionId: string, correcteurId: string): Promise<NoteAnonymeRecord[]> {
    const notes = await this.prisma.noteAnonyme.findMany({
      where: { assessmentSessionId: sessionId, correcteurId },
    });
    return notes.map((n) => ({
      id: n.id,
      schoolId: n.schoolId,
      assessmentSessionId: n.assessmentSessionId,
      code: n.code,
      score: n.score,
      maxValue: n.maxValue,
      isAbsent: n.isAbsent,
      isIllegible: n.isIllegible,
      correcteurId: n.correcteurId,
      submittedAt: n.submittedAt,
      status: n.status as NoteAnonymeStatus,
    }));
  }

  async submitNotesAnonymes(sessionId: string, correcteurId: string): Promise<number> {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.noteAnonyme.updateMany({
        where: {
          assessmentSessionId: sessionId,
          correcteurId,
          status: 'DRAFT',
        },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      return updated.count;
    });
    return result;
  }

  async replaceCorrectionAssignments(
    sessionId: string,
    assignments: Array<{
      schoolId: string;
      classId: string;
      correcteurUserId: string;
      assignedByUserId: string;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.correctionAssignment.deleteMany({ where: { assessmentSessionId: sessionId } });
      if (assignments.length === 0) return;
      await tx.correctionAssignment.createMany({
        data: assignments.map((a) => ({
          schoolId: a.schoolId,
          assessmentSessionId: sessionId,
          classId: a.classId,
          correcteurUserId: a.correcteurUserId,
          assignedByUserId: a.assignedByUserId,
        })),
      });
    });
  }

  async findCorrectionAssignments(sessionId: string): Promise<CorrectionAssignmentRecord[]> {
    const assignments = await this.prisma.correctionAssignment.findMany({
      where: { assessmentSessionId: sessionId },
    });
    return assignments.map((a) => ({
      id: a.id,
      schoolId: a.schoolId,
      assessmentSessionId: a.assessmentSessionId,
      classId: a.classId,
      correcteurUserId: a.correcteurUserId,
      assignedByUserId: a.assignedByUserId,
      assignedAt: a.assignedAt,
    }));
  }

  async findAssignmentForCorrecteur(sessionId: string, correcteurUserId: string): Promise<CorrectionAssignmentRecord[]> {
    const assignments = await this.prisma.correctionAssignment.findMany({
      where: { assessmentSessionId: sessionId, correcteurUserId },
    });
    return assignments.map((a) => ({
      id: a.id,
      schoolId: a.schoolId,
      assessmentSessionId: a.assessmentSessionId,
      classId: a.classId,
      correcteurUserId: a.correcteurUserId,
      assignedByUserId: a.assignedByUserId,
      assignedAt: a.assignedAt,
    }));
  }
}