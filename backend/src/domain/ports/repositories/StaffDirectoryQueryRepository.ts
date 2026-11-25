/**
 * DOMAIN LAYER — Port Repository StaffDirectoryQuery
 * Encapsule les requêtes de lecture d'annuaire (utilisateurs, élèves d'une classe,
 * plans de frais, factures) et les mises à jour de fiche établissement/photo officielle.
 */
import type {
  CautionStatus,
  DiscountReasonType,
  FeePlanStatus,
  FeeType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '@domain/types/enums';

export interface ListUsersDirectoryFilter {
  schoolId: string;
  role?: UserRole;
  classId?: string;
  search?: string;
  skip: number;
  take: number;
  includeRoleCounts: boolean;
}

export interface StaffDirectoryUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  studentProfile: {
    id: string;
    dateOfBirth: Date | null;
    gender: string | null;
    photoUrl: string | null;
    matricule: string | null;
    classId: string | null;
    class: { name: string } | null;
  } | null;
  staffProfile: { title: string } | null;
  teacherProfile: {
    teacherSubjects: Array<{
      subjectId: string;
      subject: { name: string };
    }>;
  } | null;
  classesProfessorPrincipal: Array<{ id: string; name: string }>;
}

export interface ListUsersDirectoryResult {
  total: number;
  users: StaffDirectoryUserRecord[];
  roleCounts?: Record<string, number>;
}

export interface ClassDirectorySummary {
  id: string;
  name: string;
  level: string | null;
}

export interface ClassStudentDirectoryUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  studentProfile: {
    id: string;
    matricule: string | null;
    numeroInterne: string | null;
    photoUrl: string | null;
    gender: string | null;
    dateOfBirth: Date | null;
    healthScore: number | null;
    parents: Array<{
      parentProfile: {
        user: {
          id: string;
          firstName: string;
          lastName: string;
          phone: string | null;
          email: string | null;
        };
      };
    }>;
  } | null;
}

export interface StudentForOfficialPhotoRecord {
  id: string;
  firstName: string;
  lastName: string;
  studentProfile: {
    id: string;
    photoUrl: string | null;
  } | null;
}

export interface UpdatedOfficialPhotoResult {
  photoUrl: string | null;
  matricule: string | null;
}

export interface SchoolProfileUpdateInput {
  name?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface SchoolProfileSummary {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  subdomain: string;
}

export interface FeePlanListRecord {
  id: string;
  schoolId: string;
  sectionId: string | null;
  name: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: Date;
  feeType: FeeType;
  level: string | null;
  isRefundable: boolean;
  dueDate: Date | null;
  academicYearId: string | null;
  status: FeePlanStatus;
  _count: { invoices: number };
}

export interface ListInvoicesDirectoryFilter {
  schoolId: string;
  status?: InvoiceStatus;
  feeType?: FeeType;
  skip: number;
  take: number;
}

export interface InvoiceDirectoryRecord {
  id: string;
  schoolId: string;
  studentId: string;
  feePlanId: string | null;
  academicYearId: string | null;
  amount: number;
  grossAmount: number | null;
  discountTotal: number;
  currency: string;
  dueDate: Date | null;
  status: InvoiceStatus;
  description: string | null;
  promisedPaymentDate: Date | null;
  promisedPaymentNote: string | null;
  promisedByUserId: string | null;
  promisedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string };
  feePlan: { id: string; name: string; feeType: FeeType; amount: number } | null;
  payments: Array<{
    id: string;
    amount: number;
    status: PaymentStatus;
    paidAt: Date | null;
    method: PaymentMethod;
    feeType: FeeType;
    cautionStatus: CautionStatus | null;
    refundedAt: Date | null;
    receiptNumber: string | null;
    provisionalReceiptNumber: string | null;
    cancellationReason: string | null;
  }>;
  installments: Array<{
    id: string;
    schoolId: string;
    invoiceId: string;
    trancheNumber: number;
    label: string;
    amount: number;
    paidAmount: number;
    dueDate: Date;
    status: InvoiceStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  discounts: Array<{
    id: string;
    schoolId: string;
    invoiceId: string;
    studentId: string;
    reasonType: DiscountReasonType;
    amount: number;
    percentage: number | null;
    justification: string;
    grantedById: string;
    createdAt: Date;
  }>;
}

export interface ListInvoicesDirectoryResult {
  total: number;
  invoices: InvoiceDirectoryRecord[];
}

export interface StaffDirectoryQueryRepository {
  listUsers(filter: ListUsersDirectoryFilter): Promise<ListUsersDirectoryResult>;
  findClassSummary(classId: string, schoolId: string): Promise<ClassDirectorySummary | null>;
  listClassStudentsDirectory(classId: string, schoolId: string): Promise<ClassStudentDirectoryUserRecord[]>;
  findStudentForOfficialPhoto(studentUserId: string, schoolId: string): Promise<StudentForOfficialPhotoRecord | null>;
  updateStudentOfficialPhoto(studentProfileId: string, photoUrl: string | null): Promise<UpdatedOfficialPhotoResult>;
  logOfficialPhotoUpdate(params: {
    schoolId: string;
    actorUserId: string;
    description: string;
    studentUserId: string;
    hasPhoto: boolean;
  }): Promise<void>;
  updateSchoolProfile(schoolId: string, input: SchoolProfileUpdateInput): Promise<SchoolProfileSummary>;
  listFeePlans(schoolId: string, academicYearId?: string): Promise<FeePlanListRecord[]>;
  getStaffPermissionsByUserId(userId: string): Promise<string[]>;
  listInvoices(filter: ListInvoicesDirectoryFilter): Promise<ListInvoicesDirectoryResult>;
}
