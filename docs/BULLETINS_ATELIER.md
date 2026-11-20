# Atelier Bulletins ZekoulABia — Guide d'Exploitation & Procédure de Migration

Ce document rassemble le guide opérationnel complet du module **Bulletins & Atelier Master** et la procédure auditée de déploiement des migrations PostgreSQL (Neon / Production).

---

## Partie I — Concepts & Exploitation (Point 7)

### 1. Architecture fonctionnelle & gouvernance Master vs École

- **Atelier Master (`/master/dashboard` → onglet *Atelier Bulletins*)** : réservé à l'équipe ZekoulABia Master (`super_admin` et `platform_admin` sur toutes les écoles ; `school_manager` sur les écoles qu'il a créées ou qui lui sont assignées ; `support` en lecture/aperçu uniquement). L'atelier permet de :
  1. comparer localement la photo témoin papier d'une école (zoom client sans upload) avec l'aperçu PDF en temps réel sur un **élève fictif** (`POST /api/v2/master/bulletin-atelier/schools/:schoolId/preview-pdf`) ;
  2. configurer le **kit d'identité officielle** et les paramètres de rendu (`SchoolConfig.useMeasuredBulletinRenderer`, `bulletinTemplate`, `bulletinGroupingScheme`) ;
  3. décliner et versionner une spec (`DRAFT` ou `PUBLISHED`) ;
  4. affecter une spec publiée par école / niveau / classe / périodicité.
- **Portail Administration d'école (`/admin/dashboard` → *Bulletins*)** : accès **strictement en lecture seule** sur le calibrage officiel configuré par ZekoulABia (`GET /api/v2/report-cards/template-preview`, statut + aperçu PDF élève fictif), génération en lot (`POST /api/v2/report-cards/generate`), export ZIP individuel (`POST /api/v2/report-cards/export/:classId`), export PDF unique fusionné multi-pages (`POST /api/v2/report-cards/export-pdf/:classId`) et réédition contrôlée de duplicata (`POST /api/v2/report-cards/:id/reprint`).

---

### 2. Familles de bulletins & Specs versionnées

#### Familles disponibles dans le catalogue v1 (`backend/src/domain/templates/`)

| Famille | `specId` (`version: 1`) | Usage / Périmètre | Statut validation |
|---|---|---|---|
| **A** | `GENERAL_GROUPED_V1` | Secondaire général périodique par groupes (`SCI_LIT_OTHER` / `GROUP_1_2_3`) | Calibrée et validée visuellement |
| **B** | `TECH_GROUPED_V1` | Enseignement technique par blocs (`TECH_GEN_PRO_DIV` : Général / Professionnel / Divers, `groupRank`) | Validée sur jeu de vérité + PDF |
| **C** | `BILINGUAL_APC_V1` | Secondaire bilingue APC (compétences visées, `Eval a / Eval b`, moyenne trimestrielle) | Validée sur jeu de vérité + PDF |
| **D** | `ANNUAL_BILINGUAL_V1` | Bulletin annuel 6 séquences + moyennes trimestrielles T1/T2/T3 | Validée sur jeu de vérité + PDF |
| **E** | `EN_SECONDARY_V1` | Secondaire anglophone périodique (`EN_SECONDARY`) | **À VALIDER SUR UN BULLETIN RÉEL** (`validationNotice`) |
| **F (EN)** | `PRIMARY_POINTS_RATIO_EN_V1` | Primaire anglophone mensuel par ratio de points (`POINTS_RATIO`) | Validée sur jeu de vérité + PDF |
| **F (FR)** | `PRIMARY_POINTS_RATIO_FR_V1` | Primaire francophone mensuel par ratio de points (`POINTS_RATIO`) | **À VALIDER SUR UN BULLETIN RÉEL** (`validationNotice`) |

#### Immuabilité & persistance des versions de spec

- Les specs intégrées v1 (`PUBLISHED_CATALOG`) sont profondément gelées (`deepFreezeSpec`).
- Toute évolution créée dans l'atelier (`POST /api/v2/master/bulletin-atelier/schools/:schoolId/specs/version`) crée une nouvelle version (`nextVersion`) :
  - `publish: false` → statut **`DRAFT`** (utilisable uniquement en aperçu dans l'atelier, refusée en `400` lors d'une tentative d'affectation) ;
  - `publish: true` → statut **`PUBLISHED`** (immuable ; les versions antérieures restent inchangées).
- **Persistance PostgreSQL (`BulletinTemplateSpecRecord`)** : chaque version créée est enregistrée dans `"BulletinTemplateSpecRecord"` (`@@unique([specId, version])`). Au démarrage du serveur (`bootstrap/academic.ts`) puis à la demande (`ensureSpecHydratedFromRepository`), le catalogue en mémoire est réhydraté depuis PostgreSQL. Un bulletin scellé avec `(templateSpecId, templateVersion)` survit donc à tout redémarrage sans perte de mise en page.

---

### 3. Affectations (`BulletinTemplateAssignment`)

Résolution déterministe par ordre de priorité (`resolveEffectiveTemplateAssignment`) pour un couple `(schoolId, classId, classLevel, periodKind)` :
1. Règle active ciblant exactement `(classId, periodKind)` ;
2. Règle active ciblant `(classLevel, periodKind)` (`classId IS NULL`) — `classLevel` est validé contre les niveaux connus du curriculum et des classes de l'école (`KNOWN_CLASS_LEVELS`, jamais de texte libre arbitraire) ;
3. Règle active par défaut d'établissement pour `periodKind` (`classLevel IS NULL AND classId IS NULL`, unicité garantie par `NULLS NOT DISTINCT`) ;
4. Sinon, paramètres par défaut de `SchoolConfig` (`bulletinTemplate` et `bulletinGroupingScheme = FLAT`).

---

### 4. Kit d'identité officielle (`SchoolIdentityKit`) & Médias

- Table dédiée `SchoolIdentityKit` (1 enregistrement par école) : délégations régionales/départementales FR/EN, devise FR/EN, boîte postale, ville, téléphone, année de création, numéro d'autorisation, couleur d'accent, option `useCoatOfArms` et 5 clés d'assets (`logo`, `coatOfArms`, `stamp`, `principalSignature`, `censorSignature`).
- **Aucun texte inventé par défaut** : tout champ absent ou blanc reste omis du rendu PDF (aucune mention générique fabriquée).
- **Validation des médias (`SchoolAssetStoragePort` / `LocalAndDataUriSchoolAssetStorageAdapter`)** :
  - Signature binaire vérifiée par **magic bytes PNG/JPEG** (rejette faux formats / SVG / exécutables) ;
  - Poids maximal strict : **300 Ko** (`MAX_SCHOOL_ASSET_BYTES`) ;
  - Dimensions maximales strictes : **1200 × 1200 px** (`MAX_SCHOOL_ASSET_DIMENSION`).
- **Cache de lot (`createBatchSchoolIdentityContextCache`)** : durant une génération ou un export de classe (`sealAndStoreBulletinsForClass`, `GenererBulletinUseCase`, `streamClassReportCardsMergedPdf`), chaque asset disque/S3 n'est lu qu'**une seule fois** pour toute la classe.
- **Photos élèves** : `snapshotData` ne stocke qu'une référence (`sanitizePhotoReferenceForSnapshot`), jamais de payload Base64.

---

### 5. Schémas de regroupement & blocage `422 MATIERE_SANS_GROUPE`

- Valeur par défaut sur `SchoolConfig` : **`FLAT`** (aucun regroupement deviné silencieusement).
- Schémas supportés : `FLAT`, `GROUP_1_2_3`, `SCI_LIT_OTHER`, `TECH_GEN_PRO_DIV`, `CUSTOM`.
- Priorité de résolution par matière :
  1. `ClassSubjectOverride` (`groupKey`, `groupLabel`, `groupOrder`) ;
  2. `SubjectCoefficient` ;
  3. `Subject` ;
  4. Table de correspondance du schéma par **code matière normalisé** (jamais par libellé).
- **Garde bloquant `422 MATIERE_SANS_GROUPE`** : dès qu'au moins une matière évaluée de la classe ne correspond à aucun groupe dans un schéma non-plat, la génération échoue explicitement en **HTTP 422** en listant **toutes** les matières manquantes dans `missingSubjects` (jamais de repli silencieux vers « Autres »).

---

### 6. Heures d'absence consolidées par séquence

- Table `StudentSequenceAbsenceSummary` (`@@unique([studentId, sequenceId])`) alimentée par :
  - `GET /api/v2/attendance/sequence-hours?classId=...&sequenceId=...`
  - `POST /api/v2/attendance/sequence-hours` (permission `MANAGE_ATTENDANCE` + contrôle RBAC strict `ADMIN` / `STAFF` / Professeur Principal de la classe).
- **Règle zéro heure fabriquée** : si aucune consolidation d'absence n'existe, le snapshot enregistre `null` et le PDF affiche **`« — »`** (aucune multiplication automatique par un nombre de jours ou d'appels).

---

### 7. Vérification publique `/verify`, Duplicata & Régénération

#### Vérification publique à deux niveaux (`GET /api/v2/verify/:id`, rate-limité `publicVerifyLimiter` 30 req/min/IP, entêtes `X-Robots-Tag: noindex, nofollow, noarchive` et `Cache-Control: no-store`)
1. **Scan QR (jeton long `>= 128 bits` hexadécimal encodé dans `<PUBLIC_VERIFY_BASE_URL>/verify/<verifyToken>`)** :
   - Statut `AUTHENTIC` (`lookupMode: 'LONG_TOKEN'`) : renvoie établissement, année, période, classe, **nom masqué** (`maskStudentPublicName`), **moyenne générale**, **rang** et date d'émission pour comparaison papier — **sans notes par matière, matricule ni conduite**.
   - Statut `TAMPERED` : si le hash canonique SHA-256 du snapshot (`canonicalHashSnapshot`) diverge de `contentHash`.
   - Statut `REVOKED` : si trouvé dans `BulletinRevocationArchive` ou marqué `REVOKED`.
2. **Saisie manuelle du code court imprimé (`ZK-XXXX-XXXX`, dérivé unidirectionnellement via SHA-256)** :
   - Statut seul (`AUTHENTIC`, `REVOKED` ou `NOT_FOUND`, `lookupMode: 'SHORT_CODE'`), **sans aucun chiffre (ni moyenne ni rang)**.

#### Duplicata officiel contrôlé
- Un téléchargement normal par parent/élève/admin (`GET /api/v2/report-cards/:id/pdf`) sert le PDF stocké sans modifier `reprintCount`. Si le fichier PDF manque dans le stockage (ex. redéploiement éphémère local), il est régénéré **uniquement depuis `snapshotData` + `(templateSpecId, templateVersion)` rechargée depuis la base**, puis re-stocké.
- L'émission d'un duplicata officiel passe exclusivement par `POST /api/v2/report-cards/:id/reprint` (réservé `ADMIN` / `STAFF`, **champ `motif` obligatoire** `400` si vide) : incrémente atomiquement `reprintCount`, génère le PDF avec filigrane **`DUPLICATA n° X`** + entête HTTP `X-Reprint-Count`, et écrit une trace dans `AIActionAuditLog`.

#### Régénération contrôlée & Révocation
- `POST /api/v2/report-cards/generate` avec `{ forceRegenerate: true, motifRegeneration }` est réservé à **`ADMIN`** avec motif obligatoire.
- L'ancien bulletin est basculé à `REVOKED` et archivé de façon atomique avec son ancien `verifyToken` et son ancien `shortVerifyCode` dans `BulletinRevocationArchive` (`archiverEtRemplacerRevoque`), tandis qu'un nouveau `ReportCard` est créé avec de nouveaux jetons. L'ancien QR bascule immédiatement en `REVOKED` sur `/verify`.

---

### 8. Variables d'environnement (`backend/.env.example`)

| Variable | Rôle | Défaut / Exemple |
|---|---|---|
| `PUBLIC_VERIFY_BASE_URL` | Base URL encodée dans les QR codes `/verify/<verifyToken>` (repli sur `FRONTEND_URL` → `CLIENT_URL` → `APP_URL`) | `"https://zekoulabia.chri.app"` (local `http://localhost:3000`) |
| `TRUST_PROXY` | Lecture de la véritable IP client derrière reverse proxy (Railway/Nginx/Cloudflare) ; auto `1` si `RAILWAY_ENVIRONMENT` présent | `"1"` |
| `BULLETIN_STORAGE_DRIVER` | Adaptateur de stockage PDF (`local` ou `s3`) | `"local"` (dev) / `"s3"` (prod) |
| `BULLETIN_PDF_STORAGE_DIR` | Dossier disque local si `BULLETIN_STORAGE_DRIVER="local"` | `"./storage/bulletins"` |
| `BULLETIN_S3_BUCKET` | Bucket objet compatible S3 (ou fallback `R2_BUCKET_NAME`) | — |
| `BULLETIN_S3_ENDPOINT` | Endpoint S3/R2 (ou fallback `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`) | — |
| `BULLETIN_S3_REGION` | Région S3 | `"auto"` |
| `BULLETIN_S3_ACCESS_KEY_ID` | Clé d'accès S3 (ou fallback `R2_ACCESS_KEY_ID`) | — |
| `BULLETIN_S3_SECRET_ACCESS_KEY` | Clé secrète S3 (ou fallback `R2_SECRET_ACCESS_KEY`) | — |
| `BULLETIN_S3_PREFIX` | Préfixe des clés objets PDF | `"bulletins"` |

---

### 9. Limites connues & Évolutions recommandées

- **Plafond d'export synchrone par classe (`MAX_SYNC_CLASS_EXPORT_STUDENTS = 80`)** : `POST /api/v2/report-cards/export-pdf/:classId` et `POST /api/v2/report-cards/export/:classId` retournent **`422 CLASS_EXPORT_LIMIT_EXCEEDED`** au-delà de 80 bulletins dans une même classe afin de préserver la mémoire et le timeout HTTP.
  - *Evolution proposée si des classes dépassent 80 élèves* : déclencher un job asynchrone Inngest `reportcard/export-batch` écrivant l'archive ZIP ou le PDF fusionné sur `BulletinPdfStoragePort` (`S3`), avec table/suivi de progression (`BackgroundTask` / polling) et lien de téléchargement temporaire.
- **Rate limit sur calculs PDF lourds (`heavyPdfExportLimiter`)** : limité à **15 requêtes par fenêtre de 5 minutes** par IP sur `GET /template-preview`, `POST /export-pdf/:classId`, `POST /export/:classId` et `POST /master/bulletin-atelier/schools/:schoolId/preview-pdf` (`429 RATE_LIMITED_PDF_EXPORT`).
- **Specs à valider sur bulletins papier réels** : `EN_SECONDARY_V1` et `PRIMARY_POINTS_RATIO_FR_V1` portent `validationNotice: "À VALIDER SUR UN BULLETIN RÉEL"` en pied de spécimen.
- **Seed local de démonstration** : `cd backend && bun scripts/seed-bulletin-atelier-demo.ts` crée une école complète (`3ème A Démo`, 3 élèves fictifs, notes `LOCKED`, conseil `LOCKED`, kit d'identité) pour démonstrations et tests manuels.

---

## Partie II — Audit des Migrations & Procédure de Déploiement Neon/Production (Point 6)

### 1. Inventaire ordonné des migrations sur `feat/bulletins-atelier`

| Ordre | Migration | Ce qu'elle fait | Risque / Précaution PostgreSQL |
|---|---|---|---|
| **1** | `20261118211200_bulletin_snapshot_v2_etape2` | Ajoute `REVOKED` à `"ReportCardStatus"`, colonnes snapshot v2 sur `"ReportCard"` et `"ReportCardSubjectLine"`, met à jour `"ReportCard"."computationVersion" = 1` pour l'existant, crée `"BulletinRevocationArchive"` + index unique `"ReportCard_verifyToken_key"`. | **1) `ALTER TYPE "ReportCardStatus" ADD VALUE 'REVOKED'` :** ajout d'enum irréversible en PostgreSQL sans recréation du type. **2) `UPDATE "ReportCard" SET "computationVersion" = 1` :** **UPDATE de masse** verrouillant les lignes existantes de `"ReportCard"` pendant la migration (rapide si volumétrie faible, à planifier hors pic sinon). |
| **2** | `20261119104200_bulletin_etape4_assignments_and_grouping` | Crée enums `"BulletinGroupingScheme"` et `"BulletinPeriodKind"`, ajoute `bulletinGroupingScheme` (défaut `FLAT`) et `useMeasuredBulletinRenderer` (défaut `false`) à `"SchoolConfig"`, `templateSpecId` sur `"ReportCard"` / `"BulletinRevocationArchive"`, crée `"BulletinTemplateAssignment"` + index unique `NULLS NOT DISTINCT`. | **`CREATE UNIQUE INDEX ... NULLS NOT DISTINCT` :** **exige impérativement PostgreSQL 15 ou supérieur** (erreur de syntaxe bloquante sur PostgreSQL <= 14). Migration strictement additive. |
| **3** | `20261119133000_bulletin_etape4bis_sequence_absence_hours` | Crée `"StudentSequenceAbsenceSummary"` (`justifiedHours`, `unjustifiedHours`, `consignesCount`) et index unique `(studentId, sequenceId)`. | Migration strictement additive (nouvelle table, aucun `DROP` ni verrou sur table existante hors métadonnées FK). |
| **4** | `20261119140000_bulletin_etape5_school_identity_kit` | Crée `"SchoolIdentityKit"`, ajoute `shortVerifyCode` + index uniques/lookup sur `"ReportCard"` et `"BulletinRevocationArchive"`. | Migration strictement additive (`ADD COLUMN IF NOT EXISTS`). |
| **5** | `20261120050000_bulletin_etape8_template_spec_versions` | Crée `"BulletinTemplateSpecRecord"` (`@@unique([specId, version])`, `specJson` JSONB) pour persister brouillons et specs publiées hors RAM. | Migration strictement additive. |

---

### 2. Procédure de déploiement recommandée (Sauvegarde → Branche Neon → Production)

> **Règle absolue** : ne jamais utiliser `prisma db push` ni `prisma migrate dev` en production ou sur un environnement partagé. Utiliser exclusivement `prisma migrate deploy`.

1. **Vérifications préalables sur l'instance PostgreSQL cible** :
   - Vérifier que la version du serveur est **>= 15.0** (obligatoire pour `NULLS NOT DISTINCT`) :
     ```sql
     SELECT version();
     ```
   - Mesurer la taille de `"ReportCard"` avant l'`UPDATE` de masse de la migration 1 :
     ```sql
     SELECT count(*), pg_size_pretty(pg_total_relation_size('"ReportCard"')) FROM "ReportCard";
     ```

2. **Sauvegarde préalable (Snapshot + Dump logique)** :
   - Créer un point de restauration instantané côté Neon (Console Neon / CLI) avant toute opération ;
   - Effectuer un dump logique hors ligne de sécurité :
     ```bash
     pg_dump "$PROD_DATABASE_URL" --format=custom --no-owner --no-acl -f "backup-avant-bulletins-atelier-$(date +%Y%m%d-%H%M%S).dump"
     ```

3. **Test à blanc sur une branche Neon isolée** :
   ```bash
   # 1. Créer une branche éphémère depuis main/production
   neon branches create --project-id "$NEON_PROJECT_ID" --name "dry-run-bulletins-atelier"

   # 2. Récupérer la chaîne de connexion de cette branche
   BRANCH_URL=$(neon connection-string "dry-run-bulletins-atelier" --project-id "$NEON_PROJECT_ID")

   # 3. Appliquer les migrations en conditions réelles
   cd backend
   DATABASE_URL="$BRANCH_URL" ./node_modules/.bin/prisma migrate deploy
   DATABASE_URL="$BRANCH_URL" ./node_modules/.bin/prisma migrate status

   # 4. Vérifier que NULLS NOT DISTINCT et les colonnes existent bien
   psql "$BRANCH_URL" -c "\d \"BulletinTemplateAssignment\"" -c "\d \"BulletinTemplateSpecRecord\""

   # 5. Supprimer la branche éphémère une fois validée
   neon branches delete "dry-run-bulletins-atelier" --project-id "$NEON_PROJECT_ID"
   ```

4. **Application en production (fenêtre calme recommandée)** :
   - Définir les variables d'environnement requises (`PUBLIC_VERIFY_BASE_URL`, `TRUST_PROXY=1`, `BULLETIN_STORAGE_DRIVER=s3` + identifiants S3/R2).
   - Appliquer les migrations :
     ```bash
     cd backend
     DATABASE_URL="$PROD_DATABASE_URL" ./node_modules/.bin/prisma migrate deploy
     DATABASE_URL="$PROD_DATABASE_URL" ./node_modules/.bin/prisma migrate status
     ```
   - Redémarrer le backend et vérifier le log de démarrage (`bootstrap/academic.ts` hydrate `BulletinTemplateSpecRecord` sans erreur).
   - Conserver le drapeau `SchoolConfig.useMeasuredBulletinRenderer = false` par défaut tant que chaque école cible n'a pas été calibrée et prévisualisée dans l'Atelier Master.
