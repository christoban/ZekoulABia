import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaStatisticalQueryAdapter } from '@infrastructure/persistence/prisma/PrismaStatisticalQueryAdapter';
import { PrismaStatisticalCampaignRepository } from '@infrastructure/persistence/prisma/PrismaStatisticalCampaignRepository';
import { PrismaMinedubReportRepository } from '@infrastructure/persistence/prisma/PrismaMinedubReportRepository';
import { PrismaExamDossierRepository } from '@infrastructure/persistence/prisma/PrismaExamDossierRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaEntranceExamRepository } from '@infrastructure/persistence/prisma/PrismaEntranceExamRepository';
import { PrismaPebsExamRepository } from '@infrastructure/persistence/prisma/PrismaPebsExamRepository';
import { PdfKitEntranceExamAdapter } from '@infrastructure/pdf/entranceExam/PdfKitEntranceExamAdapter';
import { VerifierCompletudeSupplementUseCase } from '@application/statisticalCampaign/VerifierCompletudeSupplementUseCase';
import { GenererDeclarationStatistiqueMinesecUseCase } from '@application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase';
import { GenererRapportSyntheseMinedubUseCase } from '@application/statisticalCampaignMinedub/GenererRapportSyntheseMinedubUseCase';
import { GenererPaiementsMinesecUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecUseCase';
import { GenererPaiementsMinesecPourEcoleUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecPourEcoleUseCase';
import { GetStudentPaymentDashboardUseCase } from '@application/paiementMinesec/GetStudentPaymentDashboardUseCase';
import { GetSchoolPaymentOverviewUseCase } from '@application/paiementMinesec/GetSchoolPaymentOverviewUseCase';
import { PrepareExamDossierUseCase } from '@application/examen/PrepareExamDossierUseCase';
import { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import { SoumettreChoixLV2EleveUseCase } from '@application/lv2Choice/SoumettreChoixLV2EleveUseCase';
import { SaisirChoixLV2ManuelUseCase } from '@application/lv2Choice/SaisirChoixLV2ManuelUseCase';
import { AppliquerChoixLV2UseCase } from '@application/lv2Choice/AppliquerChoixLV2UseCase';
import { SuivreFenetreChoixLV2UseCase } from '@application/lv2Choice/SuivreFenetreChoixLV2UseCase';
import { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';
import { InscrireCandidatConcoursUseCase } from '@application/entranceExam/InscrireCandidatConcoursUseCase';
import { RepartirCandidatsSallesUseCase } from '@application/entranceExam/RepartirCandidatsSallesUseCase';
import { SaisirNotesConcoursUseCase } from '@application/entranceExam/SaisirNotesConcoursUseCase';
import { SimulerDeliberationConcoursUseCase } from '@application/entranceExam/SimulerDeliberationConcoursUseCase';
import { PublierResultatsConcoursUseCase } from '@application/entranceExam/PublierResultatsConcoursUseCase';
import { ConsulterResultatPublicUseCase } from '@application/entranceExam/ConsulterResultatPublicUseCase';
import { FinaliserAdmissionsConcoursUseCase } from '@application/entranceExam/FinaliserAdmissionsConcoursUseCase';
import { EstimerCampagneSmsPublicationUseCase } from '@application/entranceExam/EstimerCampagneSmsPublicationUseCase';
import { ProposerSaisieLotCepUseCase } from '@application/entranceExam/ProposerSaisieLotCepUseCase';
import { AppliquerSaisieLotCepUseCase } from '@application/entranceExam/AppliquerSaisieLotCepUseCase';
import { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import { AjouterCandidatsPebsUseCase } from '@application/pebsExam/AjouterCandidatsPebsUseCase';
import { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import { AppliquerTransfertPebsUseCase } from '@application/pebsExam/AppliquerTransfertPebsUseCase';
import { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import { ScannerListeCandidatsPebsUseCase } from '@application/pebsExam/ScannerListeCandidatsPebsUseCase';
import { DetecterAnomaliesPebsUseCase } from '@application/pebsExam/DetecterAnomaliesPebsUseCase';
import type { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import type { CoreContainerContext } from './coreContext';

export function createExamsCampaignContainer(
  core: CoreContainerContext,
  creerSqueletteOnboarding: CreerSqueletteOnboardingUseCase,
) {
  const statisticalCampaignRepository = new PrismaStatisticalCampaignRepository(prisma);
  const statisticalQueryAdapter = new PrismaStatisticalQueryAdapter(prisma);
  const verifierCompletudeSupplement = new VerifierCompletudeSupplementUseCase(statisticalCampaignRepository);
  const minedubReportRepository = new PrismaMinedubReportRepository(prisma);
  const examDossierRepository = new PrismaExamDossierRepository(prisma);
  const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(prisma);
  const studentAffectationRepository = new PrismaStudentAffectationRepository(prisma);
  const entranceExamRepository = new PrismaEntranceExamRepository(prisma);
  const pebsExamRepository = new PrismaPebsExamRepository(prisma);
  const genererPaiementsMinesec = new GenererPaiementsMinesecUseCase(core.paiementMinesecRepository);

  return {
    statisticalCampaign: {
      verifierCompletude: verifierCompletudeSupplement,
      genererDeclaration: new GenererDeclarationStatistiqueMinesecUseCase(
        statisticalQueryAdapter,
        statisticalCampaignRepository,
        verifierCompletudeSupplement,
        core.fileStorage,
      ),
      repository: statisticalCampaignRepository,
    },
    statisticalCampaignMinedub: {
      repository: minedubReportRepository,
      genererRapport: new GenererRapportSyntheseMinedubUseCase(
        statisticalQueryAdapter,
        minedubReportRepository,
        core.fileStorage,
      ),
    },
    paiementMinesec: {
      genererPaiements: genererPaiementsMinesec,
      genererPaiementsEcole: new GenererPaiementsMinesecPourEcoleUseCase(
        core.paiementMinesecRepository,
        genererPaiementsMinesec,
      ),
      getDashboard: new GetStudentPaymentDashboardUseCase(core.paiementMinesecRepository),
      getOverview: new GetSchoolPaymentOverviewUseCase(core.paiementMinesecRepository),
      paiementMinesecRepository: core.paiementMinesecRepository,
    },
    examen: {
      prepareDossier: new PrepareExamDossierUseCase(examDossierRepository),
      examDossierRepository,
    },
    lv2Choice: {
      ouvrirFenetre: new OuvrirFenetreChoixLV2UseCase(lv2ChoiceRepository),
      soumettreChoix: new SoumettreChoixLV2EleveUseCase(lv2ChoiceRepository, studentAffectationRepository),
      saisirManuel: new SaisirChoixLV2ManuelUseCase(lv2ChoiceRepository, studentAffectationRepository),
      appliquerChoix: new AppliquerChoixLV2UseCase(
        lv2ChoiceRepository,
        studentAffectationRepository,
        core.anneeRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
      ),
      suivreFenetre: new SuivreFenetreChoixLV2UseCase(lv2ChoiceRepository),
    },
    lv2pebs: {
      affecterLV2Eleve: new AffecterLV2EleveUseCase(
        studentAffectationRepository,
        core.anneeRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
      ),
      affecterLV2EnMasse: new AffecterLV2EnMasseUseCase(
        studentAffectationRepository,
        core.anneeRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
      ),
      affecterPEBSEleve: new AffecterPEBSEleveUseCase(
        studentAffectationRepository,
        core.anneeRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
      ),
      affecterPEBSEnMasse: new AffecterPEBSEnMasseUseCase(
        studentAffectationRepository,
        core.anneeRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
      ),
    },
    entranceExam: {
      creerSession: new CreerSessionConcoursUseCase(entranceExamRepository, core.notifierEvenement),
      ajouterCandidats: new AjouterCandidatsConcoursUseCase(entranceExamRepository),
      calculerAdmission: new CalculerAdmissionConcoursUseCase(entranceExamRepository),
      enregistrerCep: new EnregistrerResultatCepUseCase(
        entranceExamRepository,
        creerSqueletteOnboarding,
        core.notifierEvenement,
      ),
      resumeSession: new ResumeSessionConcoursUseCase(entranceExamRepository),
      scannerListe: new ScannerListeCandidatsUseCase(entranceExamRepository, core.documentAiAdapter),
      detecterAnomalies: new DetecterAnomaliesConcoursUseCase(entranceExamRepository),
      inscrireCandidat: new InscrireCandidatConcoursUseCase(entranceExamRepository),
      repartirSalles: new RepartirCandidatsSallesUseCase(entranceExamRepository),
      saisirNotes: new SaisirNotesConcoursUseCase(entranceExamRepository),
      simulerDeliberation: new SimulerDeliberationConcoursUseCase(entranceExamRepository),
      publierResultats: new PublierResultatsConcoursUseCase(
        entranceExamRepository,
        core.smsNotificationAdapter,
        core.schoolRepository,
      ),
      estimerCampagneSms: new EstimerCampagneSmsPublicationUseCase(entranceExamRepository, core.schoolRepository),
      proposerSaisieLotCep: new ProposerSaisieLotCepUseCase(entranceExamRepository),
      appliquerSaisieLotCep: new AppliquerSaisieLotCepUseCase(
        entranceExamRepository,
        creerSqueletteOnboarding,
        core.smsNotificationAdapter,
        core.schoolRepository,
      ),
      consulterResultatPublic: new ConsulterResultatPublicUseCase(entranceExamRepository),
      finaliserAdmissions: new FinaliserAdmissionsConcoursUseCase(entranceExamRepository, creerSqueletteOnboarding),
      pdfPort: new PdfKitEntranceExamAdapter(),
    },
    pebsExam: {
      creerSession: new CreerSessionPebsUseCase(pebsExamRepository, core.notifierEvenement),
      ajouterCandidats: new AjouterCandidatsPebsUseCase(pebsExamRepository),
      calculerSelection: new CalculerSelectionPebsUseCase(pebsExamRepository),
      appliquerTransfert: new AppliquerTransfertPebsUseCase(
        pebsExamRepository,
        core.anneeRepository,
        core.enrollmentRepository,
        studentAffectationRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
        core.notifierEvenement,
      ),
      resumeSession: new ResumeSessionPebsUseCase(pebsExamRepository),
      scannerListe: new ScannerListeCandidatsPebsUseCase(pebsExamRepository, core.documentAiAdapter),
      detecterAnomalies: new DetecterAnomaliesPebsUseCase(pebsExamRepository),
    },
  };
}
