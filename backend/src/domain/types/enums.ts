/**
 * DOMAIN LAYER — Types et énumérations du domaine ZekoulABia
 * Ces types sont indépendants de Prisma et de tout framework.
 */

export type UserRole = 'ADMIN' | 'STAFF' | 'TEACHER' | 'PARENT' | 'STUDENT';
export type MasterUserRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'SCHOOL_MANAGER' | 'SUPPORT';

export type SchoolStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type PlanType = 'DISCOVERY' | 'STANDARD' | 'PREMIUM' | 'ETABLISSEMENT_PLUS';
export type SchoolSubsystem = 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL';
export type EducationType = 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED';
export type SchoolOwnership = 'PUBLIC' | 'PRIVATE_SECULAR' | 'PRIVATE_FAITH';
export type SchoolLevel = 'PRESCHOOL' | 'PRIMARY' | 'SECONDARY' | 'MULTI';

export type GradeValidationStatus = 'DRAFT' | 'LOCKED';
export type BulletinTemplate = 'FR_SECONDARY' | 'EN_SECONDARY' | 'TECHNICAL_FR' | 'PRIMARY' | 'ANNUAL' | 'MONTHLY';
export type ReportCardStatus = 'DRAFT' | 'GENERATED' | 'SENT';
export type BulletinValidationStatus = 'SUBMITTED' | 'VALIDATED' | 'PUBLISHED';
export type AssessmentSessionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Cycle de vie de l'anonymat sur une session d'évaluation */
export type AnonymatStatus =
  | 'NONE' // session non anonymisée
  | 'CODES_GENERES' // codes générés, listes pas encore distribuées
  | 'EQUIPE_DESIGNEE' // équipe désignée, listes envoyées
  | 'ANONYMISATION_EN_COURS'
  | 'ANONYMISATION_TERMINEE' // toutes les listes marquées terminées
  | 'EN_CORRECTION'
  | 'CORRECTION_TERMINEE'
  | 'RECONCILIE';

/** Mode de correction pour une session anonymisée */
export type CorrectionMode =
  | 'OWN_CLASS' // chaque enseignant corrige sa classe
  | 'CROSSED'; // correction croisée (même matière, brassage)

/** Canal d'accès à la liste d'anonymisation */
export type AnonymatTeamMemberStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'EXPIRED';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'ABSENT_JUSTIFIED';
export type AttendancePeriod = 'MORNING' | 'AFTERNOON';

export type DisciplineType = 'WARNING_ORAL' | 'WARNING_WRITTEN' | 'TEMP_EXCLUSION' | 'COUNCIL_DECISION' | 'PERMANENT_EXCLUSION';
export type PebsFiliere = 'FR_PEBS' | 'EN_PEBS';
export type CouncilStatus = 'OPEN' | 'VALIDATED' | 'LOCKED';
export type CouncilDecision = 'PASS' | 'REPEAT' | 'DELIBERATION';

export type StudentStatus = 'ACTIVE' | 'GRADUATED' | 'LEFT' | 'TRANSFERRED';
export type SubjectType = 'THEORETICAL' | 'PRACTICAL' | 'MIXED';
export type GradingSystem = 'OUT_OF_20' | 'OUT_OF_100';
export type SectionLanguage = 'FR' | 'EN';

export type FeeType = 'TUITION' | 'APEE_PTA' | 'EXAM' | 'UNIFORM' | 'CAUTION' | 'WORKSHOP' | 'INSCRIPTION' | 'DEVELOPMENT_LEVY' | 'SPORTS_LEVY';
export type FeePlanStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'APPROVED' | 'PUBLISHED';
export type PaymentMethod = 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK_TRANSFER' | 'EXPRESS_UNION';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type InvoiceStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type CautionStatus = 'HELD' | 'REFUNDED' | 'PERMANENTLY_HELD';

export type StaffPermissionType =
  | 'MANAGE_TIMETABLE' | 'VALIDATE_GRADES' | 'MANAGE_EXAMS'
  | 'SUPERVISE_TEACHERS' | 'MANAGE_ATTENDANCE' | 'MANAGE_DISCIPLINE'
  | 'MANAGE_INCIDENTS' | 'MANAGE_FINANCE' | 'VALIDATE_PAYMENTS'
  | 'GENERATE_REPORTS' | 'MANAGE_ATELIERS' | 'MANAGE_PRACTICAL_GRADES'
  | 'MANAGE_INTERNSHIPS' | 'MANAGE_STAGE_CONVENTIONS' | 'MANAGE_WORKSHOP_STOCK'
  | 'VIEW_DEPARTMENT_GRADES' | 'SUPERVISE_DEPARTMENT_TEACHERS'
  | 'VALIDATE_DEPARTMENT_TIMETABLE' | 'GENERATE_DEPARTMENT_REPORTS'
  | 'VIEW_SUPERVISED_GRADES' | 'SUPERVISE_LESSON_PLANS'
  | 'GENERATE_PEDAGOGICAL_REPORTS' | 'MANAGE_CE_REPORTS' | 'MANAGE_PEDAGOGICAL_BRIEF'
  | 'MANAGE_CLASS_COUNCIL' | 'MANAGE_CATCHUP_REQUESTS'
  | 'MANAGE_PATRIMOINE' | 'MANAGE_DEGRADATIONS'
  | 'MANAGE_LIBRARY' | 'MANAGE_ORIENTATION' | 'MANAGE_ENROLLMENT'
  | 'MANAGE_ANONYMAT'
  | 'MANAGE_CLASSES'
  | 'MANAGE_STUDENT_ASSIGNMENTS'
  | 'MANAGE_TEACHING_ASSIGNMENTS';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'REJECTED';
export type TimetableStatus = 'DRAFT' | 'PUBLISHED';
export type SlotKind = 'CLASS' | 'BREAK' | 'ACTIVITY' | 'TD';
export type RoomType = 'NORMAL' | 'LABORATORY' | 'WORKSHOP' | 'COMPUTER_LAB' | 'FIELD';
/** MAINTENANCE/INACTIVE = salle hors service — indisponible pour toute proposition de créneau, distinct d'un conflit ponctuel de créneau. */
export type RoomStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type AcademicYearStatus = 'ACTIVE' | 'ARCHIVED';
/** DRAFT = classe proposée pour l'année suivante, en attente de revue admin (jamais visible des utilisateurs normaux). */
export type ClassStatus = 'DRAFT' | 'ACTIVE';
export type PeriodType = 'TRIMESTER' | 'TERM';
export type SequenceType = 'DS' | 'COMPOSITION' | 'CLASS_TEST' | 'TERMINAL_EXAM';
export type InviteStatus = 'PENDING' | 'USED' | 'EXPIRED';

export type NotificationType =
  | 'ABSENCE_ALERT'
  | 'GRADE_AVAILABLE'
  | 'BULLETIN_AVAILABLE'
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'COUNCIL_DECISION'
  | 'LIBRARY_OVERDUE'
  | 'DISCIPLINE_SANCTION'
  | 'COMMUNICATION'
  | 'STUDENT_RISK_ALERT'
  | 'FEE_PLAN_CREATED'
  | 'ACADEMIC_EVENT'
  | 'SYSTEM';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

export type NotificationUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TypeExamen = 'BEPC' | 'PROBATOIRE' | 'BAC' | 'GCE_OL' | 'GCE_AL' | 'CAP' | 'BT';
export type TypeFraisMinesec = 'SCOLARITE_PREMIER_CYCLE' | 'SCOLARITE_SECOND_CYCLE' | 'EXAMEN_BEPC' | 'EXAMEN_PROBATOIRE' | 'EXAMEN_BAC' | 'EXAMEN_GCE_OL' | 'EXAMEN_GCE_AL';

export type OnboardingRecipient = 'ELEVE' | 'PARENT' | 'LES_DEUX';
export type OnboardingSource = 'IMPORT_MASSE' | 'AUTOSERVICE' | 'CONCOURS' | 'GROUPE_TRANSFERT';
export type OnboardingStatus =
  | 'DRAFT' | 'LINK_SENT' | 'SUBMITTED' | 'PENDING_VALIDATION'
  | 'VALIDATED' | 'ACTIVATED' | 'REJECTED' | 'EXPIRED';

export type TemplateMeta = {
  isAnglophone: boolean;
  isPrimaire: boolean;
  isTechnique: boolean;
  langMode: 'anglophone' | 'francophone' | 'bilingual';
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
