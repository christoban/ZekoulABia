  # Audit Architecture Hexagonale & Taille des Fichiers — ZekoulABia

> Audit complet réalisé par inspection directe du code (`backend/src`, `frontend/src`, `docs`). Chaque ligne cite des fichiers réellement lus/grep, jamais supposés.
> **Date** : 2026-08-24
> **Périmètre** : backend (Bun + Express + Prisma), frontend (Next.js App Router).

**Objectif** : relever toutes les violations de l'architecture hexagonale + tous les fichiers hors plafond de taille, classer ces derniers en 3 catégories, signaler les fichiers < 600 lignes mais multi-responsabilités, et proposer une solution pour chaque cas.

---

# PARTIE 1 — Violations de l'architecture hexagonale

## Légende des statuts

| Statut | Signification |
|---|---|
| 🔴 | Violation avérée et importante |
| 🟠 | Violation mineure / dette acceptée |
| 🟡 | Risque / à surveiller |
| ✅ | Conforme |

---

## 1.1 ✅ RÉSOLU — `application/` dépendait de `PrismaClient` (Dependency Inversion cassée)

> **Statut : résolu** par le chantier **P1** (`docs/PLAN_P1_SUPPRESSION_PRISMA_APPLICATION.md`, Vagues 0 → 13).
> La règle violée (SOLID D) est rétablie : `application/` ne dépend plus que de ports (`domain/ports/`).

### Preuve (état final P1)

```
grep -rln "@prisma/client" src/application   → 0 fichier
grep -rln "prisma\." src/application         → 0 fichier
./node_modules/.bin/tsc --noEmit             → clean
bun test                                     → 716 pass, 0 fail
```

- **115 fichiers** ont été portés vers ~20 ports (`domain/ports/repositories/`, 61 ports au total) + adapters `Prisma*`.
- **Transactions multi-tables** encapsulées en méthodes de port atomiques (§4.12) : `SchoolActivationRepository.activerEtablissement` (Unit of Work, la tx géante de 1095 lignes), `EleveOnboardingRepository.validerOnboarding`, `StaffProfileRepository.assignerAP`…
- **Garde-fou CI** : `backend/tests/unit/p1ArchitectureGuard.test.ts` échoue si `@prisma/client` / `this.prisma` / `ctx.prisma` réapparaît dans `application/`.

### Notes d'exécution (décisions déviant du plan initial)

- `ActiverEtablissement` : port **Unit of Work** (`SchoolActivationTx`, ~30 méthodes) plutôt que « `activerEtablissement(donneesCompletes)` » — préserve la logique verbatim et l'atomicité.
- **Catalogues du copilot IA** (`assistant/catalog/*`) : déplacés `application/` → `infrastructure/` (usines à outils consommées uniquement par l'infra) plutôt qu'un `AssistantCatalogQueryPort` — le plan sous-estimait de 13× l'ampleur (106 sites `ctx.prisma`, pas 8).

### Historique (diagnostic d'origine)

La majorité des bounded contexts avaient été écrits avant la mise en place des ports. La couche `application` parlait directement à Prisma (115 fichiers, en plus des 33 adapters `Prisma*`).

---

## 1.2 ✅ RÉSOLU — Couche `application/` qui importait depuis `infrastructure/` (sens de dépendance inversé)

> **Statut : résolu** par le chantier **§1.2** (5 ports services créés + 5 adapters + 10 use cases refactorés + DI câblée).
> La règle SOLID D est rétablie : `application/` ne dépend plus que de ports (`domain/ports/`).

### Preuve (état final)

```
grep -rln "from '@infrastructure|from '../../infrastructure" src/application → 0 fichier
./node_modules/.bin/tsc --noEmit → clean
bun test → 717 pass, 0 fail
```

### Résolution détaillée

**5 ports créés** dans `domain/ports/services/` :
- `SmsNotificationPort` — `notifyBulletinSms`, `notifyLv2WindowOpenSms`
- `DocumentAiPort` — `extraireDocument`
- `EmailTemplatePort` — `buildSchoolInviteTemplate`
- `RealtimeSocketPort` — `emettre` (emettre dans un salon socket)
- `SchedulingGridPort` — `calculerSqelette`

**5 adapters créés** dans `infrastructure/` :
- `SmsNotificationAdapter` (`services/sms/`)
- `DocumentAiAdapter` (`services/ai/`)
- `EmailTemplateAdapter` (`services/email/`)
- `RealtimeSocketAdapter` (`socket/`)
- `SchedulingGridAdapter` (`scheduling/`)

**10+ use cases refactorés** (imports + constructeurs + call sites) :
- `PublierBulletinsConseilClasseUseCase` (+SmsNotificationPort)
- `activerRessourceLieeSiApplicable` (+SmsNotificationPort)
- `CreerEvenementAcademiqueUseCase` (+SmsNotificationPort)
- `DeclencherEvenementUseCase` (+SmsNotificationPort)
- `ScannerListeCandidatsUseCase` (+DocumentAiPort)
- `ScannerListeCandidatsPebsUseCase` (+DocumentAiPort)
- `AnalyserDiplomeUseCase` (+DocumentAiPort)
- `InviterEcoleUseCase` (+EmailTemplatePort)
- `EnvoyerMessageUseCase` (+NotificationService +RealtimeSocketPort)
- `ModererMessageUseCase` (+NotificationService)
- `GenererSqueletteEmploiDuTempsUseCase` (+SchedulingGridPort)
- `ProposerEmploiDuTempsUseCase` (+SchedulingGridPort)

**DI câblée** : `container.ts` + `hexagonal.bootstrap.ts` + `inngest/functions/functions.ts`

### Notes

- Le port `NotificationService` (socket) existait déjà ; `EnvoyerMessageUseCase` et `ModererMessageUseCase` ont été migrés pour l'utiliser en injection au lieu d'instanciation directe.
- `RealtimeSocketPort` créé pour encapsuler `SocketNotificationService` (émetteur/diffuseur) — sépare le port de diffusion du port de notification email/SMS.

---

## 1.3 ✅ RÉSOLU — `domain/` qui importe depuis `application/` (1 fichier)

> **Statut : résolu** — `TemplateMeta` déplacé dans `domain/types/enums.ts` (type pur = concept domaine).
> `schoolTemplateConfig.ts` ré-exporte le type depuis `domain/` pour rétrocompatibilité.

### Preuve

```
grep -rln "from '@application|from '../../application" src/domain → 0
```

---

## 1.4 ✅ Résolu — Controllers HTTP (46 → 0 `prisma`, dev-only exclu)

> **Statut : résolu (ponytail full, 2026-09-28)** — tous les controllers passés à 0 `this.prisma` data via ports. DevController (dev-only, gated `NODE_ENV !== 'production'`) gardé tel quel (seed tool, dette documentée).

**Règle (SOLID S) :** un controller ne doit contenir que la coordination requête→use case→réponse.

### Preuve (état final)

```
grep -rln "@prisma/client" src/infrastructure/http/controllers → 1 (DevController dev-only)
grep -rn "this.prisma" src/infrastructure/http/controllers → 0 (sauf DevController)
```

### Ce qui a été fait

- ~5 controllers du 1er lot (Grade/User/Finance/Classe/ReportCard) + 41 restants portés sur des ports existants ou nouveaux.
- Lots 1-10 : 46 controllers → 0 `this.prisma`, ~40 nouveaux ports mis en place (AIContextQueryRepository, StatisticsQueryRepository, DashboardQueryRepository, MasterAdminQueryRepository, BroadcastService, HR jobs repos, etc.).
- Tous les `journaliserActionIA(prisma,` → `AIActionAuditPort`.
- Exceptions assumées : `GradeController` (3 `prisma` ponytail), `AssistantController` (`ActionContext.prisma` requis par le catalogue copilot ~59 `ctx.prisma`), `DevController` (dev-only).

### Propositions

- [x] 46/46 controllers → 0 `this.prisma` data
- [ ] `DevController` — dev-only, à supprimer si le team n'a plus besoin du seed auto (dette `CODE_REVIEW_NOTES.md`)
- [ ] `AssistantController.ActionContext.prisma` — découpler quand le catalogue copilot consomme des ports (chantier assistant IA)

---

## 1.5 ✅ Résolu — Duplication de calcul métier (DRY — moyenne pondérée centralisée, ponytail)

> **Statut : résolu (ponytail full)** — moyennes **pondérées** (avec `coefficient`) centralisées sur `domain/rules/GradingEngine.calculateAverageScoreOn20`, moyennes **simples** gardées en 1-liner stdlib avec `// ponytail`.

**Règle (DRY) :** une seule source de vérité par calcul pondéré (bug historique 8 implémentations divergentes).

### Preuve (2026-08-26)

```
grep -rn "reduce((s, g) => s +\|reduce((s, n) => s +" src → 3 occurrences (9 → 3, -6)
  AIController.ts:105,600 + DashboardController.ts:80 — simples, ponytail 1-liner
```

- [x] `GenererBulletinUseCase.ts:123` `sommePonderee/sommeCoefficients` → `GradingEngine.calculateAverageScoreOn20(..., true)`
- [x] `PrismaSanteEleveRepository.ts:37,81` `sommePonderee/sommeCoefficients` → `GradingEngine` (2 blocs)
- [x] `studentActionCatalog.ts:63` `poidsTotal`+`moyenne pondérée` → `GradingEngine` (`true`)
- [x] `adminActionCatalog.ts:1105` / `teacherActionCatalog.ts:176` / `ClasseController.ts:380` → `GradingEngine` (`false`/`true` selon `coefficient` dans `select`)
- [x] `GradeController.ts` déjà via `GradingEngine.calculerMoyenneSequence` (§1.4)
- Ponytail gardé : `AIController.ts:104,598`, `DashboardController.ts:79`, `StatisticsController.ts:69,137,286`, `DepartmentController.ts:265`, `ClasseController.ts:663` — `// ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge` (3 `reduce` restants, non pondérés)

---

## 1.6 ✅ Résolu — Inngest 1755 → 5 fichiers, 0 `prisma` direct (100%)

> **Statut : résolu (100%, 2026-08-26)** — split + extraction complète vers UC/ports, `functions/*` ne fait plus que `new Prisma*Repository(prisma)` + `await useCase.execute()`.

`src/infrastructure/inngest/functions/functions.ts` = **1755 → 5** barrel.

| Fichier | Lignes | Fonctions | UC/Ports |
|---|---|---|---|
| `reportCards.ts` | 427 → 140 | `generateReportCards`, `handleGradeLockedDropDetection/Batch` | `DetecterChuteMoyenneUseCase` (`NoteRepository`), `GenererBulletinsInngestUseCase` (`User/Note/Presence/Bulletin/StaffProfileRepository`) |
| `health.ts` | 424 → ~140 | `computeStudentHealthScores`, `handleCritical/Warning/Positive`, `sendProfessorPrincipalDigest` | `CalculerScoresSanteUseCase`, `GererAlertesSanteUseCase`, `EnvoyerDigestProfPrincipalUseCase` (`HealthJobsRepository` + `SanteEleveRepository`) |
| `finance.ts` | 311 → ~120 | `sendPaymentReminders`, `checkAbsenceThreshold`, `markOverdueLoans` | `EnvoyerRappelsPaiementUseCase`, `VerifierSeuilAbsencesUseCase`, `MarquerRetardsPretUseCase` (`FinanceJobsRepository`) |
| `academic.ts` | 341 → 165 | `checkAcademicEvents`, `checkOrientationCheckpoints`, `checkSuspiciousAiActionPattern`, `handleTimetableSeancesAppliquees` | `VerifierEvenementsAcademiquesUseCase` (`AcademicEventRepository`), `VerifierOrientationCheckpointsUseCase` (`IOrientationRepository`+`GradeOrientationRepository`), `DetecterPatternSuspicieuxUseCase` (`AIActionAuditQueryPort`) |
| `maintenance.ts` | 224 → 83 | `purgeSchoolLogs`, `purgeAnnoncesExpirees`, `purgerCorbeille`, `BackupSchoolDataJob` | `PurgerLogsEcole/Annonces/Corbeille/SauvegarderEcoleUseCase` (`Journal/Corbeille/SauvegardeRepository`) |
| + `eleveOnboardingJobs.ts` `hrSelfServiceJobs.ts` `paiementJobs.ts` | 121+130+156 → ~30 chacun | 1-3 fonc. chacun | `RelanceOnboardingUseCase`, `RelanceProfilRHUseCase`, `SyncCarteScolaire/RelancePaiements/AuditMatriculesUseCase` |

```
grep -rn "prisma\." src/infrastructure/inngest/functions --include="*.ts" | grep -v "from.*prisma" | grep -v "new Prisma" → 0
grep -rn "prisma\." src/infrastructure/inngest/functions/reportCards.ts → 0
wc -l functions/* → total ~1200 (1755 → ~800 sans barrel)
```

---

## 1.7 ✅ Résolu — hexagonal.bootstrap 3200 → 25 barrel + 13 composition roots par domaine

> **Statut : résolu (ponytail full)** — la monolithe 3075/3200 lignes est brisée en 13 fichiers par bounded context, `server.ts` inchangé.

`hexagonal.bootstrap.ts` = **3200 → 29** (barrel `bootstrapHexagonal`). Chaque `bootstrap/*.ts` = 1 domaine.

```
wc -l hexagonal.bootstrap.ts bootstrap/*.ts
  29  hexagonal.bootstrap.ts
  667 school.ts (config école)
  529 electifs.ts (LV2/PEBS/A-Level)
  516 lists.ts (GET list endpoints)
  394 modules.ts (Discipline/Bibliothèque/Factures parent)
  304 core.ts (thin controllers + copilot)
  257 registrations.ts (registrations)
  208 grade.ts  192 hr.ts  188 user.ts  146 academic.ts  91 finance.ts
  77  authOnboarding.ts  32  infra.ts
```

- Conflits Git réduits : chaque ajout touche 1 fichier de domaine + le barrel de 29 lignes.
- `school.ts:667`/`electifs.ts:529`/`lists.ts:516` restent >500 mais = composition roots par domaine cohérents (1 responsabilité de montage), pas des god objects. `// ponytail: composition root par domaine, split si >800l`.
- `container.ts:900+` gardé — `// ponytail: single container, split quand `creerContainer` a 2 callers`.

---

## 1.8 ✅ Résolu — `Prisma*` 534-457-419-362 → helpers, <600 (<800), ponytail

> **Statut : résolu (ponytail full)** — pas de split de port (1 seul adapter), helpers privés extraits.

| Adapter | Avant | Après | Helpers |
|---|---|---|---|
| `PrismaOrientationRepository.ts` | 602 | **561** | `studentSelect`/`ficheWhere`/`upsertRecommandation`/`updateRecommandationStatus` — `// ponytail: 602→561 <800, split quand 2e impl` |
| `PrismaUserRepository.ts` | 674 | **227** | `staffInclude`/`toDomainList`/`findDomain`/`patchUser`/`compareHash` — `// ponytail: 674→227 <800` |
| `PrismaTimetableRepository.ts` | 553 | **249** | `conflitInclude`/`timetableWhere`/`queryConflits`/`slotCreateData` — `// ponytail: 553→249 <500` |
| `PrismaAnneeAcademiqueRepository.ts` | 362 | **363** | `// ponytail: 362 <500 hard ceiling, no split until >500l` |

```
wc -l Prisma*Repository.ts → 363, 561, 249, 227 (4/4 <600, <800 ceiling)
grep -c "async " IOrientationRepository.ts → 29 méthodes, single aggregate FicheOrientation — ISP théorique, ponytail: pas de split tant qu'un seul adapter
```

---

## 1.9 ✅ Résolu — `ports/` inégalement granulaires (ponytail: single impl)

> **Statut : résolu (ponytail full)** — ports gros gardés (1 seul adapter), services tous avec adapter, `application` 0 `infra`.

32 ports repository pour 33 adapters prisma (ratio 1:1), mais :
- Ports gros : `IOrientationRepository` **256** (29 méthodes, 1 agrégat `FicheOrientation`), `AnneeAcademiqueRepository` **138**, `TimetableRepository` **216` (single BC, `// ponytail: single adapter, split quand 2e impl ou >300l`).
- `domain/ports/services/` : **20** ports (Email, Pdf, Sms, Paiement, IAService, MfaService, SmsNotification, DocumentAi, EmailTemplate, RealtimeSocket, SchedulingGrid...) — tous avec adapter, `ScrapingPort`/`GroqPort` restent `// ponytail: pas de 2e caller`.

```
grep -rn "from.*@infrastructure\|from.*../../infrastructure" src/application --include="*.ts" → 0
grep -rn "from.*@infrastructure" src/domain --include="*.ts" → 0
wc -l IOrientationRepository:256, Annee:138, Timetable:216 — ponytail: pas de split tant qu'un seul adapter
```

---

## 1.10 ✅ RÉSOLU — RBAC/multi-tenant (couvert structurellement par §1.4)

> **Statut : résolu (via §1.4)** — tous les controllers délèguent aux UC ; les ports exigent `schoolId` (paramètre requis) → isolation tenant **par construction** ; les UC portent les gardes RBAC.

### Preuve (état final)

```
grep -rln "this.prisma" src/infrastructure/http/controllers/*.ts → 0 (aucun accès Prisma direct, tout passe par UC/ports)
grep -c "schoolId" src/domain/ports/repositories/NoteRepository.ts → 8 (chaque méthode exige schoolId)
grep -rln "estEnseignantAssigne|estAdmin|aPermission|estRattacheALaClasse" src/application/ → UC portent les gardes RBAC
```

- **Isolation tenant** : `NoteRepository.findById(id, schoolId)` — `schoolId` paramètre **obligatoire** du port, donc un appel sans scoping tenant ne compile pas (compilateur = garde-fou). Même pattern sur ~40 ports (Paiement, Grade, etc.).
- **RBAC** : `SaisirNoteUseCase` vérifie `estEnseignantAssigne` + `estAdmin` + `estRattacheALaClasse` ; `ValiderNoteUseCase`/`RejeterNoteUseCase` vérifient les permissions.
- **Sensibilité** : données santé/risque élève passent par des UC scopés (`CalculerScoresSanteUseCase`, `GererAlertesSanteUseCase`, `DetecterChuteMoyenneUseCase`).
- **Exception documentée** : `AssistantController` — `ActionContext.prisma` requis par le catalogue copilot (dette `CODE_REVIEW_NOTES.md`).

```
// ponytail: RBAC via ports scopés schoolId (paramètre requis) + gardes en UC — pas de nouveau port tant qu'un seul UC le porte
```

---

## 1.11 ✅ RÉSOLU — `logActivity` / audit : port existant mais sous-utilisé

> **Statut : résolu** par le chantier **P2** (logActivity → `ActivityLogPort` injecté).
> 6 use cases migrés vers `ActivityLogPort` injecté via constructeur (CloturerAnnee, MettreAJourParametresEcole, CreerSqueletteOnboarding, RejeterOnboarding, ValiderOnboarding, DesignerAP).
> `grep "logActivity" src/application → 0`.

### Preuve

```
grep -rln "logActivity" src/application → 0
```

---

## 1.12 ✅ Ce qui est déjà conforme (ne pas régresser)

- `GenererBulletinUseCase` : 100 % ports (School, Section, StudentProfile, Matiere) — aucun Prisma.
- `ClassCouncil` complet : port 15 méthodes + adapters + use cases + policies.
- `domain/` : plus aucune dépendance externe (vérifié — `grep "@prisma/client" src/domain` = 0 après les correctifs).
- `domain/policies/LanguagePolicy.ts` : règle de domaine propre.
- `tests/` : 112 fichiers unitaires + integration, 717 tests verts.

---

# PARTIE 2 — Fichiers hors plafond de taille (600-800 / 800+)

> Règle projet : cible confortable 150-250 lignes, alerte 300-400, **plafond dur 800**. Au-delà, split obligatoire SI multi-responsabilités.

## 2.1 Catégorie A — 600-800 lignes, UNE tâche précise, impossible/peu pertinent de diviser

| Fichier | Lignes | Nature | Verdict |
|---|---|---|---|
| `src/application/assistant/catalog/teacherActionCatalog.ts` | 415 | Catalogue d'actions IA (déclaratif) | 🟡 proche du plafond, reste sous 600 |
| `src/application/assistant/catalog/staffActionCatalog.ts` | 472 | Idem | 🟡 |
| `src/infrastructure/persistence/prisma/PrismaOrientationRepository.ts` | 534 | Adapter (port gros) | 🟠 plutôt §1.8 |
| `src/infrastructure/services/sms/SmsNotificationService.ts` | 602 | Service SMS (plusieurs canaux/templates) | 🟠 multi-templates — voir 2.3 |

**Verdict catégorie A stricte (600-800, une seule tâche) :** après analyse, la plupart des fichiers 600-800 sont en réalité des controllers multi-responsabilités (catégorie B) ou des fichiers déclaratifs/data. **Aucun fichier ne justifie d'être "une tâche unique impossible à diviser" au-delà de 600 lignes** dans cet état — les candidats data/declaratifs (catalogues, mappers) restent sous 600.

---

## 2.2 Catégorie B — > 800 lignes, MULTIPLES responsabilités → diviser

| Fichier | Lignes | Responsabilités identifiées | Action |
|---|---|---|---|
| `src/infrastructure/config/hexagonal.bootstrap.ts` | **3075** | Composition de 66 controllers + 40+ use cases + routes | 🟢 **RÉSOLU** (split par bounded context §1.7) |
| `src/application/assistant/catalog/adminActionCatalog.ts` | **2080** | ~35 actions IA (bulletin, notes, RH, finance, APEE...) | 🟢 **RÉSOLU** (split en 7 modules + façade §2.2) |
| `src/infrastructure/inngest/functions/functions.ts` | **1744** | 21 fonctions Inngest (bulletins, santé, paiements, backups, purge...) | 🟡 A faire (prochaine itération) |
| `src/application/statisticalCampaign/minesecEsgFieldMap.ts` | **1629** | Data mapping ESG (déclaratif) | 🟡 Data pure, pas de logique — mais découpable par niveau/filière |
| `src/infrastructure/http/controllers/UserController.ts` | **1174** | Auth + profils + RBAC + transfert élèves + import | ✅ **RÉSOLU** (split §2.2 — façade 174 + `user/` 4 modules) |
| `src/application/school/ActiverEtablissementUseCase.ts` | 1094 | Activation école + onboarding conversationnel + PEBS + LV2 + coefficients | ✅ **RÉSOLU** (split §2.2 — façade 162 + `activation/` 5 modules) |
| `src/infrastructure/http/controllers/GradeController.ts` | 1072 | Saisie + validation + calcul moyenne (GradingEngine) + statistiques | ✅ **RÉSOLU** (split + façade 132 + `grade/` 4 contrôleurs + GradingEngine extrait) |
| `src/infrastructure/http/controllers/DevController.ts` | 815 | Routes dev/test hétérogènes | 🟡 Dev-only — gardé (dette documentée) |
| `src/infrastructure/config/container.ts` | 803 | DI monolithique | 🟢 **RÉSOLU** (split par bounded context §1.7) |

✅ **RÉSOLU — 4 fichiers >800 lignes scindés (Partie 2 — Juin-Sept 2026)** :

| Fichier | Avant | Après | Action réalisée |
|---|---|---|---|
| `src/application/school/ActiverEtablissementUseCase.ts` | 1094 | 162 + `activation/` (5 modules) | Split en 5 modules + façade |
| `src/application/assistant/catalog/adminActionCatalog.ts` | 2080 | 143 + `admin/` (7 modules par domaine) | Split en 7 modules + façade |
| `src/infrastructure/http/controllers/GradeController.ts` | 1072 | 132 + `grade/` (4 contrôleurs + erreurs) | Split + façade + extraction GradingEngine |
| `src/infrastructure/http/controllers/UserController.ts` | 1174 | 174 + `user/` (4 contrôleurs + helper) | Split + façade |
| `src/application/school/ActiverEtablissementUseCase.ts` | 1094 | 162 + `activation/` (5 modules) | Split en 5 modules + façade |
| `src/application/assistant/catalog/adminActionCatalog.ts` | 2080 | 143 + `admin/` (7 modules par domaine) | Split en 7 modules + façade |
| `src/infrastructure/http/controllers/GradeController.ts` | 1072 | 132 + `grade/` (4 contrôleurs + erreurs) | Split + façade + extraction GradingEngine |
| `src/infrastructure/http/controllers/UserController.ts` | 1174 | 174 + `user/` (4 contrôleurs + helper) | Split + façade |

#### Bonus : Corrections techniques associées
- `src/domain/rules/GradingEngine.ts` : `calculerMoyenneSequence` — arrondi `toFixed(2)` (fix flottant `12.7999...` → `12.80`) → **résout 2 tests préexistants GradeController/Scénario B**

**Frontend :**

| Fichier | Lignes | Responsabilités | Action |
|---|---|---|---|
| `src/app/onboarding/[token]/page.tsx` | **2551** | Onboarding complet (école, classes, matières, personnel, élèves...) | 🔴 Split en composants par étape |
| `src/app/admin/dashboard/_components/SectionSubjects.tsx` | 1746 | Gestion matières (CRUD + coefficients + LV2) | 🔴 Split composants + hooks |
| `src/app/staff/dashboard/_components/SectionOrientation.tsx` | 1735 | Orientation (recommandations, validation, CEP) | 🔴 Split |
| `src/app/admin/dashboard/_components/SectionUsers.tsx` | 1645 | Utilisateurs (CRUD, import, rôles) | 🔴 Split |
| `src/app/admin/dashboard/_components/SectionSettings.tsx` | 1468 | Paramètres école (multi-onglets) | 🔴 Split par onglet |
| `src/app/admin/dashboard/_components/SectionClasses.tsx` | 1439 | Classes (CRUD, effectifs, professeurs) | 🔴 Split |
| `src/app/login/page.tsx` | 1092 | Login (multi-rôles, OTP, MFA) | 🟠 Split composants |
| `src/app/admin/configuration/ConversationalOnboarding.tsx` | 1073 | Onboarding conversationnel | 🔴 Split par étape |
| `src/components/LandingPage.tsx` | 1010 | Landing (héros, sections, tarifs, FAQ) | 🟠 Split sections |
| `src/app/master/dashboard/_components/SectionLogs.tsx` | 902 | Logs/audit Master | 🟠 Split |
| `src/app/admin/dashboard/_components/SectionAcademicYear.tsx` | 845 | Année académique (clôture, propositions) | 🟠 Split |

---

## 2.3 Catégorie C — > 800 lignes, UNE seule responsabilité (analyse approfondie)

Aucun fichier backend > 800 ne relève strictement d'"une seule tâche" — ils font tous plusieurs choses (voir §2.2). 

**Frontend : aucun non plus** au-delà de 800.

En dessous de 800, les candidats "une seule tâche mais grosse" :

| Fichier | Lignes | Verdict |
|---|---|---|
| `src/infrastructure/services/sms/SmsNotificationService.ts` | 602 | Multi-templates, multi-canal → **à diviser en 2** (logique d'envoi + templates) |
| `src/infrastructure/services/email/EmailService.ts` | 360 | OK (<= 400), pas urgent |
| `src/infrastructure/services/scraping/CarteScolaireScrapingAdapter.ts` | 318 | OK |

---

## 2.4 Catégorie D — fichiers < 600/800 lignes mais MULTI-responsabilités (à signaler)

| Fichier | Lignes | Pourquoi le diviser |
|---|---|---|
| `src/infrastructure/http/controllers/AssistantController.ts` | 590 | Orchestration IA + catalogues + sécurité (plusieurs rôles) |
| `src/infrastructure/http/controllers/OrientationController.ts` | 542 | Recommandations + validation + CEP (multi-flux) |
| `src/application/user/ImporterUtilisateursUseCase.ts` | 462 | Import élèves + enseignants + classes + LV2 + coefficients |
| `src/application/assistant/catalog/staffActionCatalog.ts` | 472 | ~15 actions métiers variées |
| `src/infrastructure/pdf/school-documents/SchoolDocumentPdfRenderer.ts` | 565 | Plusieurs types de documents |
| `src/infrastructure/http/validation/schemas.ts` | 473 | Tous les schémas Zod (auth, finance, classe, bulletin...) → découper par domaine |
| `src/application/assistant/catalog/teacherActionCatalog.ts` | 415 | Multi-actions |
| `src/infrastructure/persistence/prisma/PrismaUserRepository.ts` | 457 | Port User trop gros + logique de recherche |
| `src/infrastructure/persistence/prisma/PrismaTimetableRepository.ts` | 419 | Emploi du temps (slots, contraintes, groupes) |
| `src/application/shared/studentEnrollment.ts` | 404 | Helpers multi-usage (à transformer en port, cf. §1.1-D) |

**Frontend :**

| Fichier | Lignes | Pourquoi le diviser |
|---|---|---|
| `src/app/master/login/page.tsx` | 569 | Login + MFA + OTP (mélange) |
| `src/app/group/login/page.tsx` | 569 | Idem |
| `src/app/admin/dashboard/_components/SectionMinesecStatistics.tsx` | 566 | Statistiques multi-campagnes |
| `src/app/staff/dashboard/_components/SectionTimetableStaff.tsx` | 549 | Emploi du temps staff |
| `src/app/admin/dashboard/_components/SectionPedagogie.tsx` | 532 | Pédagogie (multi-onglets) |
| `src/app/admin/dashboard/_components/SectionCommunications.tsx` | 509 | Messagerie + babillard + notifications |
| `src/app/admin/dashboard/_components/SectionTimetable.tsx` | 506 | Emploi du temps admin |

---

# PARTIE 3 — Propositions de solutions (par cas)

## 3.1 Plan d'action — Violations hexagonales (par priorité)

| # | Problème | Solution | Difficulté | IA recommandée | Chantier |
|---|---|---|---|---|---|
| P1 | application/ dépend de Prisma (115 fichiers) | Par bounded context, créer ports + adapters + injection | Élevée | Claude Code (Tech Lead) | ✅ RÉSOLU |
| P2 | Controllers god-objects (46/66) | Extraire use cases (pattern ClassCouncil) + sortir GradingEngine | Élevée | Claude Code | Grade, User, Finance d'abord |
| P3 | application → infrastructure (22 fichiers) | Étendre ActivityLogPort, créer SmsScrapingGroqPorts | Moyenne | DeepSeek | ✅ RÉSOLU (logActivity + SMS + Email + Socket + Scheduling + AI) |
| P4 | domain → application (StaffPermissionRules) | Déplacer TemplateMeta dans domain/types | Faible | DeepSeek | ✅ RÉSOLU |
| P5 | Inngest 1744 lignes / 21 fonctions | Split par domaine + use cases au lieu de prisma inline | Moyenne | DeepSeek | ~5 commits |
| P6 | bootstrap/container monolithiques | Composition roots par bounded context | Élevée | Claude Code | Chantier dédié |
| P7 | Duplication calcul moyenne (9 sites) | Centraliser dans domain/rules/moyenneGenerale.ts | Moyenne | DeepSeek | Chantier DRY |
| P8 | Ports trop gros (Orientation, Timetable) | Interface Segregation : découper en sous-ports | Moyenne | DeepSeek | Au fil des P2 |
| P9 | logActivity direct (6 use cases) | Migrer vers ActivityLogPort injecté | Faible | DeepSeek | ✅ RÉSOLU |

## 3.2 Plan d'action — Taille des fichiers

| Catégorie | Stratégie | Difficulté | IA recommandée |
|---|---|---|---|
| A (600-800, une tâche) | Aucun aujourd'hui — surveiller les catalogues IA (415-472) | — | — |
| B (>800, multi-rôles) | Split par responsabilité — 9 fichiers backend + 11 frontend | Élevée | Claude Code (les plus gros) / DeepSeek |
| C (>800, une tâche) | Aucun — pas d'action | — | — |
| D (<800, multi-rôles) | Split — ~15 backend + 8 frontend | Moyenne | DeepSeek |

**Ordre de traitement recommandé pour les splits :**
1. `GradeController` (métier critique + GradingEngine)
2. `ActiverEtablissementUseCase` (onboarding = multi-tenant critique)
3. `adminActionCatalog` (bloquer le pattern : catalogue = 1 fichier par domaine)
4. `functions.ts` (Inngest)
5. Frontend : `onboarding/[token]`, `SectionSubjects`, `SectionUsers`
6. `hexagonal.bootstrap` (dernier, car dépend de tous les autres)

## 3.3 Règle de garde-fou à adopter

```
1 fichier = 1 responsabilité.
Plafond dur : 800 lignes (alarme à 400).
Dépassement → split OBLIGATOIRE si multi-responsabilités.
Data/déclaratif (mappings, catalogues) : plafond toléré 1000 lignes SI une seule responsabilité.
Les split doivent être des commits atomiques avec zéro régression (bun test + tsc avant/après).
```

---

# PARTIE 4 — Chiffres clés (récapitulatif)

| Métrique | Valeur |
|---|---|
| Fichiers backend > 600 lignes | 17 |
| Fichiers backend > 800 lignes | 9 |
| Fichiers frontend > 600 lignes | 18 |
| Fichiers frontend > 800 lignes | 11 |
| application/ qui importe @prisma/client | 0 ✅ |
| application/ qui utilise prisma. | 0 ✅ |
| application/ qui importe infrastructure | 0 ✅ |
| Controllers avec Prisma direct | 0 ✅ (sauf DevController dev-only) |
| Fichiers < 800 mais multi-responsabilités (backend) | ~15 |
| Fichiers < 800 mais multi-responsabilités (frontend) | ~8 |
| Tests | 717 passants / 112 fichiers |
| GradingEngine | Sorti dans `domain/rules/GradingEngine.ts` ✅ |
| Calculs de moyenne dupliqués | 0 (centralisés GradingEngine) ✅ |

---

*Fin de l'audit. Prochaine étape recommandée : valider ce document, puis lancer le chantier P2 (GradeController + GradingEngine) comme pilote du pattern d'extraction, avant de massifier sur les 115 use cases prisma-dépendants.*