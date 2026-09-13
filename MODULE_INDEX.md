# MODULE_INDEX — ZEKOULABIA

> Index des modules pour identifier **rapidement où intervenir** quand une fonctionnalité évolue.
> Convention : un « module métier » = un dossier `application/<module>` (use cases) + son/ses controller(s), routes, repository, et sections frontend associées.
> Liés : [ARCHITECTURE.md](ARCHITECTURE.md) · [FEATURES.md](FEATURES.md) · [CONVENTIONS.md](CONVENTIONS.md)

Chemins raccourcis : `app/` = `backend/src/application`, `infra/` = `backend/src/infrastructure`, `fe/` = `frontend/src`.

---

## A. Modules métier backend (application/)

| Module | Rôle | Dossiers principaux | Fichiers clés | Dépendances |
|---|---|---|---|---|
| **user** (11 UC) | Auth multi-étapes (email OTP + MFA obligatoire Admin/Staff/Teacher, email seul Parent/Student), inscription, CRUD utilisateurs, import Excel, transfert élève, permissions Staff (Censeur/VP/Secrétaire) | `app/user`, `infra/http/controllers/UserController` `.../MasterAuthController` | `ConnecterUtilisateurUseCase`, `LoginEmailOtpUseCase`, `VerifierMfaConnexionUseCase`, `InscrireUtilisateurUseCase`, `ImporterUtilisateursUseCase`, `infra/http/middlewares/auth.ts` (`requirePermission`), `domain/rules/StaffPermissionRules.ts` | `UserRepository`, `TokenService` (JWT), bcrypt, otplib |
| **school** (4 UC) | Onboarding, approbation, **activation déterministe** (crée classes/matières/sections) | `app/school`, `infra/http/controllers/SchoolOnboardingController` `InviteOnboardingController` | `OnboarderEcoleUseCase`, `ApprouverEcoleUseCase`, `ConfigurerEtablissementUseCase`, `ActiverEtablissementUseCase`, `schoolTemplateConfig.ts` | `SchoolRepository`, `EmailService`, Prisma |
| **masterAdmin** (7 UC) | Plateforme : inviter/suspendre/réactiver/rejeter une école, changer de plan | `app/masterAdmin`, `infra/http/controllers/MasterAdminHexController` | `InviterEcoleUseCase`, `SuspendreEcoleUseCase`, `ChangerPlanAbonnementUseCase`, `VerifyMfaUseCase` | `SchoolRepository`, `InvitationRepository`, `EmailService`, otplib |
| **class** (6 UC) | Classes, prof principal, sous-groupes TP, affectation élèves | `app/class`, `infra/http/controllers/ClasseController` | `CreerClasseUseCase`, `SupprimerClasseUseCase`, `AssignerProfesseurPrincipalUseCase`, `CreerSousGroupeTPUseCase` | `ClasseRepository`, `SousGroupeRepository` |
| **subject** (5 UC) | Matières, coefficients, assignation enseignant | `app/subject`, `infra/http/controllers/SubjectController` | `CreerMatiereUseCase`, `AssignerEnseignantMatiereUseCase`, `DefinirCoefficientUseCase` | `MatiereRepository`, `UserRepository` |
| **grade** (5 UC) | Saisie/soumission/validation des notes (workflow MINESEC) | `app/grade`, `infra/http/controllers/GradeController` | `SaisirNoteUseCase`, `SoumettreNoteUseCase`, `ValiderNoteUseCase`, `ValiderEnBlocUseCase`, `RejeterNoteUseCase` | `NoteRepository`, `MatiereRepository` |
| **reportCard** (2 UC) | Bulletins : génération (calcul + PDF) + envoi | `app/reportCard`, `infra/http/controllers/ReportCardController`, `utils/reportCards/` | `GenererBulletinUseCase`, `EnvoyerBulletinsUseCase`, `templates.ts`, `helpers.ts` | `BulletinRepository`, `PdfService`, `EmailService`, `languageHelper` |
| **attendance** (1 UC) | Présences + notifications (SMS/app) | `app/attendance`, `infra/http/controllers/AttendanceController` | `EnregistrerPresenceUseCase` | `PresenceRepository`, `NotificationService`, SMS |
| **timetable** | Emplois du temps, créneaux, publication, rattrapages ; **Scheduling Engine CP-SAT (V2.5)** : propose → apply → what-if | `app/timetable`, `infra/http/controllers/TimetableController` `TimetableGridConfigController`, `infra/scheduling/` | `ProposerEmploiDuTempsUseCase`, `AppliquerPropositionEmploiDuTempsUseCase`, `SimulerEmploiDuTempsUseCase`, `ORToolsWasmAdapter`, `contraintesDouces.ts` | `TimetableRepository`, `SchedulingSolverPort` (or-tools-wasm), Inngest |
| **academicYear** (5 UC) | Années/périodes/séquences, clôture d'année, promotions | `app/academicYear`, `infra/http/controllers/AcademicYearController` | `CreerAnneeAcademiqueUseCase`, `CloturerAnneeUseCase`, `DefinirPeriodeCouranteUseCase`, `MettreAJourCalendrierUseCase` | `AnneeAcademiqueRepository`, `PromotionRepository` |
| **finance** (8 UC) | Plans de frais, factures (unitaire/masse), paiements Mobile Money + cash, dépenses, cautions, webhook | `app/finance`, `infra/http/controllers/FinanceController` | `CreerPlanFraisUseCase`, `GenererFacturesEnMasseUseCase`, `InitierPaiementMobileMoneyUseCase`, `TraiterWebhookCampayUseCase`, `RembourserCautionUseCase`, `EnregistrerDepenseUseCase` | `PlanFraisRepository`, `FactureRepository`, `PaiementRepository`, `DepenseRepository`, `PaiementService` (Campay) |
| **classCouncil** (1 UC) | Conseils de classe (délibérations) | `app/classCouncil`, `infra/http/controllers/ClassCouncilController` | `TenirConseilClasseUseCase` | `ClassCouncilRepository` |
| **orientation** (7 UC) | Fiches d'orientation, entretiens, tests d'aptitude, recommandations de série | `app/orientation`, `infra/http/controllers/OrientationController` | `CreerFicheOrientationUseCase`, `AjouterEntretienUseCase`, `CreerRecommandationSerieUseCase`, `GetStatsOrientationUseCase` | `OrientationRepository` |
| **parent** (2 UC) | Espace parent : enfants, contrôle d'accès | `app/parent`, `infra/http/controllers/ParentController` | `ObtenirEnfantsUseCase`, `VerifierAccesEnfantUseCase` | `ParentRepository` |
| **schoolSettings** (6 UC) | Paramètres établissement (locale, notifications, etc.) + ré-application template (ciblée et en masse) | `app/schoolSettings`, `infra/http/controllers/SchoolSettingsController` `SchoolTemplateAdminController` | `ObtenirParametresEcoleUseCase`, `MettreAJourParametresEcoleUseCase`, `ProposerReapplicationTemplateUseCase`, `AppliquerReapplicationTemplateUseCase`, `PublierVersionTemplateUseCase`, `ProposerReapplicationToutesEcolesUseCase`, `AppliquerReapplicationToutesEcolesUseCase` | `SchoolSettingsRepository`, `SchoolTemplateVersionRepository` |
| **student** (6 UC) | LV2, matières A-Level, profil académique unifié | `app/student`, `infra/http/controllers/AcademicProfileController` | `AffecterLV2EleveUseCase`, `ObtenirProfilAcademiqueUseCase` | Prisma, `AcademicProfileQueryPort` |
| **ai** (1 UC) | Indice de santé scolaire (score + recommandations IA) | `app/ai`, `infra/http/controllers/AIController` | `CalculerIndiceSanteUseCase` | `SanteEleveRepository`, `IAService` (Groq) |
| **assistant** | Copilot admin exécutant (function-calling Groq) : catalogue d'actions + RBAC + undo — 14 actions (classes, matières, LV2, concours, PEBS) | `app/assistant`, `infra/http/controllers/AssistantController` | `adminActionCatalog.ts`, endpoints execute/confirm-action/undo-action | Groq (tools), use cases class/subject/lv2Choice/entranceExam/pebsExam, `AssistantActionLog` |
| **messaging** | Conversations / messages in-app | `app/messaging`, `infra/http/controllers/CommunicationsController` | (modèles `Conversation`/`Message`/`MessageReadStatus`) | Prisma, Socket.io |
| **lv2Choice** (5 UC) | Choix LV2 numérisé : fenêtres, soumission élève/admin, application | `app/lv2Choice`, `infra/http/controllers/Lv2ChoiceController` | `OuvrirFenetreChoixLV2UseCase`, `SoumettreChoixLV2EleveUseCase`, `SaisirChoixLV2ManuelUseCase`, `AppliquerChoixLV2UseCase`, `SuivreFenetreChoixLV2UseCase` | Prisma, `AffecterLV2EleveUseCase` |
| **entranceExam** (7 UC) | Concours d'entrée 6e : sessions, candidats, admission, CEP, scan Vision, anomalies | `app/entranceExam`, `infra/http/controllers/EntranceExamController` | `CreerSessionConcoursUseCase`, `CalculerAdmissionConcoursUseCase`, `EnregistrerResultatCepUseCase`, `ScannerListeCandidatsUseCase`, `DetecterAnomaliesConcoursUseCase` | Prisma, `InscrireUtilisateurUseCase`, Groq (scan) |
| **pebsExam** (7 UC) | Sélection PEBS : sessions, candidats, sélection, transfert classe, scan, anomalies | `app/pebsExam`, `infra/http/controllers/PebsExamController` | `CreerSessionPebsUseCase`, `CalculerSelectionPebsUseCase`, `AppliquerTransfertPebsUseCase`, `ScannerListeCandidatsPebsUseCase`, `DetecterAnomaliesPebsUseCase` | Prisma, Groq (scan) |
| **announcement** (5 UC) | Annonces publiées (ciblées, expiration, modération) | `app/announcement`, `infra/http/controllers/AnnouncementController` | `CreerAnnonceUseCase`, `ModifierAnnonceUseCase`, `ListerAnnoncesUseCase`, `SupprimerAnnonceUseCase`, `PurgerAnnoncesExpireesUseCase` | Prisma, `Announcement` |
| **messagerie** (10 UC) | Messagerie in-app : conversations, canaux classe/parents, modération | `app/messagerie`, `infra/http/controllers/CommunicationsController` | `EnvoyerMessageUseCase`, `ListerConversationsUseCase`, `CreerCanalClasseUseCase`, `CreerCanalParentsUseCase`, `ListerMessagesEnAttenteModerationUseCase` | Prisma, Socket.io |
| **discipline** (2 UC) | Conseils de discipline (convocation, tenue) + registre | `app/discipline`, `infra/http/controllers/DisciplineController` `DisciplineCouncilController` | `ConvoquerConseilDisciplineUseCase`, `TenirConseilDisciplineUseCase` | Prisma, `DisciplineRecord`, `DisciplineCouncilSession` |
| **academicEvent** (5 UC) | Événements académiques, fenêtres, ressources liées | `app/academicEvent`, `infra/http/controllers/AcademicEventController` | `CreerEvenementAcademiqueUseCase`, `DeclencherEvenementUseCase`, `AjusterFenetreEvenementUseCase`, `ObtenirEvenementsActifsUseCase` | Prisma, `AcademicEvent` |
| **matricule** (6 UC) | Matricules, carte scolaire (import, sync, erreurs) | `app/matricule`, `infra/http/controllers/MatriculeController` | `ImporterMatriculesUseCase`, `SyncFromCarteScolaireUseCase`, `ConfirmerCorrespondanceFuzzyUseCase`, `SignalerErreurCarteScolaireUseCase` | Prisma, xlsx, `stringSimilarity` |
| **paiementMinesec** (4 UC) | Paiements MINESEC (génération, synthèses) | `app/paiementMinesec`, `infra/http/controllers/PaiementMinesecController` | `GenererPaiementsMinesecUseCase`, `GenererPaiementsMinesecPourEcoleUseCase`, `GetSchoolPaymentOverviewUseCase` | Prisma, `PaiementMinesec`, `TarifMinesecReference` |
| **statisticalCampaign** (2 UC) | Campagnes statistiques MINESEC (déclarations, ~7 feuilles) | `app/statisticalCampaign`, `infra/http/controllers/StatisticalCampaignController` | `GenererDeclarationStatistiqueMinesecUseCase` | Prisma, `StatisticalCampaignTemplate`, maps MINESEC (FR + EN) |
| **statisticalCampaignMinedub** (1 UC) | Rapports de synthèse MINEDUB (primaire) | `app/statisticalCampaignMinedub`, `infra/http/controllers/StatisticalCampaignMinedubController` | `GenererRapportSyntheseMinedubUseCase` | Prisma, `MinedubStatisticalReport` |
| **eleveOnboarding** (4 UC) | Onboarding élève (squelette, formulaire, validation) | `app/eleveOnboarding`, `infra/http/controllers/EleveOnboardingController` | `CreerSqueletteOnboardingUseCase`, `SoumettreFormulaireOnboardingUseCase`, `ValiderOnboardingUseCase` | Prisma, `StudentOnboarding` |
| **studentGroup** (8 UC) | Groupes d'élèves (sets), assignation de salle | `app/studentGroup`, `infra/http/controllers/StudentGroupController` | `CreerStudentGroupSetUseCase`, `CreerStudentGroupUseCase`, `AssignerSalleClasseUseCase` | Prisma, `StudentGroupSet`, `StudentGroup`, `Room` |
| **schoolGroup** (11 UC) | Groupes d'écoles, transferts d'élèves/enseignants entre écoles | `app/schoolGroup`, `infra/http/controllers/GroupTransferController` `GroupAuthController` `GroupDashboardController` | `LoginGroupOwnerUseCase`, `CreerDemandeTransfertGroupeUseCase`, `AccepterTransfertEleveUseCase`, `AccepterTransfertEnseignantUseCase`, `calculerKpisEcole` | Prisma, `SchoolGroup`, `GroupTransferRequest` |
| **room** (3 UC) | Salles (création, modification, suppression) | `app/room`, `infra/http/controllers/RoomController` | `CreerSalleUseCase`, `ModifierSalleUseCase`, `SupprimerSalleUseCase` | Prisma, `Room` |
| **suivi** (5 UC) | Suivi des élèves (actions, historique) | `app/suivi`, `infra/http/controllers/StudentFollowUpController` | `CreerActionSuiviEleveUseCase`, `AssignerActionSuiviUseCase`, `ListerHistoriqueSuiviEleveUseCase` | Prisma, `StudentFollowUpAction` |
| **apee** (2 UC) | APEE (association parents) : transactions, dépenses | `app/apee`, `infra/http/controllers/APEEController` | `CreerTransactionAPEEUseCase`, `ValiderDepenseAPEEUseCase` | Prisma, `APEETransaction` |
| **pushNotification** (2 UC) | Abonnements push (souscription/désinscription) | `app/pushNotification`, `infra/http/controllers/PushNotificationController` | `SouscrirePushUseCase`, `DesinscrirePushUseCase` | Prisma, `PushSubscription` |
| **hr** (1 UC) | Analyse de diplômes (IA) | `app/hr`, `infra/http/controllers/HRController` | `AnalyserDiplomeUseCase` | Groq, `EmployeeFile` |
| **examen** (1 UC) | Préparation des dossiers d'examen | `app/examen`, `infra/http/controllers/ExamenController` | `PrepareExamDossierUseCase` | Prisma, `ExamRegistration` |

---

## B. Modules transverses backend (hors application/)

| Module | Rôle | Emplacement | Notes |
|---|---|---|---|
| **Container / Bootstrap** | Composition root : câble repos + services + use cases, monte les routes | `infra/config/container.ts`, `infra/config/hexagonal.bootstrap.ts` | Point unique où l'on branche un nouveau use case / une nouvelle route |
| **Auth / RBAC** | Middlewares JWT, multi-tenant, sécurité master, rate-limit | `infra/http/middlewares/auth.ts`, `authMultiTenant.ts`, `masterAuthSecurity.ts`, `rateLimit.ts` | `requireAuth`, `requireRole`, `requireSchool` |
| **i18n / langue** | Source unique de langue + templates emails | `utils/languageHelper.ts`, `utils/emailTemplates.ts` | `resolveLanguage`, `instructionLangue` |
| **Documents** | Génération PDF : bulletins, documents scolaires, RH | `utils/reportCards/`, `utils/schoolDocuments/`, `utils/hrDocuments.ts`, `infra/services/pdf/PdfKitBulletinService.ts` | PDFKit |
| **IA (Groq)** | Façade LLM | `infra/services/ai/GroqClient.ts`, `infra/services/ai/GroqIAService.ts` | `generateWithGroq`, `groqModel` (`openai/gpt-oss-120b`) |
| **Intégrations externes** | Mobile Money, Email, SMS | `infra/services/payment/CampayClient.ts` + `CampayPaiementService.ts`, `infra/services/email/EmailService.ts` + `NodemailerEmailService.ts`, `infra/services/sms/SmsService.ts` + `SmsNotificationService.ts` | |
| **Jobs asynchrones** | Bulletins en masse, EDT auto, notifications | `inngest/functions.ts`, `inngest/index.ts` | Inngest |
| **Temps réel** | Notifications poussées | `socket/io.ts`, `infra/services/notification/SocketNotificationService.ts` | Socket.io |
| **Persistence** | 27 repositories Prisma | `infra/persistence/prisma/*Repository.ts`, `config/prisma.ts` | Implémentent les ports |
| **Scripts / migrations data** | Seed, migrations ponctuelles, reset master | `scripts/` | ex. `migrate-lv2-subjects.ts`, `reset-master.ts` |
| **Schéma DB** | 133 modèles Prisma | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Multi-tenant par `schoolId` |

---

## C. Modules frontend

| Module | Rôle | Emplacement | Fichiers clés |
|---|---|---|---|
| **Dashboard Admin** (32 sections) | Toute la gestion école + examens/admissions | `fe/app/admin/dashboard` | `page.tsx`, `_components/Section*.tsx`, `AdminSidebar/Topbar/Toast`, `AssistantWidget` |
| **Dashboard Enseignant** (12) | Notes, présences, cahier de texte, PP | `fe/app/teacher/dashboard` | `_components/SectionTeacher*`, `SectionCahierDeTexte`, `SectionProfesseurPrincipal` |
| **Dashboard Staff** (16) | Selon permissions (Censeur, Intendant, discipline, orientation, biblio…) | `fe/app/staff/dashboard` | `_components/Section*Staff`, `SectionDiscipline`, `SectionFinanceStaff`, `SectionLibrary` |
| **Dashboard Parent** (8) | Suivi enfants, paiements, bulletins | `fe/app/parent/dashboard` | `_components/SectionParent*` |
| **Dashboard Élève** (7) | Notes, bulletins, EDT, biblio, onboarding | `fe/app/student/dashboard` | `_components/SectionStudent*` |
| **Dashboard Master** | Super-admin plateforme | `fe/app/master` | `_components/SectionSchools`, `SectionLogs`, `MasterModals` |
| **Dashboard Group** | Propriétaire d'un groupe d'écoles | `fe/app/group` | `dashboard/`, `login`, `[token]` |
| **Onboarding Phase 1** | Wizard d'inscription (token) | `fe/app/onboarding/[token]/page.tsx` | `detectTemplate`, `TEMPLATE_META`, PEBS, LV2 |
| **Onboarding Phase 2** | Conversationnel + activation | `fe/app/admin/configuration` | `page.tsx`, `ConversationalOnboarding.tsx` (réconcilié depuis Phase 1) |
| **Onboarding élève** | Squelette + formulaire + validation | `fe/app/eleve-onboarding` | Élève préinscrit valide son dossier |
| **Auth / public** | Login, reset, landing, invite | `fe/app/login`, `reset-password`, `invite`, `components/LandingPage` | |
| **Socle i18n** | Traduction FR/EN | `fe/lib/i18n/`, `fe/locales/{fr,en}/*.json` (13 namespaces) | `useT`, `LanguageProvider`, `resolveLanguage`, `README.md` |
| **Thème** | Clair/sombre | `fe/app/providers.tsx` (next-themes), `fe/app/globals.css` (`.dark`), `components/ThemeToggle` | |
| **Offline / PWA** | File d'attente hors-ligne | `fe/lib/offline/` (Dexie), `components/OfflineIndicator/EmptyState` | |
| **Composants partagés** | UI transverse | `fe/components/` + `fe/components/ui/` (shadcn) | `AnimatedBackground`, `LanguageSwitch`, `PasswordStrengthBar` |
| **Accès réseau** | Wrapper API + auth session | `fe/lib/fetchApi.ts`, `fe/lib/userAuth.ts` | cookies, `/api/v2/*` |

---

## D. Où intervenir — aide-mémoire

- **Nouveau champ métier persistant** → `schema.prisma` (+ migration) → port/repository → use case → controller/route → section frontend.
- **Nouvelle action admin (copilot)** → `application/assistant/adminActionCatalog.ts`.
- **Nouveau document PDF** → `utils/schoolDocuments/` ou `utils/reportCards/` + controller dédié.
- **Nouvelle langue/texte UI** → `fe/locales/{fr,en}/<namespace>.json` (parité obligatoire) + `useT`.
- **Nouvelle route API** → controller + `routes/*.routes.ts` + montage dans `hexagonal.bootstrap.ts` (via `container`).
- **Logique de langue** → toujours `resolveLanguage` (jamais recréer).
