-- CreateEnum
CREATE TYPE "MasterUserRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SCHOOL_MANAGER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT');

-- CreateEnum
CREATE TYPE "SectionLanguage" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "StaffPermissionType" AS ENUM ('MANAGE_TIMETABLE', 'VALIDATE_GRADES', 'MANAGE_EXAMS', 'SUPERVISE_TEACHERS', 'MANAGE_ATTENDANCE', 'MANAGE_DISCIPLINE', 'MANAGE_INCIDENTS', 'MANAGE_FINANCE', 'VALIDATE_PAYMENTS', 'GENERATE_REPORTS', 'MANAGE_ATELIERS', 'MANAGE_PRACTICAL_GRADES', 'MANAGE_INTERNSHIPS', 'MANAGE_STAGE_CONVENTIONS', 'MANAGE_WORKSHOP_STOCK', 'VIEW_DEPARTMENT_GRADES', 'SUPERVISE_DEPARTMENT_TEACHERS', 'VALIDATE_DEPARTMENT_TIMETABLE', 'GENERATE_DEPARTMENT_REPORTS', 'VIEW_SUPERVISED_GRADES', 'SUPERVISE_LESSON_PLANS', 'GENERATE_PEDAGOGICAL_REPORTS', 'MANAGE_CE_REPORTS', 'MANAGE_PEDAGOGICAL_BRIEF', 'MANAGE_CLASS_COUNCIL', 'MANAGE_CATCHUP_REQUESTS', 'MANAGE_PATRIMOINE', 'MANAGE_DEGRADATIONS', 'MANAGE_LIBRARY', 'MANAGE_ORIENTATION');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('TRIMESTER', 'TERM');

-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('DS', 'COMPOSITION', 'CLASS_TEST', 'TERMINAL_EXAM');

-- CreateEnum
CREATE TYPE "GradeValidationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATED', 'LOCKED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('TUITION', 'APEE_PTA', 'EXAM', 'UNIFORM', 'CAUTION', 'WORKSHOP', 'INSCRIPTION', 'DEVELOPMENT_LEVY', 'SPORTS_LEVY');

-- CreateEnum
CREATE TYPE "CautionStatus" AS ENUM ('HELD', 'REFUNDED', 'PERMANENTLY_HELD');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ACADEMIC', 'ATTENDANCE', 'COMMUNICATION', 'FINANCIAL', 'AI_ALERT', 'POSITIVE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'SMS', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "DisciplineType" AS ENUM ('WARNING_ORAL', 'WARNING_WRITTEN', 'TEMP_EXCLUSION', 'COUNCIL_DECISION', 'PERMANENT_EXCLUSION');

-- CreateEnum
CREATE TYPE "DisciplineStatus" AS ENUM ('ACTIVE', 'LIFTED', 'APPEALED');

-- CreateEnum
CREATE TYPE "CouncilStatus" AS ENUM ('OPEN', 'VALIDATED', 'LOCKED');

-- CreateEnum
CREATE TYPE "CouncilDecision" AS ENUM ('PASS', 'REPEAT', 'DELIBERATION');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PRESCHOOL', 'PRIMARY', 'SECONDARY', 'MULTI');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('DISCOVERY', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "TimetableStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SlotKind" AS ENUM ('CLASS', 'BREAK', 'ACTIVITY', 'TD');

-- CreateEnum
CREATE TYPE "AttendancePeriod" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MTN_MOMO', 'ORANGE_MONEY', 'BANK_TRANSFER', 'EXPRESS_UNION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('PRIVATE', 'CLASS_CHANNEL', 'PARENT_CHANNEL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SchoolSubsystem" AS ENUM ('FRANCOPHONE', 'ANGLOPHONE', 'BILINGUAL');

-- CreateEnum
CREATE TYPE "EducationType" AS ENUM ('GENERAL', 'TECHNICAL', 'PROFESSIONAL', 'MIXED');

-- CreateEnum
CREATE TYPE "SchoolOwnership" AS ENUM ('PUBLIC', 'PRIVATE_SECULAR', 'PRIVATE_FAITH');

-- CreateEnum
CREATE TYPE "GradingSystem" AS ENUM ('OUT_OF_20', 'OUT_OF_100');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('PRESCHOOL', 'PRIMARY', 'SECONDARY', 'MULTI');

-- CreateEnum
CREATE TYPE "BulletinTemplate" AS ENUM ('FR_SECONDARY', 'EN_SECONDARY', 'TECHNICAL_FR', 'PRIMARY', 'ANNUAL', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('THEORETICAL', 'PRACTICAL', 'MIXED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'LEFT', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "OrientationStatus" AS ENUM ('OUVERTE', 'EN_COURS', 'CLOSE', 'TRANSFEREE');

-- CreateEnum
CREATE TYPE "NiveauRisque" AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "TypePreoccupation" AS ENUM ('SCOLAIRE', 'COMPORTEMENTAL', 'FAMILIAL', 'PROFESSIONNEL', 'SANTE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeEntretien" AS ENUM ('INDIVIDUEL', 'GROUPE', 'AVEC_PARENT');

-- CreateEnum
CREATE TYPE "MotifEntretien" AS ENUM ('ORIENTATION_GENERALE', 'DIFFICULTE_SCOLAIRE', 'CHOIX_FILIERE_BAC', 'PROJET_PROFESSIONNEL', 'PROBLEME_COMPORTEMENT', 'DEMANDE_ELEVE', 'DEMANDE_PARENT', 'DEMANDE_ENSEIGNANT');

-- CreateEnum
CREATE TYPE "StatutEntretien" AS ENUM ('PLANIFIE', 'REALISE', 'ANNULE', 'REPORTE');

-- CreateEnum
CREATE TYPE "TypeTest" AS ENUM ('COGNITIF', 'INTERETS_PROFESSIONNELS', 'PERSONNALITE', 'PSYCHOTECHNIQUE');

-- CreateEnum
CREATE TYPE "StatutRecommandation" AS ENUM ('PROPOSEE', 'VALIDEE_ADMIN', 'ACCEPTEE_PARENT', 'REFUSEE_PARENT', 'TRANSMISE_DRES');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE');

-- CreateTable
CREATE TABLE "MasterUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "MasterUserRole" NOT NULL DEFAULT 'SUPPORT',
    "assignedSchoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaTempSecret" TEXT,
    "mfaRecoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mfaRecoveryCodeGeneratedAt" TIMESTAMP(3),
    "loginEmailOtpHash" TEXT,
    "loginEmailOtpExpiresAt" TIMESTAMP(3),
    "loginEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "loginEmailOtpSentAt" TIMESTAMP(3),
    "passwordChangeEmailOtpHash" TEXT,
    "passwordChangeEmailOtpExpiresAt" TIMESTAMP(3),
    "passwordChangeEmailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordChangeEmailOtpSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "type" "SchoolType" NOT NULL DEFAULT 'SECONDARY',
    "plan" "PlanType" NOT NULL DEFAULT 'DISCOVERY',
    "status" "SchoolStatus" NOT NULL DEFAULT 'PENDING',
    "city" TEXT,
    "region" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "subsystem" "SchoolSubsystem" NOT NULL DEFAULT 'FRANCOPHONE',
    "educationType" "EducationType" NOT NULL DEFAULT 'GENERAL',
    "ownership" "SchoolOwnership" NOT NULL DEFAULT 'PRIVATE_SECULAR',
    "features" JSONB NOT NULL DEFAULT '{}',
    "saturdaySchedule" BOOLEAN NOT NULL DEFAULT true,
    "contractEnd" TIMESTAMP(3),
    "hasPEBSFrancophone" BOOLEAN NOT NULL DEFAULT false,
    "hasPEBSAnglophone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateCode" TEXT,
    "onboardingConfig" JSONB,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'DISCOVERY',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT,
    "invitedByMasterId" TEXT,
    "notes" TEXT,

    CONSTRAINT "SchoolInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ds1Weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ds2Weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "compositionWeight" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "classTestWeight" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "terminalExamWeight" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "moderatorUserId" TEXT,
    "aiRiskThreshold" INTEGER NOT NULL DEFAULT 50,
    "bulletinTemplate" "BulletinTemplate" NOT NULL DEFAULT 'FR_SECONDARY',
    "gradesPerTerm" INTEGER NOT NULL DEFAULT 2,
    "sequenceCalculationMode" TEXT NOT NULL DEFAULT 'single',
    "legalMaxContributionFirstCycle" INTEGER NOT NULL DEFAULT 7500,
    "legalMaxContributionSecondCycle" INTEGER NOT NULL DEFAULT 10000,
    "termsPerYear" INTEGER NOT NULL DEFAULT 3,
    "maxAbsences" INTEGER NOT NULL DEFAULT 10,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "offlineModeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "messageModeration" BOOLEAN NOT NULL DEFAULT false,
    "schoolLanguageMode" TEXT NOT NULL DEFAULT 'francophone',
    "attendanceLateAsAbsence" BOOLEAN NOT NULL DEFAULT false,
    "bulletinBlockOnUnpaidFees" BOOLEAN NOT NULL DEFAULT false,
    "councilPassMark" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "passMark" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUpper" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireDigit" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeoutMin" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "absenceAlertThreshold" INTEGER NOT NULL DEFAULT 3,
    "christmasBreakEnd" TIMESTAMP(3),
    "christmasBreakStart" TIMESTAMP(3),
    "easterBreakEnd" TIMESTAMP(3),
    "easterBreakStart" TIMESTAMP(3),
    "schoolYearStartDate" TIMESTAMP(3),
    "yearEndDate" TIMESTAMP(3),

    CONSTRAINT "SchoolConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Douala',
    "locale" TEXT NOT NULL DEFAULT 'fr-CM',
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolNotificationSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "smsAbsences" BOOLEAN NOT NULL DEFAULT true,
    "smsPayments" BOOLEAN NOT NULL DEFAULT true,
    "smsBulletins" BOOLEAN NOT NULL DEFAULT true,
    "emailDigestAdmin" BOOLEAN NOT NULL DEFAULT false,
    "smsLowBalance" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SchoolNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolConfigurationForm" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "formData" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolConfigurationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeFormula" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "sectionId" TEXT,
    "label" TEXT NOT NULL,
    "evaluations" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentionRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "sectionId" TEXT,
    "rules" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MentionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matricule" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "classId" TEXT,
    "exitYear" TEXT,
    "studentStatus" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "healthScore" INTEGER DEFAULT 75,
    "pebsFiliere" TEXT,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialization" TEXT[],
    "supervisedSubjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudent" (
    "parentProfileId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("parentProfileId","studentProfileId")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "SectionLanguage" NOT NULL,
    "gradingSystem" "GradingSystem" NOT NULL DEFAULT 'OUT_OF_20',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passmark" DOUBLE PRECISION NOT NULL DEFAULT 10,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sectionId" TEXT,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPermission" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "permission" "StaffPermissionType" NOT NULL,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectCoefficient" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classLevel" TEXT NOT NULL,
    "serieCode" TEXT,
    "coefficient" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SubjectCoefficient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacCoefficient" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "niveau" TEXT NOT NULL DEFAULT 'TERMINALE',
    "coefficient" DOUBLE PRECISION NOT NULL,
    "groupe" INTEGER NOT NULL DEFAULT 1,
    "templateCode" TEXT NOT NULL DEFAULT '__ALL__',
    "source" TEXT NOT NULL DEFAULT 'Arrêté N° 92/22 MINESEC du 17 Mars 2022',
    "isOfficialMinesec" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BacCoefficient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subsystem" "SchoolSubsystem" NOT NULL,
    "educationType" "EducationType" NOT NULL,
    "level" "SchoolLevel" NOT NULL,
    "ownership" "SchoolOwnership" NOT NULL DEFAULT 'PRIVATE_SECULAR',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleCoefficient" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "classLevel" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL,
    "weeklyPeriods" INTEGER,
    "filiere" TEXT NOT NULL DEFAULT 'FR_GENERAL',

    CONSTRAINT "CycleCoefficient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnglophoneSubjectLoad" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "classLevel" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL,
    "weeklyPeriods" INTEGER,
    "filiere" TEXT NOT NULL DEFAULT 'EN_GENERAL',

    CONSTRAINT "AnglophoneSubjectLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OLevelSubject" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,

    CONSTRAINT "OLevelSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ALevelSubject" (
    "id" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,

    CONSTRAINT "ALevelSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnglophoneStreamCombination" (
    "id" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "coreSubjects" JSONB NOT NULL,
    "electiveGroup" JSONB,
    "description" TEXT,

    CONSTRAINT "AnglophoneStreamCombination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OLevelGrade" (
    "id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "description" TEXT,

    CONSTRAINT "OLevelGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ALevelGrade" (
    "id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "description" TEXT,

    CONSTRAINT "ALevelGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicPeriod" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PeriodType" NOT NULL DEFAULT 'TRIMESTER',
    "orderIndex" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSequence" (
    "id" TEXT NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SequenceType" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "sectionId" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filiere" TEXT,
    "serie" TEXT,
    "professorPrincipalId" TEXT,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'THEORETICAL',

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubject" (
    "teacherProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("teacherProfileId","subjectId")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicPeriodId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "period" "AttendancePeriod" NOT NULL DEFAULT 'MORNING',
    "recordedById" TEXT,
    "subjectId" TEXT,
    "teacherId" TEXT,
    "isOfflineSync" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "sequenceScore" DOUBLE PRECISION,
    "classTestScore" DOUBLE PRECISION,
    "terminalExamScore" DOUBLE PRECISION,
    "theoreticalScore" DOUBLE PRECISION,
    "practicalScore" DOUBLE PRECISION,
    "professionalAttitude" DOUBLE PRECISION,
    "oralScore" DOUBLE PRECISION,
    "selfDevelopmentScore" DOUBLE PRECISION,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "maxValue" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "sequenceAverage" DOUBLE PRECISION,
    "validationStatus" "GradeValidationStatus" NOT NULL DEFAULT 'DRAFT',
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "isOfflineSync" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCard" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "generalAverage" DOUBLE PRECISION,
    "rank" INTEGER,
    "rankTrimestre1" INTEGER,
    "rankTrimestre2" INTEGER,
    "rankTrimestre3" INTEGER,
    "mention" TEXT,
    "isGenerated" BOOLEAN NOT NULL DEFAULT false,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absenceCount" INTEGER NOT NULL DEFAULT 0,
    "academicPeriodId" TEXT NOT NULL,
    "aiComment" TEXT,
    "classMasterComment" TEXT,
    "conductGrade" TEXT,
    "template" "BulletinTemplate" NOT NULL DEFAULT 'FR_SECONDARY',
    "totalStudents" INTEGER,
    "validationStatus" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
    "sectionId" TEXT,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardSubjectLine" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "seq1Score" DOUBLE PRECISION,
    "seq2Score" DOUBLE PRECISION,
    "compositionScore" DOUBLE PRECISION,
    "seq3Score" DOUBLE PRECISION,
    "seq4Score" DOUBLE PRECISION,
    "seq5Score" DOUBLE PRECISION,
    "seq6Score" DOUBLE PRECISION,
    "classTestScore" DOUBLE PRECISION,
    "terminalExamScore" DOUBLE PRECISION,
    "theoreticalScore" DOUBLE PRECISION,
    "practicalScore" DOUBLE PRECISION,
    "professionalAttitude" DOUBLE PRECISION,
    "oralScore" DOUBLE PRECISION,
    "selfDevelopmentScore" DOUBLE PRECISION,
    "subjectAverage" DOUBLE PRECISION,
    "weightedScore" DOUBLE PRECISION,
    "subjectRank" INTEGER,
    "teacherComment" TEXT,
    "competenceLabel" TEXT,

    CONSTRAINT "ReportCardSubjectLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "duration" INTEGER,
    "content" JSONB,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "answers" JSONB,
    "score" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "status" "TimetableStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableGridConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "dureePeriode" INTEGER NOT NULL,
    "periodesAvantP1" INTEGER NOT NULL,
    "dureePetitePause" INTEGER NOT NULL,
    "periodesAvantP2" INTEGER NOT NULL,
    "dureeGrandePause" INTEGER NOT NULL,
    "periodesApresP2" INTEGER NOT NULL,
    "joursActifs" TEXT[],

    CONSTRAINT "TimetableGridConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "subjectId" TEXT,
    "teacherId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "kind" "SlotKind" NOT NULL DEFAULT 'CLASS',
    "subGroupId" TEXT,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeType" "FeeType" NOT NULL DEFAULT 'TUITION',
    "level" TEXT,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "FeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feePlanId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "studentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "feeType" "FeeType" NOT NULL DEFAULT 'TUITION',
    "cautionStatus" "CautionStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refundTransactionId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundedById" TEXT,
    "campayRef" TEXT,
    "campayStatus" TEXT,
    "operatorRef" TEXT,
    "phoneNumber" TEXT,
    "webhookData" JSONB,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "category" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'PRIVATE',
    "name" TEXT,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "moderatedById" TEXT,
    "moderationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReadStatus" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReadStatus_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "channel" "NotificationChannel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "aiAlerts" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DisciplineType" NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "DisciplineStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassCouncilSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "presidedById" TEXT NOT NULL,
    "status" "CouncilStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "ClassCouncilSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassCouncilDecision" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "decision" "CouncilDecision" NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassCouncilDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPromotion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "toClassId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,

    CONSTRAINT "ClassPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPromotion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "toClassId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "promotedById" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineQueue" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityData" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "OfflineQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSubGroup" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ClassSubGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubGroupAssignment" (
    "studentProfileId" TEXT NOT NULL,
    "subGroupId" TEXT NOT NULL,

    CONSTRAINT "StudentSubGroupAssignment_pkey" PRIMARY KEY ("studentProfileId","subGroupId")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetRoles" "UserRole"[],
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "type" TEXT NOT NULL DEFAULT '',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitiesLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitiesLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterAuthAudit" (
    "id" TEXT NOT NULL,
    "masterUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "description" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterAuthAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FicheOrientation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "conseillerId" TEXT NOT NULL,
    "status" "OrientationStatus" NOT NULL DEFAULT 'OUVERTE',
    "riskLevel" "NiveauRisque" NOT NULL DEFAULT 'FAIBLE',
    "mainConcern" "TypePreoccupation",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FicheOrientation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntretienOrientation" (
    "id" TEXT NOT NULL,
    "ficheOrientationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "TypeEntretien" NOT NULL,
    "motif" "MotifEntretien" NOT NULL,
    "notes" TEXT,
    "recommendations" TEXT,
    "nextActions" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "status" "StatutEntretien" NOT NULL DEFAULT 'PLANIFIE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntretienOrientation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAptitude" (
    "id" TEXT NOT NULL,
    "ficheOrientationId" TEXT NOT NULL,
    "type" "TypeTest" NOT NULL,
    "datePassage" TIMESTAMP(3) NOT NULL,
    "resultats" TEXT NOT NULL,
    "interpretation" TEXT,
    "scoreGlobal" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestAptitude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommandationSerie" (
    "id" TEXT NOT NULL,
    "ficheOrientationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "serieActuelle" TEXT NOT NULL,
    "serieRecommandee" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "adminValidated" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatutRecommandation" NOT NULL DEFAULT 'PROPOSEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommandationSerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviOrientation" (
    "id" TEXT NOT NULL,
    "ficheOrientationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskLevel" "NiveauRisque" NOT NULL,
    "mainConcern" "TypePreoccupation" NOT NULL,
    "interventions" TEXT,
    "prochainRdv" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "SuiviOrientation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "available" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookLoan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "BookLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterUser_email_key" ON "MasterUser"("email");

-- CreateIndex
CREATE INDEX "MasterUser_loginEmailOtpExpiresAt_idx" ON "MasterUser"("loginEmailOtpExpiresAt");

-- CreateIndex
CREATE INDEX "MasterUser_passwordChangeEmailOtpExpiresAt_idx" ON "MasterUser"("passwordChangeEmailOtpExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "School_subdomain_key" ON "School"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolInvite_token_key" ON "SchoolInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolConfig_schoolId_key" ON "SchoolConfig"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSettings_schoolId_key" ON "SchoolSettings"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolNotificationSettings_schoolId_key" ON "SchoolNotificationSettings"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolConfigurationForm_schoolId_key" ON "SchoolConfigurationForm"("schoolId");

-- CreateIndex
CREATE INDEX "GradeFormula_schoolId_idx" ON "GradeFormula"("schoolId");

-- CreateIndex
CREATE INDEX "MentionRule_schoolId_idx" ON "MentionRule"("schoolId");

-- CreateIndex
CREATE INDEX "User_schoolId_role_idx" ON "User"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_email_key" ON "User"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_phone_key" ON "User"("schoolId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_schoolId_code_key" ON "Section"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_schoolId_idx" ON "StaffProfile"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermission_staffProfileId_permission_key" ON "StaffPermission"("staffProfileId", "permission");

-- CreateIndex
CREATE INDEX "SubjectCoefficient_schoolId_idx" ON "SubjectCoefficient"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCoefficient_schoolId_subjectId_classLevel_serieCode_key" ON "SubjectCoefficient"("schoolId", "subjectId", "classLevel", "serieCode");

-- CreateIndex
CREATE UNIQUE INDEX "BacCoefficient_subjectName_serie_niveau_templateCode_key" ON "BacCoefficient"("subjectName", "serie", "niveau", "templateCode");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTemplate_code_key" ON "SchoolTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CycleCoefficient_templateCode_classLevel_subjectName_filier_key" ON "CycleCoefficient"("templateCode", "classLevel", "subjectName", "filiere");

-- CreateIndex
CREATE UNIQUE INDEX "AnglophoneSubjectLoad_templateCode_classLevel_subjectName_f_key" ON "AnglophoneSubjectLoad"("templateCode", "classLevel", "subjectName", "filiere");

-- CreateIndex
CREATE UNIQUE INDEX "OLevelSubject_subjectName_key" ON "OLevelSubject"("subjectName");

-- CreateIndex
CREATE UNIQUE INDEX "ALevelSubject_subjectName_key" ON "ALevelSubject"("subjectName");

-- CreateIndex
CREATE UNIQUE INDEX "AnglophoneStreamCombination_filiere_key" ON "AnglophoneStreamCombination"("filiere");

-- CreateIndex
CREATE UNIQUE INDEX "OLevelGrade_grade_key" ON "OLevelGrade"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "ALevelGrade_grade_key" ON "ALevelGrade"("grade");

-- CreateIndex
CREATE INDEX "AcademicYear_schoolId_idx" ON "AcademicYear"("schoolId");

-- CreateIndex
CREATE INDEX "AcademicSequence_schoolId_idx" ON "AcademicSequence"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSequence_academicPeriodId_orderIndex_key" ON "AcademicSequence"("academicPeriodId", "orderIndex");

-- CreateIndex
CREATE INDEX "Class_schoolId_idx" ON "Class"("schoolId");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_schoolId_idx" ON "TeachingAssignment"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_classId_subjectId_key" ON "TeachingAssignment"("classId", "subjectId");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_classId_date_idx" ON "Attendance"("schoolId", "classId", "date");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_studentId_idx" ON "Attendance"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Grade_schoolId_classId_sequenceId_idx" ON "Grade"("schoolId", "classId", "sequenceId");

-- CreateIndex
CREATE INDEX "Grade_schoolId_studentId_idx" ON "Grade"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_studentId_subjectId_sequenceId_key" ON "Grade"("studentId", "subjectId", "sequenceId");

-- CreateIndex
CREATE INDEX "ReportCard_schoolId_studentId_idx" ON "ReportCard"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_studentId_academicPeriodId_key" ON "ReportCard"("studentId", "academicPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardSubjectLine_reportCardId_subjectId_key" ON "ReportCardSubjectLine"("reportCardId", "subjectId");

-- CreateIndex
CREATE INDEX "Exam_schoolId_classId_idx" ON "Exam"("schoolId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_examId_studentId_key" ON "Submission"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Timetable_schoolId_classId_academicYearId_key" ON "Timetable"("schoolId", "classId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableGridConfig_schoolId_key" ON "TimetableGridConfig"("schoolId");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_studentId_idx" ON "Invoice"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_studentId_idx" ON "Payment"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Conversation_schoolId_idx" ON "Conversation"("schoolId");

-- CreateIndex
CREATE INDEX "Notification_schoolId_userId_isRead_idx" ON "Notification"("schoolId", "userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "DisciplineRecord_schoolId_studentId_idx" ON "DisciplineRecord"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ClassCouncilSession_schoolId_idx" ON "ClassCouncilSession"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassCouncilSession_classId_academicPeriodId_key" ON "ClassCouncilSession"("classId", "academicPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassCouncilDecision_sessionId_studentId_key" ON "ClassCouncilDecision"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "ClassPromotion_schoolId_idx" ON "ClassPromotion"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassPromotion_schoolId_fromClassId_academicYearId_key" ON "ClassPromotion"("schoolId", "fromClassId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentPromotion_schoolId_idx" ON "StudentPromotion"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPromotion_studentId_academicYearId_key" ON "StudentPromotion"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "OfflineQueue_schoolId_userId_status_idx" ON "OfflineQueue"("schoolId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubGroup_classId_name_key" ON "ClassSubGroup"("classId", "name");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_idx" ON "Announcement"("schoolId");

-- CreateIndex
CREATE INDEX "Announcement_schoolId_isPinned_idx" ON "Announcement"("schoolId", "isPinned");

-- CreateIndex
CREATE INDEX "SmsLog_schoolId_idx" ON "SmsLog"("schoolId");

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivitiesLog_schoolId_idx" ON "ActivitiesLog"("schoolId");

-- CreateIndex
CREATE INDEX "FicheOrientation_schoolId_status_idx" ON "FicheOrientation"("schoolId", "status");

-- CreateIndex
CREATE INDEX "FicheOrientation_schoolId_riskLevel_idx" ON "FicheOrientation"("schoolId", "riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "FicheOrientation_studentId_academicYearId_key" ON "FicheOrientation"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "EntretienOrientation_ficheOrientationId_idx" ON "EntretienOrientation"("ficheOrientationId");

-- CreateIndex
CREATE INDEX "TestAptitude_ficheOrientationId_idx" ON "TestAptitude"("ficheOrientationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommandationSerie_ficheOrientationId_key" ON "RecommandationSerie"("ficheOrientationId");

-- CreateIndex
CREATE INDEX "SuiviOrientation_ficheOrientationId_idx" ON "SuiviOrientation"("ficheOrientationId");

-- CreateIndex
CREATE INDEX "Book_schoolId_idx" ON "Book"("schoolId");

-- CreateIndex
CREATE INDEX "BookLoan_schoolId_idx" ON "BookLoan"("schoolId");

-- CreateIndex
CREATE INDEX "BookLoan_bookId_idx" ON "BookLoan"("bookId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolInvite" ADD CONSTRAINT "SchoolInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolInvite" ADD CONSTRAINT "SchoolInvite_invitedByMasterId_fkey" FOREIGN KEY ("invitedByMasterId") REFERENCES "MasterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolConfig" ADD CONSTRAINT "SchoolConfig_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolConfig" ADD CONSTRAINT "SchoolConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSettings" ADD CONSTRAINT "SchoolSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolNotificationSettings" ADD CONSTRAINT "SchoolNotificationSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolConfigurationForm" ADD CONSTRAINT "SchoolConfigurationForm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeFormula" ADD CONSTRAINT "GradeFormula_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeFormula" ADD CONSTRAINT "GradeFormula_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRule" ADD CONSTRAINT "MentionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentionRule" ADD CONSTRAINT "MentionRule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentProfileId_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectCoefficient" ADD CONSTRAINT "SubjectCoefficient_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectCoefficient" ADD CONSTRAINT "SubjectCoefficient_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacCoefficient" ADD CONSTRAINT "BacCoefficient_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleCoefficient" ADD CONSTRAINT "CycleCoefficient_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnglophoneSubjectLoad" ADD CONSTRAINT "AnglophoneSubjectLoad_templateCode_fkey" FOREIGN KEY ("templateCode") REFERENCES "SchoolTemplate"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicPeriod" ADD CONSTRAINT "AcademicPeriod_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicSequence" ADD CONSTRAINT "AcademicSequence_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicSequence" ADD CONSTRAINT "AcademicSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_professorPrincipalId_fkey" FOREIGN KEY ("professorPrincipalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "AcademicSequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardSubjectLine" ADD CONSTRAINT "ReportCardSubjectLine_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardSubjectLine" ADD CONSTRAINT "ReportCardSubjectLine_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableGridConfig" ADD CONSTRAINT "TimetableGridConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "ClassSubGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadStatus" ADD CONSTRAINT "MessageReadStatus_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadStatus" ADD CONSTRAINT "MessageReadStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineRecord" ADD CONSTRAINT "DisciplineRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilSession" ADD CONSTRAINT "ClassCouncilSession_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "AcademicPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilSession" ADD CONSTRAINT "ClassCouncilSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilSession" ADD CONSTRAINT "ClassCouncilSession_presidedById_fkey" FOREIGN KEY ("presidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilSession" ADD CONSTRAINT "ClassCouncilSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilDecision" ADD CONSTRAINT "ClassCouncilDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassCouncilSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassCouncilDecision" ADD CONSTRAINT "ClassCouncilDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPromotion" ADD CONSTRAINT "ClassPromotion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_promotedById_fkey" FOREIGN KEY ("promotedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineQueue" ADD CONSTRAINT "OfflineQueue_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineQueue" ADD CONSTRAINT "OfflineQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubGroup" ADD CONSTRAINT "ClassSubGroup_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubGroupAssignment" ADD CONSTRAINT "StudentSubGroupAssignment_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubGroupAssignment" ADD CONSTRAINT "StudentSubGroupAssignment_subGroupId_fkey" FOREIGN KEY ("subGroupId") REFERENCES "ClassSubGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitiesLog" ADD CONSTRAINT "ActivitiesLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterAuthAudit" ADD CONSTRAINT "MasterAuthAudit_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "MasterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheOrientation" ADD CONSTRAINT "FicheOrientation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheOrientation" ADD CONSTRAINT "FicheOrientation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheOrientation" ADD CONSTRAINT "FicheOrientation_conseillerId_fkey" FOREIGN KEY ("conseillerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntretienOrientation" ADD CONSTRAINT "EntretienOrientation_ficheOrientationId_fkey" FOREIGN KEY ("ficheOrientationId") REFERENCES "FicheOrientation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAptitude" ADD CONSTRAINT "TestAptitude_ficheOrientationId_fkey" FOREIGN KEY ("ficheOrientationId") REFERENCES "FicheOrientation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommandationSerie" ADD CONSTRAINT "RecommandationSerie_ficheOrientationId_fkey" FOREIGN KEY ("ficheOrientationId") REFERENCES "FicheOrientation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviOrientation" ADD CONSTRAINT "SuiviOrientation_ficheOrientationId_fkey" FOREIGN KEY ("ficheOrientationId") REFERENCES "FicheOrientation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
