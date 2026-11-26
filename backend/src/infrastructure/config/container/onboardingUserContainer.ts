import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { politiqueEnvoiSortantPlateforme } from '@infrastructure/services/outbound/OutboundMessagingPolicy';
import { PrismaSchoolActivationRepository } from '@infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { PrismaInvitationRepository } from '@infrastructure/persistence/prisma/PrismaInvitationRepository';
import { PrismaImportUtilisateursRepository } from '@infrastructure/persistence/prisma/PrismaImportUtilisateursRepository';
import { PrismaSchoolTemplateVersionRepository } from '@infrastructure/persistence/prisma/PrismaSchoolTemplateVersionRepository';
import { PrismaMasterAdminQueryRepository } from '@infrastructure/persistence/prisma/PrismaMasterAdminQueryRepository';
import { PrismaEleveOnboardingRepository } from '@infrastructure/persistence/prisma/PrismaEleveOnboardingRepository';
import { JwtTokenService } from '@infrastructure/services/auth/JwtTokenService';
import { MfaServiceAdapter } from '@infrastructure/services/auth/MfaServiceAdapter';
import { PdfKitFicheInscriptionAdapter } from '@infrastructure/pdf/onboarding/FicheInscriptionPdfRenderer';
import { CarteScolaireScrapingAdapter } from '@infrastructure/services/scraping/CarteScolaireScrapingAdapter';
import { OnboarderEcoleUseCase } from '@application/school/OnboarderEcoleUseCase';
import { ApprouverEcoleUseCase } from '@application/school/ApprouverEcoleUseCase';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { ObtenirParametresEcoleUseCase } from '@application/schoolSettings/ObtenirParametresEcoleUseCase';
import { MettreAJourParametresEcoleUseCase } from '@application/schoolSettings/MettreAJourParametresEcoleUseCase';
import { ProposerReapplicationTemplateUseCase } from '@application/schoolSettings/ProposerReapplicationTemplateUseCase';
import { AppliquerReapplicationTemplateUseCase } from '@application/schoolSettings/AppliquerReapplicationTemplateUseCase';
import { ConnecterUtilisateurUseCase } from '@application/user/ConnecterUtilisateurUseCase';
import { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import { MfaUseCase } from '@application/user/MfaUseCase';
import { InviterEcoleUseCase } from '@application/masterAdmin/InviterEcoleUseCase';
import { SuspendreEcoleUseCase } from '@application/masterAdmin/SuspendreEcoleUseCase';
import { ReactiverEcoleUseCase } from '@application/masterAdmin/ReactiverEcoleUseCase';
import { RejeterEcoleUseCase } from '@application/masterAdmin/RejeterEcoleUseCase';
import { ChangerPlanAbonnementUseCase } from '@application/masterAdmin/ChangerPlanAbonnementUseCase';
import { SupprimerEcoleUseCase } from '@application/masterAdmin/SupprimerEcoleUseCase';
import { RenvoyerInvitationEcoleUseCase } from '@application/masterAdmin/RenvoyerInvitationEcoleUseCase';
import { ChangerStatutEcoleUseCase } from '@application/masterAdmin/ChangerStatutEcoleUseCase';
import { SynchroniserMatieresEcoleUseCase } from '@application/masterAdmin/SynchroniserMatieresEcoleUseCase';
import { ReinitialiserMfaUtilisateurUseCase } from '@application/masterAdmin/ReinitialiserMfaUtilisateurUseCase';
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { SoumettreFormulaireOnboardingUseCase } from '@application/eleveOnboarding/SoumettreFormulaireOnboardingUseCase';
import { SoumettreOnboardingUseCase } from '@application/eleveOnboarding/SoumettreOnboardingUseCase';
import { RenvoyerOnboardingUseCase } from '@application/eleveOnboarding/RenvoyerOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { InscrireEleveUseCase } from '@application/eleveOnboarding/InscrireEleveUseCase';
import { RejeterOnboardingUseCase } from '@application/eleveOnboarding/RejeterOnboardingUseCase';
import { ChangerGestionInscriptionsAdminUseCase } from '@application/eleveOnboarding/ChangerGestionInscriptionsAdminUseCase';
import { GererPiecesDossierUseCase } from '@application/eleveOnboarding/GererPiecesDossierUseCase';
import { SuggererClassesDossierUseCase } from '@application/eleveOnboarding/SuggererClassesDossierUseCase';
import { GenererFicheInscriptionPdfUseCase } from '@application/eleveOnboarding/GenererFicheInscriptionPdfUseCase';
import { ValiderLotOnboardingUseCase } from '@application/eleveOnboarding/ValiderLotOnboardingUseCase';
import { ImporterMatriculesUseCase } from '@application/matricule/ImporterMatriculesUseCase';
import { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import { SyncFromCarteScolaireUseCase } from '@application/matricule/SyncFromCarteScolaireUseCase';
import { VerifierRecuUseCase } from '@application/matricule/VerifierRecuUseCase';
import { ConfirmerCorrespondanceFuzzyUseCase } from '@application/matricule/ConfirmerCorrespondanceFuzzyUseCase';
import { SignalerErreurCarteScolaireUseCase } from '@application/matricule/SignalerErreurCarteScolaireUseCase';
import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { AutoMaterialisationProgrammesPort } from '@domain/ports/services/AutoMaterialisationProgrammesPort';
import type { CoreContainerContext } from './coreContext';

export function createOnboardingUserContainer(
  core: CoreContainerContext,
  creerClasseUseCase: CreerClasseUseCase,
  autoMaterialisation?: AutoMaterialisationProgrammesPort,
) {
  const schoolActivationRepository = new PrismaSchoolActivationRepository(prisma);
  const invitationRepository = new PrismaInvitationRepository(prisma);
  const importUtilisateursRepository = new PrismaImportUtilisateursRepository(prisma);
  const masterAdminQueryRepository = new PrismaMasterAdminQueryRepository(prisma);
  const eleveOnboardingRepository = new PrismaEleveOnboardingRepository(prisma);
  const tokenService = new JwtTokenService();
  const mfaService = new MfaServiceAdapter();
  const templateVersionRepository = new PrismaSchoolTemplateVersionRepository(prisma);

  const creerSqueletteOnboarding = new CreerSqueletteOnboardingUseCase(eleveOnboardingRepository, core.activityLog);
  const inscrireEleveUseCase = new InscrireEleveUseCase(
    eleveOnboardingRepository,
    core.schoolRepository,
    core.activityLog,
    core.eventPublisher,
  );

  return {
    school: {
      onboarder: new OnboarderEcoleUseCase(core.schoolRepository, core.userRepository, core.emailService),
      approuver: new ApprouverEcoleUseCase(core.schoolRepository, core.userRepository, core.emailService),
      activer: new ActiverEtablissementUseCase(schoolActivationRepository, autoMaterialisation),
      schoolActivationRepository,
      schoolRepository: core.schoolRepository,
      invitationRepository,
      anneeRepository: core.anneeRepository,
      classeRepository: core.classeRepository,
      matiereRepository: core.matiereRepository,
      sectionRepository: core.sectionRepository,
      schoolConfigRepository: core.schoolConfigRepository,
      departmentRepository: core.departmentRepository,
    },
    schoolSettings: {
      obtenir: new ObtenirParametresEcoleUseCase(core.schoolSettingsRepository),
      mettreAJour: new MettreAJourParametresEcoleUseCase(core.schoolSettingsRepository, core.activityLog),
      proposerReapplication: new ProposerReapplicationTemplateUseCase(
        core.schoolSettingsRepository,
        templateVersionRepository,
      ),
      appliquerReapplication: new AppliquerReapplicationTemplateUseCase(
        core.schoolSettingsRepository,
        templateVersionRepository,
        core.activityLog,
      ),
    },
    user: {
      connecter: new ConnecterUtilisateurUseCase(
        core.userRepository,
        core.schoolRepository,
        tokenService,
        politiqueEnvoiSortantPlateforme,
      ),
      inscrire: new InscrireUtilisateurUseCase(
        core.userRepository,
        core.credentialsNotificationService,
        politiqueEnvoiSortantPlateforme,
      ),
      rafraichir: new RafraichirTokenUseCase(core.userRepository, core.schoolRepository, tokenService),
      deconnecter: new DeconnecterUtilisateurUseCase(core.userRepository),
      modifier: new ModifierUtilisateurUseCase(core.userRepository),
      supprimer: new SupprimerUtilisateurUseCase(core.userRepository),
      transferer: new TransfererEleveUseCase(core.userRepository, core.classeRepository),
      importer: new ImporterUtilisateursUseCase(
        importUtilisateursRepository,
        core.userRepository,
        core.anneeRepository,
        core.studentGroupSetRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
        core.emailService,
        creerClasseUseCase,
        core.credentialsNotificationService,
      ),
      importUtilisateursRepository,
      mfa: new MfaUseCase(core.userRepository, mfaService),
      tokenService,
      schoolRepository: core.schoolRepository,
    },
    masterAdmin: {
      inviter: new InviterEcoleUseCase(
        core.schoolRepository,
        invitationRepository,
        core.emailService,
        core.emailTemplateAdapter,
        politiqueEnvoiSortantPlateforme,
      ),
      suspendre: new SuspendreEcoleUseCase(core.schoolRepository, invitationRepository),
      reactiver: new ReactiverEcoleUseCase(core.schoolRepository),
      rejeter: new RejeterEcoleUseCase(core.schoolRepository, core.userRepository, core.emailService),
      changerPlan: new ChangerPlanAbonnementUseCase(core.schoolRepository),
      queryRepository: masterAdminQueryRepository,
      supprimerEcole: new SupprimerEcoleUseCase(masterAdminQueryRepository),
      renvoyerInvitation: new RenvoyerInvitationEcoleUseCase(masterAdminQueryRepository),
      changerStatut: new ChangerStatutEcoleUseCase(masterAdminQueryRepository),
      synchroniserMatieres: new SynchroniserMatieresEcoleUseCase(masterAdminQueryRepository),
      reinitialiserMfa: new ReinitialiserMfaUtilisateurUseCase(masterAdminQueryRepository),
    },
    eleveOnboarding: {
      creerSquelette: creerSqueletteOnboarding,
      soumettreFormulaire: new SoumettreFormulaireOnboardingUseCase(eleveOnboardingRepository),
      soumettre: new SoumettreOnboardingUseCase(eleveOnboardingRepository),
      renvoyer: new RenvoyerOnboardingUseCase(eleveOnboardingRepository),
      valider: new ValiderOnboardingUseCase(eleveOnboardingRepository, core.activityLog),
      inscrire: inscrireEleveUseCase,
      rejeter: new RejeterOnboardingUseCase(eleveOnboardingRepository, core.schoolRepository, core.activityLog),
      changerGestionAdmin: new ChangerGestionInscriptionsAdminUseCase(core.schoolRepository, core.activityLog),
      gererPieces: new GererPiecesDossierUseCase(eleveOnboardingRepository),
      suggererClasses: new SuggererClassesDossierUseCase(core.classeRepository),
      genererFichePdf: new GenererFicheInscriptionPdfUseCase(
        eleveOnboardingRepository,
        core.schoolRepository,
        core.classeRepository,
        new PdfKitFicheInscriptionAdapter(),
      ),
      validerLot: new ValiderLotOnboardingUseCase(inscrireEleveUseCase),
      repository: eleveOnboardingRepository,
    },
    matricule: {
      importerMatricules: new ImporterMatriculesUseCase(core.matriculeImportRepository),
      verifierMatricule: new VerifierMatriculeUseCase(
        core.matriculeImportRepository,
        new CarteScolaireScrapingAdapter(),
      ),
      syncFromCarteScolaire: new SyncFromCarteScolaireUseCase(
        core.matriculeImportRepository,
        core.paiementMinesecRepository,
        new CarteScolaireScrapingAdapter(),
      ),
      verifierRecu: new VerifierRecuUseCase(core.paiementMinesecRepository, new CarteScolaireScrapingAdapter()),
      confirmerFuzzy: new ConfirmerCorrespondanceFuzzyUseCase(core.matriculeImportRepository),
      signalerErreur: new SignalerErreurCarteScolaireUseCase(core.matriculeImportRepository),
      matriculeImportRepository: core.matriculeImportRepository,
    },
  };
}
