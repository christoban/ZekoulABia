import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { MasterBulletinAtelierController } from '@infrastructure/http/controllers/MasterBulletinAtelierController';
import { ClassCouncilController } from '@infrastructure/http/controllers/ClassCouncilController';
import { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { PedagogieController } from '@infrastructure/http/controllers/PedagogieController';
import { TemplateController } from '@infrastructure/http/controllers/TemplateController';
import { StudentDocumentController } from '@infrastructure/http/controllers/StudentDocumentController';
import { InviteOnboardingController } from '@infrastructure/http/controllers/InviteOnboardingController';
import { OnboardingStreamController } from '@infrastructure/http/controllers/OnboardingStreamController';
import { BulletinValidationController } from '@infrastructure/http/controllers/BulletinValidationController';
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { creerOnboardingRoutes } from '@infrastructure/http/routes/onboarding.routes';
import { creerInviteOnboardingRoutes } from '@infrastructure/http/routes/inviteOnboarding.routes';
import { creerOnboardingStreamRoutes } from '@infrastructure/http/routes/onboardingStream.routes';
import { creerTemplateRoutes } from '@infrastructure/http/routes/template.routes';
import { creerReportCardRoutes } from '@infrastructure/http/routes/reportCard.routes';
import { creerMasterBulletinAtelierRoutes } from '@infrastructure/http/routes/masterBulletinAtelier.routes';
import { creerClassCouncilRoutes } from '@infrastructure/http/routes/classCouncil.routes';
import { creerBulletinValidationRoutes } from '@infrastructure/http/routes/bulletinValidation.routes';
import { creerAssessmentRoutes } from '@infrastructure/http/routes/assessment.routes';
import { creerAnonymatPublicRoutes } from '@infrastructure/http/routes/anonymat.routes';
import { creerTaskRoutes } from '@infrastructure/http/routes/task.routes';
import { creerAcademicYearRoutes } from '@infrastructure/http/routes/academicYear.routes';
import { creerPedagogieRoutes } from '@infrastructure/http/routes/pedagogie.routes';
import { creerStudentDocumentRoutes } from '@infrastructure/http/routes/studentDocument.routes';
import { AcademicProfileController } from '@infrastructure/http/controllers/AcademicProfileController';
import { creerAcademicProfileRoutes } from '@infrastructure/http/routes/academicProfile.routes';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaOnboardingStreamRepository } from '@infrastructure/persistence/prisma/PrismaOnboardingStreamRepository';
import { hydrateTemplateSpecsFromStore } from '@domain/templates/bulletinCatalog';
import { requireAuth } from '../../http/middlewares/auth';

type Container = ReturnType<typeof creerContainer>;

export function registerAcademic(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerAcademicRoutes(app, _prisma, container);
}

export function registerAcademicRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const onboardingController = new SchoolOnboardingController(
    c.school.onboarder,
    c.school.approuver,
  );

  if (c.reportCard.templateSpecRepository) {
    void c.reportCard.templateSpecRepository.findAll().then(hydrateTemplateSpecsFromStore).catch(() => {});
  }

  const reportCardController = new ReportCardController(
    c.reportCard.generer,
    c.reportCard.envoyer,
    new GroqIAService(),
    c.school.schoolRepository,
    c.school.classeRepository,
    c.school.anneeRepository,
    c.school.sectionRepository,
    c.reportCard.bulletinRepository,
    c.reportCard.parentRepository,
    new AIActionAuditAdapter(p),
    c.reportCard.verifierDisponibilite,
    c.reportCard.lister,
    c.finance.factureRepository,
    c.school.schoolConfigRepository,
    c.reportCard.bulletinRenderer,
    c.fileStorage,
    c.reportCard.bulletinAssignmentRepository,
    c.reportCard.schoolIdentityKitRepository,
    c.reportCard.templateSpecRepository,
  );

  const masterBulletinAtelierController = new MasterBulletinAtelierController(
    c.masterAdmin.queryRepository,
    c.school.schoolRepository,
    c.school.schoolConfigRepository,
    c.reportCard.schoolIdentityKitRepository,
    c.reportCard.bulletinAssignmentRepository,
    c.school.classeRepository,
    c.reportCard.bulletinRenderer,
    c.fileStorage,
    c.reportCard.templateSpecRepository,
  );

  const classCouncilController = new ClassCouncilController(
    c.classCouncil.creerSession,
    c.classCouncil.preparerVue,
    c.classCouncil.listerSessions,
    c.classCouncil.obtenirSession,
    c.classCouncil.ajouterDecision,
    c.classCouncil.ajouterDecisionsEnBloc,
    c.classCouncil.verrouiller,
    c.reportCard.publierBulletins,
    c.classCouncil.genererPV,
    c.classCouncil.genererRapport,
    c.school.anneeRepository,
    c.school.schoolRepository,
    c.school.sectionRepository,
    c.school.classeRepository,
  );

  const bulletinValidationController = new BulletinValidationController(
    c.reportCard.soumettreBulletins,
    c.reportCard.validerBulletins,
    c.reportCard.publierBulletins,
    c.school.anneeRepository,
    c.school.schoolRepository,
    c.school.sectionRepository,
    c.school.classeRepository,
    c.reportCard.bulletinValidationRepository,
  );

  const inviteOnboardingController = new InviteOnboardingController(
    c.school.invitationRepository,
    c.school.schoolRepository,
  );
  app.use('/api/v2/onboarding', creerInviteOnboardingRoutes(inviteOnboardingController));

  const onboardingStreamController = new OnboardingStreamController(
    new PrismaOnboardingStreamRepository(p),
  );
  app.use('/api/v2/onboarding', creerOnboardingStreamRoutes(onboardingStreamController));

  const templateController = new TemplateController(
    c.school.classeRepository,
    c.school.schoolRepository,
    c.school.matiereRepository,
    c.school.departmentRepository,
  );
  app.use('/api/v2/templates', creerTemplateRoutes(templateController));

  const studentDocumentController = new StudentDocumentController(
    c.studentDocument.studentProfileRepository,
    c.studentDocument.schoolRepository,
    c.studentDocument.anneeRepository,
    c.studentDocument.bulletinRepository,
    c.studentDocument.documentRepository,
    c.parent.parentRepository,
    c.fileStorage,
  );
  app.use('/api/v2', creerStudentDocumentRoutes(studentDocumentController));

  const academicYearController = new AcademicYearController(
    c.academicYear.creer,
    c.academicYear.definirPeriode,
    c.academicYear.verifierPrerequis,
    c.academicYear.cloturer,
    c.academicYear.mettreAJourCalendrier,
    c.academicYear.proposerStructureSuivante,
    c.academicYear.validerStructureSuivante,
    c.academicYear.annulerStructureSuivante,
    c.activityLog,
  );
  app.use('/api/v2/academic-years', creerAcademicYearRoutes(academicYearController));

  const pedagogieController = new PedagogieController(
    c.pedagogie.listerProgramme,
    c.pedagogie.gererProgramme,
    c.pedagogie.gererChapitre,
    c.pedagogie.gererCahier,
    c.pedagogie.calculerProgression,
    c.pedagogie.obtenirSlot,
    c.pedagogie.genererRapport,
    new AIActionAuditAdapter(p),
  );
  app.use('/api/v2/pedagogie', requireAuth, creerPedagogieRoutes(pedagogieController));

  app.use('/api/v2/onboarding', creerOnboardingRoutes(onboardingController));
  app.use('/api/v2/master/bulletin-atelier', creerMasterBulletinAtelierRoutes(masterBulletinAtelierController));
  app.use('/api/v2/report-cards', creerReportCardRoutes(reportCardController));
  app.use('/api/v2/class-councils', creerClassCouncilRoutes(classCouncilController));
  app.use('/api/v2/bulletin-validations', creerBulletinValidationRoutes(bulletinValidationController));
  app.use('/api/v2/assessments', requireAuth, creerAssessmentRoutes(
    c.assessment.creerScope,
    c.assessment.planifierSession,
    c.assessment.enregistrerParticipation,
    c.assessment.enregistrerParticipationEnLot,
    c.assessment.genererCodesAnonymat,
    c.assessment.designerEquipeAnonymat,
    c.assessment.assignerCorrectionAnonymat,
    c.assessment.obtenirFicheCorrectionAnonyme,
    c.assessment.saisirNotesAnonymes,
    c.assessment.soumettreCorrectionAnonyme,
    c.assessment.reconcilierNotesAnonymes,
    c.assessment.listerSessionsCorrectionAnonyme,
    c.assessment.sessionRepository,
    c.assessment.anonymatRepository,
  ));
  app.use('/api/v2/anonymat', creerAnonymatPublicRoutes(
    c.assessment.obtenirListeAnonymatParToken,
    c.assessment.marquerAnonymisationTerminee,
  ));
  app.use('/api/v2/tasks', creerTaskRoutes(
    c.task.creer,
    c.task.lister,
    c.task.mettreAJourStatut,
  ));

  // V1.1 — Profil Académique (RBAC : ADMIN/STAFF, PP, parent, élève lui-même)
    const enrollmentRepo = new PrismaEnrollmentRepository(p);
  const anneeRepo = new PrismaAnneeAcademiqueRepository(p);
  const academicProfileController = new AcademicProfileController(
    c.academicProfile.obtenirProfil,
    c.parent.verifierAcces,
    enrollmentRepo,
    anneeRepo,
  );
  app.use('/api/v2', creerAcademicProfileRoutes(academicProfileController));
}
