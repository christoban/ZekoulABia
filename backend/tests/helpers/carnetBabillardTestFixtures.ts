import type { NextFunction, Request } from 'express';
import type { AuthPayload } from '@infrastructure/http/middlewares/auth';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type {
  CarnetLiaisonRepository,
  CreateLiaisonEntryInput,
  LiaisonEntryItem,
  LiaisonFilters,
  LiaisonResponseItem,
} from '@domain/ports/repositories/CarnetLiaisonRepository';

export interface MockResState {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResState;
  json: (data: unknown) => MockResState;
}

export function makeRes(): MockResState {
  const res: MockResState = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res;
}

export function makeReq(
  user: AuthPayload,
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  query: Record<string, string> = {},
): Request {
  return { user, body, params, query } as unknown as Request;
}

export const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

export const AUDIT_STUB: AIActionAuditPort = { journaliser: () => {} };

export class InMemoryCarnetRepo implements CarnetLiaisonRepository {
  public entries: LiaisonEntryItem[] = [];
  public parentMap = new Map<
    string,
    { userId: string; firstName: string; lastName: string; phone: string | null; accessMode: string }[]
  >();

  async creer(input: CreateLiaisonEntryInput): Promise<LiaisonEntryItem> {
    const now = new Date();
    const item: LiaisonEntryItem = {
      id: `carnet-${this.entries.length + 1}`,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId ?? null,
      studentId: input.studentId,
      studentName: input.studentId,
      classId: input.classId ?? null,
      className: 'CM2',
      authorId: input.authorId,
      authorRole: input.authorRole,
      authorName: input.authorId,
      category: input.category,
      title: input.title,
      content: input.content,
      requiresConfirmation: input.requiresConfirmation ?? false,
      confirmationPrompt: input.confirmationPrompt ?? null,
      attendanceId: input.attendanceId ?? null,
      paymentId: input.paymentId ?? null,
      isUrgent: input.isUrgent ?? false,
      clientRecordedAt: input.clientRecordedAt ?? null,
      clockSkewSeconds: input.clockSkewSeconds ?? null,
      createdAt: now,
      updatedAt: now,
      readReceipts: [],
      responses: [],
    };
    this.entries.push(item);
    return item;
  }

  async trouverParId(id: string, schoolId: string): Promise<LiaisonEntryItem | null> {
    return this.entries.find((e) => e.id === id && e.schoolId === schoolId) ?? null;
  }

  async trouverParAttendanceId(attendanceId: string, schoolId: string): Promise<LiaisonEntryItem | null> {
    return this.entries.find((e) => e.attendanceId === attendanceId && e.schoolId === schoolId) ?? null;
  }

  async trouverParPaymentId(paymentId: string, schoolId: string): Promise<LiaisonEntryItem | null> {
    return this.entries.find((e) => e.paymentId === paymentId && e.schoolId === schoolId) ?? null;
  }

  async listerParEleve(studentId: string, schoolId: string, filtres?: LiaisonFilters): Promise<LiaisonEntryItem[]> {
    return this.entries.filter(
      (e) => e.schoolId === schoolId && e.studentId === studentId && (!filtres?.category || e.category === filtres.category),
    );
  }

  async listerParEleves(studentIds: string[], schoolId: string, filtres?: LiaisonFilters): Promise<LiaisonEntryItem[]> {
    return this.entries.filter(
      (e) =>
        e.schoolId === schoolId &&
        studentIds.includes(e.studentId) &&
        (!filtres?.category || e.category === filtres.category),
    );
  }

  async listerParClasse(classId: string, schoolId: string, filtres?: LiaisonFilters): Promise<LiaisonEntryItem[]> {
    return this.entries.filter(
      (e) => e.schoolId === schoolId && e.classId === classId && (!filtres?.category || e.category === filtres.category),
    );
  }

  async marquerLue(entryId: string, userId: string, schoolId: string): Promise<void> {
    const entry = await this.trouverParId(entryId, schoolId);
    if (!entry) return;
    if (!entry.readReceipts.some((r) => r.userId === userId)) {
      entry.readReceipts.push({ id: `rr-${userId}`, userId, readAt: new Date() });
    }
  }

  async ajouterReponse(data: {
    schoolId: string;
    entryId: string;
    authorId: string;
    confirmed?: boolean | null;
    replyText?: string | null;
    clientRecordedAt?: Date | null;
    clockSkewSeconds?: number | null;
  }): Promise<LiaisonResponseItem> {
    const entry = await this.trouverParId(data.entryId, data.schoolId);
    const resp: LiaisonResponseItem = {
      id: `resp-${Date.now()}`,
      authorId: data.authorId,
      confirmed: data.confirmed ?? null,
      replyText: data.replyText ?? null,
      clientRecordedAt: data.clientRecordedAt ?? null,
      clockSkewSeconds: data.clockSkewSeconds ?? null,
      createdAt: new Date(),
    };
    entry?.responses.push(resp);
    return resp;
  }

  async trouverParentsEleve(
    studentId: string,
  ): Promise<{ userId: string; firstName: string; lastName: string; phone: string | null; accessMode: string }[]> {
    return this.parentMap.get(studentId) ?? [];
  }

  async estNiveauPrimaire(): Promise<boolean> {
    return true;
  }
}

