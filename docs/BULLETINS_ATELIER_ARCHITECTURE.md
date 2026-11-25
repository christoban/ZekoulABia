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

### 2.2 Templates dont les groupes curriculum sont encore vides

Dans `backend/src/application/school/curriculum/`, les ensembles suivants ne définissent pas encore de groupes structurés (`groupKey / groupLabel / groupOrder`) propagés en base lors du seed :

| Fichier curriculum | Templates concernés | État actuel des groupes |
|---|---|---|
| `francophone/premier-cycle.ts` | `LYCEE_FR`, `CES_FR`, `PRIVE_FR`, `LYCEE_BILINGUE`, `COMPLEXE_SCOLAIRE` (6e → 3e) | **Vide** (aucun champ groupe ; repli sur `DEFAULT` « Matières ») |
| `francophone/deuxieme-cycle-bac.ts` | `__ALL__` (2nde → Tle, séries `A1`–`A5`, `ABI`, `C`, `D`, `E`, `TI`, `SH`, `AC`) | Champ numérique `groupe: 1 \| 2` présent en TypeScript, **non encore mappé** vers `groupKey / groupLabel / groupOrder` dans `SubjectCoefficient` lors de l'activation école |
| `francophone/technique.ts` | `LYCEE_TECHNIQUE_FR`, `CETIC`, `SAR_SM`, `CFM` | **Vide** dans le fichier statique (repli automatique à 2 blocs `GENERAL` / `PROFESSIONNEL` seulement ; le 3e groupe *« Divers »* n'est pas encore défini) |
| `francophone/primaire.ts` & `primaire-apc.ts` | `PRIMAIRE_FR`, `MATERNELLE_FR`, `COMPLEXE_SCOLAIRE` | **Vide** (aucun `groupKey` sur les matières ou domaines APC) |
| `anglophone/secondary.ts` | `GHS_EN`, `GSS_EN`, `PRIVE_EN`, `LYCEE_BILINGUE` (Form 1 → Upper Sixth) | **Vide** (aucun `groupKey`) |
| `anglophone/primary.ts` | `PRIMARY_EN`, `NURSERY_EN`, `PRIMARY_BILINGUAL` (Nursery → Class 6) | **Vide** (aucun `groupKey`) |

