import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaStudentProfileRepository } from '@infrastructure/persistence/prisma/PrismaStudentProfileRepository';
import { PrismaStudentDocumentRepository } from '@infrastructure/persistence/prisma/PrismaStudentDocumentRepository';
import { PrismaTeachingAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaTeachingAssignmentRepository';
import { PrismaStudentRecommendationRepository } from '@infrastructure/persistence/prisma/PrismaStudentRecommendationRepository';
import { PrismaBulletinValidationRepository } from '@infrastructure/persistence/prisma/PrismaBulletinValidationRepository';
import { PrismaMessagerieRepository } from '@infrastructure/persistence/prisma/PrismaMessagerieRepository';
import { PrismaSousGroupeRepository } from '@infrastructure/persistence/prisma/PrismaSousGroupeRepository';
import { PrismaClasseCoefficientRepository } from '@infrastructure/persistence/prisma/PrismaClasseCoefficientRepository';
import { PrismaDisciplineRepository } from '@infrastructure/persistence/prisma/PrismaDisciplineRepository';
import { PrismaBulletinTemplateAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaBulletinTemplateAssignmentRepository';
import { PrismaBulletinTemplateSpecRepository } from '@infrastructure/persistence/prisma/PrismaBulletinTemplateSpecRepository';
import { PrismaSchoolIdentityKitRepository } from '@infrastructure/persistence/prisma/PrismaSchoolIdentityKitRepository';
import { PrismaPromotionRepository } from '@infrastructure/persistence/prisma/PrismaPromotionRepository';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { PrismaClassCouncilPreviewQueryPort } from '@infrastructure/persistence/prisma/PrismaClassCouncilPreviewQueryPort';
import { PrismaAcademicProfileQueryRepository } from '@infrastructure/persistence/prisma/PrismaAcademicProfileQueryRepository';
import { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { VerifierDisponibiliteBulletinUseCase } from '@application/reportCard/VerifierDisponibiliteBulletinUseCase';
import { ListerBulletinsUseCase } from '@application/reportCard/ListerBulletinsUseCase';
import { SoumettreBulletinsClasseUseCase } from '@application/reportCard/SoumettreBulletinsClasseUseCase';
import { ValiderBulletinsClasseUseCase } from '@application/reportCard/ValiderBulletinsClasseUseCase';
import { PublierBulletinsClasseUseCase } from '@application/reportCard/PublierBulletinsClasseUseCase';
import { TenirConseilClasseUseCase } from '@application/classCouncil/TenirConseilClasseUseCase';
import { PreparerVueConseilClasseUseCase } from '@application/classCouncil/PreparerVueConseilClasseUseCase';
import { CreerSessionConseilClasseUseCase } from '@application/classCouncil/CreerSessionConseilClasseUseCase';
import { ListerSessionsConseilClasseUseCase } from '@application/classCouncil/ListerSessionsConseilClasseUseCase';
import { ObtenirSessionConseilClasseUseCase } from '@application/classCouncil/ObtenirSessionConseilClasseUseCase';
import { AjouterDecisionConseilClasseUseCase } from '@application/classCouncil/AjouterDecisionConseilClasseUseCase';
import { AjouterDecisionsEnBlocUseCase } from '@application/classCouncil/AjouterDecisionsEnBlocUseCase';
import { VerrouillerConseilClasseUseCase } from '@application/classCouncil/VerrouillerConseilClasseUseCase';
import { GenererProcesVerbalUseCase } from '@application/classCouncil/GenererProcesVerbalUseCase';
import { GenererRapportConseilUseCase } from '@application/classCouncil/GenererRapportConseilUseCase';
import { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import { CreerCanalClasseUseCase } from '@application/messagerie/CreerCanalClasseUseCase';
import { CreerCanalParentsUseCase } from '@application/messagerie/CreerCanalParentsUseCase';
import { ModifierClasseUseCase } from '@application/class/ModifierClasseUseCase';
import { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import { CreerSousGroupeTPUseCase } from '@application/class/CreerSousGroupeTPUseCase';
import { AssignerElevesAuSousGroupeUseCase } from '@application/class/AssignerElevesAuSousGroupeUseCase';
import { GererMatiereClasseUseCase } from '@application/classe/GererMatiereClasseUseCase';
import { ListerElevesClasseUseCase } from '@application/classe/ListerElevesClasseUseCase';
import { GenererTableauHonneurUseCase } from '@application/classe/GenererTableauHonneurUseCase';
import { GenererTableauHonneurAnnuelUseCase } from '@application/classe/GenererTableauHonneurAnnuelUseCase';
import { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import { DefinirCoefficientUseCase } from '@application/subject/DefinirCoefficientUseCase';
import { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';
import { CreerAnneeAcademiqueUseCase } from '@application/academicYear/CreerAnneeAcademiqueUseCase';
import { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import { CloturerAnneeUseCase } from '@application/academicYear/CloturerAnneeUseCase';
import { ProposerStructureAnneeSuivanteUseCase } from '@application/academicYear/ProposerStructureAnneeSuivanteUseCase';
import { ValiderStructureAnneeSuivanteUseCase } from '@application/academicYear/ValiderStructureAnneeSuivanteUseCase';
import { AnnulerStructureProposeeUseCase } from '@application/academicYear/AnnulerStructureProposeeUseCase';
import { MettreAJourCalendrierUseCase } from '@application/academicYear/MettreAJourCalendrierUseCase';
import { ObtenirProfilAcademiqueUseCase } from '@application/student/ObtenirProfilAcademiqueUseCase';
import type { AutoMaterialisationProgrammesPort } from '@domain/ports/services/AutoMaterialisationProgrammesPort';
import type { CoreContainerContext } from './coreContext';

export function createAcademicContainer(
  core: CoreContainerContext,
  autoMaterialisation?: AutoMaterialisationProgrammesPort,
) {
  const studentProfileRepository = new PrismaStudentProfileRepository(prisma);
  const studentDocumentRepository = new PrismaStudentDocumentRepository(prisma);
  const teachingAssignmentRepository = new PrismaTeachingAssignmentRepository(prisma);
  const studentRecommendationRepository = new PrismaStudentRecommendationRepository(prisma);
  const bulletinValidationRepository = new PrismaBulletinValidationRepository(prisma);
  const messagerieRepository = new PrismaMessagerieRepository(prisma);
  const sousGroupeRepository = new PrismaSousGroupeRepository(prisma);
  const classeCoefficientRepository = new PrismaClasseCoefficientRepository(prisma);
  const disciplineRepository = new PrismaDisciplineRepository(prisma);
  const bulletinAssignmentRepository = new PrismaBulletinTemplateAssignmentRepository(prisma);
  const templateSpecRepository = new PrismaBulletinTemplateSpecRepository(prisma);
  const schoolIdentityKitRepository = new PrismaSchoolIdentityKitRepository(prisma);
  const promotionRepository = new PrismaPromotionRepository(prisma, core.enrollmentRepository);
  const bulletinRenderer = new MeasuredPdfKitBulletinRenderer();

  const envoyerBulletinsUseCase = new EnvoyerBulletinsUseCase(
    core.bulletinRepository,
    core.userRepository,
    core.emailService,
    bulletinValidationRepository,
  );

  const reportCard = {
    generer: new GenererBulletinUseCase(
      core.noteRepository,
      core.bulletinRepository,
      core.classeRepository,
      core.userRepository,
      core.matiereRepository,
      core.anneeRepository,
      core.presenceRepository,
      core.pdfService,
      core.classCouncilRepository,
      core.schoolRepository,
      core.sectionRepository,
      studentProfileRepository,
      classeCoefficientRepository,
      teachingAssignmentRepository,
      disciplineRepository,
      core.schoolConfigRepository,
      bulletinAssignmentRepository,
      bulletinRenderer,
      core.fileStorage,
      core.sequenceAbsenceRepository,
      schoolIdentityKitRepository,
      templateSpecRepository,
    ),
    envoyer: envoyerBulletinsUseCase,
    verifierDisponibilite: new VerifierDisponibiliteBulletinUseCase(
      core.anneeRepository,
      core.noteRepository,
      core.classCouncilRepository,
    ),
    lister: new ListerBulletinsUseCase(core.bulletinRepository, core.parentRepository),
    soumettreBulletins: new SoumettreBulletinsClasseUseCase(
      core.classeRepository,
      core.bulletinRepository,
      bulletinValidationRepository,
    ),
    validerBulletins: new ValiderBulletinsClasseUseCase(
      bulletinValidationRepository,
      core.bulletinRepository,
      bulletinRenderer,
      core.fileStorage,
      core.schoolConfigRepository,
      templateSpecRepository,
    ),
    publierBulletins: new PublierBulletinsClasseUseCase(
      bulletinValidationRepository,
      core.bulletinRepository,
      envoyerBulletinsUseCase,
      bulletinRenderer,
      core.fileStorage,
      core.schoolConfigRepository,
      templateSpecRepository,
    ),
    bulletinValidationRepository,
    bulletinRepository: core.bulletinRepository,
    parentRepository: core.parentRepository,
    bulletinAssignmentRepository,
    templateSpecRepository,
    bulletinRenderer,
    schoolIdentityKitRepository,
    studentRecommendationRepository,
  };

  const classCouncil = {
    creerSession: new CreerSessionConseilClasseUseCase(core.classCouncilRepository, core.activityLog, core.auditLog),
    tenir: new TenirConseilClasseUseCase(core.noteRepository, core.classeRepository, core.userRepository),
    preparerVue: new PreparerVueConseilClasseUseCase(
      new PrismaClassCouncilPreviewQueryPort(prisma),
      core.classCouncilRepository,
    ),
    listerSessions: new ListerSessionsConseilClasseUseCase(core.classCouncilRepository),
    obtenirSession: new ObtenirSessionConseilClasseUseCase(core.classCouncilRepository),
    ajouterDecision: new AjouterDecisionConseilClasseUseCase(core.classCouncilRepository),
    ajouterDecisionsEnBloc: new AjouterDecisionsEnBlocUseCase(core.classCouncilRepository),
    verrouiller: new VerrouillerConseilClasseUseCase(core.classCouncilRepository, core.activityLog),
    genererPV: new GenererProcesVerbalUseCase(core.classCouncilRepository),
    genererRapport: new GenererRapportConseilUseCase(core.classCouncilRepository),
  };

  const creerClasseUseCase = new CreerClasseUseCase(
    core.classeRepository,
    core.anneeRepository,
    core.matiereRepository,
    new CreerCanalClasseUseCase(messagerieRepository),
    new CreerCanalParentsUseCase(messagerieRepository),
    autoMaterialisation,
  );

  const classGroup = {
    creer: creerClasseUseCase,
    modifier: new ModifierClasseUseCase(core.classeRepository),
    supprimer: new SupprimerClasseUseCase(core.classeRepository),
    assignerProfesseur: new AssignerProfesseurPrincipalUseCase(
      core.classeRepository,
      core.userRepository,
      core.rattachementRepository,
    ),
    creerSousGroupe: new CreerSousGroupeTPUseCase(core.classeRepository, sousGroupeRepository),
    assignerEleves: new AssignerElevesAuSousGroupeUseCase(sousGroupeRepository),
    listerEleves: new ListerElevesClasseUseCase(
      core.classeRepository,
      core.userRepository,
      core.noteRepository,
      core.presenceRepository,
      core.getMetricUseCase,
    ),
    gererMatiere: new GererMatiereClasseUseCase(core.classeRepository, classeCoefficientRepository),
    genererTableauHonneur: new GenererTableauHonneurUseCase(
      core.classeRepository,
      core.anneeRepository,
      core.schoolRepository,
      core.bulletinRepository,
      core.classCouncilRepository,
      core.pdfService,
    ),
    genererTableauHonneurAnnuel: new GenererTableauHonneurAnnuelUseCase(
      core.classeRepository,
      core.anneeRepository,
      core.schoolRepository,
      core.bulletinRepository,
      core.classCouncilRepository,
      core.pdfService,
    ),
    classeCoefficientRepository,
    teachingAssignmentRepository,
  };

  const subject = {
    creer: new CreerMatiereUseCase(core.matiereRepository, core.userRepository),
    modifier: new ModifierMatiereUseCase(core.matiereRepository, core.userRepository),
    assignerEnseignant: new AssignerEnseignantMatiereUseCase(core.matiereRepository, core.userRepository),
    definirCoefficient: new DefinirCoefficientUseCase(core.matiereRepository),
    supprimer: new SupprimerMatiereUseCase(core.matiereRepository),
  };

  const academicYear = {
    creer: new CreerAnneeAcademiqueUseCase(core.anneeRepository),
    definirPeriode: new DefinirPeriodeCouranteUseCase(core.anneeRepository),
    verifierPrerequis: new VerifierPrerequisClotureUseCase(core.anneeRepository),
    cloturer: new CloturerAnneeUseCase(core.anneeRepository, promotionRepository, core.activityLog),
    mettreAJourCalendrier: new MettreAJourCalendrierUseCase(core.anneeRepository),
    proposerStructureSuivante: new ProposerStructureAnneeSuivanteUseCase(
      core.anneeRepository,
      core.classeRepository,
      promotionRepository,
    ),
    validerStructureSuivante: new ValiderStructureAnneeSuivanteUseCase(
      core.anneeRepository,
      core.classeRepository,
      autoMaterialisation,
    ),
    annulerStructureSuivante: new AnnulerStructureProposeeUseCase(core.anneeRepository, core.classeRepository),
  };

  return {
    reportCard,
    classCouncil,
    class: classGroup,
    subject,
    academicYear,
    studentDocument: {
      studentProfileRepository,
      schoolRepository: core.schoolRepository,
      anneeRepository: core.anneeRepository,
      bulletinRepository: core.bulletinRepository,
      documentRepository: studentDocumentRepository,
    },
    academicProfile: {
      obtenirProfil: new ObtenirProfilAcademiqueUseCase(
        new PrismaAcademicProfileQueryRepository(prisma),
        core.schoolSettingsRepository,
      ),
    },
  };
}
