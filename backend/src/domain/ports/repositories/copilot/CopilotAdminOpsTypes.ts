/**
 * DOMAIN LAYER — Types DTO pour la passerelle opérations Admin du copilot.
 */
import type { PebsFiliere, RoomStatus, RoomType } from '@domain/types/enums';

export interface CopilotClassDeletionImpact {
  activeEnrollments: number;
  grades: number;
}

export interface CopilotSubjectSnapshot {
  name: string;
  coefficient: number;
  hoursPerWeek: number;
}

export interface CopilotRoomSnapshot {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  equipment: string[];
  status: RoomStatus;
}

export interface CopilotRoomRestoreData {
  name: string;
  type: RoomType;
  capacity: number;
  equipment: string[];
  status: RoomStatus;
}

export interface CopilotClassPrincipalName {
  firstName: string | null;
  lastName: string | null;
}

export interface CopilotClassRoomAssignmentRef {
  classId: string;
  roomId: string;
}

export interface CopilotUnpaidStudentInvoice {
  id: string;
  amount: number;
  feePlanName: string | null;
}

export interface CopilotUnpaidInvoiceBalance {
  amount: number;
  paidAmount: number;
}

export interface CopilotUnjustifiedAbsenceRecord {
  id: string;
  date: Date;
}

export interface CopilotAbsenceStudentRow {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
}

export interface CopilotTeacherDiplomaRow {
  firstName: string | null;
  lastName: string | null;
  diplomes: unknown;
}

export interface CopilotSchoolRiskThresholds {
  aiRiskThreshold: number;
  aiRiskThresholdCritical: number;
}

export interface CopilotAtRiskStudentRow {
  healthScore: number | null;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
}

export interface CopilotStudentRecommendationRow {
  content: string;
  contextType: string;
  createdAt: Date;
}

export interface CopilotStudentLv2Row {
  userId: string;
  lv2SubjectId: string | null;
}

export interface CopilotStudentPebsRow {
  userId: string;
  pebsFiliere: PebsFiliere | null;
}

export interface CopilotStudentNameRow {
  firstName: string | null;
  lastName: string | null;
}

export interface CopilotCepPendingCandidate {
  firstName: string;
  lastName: string;
  sessionName: string;
}

export interface CopilotUserIdentitySnapshot {
  firstName: string;
  lastName: string;
  phone: string | null;
}
