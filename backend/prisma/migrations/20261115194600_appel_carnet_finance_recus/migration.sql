-- CreateEnum
CREATE TYPE "JustificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LiaisonCategory" AS ENUM ('ABSENCE', 'BEHAVIOR', 'HOMEWORK', 'HEALTH', 'FEE_REMINDER', 'PAYMENT_RECEIPT', 'CONVOCATION', 'AUTHORIZATION', 'PARENT_NOTE', 'INFO');

-- CreateEnum
CREATE TYPE "DiscountReasonType" AS ENUM ('SIBLING', 'SCHOLARSHIP', 'EXEMPTION', 'DIRECTION_GESTURE', 'OTHER');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "clientRecordedAt" TIMESTAMP(3),
ADD COLUMN     "clockSkewSeconds" INTEGER,
ADD COLUMN     "justificationAttachmentUrl" TEXT,
ADD COLUMN     "justificationStatus" "JustificationStatus",
ADD COLUMN     "lateNote" TEXT,
ADD COLUMN     "previousStatus" "AttendanceStatus",
ADD COLUMN     "submittedByParentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "grossAmount" DOUBLE PRECISION,
ADD COLUMN     "promisedAt" TIMESTAMP(3),
ADD COLUMN     "promisedByUserId" TEXT,
ADD COLUMN     "promisedPaymentDate" TIMESTAMP(3),
ADD COLUMN     "promisedPaymentNote" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "clientRecordedAt" TIMESTAMP(3),
ADD COLUMN     "clockSkewSeconds" INTEGER,
ADD COLUMN     "feeBearer" TEXT,
ADD COLUMN     "installmentId" TEXT,
ADD COLUMN     "isUnmatched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operatorFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "provisionalReceiptNumber" TEXT,
ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "reversalOfPaymentId" TEXT;

-- AlterTable
ALTER TABLE "SchoolConfig" ADD COLUMN     "defaultInstallmentsCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "mobileMoneyFeeBearer" TEXT NOT NULL DEFAULT 'PARENT';

-- CreateTable
CREATE TABLE "LiaisonEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "category" "LiaisonCategory" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmationPrompt" TEXT,
    "attendanceId" TEXT,
    "paymentId" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "clientRecordedAt" TIMESTAMP(3),
    "clockSkewSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiaisonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiaisonReadReceipt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiaisonReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiaisonResponse" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "confirmed" BOOLEAN,
    "replyText" TEXT,
    "clientRecordedAt" TIMESTAMP(3),
    "clockSkewSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiaisonResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInstallment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "trancheNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDiscount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reasonType" "DiscountReasonType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION,
    "justification" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCreditLedger" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourcePaymentId" TEXT,
    "appliedInvoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "closureDate" TIMESTAMP(3) NOT NULL,
    "closedById" TEXT NOT NULL,
    "totalCash" DOUBLE PRECISION NOT NULL,
    "totalMobileMoney" DOUBLE PRECISION NOT NULL,
    "totalOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCancelled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentCount" INTEGER NOT NULL,
    "declaredCash" DOUBLE PRECISION,
    "variance" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiaisonEntry_schoolId_studentId_createdAt_idx" ON "LiaisonEntry"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "LiaisonEntry_schoolId_classId_idx" ON "LiaisonEntry"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "LiaisonEntry_schoolId_category_idx" ON "LiaisonEntry"("schoolId", "category");

-- CreateIndex
CREATE INDEX "LiaisonReadReceipt_schoolId_userId_idx" ON "LiaisonReadReceipt"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiaisonReadReceipt_entryId_userId_key" ON "LiaisonReadReceipt"("entryId", "userId");

-- CreateIndex
CREATE INDEX "LiaisonResponse_entryId_createdAt_idx" ON "LiaisonResponse"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "LiaisonResponse_schoolId_authorId_idx" ON "LiaisonResponse"("schoolId", "authorId");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_schoolId_dueDate_status_idx" ON "InvoiceInstallment"("schoolId", "dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceInstallment_invoiceId_trancheNumber_key" ON "InvoiceInstallment"("invoiceId", "trancheNumber");

-- CreateIndex
CREATE INDEX "StudentDiscount_schoolId_invoiceId_idx" ON "StudentDiscount"("schoolId", "invoiceId");

-- CreateIndex
CREATE INDEX "StudentDiscount_schoolId_studentId_idx" ON "StudentDiscount"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentCreditLedger_schoolId_studentId_idx" ON "StudentCreditLedger"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptSequence_schoolId_year_key" ON "ReceiptSequence"("schoolId", "year");

-- CreateIndex
CREATE INDEX "CashClosure_schoolId_closureDate_idx" ON "CashClosure"("schoolId", "closureDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosure_schoolId_closureDate_key" ON "CashClosure"("schoolId", "closureDate");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_studentId_date_period_idx" ON "Attendance"("schoolId", "studentId", "date", "period");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_academicYearId_idx" ON "Invoice"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_status_idx" ON "Invoice"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_schoolId_provisionalReceiptNumber_idx" ON "Payment"("schoolId", "provisionalReceiptNumber");

-- CreateIndex
CREATE INDEX "Payment_schoolId_isUnmatched_idx" ON "Payment"("schoolId", "isUnmatched");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paidAt_idx" ON "Payment"("schoolId", "paidAt");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_submittedByParentId_fkey" FOREIGN KEY ("submittedByParentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_promisedByUserId_fkey" FOREIGN KEY ("promisedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "InvoiceInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversalOfPaymentId_fkey" FOREIGN KEY ("reversalOfPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonEntry" ADD CONSTRAINT "LiaisonEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonReadReceipt" ADD CONSTRAINT "LiaisonReadReceipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonReadReceipt" ADD CONSTRAINT "LiaisonReadReceipt_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LiaisonEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonReadReceipt" ADD CONSTRAINT "LiaisonReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonResponse" ADD CONSTRAINT "LiaisonResponse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonResponse" ADD CONSTRAINT "LiaisonResponse_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LiaisonEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaisonResponse" ADD CONSTRAINT "LiaisonResponse_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_appliedInvoiceId_fkey" FOREIGN KEY ("appliedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSequence" ADD CONSTRAINT "ReceiptSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

