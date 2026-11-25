import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  AssistantContextQueryRepository,
  SchoolContextDto,
  ClassContextDto,
  SubjectContextDto,
  TeacherContextDto,
  PeriodContextDto,
  HelpArticleContextDto,
  ActionLogDto,
  ConversationTurnDto,
  ConversationTurnCreate,
} from '@domain/ports/repositories/AssistantContextQueryRepository';

export class PrismaAssistantContextQueryRepository implements AssistantContextQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSchoolContext(schoolId: string): Promise<SchoolContextDto | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subsystem: true, educationType: true, templateCode: true },
    });
  }

  async findClassesBySchool(schoolId: string): Promise<ClassContextDto[]> {
    const rows = await this.prisma.class.findMany({
      where: { schoolId },
      select: {
        name: true,
        _count: { select: { enrollments: { where: { status: 'ACTIVE', academicYear: { isCurrent: true } } } } },
      },
      orderBy: { name: 'asc' },
      take: 80,
    });
    return rows.map((c) => ({ name: c.name, enrollmentsCount: c._count.enrollments }));
  }

  async findSubjectsBySchool(schoolId: string): Promise<SubjectContextDto[]> {
    return this.prisma.subject.findMany({ where: { schoolId }, select: { name: true, coefficient: true }, orderBy: { name: 'asc' }, take: 100 });
  }

  async findTeachersBySchool(schoolId: string): Promise<TeacherContextDto[]> {
    return this.prisma.user.findMany({ where: { schoolId, role: 'TEACHER' }, select: { firstName: true, lastName: true }, take: 100 });
  }

  async findCurrentPeriods(schoolId: string): Promise<PeriodContextDto[]> {
    return this.prisma.academicPeriod.findMany({ where: { academicYear: { schoolId, isCurrent: true } }, select: { name: true }, orderBy: { orderIndex: 'asc' } });
  }

  async findHelpArticles(screenKey: string, locale: string, role: string): Promise<HelpArticleContextDto[]> {
    const articles = await this.prisma.helpArticle.findMany({
      where: { screenKey, locale, role: { has: role } },
    });
    return articles.map((a) => ({ title: a.title, content: a.content, relatedSelectors: a.relatedSelectors as unknown }));
  }

  async findConversationTurns(conversationId: string, schoolId: string, userId: string, take: number): Promise<ConversationTurnDto[]> {
    const rows = await this.prisma.assistantConversationTurn.findMany({
      where: { conversationId, schoolId, userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((t) => ({ role: t.role, content: t.content }));
  }

  async createConversationTurn(data: ConversationTurnCreate): Promise<void> {
    await this.prisma.assistantConversationTurn.create({
      data: {
        conversationId: data.conversationId,
        schoolId: data.schoolId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        toolCalls: data.toolCalls as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async createHelpQueryLog(data: {
    schoolId: string;
    userId: string;
    role: string;
    screenKey: string | null;
    question: string;
    responseType: string;
    articleFound: boolean;
  }): Promise<void> {
    await this.prisma.assistantHelpQueryLog.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        role: data.role,
        screenKey: data.screenKey ?? undefined,
        question: data.question,
        responseType: data.responseType,
        articleFound: data.articleFound,
      },
    });
  }

  async findActionLogById(id: string): Promise<ActionLogDto | null> {
    return this.prisma.assistantActionLog.findUnique({ where: { id } });
  }

  async createActionLog(data: {
    schoolId: string;
    userId: string;
    actionType: string;
    parameters: unknown;
    destructive: boolean;
    status: string;
    undoable: boolean;
    undoData?: unknown;
    resultLabel?: string | null;
  }): Promise<{ id: string }> {
    const log = await this.prisma.assistantActionLog.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        actionType: data.actionType,
        parameters: data.parameters as Prisma.InputJsonValue,
        destructive: data.destructive,
        status: data.status,
        undoable: data.undoable,
        undoData: data.undoData as Prisma.InputJsonValue | undefined,
        resultLabel: data.resultLabel ?? undefined,
      },
    });
    return { id: log.id };
  }

  async updateActionLog(id: string, data: {
    status?: string;
    resultLabel?: string | null;
    executedAt?: Date;
    undoneAt?: Date;
  }): Promise<void> {
    await this.prisma.assistantActionLog.update({
      where: { id },
      data: {
        status: data.status,
        resultLabel: data.resultLabel,
        executedAt: data.executedAt,
        undoneAt: data.undoneAt,
      },
    });
  }
}
