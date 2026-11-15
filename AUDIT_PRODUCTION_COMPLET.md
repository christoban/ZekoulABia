# Audit Complet de Pré-Production — ZekoulABia

> **Objet** : Diagnostic technique approfondi du dépôt **ZekoulABia** (Backend, Frontend, ML-Service, Architecture Hexagonale, Couverture fonctionnelle Backend ↔ Frontend, Doublons, Typage, Qualité & Finition UX) en vue d'une mise en production commerciale.  
> **Portée** : Analyse statique exhaustive du code source réel (`backend/src/`, `frontend/src/`, `ml-service/`, `CODE_REVIEW_NOTES.md`), confrontée aux règles d'ingénierie du projet ([AGENTS.md](AGENTS.md)).  
> **Note** : Ce document est un rapport d'audit ; aucune modification de code applicatif n'a été appliquée lors de sa rédaction.

---

## Synthèse Exécutive

Le socle métier de ZekoulABia est riche et mature sur de nombreux moteurs, mais le dépôt présente une dette d'intégration et de structure importante qui expose le produit à des **régressions silencieuses**, des **erreurs 404 en production**, un **surcoût de maintenance élevé** et des **contournements d'architecture**.

| Axe d'analyse | Constat chiffré | Criticité |
|---|---|---|
| **Fonctionnalités Backend non branchées** | **~90+ endpoints backend** (sur **632** analysés) sans aucun appelant frontend ; **2 UseCases orphelins**, **2 UseCases non exposés** en HTTP ; modules complets sans UI | **Élevée (P1/P2)** |
| **Doublons de code & Fichiers redondants** | **8 paires** de sections Admin vs Staff dupliquées (~**10 000 lignes**), **23 composants Shell UI** dupliqués sur 6 portails, double système Annonces / Babillard | **Élevée (P1)** |
| **Contournements Architecture Hexagonale** | **88 routes inline** et **146 requêtes Prisma directes** dans `bootstrap/*.ts`, **42+ accès Prisma directs** dans 4 Controllers, **141 `ctx.prisma.*`** dans l'assistant IA | **Élevée (P1)** |
| **Plafond de taille (`> 500` lignes — §4.1)** | **90 fichiers hors plafond** (**23 Backend** dont 4 > 1 000 l., **67 Frontend** dont 13 > 1 000 l. et un fichier à 2 730 l.) | **Moyenne / Élevée** |
| **Dette de typage `any` (§4.12)** | **294 `any`** sur **78 fichiers Frontend** (aucun guard automatisé côté Frontend), **8 `any`** dans `generate_guides_pdf.ts`, **3 `// hex-allow-any`** Backend | **Élevée** |
| **UX & Finition Production** | **48 `confirm()` / `alert()` natifs** et fragilité d'isolation sur certains tests d'intégration | **Moyenne / Élevée** |

---

## Partie 1 — Fonctionnalités Backend existantes mais NON branchées (ou partiellement branchées) au Frontend

Sur **632 endpoints HTTP backend** et **366 UseCases** analysés, **~90+ endpoints backend légitimes** ne disposent d'aucun appel `fetchApi` depuis `frontend/src/`. Plusieurs fonctionnalités métier majeures sont ainsi déjà développées au backend mais invisibles ou incomplètes côté utilisateur.

### 1.1 UseCases orphelins ou non exposés en HTTP

| UseCase (`backend/src/application/...`) | État actuel | Action recommandée |
|---|---|---|
| `eleveOnboarding/ResoudreProfilAccesUseCase.ts` | **Orphelin (0 référence hors fichier)** — logique recalculée côté frontend | Aligner le frontend sur une API backend ou supprimer le doublon |
| `user/AutoriserConnexionUseCase.ts` | **Orphelin (0 référence hors fichier)** — non branché au flux de login | Brancher au contrôleur d'authentification ou supprimer si obsolète |
| `finance/VerifierStatutPaiementUseCase.ts` | Instancié dans `container.ts:1164`, **jamais exposé** dans `FinanceController` / `finance.routes.ts` | Exposer en route `GET`/`POST` pour le polling de confirmation Campay |
| `timetable/ResoudreParticipantsSeanceUseCase.ts` | Instancié dans `container.ts:522`, **jamais exposé** dans un controller HTTP | Exposer sur le module emploi du temps / appel séance ou nettoyer |

### 1.2 Modules complets codés au Backend sans interface Frontend (ou doublonnés)

| Module / Domaine | Routes Backend non consommées | Fichier Backend | Situation & Décision produit |
|---|---|---|---|
| **Examens Officiels** | `POST /api/v2/examens/register`<br>`GET /api/v2/examens/:studentId`<br>`PATCH /api/v2/examens/:id/set-candidate-number`<br>`PATCH /api/v2/examens/:id/result` | `examen.routes.ts:8-11` | **Aucune UI frontend**. Créer les écrans d'inscription, d'attribution de numéro de table et de saisie de résultats, ou reporter proprement après V1. |
| **Annonces (Legacy)** | `GET /api/v2/announcements`<br>`POST /api/v2/announcements`<br>`PATCH /api/v2/announcements/:id`<br>`DELETE /api/v2/announcements/:id` | `announcement.routes.ts:8-11`<br>(`registrations.ts:263`) | **Doublon complet avec `/api/v2/babillard`**. `AnnouncementController` + 4 UseCases (`Creer/Lister/Modifier/SupprimerAnnonceUseCase`) ne sont jamais appelés par le frontend. À **décommissionner** pour éviter deux sources d'annonces. |
| **MFA Groupe Scolaire** | `GET /api/v2/group/auth/mfa-status`<br>`POST /api/v2/group/auth/mfa/setup`<br>`POST /api/v2/group/auth/mfa/enable`<br>`POST /api/v2/group/auth/mfa/disable`<br>`POST /api/v2/group/auth/mfa/regen-codes` | `groupAuth.routes.ts:14-18` | Le backend TOTP 2FA est complet pour les dirigeants de groupe scolaire, mais `/group/dashboard` n'affiche aucune interface d'activation/gestion. |
| **Templates d'école (Versioning & Réapplication)** | `POST /api/v2/school-settings/reapply-template/propose`<br>`POST /api/v2/school-settings/reapply-template/apply`<br>`GET /api/v2/master/school-templates/:code/versions`<br>`POST /api/v2/master/school-templates/:code/versions`<br>`POST /api/v2/master/school-templates/:code/reapply/propose`<br>`POST /api/v2/master/school-templates/:code/reapply/apply` | `schoolSettings.routes.ts:9-10`<br>`schoolTemplateAdmin.routes.ts:8-11` | Le pattern `propose/apply` de mise à jour des templates d'établissement est entièrement prêt au backend mais n'est connecté ni dans les paramètres Admin ni dans le portail Master. |
| **Core Domain** | `GET /api/v2/core-domain/subsystems`<br>`POST /api/v2/core-domain/subsystems/upsert-defaults`<br>`POST /api/v2/core-domain/academic-periods`<br>`GET /api/v2/core-domain/academic-periods`<br>`PATCH /api/v2/core-domain/academic-periods/:id` | `coreDomain.routes.ts:8-12` | **0 appel frontend** (les écrans actuels passent par des endpoints alternatifs ou `bootstrap/`). À unifier ou déprécier. |

### 1.3 Endpoints métier non branchés dans les écrans existants

| Domaine | Endpoints Backend non appelés | Source Backend | Ce qui manque côté Frontend |
|---|---|---|---|
| **IA & Prévention décrochage** | `POST /api/v2/ai/bulletin-comment`<br>`POST /api/v2/ai/generate-insight`<br>`GET /api/v2/ai/risk-detection/:studentId`<br>`GET /api/v2/ai/compare-risk-predictions/:studentId`<br>`POST /api/v2/ai/chat` & `POST /api/v2/assistant/chat` | `ai.routes.ts:9-16`<br>`bootstrap/core.ts:266` | Bouton « Générer appréciation IA » absent dans `SectionBulletins` / `SectionAppreciationsPP` ; vue de détection de risque par élève non connectée ; `ai/chat` et `assistant/chat` sont des doublons de `/api/v2/assistant/execute`. |
| **Babillard** | `GET /api/v2/babillard/non-lus/compteur`<br>`GET /api/v2/babillard/:id/statistiques` | `babillard.routes.ts:21,33` | Aucun badge de compteur non-lus dans les Sidebars/BottomNavs ; statistiques détaillées d'une publication non appelées via cet endpoint. |
| **RH & Pointage Personnel** | `GET /api/v2/hr/leave-balance/:userId`<br>`GET /api/v2/hr/mission-orders/:id/pdf`<br>`GET /api/v2/staff-attendance/settings`<br>`PUT /api/v2/staff-attendance/settings` | `hr.routes.ts:20,24`<br>`staffAttendance.routes.ts:18-19` | Pas d'affichage du solde de congés, pas de téléchargement PDF de l'ordre de mission, et **aucune UI pour paramétrer les coordonnées GPS, le rayon autorisé et les horaires de pointage**. |
| **Groupes d'élèves** | `PUT /api/v2/student-groups/:id`<br>`DELETE /api/v2/student-groups/:id`<br>`POST /api/v2/student-groups/:groupSetId/groups`<br>`PUT /api/v2/student-groups/groups/:id`<br>`DELETE /api/v2/student-groups/groups/:id` | `studentGroup.routes.ts:9-14` | Impossible d'éditer ou supprimer un groupe/sous-groupe depuis l'interface existante. |
| **Indisponibilités Enseignants** | `GET /api/v2/teacher-unavailabilities`<br>`POST /api/v2/teacher-unavailabilities`<br>`PUT /api/v2/teacher-unavailabilities/:id`<br>`DELETE /api/v2/teacher-unavailabilities/:id` | `teacher-unavailability.routes.ts:8-11` | Routes CRUD dédiées non appelées (le frontend passe par des routes alternatives et ne permet pas l'édition `PUT`). |
| **Transferts Élèves (OTP Tuteur)** | `POST /api/v2/student-transfers/students/:studentProfileId/guardian`<br>`POST .../guardian/phone-otp`<br>`POST .../guardian/phone-verify` | `studentTransfer.routes.ts:25-27` | Flux de liaison et vérification OTP SMS du tuteur légal pour transfert inter-écoles non branché dans l'UI. |
| **Recherche & Conseils de classe** | `GET /api/v2/search/global`<br>`POST /api/v2/class-councils/:id/decisions`<br>`POST /api/v2/class-councils/:id/publish-bulletins` | `search.routes.ts:7`<br>`classCouncil.routes.ts:13,16` | Barre de recherche globale absente ; publication groupée des bulletins et décisions depuis le conseil de classe non connectées. |
| **Notes, EDT, Affectations & Électifs** | `GET /api/v2/grades/pending`<br>`PATCH /api/v2/grades/:id/lock`<br>`POST /api/v2/timetables/manual`<br>`POST /api/v2/timetables/generation-runs/:runId/cancel`<br>`POST /api/v2/timetables/:id/propose-schedule`<br>`GET /api/v2/timetable-slots/:id/students`<br>`GET /api/v2/subjects/:id/alevel-students`<br>`POST /api/v2/teaching-assignments/clear-all` | `grade.routes.ts:14,28`<br>`timetable.routes.ts:11,12,21`<br>`bootstrap/electifs.ts:258,379`<br>`teaching-assignment.routes.ts:17` | Verrouillage unitaire de note, file d'attente notes en suspens, annulation d'un run de génération EDT en cours, création manuelle d'EDT, liste élèves d'un créneau/A-Level et réinitialisation globale des affectations non branchés. |
| **Évaluations (Assessments)** | `POST /api/v2/assessments/scopes`<br>`POST /api/v2/assessments/participations`<br>`POST /api/v2/assessments/participations/batch` | `assessment.routes.ts:37,72,87` | Création de périmètres d'évaluation et saisie batch des participations non branchées. |
| **Statistiques, Pédagogie & Rapports** | `GET /api/v2/statistical-campaign/completude`<br>`GET /api/v2/statistical-campaign/specialites-techniques`<br>`GET /api/v2/pedagogie/rapports`<br>`GET /api/v2/rapports/effectifs`<br>`GET /api/v2/rapports/dossiers-incomplets`<br>`GET /api/v2/rapports/concours` | `statisticalCampaign.routes.ts:10-11`<br>`pedagogie.routes.ts:37`<br>`rapportsStaff.routes.ts:11-13` | Rapports consolidés (effectifs, dossiers incomplets, concours, complétude MINESEC) disponibles au backend mais non exploités sur ces endpoints côté Frontend. |
| **Matricules, PEBS, Finance, Suivi, Onboarding & Users** | `POST /api/v2/matricules/manual-match`, `/sync`, `/verify-recu/:id`<br>`GET /api/v2/paiements-minesec/payment-alerts`<br>`POST /api/v2/parent/payments/mobile`<br>`POST /api/v2/pebs-exams/:id/candidates` & `/import`<br>`PATCH /api/v2/student-follow-up/:actionId/reassign`<br>`POST /api/v2/academic-years/:id/cancel-proposed-structure`<br>`POST /api/v2/eleve-onboarding/:id/validate` & `/resend-link`<br>`PATCH /api/v2/users/:id/ap-designation` | `matricule.routes.ts:24,34,37`<br>`paiementMinesec.routes.ts:13`<br>`parent.routes.ts:11`<br>`pebsExam.routes.ts:22-23`<br>`studentFollowUp.routes.ts:17`<br>`academicYear.routes.ts:19`<br>`eleveOnboarding.routes.ts:32,34`<br>`user.routes.ts:107` | Paiement mobile direct parent, alertes paiement MINESEC, rapprochement manuel/vérification reçu matricule, import candidats PEBS, réassignation d'action de suivi, annulation structure d'année proposée, validation/renvoi lien onboarding élève et désignation AP. |

### 1.4 Placeholders résiduels côté Frontend
- **Dashboard Enseignant** (`frontend/src/app/teacher/dashboard/page.tsx:63-65`) : `PLACEHOLDERS = { bulletins: { icon: FileText } }` rend encore `SectionTeacherPlaceholder.tsx` (35 lignes) pour l'onglet `bulletins`.
- **Dashboard Admin** (`frontend/src/app/admin/dashboard/_components/SectionPlaceholder.tsx`, 37 lignes) : fichier mort résiduel alors que `PLACEHOLDERS` est désormais vide dans `frontend/src/app/admin/dashboard/page.tsx:69`.

---

## Partie 2 — Code Doublé & Fichiers Redondants à Unifier (DRY)

### 2.1 8 paires de sections Admin vs Staff dupliquées (~10 000 lignes cumulées)

Contrairement aux modules récents bien centralisés dans `frontend/src/features/` (`babillard`, `messagerie`, `carnet-liaison`, `discipline`, `orientation`, `pointage`), **8 domaines entiers** sont dupliqués entre `admin/dashboard/_components/` et `staff/dashboard/_components/` :

| Domaine | Version Admin | Version Staff | Total lignes | Risque constaté |
|---|---|---|---|---|
| **Classes** | `SectionClasses.tsx` (1 494 l.) | `SectionClassesStaff.tsx` (527 l.) | 2 021 l. | Divergence de comportement et d'UI |
| **Emploi du temps** | `SectionTimetable.tsx` (565 l.) | `SectionTimetableStaff.tsx` (1 038 l.) | 1 603 l. | Évolutions appliquées sur un seul portail |
| **Finance / Scolarité** | `SectionFinance.tsx` (863 l.) | `SectionFinanceStaff.tsx` (769 l.) | 1 632 l. | A provoqué l'incident 404 `/remind-sms` (corrigé en Lot 1) ; risque persistant sur toute évolution |
| **Conseils de classe** | `SectionAdminCouncil.tsx` (402 l.) | `SectionCouncil.tsx` (519 l.) | 921 l. | Double maintenance des calculs/statuts |
| **Affectations** | `admin/_components/SectionAffectations.tsx` (385 l.) | `staff/_components/SectionAffectations.tsx` (560 l.) | 945 l. | Double logique de grille d'affectation |
| **Grille horaire** | `admin/_components/SectionGrilleHoraire.tsx` (348 l.) | `staff/_components/SectionGrilleHoraire.tsx` (376 l.) | 724 l. | Quasi copier-coller ligne pour ligne |
| **Assiduité / Appel** | `SectionAdminAttendance.tsx` (339 l.) | `SectionAttendanceStaff.tsx` (359 l.) | 698 l. | Double logique de filtrage/export |
| **Concours d'entrée** | `SectionAdminEntranceExams.tsx` (417 l.) | `SectionConcoursStaff.tsx` (516 l.) | 933 l. | Double interface d'admission |

- **Recommandation** : Migrer ces 8 domaines vers `frontend/src/features/<domaine>/` avec un composant unique paramétré par permissions (`canEdit`, `canValidate`, `role`), sur le modèle déjà appliqué pour `babillard` et `carnet-liaison`.

### 2.2 23 composants de coque (Shell UI) dupliqués sur les 6 portails

Chaque portail (`admin`, `staff`, `teacher`, `parent`, `student`, `master`) réimplémente sa propre coque UI au lieu de consommer un shell partagé :

- **6 composants `*Toast.tsx`** (`AdminToast.tsx` 37 l., `StaffToast.tsx` 59 l., `TeacherToast.tsx` 37 l., `ParentToast.tsx` 37 l., `StudentToast.tsx` 37 l., `MasterToast.tsx` 45 l.) — 5 d'entre eux sont quasi identiques caractère pour caractère.
- **6 composants `*BottomNav.tsx`** (`AdminBottomNav.tsx` 129 l., `StaffBottomNav.tsx` 198 l., `TeacherBottomNav.tsx` 134 l., `ParentBottomNav.tsx` 128 l., `StudentBottomNav.tsx` 133 l., `MasterBottomNav.tsx` 121 l. — **843 lignes cumulées**).
- **6 composants `*Topbar.tsx`** (`AdminTopbar.tsx` 280 l., `StaffTopbar.tsx` 321 l., `TeacherTopbar.tsx` 267 l., `ParentTopbar.tsx` 265 l., `StudentTopbar.tsx` 280 l., `MasterTopbar.tsx` 707 l. — **2 120 lignes cumulées**).
- **5 composants `*Sidebar.tsx`** (`AdminSidebar.tsx` 504 l., `StaffSidebar.tsx` 468 l., `TeacherSidebar.tsx` 341 l., `ParentSidebar.tsx` 271 l., `StudentSidebar.tsx` 280 l. — **1 864 lignes cumulées**).
- **Recommandation** : Créer dans `frontend/src/components/shell/` un jeu unique `<DashboardShell />`, `<AppTopbar />`, `<AppSidebar />`, `<AppBottomNav />` et `<AppToast />` alimenté par une configuration déclarative par rôle (éliminant ~4 000 lignes redondantes et garantissant l'uniformité responsive/dark mode/accessibilité).

### 2.3 Doublons identifiés côté Backend
1. **Annonces (`/api/v2/announcements`) vs Babillard (`/api/v2/babillard`)** : deux modules complets pour diffuser des communications d'établissement.
2. **Routes de chat IA redondantes** : `POST /api/v2/ai/chat` (`ai.routes.ts:14`) et `POST /api/v2/assistant/chat` (`bootstrap/core.ts:266`) coexistent avec `POST /api/v2/assistant/execute`.

---

## Partie 3 — Violations de l'Architecture Hexagonale (`AGENTS.md §4.3.1`)

Bien que le domaine (`domain/`) et l'application (`application/`) soient protégés par `backend/tests/unit/architectureGuard.test.ts`, plusieurs contournements majeurs persistent dans la couche `infrastructure/`.

### 3.1 88 routes Express inline & 146 appels Prisma directs dans `backend/src/infrastructure/config/bootstrap/*.ts`

Les fichiers de câblage HTTP du dossier `bootstrap/` contiennent directement des handlers Express complets (`app.get/post/put/patch/delete`) et de la logique métier/Prisma (`p.<model>.*`), court-circuitant la séparation **Route → Controller → UseCase → Port → Repository**.

| Fichier (`backend/src/infrastructure/config/bootstrap/`) | Taille | Routes HTTP inline | Appels Prisma directs (`p.*`) | Exemples de routes concernées |
|---|---|---|---|---|
| `lists.ts` | 1 112 l. | **18** | **42** | `/api/v2/students`, `/api/v2/teachers`, `/api/v2/staff`, `/api/v2/classes`, `/api/v2/subjects`, `/api/v2/rooms`, etc. |
| `school.ts` | 669 l. | **18** | **37** | Paramétrage établissement et structures scolaires |
| `modules.ts` | 521 l. | **15** | **32** | Gestion des modules activés et droits |
| `electifs.ts` | 500 l. | **14** | **17** | Créneaux électifs, A-Level et élèves par créneau |
| `grade.ts` | 241 l. | **4** | **14** | Routes transverses de notation |
| `academic.ts` | 340 l. | **9** | — | Routes académiques |
| `authOnboarding.ts` | 321 l. | **5** | **2** | Endpoints d'auth et onboarding |
| `core.ts` | 297 l. | **5** | **2** | Health/assistant/core endpoints |
| **Total** | **4 001 l.** | **88 routes** | **146 requêtes** | — |

### 3.2 Accès Prisma directs dans 4 Controllers HTTP (angle mort du guard)

Règle `AGENTS.md §4.3.1` : *« Un controller HTTP ne contient pas de logique métier, de requête Prisma ou d'appel SDK »*. Or 4 controllers contournent actuellement cette règle en important le singleton `{ prisma }` depuis `prisma.client` (ce que `architectureGuard.test.ts` ne bloque pas encore) :

1. **`MasterReferentielsController.ts`** (735 lignes) : **35 appels `prisma.*` directs** via `import { prisma } from '../../database/prisma.client'`.
2. **`NotificationController.ts`** : **5 appels `prisma.notification.*` directs**.
3. **`TimetableController.ts:528`** : appel direct à `prisma.school.findUnique`.
4. **`grade/GradeExcelController.ts:37-38`** : import dynamique `await import('../../../database/prisma.client')` + `prisma.studentProfile.findMany` directement dans le controller.

- **Action** : Extraire ces requêtes vers des Ports/Repositories et des UseCases dédiés, puis renforcer `backend/tests/unit/architectureGuard.test.ts` pour interdire tout import statique ou dynamique de `prisma.client` et `@prisma/client` dans `infrastructure/http/controllers/`.

### 3.3 141 appels `ctx.prisma.*` directs dans le catalogue Copilot IA

Dans `backend/src/infrastructure/assistant/catalog/`, **13 fichiers** exécutent au total **141 requêtes `ctx.prisma.*` directes** (dont `adminAcademicGradeActions.ts` : **33**, `staffActionCatalog.ts` : **18**, `teacherActionCatalog.ts` : **15**, `adminClassSubjectActions.ts` : **12**).
- **Risque** : Duplication des règles métier, risque d'écart sur l'isolation multi-tenant, l'audit trail ou le RBAC par rapport aux UseCases applicatifs.
- **Recommandation** : Faire déléguer les actions Copilot IA vers les UseCases existants du `container` plutôt que de réécrire des requêtes Prisma brutes.

---

## Partie 4 — Plafond de taille de fichiers (`AGENTS.md §4.1`) : 90 fichiers hors plafond

`AGENTS.md §4.1` fixe une cible confortable à **150–250 lignes**, un signal d'alerte à **300–400 lignes** et un **plafond dur à 500 lignes (split obligatoire)**. **90 fichiers** du projet dépassent ce plafond dur.

### 4.1 Les 23 fichiers Backend > 500 lignes

| # | Fichier Backend | Lignes | Axe de découpage recommandé |
|---|---|---:|---|
| 1 | `backend/src/infrastructure/services/statisticalCampaign/minesecEsgFieldMap.ts` | 1 630 | Scinder les tables de mapping par section/tableau officiel |
| 2 | `backend/src/infrastructure/config/container.ts` | 1 452 | Modulariser le wiring DI par bounded context (`containers/*.ts`) |
| 3 | `backend/src/infrastructure/database/PrismaMessagerieRepository.ts` | 1 118 | Séparer conversations, messages, pièces jointes et notifications |
| 4 | `backend/src/infrastructure/config/bootstrap/lists.ts` | 1 112 | Extraire les 18 routes inline en Controllers + UseCases par entité |
| 5 | `backend/src/infrastructure/assistant/catalog/adminAcademicGradeActions.ts` | 797 | Scinder par sous-domaine (notes, évaluations, bulletins, années) |
| 6 | `backend/src/infrastructure/http/controllers/MasterReferentielsController.ts` | 735 | Déplacer les 35 requêtes Prisma vers UseCases/Repo + splitter |
| 7 | `backend/src/infrastructure/services/notifications/SmsNotificationService.ts` | 723 | Séparer formatage/templates SMS, quotas et adaptateurs fournisseurs |
| 8 | `backend/src/infrastructure/config/bootstrap/school.ts` | 669 | Extraire les 18 routes inline vers `SchoolSettingsController` / UseCases |
| 9 | `backend/src/infrastructure/http/controllers/TimetableController.ts` | 616 | Scinder génération, édition manuelle et consultation/export |
| 10 | `backend/src/infrastructure/database/PrismaEleveOnboardingRepository.ts` | 608 | Séparer requêtes dossiers, validations et liens d'accès |
| 11 | `backend/src/infrastructure/http/controllers/HRController.ts` | 602 | Scinder contrats/dossiers, congés, paie et ordres de mission |
| 12 | `backend/src/infrastructure/http/controllers/AIController.ts` | 589 | Séparer endpoints prédiction risque, commentaires et chat |
| 13 | `backend/src/infrastructure/http/controllers/AssistantController.ts` | 575 | Extraire le formatage et la résolution de contexte hors controller |
| 14 | `backend/src/infrastructure/adapters/scheduling/ORToolsWasmAdapter.ts` | 573 | Séparer construction du modèle de contraintes et décodage de solution |
| 15 | `backend/src/infrastructure/services/pdf/SchoolDocumentPdfRenderer.ts` | 566 | Un renderer par type de document (certificat, reçu, ordre, fiche) |
| 16 | `backend/src/infrastructure/database/PrismaOrientationRepository.ts` | 562 | Séparer vœux, campagnes, dossiers et résultats d'orientation |
| 17 | `backend/src/infrastructure/http/controllers/OrientationController.ts` | 545 | Scinder actions Admin/Conseil vs actions Élève/Parent |
| 18 | `backend/src/infrastructure/database/PrismaBulletinRepository.ts` | 541 | Séparer agrégation des notes, moyennes et édition/verrouillage |
| 19 | `backend/src/domain/scheduling/contraintesDouces.ts` | 531 | Grouper les fonctions de score par famille de contraintes |
| 20 | `backend/src/infrastructure/http/controllers/MasterAdminHexController.ts` | 526 | Scinder gestion écoles/tenants, équipe master et audit |
| 21 | `backend/src/infrastructure/http/controllers/EntranceExamController.ts` | 525 | Scinder gestion concours, candidats et délibérations |
| 22 | `backend/src/infrastructure/config/bootstrap/modules.ts` | 521 | Extraire les 15 routes inline vers un `ModuleController` dédié |
| 23 | `backend/src/infrastructure/services/import/importRowValidator.ts` | 504 | Séparer les validateurs par type d'import (élèves, staff, notes) |

### 4.2 Top des 67 fichiers Frontend > 500 lignes

**67 fichiers Frontend** dépassent 500 lignes, dont **13 dépassent 1 000 lignes** :

| Rang | Fichier Frontend | Lignes | Problème structurel |
|---|---|---:|---|
| 1 | `frontend/src/app/onboarding/[token]/page.tsx` | 2 730 | Monolithe multi-étapes dans une seule page route |
| 2 | `frontend/src/app/admin/dashboard/_components/SectionUsers.tsx` | 1 915 | Création, édition, import, rôles et filtres dans un seul composant |
| 3 | `frontend/src/app/admin/dashboard/_components/SectionSubjects.tsx` | 1 870 | Catalogue, coefficients, groupes et modales confondus |
| 4 | `frontend/src/app/admin/dashboard/_components/SectionOrientation.tsx` | 1 741 | Plusieurs sous-vues/modales dans le même fichier |
| 5 | `frontend/src/app/admin/dashboard/_components/SectionSettings.tsx` | 1 696 | Paramètres généraux, sécurité, templates et MFA mélangés |
| 6 | `frontend/src/app/admin/dashboard/_components/SectionClasses.tsx` | 1 494 | De plus dupliqué avec `SectionClassesStaff.tsx` (527 l.) |
| 7 | `frontend/src/app/login/page.tsx` | 1 393 | Multi-flows login, MFA, récupération mot de passe, redirections |
| 8 | `frontend/src/app/parent/dashboard/_components/SectionParentPayments.tsx` | 1 338 | Échéancier, reçus, mobile money et historique dans un composant |
| 9 | `frontend/src/app/onboarding/_components/ConversationalOnboarding.tsx` | 1 280 | Étapes conversationnelles et état formulaire non découpés |
| 10 | `frontend/src/app/master/dashboard/_components/SectionReferentielsHub.tsx` | 1 169 | Plusieurs référentiels nationaux dans un seul onglet |
| 11 | `frontend/src/components/landing/LandingPage.tsx` | 1 155 | Toutes les sections marketing/tarifs/FAQ dans un seul fichier |
| 12 | `frontend/src/app/admin/dashboard/_components/SectionLogs.tsx` | 1 047 | Tableau, filtres avancés, export et tiroir de détail |
| 13 | `frontend/src/app/staff/dashboard/_components/SectionTimetableStaff.tsx` | 1 038 | Également dupliqué avec `SectionTimetable.tsx` (565 l.) |

*(54 autres fichiers Frontend compris entre 501 et 998 lignes — ex. `SectionTeam.tsx` 998 l., `FilConversation.tsx` 973 l., `SectionFinance.tsx` 863 l., `SectionFinanceStaff.tsx` 769 l., `MasterTopbar.tsx` 707 l., `AdminSidebar.tsx` 504 l. — nécessitent également une extraction en sous-composants/hooks).*

---

## Partie 5 — Dette de Typage `any` (`AGENTS.md §4.12`)

### 5.1 Backend
- `backend/src/infrastructure/assistant/catalog/catalogShared.ts` : **3 occurrences** tolérées via `// hex-allow-any` (L23-24, L29). À remplacer à terme par des types génériques/structurels (`unknown` avec narrowing ou schémas Zod).
- `backend/src/scripts/generate_guides_pdf.ts` : **8 occurrences de `any`** non couvertes par le guard principal. À typer proprement.

### 5.2 Frontend : 294 occurrences de `any` réparties sur 78 fichiers
Aucun garde-fou automatisé équivalent à `backend/tests/unit/architectureGuard.test.ts` n'existe dans `frontend/`, ce qui a laissé la dette s'accumuler :

| Fichier Frontend (`frontend/src/...`) | Occurrences `any` |
|---|---:|
| `app/teacher/dashboard/_components/SectionTeacherGrades.tsx` | **39** |
| `app/admin/dashboard/_components/SectionSettings.tsx` | **16** |
| `app/admin/dashboard/_components/SectionSubjects.tsx` | **13** |
| `app/teacher/dashboard/_components/SectionTeacherTimetable.tsx` | **12** |
| `app/student/dashboard/_components/SectionStudentGrades.tsx` | **9** |
| `app/master/login/page.tsx` | **7** |
| `app/student/dashboard/_components/SectionStudentDashboard.tsx` | **7** |
| `app/teacher/dashboard/_components/SectionTeacherClasses.tsx` | **7** |
| `app/teacher/dashboard/page.tsx` | **7** |
| *69 autres fichiers Frontend* | **177** |
| **Total Frontend** | **294** |

- **Recommandation** : Ajouter un test bloquant `frontend/src/__tests__/architectureGuard.test.ts` interdisant l'introduction de nouveaux `any` (en partant d'un plafond dégressif ou après purge des 78 fichiers).

---

## Partie 6 — Expérience Utilisateur (UX), Sécurité & Finition Production

### 6.1 48 appels natifs `window.confirm()` / `confirm()` / `alert()` côté Frontend
Des composants clés utilisent encore les boîtes de dialogue natives du navigateur (notamment `alert(msg)` dans `SectionFinance.tsx:181,187`, et `confirm(...)` dans `SectionSubjects.tsx`, `SectionAffectations.tsx`, `SectionReferentielsHub.tsx`, `SectionUsers.tsx`, `SectionAcademicYear.tsx`, `MasterTopbar.tsx`, etc.).
- **Impact** : Bloquent le thread JS, impossibles à styler (cassent l'identité visuelle, le mode sombre et les traductions i18n des boutons « OK/Annuler »), et dégradent l'expérience sur mobile Android / PWA.
- **Action** : Introduire un composant `<ConfirmDialog />` partagé (et utiliser le `<AppToast />` unifié à la place de `alert()`).

### 6.2 Dettes de tests relevées dans `CODE_REVIEW_NOTES.md`
- **Tests d'intégration fragiles** (`backend/tests/integration/studentRisk.routes.test.ts`, `communicationsBroadcast.integration.test.ts:39`) : utilisation de `mock.module(...)` global sous Bun, susceptible de polluer les fichiers de test exécutés dans le même processus.

---

## Partie 7 — Feuille de route d'assainissement priorisée (Plan d'action)

| Lot | Horizon indicatif | Chantiers inclus | Critère de succès |
|---|---|---|---|
| **Lot 2 — Branchement Fonctionnalités Backend** | 3 à 5 jours | 1. Exposer et brancher `VerifierStatutPaiementUseCase` (Campay)<br>2. Brancher `GET /api/v2/babillard/non-lus/compteur` dans les Sidebars/BottomNavs<br>3. Brancher PDF ordre de mission RH (`hr/mission-orders/:id/pdf`), solde congés (`leave-balance`) et paramétrage GPS pointage (`staff-attendance/settings`)<br>4. Brancher `POST /api/v2/ai/bulletin-comment` dans les appréciations<br>5. Brancher le MFA Groupe Scolaire (`/api/v2/group/auth/mfa*`)<br>6. Trancher produit : brancher ou archiver Examens Officiels (`/api/v2/examens`), et décommissionner `/api/v2/announcements` (remplacé par Babillard) + onglet `bulletins` placeholder enseignant | Parcours critiques complets de bout en bout, zéro doublon Annonces/Babillard |
| **Lot 3 — Unification Frontend & Finition UX** | 5 à 8 jours | 1. Factoriser les **23 composants Shell** (`Toast`, `Topbar`, `Sidebar`, `BottomNav`) dans `frontend/src/components/shell/`<br>2. Fusionner les **8 paires Admin/Staff** dans `frontend/src/features/`<br>3. Remplacer les **48 `confirm()`/`alert()`** par `<ConfirmDialog />` + `<AppToast />`<br>4. Éliminer les **294 `any` frontend** + instaurer un `architectureGuard.test.ts` côté frontend | Zéro `any` frontend, zéro `alert()`/`confirm()` natif, -50 % de code dupliqué UI |
| **Lot 4 — Purge Hexagonale & Découpage > 500 l.** | 5 à 10 jours | 1. Migrer les **88 routes inline** et **146 requêtes Prisma** de `bootstrap/*.ts` vers Controllers + UseCases + Repositories<br>2. Extraire les **35 appels Prisma** de `MasterReferentielsController.ts` (et `NotificationController`, `TimetableController`, `GradeExcelController`) et durcir `architectureGuard.test.ts` contre `prisma.client`<br>3. Faire passer les **141 actions Copilot IA** par les UseCases applicatifs<br>4. Découper progressivement les **90 fichiers > 500 lignes** (en priorité `container.ts`, `onboarding/[token]/page.tsx`, `SectionUsers.tsx`, `SectionSubjects.tsx`, `SectionSettings.tsx`) | `architectureGuard.test.ts` étendu à toute la couche HTTP/Copilot, aucun fichier applicatif > 500 lignes |

