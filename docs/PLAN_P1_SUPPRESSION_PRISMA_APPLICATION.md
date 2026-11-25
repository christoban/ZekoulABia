# PLAN P1 — Éliminer la dépendance Prisma de la couche `application/`

> Chantier P1 de l'audit `AUDIT_ARCHITECTURE_HEXAGONALE.md` (§1.1).
> **Date** : 2026-08-24 · **Statut** : ✅ **TERMINÉ** (2026-08-25) — `grep "@prisma/client" src/application` → 0, `grep "prisma\." src/application` → 0, 716 tests pass, garde-fou CI en place (`backend/tests/unit/p1ArchitectureGuard.test.ts`).

---

## 1. Objectif

Supprimer **toute dépendance à `@prisma/client`** dans `backend/src/application/**` :
115 fichiers aujourd'hui dépendent de `PrismaClient` (injection directe), 12 095 lignes concernées.
À la fin, la couche application ne dépend **que de ports** (`domain/ports/`), conformément à la règle
d'Inversion des Dépendances (SOLID D, AGENTS.md §4.3).

**Critère final vérifiable :**
```bash
grep -rln "@prisma/client" src/application   # → 0 fichier
grep -rln "prisma\." src/application         # → 0 fichier
```

---

## 2. Contexte — état actuel (mesuré, pas supposé)

### 2.1 Le pattern est uniforme (bonne nouvelle)

Tous les use cases concernés suivent le même schéma :
```ts
import type { PrismaClient } from '@prisma/client';

export class XxxUseCase {
  constructor(private readonly prisma: PrismaClient) {}
  // ... this.prisma.model.findMany(...)
}
```
- **Aucun `new PrismaClient()` dans application** — toujours injecté depuis le bootstrap.
- 56 sites d'instanciation `(prisma)` dans `hexagonal.bootstrap.ts`.
- Taille moyenne : 105 lignes/fichier. Les 3 monstres : `ActiverEtablissementUseCase` (1094),
  `ImporterUtilisateursUseCase` (462), `studentEnrollment.ts` (404).

### 2.2 Répartition par module (115 fichiers)

| Module | Fichiers | Modèles Prisma touchés | Ports existants ? |
|---|---|---|---|
| schoolGroup | 13 | schoolGroupOwner, groupTransferRequest, school, user | ❌ (auth séparée) |
| messagerie | 11 | conversation, message, conversationParticipant, messageReadStatus | ❌ |
| student | 7 | studentProfile, studentALevelSubject, aLevelSubject, anglophoneStreamCombination | ⚠️ StudentProfileRepository (1 méthode bulletin) |
| pebsExam | 7 | pebsExamSession, pebsExamCandidate | ❌ |
| entranceExam | 7 | entranceExamSession, entranceExamCandidate | ❌ |
| matricule | 6 | matriculeImportJob, studentProfile | ❌ |
| academicEvent | 6 | academicEvent | ❌ |
| timetable | 5 | timetableGridConfig, timetable, class, user | ⚠️ TimetableRepository (à étendre) |
| lv2Choice | 5 | lv2ChoiceWindow, studentProfile, subject | ❌ |
| announcement | 5 | announcement | ❌ |
| user | 4 | user, staffProfile, staffPermission, teacherProfile | ⚠️ UserRepository (à étendre) |
| statisticalCampaign | 4 | statisticalSubmission, schoolStatisticalSupplement, statisticalCampaignTemplate, school, user, feePlan | ❌ |
| school | 4 | school, class, subject, subjectCoefficient, classSubjectOverride, timetable | ⚠️ SchoolRepository (à étendre) |
| paiementMinesec | 4 | paiementMinesec, inscriptionMinesec, tarifMinesecReference, paiementEtablissement, school | ❌ |
| eleveOnboarding | 4 | studentOnboarding, user, parentStudent, studentProfile | ❌ |
| suivi | 3 | studentFollowUpAction, studentProfile, staffProfile, teachingAssignment, class | ⚠️ StudentFollowUpRepository existe, non câblé |
| statisticalCampaignMinedub | 2 | minedubStatisticalReport, minedubSchoolSupplement | ❌ |
| shared | 2 | enrollment, class, studentProfile, teachingAssignment (fonctions libres) | ❌ |
| orientation | 2 | studentProfile, grade, recommandationSerie | ⚠️ IOrientationRepository (235 l.) à étendre |
| masterAdmin | 2 | masterUser | ❌ |
| discipline | 2 | disciplineRecord, disciplineCouncilSession | ❌ |
| classCouncil | 2 | — (imports d'enum `CouncilDecision` uniquement) | ✅ (quick win) |
| attendance | 2 | attendance, smsLog, user | ⚠️ PresenceRepository (à étendre) |
| apee | 2 | aPEETransaction, justificatif | ❌ |
| studentGroup | 1 | studentGroupMembership, academicYear | ⚠️ StudentGroupMembershipRepository |
| grade | 1 | — (passe `this.prisma` au helper partagé uniquement) | résolu par Vague 1 |
| examen | 1 | examSession, examRegistration, invoice… | ❌ |
| assistant/catalog | 1 | class, user, subject, academicYear, academicPeriod, academicSequence, grade (via `ctx.prisma`) | ❌ (ActionContext porte prisma) |

### 2.3 Cas particuliers identifiés

1. **`shared/studentEnrollment.ts`** (404 l.) : fonctions libres prenant `prisma` en paramètre,
   consommées par 18 fichiers (application + infrastructure + scripts). **Fondation** — beaucoup de
   modules en dépendent, à traiter en premier.
2. **`shared/verifierRattachementClasse.ts`** : idem (4 consommateurs application + 1 controller).
3. **8 fichiers avec `$transaction`** : `EnvoyerMessageUseCase`, `ValiderOnboardingUseCase`,
   `ActiverEtablissementUseCase`, `AccepterTransfertEleveUseCase`, `studentEnrollment.ts`,
   `AffecterMatieresALevelEleveUseCase`, `PreremplirDepuisCombinaisonUseCase`, `staffActionCatalog`.
   → Pattern de résolution : **encapsuler chaque transaction dans UNE méthode atomique du port**
   (conforme §4.12 AGENTS.md — jamais de tx qui fuit dans l'application).
4. **`assistant/catalog/catalogShared.ts`** : `ActionContext` contient `prisma: PrismaClient`,
   construit par `AssistantController` (infrastructure). Le retrait implique de changer la signature
   du contexte pour les 5 catalogues → vague dédiée, la plus délicate.
5. **Auth Master/GroupOwner** : `LoginMasterUseCase`/`LoginGroupOwnerUseCase` (OTP, MFA).
   Des tests existants mockent prisma (`LoginMasterUseCase.test.ts`, `VerifyGroupOwnerMfaUseCase.test.ts`)
   → à migrer vers mocks de ports (plus simples).
6. **`SaisirNoteUseCase`** : n'utilise prisma que pour le passer à `estRattacheALaClasse` →
   résolu mécaniquement par la Vague 1.

---

## 3. Impact sur l'architecture

- **Sens des dépendances** : rétabli application → domain/ports ← infrastructure/adapters.
- **Nouveaux ports** : ~20 ports repository + extensions de ~8 ports existants.
- **Adapters** : 1 `Prisma*Repository` par nouveau port, wiring dans `hexagonal.bootstrap.ts`.
- **Aucun changement de comportement** : les requêtes Prisma sont déplacées **verbatim** dans les
  adapters. Les vérifications RBAC/multi-tenant restent dans les use cases (§4.12).
- **Couplage** : aucun nouveau couplage entre bounded contexts — chaque port est scoped à son module.
- **`hexagonal.bootstrap.ts`** grossira légèrement à chaque vague (instanciation des adapters) —
  son split est le chantier P6 de l'audit, hors périmètre P1.

---

## 4. Conventions transverses (obligatoires à chaque vague)

1. **Port = interface + DTO** : jamais de type Prisma dans une signature. Les DTO de données sont
   déclarés dans le fichier du port (pattern `ClassCouncilRepository.ts`).
2. **Enums Prisma** : miroir en union littérale dans `domain/types/enums.ts` si absent
   (pattern `CouncilDecision` déjà fait).
3. **Transaction atomique** : toute écriture multi-table = UNE méthode du port
   (ex. `publierBulletins()` du ClassCouncilRepository).
4. **Requêtes verbatim** : copier la query Prisma telle quelle dans l'adapter — pas de
   "réécriture d'occasion" (Boy Scout limité au déplacement).
5. **Wiring** : instancier l'adapter dans `hexagonal.bootstrap.ts` au plus près de ses use cases ;
   remplacer `new XxxUseCase(prisma)` par `new XxxUseCase(xxxRepository)`.
6. **Barrel** : mettre à jour le `index.ts` du module s'il existe.
7. **Fake** : créer `tests/helpers/repositories/InMemoryXxxRepository.ts` pour chaque nouveau port
   (utile pour les tests futurs, coût faible).
8. **Commit atomique par vague** (ou sous-lots si la vague est grosse) : `tsc --noEmit` clean +
   `bun test` 716+ pass avant chaque commit.
9. **Ne jamais supprimer un test** : les tests existants sont migrés (mock prisma → mock port).

---

## 5. Étapes — Vagues 0 à 13

> Chaque vague démarre par : `grep -rln "@prisma/client" src/application/<module>` pour
> re-lister les fichiers exacts (l'état peut avoir bougé).

---

### VAGUE 0 — Quick wins : imports d'enum uniquement (2 fichiers)

**Fichiers** : `classCouncil/AjouterDecisionConseilClasseUseCase.ts`,
`classCouncil/AjouterDecisionsEnBlocUseCase.ts`.

**Action** : `import type { CouncilDecision } from '@prisma/client'` → `from '@domain/types/enums'`
(déjà défini, valeurs identiques vérifiées). Supprimer les casts `as CouncilDecision` si redondants.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 0.1 | Remplacer les 2 imports + tsc + tests + commit | Faible | DeepSeek |

---

### VAGUE 1 — Fondations partagées : `shared/` (résout aussi grade + attendance + timetable partiel)

**Fichiers** : `shared/studentEnrollment.ts`, `shared/verifierRattachementClasse.ts`,
puis consommateurs application : `grade/SaisirNoteUseCase.ts`,
`attendance/EnregistrerPresenceUseCase.ts`, `attendance/TraiterSmsPresenceUseCase.ts`,
`timetable/DemanderRattrapageUseCase.ts` (+ à l'exécution : tout fichier application passant
`prisma` à ces helpers).

**Nouveaux ports** :
```ts
// domain/ports/repositories/EnrollmentRepository.ts
export interface EnrollmentRepository {
  // méthodes dérivées des fonctions de studentEnrollment.ts (à calquer 1:1) :
  elevesDeLaClasse(classId: string): Promise<string[]>;               // oùProfilsParClasse
  classesDeLeleve(studentId: string): Promise<string[]>;
  compterElevesClasse(classId: string): Promise<number>;
  classeCouranteDeLeleve(studentId: string): Promise<{ classId: string } | null>;
  // ... une méthode par fonction exportée utilisée par l'application
  inscrireEleve(donnees: InscriptionEleveData): Promise<void>;        // encapsule la $transaction
  transfererEleve(...): Promise<void>;                                // encapsule la $transaction
}
```
```ts
// domain/ports/repositories/RattachementEnseignantRepository.ts
export interface RattachementEnseignantRepository {
  estRattacheALaClasse(params: {
    userId: string; classId: string; subjectId?: string;
    autoriserProfesseurPrincipal: boolean;
  }): Promise<boolean>;
}
```

**Adapters** : `PrismaEnrollmentRepository`, `PrismaRattachementEnseignantRepository` —
le corps des fonctions actuelles est déplacé verbatim.

**Décision de compatibilité** : les fonctions de `studentEnrollment.ts` restent exportées pour
les **consommateurs infrastructure** (controllers, prisma repos, inngest, scripts) qui continuent
de leur passer prisma — l'application, elle, passe par les ports. Les fonctions deviennent de
minces wrappers internes (ou l'infra migre aussi, au fil des autres chantiers — pas bloquant).

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 1.1 | Créer EnrollmentRepository + adapter (reprendre les fonctions verbatim, tx incluses) | Moyenne | Claude Code |
| 1.2 | Créer RattachementEnseignantRepository + adapter | Faible | DeepSeek |
| 1.3 | Refactorer les use cases consommateurs (grade, attendance, timetable, messagerie, pebsExam, lv2Choice…) à injecter les ports | Moyenne | DeepSeek |
| 1.4 | Wiring bootstrap + tsc + tests + commit | Faible | DeepSeek |

---

### VAGUE 2 — Pilote CRUD : `announcement/` (5 fichiers)

**Fichiers** : CreerAnnonce, ListerAnnonces, ModifierAnnonce, SupprimerAnnonce, PurgerAnnoncesExpirees.

**Nouveau port** : `AnnouncementRepository` (CRUD + purge expirées + requêtes par école/période).
**Valeur** : module simple, sans transaction, pour **valider le pattern de bout en bout** avant les
modules sensibles. C'est la vague "référence" : les vagues suivantes copient ce canevas.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 2.1 | Port + adapter + fake InMemory | Faible | DeepSeek |
| 2.2 | Refactor des 5 use cases + wiring + commit | Faible | DeepSeek |

---

### VAGUE 3 — `messagerie/` (11 fichiers) — avec `$transaction`

**Fichiers** : CompterMessagesNonLus, CreerCanalClasse, CreerCanalParents, EnvoyerMessage,
ListerContactsMessagerie, ListerConversations, ListerMessagesEnAttenteModeration, ListerMessages,
MarquerMessagesLus, MessagerieAccessHelpers, ModererMessage.

**Nouveau port** : `MessagerieRepository` — conversation, message, participant, readStatus,
modération. Les helpers d'accès (`MessagerieAccessHelpers.ts`) deviennent des méthodes du port
(`verifierAccesConversation`, `peutVoirClasse`, `elevesEtParentsDeLaClasse`…).
La `$transaction` de `EnvoyerMessageUseCase` → méthode atomique `envoyerMessageDansConversation()`
(création conversation + participants + message en une tx).

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 3.1 | Port MessagerieRepository (DTO conversation/message/participant) | Moyenne | Claude Code |
| 3.2 | Adapter (tx atomique envoyerMessage) + fake | Moyenne | Claude Code |
| 3.3 | Refactor 11 fichiers (helpers → méthodes port) + wiring | Moyenne | DeepSeek |
| 3.4 | tsc + tests + commit | Faible | DeepSeek |

---

### VAGUE 4 — `schoolGroup/` (13 fichiers) — auth + transferts

**Fichiers** : AccepterTransfertEleve, AccepterTransfertEnseignant, calculerKpisEcole,
CreerDemandeTransfertGroupe, ListerDemandesTransfertEntrantes, ListerDemandesTransfertGroupe,
ListerEcolesGroupe, LoginGroupOwner, ObtenirDetailEcoleGroupe, ObtenirKpisGroupe,
RechercherPersonneEcoleGroupe, RejeterTransfertGroupe, VerifyGroupOwnerMfa.

**Nouveaux ports** :
- `SchoolGroupOwnerAuthRepository` : `findByEmail`, `updateOtpConnexion`, `updateMfaFields`
  (miroir exact de ce que fera la Vague 12 pour MasterUser — factoriser la forme).
- `GroupTransferRepository` : CRUD demandes + `accepterTransfertEleve()` **atomique**
  (la `$transaction` d'AccepterTransfertEleve) + `accepterTransfertEnseignant()`.
- `GroupeScolaireQueryRepository` : écoles du groupe, KPIs école/groupe (les agrégats
  `calculerKpisEcole` deviennent des méthodes du port), recherche personne.

**Tests** : `VerifyGroupOwnerMfaUseCase.test.ts` (mock prisma) → mocker les ports.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 4.1 | Port + adapter auth GroupOwner | Moyenne | Claude Code |
| 4.2 | Port + adapter transferts (tx atomiques) | Moyenne | Claude Code |
| 4.3 | Port + adapter requêtes groupe/KPIs | Moyenne | DeepSeek |
| 4.4 | Refactor 13 use cases + tests + wiring + commit | Moyenne | DeepSeek |

---

### VAGUE 5 — `student/` + `lv2Choice/` (12 fichiers)

**Fichiers student** (7) : AffecterLV2Eleve, AffecterLV2EnMasse, AffecterMatieresALevelEleve,
AffecterPEBSEleve, AffecterPEBSEnMasse, GetElevesParMatiereALevel, PreremplirDepuisCombinaison.
**Fichiers lv2Choice** (5) : AppliquerChoixLV2, OuvrirFenetreChoixLV2, SaisirChoixLV2Manuel,
SoumettreChoixLV2Eleve, SuivreFenetreChoixLV2.

**Nouveaux ports** (⚠️ ne PAS faire un god-port StudentProfile — le découper) :
- `StudentAffectationRepository` : affectations LV2/PEBS/A-Level individuelles et en masse,
  `preremplirDepuisCombinaison()` (tx atomique), lectures combinaisons officielles.
- `Lv2ChoiceRepository` : fenêtre de choix (ouverture, suivi, saisie manuelle, soumission élève).

Le `StudentProfileRepository` existant (bulletin) reste tel quel — 1 port = 1 besoin.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 5.1 | Port + adapter StudentAffectationRepository | Moyenne | Claude Code |
| 5.2 | Port + adapter Lv2ChoiceRepository | Moyenne | DeepSeek |
| 5.3 | Refactor 12 use cases + wiring + commit | Moyenne | DeepSeek |

---

### VAGUE 6 — `pebsExam/` + `entranceExam/` (14 fichiers) — ports jumeaux

**Fichiers pebsExam** (7) : AjouterCandidatsPebs, AppliquerTransfertPebs, CalculerSelectionPebs,
CreerSessionPebs, DetecterAnomaliesPebs, ResumeSessionPebs, ScannerListeCandidatsPebs.
**Fichiers entranceExam** (7) : AjouterCandidatsConcours, CalculerAdmissionConcours,
CreerSessionConcours, DetecterAnomaliesConcours, EnregistrerResultatCep, ResumeSessionConcours,
ScannerListeCandidatsConcours.

**Nouveaux ports** (symétrie quasi totale, les concevoir ensemble) :
- `PebsExamRepository` : sessions, candidats, sélection, anomalies, transfert (`AppliquerTransfertPebs`
  contient des écritures studentProfile → tx atomique dédiée).
- `EntranceExamRepository` : idem côté concours + `EnregistrerResultatCep` (onboarding lié).

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 6.1 | Les 2 ports (conçus symétriques) | Moyenne | Claude Code |
| 6.2 | Les 2 adapters + fakes | Moyenne | DeepSeek |
| 6.3 | Refactor 14 use cases + wiring + commit | Moyenne | DeepSeek |

---

### VAGUE 7 — `matricule/` + `paiementMinesec/` (10 fichiers)

**Fichiers matricule** (6) : ConfirmerCorrespondanceFuzzy, ImporterMatricules, SignalerErreurCarteScolaire,
SyncFromCarteScolaire, VerifierMatricule, VerifierRecu.
**Fichiers paiementMinesec** (4) : GenererPaiementsMinesecPourEcole, GenererPaiementsMinesec,
GetSchoolPaymentOverview, GetStudentPaymentDashboard.

**Nouveaux ports** :
- `MatriculeImportRepository` : jobs d'import (création, mise à jour, erreurs), vérification
  reçu/motif, sync carte scolaire (lectures studentProfile).
- `PaiementMinesecRepository` : paiements, inscriptions, tarifs de référence, agrégats
  (`groupBy` de GetSchoolPaymentOverview → méthodes d'agrégation du port).

**Attention** : `SyncFromCarteScolaire` dépend du service de scraping (infra) — vérifier que le
port n'expose que la persistance, le scraping reste injecté à part (déjà le cas).

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 7.1 | Port + adapter MatriculeImportRepository | Moyenne | DeepSeek |
| 7.2 | Port + adapter PaiementMinesecRepository (agrégats) | Moyenne | Claude Code |
| 7.3 | Refactor 10 use cases + wiring + commit | Moyenne | DeepSeek |

---

### VAGUE 8 — `academicEvent/` + `apee/` + `suivi/` + `discipline/` (13 fichiers)

**Fichiers academicEvent** (6) : AjusterFenetreEvenement, CreerEvenementAcademique,
DeclencherEvenement, ListerEvenements, ObtenirEvenementsActifs, activerRessourceLiee.
**Fichiers apee** (2) : CreerTransactionAPEE, ValiderDepenseAPEE.
**Fichiers suivi** (3) : AssignerActionSuivi, CreerActionSuiviEleve, ListerHistoriqueSuiviEleve.
**Fichiers discipline** (2) : ConvoquerConseilDiscipline, TenirConseilDiscipline.

**Ports** :
- `AcademicEventRepository` (nouveau) : CRUD événements + `activerRessourceLiee()` (écritures
  multi-tables → tx atomique).
- `ApeeTransactionRepository` (nouveau) : transactions APEE + validation dépense (règle du
  justificatif — la règle métier reste dans le use case, seule la persistance bouge).
- `StudentFollowUpRepository` (**existe déjà, non câblé**) : l'étendre aux besoins des 3 use cases
  puis les y brancher (plusieurs écritures de `CreerActionSuiviEleve` → tx atomique).
- `DisciplineRepository` (nouveau) : records + sessions de conseil de discipline
  (`TenirConseilDiscipline` = tx atomique de changement de statut + sanctions).

**Tests existants** : `APEEUseCase.test.ts` (mock prisma) → mock port.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 8.1 | AcademicEventRepository + refactor 6 fichiers | Moyenne | DeepSeek |
| 8.2 | ApeeTransactionRepository + refactor 2 fichiers + tests | Moyenne | DeepSeek |
| 8.3 | Extension StudentFollowUpRepository + refactor 3 fichiers | Moyenne | Claude Code |
| 8.4 | DisciplineRepository + refactor 2 fichiers + commit | Moyenne | DeepSeek |

---

### VAGUE 9 — `statisticalCampaign/` + `statisticalCampaignMinedub/` (6 fichiers)

**Fichiers statisticalCampaign** (4) : GenererDeclarationStatistiqueMinesec,
VerifierCompletudeSupplement, resolveAutoFields (260 l.), resolvePersonnelFields.
**Fichiers statisticalCampaignMinedub** (2) : GenererRapportSyntheseMinedub, resolvePrimaryAutoFields.

**Nouveaux ports** :
- `StatisticalCampaignRepository` : submissions, supplements école, templates
  (création de submission = tx : génération + upload fichier — le fichier reste géré côté
  infrastructure, le port persiste).
- `StatisticalQueryPort` : les résolutions de champs auto (`resolveAutoFields`,
  `resolvePersonnelFields`) sont de **grosses requêtes de lecture** → port de lecture dédié
  avec méthodes par famille de champs (effectifs, personnels, finances, infrastructures).
- `MinedubReportRepository` : rapports MINEDUB + supplements primaire + resolvePrimaryAutoFields.

**Note** : les fonctions `resolve*` prennent `prisma` global (pas `this.prisma`) — signature libre
à faire évoluer en méthodes de port.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 9.1 | StatisticalQueryPort (lectures massives — le plus volumineux) | Élevée | Claude Code |
| 9.2 | StatisticalCampaignRepository + MinedubReportRepository | Moyenne | DeepSeek |
| 9.3 | Refactor 6 fichiers + wiring + commit | Moyenne | DeepSeek |

---

### VAGUE 10 — `timetable/` + `orientation/` + `studentGroup/` + `examen/` (9 fichiers)

**Fichiers timetable** (5) : DemanderRattrapage, GenererSqueletteEmploiDuTemps,
ResoudreParticipantsSeance, ProposerEmploiDuTemps, SimulerEmploiDuTemps.
**Fichiers orientation** (2) : GenererRecommandationOrientation, ListerElevesAOrienter.
**Fichier studentGroup** (1) : syncGroupMembership.
**Fichier examen** (1) : PrepareExamDossierUseCase.

**Ports** :
- **Étendre `TimetableRepository`** : gridConfig, rattrapages, résolution participants de séance
  (lectures user/class/groupes), simulation (vérifications d'existence).
- **Étendre `IOrientationRepository`** (235 l. — attention Interface Segregation : ajouter des
  méthodes ciblées, pas un fourre-tout) : lectures grades/notes orientées recommandation.
- `syncGroupMembership` → méthode du `StudentGroupMembershipRepository` **existant**.
- `ExamenRepository` (nouveau) : dossiers d'examen (sessions, inscriptions, factures liées).

**Tests existants** : `ProposerEmploiDuTempsUseCase.test.ts` + 4 autres timetable (mocks prisma) → mocks ports.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 10.1 | Étendre TimetableRepository + refactor 5 fichiers + tests | Élevée | Claude Code |
| 10.2 | Étendre IOrientationRepository + refactor 2 fichiers | Moyenne | DeepSeek |
| 10.3 | Câbler syncGroupMembership au port existant | Faible | DeepSeek |
| 10.4 | ExamenRepository + refactor + commit | Moyenne | DeepSeek |

---

### VAGUE 11 — `user/` + `school/` (8 fichiers) — LES MONSTRES (claude)

**Fichiers user** (4) : DesignerAP (staffProfile/staffPermission, tx), ImporterUtilisateurs
(462 l.), LoginEmailOtp, VerifierMfaConnexion.
**Fichiers school** (4) : ActiverEtablissement (1094 l. !), ConfigurerEtablissement,
SubjectAssignmentHelper (261 l.), ObtenirAnomaliesEtablissement.

**Ports** :
- **Étendre `UserRepository`** : `findByEmail` avec champs OTP/MFA, `updateOtpConnexion`,
  `updateMfaConnexion`, `designerAP()` (tx atomique staffProfile+permissions+teacherProfile),
  et un `ImporterUtilisateursRepository` **séparé** (l'import massif : lectures classes/matières/
  coefficients + écritures utilisateurs en tx → 4-6 méthodes ciblées : `chargerContexteImport()`,
  `importerEnLot()`).
- **Étendre `SchoolRepository`** + créer `EtablissementActivationRepository` :
  `ActiverEtablissementUseCase` (1094 l.) contient la tx géante d'activation/onboarding
  conversationnel/PEBS/LV2/coefficients → port avec méthodes par étape MAIS la tx reste UNE :
  `activerEtablissement(donneesCompletes)` côté adapter, le use case prépare les données.
  `SubjectAssignmentHelper` (partagé school+user) → méthodes du même port ou port dédié.
  `ObtenirAnomaliesEtablissement` → méthodes de lecture (classes, timetables, sessions conseil).

**Décision de scoping** : le **split fonctionnel** d'`ActiverEtablissement` et
`ImporterUtilisateurs` en sous-use cases est le chantier **2.2 (Catégorie B)** de l'audit —
il est ** volontairement découplé** de P1. Ici on ne fait que le portage (zéro changement de
logique). Le split viendra après, sur des fichiers déjà propres côté dépendances.

**Tests existants** : `VerifierMfaConnexionUseCase.test.ts` (mock prisma) → mock port.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 11.1 | Extension UserRepository (auth OTP/MFA) + refactor LoginEmailOtp, VerifierMfaConnexion | Moyenne | DeepSeek |
| 11.2 | Port import utilisateurs + refactor DesignerAP (tx) | Élevée | Claude Code |
| 11.3 | Port import utilisateurs + refactor ImporterUtilisateurs (462 l.) | Élevée | Claude Code |
| 11.4 | EtablissementActivationRepository + refactor ActiverEtablissement (1094 l.) | Très élevée | Claude Code (Tech Lead) |
| 11.5 | Refactor ConfigurerEtablissement, SubjectAssignmentHelper, ObtenirAnomalies | Moyenne | DeepSeek |

---

### VAGUE 12 — `masterAdmin/` + `eleveOnboarding/` + `assistant/` (7 fichiers) — la vague délicate (claude)

**Fichiers masterAdmin** (2) : LoginMasterUseCase (255 l.), VerifyMfaUseCase.
**Fichiers eleveOnboarding** (4) : CreerSqueletteOnboarding, RejeterOnboarding,
SoumettreFormulaireOnboarding, ValiderOnboarding (tx).
**Fichier assistant** (1) : `catalog/catalogShared.ts` (360 l.).

**Ports** :
- `MasterUserAuthRepository` : `findByEmail`, `updateOtpLogin`, `updateMfa`, `updateRecoveryCodes`,
  `changePasswordOtp` (reprendre exactement les champs du schéma MasterUser). Les use cases
  forgot-password récents en profitent directement.
- `EleveOnboardingRepository` : squelettes, soumission, validation (`ValiderOnboarding` = tx
  multi-tables création comptes élèves/parents → méthode atomique + retour des comptes à notifier).
- `AssistantCatalogQueryPort` : **changer `ActionContext`** — retirer `prisma: PrismaClient`,
  ajouter `queryPort: AssistantCatalogQueryPort`. Méthodes : `listerClasses`, `listerEnseignants`,
  `listerMatieres`, `listerEleves`, `resolveAnneeCourante`, `resolvePeriodeCourante`,
  `resolveSequenceCourante`, `notesDeLaSequence`… Impact : `AssistantController` (infra) construit
  le contexte avec le port ; les 5 catalogues consomment `ctx.queryPort` au lieu de `ctx.prisma`
  (~150 sites d'appel dans les catalogues — renommage mécanique mais volumineux).

**Tests existants** : `LoginMasterUseCase.test.ts`, `VerifyMfaUseCase.test.ts` (mocks prisma) → mocks ports.

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 12.1 | MasterUserAuthRepository + refactor 2 use cases + tests | Moyenne | Claude Code |
| 12.2 | EleveOnboardingRepository (tx validation) + refactor 4 fichiers | Élevée | Claude Code |
| 12.3 | AssistantCatalogQueryPort + changement ActionContext + 5 catalogues | Très élevée | Claude Code (Tech Lead) |
| 12.4 | AssistantController : construction du contexte + commit | Moyenne | DeepSeek |

---

### VAGUE 13 — Vérification finale + documentation (deepseek)

| Étape | Description | Difficulté | IA |
|---|---|---|---|
| 13.1 | `grep -rln "@prisma/client\|prisma\." src/application` → **0 fichier** (preuve à conserver) | Faible | — |
| 13.2 | `tsc --noEmit` clean + `bun test` 716+ pass | Faible | — |
| 13.3 | Mettre à jour `docs/AUDIT_ARCHITECTURE_HEXAGONALE.md` (P1 → ✅) + CONVENTIONS.md (règle "application ne dépend que de ports") | Faible | DeepSeek |
| 13.4 | Ajouter un garde-fou : script CI ou test qui échoue si `@prisma/client` réapparaît dans `src/application` (simple grep en test bun) | Faible | DeepSeek |

---

## 6. Dépendances

- **Inter-vagues** : la Vague 1 (shared) est un prérequis pour grade/attendance/timetable et
  simplifie messagerie/pebsExam/lv2Choice. Les vagues 2→10 sont largement indépendantes entre
  elles (modules disjoints) et peuvent être menées dans n'importe quel ordre après 1.
  La Vague 11 (user+school) doit venir après 1 (shared) car `SubjectAssignmentHelper` touche
  aux affectations. La Vague 12 en dernier (ActionContext touche l'assistant, module déjà instable).
- **Externes** : aucune migration de schéma, aucune nouvelle dépendance npm. Zéro impact frontend.
- **Vs autres chantiers de l'audit** : P2 (controllers) se nourrira des ports créés ici —
  faire P1 d'abord rend P2 plus simple. Le split des gros fichiers (audit §2.2) vient APRÈS P1.

## 7. Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Dérive de comportement lors du déplacement des requêtes | Élevée | Copie verbatim + 716 tests comme filet + revue par vague |
| Transactions cassées (atomicité perdue) | Élevée | Toute tx = UNE méthode de port ; vérifier les clausules rollback |
| God-port (répéter l'erreur ClassCouncilRepository ×20) | Moyenne | 1 port = 1 besoin métier cohérent ; découper si > ~15 méthodes |
| Régression RBAC/multi-tenant | Élevée | Les checks restent dans les use cases — jamais déplacés dans l'adapter |
| Oubli de consommateurs (helpers partagés) | Moyenne | grep exhaustif en début de chaque vague |
| Vague 12 (ActionContext) : propagation large | Moyenne | Renommage mécanique `ctx.prisma` → `ctx.queryPort`, tsc attrape tout |
| Conflits avec travaux parallèles | Faible | Commits atomiques par vague, une vague à la fois |
| Base de test vide côté adapters Prisma | Moyenne | Honnêteté : les adapters ne sont pas testés unitairement (nécessitent la DB) ; les use cases restent testés via InMemory fakes |

## 8. Critères de validation (Definition of Done)

```
1. grep -rln "@prisma/client" src/application          → 0 fichier
2. grep -rln "prisma\." src/application                → 0 fichier
3. ./node_modules/.bin/tsc --noEmit                     → clean
4. bun test                                             → ≥ 716 pass, 0 fail
5. Chaque nouveau port : interface + DTO sans type Prisma
6. Chaque tx multi-table : UNE méthode atomique du port
7. Aucun test supprimé (migrés vers mocks de ports)
8. InMemory fake créé pour chaque nouveau port
9. Bootstrap wiring à jour (aucun new XxxUseCase(prisma) restant)
10. Garde-fou CI anti-régression en place (Vague 13.4)
```

## 9. Plan de test

- **Chaque vague** : `tsc --noEmit` + `bun test` complet (716+) avant commit — zéro régression
  tolérée (AGENTS.md §4.14).
- **Tests existants migrés** : LoginMaster, VerifyMfa (×2), VerifierMfaConnexion, APEE,
  ProposerEmploiDuTemps + 4 timetable — mocks prisma → mocks ports (plus simples à maintenir).
- **Nouveaux tests** : pas exigés par vague (refactoring sans changement de comportement), mais
  chaque InMemory fake rend le module testable pour la suite.
- **Smoke manuel final** : impossible en conditions réelles (base vide, AGENTS.md §5) — la
  validation est statique (tsc + grep + tests). À documenter honnêtement.

## 10. Retour arrière (Rollback)

- Une vague = un ou plusieurs commits atomiques → `git revert` par vague.
- Aucun état persistant, aucune migration : le rollback est purement code.
- En cas de doute sur une vague : la laisser en attente, les autres vagues sont indépendantes.

---

## 11. Estimation globale

| Vague | Fichiers | Difficulté | Charge estimée |
|---|---|---|---|
| 0 Quick wins | 2 | Faible | < 1 h |
| 1 Fondations shared | ~6 | Moyenne | 1 jour |
| 2 Pilote announcement | 5 | Faible | ½ jour |
| 3 Messagerie | 11 | Moyenne | 1,5 jour |
| 4 SchoolGroup | 13 | Moyenne | 1,5 jour |
| 5 Student + lv2Choice | 12 | Moyenne | 1,5 jour |
| 6 Pebs + Entrance | 14 | Moyenne | 1,5 jour |
| 7 Matricule + PaiementMinesec | 10 | Moyenne | 1 jour |
| 8 AcademicEvent + Apee + Suivi + Discipline | 13 | Moyenne | 1,5 jour |
| 9 StatisticalCampaign | 6 | Élevée | 1 jour |
| 10 Timetable + Orientation + Examen | 9 | Élevée | 1,5 jour |
| 11 User + School | 8 | Très élevée | 3 jours |
| 12 MasterAdmin + Onboarding + Assistant | 7 | Très élevée | 2 jours |
| 13 Finalisation | — | Faible | ½ jour |

**Total : ~17-18 jours de chantier**, 20+ ports créés, ~115 fichiers refactorés.
Chaque vague est livrable indépendamment → le chantier peut s'étaler sur plusieurs sessions
sans jamais laisser le repo dans un état cassé.

---

*Prochaine étape : validation de ce plan → exécution Vague 0 + Vague 1 (fondations) dans la
session courante si accord.*