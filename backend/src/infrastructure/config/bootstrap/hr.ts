import type { Application } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { SubjectController } from '@infrastructure/http/controllers/SubjectController';
import { RoomController } from '@infrastructure/http/controllers/RoomController';
import { TeacherUnavailabilityController } from '@infrastructure/http/controllers/TeacherUnavailabilityController';
import { StudentGroupController } from '@infrastructure/http/controllers/StudentGroupController';
import { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';
import { CorbeilleController } from '@infrastructure/http/controllers/CorbeilleController';
import { HRController } from '@infrastructure/http/controllers/HRController';
import { HRSelfServiceController } from '@infrastructure/http/controllers/HRSelfServiceController';
import { ParentController } from '@infrastructure/http/controllers/ParentController';
import { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { ActivitiesLogController } from '@infrastructure/http/controllers/ActivitiesLogController';
import { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { EmailLogController } from '@infrastructure/http/controllers/EmailLogController';
import { SearchController } from '@infrastructure/http/controllers/SearchController';
import { AIController } from '@infrastructure/http/controllers/AIController';
import { AcademicEventController } from '@infrastructure/http/controllers/AcademicEventController';
import { CoreDomainController } from '@infrastructure/http/controllers/CoreDomainController';
import { PublicController } from '@infrastructure/http/controllers/PublicController';
import { SMSController } from '@infrastructure/http/controllers/SMSController';
import { OrientationController } from '@infrastructure/http/controllers/OrientationController';
import { MatriculeController } from '@infrastructure/http/controllers/MatriculeController';
import { EleveOnboardingController } from '@infrastructure/http/controllers/EleveOnboardingController';
import { StatisticalCampaignController } from '@infrastructure/http/controllers/StatisticalCampaignController';
import { StatisticalCampaignMinedubController } from '@infrastructure/http/controllers/StatisticalCampaignMinedubController';
import { PaiementMinesecController } from '@infrastructure/http/controllers/PaiementMinesecController';
import { ExamenController } from '@infrastructure/http/controllers/ExamenController';
import { Lv2ChoiceController } from '@infrastructure/http/controllers/Lv2ChoiceController';
import { EntranceExamController } from '@infrastructure/http/controllers/EntranceExamController';
import { PebsExamController } from '@infrastructure/http/controllers/PebsExamController';
import { PushNotificationController } from '@infrastructure/http/controllers/PushNotificationController';
import { NotificationController } from '@infrastructure/http/controllers/NotificationController';
import { AnnouncementController } from '@infrastructure/http/controllers/AnnouncementController';
import { MessagerieController } from '@infrastructure/http/controllers/MessagerieController';
import { APEEController } from '@infrastructure/http/controllers/APEEController';
import { DisciplineCouncilController } from '@infrastructure/http/controllers/DisciplineCouncilController';
import { DisciplineController } from '@infrastructure/http/controllers/DisciplineController';
import { StudentFollowUpController } from '@infrastructure/http/controllers/StudentFollowUpController';
import { AssistantController } from '@infrastructure/http/controllers/AssistantController';
import { OnboardingPEBSController } from '@infrastructure/http/controllers/OnboardingPEBSController';
import { AjouterEvenementCarriereUseCase } from '@application/hr/AjouterEvenementCarriereUseCase';
import { ListerEvenementsCarriereUseCase } from '@application/hr/ListerEvenementsCarriereUseCase';
import { CreerDemandeCongeUseCase } from '@application/hr/CreerDemandeCongeUseCase';
import { TraiterDemandeCongeUseCase } from '@application/hr/TraiterDemandeCongeUseCase';
import { ListerDemandesCongeUseCase } from '@application/hr/ListerDemandesCongeUseCase';
import { CreerOrdreMissionUseCase } from '@application/hr/CreerOrdreMissionUseCase';
import { TraiterCongeServiceAdapter } from '@infrastructure/services/hr/TraiterCongeServiceAdapter';
import { creerClasseRoutes } from '@infrastructure/http/routes/classe.routes';
import { creerSubjectRoutes } from '@infrastructure/http/routes/subject.routes';
import { creerRoomRoutes } from '@infrastructure/http/routes/room.routes';
import { creerTeacherUnavailabilityRoutes } from '@infrastructure/http/routes/teacher-unavailability.routes';
import { creerStudentGroupRoutes } from '@infrastructure/http/routes/studentGroup.routes';
import { creerHrRoutes } from '@infrastructure/http/routes/hr.routes';
import { creerHrSelfServiceRoutes } from '@infrastructure/http/routes/hrSelfService.routes';
import { StaffAttendanceController } from '@infrastructure/http/controllers/StaffAttendanceController';
import { creerStaffAttendanceRoutes } from '@infrastructure/http/routes/staffAttendance.routes';
import { creerParentRoutes } from '@infrastructure/http/routes/parent.routes';
import { creerSchoolSettingsRoutes } from '@infrastructure/http/routes/schoolSettings.routes';
import { creerActivitiesRoutes } from '@infrastructure/http/routes/activities.routes';
import { creerDashboardRoutes } from '@infrastructure/http/routes/dashboard.routes';
import { creerEmailLogRoutes } from '@infrastructure/http/routes/emailLog.routes';
import { creerSearchRoutes } from '@infrastructure/http/routes/search.routes';
import { creerAIRoutes } from '@infrastructure/http/routes/ai.routes';
import { creerStudentFollowUpRoutes } from '@infrastructure/http/routes/studentFollowUp.routes';
import { creerAcademicEventRoutes } from '@infrastructure/http/routes/academicEvent.routes';
import { creerCoreDomainRoutes } from '@infrastructure/http/routes/coreDomain.routes';
import { creerPublicRoutes } from '@infrastructure/http/routes/public.routes';
import { creerSMSRoutes } from '@infrastructure/http/routes/sms.routes';
import { creerOrientationRoutes } from '@infrastructure/http/routes/orientation.routes';
import { creerMatriculeRoutes } from '@infrastructure/http/routes/matricule.routes';
import { creerEleveOnboardingRoutes } from '@infrastructure/http/routes/eleveOnboarding.routes';
import { creerStatisticalCampaignRoutes } from '@infrastructure/http/routes/statisticalCampaign.routes';
import { creerStatisticalCampaignMinedubRoutes } from '@infrastructure/http/routes/statisticalCampaignMinedub.routes';
import { creerPaiementMinesecRoutes } from '@infrastructure/http/routes/paiementMinesec.routes';
import { creerExamenRoutes } from '@infrastructure/http/routes/examen.routes';
import { creerLv2ChoiceRoutes, creerLv2ChoiceStudentRoutes } from '@infrastructure/http/routes/lv2Choice.routes';
import { creerEntranceExamRoutes } from '@infrastructure/http/routes/entranceExam.routes';
import { creerPebsExamRoutes } from '@infrastructure/http/routes/pebsExam.routes';
import { creerPushNotificationRoutes } from '@infrastructure/http/routes/pushNotification.routes';
import { creerNotificationRoutes } from '@infrastructure/http/routes/notification.routes';
import { creerAnnouncementRoutes } from '@infrastructure/http/routes/announcement.routes';
import { creerMessagerieRoutes } from '@infrastructure/http/routes/messagerie.routes';
import { creerApeeRoutes } from '@infrastructure/http/routes/apee.routes';
import { creerDisciplineCouncilRoutes } from '@infrastructure/http/routes/disciplineCouncil.routes';
import { creerDisciplineRoutes } from '@infrastructure/http/routes/discipline.routes';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { protectMaster, authorizeMaster } from '../../http/middlewares/authMultiTenant';
import { requireMasterSensitiveAuth } from '../../http/middlewares/masterSensitiveAuth';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaStudentFollowUpRepository } from '@infrastructure/persistence/prisma/PrismaStudentFollowUpRepository';
import { PrismaSuiviRBACRepository } from '@infrastructure/persistence/prisma/PrismaSuiviRBACRepository';
import { PrismaAcademicEventRepository } from '@infrastructure/persistence/prisma/PrismaAcademicEventRepository';
import { PrismaAnnouncementRepository } from '@infrastructure/persistence/prisma/PrismaAnnouncementRepository';
import { PrismaMessagerieRepository } from '@infrastructure/persistence/prisma/PrismaMessagerieRepository';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaSubjectAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaSubjectAssignmentRepository';
import { PrismaSchoolActivationRepository } from '@infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { CreerEvenementAcademiqueUseCase, DeclencherEvenementUseCase, AjusterFenetreEvenementUseCase, ListerEvenementsUseCase, ObtenirEvenementsActifsUseCase } from '@application/academicEvent';
import { CreerActionSuiviEleveUseCase } from '@application/suivi/CreerActionSuiviEleveUseCase';
import { ClorreActionSuiviUseCase } from '@application/suivi/ClorreActionSuiviUseCase';
import { ListerActionsEnCoursUseCase } from '@application/suivi/ListerActionsEnCoursUseCase';
import { AssignerActionSuiviUseCase } from '@application/suivi/AssignerActionSuiviUseCase';
import { ListerHistoriqueSuiviEleveUseCase } from '@application/suivi/ListerHistoriqueSuiviEleveUseCase';
import { CreerAnnonceUseCase } from '@application/announcement/CreerAnnonceUseCase';
import { ListerAnnoncesUseCase } from '@application/announcement/ListerAnnoncesUseCase';
import { ModifierAnnonceUseCase } from '@application/announcement/ModifierAnnonceUseCase';
import { SupprimerAnnonceUseCase } from '@application/announcement/SupprimerAnnonceUseCase';
import { EnvoyerMessageUseCase } from '@application/messagerie/EnvoyerMessageUseCase';
import { ListerConversationsUseCase } from '@application/messagerie/ListerConversationsUseCase';
import { ListerMessagesUseCase } from '@application/messagerie/ListerMessagesUseCase';
import { MarquerMessagesLusUseCase } from '@application/messagerie/MarquerMessagesLusUseCase';
import { ModererMessageUseCase } from '@application/messagerie/ModererMessageUseCase';
import { ListerMessagesEnAttenteModerationUseCase } from '@application/messagerie/ListerMessagesEnAttenteModerationUseCase';
import { ListerContactsMessagerieUseCase } from '@application/messagerie/ListerContactsMessagerieUseCase';
import { CompterMessagesNonLusUseCase } from '@application/messagerie/CompterMessagesNonLusUseCase';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { ConfigurerEtablissementUseCase } from '@application/school/ConfigurerEtablissementUseCase';
import { ObtenirAnomaliesEtablissementUseCase } from '@application/school/ObtenirAnomaliesEtablissementUseCase';
import { AffecterMatieresALevelEleveUseCase } from '@application/student/AffecterMatieresALevelEleveUseCase';
import { PreremplirDepuisCombinaisonUseCase } from '@application/student/PreremplirDepuisCombinaisonUseCase';
import { GetElevesParMatiereALevelUseCase } from '@application/student/GetElevesParMatiereALevelUseCase';
import { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { PrismaApeeRepository } from '@infrastructure/persistence/prisma/PrismaApeeRepository';
import { buildAdminActionCatalog } from '@infrastructure/assistant/catalog/adminActionCatalog';
import { buildTeacherActionCatalog } from '@infrastructure/assistant/catalog/teacherActionCatalog';
import { buildStaffActionCatalog } from '@infrastructure/assistant/catalog/staffActionCatalog';
import { buildParentActionCatalog } from '@infrastructure/assistant/catalog/parentActionCatalog';
import { buildStudentActionCatalog } from '@infrastructure/assistant/catalog/studentActionCatalog';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { RealtimeSocketAdapter } from '@infrastructure/socket/RealtimeSocketAdapter';
import { SmsNotificationAdapter } from '@infrastructure/services/sms/SmsNotificationAdapter';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';
import { getStaffTitlesForTemplate } from '@domain/rules/StaffPermissionRules';
import { assignerMatieresPourClasse, CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS, parseSerie as syncParseSerie } from '@application/school/SubjectAssignmentHelper';
import { buildPayload, getLatestSchoolBackup } from '../../backup/SchoolBackupService';
import type { PaymentMethod } from '@domain/types/enums';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { calculerAlertesRetardProgramme } from '@infrastructure/services/pedagogie/AlerteRetardProgrammeService';
import { notifyDisciplineSms, DISCIPLINE_TYPE_LABELS } from '../../services/sms/SmsNotificationService';
import { notifierParentsPushDabord } from '../../services/notification/PushFirstNotifier';
import { sendTransactionalEmail } from '../../services/email/EmailService';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import { SchoolOnboardingController as SchoolOnboardingControllerForMaster } from '@infrastructure/http/controllers/SchoolOnboardingController';


type Container = ReturnType<typeof creerContainer>;

export function registerHr(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerHrRoutes(app, _prisma, container);
}

export function registerHrRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  // ── Module RH (C.2) — extraction Congé → application/hr/
  const ajouterEvenementCarriereUseCase = new AjouterEvenementCarriereUseCase(
    c.hr.careerEventRepository,
    c.hr.userRepository,
  );
  const listerEvenementsCarriereUseCase = new ListerEvenementsCarriereUseCase(
    c.hr.careerEventRepository,
    c.hr.userRepository,
  );
  const creerDemandeCongeUseCase = new CreerDemandeCongeUseCase(
    c.hr.leaveRepository,
    c.hr.userRepository,
  );
  const traiterCongeService = new TraiterCongeServiceAdapter(c.hr.leaveRepository);
  const traiterDemandeCongeUseCase = new TraiterDemandeCongeUseCase(
    traiterCongeService,
    new AIActionAuditAdapter(p as any),
    c.hr.leaveRepository,
  );
  const listerDemandesCongeUseCase = new ListerDemandesCongeUseCase(
    c.hr.leaveRepository,
    c.hr.userRepository,
  );
  const creerOrdreMissionUseCase = new CreerOrdreMissionUseCase(
    c.hr.missionOrderRepository,
    c.hr.userRepository,
  );
  const hrController = new HRController(
    c.hr.userRepository,
    c.hr.schoolRepository,
    c.hr.sectionRepository,
    c.hr.staffProfileRepository,
    c.hr.leaveRepository,
    c.hr.employeeFileRepository,
    c.hr.careerEventRepository,
    c.hr.staffAttendanceRepository,
    c.hr.missionOrderRepository,
    new AIActionAuditAdapter(p as any),
    ajouterEvenementCarriereUseCase,
    listerEvenementsCarriereUseCase,
    creerDemandeCongeUseCase,
    traiterDemandeCongeUseCase,
    listerDemandesCongeUseCase,
    creerOrdreMissionUseCase,
  );
  app.use('/api/v2/hr', requireAuth, requireRole('ADMIN', 'STAFF'), creerHrRoutes(hrController));

  // ── Module RH — self-service employé (accès ADMIN/STAFF/TEACHER, scopé à soi-même) ──
  const hrSelfServiceController = new HRSelfServiceController(c.hr.employeeFileRepository);
  app.use('/api/v2/hr-self-service', creerHrSelfServiceRoutes(hrSelfServiceController));

  // ── V2.11 — Pointage présence enseignants (QR / GPS / manuel + RH requalification) ──
  const staffAttendanceController = new StaffAttendanceController(
    c.staffAttendance.pointerPresenceEnseignant,
    c.staffAttendance.staffAttendanceRepository,
    new AIActionAuditAdapter(p as any),
  );
  app.use('/api/v2/staff-attendance', creerStaffAttendanceRoutes(staffAttendanceController));


}
