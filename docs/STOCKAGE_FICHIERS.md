# Stockage de fichiers unifié — ZEKOULABIA (`FileStoragePort`)

> **Port unique de stockage** : `backend/src/domain/ports/services/FileStoragePort.ts`
> **Adaptateurs** : `LocalDiskFileStorage` (`driver=local`) et `S3CompatibleFileStorage` (`driver=s3`)
> **Fabrique de démarrage** : `backend/src/infrastructure/services/storage/createFileStorageAdapter.ts`
> **Validation & politiques par domaine** : `backend/src/domain/services/storage/fileStorageValidation.ts`

---

## 1. Principes d'architecture et de sécurité

1. **Un seul port de stockage** dans tout le backend (`FileStoragePort`) : `put`, `get`, `exists`, `delete`. Les anciens stockages temporaires du chantier bulletins (`BulletinPdfStoragePort` et `SchoolAssetStoragePort`) ont été absorbés.
2. **Aucune URL publique** : aucun fichier n'est servi directement depuis un répertoire statique ou un bucket public. Chaque lecture passe par un endpoint Express authentifié qui vérifie le JWT, l'isolation multi-tenant (`schoolId`) et le rôle RBAC, puis répond avec `X-Content-Type-Options: nosniff`.
3. **Isolation multi-tenant stricte** : toute clé commence obligatoirement par `{schoolId}/{domaine}/...`. Toute tentative d'accès à une clé d'un autre établissement ou de traversée de chemin (`..`, `/`, `\`, caractère nul) lève une `FileStorageValidationError` (`TENANT_ISOLATION_VIOLATION` → HTTP `403`, `PATH_TRAVERSAL` → rejet immédiat).
4. **Noms générés (UUID ou hash SHA-256)** : le nom de fichier fourni par l'utilisateur n'apparaît jamais dans la clé de stockage ; il est assaini et conservé uniquement dans `metadata.originalName`.
5. **Validation par octets magiques (magic bytes)** : l'extension déclarée et le `Content-Type` HTTP ne suffisent jamais ; chaque téléversement est contrôlé sur sa signature binaire réelle, son extension compatible et sa taille maximale par domaine (et dimensions maximales pour le kit d'identité).
6. **Résilience sur fichiers perdus** : un chemin disque hérité d'avant la migration (disque éphémère Railway) ou un objet absent renvoie toujours un **HTTP `404` JSON propre** (jamais d'erreur `500`), sauf pour les bulletins scellés qui sont **régénérés à la demande depuis `snapshotData` + spec figée** puis re-stockés automatiquement.

---

## 2. Drivers disponibles et variables d'environnement

Le choix du fournisseur de production reste libre : aucun fournisseur cloud n'est codé en dur.

### 2.1 Driver `local` (`LocalDiskFileStorage`)

- **Usage** : développement local, tests, ou **VPS avec volume disque persistant monté hors conteneur**.
- Stocke les binaires sous `${FILE_STORAGE_LOCAL_DIR}/{schoolId}/{domaine}/...` et les métadonnées associées dans un fichier sidecar JSON sous `${FILE_STORAGE_LOCAL_DIR}/.metadata/{cle}.json`.
- **Avertissement automatique au démarrage** : si `NODE_ENV=production`, `FILE_STORAGE_DRIVER=local` et `FILE_STORAGE_PERSISTENT_VOLUME !== "true"`, le serveur journalise un avertissement explicite indiquant un risque de perte de fichiers au redéploiement.

### 2.2 Driver `s3` (`S3CompatibleFileStorage`)

- **Usage** : tout stockage objet compatible S3 (**Cloudflare R2**, **MinIO auto-hébergé sur VPS**, **Scaleway Object Storage**, **AWS S3**, **Backblaze B2**, etc.) via `@aws-sdk/client-s3`.
- Les métadonnées accentuées sont encodées en `encodeURIComponent` / `decodeURIComponent` pour rester compatibles avec les en-têtes HTTP S3.

### 2.3 Variables d'environnement (`backend/.env.example`)

| Variable | Obligatoire | Défaut | Rôle |
|---|---|---|---|
| `FILE_STORAGE_DRIVER` | Non | `local` | Driver actif : `local` ou `s3`. |
| `FILE_STORAGE_LOCAL_DIR` | Non (`local`) | `./storage/files` | Répertoire racine sur disque (ex. `/var/lib/zekoulabia/files` sur VPS). |
| `FILE_STORAGE_PERSISTENT_VOLUME` | Recommandé en prod (`local`) | `false` | Mettre à `true` uniquement si `FILE_STORAGE_LOCAL_DIR` pointe vers un volume persistant sauvegardé. |
| `FILE_STORAGE_S3_BUCKET` | Oui (`s3`) | — | Nom du bucket S3-compatible. |
| `FILE_STORAGE_S3_ENDPOINT` | Selon fournisseur (`s3`) | — | Endpoint personnalisé (requis pour R2, MinIO, Scaleway, B2 ; optionnel pour AWS S3). |
| `FILE_STORAGE_S3_REGION` | Non (`s3`) | `auto` | Région S3 (`auto` pour R2, `fr-par` pour Scaleway, `us-east-1` pour MinIO, etc.). |
| `FILE_STORAGE_S3_ACCESS_KEY_ID` | Oui (`s3`) | — | Clé d'accès S3. |
| `FILE_STORAGE_S3_SECRET_ACCESS_KEY` | Oui (`s3`) | — | Clé secrète S3. |
| `FILE_STORAGE_S3_PREFIX` | Non (`s3`) | `""` | Préfixe optionnel dans le bucket (ex. `prod`). |
| `FILE_STORAGE_S3_FORCE_PATH_STYLE` | Non (`s3`) | `false` | Mettre à `true` pour MinIO auto-hébergé sans sous-domaine bucket. |

---

## 3. Convention de clés et politiques par domaine

| Domaine | Format de clé | Taille max | Formats autorisés (magic bytes) | Endpoint authentifié / usage |
|---|---|---|---|---|
| `babillard` | `{schoolId}/babillard/{uuid}.{ext}` | 10 Mo | PDF, PNG, JPEG, WebP | `POST /api/v2/babillard/pieces-jointes`, `GET /api/v2/babillard/:id/pieces-jointes/:pjId` |
| `enrollment-pieces` | `{schoolId}/enrollment-pieces/{uuid}.{ext}` | 5 Mo | PDF, PNG, JPEG, WebP | `POST/GET /api/v2/eleve-onboarding/:id/pieces/:code/(upload\|file)` |
| `apee-justificatifs` | `{schoolId}/apee-justificatifs/{uuid}.{ext}` | 8 Mo | PDF, PNG, JPEG | `POST/GET /api/v2/apee/transactions/:id/justificatif` |
| `hr-documents` | `{schoolId}/hr-documents/{uuid}.{ext}` | 8 Mo | PDF, PNG, JPEG | `POST /api/v2/hr-self-service/me/document`, `GET .../document/:index/download` |
| `student-photos` | `{schoolId}/student-photos/{uuid\|sha256_32}.{ext}` | 3 Mo | PNG, JPEG, WebP | `PATCH /api/v2/students/:id/official-photo`, `GET /api/v2/students/:id/photo`, cartes scolaires & bulletins PDF |
| `school-assets` | `{schoolId}/school-assets/{kind}-{sha256_12}.{png\|jpg}` | 300 Ko | PNG, JPEG (`<= 1200×1200 px`) | `POST /api/v2/master/bulletin-atelier/schools/:schoolId/identity-kit/assets/:assetType`, rendu bulletins |
| `bulletins` | `{schoolId}/bulletins/{periodId}/{bulletinId}_v{v}.pdf` | 15 Mo | PDF | Bulletins scellés (`ReportCard.pdfUrl`), export ZIP/PDF classe |
| `statistical-submissions` | `{schoolId}/statistical-submissions/{uuid}.{xls\|xlsx}` | 25 Mo | XLS (OLE2), XLSX (OOXML) | `POST /api/v2/statistical-campaign/generer`, `GET .../submissions/:id/download` |
| `minedub-reports` | `{schoolId}/minedub-reports/{uuid}.pdf` | 10 Mo | PDF | `POST /api/v2/statistical-campaign-minedub/generer`, `GET .../reports/:id/download` |
| `school-backups` | `{schoolId}/school-backups/{uuid}.json` + `manifest.json` | 50 Mo | JSON | Job Inngest `BackupSchoolDataJob`, `GET /api/v2/school/last-backup`, `GET /api/v2/master/backup/list` |

> **Note `ReportCard.pdfUrl`** : la colonne n'est pas supprimée ; elle contient soit la **clé réelle** `{schoolId}/bulletins/{periodId}/{bulletinId}_v{v}.pdf` lorsqu'un PDF scellé est persisté dans `FileStoragePort`, soit `null` (aucune chaîne fictive n'est plus générée).

---

## 4. Rétrocompatibilité et scripts de migration Base64

- **Photos d'élèves (`StudentProfile.photoUrl`)** et **kit d'identité (`SchoolIdentityKit.*AssetKey`)** :
  - Toute valeur existante commençant par `data:image/` continue d'être lue et servie normalement (HTTP + rendu PDF cartes scolaires et bulletins).
  - Les nouveaux téléversements écrivent uniquement dans `FileStoragePort` et n'enregistrent plus que la clé en base.
- **Scripts de migration disponibles** (exécutables **uniquement sur la base locale** — refus automatique si `DATABASE_URL` pointe hors `localhost` / `127.0.0.1` / `::1`) :
  ```bash
  # 1. Photos d'élèves (dry-run par défaut, aucune écriture)
  cd backend
  bun run src/scripts/migrateStudentPhotosToStorage.ts
  bun run src/scripts/migrateStudentPhotosToStorage.ts --apply --copy-only   # copie + relecture SHA-256 sans modifier la DB
  bun run src/scripts/migrateStudentPhotosToStorage.ts --apply               # copie + relecture SHA-256 + mise à jour photoUrl

  # 2. Médias du kit d'identité (dry-run par défaut, aucune écriture)
  bun run src/scripts/migrateSchoolAssetsToStorage.ts
  bun run src/scripts/migrateSchoolAssetsToStorage.ts --apply --copy-only
  bun run src/scripts/migrateSchoolAssetsToStorage.ts --apply
  ```
- **Garanties** : idempotents (clés déterministes SHA-256, ignorent les lignes déjà migrées), journalisés en JSON structuré, **relecture + comparaison SHA-256 octet par octet obligatoire avant toute écriture en base**, aucune suppression de colonne ni d'objet existant.

---

## 5. Procédure de sauvegarde (CRITIQUE)

> **AVERTISSEMENT EXPLICITE** :
> **Les fichiers stockés avec le driver `local` NE SONT PAS couverts par les sauvegardes de la base de données PostgreSQL** (ni par le PITR Neon, ni par `pg_dump`, ni par l'export JSON `SchoolBackupService`).
> En cas de panne disque VPS ou de suppression du volume sans sauvegarde dédiée du répertoire `FILE_STORAGE_LOCAL_DIR`, **toutes les pièces jointes, photos élèves, justificatifs APEE, documents RH et logos seraient définitivement perdus** (seuls les bulletins PDF scellés disposant d'un `snapshotData` peuvent être régénérés automatiquement).

### Stratégie recommandée selon le driver choisi

1. **Si `FILE_STORAGE_DRIVER=local` sur VPS** :
   - Monter `FILE_STORAGE_LOCAL_DIR` sur un volume dédié (ex. `/var/lib/zekoulabia/files`, hors du dossier déployé de l'application).
   - Mettre en place une **synchronisation quotidienne chiffrée hors-site** (ex. `rclone sync` ou `restic backup` vers un stockage objet distant ou un second serveur, avec rétention 30 jours + test de restauration mensuel).
   - Inclure **à la fois** les fichiers binaires **et** le sous-répertoire `.metadata/` (qui porte les noms de fichiers d'origine et types MIME).
   - Activer les snapshots automatiques du fournisseur VPS en complément (ne remplace pas la copie hors-site).
2. **Si `FILE_STORAGE_DRIVER=s3`** :
   - Activer le **versioning** sur le bucket (protection contre suppression/écrasement accidentel).
   - Configurer une **politique de cycle de vie** (ex. expiration des anciennes versions non courantes après 30–90 jours) et, idéalement, une réplication/copie chiffrée vers une seconde région ou un second compte.
   - Restreindre la clé IAM aux seules permissions nécessaires sur le bucket (`PutObject`, `GetObject`, `HeadObject`, `DeleteObject`).

---

## 6. Checklist de mise en production sur VPS

### Option A — VPS avec disque persistant (`FILE_STORAGE_DRIVER=local`)

- [ ] Provisionner un volume persistant monté sur `/var/lib/zekoulabia/files` (en dehors du répertoire applicatif et du conteneur Docker).
- [ ] Vérifier les droits POSIX (`chown` sur l'utilisateur applicatif, `chmod 750 /var/lib/zekoulabia/files`).
- [ ] Configurer les variables d'environnement :
  ```env
  NODE_ENV=production
  FILE_STORAGE_DRIVER=local
  FILE_STORAGE_LOCAL_DIR=/var/lib/zekoulabia/files
  FILE_STORAGE_PERSISTENT_VOLUME=true
  ```
- [ ] Vérifier dans les logs de démarrage : `[FileStorage] Driver actif : local (répertoire=/var/lib/zekoulabia/files)` **sans** avertissement de volume éphémère.
- [ ] Mettre en place la tâche cron de sauvegarde hors-site (`restic` / `rclone`) + alerte d'espace disque (> 80 %).
- [ ] Exécuter un test complet (upload + téléchargement Babillard, photo élève + carte scolaire PDF, bulletin scellé) puis redémarrer le service/conteneur et vérifier que les fichiers sont toujours lisibles.

### Option B — Stockage objet S3-compatible (`FILE_STORAGE_DRIVER=s3`)

- [ ] Créer un bucket **privé** (accès public bloqué) et une paire de clés dédiée à l'environnement de production.
- [ ] Activer le versioning sur le bucket.
- [ ] Configurer les variables `FILE_STORAGE_DRIVER=s3` et `FILE_STORAGE_S3_*` dans le gestionnaire de secrets du serveur.
- [ ] Vérifier dans les logs de démarrage : `[FileStorage] Driver actif : s3 (bucket=..., prefix=...)`.
- [ ] Effectuer un test de bout en bout (upload + lecture + téléchargement PDF) et vérifier dans la console objet que les clés suivent bien `{schoolId}/{domaine}/...`.

### Audit préalable des références héritées en base (lecture seule)

Avant la bascule définitive, exécuter sur la base de données pour mesurer d'éventuelles références disque héritées (qui répondront proprement en `404` si les fichiers ont disparu sur Railway) :

```sql
SELECT 'StudentProfile.photoUrl (data:)' AS source, COUNT(*) FROM "StudentProfile" WHERE "photoUrl" LIKE 'data:%'
UNION ALL
SELECT 'SchoolIdentityKit (data:)', COUNT(*) FROM "SchoolIdentityKit"
 WHERE "logoAssetKey" LIKE 'data:%' OR "coatOfArmsAssetKey" LIKE 'data:%'
    OR "stampAssetKey" LIKE 'data:%' OR "principalSignatureAssetKey" LIKE 'data:%'
    OR "censorSignatureAssetKey" LIKE 'data:%'
UNION ALL
SELECT 'EnrollmentDocument (legacy path)', COUNT(*) FROM "EnrollmentDocument" WHERE "fileKey" LIKE '/%' OR "fileKey" LIKE 'storage/%'
UNION ALL
SELECT 'APEETransaction (legacy path)', COUNT(*) FROM "APEETransaction" WHERE "justificatifUrl" LIKE '/%' OR "justificatifUrl" LIKE 'storage/%'
UNION ALL
SELECT 'StatisticalSubmission (legacy path)', COUNT(*) FROM "StatisticalSubmission" WHERE "filePath" LIKE '/%' OR "filePath" LIKE 'storage/%'
UNION ALL
SELECT 'MinedubReport (legacy path)', COUNT(*) FROM "MinedubReport" WHERE "filePath" LIKE '/%' OR "filePath" LIKE 'storage/%';
```

---

## 7. Procédure de restauration

### 7.1 Restauration complète (`driver=local`)

1. Stopper le processus backend (évite toute écriture concurrente pendant la restauration).
2. Restaurer d'abord la base PostgreSQL à la date cible (voir [RUNBOOK_RESTAURATION_PITR.md](RUNBOOK_RESTAURATION_PITR.md)).
3. Restaurer le répertoire `FILE_STORAGE_LOCAL_DIR` (y compris `.metadata/`) depuis la sauvegarde `restic` / `rclone` la plus proche du point PITR :
   ```bash
   # Exemple avec restic
   restic restore latest --target / --include /var/lib/zekoulabia/files
   chown -R zekoulabia:zekoulabia /var/lib/zekoulabia/files
   chmod 750 /var/lib/zekoulabia/files
   ```
4. Redémarrer le backend et vérifier un téléchargement authentifié sur un fichier restauré (`Babillard`, `photo élève`, `APEE`).

### 7.2 Restauration complète (`driver=s3`)

1. Si un objet a été supprimé ou écrasé par erreur : restaurer la version précédente dans le bucket versionné (ou supprimer le *delete marker*).
2. En cas de perte totale de bucket : recréer le bucket privé, restaurer depuis la copie hors-site/réplique vers le même `FILE_STORAGE_S3_PREFIX`, mettre à jour les variables `FILE_STORAGE_S3_*` si le nom change, puis redémarrer le backend.

### 7.3 Cas particulier des bulletins PDF scellés

Même si le stockage des PDF scellés (`{schoolId}/bulletins/...`) est intégralement vidé, **aucun bulletin scellé n'est perdu** tant que PostgreSQL contient `ReportCard.snapshotData`, `templateSpecId` et `templateVersion` : au premier téléchargement, `getOrRegenerateSealedBulletinPdf` régénère automatiquement le PDF à l'identique depuis le snapshot figé (jamais depuis les données vivantes) et le re-stocke dans `FileStoragePort`.

---

## 8. Plan de retour arrière (Rollback)

- Le driver `local` reste disponible et activable à tout moment par simple changement de `FILE_STORAGE_DRIVER=local`.
- La lecture des photos élèves et médias du kit d'identité stockés en `data:image/...` reste 100 % rétrocompatible.
- Aucune colonne SQL ni aucune donnée existante n'a été supprimée durant le chantier.
