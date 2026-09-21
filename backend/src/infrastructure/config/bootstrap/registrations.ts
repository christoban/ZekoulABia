import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { PrismaDisciplineRepository } from '@infrastructure/persistence/prisma/PrismaDisciplineRepository';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { creerContainer } from '@infrastructure/config/container';
import { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { SubjectController } from '@infrastructure/http/controllers/SubjectController';
import { RoomController } from '@infrastructure/http/controllers/RoomController';
import { TeacherUnavailabilityController } from '@infrastructure/http/controllers/TeacherUnavailabilityController';
import { StudentGroupController } from '@infrastructure/http/controllers/StudentGroupController';
import { StatisticalCampaignController } from '@infrastructure/http/controllers/StatisticalCampaignController';
import { StatisticalCampaignMinedubController } from '@infrastructure/http/controllers/StatisticalCampaignMinedubController';
import { PaiementMinesecController } from '@infrastructure/http/controllers/PaiementMinesecController';
import { ExamenController } from '@infrastructure/http/controllers/ExamenController';
import { Lv2ChoiceController } from '@infrastructure/http/controllers/Lv2ChoiceController';
import { EntranceExamController } from '@infrastructure/http/controllers/EntranceExamController';
import { EntranceExamPublicController } from '@infrastructure/http/controllers/EntranceExamPublicController';
import { PdfKitEntranceExamAdapter } from '@infrastructure/pdf/entranceExam/PdfKitEntranceExamAdapter';
import { PebsExamController } from '@infrastructure/http/controllers/PebsExamController';
import { PushNotificationController } from '@infrastructure/http/controllers/PushNotificationController';
import { NotificationController } from '@infrastructure/http/controllers/NotificationController';
import { AnnouncementController } from '@infrastructure/http/controllers/AnnouncementController';
import { MessagerieController } from '@infrastructure/http/controllers/MessagerieController';
import { APEEController } from '@infrastructure/http/controllers/APEEController';
import { DisciplineCouncilController } from '@infrastructure/http/controllers/DisciplineCouncilController';
import { creerClasseRoutes } from '@infrastructure/http/routes/classe.routes';
import { creerSubjectRoutes } from '@infrastructure/http/routes/subject.routes';
import { creerRoomRoutes } from '@infrastructure/http/routes/room.routes';
import { creerTeacherUnavailabilityRoutes } from '@infrastructure/http/routes/teacher-unavailability.routes';
import { creerStudentGroupRoutes } from '@infrastructure/http/routes/studentGroup.routes';
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
import { BabillardController } from '@infrastructure/http/controllers/BabillardController';
import { creerBabillardRoutes } from '@infrastructure/http/routes/babillard.routes';
import { PrismaPublicationRepository } from '@infrastructure/persistence/prisma/PrismaPublicationRepository';
import { CreerPublicationUseCase } from '@application/babillard/CreerPublicationUseCase';
import { ModifierPublicationUseCase } from '@application/babillard/ModifierPublicationUseCase';
import { SupprimerPublicationUseCase } from '@application/babillard/SupprimerPublicationUseCase';
import { ListerPublicationsUseCase } from '@application/babillard/ListerPublicationsUseCase';
import { MarquerPublicationLueUseCase } from '@application/babillard/MarquerPublicationLueUseCase';
import { EpinglerPublicationUseCase } from '@application/babillard/EpinglerPublicationUseCase';
import { CalculerStatistiquesLectureUseCase } from '@application/babillard/CalculerStatistiquesLectureUseCase';
import { UploaderPieceJointeUseCase } from '@application/babillard/UploaderPieceJointeUseCase';
import { InngestEventPublisher } from '@infrastructure/events/InngestEventPublisher';
import { creerMessagerieRoutes } from '@infrastructure/http/routes/messagerie.routes';
import { creerApeeRoutes } from '@infrastructure/http/routes/apee.routes';
import { creerDisciplineCouncilRoutes } from '@infrastructure/http/routes/disciplineCouncil.routes';
import { PrismaAnnouncementRepository } from '@infrastructure/persistence/prisma/PrismaAnnouncementRepository';
import { PrismaMessagerieRepository } from '@infrastructure/persistence/prisma/PrismaMessagerieRepository';
import { PrismaApeeRepository } from '@infrastructure/persistence/prisma/PrismaApeeRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaEntranceExamRepository } from '@infrastructure/persistence/prisma/PrismaEntranceExamRepository';
import { PrismaPebsExamRepository } from '@infrastructure/persistence/prisma/PrismaPebsExamRepository';
import { PrismaRapportsScolariteRepository } from '@infrastructure/persistence/prisma/PrismaRapportsScolariteRepository';
import { GenererRapportsScolariteUseCase } from '@application/rapports/GenererRapportsScolariteUseCase';
import { RapportsStaffController } from '@infrastructure/http/controllers/RapportsStaffController';
import { creerRapportsStaffRoutes } from '@infrastructure/http/routes/rapportsStaff.routes';
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
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { RealtimeSocketAdapter } from '@infrastructure/socket/RealtimeSocketAdapter';


import { registerModulesRoutes } from './modules';
type Container = ReturnType<typeof creerContainer>;

export function registerRegistrationsRoutes(app: Application, p: typeof prisma = prisma, c: Container): void {
  const classeController = new ClasseController(
    c.class.creer,
    c.class.modifier,
    c.class.supprimer,
    c.class.assignerProfesseur,
    c.class.creerSousGroupe,
    c.class.assignerEleves,
    c.studentGroup.assignerSalleClasse,
    c.studentGroup.retirerAssignationSalle,
    new AIActionAuditAdapter(prisma),
    c.class.listerEleves,
    undefined as any,
    c.class.genererTableauHonneur,
    c.class.genererTableauHonneurAnnuel,
    c.activityLog,
  );

  const subjectController = new SubjectController(
    c.subject.creer,
    c.subject.modifier,
    c.subject.assignerEnseignant,
    c.subject.definirCoefficient,
    c.subject.supprimer,
  );

  const roomController = new RoomController(
    c.room.creer,
    c.room.modifier,
    c.room.supprimer,
    new AIActionAuditAdapter(prisma),
  );

  const teacherUnavailabilityController = new TeacherUnavailabilityController(
    c.teacherUnavailability.creer,
    c.teacherUnavailability.modifier,
    c.teacherUnavailability.supprimer,
    c.teacherUnavailability.lister,
    new AIActionAuditAdapter(prisma),
  );

  const studentGroupController = new StudentGroupController(
    c.studentGroup.creerGroupSet,
    c.studentGroup.modifierGroupSet,
    c.studentGroup.supprimerGroupSet,
    c.studentGroup.creerGroup,
    c.studentGroup.modifierGroup,
    c.studentGroup.supprimerGroup,
  );

  app.use('/api/v2/classes', creerClasseRoutes(classeController));
  app.use('/api/v2/subjects', creerSubjectRoutes(subjectController));
  app.use('/api/v2/rooms', creerRoomRoutes(roomController));
  app.use('/api/v2/teacher-unavailabilities', creerTeacherUnavailabilityRoutes(teacherUnavailabilityController));
  app.use('/api/v2/student-groups', creerStudentGroupRoutes(studentGroupController));


  // ── Interopérabilité statistique MINESEC ────────────────────────────────
  const statisticalCampaignController = new StatisticalCampaignController(
    c.statisticalCampaign.verifierCompletude,
    c.statisticalCampaign.genererDeclaration,
    c.statisticalCampaign.repository,
  );
  app.use('/api/v2/statistical-campaign', creerStatisticalCampaignRoutes(statisticalCampaignController));

  // ── Interopérabilité statistique MINEDUB (rapport PDF non officiel) ────
  const statisticalCampaignMinedubController = new StatisticalCampaignMinedubController(
    c.statisticalCampaignMinedub.genererRapport,
    c.statisticalCampaignMinedub.repository,
  );
  app.use('/api/v2/statistical-campaign-minedub', creerStatisticalCampaignMinedubRoutes(statisticalCampaignMinedubController));

  // ── Paiements MINESEC ───────────────────────────────────────────────────
  const paiementMinesecController = new PaiementMinesecController(
    c.paiementMinesec.genererPaiements,
    c.paiementMinesec.genererPaiementsEcole,
    c.paiementMinesec.getDashboard,
    c.paiementMinesec.getOverview,
    c.paiementMinesec.paiementMinesecRepository,
    c.studentDocument.studentProfileRepository,
  );
  app.use('/api/v2/paiements-minesec', creerPaiementMinesecRoutes(paiementMinesecController));

  // ── Inscriptions Examens ────────────────────────────────────────────────
  const examenController = new ExamenController(
    c.examen.prepareDossier,
    c.examen.examDossierRepository,
  );
  app.use('/api/v2/examens', creerExamenRoutes(examenController));

  // ── LV2 Choice (Sous-module C) ─────────────────────────────────────────
  const lv2ChoiceController = new Lv2ChoiceController(
    new PrismaLv2ChoiceRepository(p),
    c.lv2Choice.ouvrirFenetre,
    c.lv2Choice.soumettreChoix,
    c.lv2Choice.saisirManuel,
    c.lv2Choice.appliquerChoix,
    c.lv2Choice.suivreFenetre,
    new AIActionAuditAdapter(p),
  );
  app.use('/api/v2/lv2-choice-windows', creerLv2ChoiceRoutes(lv2ChoiceController));
  app.use('/api/v2/students/me', creerLv2ChoiceStudentRoutes(lv2ChoiceController));

  // ── Entrance Exams (Sous-module A) ─────────────────────────────────────
  const entranceExamPdfAdapter = new PdfKitEntranceExamAdapter();
  const entranceExamController = new EntranceExamController(
    c.entranceExam.creerSession,
    c.entranceExam.ajouterCandidats,
    c.entranceExam.calculerAdmission,
    c.entranceExam.enregistrerCep,
    c.entranceExam.resumeSession,
    c.entranceExam.scannerListe,
    c.entranceExam.detecterAnomalies,
    c.entranceExam.inscrireCandidat,
    c.entranceExam.repartirSalles,
    c.entranceExam.saisirNotes,
    c.entranceExam.simulerDeliberation,
    c.entranceExam.publierResultats,
    c.entranceExam.finaliserAdmissions,
    new PrismaEntranceExamRepository(p),
    c.school.schoolRepository,
    entranceExamPdfAdapter,
    new AIActionAuditAdapter(p),
    undefined,
    c.entranceExam.estimerCampagneSms,
    c.entranceExam.proposerSaisieLotCep,
    c.entranceExam.appliquerSaisieLotCep,
  );
  const entranceExamPublicController = new EntranceExamPublicController(
    c.entranceExam.consulterResultatPublic
  );
  app.use('/api/v2/entrance-exams', creerEntranceExamRoutes(entranceExamController, entranceExamPublicController));

  // ── PEBS Exams (Sous-module B) ─────────────────────────────────────────
  const pebsExamController = new PebsExamController(
    c.pebsExam.creerSession,
    c.pebsExam.ajouterCandidats,
    c.pebsExam.calculerSelection,
    c.pebsExam.appliquerTransfert,
    c.pebsExam.resumeSession,
    c.pebsExam.scannerListe,
    c.pebsExam.detecterAnomalies,
    new PrismaPebsExamRepository(p),
    new AIActionAuditAdapter(p),
  );
  app.use('/api/v2/pebs-exams', creerPebsExamRoutes(pebsExamController));

  // ── Push Notifications (Web Push) ────────────────────────────────────────────
  const pushNotificationController = new PushNotificationController(
    c.pushNotification.souscrire,
    c.pushNotification.desinscrire,
  );
  app.use('/api/v2/push', creerPushNotificationRoutes(pushNotificationController));

  // ── Notifications IN_APP (cloche) ────────────────────────────────────────────
  const notificationController = new NotificationController(c.notification.service);
  app.use('/api/v2/notifications', creerNotificationRoutes(notificationController));

  // ── Babillard numérique (rétrocompatibilité) ───────────────────────────────
  const announcementRepository = new PrismaAnnouncementRepository(p);
  const creerAnnonceUseCase = new CreerAnnonceUseCase(announcementRepository);
  const listerAnnoncesUseCase = new ListerAnnoncesUseCase(announcementRepository);
  const modifierAnnonceUseCase = new ModifierAnnonceUseCase(announcementRepository);
  const supprimerAnnonceUseCase = new SupprimerAnnonceUseCase(announcementRepository);
  const announcementController = new AnnouncementController(
    new PrismaUserRepository(p),
    creerAnnonceUseCase,
    listerAnnoncesUseCase,
    modifierAnnonceUseCase,
    supprimerAnnonceUseCase,
  );
  app.use('/api/v2/announcements', creerAnnouncementRoutes(announcementController));

  // ── Babillard Officiel (nouvelle architecture) ──────────────────────────────
  const publicationRepository = new PrismaPublicationRepository(p);
  const inngestEventPublisher = new InngestEventPublisher();
  const creerPublicationUseCase = new CreerPublicationUseCase(publicationRepository, inngestEventPublisher);
  const modifierPublicationUseCase = new ModifierPublicationUseCase(publicationRepository);
  const supprimerPublicationUseCase = new SupprimerPublicationUseCase(publicationRepository);
  const listerPublicationsUseCase = new ListerPublicationsUseCase(publicationRepository);
  const marquerLueUseCase = new MarquerPublicationLueUseCase(publicationRepository);
  const epinglerPublicationUseCase = new EpinglerPublicationUseCase(publicationRepository);
  const calculerStatsUseCase = new CalculerStatistiquesLectureUseCase(publicationRepository);
  const uploaderPjUseCase = new UploaderPieceJointeUseCase();

  const babillardController = new BabillardController(
    p,
    publicationRepository,
    creerPublicationUseCase,
    modifierPublicationUseCase,
    supprimerPublicationUseCase,
    listerPublicationsUseCase,
    marquerLueUseCase,
    epinglerPublicationUseCase,
    calculerStatsUseCase,
    uploaderPjUseCase,
  );
  app.use('/api/v2/babillard', creerBabillardRoutes(babillardController));

  // ── Messagerie bidirectionnelle ──────────────────────────────────────────────
  const messagerieRepository = new PrismaMessagerieRepository(p);
  const notificationService = new SocketNotificationService();
  const realtimeSocketAdapter = new RealtimeSocketAdapter();
  const envoyerMessageUseCase = new EnvoyerMessageUseCase(messagerieRepository, notificationService, realtimeSocketAdapter);
  const listerConversationsUseCase = new ListerConversationsUseCase(messagerieRepository);
  const listerMessagesUseCase = new ListerMessagesUseCase(messagerieRepository);
  const marquerLusUseCase = new MarquerMessagesLusUseCase(messagerieRepository, realtimeSocketAdapter);
  const modererMessageUseCase = new ModererMessageUseCase(messagerieRepository, notificationService);
  const listerEnAttenteModerationUseCase = new ListerMessagesEnAttenteModerationUseCase(messagerieRepository);
  const listerContactsMessagerieUseCase = new ListerContactsMessagerieUseCase(messagerieRepository);
  const compterMessagesNonLusUseCase = new CompterMessagesNonLusUseCase(messagerieRepository);
  const messagerieController = new MessagerieController(
    envoyerMessageUseCase,
    listerConversationsUseCase,
    listerMessagesUseCase,
    marquerLusUseCase,
    modererMessageUseCase,
    listerEnAttenteModerationUseCase,
    listerContactsMessagerieUseCase,
    compterMessagesNonLusUseCase,
  );
  app.use('/api/v2/messagerie', creerMessagerieRoutes(messagerieController));

  // ── Transparence financière APEE ─────────────────────────────────────────────
  const apeeController = new APEEController(new PrismaApeeRepository(p), c.school.schoolRepository, new AIActionAuditAdapter(p));
  app.use('/api/v2/apee', creerApeeRoutes(apeeController));

  // ── Rapports & Statistiques Scolarité (Secrétariat & Direction) ───────────
  const rapportsRepository = new PrismaRapportsScolariteRepository(p);
  const genererRapportsUseCase = new GenererRapportsScolariteUseCase(rapportsRepository);
  const rapportsStaffController = new RapportsStaffController(genererRapportsUseCase);
  app.use('/api/v2/rapports', creerRapportsStaffRoutes(rapportsStaffController));

  registerModulesRoutes(app, p, c);
}
