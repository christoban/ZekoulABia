import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaAssessmentScopeRepository } from '@infrastructure/persistence/prisma/PrismaAssessmentScopeRepository';
import { PrismaHarmonizedAssessmentSessionRepository } from '@infrastructure/persistence/prisma/PrismaHarmonizedAssessmentSessionRepository';
import { PrismaAssessmentParticipationRepository } from '@infrastructure/persistence/prisma/PrismaAssessmentParticipationRepository';
import { PrismaAnonymatRepository } from '@infrastructure/persistence/prisma/PrismaAnonymatRepository';
import { AnonymatInvitationService } from '@infrastructure/services/notification/AnonymatInvitationService';
import { AnonymatLinkGenerator } from '@infrastructure/services/anonymat/AnonymatLinkGenerator';
import { EnvAppConfig } from '@infrastructure/config/EnvAppConfig';
import { ConsoleLogger } from '@infrastructure/services/logging/ConsoleLogger';
import { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import { VerrouillerNoteUseCase } from '@application/grade/VerrouillerNoteUseCase';
import { VerrouillerNotesEnMasseUseCase } from '@application/grade/VerrouillerNotesEnMasseUseCase';
import { ModifierNoteUseCase } from '@application/grade/ModifierNoteUseCase';
import { DraftEnMasseUseCase } from '@application/grade/DraftEnMasseUseCase';
import { ListerNotesUseCase } from '@application/grade/ListerNotesUseCase';
import { ListerNotesEnAttenteUseCase } from '@application/grade/ListerNotesEnAttenteUseCase';
import { StatutParClasseUseCase } from '@application/grade/StatutParClasseUseCase';
import { CalculerMoyenneUseCase } from '@application/grade/CalculerMoyenneUseCase';
import { ImporterNotesExcelUseCase } from '@application/grade/ImporterNotesExcelUseCase';
import { CreerAssessmentScopeUseCase } from '@application/assessment/CreerAssessmentScopeUseCase';
import { PlanifierAssessmentSessionUseCase } from '@application/assessment/PlanifierAssessmentSessionUseCase';
import { EnregistrerParticipationUseCase } from '@application/assessment/EnregistrerParticipationUseCase';
import { EnregistrerParticipationEnLotUseCase } from '@application/assessment/EnregistrerParticipationEnLotUseCase';
import { GenererCodesAnonymatUseCase } from '@application/assessment/GenererCodesAnonymatUseCase';
import { DesignerEquipeAnonymatUseCase } from '@application/assessment/DesignerEquipeAnonymatUseCase';
import { ObtenirListeAnonymatParTokenUseCase } from '@application/assessment/ObtenirListeAnonymatParTokenUseCase';
import { MarquerAnonymisationTermineeUseCase } from '@application/assessment/MarquerAnonymisationTermineeUseCase';
import { ListerSessionsCorrectionAnonymeUseCase } from '@application/assessment/ListerSessionsCorrectionAnonymeUseCase';
import { AssignerCorrectionAnonymatUseCase } from '@application/assessment/AssignerCorrectionAnonymatUseCase';
import { ObtenirFicheCorrectionAnonymeUseCase } from '@application/assessment/ObtenirFicheCorrectionAnonymeUseCase';
import { SaisirNotesAnonymesUseCase } from '@application/assessment/SaisirNotesAnonymesUseCase';
import { SoumettreCorrectionAnonymeUseCase } from '@application/assessment/SoumettreCorrectionAnonymeUseCase';
import { ReconcilierNotesAnonymesUseCase } from '@application/assessment/ReconcilierNotesAnonymesUseCase';
import type { CoreContainerContext } from './coreContext';

export function createAssessmentGradeContainer(core: CoreContainerContext) {
  const assessmentScopeRepository = new PrismaAssessmentScopeRepository(prisma);
  const assessmentSessionRepository = new PrismaHarmonizedAssessmentSessionRepository(prisma);
  const assessmentParticipationRepository = new PrismaAssessmentParticipationRepository(prisma);
  const anonymatRepository = new PrismaAnonymatRepository(prisma);
  const anonymatInvitation = new AnonymatInvitationService(core.emailService);
  const anonymatLinkGenerator = new AnonymatLinkGenerator(new EnvAppConfig());
  const anonymatLogger = new ConsoleLogger();

  const saisirNoteUseCase = new SaisirNoteUseCase(
    core.noteRepository,
    core.matiereRepository,
    core.userRepository,
    core.rattachementRepository,
    undefined,
    assessmentSessionRepository,
  );
  const verrouillerNoteUseCase = new VerrouillerNoteUseCase(core.noteRepository, core.matiereRepository, core.metricCache);
  const verrouillerNotesEnMasseUseCase = new VerrouillerNotesEnMasseUseCase(
    core.noteRepository,
    core.matiereRepository,
    core.metricCache,
  );
  const modifierNoteUseCase = new ModifierNoteUseCase(
    core.noteRepository,
    core.matiereRepository,
    core.schoolSettingsRepository,
  );
  const draftEnMasseUseCase = new DraftEnMasseUseCase(
    core.noteRepository,
    core.matiereRepository,
    assessmentSessionRepository,
  );
  const listerNotesUseCase = new ListerNotesUseCase(
    core.noteRepository,
    core.userRepository,
    core.matiereRepository,
    core.parentRepository,
  );
  const listerNotesEnAttenteUseCase = new ListerNotesEnAttenteUseCase(core.noteRepository, core.userRepository);
  const statutParClasseUseCase = new StatutParClasseUseCase(core.noteRepository);
  const calculerMoyenneUseCase = new CalculerMoyenneUseCase(
    core.noteRepository,
    core.matiereRepository,
    core.getMetricUseCase,
  );
  const importerNotesExcelUseCase = new ImporterNotesExcelUseCase(
    core.noteRepository,
    core.matiereRepository,
    core.matriculeImportRepository,
    core.rattachementRepository,
  );

  const creerAssessmentScopeUseCase = new CreerAssessmentScopeUseCase(assessmentScopeRepository);
  const planifierAssessmentSessionUseCase = new PlanifierAssessmentSessionUseCase(assessmentSessionRepository);
  const enregistrerParticipationUseCase = new EnregistrerParticipationUseCase(assessmentParticipationRepository);
  const enregistrerParticipationEnLotUseCase = new EnregistrerParticipationEnLotUseCase(assessmentParticipationRepository);
  const genererCodesAnonymatUseCase = new GenererCodesAnonymatUseCase(assessmentSessionRepository, anonymatRepository);
  const designerEquipeAnonymatUseCase = new DesignerEquipeAnonymatUseCase(
    assessmentSessionRepository,
    anonymatRepository,
    anonymatInvitation,
    anonymatLinkGenerator,
    anonymatLogger,
  );
  const obtenirListeAnonymatParTokenUseCase = new ObtenirListeAnonymatParTokenUseCase(anonymatRepository);
  const marquerAnonymisationTermineeUseCase = new MarquerAnonymisationTermineeUseCase(
    anonymatRepository,
    assessmentSessionRepository,
  );
  const assignerCorrectionAnonymatUseCase = new AssignerCorrectionAnonymatUseCase(
    assessmentSessionRepository,
    anonymatRepository,
    core.rattachementRepository,
    assessmentScopeRepository,
  );
  const obtenirFicheCorrectionAnonymeUseCase = new ObtenirFicheCorrectionAnonymeUseCase(
    assessmentSessionRepository,
    anonymatRepository,
  );
  const saisirNotesAnonymesUseCase = new SaisirNotesAnonymesUseCase(assessmentSessionRepository, anonymatRepository);
  const soumettreCorrectionAnonymeUseCase = new SoumettreCorrectionAnonymeUseCase(
    assessmentSessionRepository,
    anonymatRepository,
  );
  const reconcilierNotesAnonymesUseCase = new ReconcilierNotesAnonymesUseCase(
    assessmentSessionRepository,
    anonymatRepository,
    core.noteRepository,
    core.matiereRepository,
    core.anneeRepository,
    assessmentScopeRepository,
  );
  const listerSessionsCorrectionAnonymeUseCase = new ListerSessionsCorrectionAnonymeUseCase(
    anonymatRepository,
    assessmentSessionRepository,
  );

  return {
    grade: {
      saisirNote: saisirNoteUseCase,
      verrouillerNote: verrouillerNoteUseCase,
      verrouillerNotesEnMasse: verrouillerNotesEnMasseUseCase,
      modifierNote: modifierNoteUseCase,
      draftEnMasse: draftEnMasseUseCase,
      listerNotes: listerNotesUseCase,
      listerNotesEnAttente: listerNotesEnAttenteUseCase,
      statutParClasse: statutParClasseUseCase,
      calculerMoyenne: calculerMoyenneUseCase,
      importerNotesExcel: importerNotesExcelUseCase,
    },
    assessment: {
      scopeRepository: assessmentScopeRepository,
      sessionRepository: assessmentSessionRepository,
      participationRepository: assessmentParticipationRepository,
      anonymatRepository,
      creerScope: creerAssessmentScopeUseCase,
      planifierSession: planifierAssessmentSessionUseCase,
      enregistrerParticipation: enregistrerParticipationUseCase,
      enregistrerParticipationEnLot: enregistrerParticipationEnLotUseCase,
      genererCodesAnonymat: genererCodesAnonymatUseCase,
      designerEquipeAnonymat: designerEquipeAnonymatUseCase,
      obtenirListeAnonymatParToken: obtenirListeAnonymatParTokenUseCase,
      marquerAnonymisationTerminee: marquerAnonymisationTermineeUseCase,
      assignerCorrectionAnonymat: assignerCorrectionAnonymatUseCase,
      obtenirFicheCorrectionAnonyme: obtenirFicheCorrectionAnonymeUseCase,
      saisirNotesAnonymes: saisirNotesAnonymesUseCase,
      soumettreCorrectionAnonyme: soumettreCorrectionAnonymeUseCase,
      reconcilierNotesAnonymes: reconcilierNotesAnonymesUseCase,
      listerSessionsCorrectionAnonyme: listerSessionsCorrectionAnonymeUseCase,
    },
  };
}
