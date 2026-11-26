# Guide base de données locale — ZekoulABia

> Guide opérationnel pour initialiser, rafraîchir et tester les bases PostgreSQL locales (`zekoulabia_dev` et `zekoulabia_test`) sur Fedora Linux, sans jamais écrire sur la production Neon.

---

## 1. Principes de sécurité

- **Production Neon = LECTURE SEULE** : uniquement `pg_dump` et requêtes `SELECT` / `COUNT`. Jamais de `prisma migrate`, `seed`, `bun test` ni d'écriture contre Neon.
- **Jamais d'URL de production dans le dépôt** : `backend/.env` et `backend/.env.test` sont ignorés par git (`backend/.gitignore`) et ne doivent contenir que des URLs `localhost:5432`.
- **Dumps hors dépôt, droits stricts** : stocker les fichiers `.dump` dans `~/sauvegardes-zekoulabia` (`chmod 700` sur le dossier, `chmod 600` sur chaque `.dump`).
- **Services externes neutralisés en local** : vider dans `backend/.env` `RESEND_API_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `TECHSOFT_API_KEY`, `GROQ_API_KEY`, `CAMPAY_TOKEN`, `CAMPAY_USERNAME`, `CAMPAY_PASSWORD`, `CAMPAY_APP_ID`, `R2_*` et `VAPID_*`. Garder `INNGEST_DEV="1"`, `FILE_STORAGE_DRIVER="local"` et `CAMPAY_BASE_URL="https://demo.campay.net/api"`.

---

## 2. Création des rôles et bases locales (installation initiale)

Prérequis : PostgreSQL local actif (`systemctl is-active postgresql`), version client/serveur majeure **≥** à celle de Neon (PostgreSQL 18.x).

```bash
DEV_PASS=$(openssl rand -hex 24)
TEST_PASS=$(openssl rand -hex 24)

# Créer les deux rôles dédiés (avec CREATEDB pour les bases shadow Prisma) et les deux bases
PGPASSWORD='<mot_de_passe_postgres_local>' psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE zekoulabia_dev  LOGIN CREATEDB PASSWORD '${DEV_PASS}';
CREATE ROLE zekoulabia_test LOGIN CREATEDB PASSWORD '${TEST_PASS}';
CREATE DATABASE zekoulabia_dev  OWNER zekoulabia_dev;
CREATE DATABASE zekoulabia_test OWNER zekoulabia_test;
SQL

PGPASSWORD='<mot_de_passe_postgres_local>' psql -h 127.0.0.1 -U postgres -d zekoulabia_dev  -c "ALTER SCHEMA public OWNER TO zekoulabia_dev;"
PGPASSWORD='<mot_de_passe_postgres_local>' psql -h 127.0.0.1 -U postgres -d zekoulabia_test -c "ALTER SCHEMA public OWNER TO zekoulabia_test;"
```

Mettre ensuite les URLs locales dans :
- `backend/.env` : `DATABASE_URL="postgresql://zekoulabia_dev:<DEV_PASS>@localhost:5432/zekoulabia_dev?schema=public"` (`chmod 600 backend/.env`)
- `backend/.env.test` : `DATABASE_URL="postgresql://zekoulabia_test:<TEST_PASS>@localhost:5432/zekoulabia_test?schema=public"` (`chmod 600 backend/.env.test`)

---

## 3. Initialiser ou réinitialiser la base de test (`zekoulabia_test`)

```bash
cd backend
set -a && source .env.test && set +a
# Vérification : doit afficher localhost et zekoulabia_test
echo "$DATABASE_URL" | sed -E 's|(://[^:]+:)[^@]+@|\1***@|'

npx prisma migrate deploy
npx prisma db seed
```

---

## 4. Cloner ou rafraîchir `zekoulabia_dev` depuis Neon (lecture seule)

Exporter d'abord l'URL **directe (non poolée)** de Neon en mémoire uniquement (jamais dans un fichier du dépôt) :

```bash
export NEON_DATABASE_URL_DIRECT='postgresql://neondb_owner:<MOT_DE_PASSE>@ep-<hote>.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

### 4.1 Dump depuis Neon (lecture seule)
```bash
mkdir -p -m 700 ~/sauvegardes-zekoulabia
DUMP_FILE=~/sauvegardes-zekoulabia/neon-prod-$(date +%Y%m%d-%H%M%S).dump

pg_dump --format=custom --no-owner --no-privileges \
  --dbname="$NEON_DATABASE_URL_DIRECT" \
  --file="$DUMP_FILE"
chmod 600 "$DUMP_FILE"
```

### 4.2 Restauration propre dans `zekoulabia_dev`
```bash
# Construire l'URL libpq locale (sans ?schema=public) et vérifier localhost + zekoulabia_dev
LOCAL_DEV_URL=$(python3 - <<'PY'
import re
from urllib.parse import urlparse, urlunparse
m = re.search(r'^DATABASE_URL="?([^"\n]+)"?', open("backend/.env").read(), re.M)
u = urlparse(m.group(1))
assert u.hostname in ("localhost", "127.0.0.1") and u.path.lstrip("/") == "zekoulabia_dev"
print(urlunparse((u.scheme, u.netloc, u.path, "", "", "")))
PY
)

# Réinitialiser le schéma public de la base locale uniquement
psql "$LOCAL_DEV_URL" -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION zekoulabia_dev;"

# Restaurer en filtrant uniquement l'option pg_attver spécifique à Neon PG 18.7 (inconnue de PG 18.6 local)
pg_restore --no-owner --no-privileges -f - "$DUMP_FILE" \
  | grep -vE '^ALTER TABLE ONLY .+ ALTER COLUMN .+ SET \(pg_attver=[0-9]+\);$' \
  | psql "$LOCAL_DEV_URL" -v ON_ERROR_STOP=1 --quiet

# Vérifier que l'envoi sortant en base est bien désactivé localement
psql "$LOCAL_DEV_URL" -c 'SELECT id, "outboundMessagingEnabled" FROM public."PlatformSettings";'
# Si 't', désactiver en local :
# psql "$LOCAL_DEV_URL" -c 'UPDATE public."PlatformSettings" SET "outboundMessagingEnabled" = false;'
```

### 4.3 Vérification post-restauration
```bash
cd backend
set -a && source .env && set +a
npx prisma migrate status
```
*(Si une nouvelle migration locale n'est pas encore déployée sur Neon, `prisma migrate status` l'indiquera ; ne l'appliquer sur `zekoulabia_dev` qu'en connaissance de cause.)*

---

## 5. Commandes de test et démarrage local

```bash
# Vérification TypeScript
cd backend && ./node_modules/.bin/tsc --noEmit

# Garde-fou architectural + tests unitaires
cd backend && bun test tests/unit/architectureGuard.test.ts
cd backend && bun test tests/unit/domain/rules/
cd backend && bun test tests/unit/application/masterAdmin/

# Test d'intégration DB (contre zekoulabia_test uniquement)
cd backend && bun test --env-file .env.test tests/integration/db/officialProgressionMigration.integration.test.ts

# Démarrer le serveur backend contre zekoulabia_dev
cd backend && bun run dev
# Sonde de santé :
curl -s http://localhost:5000/api/v2/health
```

---

## 6. Gestion sécurisée des dumps (chiffrement / suppression)

Les dumps contiennent des données personnelles (élèves, parents, enseignants).

- **Chiffrer un dump avant archivage** :
  ```bash
  gpg --symmetric --cipher-algo AES256 ~/sauvegardes-zekoulabia/neon-prod-*.dump
  chmod 600 ~/sauvegardes-zekoulabia/neon-prod-*.dump.gpg
  shred -u ~/sauvegardes-zekoulabia/neon-prod-*.dump
  ```
- **Supprimer immédiatement après restauration** :
  ```bash
  shred -u ~/sauvegardes-zekoulabia/neon-prod-*.dump
  # (sur SSD/Btrfs, rm -f suffit si le disque est chiffré par LUKS)
  ```

---

## 7. Pièges rencontrés et solutions

1. **`pg_attver` inconnu lors de `pg_restore` (Neon PG 18.7 → local PG 18.6)** : Neon 18.7 inscrit des options internes `ALTER TABLE ONLY ... ALTER COLUMN ... SET (pg_attver=...);` dans `pg_attribute.attoptions` (223 occurrences). PostgreSQL 18.6 standard les rejette. Filtrer exactement ces lignes via `grep -vE` (après avoir vérifié qu'aucune n'est combinée avec une autre option) permet une restauration `ON_ERROR_STOP=1` à 0 erreur et 100 % fidèle.
2. **Paramètre `?schema=public` de Prisma** : `psql` et `pg_restore` (libpq) rejettent `?schema=public` dans une URI. Retirer la query string avant d'appeler `psql`/`pg_restore`.
3. **Connexion Neon directe obligatoire** : toujours utiliser l'hôte direct (non poolé) avec `sslmode=require&channel_binding=require` (attention aux fautes de frappe sur `require`).
4. **Rôles Neon (`neondb_owner`, `neon_superuser`)** : toujours utiliser `--no-owner --no-privileges` sur `pg_dump` et `pg_restore`.
5. **Mode test des envois sortants** : `PlatformSettings.outboundMessagingEnabled` est stocké en base et ne bloque pas `MASTER_SECURITY_EMAIL_EVENTS` (`EmailService.ts`). Vider impérativement `RESEND_API_KEY`, `SMTP_*` et `TECHSOFT_API_KEY` dans `backend/.env`.
