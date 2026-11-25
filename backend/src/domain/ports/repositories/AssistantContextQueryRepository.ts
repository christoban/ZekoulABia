/**
 * DOMAIN LAYER — Port de lecture/écriture dédié au contexte de l'assistant IA exécutant
 * (AssistantController).
 *
 * Regroupe toutes les requêtes Prisma que le contrôleur faisait directement (contexte
 * établissement injecté dans le prompt, historique de conversation, logs d'actions,
 * fiches d'aide contextuelle, journal de questions d'aide) — cohérence hexagonale : le
 * contrôleur ne touche plus PrismaClient. Les catalogues d'actions passent également par
 * `ActionContext.data` (`CopilotDataGateway`), hors de portée de ce port de lecture.
 */

export interface SchoolContextDto {
  name: string | null;
  subsystem: string | null;
  educationType: string | null;
  templateCode: string | null;
}

export interface ClassContextDto {
  name: string;
  enrollmentsCount: number;
}

export interface SubjectContextDto {
  name: string;
  coefficient: number;
}

export interface TeacherContextDto {
  firstName: string | null;
  lastName: string | null;
}

export interface PeriodContextDto {
  name: string;
}

export interface HelpArticleContextDto {
  title: string;
  content: string;
  relatedSelectors: unknown;
}

export interface ActionLogDto {
  id: string;
  schoolId: string;
  status: string;
  actionType: string;
  parameters: unknown;
  destructive: boolean;
  undoable: boolean;
  undoData: unknown;
  executedAt: Date;
  resultLabel: string | null;
}

export interface ConversationTurnDto {
  role: string;
  content: string;
}

export interface ConversationTurnCreate {
  conversationId: string;
  schoolId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: unknown;
}

export interface AssistantContextQueryRepository {
  // ── Contexte établissement (prompt système) ──────────────────────────────
  findSchoolContext(schoolId: string): Promise<SchoolContextDto | null>;
  findClassesBySchool(schoolId: string): Promise<ClassContextDto[]>;
  findSubjectsBySchool(schoolId: string): Promise<SubjectContextDto[]>;
  findTeachersBySchool(schoolId: string): Promise<TeacherContextDto[]>;
  findCurrentPeriods(schoolId: string): Promise<PeriodContextDto[]>;

  // ── Fiches d'aide contextuelle (plateforme, scopées écran/langue/rôle) ──
  findHelpArticles(screenKey: string, locale: string, role: string): Promise<HelpArticleContextDto[]>;

  // ── Historique de conversation ────────────────────────────────────────────
  findConversationTurns(conversationId: string, schoolId: string, userId: string, take: number): Promise<ConversationTurnDto[]>;
  createConversationTurn(data: ConversationTurnCreate): Promise<void>;

  // ── Journal des questions d'aide ─────────────────────────────────────────
  createHelpQueryLog(data: {
    schoolId: string;
    userId: string;
    role: string;
    screenKey: string | null;
    question: string;
    responseType: string;
    articleFound: boolean;
  }): Promise<void>;

  // ── Logs d'actions (annulation / confirmation) ───────────────────────────
  findActionLogById(id: string): Promise<ActionLogDto | null>;
  createActionLog(data: {
    schoolId: string;
    userId: string;
    actionType: string;
    parameters: unknown;
    destructive: boolean;
    status: string;
    undoable: boolean;
    undoData?: unknown;
    resultLabel?: string | null;
  }): Promise<{ id: string }>;
  updateActionLog(id: string, data: {
    status?: string;
    resultLabel?: string | null;
    executedAt?: Date;
    undoneAt?: Date;
  }): Promise<void>;
}
