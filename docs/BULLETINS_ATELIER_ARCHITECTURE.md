# Atelier de Bulletins — Règles d'architecture (Points 6 & 7)

Ce document consigne les spécifications actées à la clôture de l'Étape 2 avant le démarrage de l'Étape 3.

---

## 1. Point 6 — Exigence obligatoire pour l'Étape 5 : vérification publique `/verify` sur bulletin révoqué

État actuel inspecté :
- Backend : `StudentDocumentController.verifyDocument` (`GET /api/v2/verify/:documentId`, `backend/src/infrastructure/http/controllers/StudentDocumentController.ts:274-315`) interroge uniquement `ReportCard` par `id` et renvoie systématiquement `authentic: true` s'il le trouve.
- Frontend : `frontend/src/app/verify/[id]/page.tsx` affiche le badge authentique dès que `res.ok && json.success`.

Règle impérative pour l'Étape 5 (Sceau QR révocable & duplicata) :
1. Le endpoint public `GET /api/v2/verify/:tokenOrId` doit accepter le `verifyToken` aléatoire (et assurer la rétrocompatibilité par `id` avec contrôle de jeton si présent), puis vérifier **dans l'ordre** :
   - La table `BulletinRevocationArchive` (par `verifyToken` ou `originalReportCardId`) ;
   - Le champ `ReportCard.validationStatus === 'REVOKED'` et l'intégrité du `contentHash`.
2. **Interdiction absolue de renvoyer `authentic: true` sur un bulletin révoqué ou remplacé** :
   - Si le document correspond à un bulletin révoqué/archivé (`REVOKED`), l'API doit retourner `authentic: false`, `status: 'REVOKED'`, `revokedAt`, `revocationReason` (ou mention publique neutre) et `message: 'Bulletin révoqué ou remplacé'`.
   - La page `/verify/[id]` doit afficher un bandeau d'alerte rouge/orange **« Bulletin révoqué ou remplacé — document non valide »** (jamais « Document authentique »).

---

## 2. Point 7 — Priorité de résolution des groupes & état des templates curriculum

### 2.1 Ordre de priorité de résolution (`resolveCurriculumSubjectConfig`)

Implémenté dans `backend/src/domain/services/bulletin/bulletinSnapshotMath.ts` (`resolveCurriculumSubjectConfig`, lignes 23–52) et appelé par `construireEtEnrichirSnapshotsClasse` (`backend/src/application/reportCard/bulletinSnapshotEnricher.ts`) :

1. **`ClassSubjectOverride`** (surcharge spécifique à la classe : `groupKey`, `groupLabel`, `groupOrder`, `coefficient`) ;
2. **`SubjectCoefficient`** (paramétrage partagé par niveau et série dans l'école : `groupKey`, `groupLabel`, `groupOrder`, `coefficient`) ;
3. **`Subject`** (valeurs par défaut de la matière au niveau de l'école : `groupKey`, `groupLabel`, `groupOrder`, `coefficient`) ;
4. **Repli automatique métier** (si aucun `groupKey` n'est défini aux niveaux 1–3) :
   - Établissement `TECHNICAL` ou `PROFESSIONAL` :
     - matière `PRACTICAL` ou `MIXED` $\rightarrow$ `{ groupKey: 'PROFESSIONNEL', groupLabel: 'Enseignement Professionnel', groupOrder: 2 }` ;
     - autre matière (`THEORETICAL`) $\rightarrow$ `{ groupKey: 'GENERAL', groupLabel: 'Enseignement Général', groupOrder: 1 }`.
   - Tous les autres cas : `{ groupKey: 'DEFAULT', groupLabel: 'Matières', groupOrder: 99 }`.

Le snapshot scellé (`snapshotData` + `ReportCardSubjectLine`) reçoit une **copie figée** de `{ groupKey, groupLabel, groupOrder }` au moment de la génération : une modification ultérieure du curriculum n'altère jamais les bulletins déjà émis.

### 2.2 Stratégie de regroupement des curricula statiques (post-Étape 4)

Pour respecter le défaut `SchoolConfig.bulletinGroupingScheme = 'FLAT'` (aucun regroupement deviné silencieusement) et permettre à l'Atelier Master de basculer librement un établissement entre `GROUP_1_2_3`, `SCI_LIT_OTHER`, `TECH_GEN_PRO_DIV` ou `FLAT`, le seed des curricula ne force **pas** `SubjectCoefficient.groupKey` (qui court-circuiterait le schéma en priorité 2).

À la place, les codes matières dérivés par `deriveSubjectCodeFromName` (`backend/src/domain/services/bulletin/bulletinGroupingSchemes.ts`, sans collision d'accents sur `ECM` / `EAC` / `EPS`) sont résolus en priorité 4 par `resolveGroupBySubjectCode` :

| Fichier curriculum | Templates concernés | État actuel du regroupement |
|---|---|---|
| `francophone/premier-cycle.ts` | `LYCEE_FR`, `CES_FR`, `PRIVE_FR`, `LYCEE_BILINGUE`, `COMPLEXE_SCOLAIRE` (6e → 3e) | **Couvert à 100 %** par `GROUP_1_2_3` et `SCI_LIT_OTHER` via `deriveSubjectCodeFromName` (testé dans `bulletinCurriculumGroupingCoverage.test.ts`) |
| `francophone/deuxieme-cycle-bac.ts` | `__ALL__` (2nde → Tle, séries `A1`–`A5`, `ABI`, `C`, `D`, `E`, `TI`, `SH`, `AC`) | **Couvert à 100 %** par `GROUP_1_2_3` et `SCI_LIT_OTHER` (séries `E`, `TI`, `SH`, `AC` incluses) |
| `francophone/technique.ts` | `LYCEE_TECHNIQUE_FR`, `CETIC`, `SAR_SM`, `CFM` | **Couvert à 100 %** par `TECH_GEN_PRO_DIV` sur les 3 blocs (`GENERAL`, `PROFESSIONNEL`, `DIVERS`) |
| `francophone/primaire.ts` & `primaire-apc.ts` | `PRIMAIRE_FR`, `MATERNELLE_FR`, `COMPLEXE_SCOLAIRE` | Rendu **`FLAT`** / regroupement par domaine APC (Famille F `groupByDomain: true`) — aucun `groupKey` requis |
| `anglophone/secondary.ts` & `primary.ts` | `GHS_EN`, `GSS_EN`, `PRIVE_EN`, `PRIMARY_EN`, `NURSERY_EN`, `PRIMARY_BILINGUAL` | Rendu **`FLAT`** par défaut (Familles E & F) — surcharges possibles par école si besoin |

