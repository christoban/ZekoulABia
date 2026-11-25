# Configuration — Export offsite chiffré (Couche 3)

### `PLAN_IMPLEMENTATION_BACKUP.md`, Couche 3 — protège contre une panne chez Neon lui-même

Le code est en place (`backend/src/inngest/backupOffsiteJob.ts`, cron quotidien 01h00) mais reste
**inactif tant que les étapes ci-dessous n'ont pas été faites** — aucune d'elles ne peut être
faite depuis le code, ce sont des actions sur des dashboards externes.

## 1. Créer le bucket Cloudflare R2

1. Dashboard Cloudflare → R2 → **Create bucket**. Nom suggéré : `zekoulabia-db-exports`.
2. Noter l'**Account ID** (visible dans l'URL du dashboard ou la page R2 elle-même).
3. R2 → **Manage R2 API tokens** → créer un token avec permission **Object Read & Write**,
   scopé au bucket créé à l'étape 1 (pas un accès compte entier).
4. Noter l'**Access Key ID** et la **Secret Access Key** générés — la clé secrète ne sera plus
   jamais réaffichée après cette étape, la copier immédiatement dans un gestionnaire de mots de
   passe.

## 2. Générer la clé de chiffrement

Depuis un terminal (une seule fois, jamais régénérée ensuite sans perdre l'accès aux exports déjà
envoyés) :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copier la sortie (une chaîne base64) — c'est `BACKUP_ENCRYPTION_KEY`. **La perdre rend tous les
exports déjà envoyés vers R2 définitivement illisibles.** La conserver dans un gestionnaire de
mots de passe séparé de l'environnement de déploiement (jamais uniquement dans les variables
d'environnement Railway/autre — si cet environnement est perdu, la clé l'est aussi).

## 3. Variables d'environnement à ajouter (production)

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=zekoulabia-db-exports
BACKUP_ENCRYPTION_KEY=...
```

Ajouter ces 5 variables dans l'environnement de production (Railway ou équivalent) — jamais dans
un fichier commité au repo.

## 4. Vérification après mise en place

Le job tourne chaque nuit à 01h00 (avant `BackupSchoolDataJob` à 03h00 et `purgerCorbeille` à
04h00 — pas de chevauchement). Pour vérifier manuellement sans attendre :

- Déclencher le job depuis le dashboard Inngest (`export-offsite-nocturne`), ou attendre la
  prochaine exécution planifiée.
- Vérifier dans le dashboard R2 qu'un objet `db-exports/AAAA-MM-JJ.dump.enc` est apparu.
- La rotation dégressive (7 quotidiens / 4 hebdomadaires / 12 mensuels) s'applique automatiquement
  après chaque export réussi — rien à faire manuellement.

## Restaurer depuis un export offsite (en dernier recours)

Cette couche est un recours pour une panne chez Neon lui-même — pas la procédure normale
(voir `RUNBOOK_RESTAURATION_PITR.md` pour un incident applicatif classique). Pour déchiffrer et
restaurer un export :

1. Télécharger l'objet chiffré depuis R2 (dashboard, ou script utilisant
   `telechargerObjet()` de `OffsiteBackupStorage.ts`).
2. Déchiffrer avec `dechiffrerBuffer()` de `backupEncryption.ts` (même `BACKUP_ENCRYPTION_KEY`).
3. Le fichier obtenu est un dump au format custom PostgreSQL (`pg_dump --format=custom`) —
   restaurer avec `pg_restore --dbname=<nouvelle_base> fichier.dump`, jamais directement sur la
   production sans vérification préalable sur une base séparée (même principe que la Couche 2 :
   vérifier avant de basculer, pas de restauration en place à l'aveugle).
