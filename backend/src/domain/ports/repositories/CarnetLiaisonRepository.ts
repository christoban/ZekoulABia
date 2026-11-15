/**
 * DOMAIN LAYER — Port Repository Carnet de Liaison
 * Carnet de liaison numérique bidirectionnel École ↔ Parents (primaire et niveaux rattachés).
 */
import type { LiaisonCategory } from '@domain/types/enums';

export interface LiaisonReadReceiptItem {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  readAt: Date;
}

export interface LiaisonResponseItem {
  id: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  confirmed: boolean | null;
  replyText: string | null;
  clientRecordedAt: Date | null;
  clockSkewSeconds: number | null;
  createdAt: Date;
}

export interface LiaisonEntryItem {
  id: string;
  schoolId: string;
  academicYearId: string | null;
  studentId: string;
  studentName?: string;
  classId: string | null;
  className?: string | null;
  authorId: string;
  authorRole: string;
  authorName?: string;
  category: LiaisonCategory;
  title: string;
  content: string;
  requiresConfirmation: boolean;
  confirmationPrompt: string | null;
  attendanceId: string | null;
  paymentId: string | null;
  isUrgent: boolean;
  clientRecordedAt: Date | null;
  clockSkewSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
  readReceipts: LiaisonReadReceiptItem[];
  responses: LiaisonResponseItem[];
}

export interface CreateLiaisonEntryInput {
  schoolId: string;
  academicYearId?: string | null;
  studentId: string;
  classId?: string | null;
  authorId: string;
  authorRole: string;
  category: LiaisonCategory;
  title: string;
  content: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string | null;
  attendanceId?: string | null;
  paymentId?: string | null;
  isUrgent?: boolean;
  clientRecordedAt?: Date | null;
  clockSkewSeconds?: number | null;
}

export interface LiaisonFilters {
  academicYearId?: string;
  category?: LiaisonCategory;
  unreadOnlyForUserId?: string;
  limit?: number;
}

export interface ParentRecipientContact {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  accessMode: string;
}

export interface CarnetLiaisonRepository {
  creer(input: CreateLiaisonEntryInput): Promise<LiaisonEntryItem>;
  trouverParId(id: string, schoolId: string): Promise<LiaisonEntryItem | null>;
  trouverParAttendanceId(attendanceId: string, schoolId: string): Promise<LiaisonEntryItem | null>;
  trouverParPaymentId(paymentId: string, schoolId: string): Promise<LiaisonEntryItem | null>;
  listerParEleve(studentId: string, schoolId: string, filtres?: LiaisonFilters): Promise<LiaisonEntryItem[]>;
  listerParEleves(studentIds: string[], schoolId: string, filtres?: LiaisonFilters): Promise<LiaisonEntryItem[]>;
  listerParClasse(classId: string, schoolId: string, filtres?: LiaisonFilters): Promise<LiaisonEntryItem[]>;
  marquerLue(entryId: string, userId: string, schoolId: string): Promise<void>;
  ajouterReponse(data: {
    schoolId: string;
    entryId: string;
    authorId: string;
    confirmed?: boolean | null;
    replyText?: string | null;
    clientRecordedAt?: Date | null;
    clockSkewSeconds?: number | null;
  }): Promise<LiaisonResponseItem>;
  trouverParentsEleve(studentId: string, schoolId: string): Promise<ParentRecipientContact[]>;
  estNiveauPrimaire(schoolId: string, classId?: string | null): Promise<boolean>;
}

