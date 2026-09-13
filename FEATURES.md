# FEATURES — ZEKOULABIA

> Le projet vu **par fonctionnalité métier** (pas fichier par fichier). Pour chaque feature : objectif, dossiers/fichiers principaux, interactions.
> Liés : [ARCHITECTURE.md](ARCHITECTURE.md) · [MODULE_INDEX.md](MODULE_INDEX.md) · [CONVENTIONS.md](CONVENTIONS.md)
> Raccourcis : `app/` = `backend/src/application`, `infra/` = `backend/src/infrastructure`, `fe/` = `frontend/src`.

---

## 1. Onboarding d'un établissement (2 phases)

**Objectif** : transformer une invitation en un établissement **actif et entièrement configuré** (classes, matières, sections, calendrier), avec la structure MINESEC correcte.

- **Phase 1 — Wizard d'inscription** (`fe/app/onboarding/[token]/page.tsx`) : accessible via le lien d'invitation. Collecte sous-système, type/template (`detectTemplate` + `TEMPLATE_META`), cycles, niveaux, séries/filières, LV2 (dès la 4e), **PEBS**, primaire/technique, mot de passe admin. Sauvegarde un `onboardingConfig` sur l'école (`InviteOnboardingController.completeOnboarding`).
- **Phase 2 — Conversationnel + activation** (`fe/app/admin/configuration/`, `ConversationalOnboarding.tsx`) : après approbation, **se nourrit de la Phase 1** (réconciliation : pré-remplit et ne repose que les questions manquantes — LV2 org, calendrier, frais, direction). Puis **activation déterministe** : `ConfigurerEtablissementUseCase` → `ActiverEtablissementUseCase` crée classes/matières/sections/coefficients.
- **Backend** : `app/school/*`, `SchoolOnboardingController`, `InviteOnboardingController`, `schoolTemplateConfig.ts`.
- **Interactions** : email d'invitation/approbation (bilingue), langue via `resolveLanguage`, template → coefficients (`CycleCoefficient`, `BacCoefficient`, `AnglophoneSubjectLoad`).

## 2. Plateforme master (super-admin)

**Objectif** : gérer le cycle de vie des écoles clientes.
- **Fonctions** : inviter, approuver/rejeter, suspendre/réactiver, changer de plan.
- **Fichiers** : `app/masterAdmin/*`, `MasterAdminHexController`, `MasterAuthController`, `fe/app/master/`.
- **Sécurité** : auth master dédiée + **MFA (otplib)** + audit (`MasterAuthAudit`), middlewares `masterAuthSecurity`/`masterSensitiveAuth`.

## 3. Authentification & rôles (RBAC multi-tenant)

**Objectif** : sécuriser l'accès et isoler chaque école.
- **Fichiers** : `app/user/*` (`ConnecterUtilisateurUseCase`, `LoginEmailOtpUseCase`, `VerifierMfaConnexionUseCase`, refresh/logout), `infra/http/controllers/UserController.ts` (login multi-étapes + gestion MFA), `middleware/auth.ts` (`requireAuth`, `requireRole`, `requirePermission`), `middleware/requireUserSensitiveAuth.ts`, `domain/rules/StaffPermissionRules.ts`, `fe/app/login/page.tsx` (stepper), `fe/components/MfaSettings.tsx`, `fe/lib/userAuth.ts`, `fe/lib/fetchApi.ts`.
- **Mécanique** : JWT en cookie HTTP-only (`access_token`), `req.user.schoolId` borne toutes les requêtes ; STAFF a des `StaffPermissionType` (titres terrain → permissions).
- **Délégation pédagogique Staff & Gouvernance Proviseur (septembre 2026)** :
  - **Permissions Censeur / VP** : `MANAGE_CLASSES` (classes/salles/PP), `MANAGE_STUDENT_ASSIGNMENTS` (affectations/transferts d'élèves), `MANAGE_TEACHING_ASSIGNMENTS` (affectations enseignants ↔ matières), `MANAGE_ENROLLMENT` (inscriptions/imports Secrétaire).
  - **Opérations quotidiennes** : exécutables immédiatement par le Staff habilité avec enregistrement obligatoire dans le journal d'audit `ActivitiesLog` (`PEDAGOGY_*`).
  - **Opérations de structure N+1 & Clôture** : la proposition et l'annulation N+1 (`propose-next-structure`, `cancel-proposed-structure`) sont accessibles au Censeur (`MANAGE_CLASSES` / `VALIDATE_GRADES`) et à l'Admin ; la validation de structure (`DRAFT` → `ACTIVE`) et la clôture d'année (`close`) restent strictement réservées au Proviseur (`ADMIN` uniquement).
- **Connexion renforcée (juillet 2026)** : plus aucune session immédiate. Toute connexion passe par un code envoyé par email ; pour **ADMIN/STAFF/TEACHER**, une double authentification TOTP est ensuite **obligatoire** (configuration forcée dès la 1ère connexion via QR + codes de récupération, aucun accès dashboard tant qu'elle n'est pas activée, jamais désactivable — seule une reconfiguration guardée par mot de passe + code actuel est possible depuis le dashboard). **PARENT/STUDENT** n'ont que l'étape email. Déblocage d'un compte ayant perdu authenticator + codes de récupération : capacité dédiée côté Master (`MasterAdminHexController.reinitialiserMfaUtilisateur`, journalisée).

## 4. Gestion des utilisateurs

**Objectif** : créer/gérer élèves, parents, enseignants, staff ; imports en masse.
- **Fichiers** : `app/user/*` (`InscrireUtilisateurUseCase`, `ImporterUtilisateursUseCase`, `TransfererEleveUseCase`), `UserController`, `fe/app/admin/dashboard/_components/SectionUsers.tsx`.
- **Interactions** : import Excel (xlsx/multer), rattachement parent↔élève (`ParentStudent`), profils (`StudentProfile`, `TeacherProfile`, `ParentProfile`, `StaffProfile`).

## 5. Classes, matières & affectations

**Objectif** : structurer l'école (classes, sous-groupes TP, matières, coefficients, enseignants).
- **Fichiers** : `app/class/*`, `app/subject/*`, `ClasseController`, `SubjectController`, `TeachingAssignmentController`, `fe/.../SectionClasses.tsx`, `SectionSubjects.tsx`, `SectionAffectations.tsx`.
- **Interactions** : prof principal, sous-groupes TP (`ClassSubGroup`), LV2/A-Level par élève (module `student`), coefficients par cycle/filière.

## 6. Notes (workflow MINESEC)

**Objectif** : saisie → soumission → validation des notes, avec contrôle hiérarchique.
- **Fichiers** : `app/grade/*` (`SaisirNoteUseCase`, `SoumettreNoteUseCase`, `ValiderNoteUseCase`, `ValiderEnBlocUseCase`, `RejeterNoteUseCase`), `GradeController`, `fe/.../SectionTeacherGrades.tsx`, `SectionGradeValidation.tsx`, `SectionGrades.tsx`.
- **Interactions** : statuts de validation (`DRAFT`/`SUBMITTED`/`VALIDATED`/`LOCKED`), prérequis des bulletins (Loi : bulletins bloqués si notes non validées).

## 7. Bulletins (report cards)

**Objectif** : générer et distribuer les bulletins PDF, corrects par sous-système/langue.
- **Fichiers** : `app/reportCard/*` (`GenererBulletinUseCase`, `EnvoyerBulletinsUseCase`), `ReportCardController`, `utils/reportCards/templates.ts` + `helpers.ts`, `PdfKitBulletinService`, `fe/.../SectionBulletins.tsx`, `SectionStudentBulletins.tsx`.
- **6 templates** : FR_SECONDARY, EN_SECONDARY, TECHNICAL_FR, PRIMARY, ANNUAL, MONTHLY. Langue résolue via `resolveLanguage` (PRIMARY/ANNUAL dynamiques). Mentions MINESEC déterministes.
- **Interactions** : notes validées, coefficients, présences (absences), langue/section, envoi email/SMS, génération en masse via **Inngest**.

## 8. Présences

**Objectif** : enregistrer les présences et alerter les parents.
- **Fichiers** : `app/attendance/*`, `AttendanceController`, `fe/.../SectionTeacherAttendance.tsx`, `SectionAdminAttendance.tsx`.
- **Interactions** : **SMS/notifications** aux parents (absence, seuil d'absences), créneaux électifs (LV2/A-Level).

## 9. Emplois du temps

**Objectif** : construire, publier et ajuster les emplois du temps ; génération automatique assistée par IA.
- **Fichiers** : `app/timetable/*`, `TimetableController`, `TimetableAutoController` (IA), `TimetableGridConfigController`, `fe/.../SectionTimetable.tsx`, `SectionGrilleHoraire.tsx`, `SectionTimetableStaff.tsx`.
- **Interactions** : créneaux électifs `isLV2Slot`/`isElectiveSlot`, génération auto via **Groq** + **Inngest**, drag & drop (`@dnd-kit`), demandes de rattrapage.

## 10. Année scolaire, périodes & promotions

**Objectif** : gérer le calendrier académique et la clôture d'année.
- **Fichiers** : `app/academicYear/*` (`CreerAnneeAcademiqueUseCase`, `CloturerAnneeUseCase`, `DefinirPeriodeCouranteUseCase`), `AcademicYearController`, `fe/.../SectionAcademicYear.tsx`.
- **Interactions** : périodes/séquences (`AcademicPeriod`/`AcademicSequence`), promotions d'élèves (`ClassPromotion`/`StudentPromotion`), prérequis de clôture.

## 11. Finances (Mobile Money)

**Objectif** : facturer et encaisser (MTN/Orange Money + cash), gérer dépenses et cautions.
- **Fichiers** : `app/finance/*` (`CreerPlanFraisUseCase`, `GenererFacturesEnMasseUseCase`, `InitierPaiementMobileMoneyUseCase`, `TraiterWebhookCampayUseCase`, `RembourserCautionUseCase`, `EnregistrerDepenseUseCase`), `FinanceController`, `CampayPaiementService`, `fe/.../SectionFinance.tsx`, `SectionFinanceStaff.tsx`, `SectionParentPayments.tsx`.
- **Interactions** : **Campay** (webhook), reçus SMS, factures en masse, cautions (`Expense`/`Invoice`/`Payment`).

## 12. Communications & notifications

**Objectif** : messagerie in-app, annonces, notifications temps réel, publipostage.
- **Fichiers** : `app/messaging`, `CommunicationsController`, `SocketNotificationService`, `EmailLogController`, `SMSController`, `fe/.../SectionCommunications.tsx`.
- **Interactions** : Socket.io (in-app), Email (Resend/Nodemailer), SMS (bilingues), modèles `Notification`/`Announcement`/`Message`/`BroadcastLog`.
- **Son des notifications** (juillet 2026) :
  - **In-app** (app ouverte, Socket.io) : **fait**. `fe/lib/notificationSound.ts` (carillon synthétisé en Web Audio API, aucun fichier audio) déclenché depuis `fe/hooks/NotificationContext.tsx` (`onNotification`) — un seul point de branchement, couvre tous les rôles/dashboards puisque `NotificationBell`/`NotificationCenter` partagent ce contexte.
  - **Push** (app fermée/tél. verrouillé, `fe/worker/index.js`) : son **système par défaut uniquement** (`silent: false`, explicite dans le code) — un son **personnalisé** n'est PAS atteignable en Web Push standard (limite navigateur, surtout iOS), quel que soit le code écrit ici. **Reste à faire, uniquement au moment de l'empaquetage Capacitor** (voir ARCHITECTURE.md §8 ADR-10) : basculer sur `@capacitor/push-notifications` (APNs/FCM) et fournir un fichier son (`.caf`/`.wav` iOS, `.mp3`/`.wav` Android) dans le payload de notification. Rien à préparer avant cette bascule. Plan détaillé : [Plan_Capacitor_Mobile_ZekoulABia.md](docs/Plan_Capacitor_Mobile_ZekoulABia.md).

## 13. Assistant IA / Copilot admin

**Objectif** : assistant conversationnel **exécutant** dans le dashboard (function-calling), soumis au RBAC, avec confirmation des actions destructives et annulation (undo).
- **Fichiers** : `app/assistant/adminActionCatalog.ts`, `AssistantController` (`execute`/`confirm-action`/`undo-action`), `AIController` (assistant informatif, insights, commentaires), `fe/.../AssistantWidget.tsx`.
- **Interactions** : **Groq** (tools), use cases existants (class/subject…), journal `AssistantActionLog`, langue via `resolveLanguage`.

## 14. Conseils de classe & discipline

**Objectif** : délibérations et suivi disciplinaire.
- **Fichiers** : `app/classCouncil/*`, `ClassCouncilController`, `fe/.../SectionAdminCouncil.tsx`, `SectionCouncil.tsx`, `SectionDiscipline.tsx` ; modèles `ClassCouncilSession/Decision`, `DisciplineRecord`.

## 15. Orientation scolaire

**Objectif** : fiches d'orientation, entretiens, tests d'aptitude, recommandations de série.
- **Fichiers** : `app/orientation/*`, `OrientationController`, `fe/.../SectionOrientation.tsx` ; modèles `FicheOrientation`, `EntretienOrientation`, `TestAptitude`, `RecommandationSerie`.

## 16. RH & documents

**Objectif** : dossiers employés, carrière, congés, ordres de mission ; génération de documents.
- **Fichiers** : `HRController`, `utils/hrDocuments.ts`, `StudentDocumentController`, `utils/schoolDocuments/`, `fe/.../SectionRH.tsx` ; modèles `EmployeeFile`, `CareerEvent`, `LeaveRequest`, `MissionOrder`, `VerifiableDocument`.
- **Interactions** : documents bilingues (certificats, attestations), QR de vérification (qrcode).

## 17. Bibliothèque / patrimoine

**Objectif** : gestion des livres et prêts.
- **Fichiers** : `fe/.../SectionLibrary.tsx`, `SectionStudentLibrary.tsx` ; modèles `Book`, `BookLoan`.

## 18. Pédagogie (cahier de texte, programmes)

**Objectif** : suivi pédagogique (programmes, chapitres, cahier de texte).
- **Fichiers** : `PedagogieController`, `fe/.../SectionPedagogie.tsx`, `SectionCahierDeTexte.tsx`, `SectionDepartementAP.tsx` ; modèles `Programme`, `Chapitre`, `CahierDeTexte`.

## 19. Statistiques & IA santé scolaire

**Objectif** : tableaux de bord analytiques + indice de santé/risque élève.
- **Fichiers** : `StatisticsController`, `app/ai/CalculerIndiceSanteUseCase`, `AIController` (`detectRisk`), `fe/.../SectionStatistics.tsx`, `SectionAdminAI.tsx` (Recharts).

## 20. Espace parent

**Objectif** : suivi des enfants (notes, bulletins, paiements, présences).
- **Fichiers** : `app/parent/*`, `ParentController`, `fe/app/parent/dashboard/_components/*`.

## 21. Internationalisation (i18n) & thème

**Objectif** : afficher la bonne langue par sous-système/section, et un thème clair/sombre cohérent.
- **i18n** : `fe/lib/i18n/`, `fe/locales/{fr,en}/*.json` (13 namespaces, parité stricte), `useT` ; backend `utils/languageHelper.ts` (`resolveLanguage`). Emails/SMS/bulletins/prompts Groq alignés sur cette source unique.
- **Thème** : `next-themes` (`providers.tsx`), tokens `.dark` (`globals.css`), `ThemeToggle`.

## 22. Mode hors-ligne (PWA)

**Objectif** : continuer à travailler sans connexion (ex. saisie enseignant) et synchroniser ensuite.
- **Fichiers** : `fe/lib/offline/` (Dexie), `@ducanh2912/next-pwa`, `components/OfflineIndicator`, modèle `OfflineQueue`, `fe/.../SectionOfflineStatus.tsx`.
- **Stratégie multi-plateforme** (Desktop/Android/iPhone, empaquetage mobile futur via Capacitor) : voir ARCHITECTURE.md §8 ADR-10.

---

## Matrice d'interdépendances (survol)

- **Bulletins** dépendent de : notes validées + coefficients + présences + langue/section + PDF + email/SMS.
- **Onboarding** produit : classes + matières + sections + coefficients → base de presque tout le reste.
- **Langue** (`resolveLanguage`) irrigue : UI, emails, SMS, bulletins, prompts IA.
- **Finances** dépendent de : plans de frais + élèves + Campay ; alimentent reçus SMS.
- **Assistant** consomme : use cases existants + RBAC + langue + 14 actions (dont LV2, concours, PEBS).
- **Examens & Admissions** : concours d'entrée 6e → CEP → création compte élève ; sélection PEBS → transfert classe ; choix LV2 → affectation matière. IA : scan Vision + anomalies + copilot.

---

## 23. Concours d'entrée en 6e (Sous-module A)

**Objectif** : gérer le cycle complet d'admission en 6e (concours + CEP) sans création prématurée de comptes élèves.

- **Backend** : `app/entranceExam/*` (7 use cases), `EntranceExamController`, `entranceExam.routes.ts`
- **Schéma** : `EntranceExamSession` + `EntranceExamCandidate` + enums `EntranceExamStatus`, `AdmissionStatus`, `CepResult`
- **Flux** : création session → import candidats (Excel ou scan Vision) → calcul admission (seuil/places) → ADMIS_PROVISOIRE → résultat CEP (Réussi → compte élève créé + affecté 6e / Échoué → ANNULE)
- **IA** : scan Vision Groq (liste papier → JSON), détection anomalies (doublons, scores suspects, cas limites)
- **Copilot** : actions `creer_session_concours`, `resume_concours`, `calculer_admission_concours`
- **Frontend** : `SectionAdminEntranceExams.tsx` — sessions, import, calcul, suivi CEP, scan

---

## 24. Sélection PEBS post-examen (Sous-module B)

**Objectif** :组织 l'examen interne de sélection PEBS et transférer les élèves sélectionnés vers la classe cible.

- **Backend** : `app/pebsExam/*` (7 use cases), `PebsExamController`, `pebsExam.routes.ts`
- **Schéma** : `PebsExamSession` + `PebsExamCandidate` + enums `PebsExamStatus`, `SelectionResult`
- **Flux** : création session (niveau + classe cible) → inscrire candidats → calcul sélection → **confirmation explicite** → transfert classe + affectation `pebsFiliere`
- **IA** : scan Vision, détection anomalies
- **Copilot** : actions `creer_session_pebs`, `calculer_selection_pebs`, `appliquer_transfert_pebs` (destructif)
- **Frontend** : `SectionAdminPebsExams.tsx` — sessions, calcul, écran confirmation transfert

---

## 25. Choix LV2 numérisé (Sous-module C)

**Objectif** : numériser le choix de langue LV2 des élèves (déclaration de préférence, pas un examen).

- **Backend** : `app/lv2Choice/*` (5 use cases), `Lv2ChoiceController`, `lv2Choice.routes.ts`
- **Schéma** : `Lv2ChoiceWindow` + `Lv2ChoiceSubmission` + enums `ChoiceWindowStatus`, `SubmissionMethod`
- **Flux** : admin ouvre fenêtre (niveau + dates) → élèves soumettent choix côté dashboard → admin suit qui a répondu → saisie manuelle de secours → application (affecte `lv2SubjectId`)
- **Double option** : saisie directe élève (`STUDENT_DIRECT`) OU saisie manuelle admin (`ADMIN_MANUAL`)
- **Copilot** : actions `ouvrir_fenetre_lv2`, `suivi_lv2`
- **Frontend admin** : `SectionAdminLV2Choice.tsx` — création, suivi, saisie manuelle
- **Frontend élève** : endpoints `/students/me/lv2-choice-window` et `/students/me/lv2-choice`

---

## 26. Annonces

**Objectif** : publier des annonces ciblées (rôles/classes), avec expiration et modération.

- **Backend** : `app/announcement/*` (5 use cases), `AnnouncementController`, `announcement.routes.ts`
- **Schéma** : `Announcement` (cibles, dates, statut modération via `SchoolConfig`)
- **Frontend** : sections annonces côté admin/staff/élèves
- **Interactions** : ciblage par rôle/classe, purge automatique des annonces expirées (`PurgerAnnoncesExpireesUseCase`)

## 27. Messagerie in-app & modération

**Objectif** : conversations entre membres de l'établissement (élève→enseignant, canaux classe/parents), avec modération optionnelle.

- **Backend** : `app/messagerie/*` (10 use cases), `CommunicationsController`, `messagerie.routes.ts`
- **Schéma** : `Conversation`, `ConversationParticipant`, `Message`, `MessageReadStatus`
- **Règles** : accès aux conversations privées réservé aux participants ; modération `PENDING` activable via `SchoolConfig.messageModeration` ; idempotence `clientMessageId`
- **Frontend** : `SectionCommunications.tsx` et écrans messagerie

## 28. Événements académiques

**Objectif** : planifier des événements (examens, échéances) avec fenêtres et ressources liées.

- **Backend** : `app/academicEvent/*` (5 use cases), `AcademicEventController`, `academicEvent.routes.ts`
- **Schéma** : `AcademicEvent`, `SchoolCalendarException`
- **Interactions** : activation de ressources liées au déclenchement (`activerRessourceLiee`), ajustement de fenêtres

## 29. Discipline

**Objectif** : registre disciplinaire et conseils de discipline.

- **Backend** : `app/discipline/*` (2 use cases), `DisciplineController` (lister/creer/lever), `DisciplineCouncilController`, `discipline.routes.ts`
- **Schéma** : `DisciplineRecord`, `DisciplineCouncilSession`
- **Interactions** : justification des absences persistée (`AttendanceController.justifierAbsence`), convocation/tenue de conseil

## 30. Groupes d'écoles & transferts (multi-établissement)

**Objectif** : un propriétaire de groupe (`SchoolGroup`) gère plusieurs écoles et orchestre les transferts d'élèves/enseignants entre elles.

- **Backend** : `app/schoolGroup/*` (11 use cases), `GroupAuthController` (login dédié), `GroupTransferController`, `GroupDashboardController`, `GroupTransferController`
- **Schéma** : `SchoolGroup`, `SchoolGroupOwner`, `GroupTransferRequest`
- **Flux** : demande de transfert (école A) → validation (école B) → acceptation (`AccepterTransfertEleve/EnseignantUseCase`) ; KPI consolidés (`calculerKpisEcole`)
- **Frontend** : `fe/app/group/` (login, `[token]`, dashboard)

## 31. Statistiques officielles (MINESEC / MINEDUB)

**Objectif** : générer les déclarations statistiques réglementaires.

- **Backend** : `app/statisticalCampaign/*` (`GenererDeclarationStatistiqueMinesecUseCase`), `app/statisticalCampaignMinedub/*` (`GenererRapportSyntheseMinedubUseCase`), controllers `StatisticalCampaignController` / `StatisticalCampaignMinedubController`
- **Schéma** : `StatisticalCampaignTemplate`, `CampaignFieldMapping`, `StatisticalSubmission`, `MinedubStatisticalReport`
- **Détail** : maps de correspondance MINESEC (`minesecAgeDistributionMap`, `minesecEsgFieldMap`, `minesecEstpGridMap`, `minesecFixedFieldMap`, `minesecTechnicalCatalog`), champs auto résolus (`resolveAutoFields`)

## 32. Matricules & carte scolaire

**Objectif** : importer/gérer les matricules (dont carte scolaire officielle), détecter et corriger les erreurs.

- **Backend** : `app/matricule/*` (6 use cases), `MatriculeController`, `matricule.routes.ts`
- **Schéma** : `MatriculeImportJob`, `InscriptionMinesec`
- **Interactions** : import Excel (`parserMatriculeExcel`), synchronisation carte scolaire (`SyncFromCarteScolaireUseCase`), correspondance floue (`stringSimilarity`, `ConfirmerCorrespondanceFuzzyUseCase`)

## 33. APEE (association des parents)

**Objectif** : transactions et dépenses de l'association des parents d'élèves.

- **Backend** : `app/apee/*` (2 use cases), `APEEController`, `apee.routes.ts`
- **Schéma** : `APEETransaction`
- **Flux** : création de transaction → validation de dépense (`ValiderDepenseAPEEUseCase`)

## 34. Suivi des élèves

**Objectif** : actions de suivi individuel et historique.

- **Backend** : `app/suivi/*` (5 use cases), `StudentFollowUpController`
- **Schéma** : `StudentFollowUpAction`
- **Flux** : création d'action → assignation → clôture ; historique par élève

## 35. Groupes d'élèves & salles

**Objectif** : organiser les élèves en groupes/sets et les assigner à des salles.

- **Backend** : `app/studentGroup/*` (8 use cases), `StudentGroupController`, `app/room/*` (3 use cases), `RoomController`
- **Schéma** : `StudentGroupSet`, `StudentGroup`, `StudentGroupMembership`, `Room`, `ClassRoomAssignment`
- **Interactions** : assignation/retrait salle (classe ou groupe), sets réutilisables (`CreerStudentGroupSetUseCase`)

## 36. Paiements MINESEC

**Objectif** : générer les paiements réglementaires MINESEC et leurs synthèses.

- **Backend** : `app/paiementMinesec/*` (4 use cases), `PaiementMinesecController`
- **Schéma** : `PaiementMinesec`, `PaiementEtablissement`, `TarifMinesecReference`
- **Flux** : génération par école (`GenererPaiementsMinesecPourEcoleUseCase`), vues école/élève (`GetSchoolPaymentOverviewUseCase`, `GetStudentPaymentDashboardUseCase`)

## 37. Push notifications

**Objectif** : abonnement aux notifications push (web) et désinscription.

- **Backend** : `app/pushNotification/*` (2 use cases), `PushNotificationController`
- **Schéma** : `PushSubscription`
- **Limite connue** : son personnalisé uniquement au moment de l'empaquetage Capacitor (voir §12 et ARCHITECTURE.md §8 ADR-10)
