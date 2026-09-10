/**
 * INFRASTRUCTURE LAYER — Container d'injection de dépendances ZekoulABia
 *
 * Ce fichier branche les implémentations concrètes sur les interfaces (ports).
 * C'est le seul endroit où Prisma, SendGrid, Campay etc. sont instanciés.
 *
 * Principe :
 *   Adapters (Prisma, services) → injectés dans → Use Cases → injectés dans → Controllers
 */

import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from '@infrastructure/persistence/prisma/softDeleteExtension';

// --- Adapters Persistence ---
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaSchoolRepository } from '@infrastructure/persistence/prisma/PrismaSchoolRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaNoteRepository } from '@infrastructure/persistence/prisma/PrismaNoteRepository';
import { PrismaPresenceRepository } from '@infrastructure/persistence/prisma/PrismaPresenceRepository';
import { PrismaStatisticsQueryRepository } from '@infrastructure/persistence/prisma/PrismaStatisticsQueryRepository';
import { PrismaBulletinRepository } from '@infrastructure/persistence/prisma/PrismaBulletinRepository';
import { PrismaMatiereRepository } from '@infrastructure/persistence/prisma/PrismaMatiereRepository';
import { PrismaRoomRepository } from '@infrastructure/persistence/prisma/PrismaRoomRepository';
import { PrismaTeacherUnavailabilityRepository } from '@infrastructure/persistence/prisma/PrismaTeacherUnavailabilityRepository';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaClassRoomAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaClassRoomAssignmentRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaRattachementEnseignantRepository } from '@infrastructure/persistence/prisma/PrismaRattachementEnseignantRepository';
import { PrismaSectionRepository } from '@infrastructure/persistence/prisma/PrismaSectionRepository';
import { PrismaStudentProfileRepository } from '@infrastructure/persistence/prisma/PrismaStudentProfileRepository';
import { PrismaStudentDocumentRepository } from '@infrastructure/persistence/prisma/PrismaStudentDocumentRepository';
import { PrismaSchoolConfigRepository } from '@infrastructure/persistence/prisma/PrismaSchoolConfigRepository';
import { PrismaTeachingAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaTeachingAssignmentRepository';
import { PrismaStudentRecommendationRepository } from '@infrastructure/persistence/prisma/PrismaStudentRecommendationRepository';
import { PrismaBulletinValidationRepository } from '@infrastructure/persistence/prisma/PrismaBulletinValidationRepository';
import { PrismaAssessmentScopeRepository } from '@infrastructure/persistence/prisma/PrismaAssessmentScopeRepository';
import { PrismaHarmonizedAssessmentSessionRepository } from '@infrastructure/persistence/prisma/PrismaHarmonizedAssessmentSessionRepository';
import { PrismaAssessmentParticipationRepository } from '@infrastructure/persistence/prisma/PrismaAssessmentParticipationRepository';
import { PrismaAnonymatRepository } from '@infrastructure/persistence/prisma/PrismaAnonymatRepository';
import { PrismaTaskRepository } from '@infrastructure/persistence/prisma/PrismaTaskRepository';

// --- Adapters Audit ---
import { ActivityLogAdapter } from '@infrastructure/services/audit/ActivityLogAdapter';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';

// --- Adapters Services (ports) ---
import { SmsNotificationAdapter } from '@infrastructure/services/sms/SmsNotificationAdapter';
import { CredentialsNotificationService } from '@infrastructure/services/notification/CredentialsNotificationService';
import { DocumentAiAdapter } from '@infrastructure/services/ai/DocumentAiAdapter';
import { EmailTemplateAdapter } from '@infrastructure/services/email/EmailTemplateAdapter';
import { RealtimeSocketAdapter } from '@infrastructure/socket/RealtimeSocketAdapter';
import { SchedulingGridAdapter } from '@infrastructure/scheduling/SchedulingGridAdapter';
import { InngestEventPublisher } from '@infrastructure/events/InngestEventPublisher';

// --- Use Cases : Notes ---
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

// --- Use Cases : Présences ---
import { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import { TraiterSmsPresenceUseCase } from '@application/attendance/TraiterSmsPresenceUseCase';

// --- Use Cases : School ---
import { OnboarderEcoleUseCase } from '@application/school/OnboarderEcoleUseCase';
import { ApprouverEcoleUseCase } from '@application/school/ApprouverEcoleUseCase';

// --- Use Case : Import ---
import { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';

// --- Use Cases : Bulletins ---
import { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { VerifierDisponibiliteBulletinUseCase } from '@application/reportCard/VerifierDisponibiliteBulletinUseCase';
import { ListerBulletinsUseCase } from '@application/reportCard/ListerBulletinsUseCase';
import { SoumettreBulletinsClasseUseCase } from '@application/reportCard/SoumettreBulletinsClasseUseCase';
import { ValiderBulletinsClasseUseCase } from '@application/reportCard/ValiderBulletinsClasseUseCase';
import { PublierBulletinsClasseUseCase } from '@application/reportCard/PublierBulletinsClasseUseCase';

// --- Use Cases : Conseil de Classe ---
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

// --- Use Cases : Matricule ---
import { ImporterMatriculesUseCase } from '@application/matricule/ImporterMatriculesUseCase';
import { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import { SyncFromCarteScolaireUseCase } from '@application/matricule/SyncFromCarteScolaireUseCase';
import { VerifierRecuUseCase } from '@application/matricule/VerifierRecuUseCase';
import { ConfirmerCorrespondanceFuzzyUseCase } from '@application/matricule/ConfirmerCorrespondanceFuzzyUseCase';
import { SignalerErreurCarteScolaireUseCase } from '@application/matricule/SignalerErreurCarteScolaireUseCase';
import { CarteScolaireScrapingAdapter } from '@infrastructure/services/scraping/CarteScolaireScrapingAdapter';

// --- Use Cases : Onboarding Auto-Service Élèves ---
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { SoumettreFormulaireOnboardingUseCase } from '@application/eleveOnboarding/SoumettreFormulaireOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { RejeterOnboardingUseCase } from '@application/eleveOnboarding/RejeterOnboardingUseCase';
import { VerifierCompletudeSupplementUseCase } from '@application/statisticalCampaign/VerifierCompletudeSupplementUseCase';
import { GenererDeclarationStatistiqueMinesecUseCase } from '@application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase';
import { GenererRapportSyntheseMinedubUseCase } from '@application/statisticalCampaignMinedub/GenererRapportSyntheseMinedubUseCase';
import { PrismaStatisticalQueryAdapter } from '@infrastructure/persistence/prisma/PrismaStatisticalQueryAdapter';
import { PrismaStatisticalCampaignRepository } from '@infrastructure/persistence/prisma/PrismaStatisticalCampaignRepository';
import { PrismaMinedubReportRepository } from '@infrastructure/persistence/prisma/PrismaMinedubReportRepository';

// --- Use Cases : Paiement MINESEC ---
import { GenererPaiementsMinesecUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecUseCase';
import { GenererPaiementsMinesecPourEcoleUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecPourEcoleUseCase';
import { GetStudentPaymentDashboardUseCase } from '@application/paiementMinesec/GetStudentPaymentDashboardUseCase';
import { GetSchoolPaymentOverviewUseCase } from '@application/paiementMinesec/GetSchoolPaymentOverviewUseCase';

// --- Use Cases : Examen ---
import { PrepareExamDossierUseCase } from '@application/examen/PrepareExamDossierUseCase';

// --- Use Cases : LV2 Choice ---
import { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import { SoumettreChoixLV2EleveUseCase } from '@application/lv2Choice/SoumettreChoixLV2EleveUseCase';
import { SaisirChoixLV2ManuelUseCase } from '@application/lv2Choice/SaisirChoixLV2ManuelUseCase';
import { AppliquerChoixLV2UseCase } from '@application/lv2Choice/AppliquerChoixLV2UseCase';
import { SuivreFenetreChoixLV2UseCase } from '@application/lv2Choice/SuivreFenetreChoixLV2UseCase';

// --- Use Cases : Entrance Exam ---
import { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';

// --- Use Cases : Push Notification ---
import { SouscrirePushUseCase } from '@application/pushNotification/SouscrirePushUseCase';
import { DesinscrirePushUseCase } from '@application/pushNotification/DesinscrirePushUseCase';

// --- Use Cases : PEBS Exam ---
import { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import { AjouterCandidatsPebsUseCase } from '@application/pebsExam/AjouterCandidatsPebsUseCase';
import { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import { AppliquerTransfertPebsUseCase } from '@application/pebsExam/AppliquerTransfertPebsUseCase';
import { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import { ScannerListeCandidatsPebsUseCase } from '@application/pebsExam/ScannerListeCandidatsPebsUseCase';
import { DetecterAnomaliesPebsUseCase } from '@application/pebsExam/DetecterAnomaliesPebsUseCase';

// --- Adapters Services ---
import { NodemailerEmailService } from '@infrastructure/services/email/NodemailerEmailService';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { PdfKitBulletinService } from '@infrastructure/services/pdf/PdfKitBulletinService';
import { JwtTokenService } from '@infrastructure/services/auth/JwtTokenService';
import { MfaServiceAdapter } from '@infrastructure/services/auth/MfaServiceAdapter';

// --- Adapters Persistence (suite) ---
import { PrismaInvitationRepository } from '@infrastructure/persistence/prisma/PrismaInvitationRepository';

// --- Use Cases : User ---
import { ConnecterUtilisateurUseCase } from '@application/user/ConnecterUtilisateurUseCase';
import { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import { MfaUseCase } from '@application/user/MfaUseCase';

// --- Adapters Persistence Finance ---
import { PrismaPlanFraisRepository } from '@infrastructure/persistence/prisma/PrismaPlanFraisRepository';
import { PrismaFactureRepository } from '@infrastructure/persistence/prisma/PrismaFactureRepository';
import { PrismaPaiementRepository } from '@infrastructure/persistence/prisma/PrismaPaiementRepository';
import { PrismaDepenseRepository } from '@infrastructure/persistence/prisma/PrismaDepenseRepository';

// --- Adapter Service Campay ---
import { CampayPaiementService } from '@infrastructure/services/payment/CampayPaiementService';

// --- Use Cases : Finance ---
import { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import { ChangerStatutPlanFraisUseCase } from '@application/finance/ChangerStatutPlanFraisUseCase';
import { CopierPlansFraisAnneePrecedenteUseCase } from '@application/finance/CopierPlansFraisAnneePrecedenteUseCase';
import { GenererFactureUseCase } from '@application/finance/GenererFactureUseCase';
import { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';
import { RembourserCautionUseCase } from '@application/finance/RembourserCautionUseCase';
import { EnregistrerDepenseUseCase } from '@application/finance/EnregistrerDepenseUseCase';
import { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';

// --- Adapters Persistence Classe + Matière ---
import { PrismaSousGroupeRepository } from '@infrastructure/persistence/prisma/PrismaSousGroupeRepository';
import { PrismaMessagerieRepository } from '@infrastructure/persistence/prisma/PrismaMessagerieRepository';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaEntranceExamRepository } from '@infrastructure/persistence/prisma/PrismaEntranceExamRepository';
import { PrismaPebsExamRepository } from '@infrastructure/persistence/prisma/PrismaPebsExamRepository';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaMatriculeImportRepository } from '@infrastructure/persistence/prisma/PrismaMatriculeImportRepository';
import { PrismaPaiementMinesecRepository } from '@infrastructure/persistence/prisma/PrismaPaiementMinesecRepository';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';

// --- Adapters Persistence AnneeAcademique + Promotion ---
import { PrismaPromotionRepository } from '@infrastructure/persistence/prisma/PrismaPromotionRepository';

// --- Adapters Persistence Timetable ---
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';

// --- Adapters Persistence AI ---
import { PrismaSanteEleveRepository } from '@infrastructure/persistence/prisma/PrismaSanteEleveRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaClassCouncilPreviewQueryPort } from '@infrastructure/persistence/prisma/PrismaClassCouncilPreviewQueryPort';

// --- Adapter Service IA ---
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';

// --- Use Cases : AI ---
import { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';
import { CompareRisquePredictionsUseCase } from '@application/ai/CompareRisquePredictionsUseCase';
import { RulesBasedPredictionService } from '@infrastructure/services/ai/RulesBasedPredictionService';
import { TabPfnPredictionService } from '@infrastructure/services/ai/TabPfnPredictionService';

// --- Adapters Persistence Parent + SchoolSettings ---
import { PrismaParentRepository } from '@infrastructure/persistence/prisma/PrismaParentRepository';
import { PrismaSchoolSettingsRepository } from '@infrastructure/persistence/prisma/PrismaSchoolSettingsRepository';
import { PrismaSchoolTemplateVersionRepository } from '@infrastructure/persistence/prisma/PrismaSchoolTemplateVersionRepository';

// --- Use Cases : Parent ---
import { ObtenirEnfantsUseCase } from '@application/parent/ObtenirEnfantsUseCase';
import { ObtenirAlertesSoldeUseCase } from '@application/parent/ObtenirAlertesSoldeUseCase';
import { VerifierAccesEnfantUseCase } from '@application/parent/VerifierAccesEnfantUseCase';

// --- Use Cases : SchoolSettings ---
import { ObtenirParametresEcoleUseCase } from '@application/schoolSettings/ObtenirParametresEcoleUseCase';
import { MettreAJourParametresEcoleUseCase } from '@application/schoolSettings/MettreAJourParametresEcoleUseCase';
import { ProposerReapplicationTemplateUseCase } from '@application/schoolSettings/ProposerReapplicationTemplateUseCase';
import { ObtenirProfilAcademiqueUseCase } from '@application/student/ObtenirProfilAcademiqueUseCase';
import { PrismaAcademicProfileQueryRepository } from '@infrastructure/persistence/prisma/PrismaAcademicProfileQueryRepository';
import { AppliquerReapplicationTemplateUseCase } from '@application/schoolSettings/AppliquerReapplicationTemplateUseCase';

// --- Use Cases : Timetable ---
import { CreerEmploiDuTempsUseCase } from '@application/timetable/CreerEmploiDuTempsUseCase';
import { AjouterCreneauUseCase } from '@application/timetable/AjouterCreneauUseCase';
import { ModifierCreneauUseCase } from '@application/timetable/ModifierCreneauUseCase';
import { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import { GenererSeancesGroupeUseCase } from '@application/timetable/GenererSeancesGroupeUseCase';
import { ResoudreParticipantsSeanceUseCase } from '@application/timetable/ResoudreParticipantsSeanceUseCase';
import { ProposerEmploiDuTempsUseCase } from '@application/timetable/ProposerEmploiDuTempsUseCase';
import { GenererSqueletteEmploiDuTempsUseCase } from '@application/timetable/GenererSqueletteEmploiDuTempsUseCase';
import { AppliquerPropositionEmploiDuTempsUseCase } from '@application/timetable/AppliquerPropositionEmploiDuTempsUseCase';
import { SimulerEmploiDuTempsUseCase } from '@application/timetable/SimulerEmploiDuTempsUseCase';
import { ORToolsWasmAdapter } from '@infrastructure/scheduling/ORToolsWasmAdapter';

// --- Use Cases : AnneeAcademique ---
import { CreerAnneeAcademiqueUseCase } from '@application/academicYear/CreerAnneeAcademiqueUseCase';
import { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import { CloturerAnneeUseCase } from '@application/academicYear/CloturerAnneeUseCase';
import { ProposerStructureAnneeSuivanteUseCase } from '@application/academicYear/ProposerStructureAnneeSuivanteUseCase';
import { ValiderStructureAnneeSuivanteUseCase } from '@application/academicYear/ValiderStructureAnneeSuivanteUseCase';
import { AnnulerStructureProposeeUseCase } from '@application/academicYear/AnnulerStructureProposeeUseCase';
import { MettreAJourCalendrierUseCase } from '@application/academicYear/MettreAJourCalendrierUseCase';

// --- Use Cases : Classe ---
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
import { PrismaClasseCoefficientRepository } from '@infrastructure/persistence/prisma/PrismaClasseCoefficientRepository';

// --- Use Cases : Matière ---
import { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import { DefinirCoefficientUseCase } from '@application/subject/DefinirCoefficientUseCase';
import { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';

// --- Use Cases : Room (Salle) ---
import { CreerSalleUseCase } from '@application/room/CreerSalleUseCase';
import { ModifierSalleUseCase } from '@application/room/ModifierSalleUseCase';
import { SupprimerSalleUseCase } from '@application/room/SupprimerSalleUseCase';

// --- Use Cases : TeacherUnavailability (V2.4) ---
import { CreerIndisponibiliteEnseignantUseCase } from '@application/timetable/CreerIndisponibiliteEnseignantUseCase';
import { ModifierIndisponibiliteEnseignantUseCase } from '@application/timetable/ModifierIndisponibiliteEnseignantUseCase';
import { SupprimerIndisponibiliteEnseignantUseCase } from '@application/timetable/SupprimerIndisponibiliteEnseignantUseCase';
import { ListerIndisponibilitesEnseignantUseCase } from '@application/timetable/ListerIndisponibilitesEnseignantUseCase';

// --- Use Cases : StudentGroup / ClassRoomAssignment ---
import { CreerStudentGroupSetUseCase } from '@application/studentGroup/CreerStudentGroupSetUseCase';
import { ModifierStudentGroupSetUseCase } from '@application/studentGroup/ModifierStudentGroupSetUseCase';
import { SupprimerStudentGroupSetUseCase } from '@application/studentGroup/SupprimerStudentGroupSetUseCase';
import { CreerStudentGroupUseCase } from '@application/studentGroup/CreerStudentGroupUseCase';
import { ModifierStudentGroupUseCase } from '@application/studentGroup/ModifierStudentGroupUseCase';
import { SupprimerStudentGroupUseCase } from '@application/studentGroup/SupprimerStudentGroupUseCase';
import { AssignerSalleClasseUseCase } from '@application/studentGroup/AssignerSalleClasseUseCase';
import { RetirerAssignationSalleUseCase } from '@application/studentGroup/RetirerAssignationSalleUseCase';

// --- Adapter Persistence Orientation ---
import { PrismaOrientationRepository } from '@infrastructure/persistence/prisma/PrismaOrientationRepository';
import { PrismaGradeOrientationRepository } from '@infrastructure/persistence/prisma/PrismaGradeOrientationRepository';
import { PrismaExamDossierRepository } from '@infrastructure/persistence/prisma/PrismaExamDossierRepository';
import { PrismaEleveOnboardingRepository } from '@infrastructure/persistence/prisma/PrismaEleveOnboardingRepository';
import { PrismaImportUtilisateursRepository } from '@infrastructure/persistence/prisma/PrismaImportUtilisateursRepository';
import { PrismaPushSubscriptionRepository } from '@infrastructure/persistence/prisma/PrismaPushSubscriptionRepository';

// --- Metric Engine v1 (in-memory) ---
import { MetricCache } from '@infrastructure/cache/MetricCache';
import { MetricRegistry } from '@domain/reporting/MetricRegistryImpl';
import { GetMetricUseCase } from '@application/reporting/GetMetricUseCase';

// --- Adapters Persistence HR ---
import { PrismaStaffProfileRepository } from '@infrastructure/persistence/prisma/PrismaStaffProfileRepository';
import { PrismaLeaveRepository } from '@infrastructure/persistence/prisma/PrismaLeaveRepository';
import { PrismaEmployeeFileRepository } from '@infrastructure/persistence/prisma/PrismaEmployeeFileRepository';
import { PrismaCareerEventRepository } from '@infrastructure/persistence/prisma/PrismaCareerEventRepository';
import { PrismaStaffAttendanceRepository } from '@infrastructure/persistence/prisma/PrismaStaffAttendanceRepository';
import { PrismaMissionOrderRepository } from '@infrastructure/persistence/prisma/PrismaMissionOrderRepository';

// --- Adapters Persistence Pedagogie ---
import { PrismaProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaProgrammeRepository';
import { PrismaChapitreRepository } from '@infrastructure/persistence/prisma/PrismaChapitreRepository';
import { PrismaCahierDeTexteRepository } from '@infrastructure/persistence/prisma/PrismaCahierDeTexteRepository';
import { PrismaDepartmentRepository } from '@infrastructure/persistence/prisma/PrismaDepartmentRepository';

// --- Use Cases : Pedagogie ---
import { ListerProgrammeUseCase } from '@application/pedagogie/ListerProgrammeUseCase';
import { GererProgrammeUseCase } from '@application/pedagogie/GererProgrammeUseCase';
import { GererChapitreUseCase } from '@application/pedagogie/GererChapitreUseCase';
import { GererCahierDeTexteUseCase } from '@application/pedagogie/GererCahierDeTexteUseCase';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import { ObtenirSlotDuJourUseCase } from '@application/pedagogie/ObtenirSlotDuJourUseCase';
import { GenererRapportPedagogieUseCase } from '@application/pedagogie/GenererRapportPedagogieUseCase';

// --- Use Cases : Orientation ---
import { CreerFicheOrientationUseCase } from '@application/orientation/CreerFicheOrientationUseCase';
import { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import { ListerFichesOrientationUseCase } from '@application/orientation/ListerFichesOrientationUseCase';
import { GetStatsOrientationUseCase } from '@application/orientation/GetStatsOrientationUseCase';
import { SaisirAspirationsEleveUseCase } from '@application/orientation/SaisirAspirationsEleveUseCase';
import { GenererRecommandationOrientationUseCase } from '@application/orientation/GenererRecommandationOrientationUseCase';
import { ValiderRecommandationConseillerUseCase } from '@application/orientation/ValiderRecommandationConseillerUseCase';
import { ProposerRecommandationEleveUseCase } from '@application/orientation/ProposerRecommandationEleveUseCase';
import { ChoisirPisteEleveUseCase } from '@application/orientation/ChoisirPisteEleveUseCase';
import { ListerElevesAOrienterUseCase } from '@application/orientation/ListerElevesAOrienterUseCase';
import { ConfigurerCheckpointOrientationUseCase } from '@application/orientation/ConfigurerCheckpointOrientationUseCase';

// --- Use Cases : MasterAdmin ---
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
import { PrismaMasterAdminQueryRepository } from '@infrastructure/persistence/prisma/PrismaMasterAdminQueryRepository';

// --- Use Cases : Assessment ---
import { CreerAssessmentScopeUseCase } from '@application/assessment/CreerAssessmentScopeUseCase';
import { PlanifierAssessmentSessionUseCase } from '@application/assessment/PlanifierAssessmentSessionUseCase';
import { EnregistrerParticipationUseCase } from '@application/assessment/EnregistrerParticipationUseCase';
import { EnregistrerParticipationEnLotUseCase } from '@application/assessment/EnregistrerParticipationEnLotUseCase';
import { GenererCodesAnonymatUseCase } from '@application/assessment/GenererCodesAnonymatUseCase';
import { DesignerEquipeAnonymatUseCase } from '@application/assessment/DesignerEquipeAnonymatUseCase';
import { ObtenirListeAnonymatParTokenUseCase } from '@application/assessment/ObtenirListeAnonymatParTokenUseCase';
import { MarquerAnonymisationTermineeUseCase } from '@application/assessment/MarquerAnonymisationTermineeUseCase';
import { ListerSessionsCorrectionAnonymeUseCase } from '@application/assessment/ListerSessionsCorrectionAnonymeUseCase';
import { AnonymatInvitationService } from '@infrastructure/services/notification/AnonymatInvitationService';
import { AnonymatLinkGenerator } from '@infrastructure/services/anonymat/AnonymatLinkGenerator';
import { EnvAppConfig } from '@infrastructure/config/EnvAppConfig';
import { ConsoleLogger } from '@infrastructure/services/logging/ConsoleLogger';

// --- Use Cases : Tâches ---
import { CreerTaskUseCase } from '@application/task/CreerTaskUseCase';
import { ListerTasksUseCase } from '@application/task/ListerTasksUseCase';
import { MettreAJourStatutTaskUseCase } from '@application/task/MettreAJourStatutTaskUseCase';

// --- Use Cases : LV2 / PEBS ---
import { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';

// --- Use Cases : Staff Attendance (V2.11) ---
import { PointerPresenceEnseignantUseCase } from '@application/staffAttendance/PointerPresenceEnseignantUseCase';
import { VerifierPresenceAvantCahierDeTexte } from '@application/staffAttendance/VerifierPresenceAvantCahierDeTexte';
import { JwtQrTokenService } from '@infrastructure/services/qr/QrTokenService';

// --- Use Cases : Assessment Anonymat ---
import { AssignerCorrectionAnonymatUseCase } from '../../application/assessment/AssignerCorrectionAnonymatUseCase';
import { ObtenirFicheCorrectionAnonymeUseCase } from '../../application/assessment/ObtenirFicheCorrectionAnonymeUseCase';
import { SaisirNotesAnonymesUseCase } from '../../application/assessment/SaisirNotesAnonymesUseCase';
import { SoumettreCorrectionAnonymeUseCase } from '../../application/assessment/SoumettreCorrectionAnonymeUseCase';
import { ReconcilierNotesAnonymesUseCase } from '../../application/assessment/ReconcilierNotesAnonymesUseCase';

// ─────────────────────────────────────────────
// Factory principale
// ─────────────────────────────────────────────

export function creerContainer() {
  // 1. Client Prisma (singleton) — connexion séparée de celle de prisma.client.ts (dette
  // architecturale préexistante, pas corrigée ici), mais l'extension de soft-delete doit couvrir
  // les DEUX pour que le filtre deletedAt:null soit vraiment universel (voir softDeleteExtension.ts).
  const prisma = new PrismaClient().$extends(softDeleteExtension) as unknown as PrismaClient;

  // 2. Repositories
  const userRepository = new PrismaUserRepository(prisma);
  const schoolRepository = new PrismaSchoolRepository(prisma);
  const classeRepository = new PrismaClasseRepository(prisma);
  const noteRepository = new PrismaNoteRepository(prisma);
  const presenceRepository = new PrismaPresenceRepository(prisma);
  const bulletinRepository = new PrismaBulletinRepository(prisma);
  const matiereRepository = new PrismaMatiereRepository(prisma);
  const sectionRepository = new PrismaSectionRepository(prisma);
  const studentProfileRepository = new PrismaStudentProfileRepository(prisma);
  const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);
  const studentDocumentRepository = new PrismaStudentDocumentRepository(prisma);
  const schoolConfigRepository = new PrismaSchoolConfigRepository(prisma);
  const teachingAssignmentRepository = new PrismaTeachingAssignmentRepository(prisma);
  const studentRecommendationRepository = new PrismaStudentRecommendationRepository(prisma);
  const bulletinValidationRepository = new PrismaBulletinValidationRepository(prisma);
  const rattachementRepository = new PrismaRattachementEnseignantRepository(prisma);
  const roomRepository = new PrismaRoomRepository(prisma);
  const studentGroupSetRepository = new PrismaStudentGroupSetRepository(prisma);
  const studentGroupRepository = new PrismaStudentGroupRepository(prisma);
  const studentGroupMembershipRepository = new PrismaStudentGroupMembershipRepository(prisma);
  const studentAffectationRepository = new PrismaStudentAffectationRepository(prisma);
  const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(prisma);
  const entranceExamRepository = new PrismaEntranceExamRepository(prisma);
  const pebsExamRepository = new PrismaPebsExamRepository(prisma);
  const examDossierRepository = new PrismaExamDossierRepository(prisma);
  const eleveOnboardingRepository = new PrismaEleveOnboardingRepository(prisma);
  const importUtilisateursRepository = new PrismaImportUtilisateursRepository(prisma);
  const pushSubscriptionRepository = new PrismaPushSubscriptionRepository(prisma);
  const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
  const matriculeImportRepository = new PrismaMatriculeImportRepository(prisma);
  const minedubReportRepository = new PrismaMinedubReportRepository(prisma);
  const paiementMinesecRepository = new PrismaPaiementMinesecRepository(prisma);
  const parentRepository = new PrismaParentRepository(prisma);
  const notifierEvenement = (schoolId: string, targetRoles: string[], titre: string, corps: string) =>
    notifierEvenementAcademique(prisma, schoolId, targetRoles, titre, corps);
  const classRoomAssignmentRepository = new PrismaClassRoomAssignmentRepository(prisma);
  const assessmentScopeRepository = new PrismaAssessmentScopeRepository(prisma);
  const assessmentSessionRepository = new PrismaHarmonizedAssessmentSessionRepository(prisma);
  const assessmentParticipationRepository = new PrismaAssessmentParticipationRepository(prisma);
  const anonymatRepository = new PrismaAnonymatRepository(prisma);
  const taskRepository = new PrismaTaskRepository(prisma);
  const statisticsQueryRepository = new PrismaStatisticsQueryRepository(prisma);

  // 2bis. Metric Engine v1 — singleton in-memory (une seule Map pour la durée de vie du process)
  const metricCache = new MetricCache();
  const metricRegistry = new MetricRegistry();
  const getMetricUseCase = new GetMetricUseCase(metricCache, metricRegistry, presenceRepository, noteRepository, statisticsQueryRepository, schoolRepository, classeRepository);

  // 2ter. Event Publisher (Inngest)
  const eventPublisher = new InngestEventPublisher();

  // 3. Services (adaptateurs réels)
  const emailService = new NodemailerEmailService();
  const anonymatInvitation = new AnonymatInvitationService(emailService);
  const anonymatLinkGenerator = new AnonymatLinkGenerator(new EnvAppConfig());
  const anonymatLogger = new ConsoleLogger();
  const credentialsNotificationService = new CredentialsNotificationService(emailService);
  const notificationService = new SocketNotificationService(eventPublisher);
  const pdfService = new PdfKitBulletinService();

  // 4. Use Cases — Notes
  const saisirNoteUseCase = new SaisirNoteUseCase(
    noteRepository, matiereRepository, userRepository, rattachementRepository, undefined, assessmentSessionRepository
  );
  const verrouillerNoteUseCase = new VerrouillerNoteUseCase(noteRepository, matiereRepository, metricCache);
  const verrouillerNotesEnMasseUseCase = new VerrouillerNotesEnMasseUseCase(noteRepository, matiereRepository, metricCache);

  // 5. Use Cases — Import
  // creerClasseUseCase doit être déclaré AVANT car injecté dans ImporterUtilisateursUseCase
  const messagerieRepository = new PrismaMessagerieRepository(prisma);
  const creerClasseUseCase = new CreerClasseUseCase(
    classeRepository,
    anneeRepository,
    matiereRepository,
    new CreerCanalClasseUseCase(messagerieRepository),
    new CreerCanalParentsUseCase(messagerieRepository),
  );

  const importerUtilisateursUseCase = new ImporterUtilisateursUseCase(
    importUtilisateursRepository,
    userRepository,
    anneeRepository,
    studentGroupSetRepository,
    studentGroupRepository,
    studentGroupMembershipRepository,
    emailService,
    creerClasseUseCase,
    credentialsNotificationService,
  );

  // 6. Use Cases — Présences
  const enregistrerPresenceUseCase = new EnregistrerPresenceUseCase(
    presenceRepository, userRepository, notificationService, rattachementRepository, metricCache
  );
  const traiterSmsPresenceUseCase = new TraiterSmsPresenceUseCase(
    classeRepository, enrollmentRepository, userRepository, presenceRepository
  );

  // 6. Use Cases — School
  const onboarderEcoleUseCase = new OnboarderEcoleUseCase(
    schoolRepository, userRepository, emailService
  );
  const approuverEcoleUseCase = new ApprouverEcoleUseCase(
    schoolRepository, userRepository, emailService
  );

  // 7. Use Cases — Bulletins
  const classCouncilRepository = new PrismaClassCouncilRepository(prisma);
  const activityLog = new ActivityLogAdapter();
  const auditLog = new AIActionAuditAdapter(prisma);
  const smsNotificationAdapter = new SmsNotificationAdapter();
  const documentAiAdapter = new DocumentAiAdapter();
  const emailTemplateAdapter = new EmailTemplateAdapter();
  const realtimeSocketAdapter = new RealtimeSocketAdapter();
  const schedulingGridAdapter = new SchedulingGridAdapter();

  const genererBulletinUseCase = new GenererBulletinUseCase(
    noteRepository, bulletinRepository, classeRepository,
    userRepository, matiereRepository, anneeRepository,
    presenceRepository, pdfService, classCouncilRepository,
    schoolRepository, sectionRepository, studentProfileRepository,
  );
  const envoyerBulletinsUseCase = new EnvoyerBulletinsUseCase(
    bulletinRepository, userRepository, emailService, bulletinValidationRepository
  );
  const verifierDisponibiliteUseCase = new VerifierDisponibiliteBulletinUseCase(
    anneeRepository, noteRepository, classCouncilRepository
  );
  const listerBulletinsUseCase = new ListerBulletinsUseCase(
    bulletinRepository, parentRepository
  );
  const soumettreBulletinsClasseUseCase = new SoumettreBulletinsClasseUseCase(
    classeRepository, bulletinRepository, bulletinValidationRepository
  );
  const validerBulletinsClasseUseCase = new ValiderBulletinsClasseUseCase(
    bulletinValidationRepository, bulletinRepository
  );
  const publierBulletinsClasseUseCase = new PublierBulletinsClasseUseCase(
    bulletinValidationRepository, bulletinRepository, envoyerBulletinsUseCase
  );

  // 8. Use Cases — Conseil de Classe
  const tenirConseilClasseUseCase = new TenirConseilClasseUseCase(
    noteRepository, classeRepository, userRepository
  );
  const preparerVueConseilClasseUseCase = new PreparerVueConseilClasseUseCase(
    new PrismaClassCouncilPreviewQueryPort(prisma),
    classCouncilRepository,
  );
  const creerSessionConseilUseCase = new CreerSessionConseilClasseUseCase(classCouncilRepository, activityLog, auditLog);
  const listerSessionsConseilUseCase = new ListerSessionsConseilClasseUseCase(classCouncilRepository);
  const obtenirSessionConseilUseCase = new ObtenirSessionConseilClasseUseCase(classCouncilRepository);
  const ajouterDecisionConseilUseCase = new AjouterDecisionConseilClasseUseCase(classCouncilRepository);
  const ajouterDecisionsEnBlocUseCase = new AjouterDecisionsEnBlocUseCase(classCouncilRepository);
  const verrouillerConseilUseCase = new VerrouillerConseilClasseUseCase(classCouncilRepository, activityLog);
  const genererPVConseilUseCase = new GenererProcesVerbalUseCase(classCouncilRepository);
  const genererRapportConseilUseCase = new GenererRapportConseilUseCase(classCouncilRepository);

  // Repositories supplémentaires
  const invitationRepository = new PrismaInvitationRepository(prisma);

  // Service token + MFA
  const tokenService = new JwtTokenService();
  const mfaService = new MfaServiceAdapter();

  // 9. Use Cases — User
  const connecterUtilisateurUseCase = new ConnecterUtilisateurUseCase(
    userRepository, schoolRepository, tokenService
  );
  const inscrireUtilisateurUseCase = new InscrireUtilisateurUseCase(userRepository, credentialsNotificationService);
  const rafraichirTokenUseCase = new RafraichirTokenUseCase(
    userRepository, schoolRepository, tokenService
  );
  const deconnecterUtilisateurUseCase = new DeconnecterUtilisateurUseCase(userRepository);
  const modifierUtilisateurUseCase = new ModifierUtilisateurUseCase(userRepository);
  const supprimerUtilisateurUseCase = new SupprimerUtilisateurUseCase(userRepository);
  const transfererEleveUseCase = new TransfererEleveUseCase(userRepository, classeRepository);
  const mfaUseCase = new MfaUseCase(userRepository, mfaService);

  // 10. Use Cases — Finance
  const planFraisRepository = new PrismaPlanFraisRepository(prisma);
  const factureRepository = new PrismaFactureRepository(prisma);
  const paiementRepository = new PrismaPaiementRepository(prisma);
  const depenseRepository = new PrismaDepenseRepository(prisma);
  const campayPaiementService = new CampayPaiementService();

  const creerPlanFraisUseCase = new CreerPlanFraisUseCase(planFraisRepository);
  const changerStatutPlanFraisUseCase = new ChangerStatutPlanFraisUseCase(planFraisRepository);
  const genererFactureUseCase = new GenererFactureUseCase(factureRepository, planFraisRepository);
  const genererFacturesEnMasseUseCase = new GenererFacturesEnMasseUseCase(
    factureRepository, planFraisRepository, userRepository,
  );
  const initierPaiementUseCase = new InitierPaiementMobileMoneyUseCase(
    factureRepository, paiementRepository, campayPaiementService,
  );
  const traiterWebhookUseCase = new TraiterWebhookCampayUseCase(
    paiementRepository, factureRepository,
  );
  const rembourserCautionUseCase = new RembourserCautionUseCase(paiementRepository);
  const enregistrerDepenseUseCase = new EnregistrerDepenseUseCase(
    depenseRepository, userRepository,
  );
  const enregistrerPaiementCashUseCase = new EnregistrerPaiementCashUseCase(
    factureRepository, paiementRepository,
  );
  const copierPlansFraisAnneePrecedenteUseCase = new CopierPlansFraisAnneePrecedenteUseCase(planFraisRepository);

  // 11. Use Cases — Classe + Matière
  const sousGroupeRepository = new PrismaSousGroupeRepository(prisma);

  const modifierClasseUseCase = new ModifierClasseUseCase(classeRepository);
  const supprimerClasseUseCase = new SupprimerClasseUseCase(classeRepository);
  const assignerProfesseurUseCase = new AssignerProfesseurPrincipalUseCase(
    classeRepository, userRepository, rattachementRepository
  );
  const creerSousGroupeUseCase = new CreerSousGroupeTPUseCase(
    classeRepository, sousGroupeRepository
  );
  const assignerElevesUseCase = new AssignerElevesAuSousGroupeUseCase(sousGroupeRepository);
  const listerElevesClasseUseCase = new ListerElevesClasseUseCase(
    classeRepository,
    userRepository,
    noteRepository,
    presenceRepository,
    getMetricUseCase,
  );
  const classeCoefficientRepository = new PrismaClasseCoefficientRepository(prisma);
  const gererMatiereClasseUseCase = new GererMatiereClasseUseCase(
    classeRepository,
    classeCoefficientRepository,
  );
  const genererTableauHonneurUseCase = new GenererTableauHonneurUseCase(
    classeRepository,
    anneeRepository,
    schoolRepository,
    bulletinRepository,
    classCouncilRepository,
    pdfService,
  );
  const genererTableauHonneurAnnuelUseCase = new GenererTableauHonneurAnnuelUseCase(
    classeRepository,
    anneeRepository,
    schoolRepository,
    bulletinRepository,
    classCouncilRepository,
    pdfService,
  );

  const creerMatiereUseCase = new CreerMatiereUseCase(matiereRepository, userRepository);
  const modifierMatiereUseCase = new ModifierMatiereUseCase(matiereRepository, userRepository);
  const assignerEnseignantUseCase = new AssignerEnseignantMatiereUseCase(
    matiereRepository, userRepository
  );
  const definirCoefficientUseCase = new DefinirCoefficientUseCase(matiereRepository);
  const supprimerMatiereUseCase = new SupprimerMatiereUseCase(matiereRepository);

  const creerSalleUseCase = new CreerSalleUseCase(roomRepository);
  const modifierSalleUseCase = new ModifierSalleUseCase(roomRepository);
  const supprimerSalleUseCase = new SupprimerSalleUseCase(roomRepository);

  const teacherUnavailabilityRepository = new PrismaTeacherUnavailabilityRepository(prisma);
  const creerIndisponibiliteEnseignantUseCase = new CreerIndisponibiliteEnseignantUseCase(
    teacherUnavailabilityRepository, userRepository
  );
  const modifierIndisponibiliteEnseignantUseCase = new ModifierIndisponibiliteEnseignantUseCase(
    teacherUnavailabilityRepository
  );
  const supprimerIndisponibiliteEnseignantUseCase = new SupprimerIndisponibiliteEnseignantUseCase(
    teacherUnavailabilityRepository
  );
  const listerIndisponibilitesEnseignantUseCase = new ListerIndisponibilitesEnseignantUseCase(
    teacherUnavailabilityRepository, userRepository
  );

  const creerStudentGroupSetUseCase = new CreerStudentGroupSetUseCase(studentGroupSetRepository);
  const modifierStudentGroupSetUseCase = new ModifierStudentGroupSetUseCase(studentGroupSetRepository);
  const supprimerStudentGroupSetUseCase = new SupprimerStudentGroupSetUseCase(studentGroupSetRepository);
  const creerStudentGroupUseCase = new CreerStudentGroupUseCase(studentGroupRepository, studentGroupSetRepository);
  const modifierStudentGroupUseCase = new ModifierStudentGroupUseCase(studentGroupRepository, studentGroupSetRepository);
  const supprimerStudentGroupUseCase = new SupprimerStudentGroupUseCase(studentGroupRepository, studentGroupSetRepository);
  const assignerSalleClasseUseCase = new AssignerSalleClasseUseCase(classRoomAssignmentRepository, classeRepository, roomRepository);
  const retirerAssignationSalleUseCase = new RetirerAssignationSalleUseCase(classRoomAssignmentRepository);

  // 12. Use Cases — Timetable
  const timetableRepository = new PrismaTimetableRepository(prisma);

  const creerEmploiDuTempsUseCase = new CreerEmploiDuTempsUseCase(timetableRepository);
  const ajouterCreneauUseCase = new AjouterCreneauUseCase(timetableRepository);
  const modifierCreneauUseCase = new ModifierCreneauUseCase(timetableRepository);
  const publierEmploiDuTempsUseCase = new PublierEmploiDuTempsUseCase(timetableRepository);
  const demanderRattrapageUseCase = new DemanderRattrapageUseCase(
    userRepository,
    notificationService,
    rattachementRepository,
  );
  const genererSeancesGroupeUseCase = new GenererSeancesGroupeUseCase(
    timetableRepository, studentGroupRepository, studentGroupMembershipRepository,
    classRoomAssignmentRepository, roomRepository,
  );
  const resoudreParticipantsSeanceUseCase = new ResoudreParticipantsSeanceUseCase(
    timetableRepository, studentGroupMembershipRepository,
  );

  // Scheduling Engine (V2.5) — port hexagonal : le solveur OR-Tools/CP-SAT est interchangeable.
  const schedulingSolver = new ORToolsWasmAdapter();
  const proposerEmploiDuTempsUseCase = new ProposerEmploiDuTempsUseCase(
    timetableRepository, roomRepository, classRoomAssignmentRepository, teacherUnavailabilityRepository, schedulingSolver, schedulingGridAdapter,
  );
  const appliquerPropositionEmploiDuTempsUseCase = new AppliquerPropositionEmploiDuTempsUseCase(
    timetableRepository,
  );
  const simulerEmploiDuTempsUseCase = new SimulerEmploiDuTempsUseCase(
    proposerEmploiDuTempsUseCase, schedulingSolver, timetableRepository,
  );
  const genererSqueletteEmploiDuTempsUseCase = new GenererSqueletteEmploiDuTempsUseCase(
    timetableRepository, anneeRepository, schedulingGridAdapter,
  );

  // 12. Use Cases — HR (repos, câblés dans HRController + copilot core)
  const staffProfileRepository = new PrismaStaffProfileRepository(prisma);
  const leaveRepository = new PrismaLeaveRepository(prisma);
  const employeeFileRepository = new PrismaEmployeeFileRepository(prisma);
  const careerEventRepository = new PrismaCareerEventRepository(prisma);
  const staffAttendanceRepository = new PrismaStaffAttendanceRepository(prisma);
  const missionOrderRepository = new PrismaMissionOrderRepository(prisma);

  // 12bis. Use Cases — Pedagogie
  const programmeRepository = new PrismaProgrammeRepository(prisma);
  const chapitreRepository = new PrismaChapitreRepository(prisma);
  const cahierDeTexteRepository = new PrismaCahierDeTexteRepository(prisma);
  const departmentRepository = new PrismaDepartmentRepository(prisma);
  const listerProgrammeUseCase = new ListerProgrammeUseCase(programmeRepository);
  const gererProgrammeUseCase = new GererProgrammeUseCase(programmeRepository, anneeRepository);
    const gererChapitreUseCase = new GererChapitreUseCase(chapitreRepository, programmeRepository);

  // V2.11 — Pointage présence enseignants (QR/GPS) + gate cahier de textes
  const verifierPresenceAvantCahier = new VerifierPresenceAvantCahierDeTexte(
    staffAttendanceRepository,
    timetableRepository,
  );
  const pointerPresenceEnseignantUseCase = new PointerPresenceEnseignantUseCase(
    staffAttendanceRepository,
    timetableRepository,
    userRepository,
    new JwtQrTokenService(),
  );
  const gererCahierUseCase = new GererCahierDeTexteUseCase(
    cahierDeTexteRepository,
    anneeRepository,
    rattachementRepository,
    verifierPresenceAvantCahier,
  );
  const calculerProgressionUseCase = new CalculerProgressionProgrammeUseCase(programmeRepository, cahierDeTexteRepository, classeRepository, anneeRepository);
  const obtenirSlotUseCase = new ObtenirSlotDuJourUseCase(timetableRepository, anneeRepository);
  const genererRapportUseCase = new GenererRapportPedagogieUseCase(cahierDeTexteRepository, departmentRepository, anneeRepository);

  // 13. Use Cases — AnneeAcademique
  const promotionRepository = new PrismaPromotionRepository(prisma, enrollmentRepository);

  const creerAnneeUseCase = new CreerAnneeAcademiqueUseCase(anneeRepository);
  const definirPeriodeUseCase = new DefinirPeriodeCouranteUseCase(anneeRepository);
  const verifierPrerequisUseCase = new VerifierPrerequisClotureUseCase(anneeRepository);
  const cloturerAnneeUseCase = new CloturerAnneeUseCase(anneeRepository, promotionRepository, activityLog);
  const mettreAJourCalendrierUseCase = new MettreAJourCalendrierUseCase(anneeRepository);
  const proposerStructureAnneeSuivanteUseCase = new ProposerStructureAnneeSuivanteUseCase(
    anneeRepository, classeRepository, promotionRepository,
  );
  const validerStructureAnneeSuivanteUseCase = new ValiderStructureAnneeSuivanteUseCase(anneeRepository, classeRepository);
  const annulerStructureAnneeSuivanteUseCase = new AnnulerStructureProposeeUseCase(anneeRepository, classeRepository);

  // 14. Use Cases — AI
  const santeEleveRepository = new PrismaSanteEleveRepository(prisma);
  const groqIAService = new GroqIAService();
  const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
    santeEleveRepository, groqIAService
  );

  // Infrastructure prédictive (Partie B du plan) — jamais branchée à un flux de production réel
  // (calculerIndiceSanteUseCase ci-dessus reste la seule voie réelle, via IndiceSanteRules
  // directement). Ces deux adapters existent pour être comparés via compareRisquePredictionsUseCase.
  const rulesBasedPredictionService = new RulesBasedPredictionService();
  const tabPfnPredictionService = new TabPfnPredictionService();
  const compareRisquePredictionsUseCase = new CompareRisquePredictionsUseCase(
    santeEleveRepository, rulesBasedPredictionService, tabPfnPredictionService
  );

  // 15. Use Cases — Parent + SchoolSettings
  const schoolSettingsRepository = new PrismaSchoolSettingsRepository(prisma);

  const obtenirEnfantsUseCase = new ObtenirEnfantsUseCase(parentRepository);
  const verifierAccesUseCase = new VerifierAccesEnfantUseCase(parentRepository);
  const obtenirAlertesSoldeUseCase = new ObtenirAlertesSoldeUseCase(parentRepository, factureRepository);
  const obtenirParametresUseCase = new ObtenirParametresEcoleUseCase(schoolSettingsRepository);
  const mettreAJourParametresUseCase = new MettreAJourParametresEcoleUseCase(schoolSettingsRepository, activityLog);
  const proposerReapplicationUseCase = new ProposerReapplicationTemplateUseCase(schoolSettingsRepository, new PrismaSchoolTemplateVersionRepository(prisma));
  const appliquerReapplicationUseCase = new AppliquerReapplicationTemplateUseCase(schoolSettingsRepository, new PrismaSchoolTemplateVersionRepository(prisma), activityLog);

  // 15a. Use Case — Profil académique (V1.1)
  const obtenirProfilAcademiqueUseCase = new ObtenirProfilAcademiqueUseCase(
    new PrismaAcademicProfileQueryRepository(prisma),
    schoolSettingsRepository,
  );

  // 15b. Use Cases — Notes (suite)
  const modifierNoteUseCase = new ModifierNoteUseCase(noteRepository, matiereRepository, schoolSettingsRepository);
  const draftEnMasseUseCase = new DraftEnMasseUseCase(noteRepository, matiereRepository, assessmentSessionRepository);
  const listerNotesUseCase = new ListerNotesUseCase(noteRepository, userRepository, matiereRepository, parentRepository);
  const listerNotesEnAttenteUseCase = new ListerNotesEnAttenteUseCase(noteRepository, userRepository);
  const statutParClasseUseCase = new StatutParClasseUseCase(noteRepository);
  const calculerMoyenneUseCase = new CalculerMoyenneUseCase(noteRepository, matiereRepository, getMetricUseCase);
  const importerNotesExcelUseCase = new ImporterNotesExcelUseCase(noteRepository, matiereRepository, matriculeImportRepository, rattachementRepository);

  // 16. Use Cases — Orientation
  const orientationRepository = new PrismaOrientationRepository(prisma);
  const gradeOrientationRepository = new PrismaGradeOrientationRepository(prisma);
  const creerFicheOrientationUseCase = new CreerFicheOrientationUseCase(orientationRepository);
  const ajouterEntretienUseCase = new AjouterEntretienUseCase(orientationRepository);
  const ajouterTestAptitudeUseCase = new AjouterTestAptitudeUseCase(orientationRepository);
  const creerRecommandationSerieUseCase = new CreerRecommandationSerieUseCase(orientationRepository);
  const ajouterSuiviUseCase = new AjouterSuiviUseCase(orientationRepository);
  const listerFichesOrientationUseCase = new ListerFichesOrientationUseCase(orientationRepository);
  const getStatsOrientationUseCase = new GetStatsOrientationUseCase(orientationRepository);
  const saisirAspirationsEleveUseCase = new SaisirAspirationsEleveUseCase(orientationRepository);
  const genererRecommandationOrientationUseCase = new GenererRecommandationOrientationUseCase(orientationRepository, gradeOrientationRepository);
  const validerRecommandationConseillerUseCase = new ValiderRecommandationConseillerUseCase(orientationRepository);
  const proposerRecommandationEleveUseCase = new ProposerRecommandationEleveUseCase(orientationRepository);
  const choisirPisteEleveUseCase = new ChoisirPisteEleveUseCase(orientationRepository);
  const listerElevesAOrienterUseCase = new ListerElevesAOrienterUseCase(orientationRepository);
  const configurerCheckpointOrientationUseCase = new ConfigurerCheckpointOrientationUseCase(orientationRepository);

  // 17. Use Cases — MasterAdmin
  const inviterEcoleUseCase = new InviterEcoleUseCase(
    schoolRepository, invitationRepository, emailService, emailTemplateAdapter
  );
  const suspendreEcoleUseCase = new SuspendreEcoleUseCase(schoolRepository, invitationRepository);
  const reactiverEcoleUseCase = new ReactiverEcoleUseCase(schoolRepository);
  const rejeterEcoleUseCase = new RejeterEcoleUseCase(schoolRepository, userRepository, emailService);
  const changerPlanUseCase = new ChangerPlanAbonnementUseCase(schoolRepository);
  const masterAdminQueryRepository = new PrismaMasterAdminQueryRepository(prisma);
  const supprimerEcoleUseCase = new SupprimerEcoleUseCase(masterAdminQueryRepository);
  const renvoyerInvitationEcoleUseCase = new RenvoyerInvitationEcoleUseCase(masterAdminQueryRepository);
  const changerStatutEcoleUseCase = new ChangerStatutEcoleUseCase(masterAdminQueryRepository);
  const synchroniserMatieresEcoleUseCase = new SynchroniserMatieresEcoleUseCase(masterAdminQueryRepository);
  const reinitialiserMfaUtilisateurUseCase = new ReinitialiserMfaUtilisateurUseCase(masterAdminQueryRepository);
  const genererPaiementsMinesec = new GenererPaiementsMinesecUseCase(paiementMinesecRepository);
  const creerSqueletteOnboarding = new CreerSqueletteOnboardingUseCase(eleveOnboardingRepository, activityLog);

  // 18. Use Cases — Assessment
  const creerAssessmentScopeUseCase = new CreerAssessmentScopeUseCase(assessmentScopeRepository);
  const planifierAssessmentSessionUseCase = new PlanifierAssessmentSessionUseCase(assessmentSessionRepository);
  const enregistrerParticipationUseCase = new EnregistrerParticipationUseCase(assessmentParticipationRepository);
  const enregistrerParticipationEnLotUseCase = new EnregistrerParticipationEnLotUseCase(assessmentParticipationRepository);
  const genererCodesAnonymatUseCase = new GenererCodesAnonymatUseCase(
    assessmentSessionRepository,
    anonymatRepository,
  );
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
    rattachementRepository,
    assessmentScopeRepository,
  );
  const obtenirFicheCorrectionAnonymeUseCase = new ObtenirFicheCorrectionAnonymeUseCase(
    assessmentSessionRepository,
    anonymatRepository,
  );
  const saisirNotesAnonymesUseCase = new SaisirNotesAnonymesUseCase(
    assessmentSessionRepository,
    anonymatRepository,
  );
  const soumettreCorrectionAnonymeUseCase = new SoumettreCorrectionAnonymeUseCase(
    assessmentSessionRepository,
    anonymatRepository,
  );
  const reconcilierNotesAnonymesUseCase = new ReconcilierNotesAnonymesUseCase(
    assessmentSessionRepository,
    anonymatRepository,
    noteRepository,
    matiereRepository,
    anneeRepository,
    assessmentScopeRepository,
  );
  const listerSessionsCorrectionAnonymeUseCase = new ListerSessionsCorrectionAnonymeUseCase(
    anonymatRepository,
    assessmentSessionRepository,
  );

  // 18bis. Use Cases — Tâches
  const creerTaskUseCase = new CreerTaskUseCase(taskRepository, userRepository);
  const listerTasksUseCase = new ListerTasksUseCase(taskRepository);
  const mettreAJourStatutTaskUseCase = new MettreAJourStatutTaskUseCase(taskRepository);

  // 19. Use Cases — LV2 / PEBS (sync StudentGroupMembership)
  const affecterLV2EleveUseCase = new AffecterLV2EleveUseCase(studentAffectationRepository, anneeRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository);
  const affecterLV2EnMasseUseCase = new AffecterLV2EnMasseUseCase(studentAffectationRepository, anneeRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository);
  const affecterPEBSEleveUseCase = new AffecterPEBSEleveUseCase(studentAffectationRepository, anneeRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository);
  const affecterPEBSEnMasseUseCase = new AffecterPEBSEnMasseUseCase(studentAffectationRepository, anneeRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository);

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
    attendance: {
      enregistrerPresence: enregistrerPresenceUseCase,
      traiterSmsPresence: traiterSmsPresenceUseCase,
      presenceRepository,
      userRepository,
      parentRepository,
    },
    school: {
      onboarder: onboarderEcoleUseCase,
      approuver: approuverEcoleUseCase,
      schoolRepository,
      invitationRepository,
      anneeRepository,
      classeRepository,
      matiereRepository,
      sectionRepository,
      schoolConfigRepository,
      departmentRepository,
    },
    reportCard: {
      generer: genererBulletinUseCase,
      envoyer: envoyerBulletinsUseCase,
      verifierDisponibilite: verifierDisponibiliteUseCase,
      lister: listerBulletinsUseCase,
      soumettreBulletins: soumettreBulletinsClasseUseCase,
      validerBulletins: validerBulletinsClasseUseCase,
      publierBulletins: publierBulletinsClasseUseCase,
      bulletinValidationRepository,
      bulletinRepository,
      parentRepository,
      studentRecommendationRepository,
    },
    classCouncil: {
      creerSession: creerSessionConseilUseCase,
      tenir: tenirConseilClasseUseCase,
      preparerVue: preparerVueConseilClasseUseCase,
      listerSessions: listerSessionsConseilUseCase,
      obtenirSession: obtenirSessionConseilUseCase,
      ajouterDecision: ajouterDecisionConseilUseCase,
      ajouterDecisionsEnBloc: ajouterDecisionsEnBlocUseCase,
      verrouiller: verrouillerConseilUseCase,
      genererPV: genererPVConseilUseCase,
      genererRapport: genererRapportConseilUseCase,
    },
    user: {
      connecter: connecterUtilisateurUseCase,
      inscrire: inscrireUtilisateurUseCase,
      rafraichir: rafraichirTokenUseCase,
      deconnecter: deconnecterUtilisateurUseCase,
      modifier: modifierUtilisateurUseCase,
      supprimer: supprimerUtilisateurUseCase,
      transferer: transfererEleveUseCase,
      importer: importerUtilisateursUseCase,
      importUtilisateursRepository: importUtilisateursRepository,
      mfa: mfaUseCase,
      tokenService,
      schoolRepository,
    },
    masterAdmin: {
      inviter: inviterEcoleUseCase,
      suspendre: suspendreEcoleUseCase,
      reactiver: reactiverEcoleUseCase,
      rejeter: rejeterEcoleUseCase,
      changerPlan: changerPlanUseCase,
      queryRepository: masterAdminQueryRepository,
      supprimerEcole: supprimerEcoleUseCase,
      renvoyerInvitation: renvoyerInvitationEcoleUseCase,
      changerStatut: changerStatutEcoleUseCase,
      synchroniserMatieres: synchroniserMatieresEcoleUseCase,
      reinitialiserMfa: reinitialiserMfaUtilisateurUseCase,
    },
    class: {
      creer: creerClasseUseCase,
      modifier: modifierClasseUseCase,
      supprimer: supprimerClasseUseCase,
      assignerProfesseur: assignerProfesseurUseCase,
      creerSousGroupe: creerSousGroupeUseCase,
      assignerEleves: assignerElevesUseCase,
      listerEleves: listerElevesClasseUseCase,
      gererMatiere: gererMatiereClasseUseCase,
      genererTableauHonneur: genererTableauHonneurUseCase,
      genererTableauHonneurAnnuel: genererTableauHonneurAnnuelUseCase,
      classeCoefficientRepository,
      teachingAssignmentRepository,
    },
    pedagogie: {
      listerProgramme: listerProgrammeUseCase,
      gererProgramme: gererProgrammeUseCase,
      gererChapitre: gererChapitreUseCase,
      gererCahier: gererCahierUseCase,
      calculerProgression: calculerProgressionUseCase,
      obtenirSlot: obtenirSlotUseCase,
      genererRapport: genererRapportUseCase,
    },
    hr: {
      userRepository,
      schoolRepository,
      sectionRepository,
      staffProfileRepository,
      leaveRepository,
      employeeFileRepository,
      careerEventRepository,
      staffAttendanceRepository,
      missionOrderRepository,
    },
    staffAttendance: {
      pointerPresenceEnseignant: pointerPresenceEnseignantUseCase,
      verifierPresenceAvantCahier: verifierPresenceAvantCahier,
      staffAttendanceRepository,
    },
    subject: {
      creer: creerMatiereUseCase,
      modifier: modifierMatiereUseCase,
      assignerEnseignant: assignerEnseignantUseCase,
      definirCoefficient: definirCoefficientUseCase,
      supprimer: supprimerMatiereUseCase,
    },
    room: {
      creer: creerSalleUseCase,
      modifier: modifierSalleUseCase,
      supprimer: supprimerSalleUseCase,
    },
    teacherUnavailability: {
      creer: creerIndisponibiliteEnseignantUseCase,
      modifier: modifierIndisponibiliteEnseignantUseCase,
      supprimer: supprimerIndisponibiliteEnseignantUseCase,
      lister: listerIndisponibilitesEnseignantUseCase,
    },
    studentGroup: {
      creerGroupSet: creerStudentGroupSetUseCase,
      modifierGroupSet: modifierStudentGroupSetUseCase,
      supprimerGroupSet: supprimerStudentGroupSetUseCase,
      creerGroup: creerStudentGroupUseCase,
      modifierGroup: modifierStudentGroupUseCase,
      supprimerGroup: supprimerStudentGroupUseCase,
      assignerSalleClasse: assignerSalleClasseUseCase,
      retirerAssignationSalle: retirerAssignationSalleUseCase,
    },
    timetable: {
      creer: creerEmploiDuTempsUseCase,
      ajouterCreneau: ajouterCreneauUseCase,
      modifierCreneau: modifierCreneauUseCase,
      publier: publierEmploiDuTempsUseCase,
      demanderRattrapage: demanderRattrapageUseCase,
      genererSeancesGroupe: genererSeancesGroupeUseCase,
      resoudreParticipantsSeance: resoudreParticipantsSeanceUseCase,
      proposerEmploiDuTemps: proposerEmploiDuTempsUseCase,
      appliquerProposition: appliquerPropositionEmploiDuTempsUseCase,
      simulerEmploiDuTemps: simulerEmploiDuTempsUseCase,
      genererSquelette: genererSqueletteEmploiDuTempsUseCase,
      timetableRepository,
    },
    academicYear: {
      creer: creerAnneeUseCase,
      definirPeriode: definirPeriodeUseCase,
      verifierPrerequis: verifierPrerequisUseCase,
      cloturer: cloturerAnneeUseCase,
      mettreAJourCalendrier: mettreAJourCalendrierUseCase,
      proposerStructureSuivante: proposerStructureAnneeSuivanteUseCase,
      validerStructureSuivante: validerStructureAnneeSuivanteUseCase,
      annulerStructureSuivante: annulerStructureAnneeSuivanteUseCase,
    },
    finance: {
      creerPlanFrais: creerPlanFraisUseCase,
      genererFacture: genererFactureUseCase,
      genererFacturesEnMasse: genererFacturesEnMasseUseCase,
      initierPaiement: initierPaiementUseCase,
      traiterWebhook: traiterWebhookUseCase,
      rembourserCaution: rembourserCautionUseCase,
      enregistrerDepense: enregistrerDepenseUseCase,
      enregistrerPaiementCash: enregistrerPaiementCashUseCase,
      copierPlansFraisAnneePrecedente: copierPlansFraisAnneePrecedenteUseCase,
      changerStatutPlanFrais: changerStatutPlanFraisUseCase,
      factureRepository,
    },
    ai: {
      calculerIndiceSante: calculerIndiceSanteUseCase,
    },
    prediction: {
      rulesService: rulesBasedPredictionService,
      tabpfnService: tabPfnPredictionService,
      comparerRisque: compareRisquePredictionsUseCase,
    },
    parent: {
      obtenirEnfants: obtenirEnfantsUseCase,
      verifierAcces: verifierAccesUseCase,
      obtenirAlertesSolde: obtenirAlertesSoldeUseCase,
    },
    schoolSettings: {
      obtenir: obtenirParametresUseCase,
      mettreAJour: mettreAJourParametresUseCase,
      proposerReapplication: proposerReapplicationUseCase,
      appliquerReapplication: appliquerReapplicationUseCase,
    },
    academicProfile: {
      obtenirProfil: obtenirProfilAcademiqueUseCase,
    },
    orientation: {
      creerFiche: creerFicheOrientationUseCase,
      ajouterEntretien: ajouterEntretienUseCase,
      ajouterTest: ajouterTestAptitudeUseCase,
      creerRecommandation: creerRecommandationSerieUseCase,
      ajouterSuivi: ajouterSuiviUseCase,
      listerFiches: listerFichesOrientationUseCase,
      getStats: getStatsOrientationUseCase,
      repo: orientationRepository,
      saisirAspiration: saisirAspirationsEleveUseCase,
      genererRecommandation: genererRecommandationOrientationUseCase,
      validerRecommandationConseiller: validerRecommandationConseillerUseCase,
      proposerRecommandationEleve: proposerRecommandationEleveUseCase,
      choisirPisteEleve: choisirPisteEleveUseCase,
      listerElevesAOrienter: listerElevesAOrienterUseCase,
      configurerCheckpoint: configurerCheckpointOrientationUseCase,
    },
    matricule: {
      importerMatricules: new ImporterMatriculesUseCase(matriculeImportRepository),
      verifierMatricule: new VerifierMatriculeUseCase(matriculeImportRepository, new CarteScolaireScrapingAdapter()),
      syncFromCarteScolaire: new SyncFromCarteScolaireUseCase(matriculeImportRepository, paiementMinesecRepository, new CarteScolaireScrapingAdapter()),
      verifierRecu: new VerifierRecuUseCase(paiementMinesecRepository, new CarteScolaireScrapingAdapter()),
      confirmerFuzzy: new ConfirmerCorrespondanceFuzzyUseCase(matriculeImportRepository),
      signalerErreur: new SignalerErreurCarteScolaireUseCase(matriculeImportRepository),
      matriculeImportRepository,
    },
    eleveOnboarding: {
      creerSquelette: creerSqueletteOnboarding,
      soumettreFormulaire: new SoumettreFormulaireOnboardingUseCase(eleveOnboardingRepository),
      valider: new ValiderOnboardingUseCase(eleveOnboardingRepository, activityLog),
      rejeter: new RejeterOnboardingUseCase(eleveOnboardingRepository, activityLog),
      repository: eleveOnboardingRepository,
    },
    credentialsNotificationService,
    statisticalCampaign: {
      verifierCompletude: new VerifierCompletudeSupplementUseCase(new PrismaStatisticalCampaignRepository(prisma)),
      genererDeclaration: new GenererDeclarationStatistiqueMinesecUseCase(
        new PrismaStatisticalQueryAdapter(prisma),
        new PrismaStatisticalCampaignRepository(prisma),
        new VerifierCompletudeSupplementUseCase(new PrismaStatisticalCampaignRepository(prisma)),
      ),
      repository: new PrismaStatisticalCampaignRepository(prisma),
    },
    statisticalCampaignMinedub: {
      repository: minedubReportRepository,
      genererRapport: new GenererRapportSyntheseMinedubUseCase(
        new PrismaStatisticalQueryAdapter(prisma),
        minedubReportRepository,
      ),
    },
    paiementMinesec: {
      genererPaiements: genererPaiementsMinesec,
      genererPaiementsEcole: new GenererPaiementsMinesecPourEcoleUseCase(paiementMinesecRepository, genererPaiementsMinesec),
      getDashboard: new GetStudentPaymentDashboardUseCase(paiementMinesecRepository),
      getOverview: new GetSchoolPaymentOverviewUseCase(paiementMinesecRepository),
      paiementMinesecRepository,
    },
    examen: {
      prepareDossier: new PrepareExamDossierUseCase(examDossierRepository),
      examDossierRepository,
    },
    lv2Choice: {
      ouvrirFenetre: new OuvrirFenetreChoixLV2UseCase(lv2ChoiceRepository),
      soumettreChoix: new SoumettreChoixLV2EleveUseCase(lv2ChoiceRepository, studentAffectationRepository),
      saisirManuel: new SaisirChoixLV2ManuelUseCase(lv2ChoiceRepository, studentAffectationRepository),
      appliquerChoix: new AppliquerChoixLV2UseCase(lv2ChoiceRepository, studentAffectationRepository, anneeRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository),
      suivreFenetre: new SuivreFenetreChoixLV2UseCase(lv2ChoiceRepository),
    },
    entranceExam: {
      creerSession: new CreerSessionConcoursUseCase(entranceExamRepository, notifierEvenement),
      ajouterCandidats: new AjouterCandidatsConcoursUseCase(entranceExamRepository),
      calculerAdmission: new CalculerAdmissionConcoursUseCase(entranceExamRepository),
      enregistrerCep: new EnregistrerResultatCepUseCase(entranceExamRepository, creerSqueletteOnboarding, notifierEvenement),
      resumeSession: new ResumeSessionConcoursUseCase(entranceExamRepository),
      scannerListe: new ScannerListeCandidatsUseCase(entranceExamRepository, documentAiAdapter),
      detecterAnomalies: new DetecterAnomaliesConcoursUseCase(entranceExamRepository),
    },
    pebsExam: {
      creerSession: new CreerSessionPebsUseCase(pebsExamRepository, notifierEvenement),
      ajouterCandidats: new AjouterCandidatsPebsUseCase(pebsExamRepository),
      calculerSelection: new CalculerSelectionPebsUseCase(pebsExamRepository),
      appliquerTransfert: new AppliquerTransfertPebsUseCase(pebsExamRepository, anneeRepository, enrollmentRepository, studentAffectationRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository, notifierEvenement),
      resumeSession: new ResumeSessionPebsUseCase(pebsExamRepository),
      scannerListe: new ScannerListeCandidatsPebsUseCase(pebsExamRepository, documentAiAdapter),
      detecterAnomalies: new DetecterAnomaliesPebsUseCase(pebsExamRepository),
    },
    pushNotification: {
      souscrire: new SouscrirePushUseCase(pushSubscriptionRepository),
      desinscrire: new DesinscrirePushUseCase(pushSubscriptionRepository),
    },
    notification: {
      service: notificationService,
    },
    assessment: {
      scopeRepository: assessmentScopeRepository,
      sessionRepository: assessmentSessionRepository,
      participationRepository: assessmentParticipationRepository,
      anonymatRepository: anonymatRepository,
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
    task: {
      creer: creerTaskUseCase,
      lister: listerTasksUseCase,
      mettreAJourStatut: mettreAJourStatutTaskUseCase,
    },
    lv2pebs: {
      affecterLV2Eleve: affecterLV2EleveUseCase,
      affecterLV2EnMasse: affecterLV2EnMasseUseCase,
      affecterPEBSEleve: affecterPEBSEleveUseCase,
      affecterPEBSEnMasse: affecterPEBSEnMasseUseCase,
    },
    studentDocument: {
      studentProfileRepository,
      schoolRepository,
      anneeRepository,
      bulletinRepository,
      documentRepository: studentDocumentRepository,
    },
    metric: {
      cache: metricCache,
      registry: metricRegistry,
      getMetric: getMetricUseCase,
    },
    events: {
      publisher: eventPublisher,
    },
  };
}

export type Container = ReturnType<typeof creerContainer>;
