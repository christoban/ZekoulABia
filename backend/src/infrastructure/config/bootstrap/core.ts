import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
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
import { EleveOnboardingDossierController } from '@infrastructure/http/controllers/EleveOnboardingDossierController';
import { StudentFollowUpController } from '@infrastructure/http/controllers/StudentFollowUpController';
import { AssistantController } from '@infrastructure/http/controllers/AssistantController';
import { PrismaSearchQueryRepository } from '@infrastructure/persistence/prisma/PrismaSearchQueryRepository';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaDashboardQueryRepository } from '@infrastructure/persistence/prisma/PrismaDashboardQueryRepository';
import { PrismaAIContextQueryRepository } from '@infrastructure/persistence/prisma/PrismaAIContextQueryRepository';
import { PrismaActivitiesLogQueryRepository } from '@infrastructure/persistence/prisma/PrismaActivitiesLogQueryRepository';
import { PrismaEmailLogQueryRepository } from '@infrastructure/persistence/prisma/PrismaEmailLogQueryRepository';
import { PrismaStudentFollowUpRepository } from '@infrastructure/persistence/prisma/PrismaStudentFollowUpRepository';
import { PrismaSuiviRBACRepository } from '@infrastructure/persistence/prisma/PrismaSuiviRBACRepository';
import { PrismaAcademicEventRepository } from '@infrastructure/persistence/prisma/PrismaAcademicEventRepository';
import { PrismaEntranceExamRepository } from '@infrastructure/persistence/prisma/PrismaEntranceExamRepository';
import { PrismaCoreDomainQueryRepository } from '@infrastructure/persistence/prisma/PrismaCoreDomainQueryRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaParentRepository } from '@infrastructure/persistence/prisma/PrismaParentRepository';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaApeeRepository } from '@infrastructure/persistence/prisma/PrismaApeeRepository';
import { PrismaAssistantContextQueryRepository } from '@infrastructure/persistence/prisma/PrismaAssistantContextQueryRepository';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { traiterDemandeConge } from '@infrastructure/services/hr/TraiterCongeService';
import { CreerEvenementAcademiqueUseCase, DeclencherEvenementUseCase, AjusterFenetreEvenementUseCase, ListerEvenementsUseCase, ObtenirEvenementsActifsUseCase, CloturerEvenementAcademiqueUseCase } from '@application/academicEvent';
import { CreerActionSuiviEleveUseCase } from '@application/suivi/CreerActionSuiviEleveUseCase';
import { ClorreActionSuiviUseCase } from '@application/suivi/ClorreActionSuiviUseCase';
import { ListerActionsEnCoursUseCase } from '@application/suivi/ListerActionsEnCoursUseCase';
import { AssignerActionSuiviUseCase } from '@application/suivi/AssignerActionSuiviUseCase';
import { ListerHistoriqueSuiviEleveUseCase } from '@application/suivi/ListerHistoriqueSuiviEleveUseCase';
import { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { buildAdminActionCatalog } from '@infrastructure/assistant/catalog/adminActionCatalog';
import { buildTeacherActionCatalog } from '@infrastructure/assistant/catalog/teacherActionCatalog';
import { buildStaffActionCatalog } from '@infrastructure/assistant/catalog/staffActionCatalog';
import { buildParentActionCatalog } from '@infrastructure/assistant/catalog/parentActionCatalog';
import { buildStudentActionCatalog } from '@infrastructure/assistant/catalog/studentActionCatalog';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';
import { SmsNotificationAdapter } from '@infrastructure/services/sms/SmsNotificationAdapter';
import { executerBroadcast } from '@infrastructure/services/communication/BroadcastService';
import { calculerAlertesRetardProgramme } from '@infrastructure/services/pedagogie/AlerteRetardProgrammeService';
import { notifyDisciplineSms, DISCIPLINE_TYPE_LABELS } from '../../services/sms/SmsNotificationService';
import { notifierParentsPushDabord } from '../../services/notification/PushFirstNotifier';
import { sendTransactionalEmail } from '../../services/email/EmailService';
import { creerOrientationRoutes } from '@infrastructure/http/routes/orientation.routes';
import { creerMatriculeRoutes } from '@infrastructure/http/routes/matricule.routes';
import { creerEleveOnboardingRoutes } from '@infrastructure/http/routes/eleveOnboarding.routes';
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
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { registerSchoolRoutes } from './school';

type Container = ReturnType<typeof creerContainer>;

export function registerCore(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerCoreRoutes(app, _prisma, container);
}

export function registerCoreRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  registerSchoolRoutes(app, prismaParam, container);

  // ── Thin controllers (pas de use case — Prisma direct, aucune logique métier) ──
  const enrollmentRepository = new PrismaEnrollmentRepository(p);
  const activitiesController = new ActivitiesLogController(new PrismaActivitiesLogQueryRepository(p));
  const dashboardController  = new DashboardController(new PrismaDashboardQueryRepository(p), enrollmentRepository);
  const emailLogController   = new EmailLogController(new PrismaEmailLogQueryRepository(p));
  const searchController     = new SearchController(new PrismaSearchQueryRepository(p));
  const aiController         = new AIController(new PrismaAIContextQueryRepository(p), enrollmentRepository, c.prediction.comparerRisque);
  const studentFollowUpRepo  = new PrismaStudentFollowUpRepository(p);
  const suiviRBACRepository    = new PrismaSuiviRBACRepository(p);
  const studentFollowUpController = new StudentFollowUpController(
    new CreerActionSuiviEleveUseCase(studentFollowUpRepo, suiviRBACRepository),
    new ClorreActionSuiviUseCase(studentFollowUpRepo),
    new ListerActionsEnCoursUseCase(studentFollowUpRepo),
    new AssignerActionSuiviUseCase(studentFollowUpRepo, suiviRBACRepository),
    new ListerHistoriqueSuiviEleveUseCase(studentFollowUpRepo, suiviRBACRepository),
    studentFollowUpRepo,
  );
  const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(p);
  const anneeRepository = new PrismaAnneeAcademiqueRepository(p);
  const studentAffectationRepository = new PrismaStudentAffectationRepository(p);
  const academicEventRepository = new PrismaAcademicEventRepository(p);
  const entranceExamRepository = new PrismaEntranceExamRepository(p);
  const notifierEvenement = (schoolId: string, roles: string[], titre: string, corps: string) =>
    notifierEvenementAcademique(p, schoolId, roles, titre, corps);
  const smsNotificationAdapter = new SmsNotificationAdapter();
  const academicEventController = new AcademicEventController(
    new CreerEvenementAcademiqueUseCase(academicEventRepository, lv2ChoiceRepository, anneeRepository, smsNotificationAdapter, entranceExamRepository, notifierEvenement),
    new DeclencherEvenementUseCase(academicEventRepository, lv2ChoiceRepository, anneeRepository, notifierEvenement, smsNotificationAdapter, entranceExamRepository),
    new AjusterFenetreEvenementUseCase(academicEventRepository, lv2ChoiceRepository),
    new ListerEvenementsUseCase(academicEventRepository),
    new ObtenirEvenementsActifsUseCase(academicEventRepository),
    new CloturerEvenementAcademiqueUseCase(academicEventRepository, lv2ChoiceRepository, entranceExamRepository),
  );
  const coreDomainController = new CoreDomainController(new PrismaCoreDomainQueryRepository(p));
  const publicController     = new PublicController(c.school.schoolRepository);
  const smsController        = new SMSController(c.school.schoolRepository, c.attendance.traiterSmsPresence);

  const orientationController = new OrientationController(
    c.orientation.creerFiche,
    c.orientation.ajouterEntretien,
    c.orientation.ajouterTest,
    c.orientation.creerRecommandation,
    c.orientation.ajouterSuivi,
    c.orientation.listerFiches,
    c.orientation.getStats,
    c.orientation.repo,
    c.orientation.saisirAspiration,
    c.orientation.genererRecommandation,
    c.orientation.validerRecommandationConseiller,
    c.orientation.proposerRecommandationEleve,
    c.orientation.choisirPisteEleve,
    c.orientation.listerElevesAOrienter,
    c.orientation.configurerCheckpoint,
    new AIActionAuditAdapter(p),
    anneeRepository,
    new PrismaParentRepository(p),
  );

  app.use('/api/v2/orientation', creerOrientationRoutes(orientationController));

  // ── Matricule National MINESEC ──────────────────────────────────────────
  const matriculeController = new MatriculeController(
    c.matricule.importerMatricules,
    c.matricule.verifierMatricule,
    c.matricule.syncFromCarteScolaire,
    c.matricule.verifierRecu,
    c.matricule.confirmerFuzzy,
    c.matricule.signalerErreur,
    c.matricule.matriculeImportRepository,
    new AIActionAuditAdapter(p),
  );
  app.use('/api/v2/matricules', creerMatriculeRoutes(matriculeController));
  // Route orpheline retrouvée : la méthode existait sur le controller mais n'était montée nulle part.
  app.patch('/api/v2/students/:id/matricule', requireAuth, requireRole('ADMIN', 'STAFF'), matriculeController.updateMatricule);

  // ── Onboarding Auto-Service Élèves ──────────────────────────────────────
  // Préfixe distinct de /api/v2/onboarding (déjà pris par l'onboarding d'établissement,
  // module sans rapport — voir spec-onboarding-eleve-autoservice.md section 0 point 4).
  const eleveOnboardingController = new EleveOnboardingController(
    c.eleveOnboarding.creerSquelette,
    c.eleveOnboarding.soumettreFormulaire,
    c.eleveOnboarding.soumettre,
    c.eleveOnboarding.renvoyer,
    c.eleveOnboarding.valider,
    c.eleveOnboarding.rejeter,
    c.eleveOnboarding.repository,
    c.school.schoolRepository,
    c.credentialsNotificationService,
    c.eleveOnboarding.inscrire,
    c.eleveOnboarding.changerGestionAdmin,
  );
  const eleveOnboardingDossierController = new EleveOnboardingDossierController(
    c.eleveOnboarding.gererPieces,
    c.eleveOnboarding.suggererClasses,
    c.eleveOnboarding.genererFichePdf,
    c.eleveOnboarding.validerLot,
  );
  app.use('/api/v2/eleve-onboarding', creerEleveOnboardingRoutes(eleveOnboardingController, eleveOnboardingDossierController));

  app.use('/api/v2/activities',    creerActivitiesRoutes(activitiesController));
  app.use('/api/v2/dashboard',     creerDashboardRoutes(dashboardController));
  app.use('/api/v2/email-logs',    creerEmailLogRoutes(emailLogController));
  app.use('/api/v2/search',        creerSearchRoutes(searchController));
  app.use('/api/v2/ai',            creerAIRoutes(aiController));
  app.use('/api/v2/student-follow-up', creerStudentFollowUpRoutes(studentFollowUpController));
  app.use('/api/v2/academic-events', creerAcademicEventRoutes(academicEventController));
  app.post('/api/v2/assistant/chat', requireAuth, aiController.assistantChat);

  // ── Assistant IA EXÉCUTANT (copilot) — rôle ADMIN uniquement ────────────────
  // Catalogue d'actions mappé sur les use cases existants ; RBAC filtré + revérifié serveur.
  const groupSetRepositoryLeger = new PrismaStudentGroupSetRepository(p);
  const groupRepositoryLeger = new PrismaStudentGroupRepository(p);
  const membershipRepositoryLeger = new PrismaStudentGroupMembershipRepository(p);
  const adminActionCatalog = buildAdminActionCatalog({
    creerClasse: c.class.creer,
    supprimerClasse: c.class.supprimer,
    assignerProfesseur: c.class.assignerProfesseur,
    creerMatiere: c.subject.creer,
    assignerEnseignant: c.subject.assignerEnseignant,
    supprimerMatiere: c.subject.supprimer,
    creerSessionConcours: c.entranceExam.creerSession,
    creerSessionPebs: c.pebsExam.creerSession,
    ouvrirFenetreLV2: c.lv2Choice.ouvrirFenetre,
    inscrireEleve: c.user.inscrire,
    modifierUtilisateur: c.user.modifier,
    supprimerUtilisateur: c.user.supprimer,
    transfererEleve: c.user.transferer,
    modifierMatiere: c.subject.modifier,
    // Constructeurs légers (prisma uniquement) — pas encore exposés dans le c.
    affecterLV2Eleve: new AffecterLV2EleveUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    affecterLV2Masse: new AffecterLV2EnMasseUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    affecterPEBSEleve: new AffecterPEBSEleveUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    affecterPEBSMasse: new AffecterPEBSEnMasseUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    genererBulletins: c.reportCard.generer,
    envoyerBulletins: c.reportCard.envoyer,
    verrouillerNotesEnMasse: c.grade.verrouillerNotesEnMasse,
    publierEDT: c.timetable.publier,
     rouvrirEDT: c.timetable.rouvrir,
     viderEDT: c.timetable.viderCreneaux,

    ouvrirConseilClasse: c.classCouncil.tenir,
    definirPeriodeCourante: c.academicYear.definirPeriode,
    verifierPrerequisCloture: c.academicYear.verifierPrerequis,
    creerPlanFrais: c.finance.creerPlanFrais,
    genererFacturesMasse: c.finance.genererFacturesEnMasse,
    enregistrerPaiementCash: c.finance.enregistrerPaiementCash,
    resumeSessionConcours: c.entranceExam.resumeSession,
    calculerAdmissionConcours: c.entranceExam.calculerAdmission,
    resumeSessionPebs: c.pebsExam.resumeSession,
    calculerSelectionPebs: c.pebsExam.calculerSelection,
    verifierMatricule: c.matricule.verifierMatricule,
    creerSalle: c.room.creer,
    modifierSalle: c.room.modifier,
    assignerSalleClasse: c.studentGroup.assignerSalleClasse,
    retirerAssignationSalle: c.studentGroup.retirerAssignationSalle,
    traiterDemandeConge: (schoolId, requestId, statut, validatedById) =>
      traiterDemandeConge(c.hr.leaveRepository, schoolId, requestId, statut, validatedById),
    diffuserMessage: (schoolId, createdById, target, channel, message) =>
      executerBroadcast(p, schoolId, createdById, target as Parameters<typeof executerBroadcast>[3], channel, message),
    alertesRetardProgramme: (schoolId, academicYearId, seuilPct) =>
      calculerAlertesRetardProgramme(p, schoolId, academicYearId, seuilPct),
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle TEACHER (Section 6.2 du chantier) ──
  const teacherActionCatalog = buildTeacherActionCatalog({
    saisirNote: c.grade.saisirNote,
    verrouillerNotesEnMasse: c.grade.verrouillerNotesEnMasse,
    enregistrerPresence: c.attendance.enregistrerPresence,
    demanderRattrapage: c.timetable.demanderRattrapage,
    getMetric: c.metric.getMetric,
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle STAFF (Section 6.2 du chantier) ──
  // Discipline/APEE/Bibliothèque/Orientation uniquement — le reste (Finance, Notes, Conseil
  // de classe...) est déjà dans adminActionCatalog.ts et devient accessible à STAFF via son
  // requiredPermission dès que la route l'autorise, sans duplication.
  const staffActionCatalog = buildStaffActionCatalog({
    creerTransactionAPEE: new CreerTransactionAPEEUseCase(new PrismaApeeRepository(p)),
    validerDepenseAPEE: new ValiderDepenseAPEEUseCase(new PrismaApeeRepository(p)),
    ajouterSuiviOrientation: c.orientation.ajouterSuivi,
    notifierSanctionDisciplinaire: async (schoolId, studentId, studentName, type, reason) => {
      const { phonesSansPush } = await notifierParentsPushDabord({
        schoolId, studentId, type: 'DISCIPLINE_SANCTION',
        titre: 'Sanction disciplinaire',
        corps: `${studentName} a fait l'objet d'une sanction disciplinaire. Motif : ${reason}.`,
      });
      await notifyDisciplineSms({ schoolId, studentId, studentName, type, reason, phones: phonesSansPush });
      const parentLinks = await p.parentStudent.findMany({
        where: { studentProfile: { userId: studentId } },
        include: { parentProfile: { include: { user: { select: { email: true } } } } },
      });
      const parentEmails = [...new Set(parentLinks.map((l) => l.parentProfile?.user?.email).filter((e): e is string => Boolean(e)))];
      const typeLabel = DISCIPLINE_TYPE_LABELS[type]?.fr ?? type;
      for (const email of parentEmails) {
        await sendTransactionalEmail({
          recipientEmail: email,
          subject: `Notification disciplinaire — ${studentName}`,
          html: `<p>Bonjour,</p><p><b>${studentName}</b> a fait l'objet d'une sanction disciplinaire.</p><p><b>Type :</b> ${typeLabel}</p><p><b>Motif :</b> ${reason}</p><p>Merci de contacter l'établissement pour plus d'informations.</p>`,
          text: `Sanction disciplinaire pour ${studentName} : ${typeLabel} — ${reason}`,
          template: 'discipline_notification',
          eventType: 'discipline_notification',
          metadata: { schoolId },
        });
      }
    },
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle PARENT (Section 6.2 du chantier) ──
  const parentActionCatalog = buildParentActionCatalog({
    initierPaiement: c.finance.initierPaiement,
    getMetric: c.metric.getMetric,
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle STUDENT (Section 6.2 du chantier) ──
  const studentActionCatalog = buildStudentActionCatalog(c.metric.getMetric);

  // Un seul copilot, un seul catalogue combiné (Principe 0.1) — chaque action porte son
  // propre `allowedRoles`/`requiredPermission`, filtré côté serveur par filterCatalogForUser.
  const assistantController = new AssistantController(
    new PrismaAssistantContextQueryRepository(p),
    [...adminActionCatalog, ...teacherActionCatalog, ...staffActionCatalog, ...parentActionCatalog, ...studentActionCatalog],
    new AIActionAuditAdapter(p),
    p,
  );
  app.post('/api/v2/assistant/execute', requireAuth, requireRole('ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'), assistantController.execute);
  app.post('/api/v2/assistant/confirm-action', requireAuth, requireRole('ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'), assistantController.confirmAction);
  app.post('/api/v2/assistant/undo-action', requireAuth, requireRole('ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'), assistantController.undoAction);
  app.use('/api/v2/core-domain',   creerCoreDomainRoutes(coreDomainController));
  app.use('/api/v2/public',        creerPublicRoutes(publicController));
  app.use('/api/v2/sms',           creerSMSRoutes(smsController));



}

