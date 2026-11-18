# Audit Complet de Pré-Production — ZekoulABia

> **Objet** : Diagnostic technique approfondi du dépôt **ZekoulABia** (Backend, Frontend, ML-Service, Architecture Hexagonale, Couverture fonctionnelle Backend ↔ Frontend, Doublons, Typage, Qualité & Finition UX) en vue d'une mise en production commerciale.  
> **Portée** : Analyse statique exhaustive du code source réel (`backend/src/`, `frontend/src/`, `ml-service/`, `CODE_REVIEW_NOTES.md`), confrontée aux règles d'ingénierie du projet ([AGENTS.md](AGENTS.md)).  
> **Note** : Ce document est un rapport d'audit ; aucune modification de code applicatif n'a été appliquée lors de sa rédaction.

---

## Synthèse Exécutive

Le socle métier de ZekoulABia est riche et mature sur de nombreux moteurs, mais le dépôt présente une dette d'intégration et de structure importante qui expose le produit à des **régressions silencieuses**, des **erreurs 404 en production**, un **surcoût de maintenance élevé** et des **contournements d'architecture**.

| Axe d'analyse | Constat chiffré | Criticité |
|---|---|---|
| **Fonctionnalités Backend non branchées** | **~80+ endpoints backend** (sur **632** analysés) sans aucun appelant frontend ; **2 UseCases orphelins**, **1 UseCase non exposé** en HTTP ; modules complets sans UI | **Élevée (P1/P2)** |
| **Doublons identifiés côté Backend** | Routes de chat IA redondantes (`POST /api/v2/ai/chat`, `POST /api/v2/assistant/chat`) face à `POST /api/v2/assistant/execute` | **Moyenne (P2)** |
| **Contournements Architecture Hexagonale** | **Purge Lot 4 terminée** : 0 route inline ni appel `p.*` dans `bootstrap/*.ts` ; 0 accès Prisma direct dans les Controllers HTTP ; 141 accès `ctx.prisma.*` du catalogue Copilot encapsulés derrière `CopilotDataGateway` (`PrismaCopilotDataGateway`) ; `architectureGuard.test.ts` durci sans exception | **Résolu (Lot 4)** |
| **Plafond de taille (`> 500` lignes — §4.1)** | **Purge Lot 4 terminée** : **0 fichier `> 500` lignes** sur `backend/src/` et `frontend/src/` (`LEGACY_OVERSIZED_MAX_LINES = {}` et garde-fou backend `<= 500` lignes actifs) | **Résolu (Lot 4)** |
| **Dette de typage `any` (§4.12)** | **0 occurrence** de `// hex-allow-any` et **0 `any`** applicatif dans `backend/src/` (hors déclarations ambiantes `src/types/*.d.ts`) et `frontend/src/` | **Résolu (Lot 4)** |
| **Dettes de tests (intégration)** | **0 appel `mock.module`** subsistant dans `backend/tests/` (`SmsService` migré vers lecture dynamique d'environnement) | **Résolu (Lot 4)** |

---

## Partie 1 — Fonctionnalités Backend existantes mais NON branchées (ou partiellement branchées) au Frontend

Sur **632 endpoints HTTP backend** et **366 UseCases** analysés, **~90+ endpoints backend légitimes** ne disposent d'aucun appel `fetchApi` depuis `frontend/src/`. Plusieurs fonctionnalités métier majeures sont ainsi déjà développées au backend mais invisibles ou incomplètes côté utilisateur.

### 1.1 UseCases orphelins ou non exposés en HTTP

| UseCase (`backend/src/application/...`) | État actuel | Action recommandée |
|---|---|---|
| `eleveOnboarding/ResoudreProfilAccesUseCase.ts` | **Orphelin (0 référence hors fichier)** — logique recalculée côté frontend | Aligner le frontend sur une API backend ou supprimer le doublon |
| `user/AutoriserConnexionUseCase.ts` | **Orphelin (0 référence hors fichier)** — non branché au flux de login | Brancher au contrôleur d'authentification ou supprimer si obsolète |
| `timetable/ResoudreParticipantsSeanceUseCase.ts` | Instancié dans `container.ts:522`, **jamais exposé** dans un controller HTTP | Exposer sur le module emploi du temps / appel séance ou nettoyer |

### 1.2 Modules complets codés au Backend sans interface Frontend (ou doublonnés)

| Module / Domaine | Routes Backend non consommées | Fichier Backend | Situation & Décision produit |
|---|---|---|---|
| **Templates d'école (Versioning & Réapplication)** | `POST /api/v2/school-settings/reapply-template/propose`<br>`POST /api/v2/school-settings/reapply-template/apply`<br>`GET /api/v2/master/school-templates/:code/versions`<br>`POST /api/v2/master/school-templates/:code/versions`<br>`POST /api/v2/master/school-templates/:code/reapply/propose`<br>`POST /api/v2/master/school-templates/:code/reapply/apply` | `schoolSettings.routes.ts:9-10`<br>`schoolTemplateAdmin.routes.ts:8-11` | Le pattern `propose/apply` de mise à jour des templates d'établissement est entièrement prêt au backend mais n'est connecté ni dans les paramètres Admin ni dans le portail Master. |
| **Core Domain** | `GET /api/v2/core-domain/subsystems`<br>`POST /api/v2/core-domain/subsystems/upsert-defaults`<br>`POST /api/v2/core-domain/academic-periods`<br>`GET /api/v2/core-domain/academic-periods`<br>`PATCH /api/v2/core-domain/academic-periods/:id` | `coreDomain.routes.ts:8-12` | **0 appel frontend** (les écrans actuels passent par des endpoints alternatifs ou `bootstrap/`). À unifier ou déprécier. |

### 1.3 Endpoints métier non branchés dans les écrans existants

| Domaine | Endpoints Backend non appelés | Source Backend | Ce qui manque côté Frontend |
|---|---|---|---|
| **IA & Prévention décrochage** | `POST /api/v2/ai/generate-insight`<br>`GET /api/v2/ai/risk-detection/:studentId`<br>`GET /api/v2/ai/compare-risk-predictions/:studentId`<br>`POST /api/v2/ai/chat` & `POST /api/v2/assistant/chat` | `ai.routes.ts:9-16`<br>`bootstrap/core.ts:266` | Vue de détection de risque par élève non connectée ; `ai/chat` et `assistant/chat` sont des doublons de `/api/v2/assistant/execute`. |
| **Babillard** | `GET /api/v2/babillard/:id/statistiques` | `babillard.routes.ts:33` | Statistiques détaillées d'une publication non appelées via cet endpoint. |
| **Groupes d'élèves** | `PUT /api/v2/student-groups/:id`<br>`DELETE /api/v2/student-groups/:id`<br>`POST /api/v2/student-groups/:groupSetId/groups`<br>`PUT /api/v2/student-groups/groups/:id`<br>`DELETE /api/v2/student-groups/groups/:id` | `studentGroup.routes.ts:9-14` | Impossible d'éditer ou supprimer un groupe/sous-groupe depuis l'interface existante. |
| **Indisponibilités Enseignants** | `GET /api/v2/teacher-unavailabilities`<br>`POST /api/v2/teacher-unavailabilities`<br>`PUT /api/v2/teacher-unavailabilities/:id`<br>`DELETE /api/v2/teacher-unavailabilities/:id` | `teacher-unavailability.routes.ts:8-11` | Routes CRUD dédiées non appelées (le frontend passe par des routes alternatives et ne permet pas l'édition `PUT`). |
| **Transferts Élèves (OTP Tuteur)** | `POST /api/v2/student-transfers/students/:studentProfileId/guardian`<br>`POST .../guardian/phone-otp`<br>`POST .../guardian/phone-verify` | `studentTransfer.routes.ts:25-27` | Flux de liaison et vérification OTP SMS du tuteur légal pour transfert inter-écoles non branché dans l'UI. |
| **Recherche & Conseils de classe** | `GET /api/v2/search/global`<br>`POST /api/v2/class-councils/:id/decisions`<br>`POST /api/v2/class-councils/:id/publish-bulletins` | `search.routes.ts:7`<br>`classCouncil.routes.ts:13,16` | Barre de recherche globale absente ; publication groupée des bulletins et décisions depuis le conseil de classe non connectées. |
| **Notes, EDT, Affectations & Électifs** | `GET /api/v2/grades/pending`<br>`PATCH /api/v2/grades/:id/lock`<br>`POST /api/v2/timetables/manual`<br>`POST /api/v2/timetables/generation-runs/:runId/cancel`<br>`POST /api/v2/timetables/:id/propose-schedule`<br>`GET /api/v2/timetable-slots/:id/students`<br>`GET /api/v2/subjects/:id/alevel-students`<br>`POST /api/v2/teaching-assignments/clear-all` | `grade.routes.ts:14,28`<br>`timetable.routes.ts:11,12,21`<br>`bootstrap/electifs.ts:258,379`<br>`teaching-assignment.routes.ts:17` | Verrouillage unitaire de note, file d'attente notes en suspens, annulation d'un run de génération EDT en cours, création manuelle d'EDT, liste élèves d'un créneau/A-Level et réinitialisation globale des affectations non branchés. |
| **Évaluations (Assessments)** | `POST /api/v2/assessments/scopes`<br>`POST /api/v2/assessments/participations`<br>`POST /api/v2/assessments/participations/batch` | `assessment.routes.ts:37,72,87` | Création de périmètres d'évaluation et saisie batch des participations non branchées. |
| **Statistiques, Pédagogie & Rapports** | `GET /api/v2/statistical-campaign/completude`<br>`GET /api/v2/statistical-campaign/specialites-techniques`<br>`GET /api/v2/pedagogie/rapports`<br>`GET /api/v2/rapports/effectifs`<br>`GET /api/v2/rapports/dossiers-incomplets`<br>`GET /api/v2/rapports/concours` | `statisticalCampaign.routes.ts:10-11`<br>`pedagogie.routes.ts:37`<br>`rapportsStaff.routes.ts:11-13` | Rapports consolidés (effectifs, dossiers incomplets, concours, complétude MINESEC) disponibles au backend mais non exploités sur ces endpoints côté Frontend. |
| **Matricules, PEBS, Finance, Suivi, Onboarding & Users** | `POST /api/v2/matricules/manual-match`, `/sync`, `/verify-recu/:id`<br>`GET /api/v2/paiements-minesec/payment-alerts`<br>`POST /api/v2/parent/payments/mobile`<br>`POST /api/v2/pebs-exams/:id/candidates` & `/import`<br>`PATCH /api/v2/student-follow-up/:actionId/reassign`<br>`POST /api/v2/academic-years/:id/cancel-proposed-structure`<br>`POST /api/v2/eleve-onboarding/:id/validate` & `/resend-link`<br>`PATCH /api/v2/users/:id/ap-designation` | `matricule.routes.ts:24,34,37`<br>`paiementMinesec.routes.ts:13`<br>`parent.routes.ts:11`<br>`pebsExam.routes.ts:22-23`<br>`studentFollowUp.routes.ts:17`<br>`academicYear.routes.ts:19`<br>`eleveOnboarding.routes.ts:32,34`<br>`user.routes.ts:107` | Paiement mobile direct parent, alertes paiement MINESEC, rapprochement manuel/vérification reçu matricule, import candidats PEBS, réassignation d'action de suivi, annulation structure d'année proposée, validation/renvoi lien onboarding élève et désignation AP. |

---

## Partie 2 — Code Doublé & Fichiers Redondants à Unifier (DRY)

### 2.1 Doublons identifiés côté Backend
1. **Routes de chat IA redondantes** : `POST /api/v2/ai/chat` (`ai.routes.ts:14`) et `POST /api/v2/assistant/chat` (`bootstrap/core.ts:266`) coexistent avec `POST /api/v2/assistant/execute`.

---

## Partie 3 — Architecture Hexagonale (`AGENTS.md §4.3.1`) — Résolu en Lot 4

Toutes les violations identifiées lors de l'audit dans `infrastructure/` ont été corrigées et verrouillées par `backend/tests/unit/architectureGuard.test.ts` :

- **3.1 `bootstrap/*.ts`** : routes inline et requêtes Prisma directes (`p.<model>`, `p.$transaction`) extraites vers des contrôleurs, routeurs `routes/*.routes.ts`, adaptateurs et repositories (`academic.ts`, `authOnboarding.ts`, `core.ts`, `electifs.ts`, `grade.ts`, `lists.ts`, `modules.ts`, `registrations.ts`, `school.ts`). Le garde-fou interdit désormais toute route inline `app.(get|post|put|patch|delete)` et tout appel `p.*` dans `bootstrap/`.
- **3.2 Controllers HTTP** : `MasterReferentielsController.ts`, `NotificationController.ts`, `TimetableController.ts`, `AcademicYearController.ts`, `ParentController.ts`, `SubjectController.ts`, `GradeExcelController.ts` et `AssistantController.ts` sont exempts de `prisma.client` / `@prisma/client` (exception `AssistantController` supprimée dans `architectureGuard.test.ts`).
- **3.3 Catalogue Copilot IA** : les 141 accès `ctx.prisma.*` répartis sur 13 fichiers passent désormais par `ActionContext.data` (`CopilotDataGateway` / `PrismaCopilotDataGateway` segmenté en `shared`, `adminAcademic`, `adminOps` et `portal`), sans `@prisma/client` ni dans `domain/` ni dans `infrastructure/assistant/catalog/`.

---

## Partie 4 — Plafond de taille de fichiers (`AGENTS.md §4.1`) — Résolu en Lot 4

Le plafond dur de **500 lignes** est désormais appliqué automatiquement des deux côtés :
- **Backend** : `0` fichier `.ts` `> 500` lignes dans `backend/src/` (ensemble des 23 fichiers historiques découpés, incluant `minesecEsgFieldMap.ts`, `container.ts`, `PrismaMessagerieRepository.ts`, `adminAcademicGradeActions.ts`, `SmsNotificationService.ts`, `ORToolsWasmAdapter.ts`, `SchoolDocumentPdfRenderer.ts`, `FinanceController.ts`, etc.), test bloquant actif dans `backend/tests/unit/architectureGuard.test.ts`.
- **Frontend** : `0` fichier `.ts`/`.tsx` `> 500` lignes dans `frontend/src/` (ensemble des 62 fichiers de `LEGACY_OVERSIZED_MAX_LINES` découpés, map `LEGACY_OVERSIZED_MAX_LINES` vidée à `{}` dans `frontend/src/tests/architectureGuard.test.ts`).

---

## Partie 5 — Typage `any` (`AGENTS.md §4.12`) — Résolu en Lot 4

- Les 3 occurrences `// hex-allow-any` de `backend/src/infrastructure/assistant/catalog/catalogShared.ts` ont été éliminées via l'interface bivariante `ActionDefinition<TInput, TUndo>` et `defineAction`.
- `backend/tests/unit/architectureGuard.test.ts` interdit désormais toute occurrence de `hex-allow-any` dans `backend/src/`.

---

## Partie 6 — Qualité des Tests d'Intégration — Résolu en Lot 4

- `backend/src/infrastructure/services/sms/SmsService.ts` lit désormais dynamiquement les variables d'environnement (`TECHSOFT_*`) et protège `sendSMS` lorsque la configuration est absente.
- Les derniers appels `mock.module(...)` ont été supprimés de `communicationsBroadcast.integration.test.ts` et `OutboundMessagingInterception.test.ts` (`0` occurrence dans `backend/tests/`).

---

## Partie 7 — Suivi de la Feuille de route

| Lot | Statut | Chantiers réalisés | Validation |
|---|---|---|---|
| **Lot 4 — Purge Hexagonale & Découpage > 500 l.** | **Terminé** | 1. Extraction des routes inline et appels Prisma de `bootstrap/*.ts` vers Controllers + Routes + Repositories/Adapters<br>2. Suppression de tout accès Prisma direct dans les Controllers HTTP (y compris `AssistantController`)<br>3. Encapsulation des requêtes Copilot IA derrière `CopilotDataGateway` + suppression des 3 `// hex-allow-any`<br>4. Découpage complet des fichiers `> 500` lignes (Backend et Frontend) et suppression des `mock.module` | Backend & Frontend `tsc --noEmit` à 0 erreur, `architectureGuard.test.ts` (Backend + Frontend) vert, `frontend` `bun test` + `bun run build` verts |
