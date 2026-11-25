import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaSchoolRepository } from '@infrastructure/persistence/prisma/PrismaSchoolRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaNoteRepository } from '@infrastructure/persistence/prisma/PrismaNoteRepository';
import { PrismaPresenceRepository } from '@infrastructure/persistence/prisma/PrismaPresenceRepository';
import { PrismaStatisticsQueryRepository } from '@infrastructure/persistence/prisma/PrismaStatisticsQueryRepository';
import { PrismaBulletinRepository } from '@infrastructure/persistence/prisma/PrismaBulletinRepository';
import { PrismaMatiereRepository } from '@infrastructure/persistence/prisma/PrismaMatiereRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaRattachementEnseignantRepository } from '@infrastructure/persistence/prisma/PrismaRattachementEnseignantRepository';
import { PrismaSectionRepository } from '@infrastructure/persistence/prisma/PrismaSectionRepository';
import { PrismaSchoolConfigRepository } from '@infrastructure/persistence/prisma/PrismaSchoolConfigRepository';
import { PrismaParentRepository } from '@infrastructure/persistence/prisma/PrismaParentRepository';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaMatriculeImportRepository } from '@infrastructure/persistence/prisma/PrismaMatriculeImportRepository';
import { PrismaPaiementMinesecRepository } from '@infrastructure/persistence/prisma/PrismaPaiementMinesecRepository';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaFactureRepository } from '@infrastructure/persistence/prisma/PrismaFactureRepository';
import { PrismaDepartmentRepository } from '@infrastructure/persistence/prisma/PrismaDepartmentRepository';
import { PrismaStaffAttendanceRepository } from '@infrastructure/persistence/prisma/PrismaStaffAttendanceRepository';
import { PrismaSequenceAbsenceSummaryRepository } from '@infrastructure/persistence/prisma/PrismaSequenceAbsenceSummaryRepository';
import { PrismaSchoolSettingsRepository } from '@infrastructure/persistence/prisma/PrismaSchoolSettingsRepository';
import { ActivityLogAdapter } from '@infrastructure/services/audit/ActivityLogAdapter';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { SmsNotificationAdapter } from '@infrastructure/services/sms/SmsNotificationAdapter';
import { CredentialsNotificationService } from '@infrastructure/services/notification/CredentialsNotificationService';
import { DocumentAiAdapter } from '@infrastructure/services/ai/DocumentAiAdapter';
import { EmailTemplateAdapter } from '@infrastructure/services/email/EmailTemplateAdapter';
import { InngestEventPublisher } from '@infrastructure/events/InngestEventPublisher';
import { NodemailerEmailService } from '@infrastructure/services/email/NodemailerEmailService';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { PdfKitBulletinService } from '@infrastructure/services/pdf/PdfKitBulletinService';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';
import { MetricCache } from '@infrastructure/cache/MetricCache';
import { MetricRegistry } from '@domain/reporting/MetricRegistryImpl';
import { GetMetricUseCase } from '@application/reporting/GetMetricUseCase';

export function createCoreContainerContext() {
  const userRepository = new PrismaUserRepository(prisma);
  const schoolRepository = new PrismaSchoolRepository(prisma);
  const classeRepository = new PrismaClasseRepository(prisma);
  const noteRepository = new PrismaNoteRepository(prisma);
  const presenceRepository = new PrismaPresenceRepository(prisma);
  const bulletinRepository = new PrismaBulletinRepository(prisma);
  const matiereRepository = new PrismaMatiereRepository(prisma);
  const sectionRepository = new PrismaSectionRepository(prisma);
  const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);
  const schoolConfigRepository = new PrismaSchoolConfigRepository(prisma);
  const rattachementRepository = new PrismaRattachementEnseignantRepository(prisma);
  const parentRepository = new PrismaParentRepository(prisma);
  const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
  const matriculeImportRepository = new PrismaMatriculeImportRepository(prisma);
  const paiementMinesecRepository = new PrismaPaiementMinesecRepository(prisma);
  const studentGroupSetRepository = new PrismaStudentGroupSetRepository(prisma);
  const studentGroupRepository = new PrismaStudentGroupRepository(prisma);
  const studentGroupMembershipRepository = new PrismaStudentGroupMembershipRepository(prisma);
  const classCouncilRepository = new PrismaClassCouncilRepository(prisma);
  const factureRepository = new PrismaFactureRepository(prisma);
  const departmentRepository = new PrismaDepartmentRepository(prisma);
  const staffAttendanceRepository = new PrismaStaffAttendanceRepository(prisma);
  const sequenceAbsenceRepository = new PrismaSequenceAbsenceSummaryRepository(prisma);
  const schoolSettingsRepository = new PrismaSchoolSettingsRepository(prisma);
  const statisticsQueryRepository = new PrismaStatisticsQueryRepository(prisma);

  const metricCache = new MetricCache();
  const metricRegistry = new MetricRegistry();
  const getMetricUseCase = new GetMetricUseCase(
    metricCache,
    metricRegistry,
    presenceRepository,
    noteRepository,
    statisticsQueryRepository,
    schoolRepository,
    classeRepository,
  );

  const eventPublisher = new InngestEventPublisher();
  const emailService = new NodemailerEmailService();
  const credentialsNotificationService = new CredentialsNotificationService(emailService);
  const notificationService = new SocketNotificationService(eventPublisher);
  const pdfService = new PdfKitBulletinService();
  const activityLog = new ActivityLogAdapter();
  const auditLog = new AIActionAuditAdapter(prisma);
  const smsNotificationAdapter = new SmsNotificationAdapter();
  const documentAiAdapter = new DocumentAiAdapter();
  const emailTemplateAdapter = new EmailTemplateAdapter();
  const notifierEvenement = (schoolId: string, targetRoles: string[], titre: string, corps: string) =>
    notifierEvenementAcademique(prisma, schoolId, targetRoles, titre, corps);

  return {
    userRepository,
    schoolRepository,
    classeRepository,
    noteRepository,
    presenceRepository,
    bulletinRepository,
    matiereRepository,
    sectionRepository,
    anneeRepository,
    schoolConfigRepository,
    rattachementRepository,
    parentRepository,
    enrollmentRepository,
    matriculeImportRepository,
    paiementMinesecRepository,
    studentGroupSetRepository,
    studentGroupRepository,
    studentGroupMembershipRepository,
    classCouncilRepository,
    factureRepository,
    departmentRepository,
    staffAttendanceRepository,
    sequenceAbsenceRepository,
    schoolSettingsRepository,
    statisticsQueryRepository,
    metricCache,
    metricRegistry,
    getMetricUseCase,
    eventPublisher,
    emailService,
    credentialsNotificationService,
    notificationService,
    pdfService,
    activityLog,
    auditLog,
    smsNotificationAdapter,
    documentAiAdapter,
    emailTemplateAdapter,
    notifierEvenement,
  };
}

export type CoreContainerContext = ReturnType<typeof createCoreContainerContext>;
