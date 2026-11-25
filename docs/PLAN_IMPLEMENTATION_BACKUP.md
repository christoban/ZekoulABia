# Plan d'implémentation — Système de sauvegarde à trois couches
### Document destiné à Claude Code — à implémenter à la lumière de l'état actuel du projet

---

## 0. Principes directeurs

Trois couches indépendantes, chacune protège contre un risque différent — ne pas en sauter une en pensant qu'une autre suffit :

| Couche | Protège contre | Délai de récupération |
|---|---|---|
| 1. Suppression douce (corbeille) | Erreur humaine du quotidien (admin supprime par erreur) | Secondes, en libre-service |
| 2. Point-in-Time Recovery (Neon) | Bug applicatif, corruption de données, mauvaise migration | Minutes, procédure admin documentée |
| 3. Export offsite indépendant | Panne/incident majeur chez Neon lui-même | Heures, restauration manuelle |

**Distinction légale à respecter partout dans ce plan** : "protéger contre la suppression accidentelle" (couches 1-3) n'est pas la même chose que "interdire toute suppression définitive". La Loi n°2024/017 (protection des données personnelles au Cameroun) donne un droit à l'effacement — une vraie suppression définitive doit rester possible, mais uniquement via une procédure formelle et encadrée, jamais comme un clic ordinaire du quotidien.

---

# COUCHE 1 — SUPPRESSION DOUCE (SOFT DELETE) + CORBEILLE

## 1.1 Modèle de données

Ajouter un champ `deletedAt` (DateTime, nullable, défaut `null`) sur **toutes les entités significatives** — pas seulement les utilisateurs :
- Élève (`StudentProfile`), Parent, Enseignant (les entités `User` et profils associés)
- Matière, Classe, et toute entité structurante du programme
- Notes, absences, et autres données académiques liées à un élève

Aucune action "supprimer" de l'application ne doit jamais déclencher un `DELETE` SQL réel. Elle se contente de renseigner `deletedAt = now()`.

## 1.2 Filtrage global obligatoire

Le filtre `deletedAt: null` sur les lectures ne doit **jamais** dépendre de la discipline de chaque développeur à chaque requête. Implémenter un middleware Prisma (ou une classe de base commune à tous les repositories de la couche domaine) qui applique ce filtre automatiquement à toute requête de lecture standard, sur toutes les entités concernées — un nouvel écran ou un nouveau use case ne doit pas pouvoir "oublier" ce filtre par erreur.

## 1.3 Écran Corbeille

- **Accès par rôle, restreint à son propre périmètre** : chaque rôle habilité (admin, censeur, professeur principal, etc.) peut voir et restaurer uniquement ce que lui-même a supprimé, dans le périmètre déjà couvert par ses permissions ailleurs dans le projet — pas une corbeille globale visible par tous. L'admin reste le seul à voir l'ensemble, cohérent avec son rôle de supervision globale déjà établi ailleurs dans le projet.
- Liste tout ce qui a `deletedAt` renseigné et pas encore purgé définitivement, filtré selon qui a effectué la suppression et le périmètre du rôle connecté.
- Bouton "Restaurer" par élément : remet `deletedAt` à `null`.
- Filtrable par type d'entité et par date de suppression.

## 1.4 Job de purge planifié — traitement différent selon le type de donnée

Un job Inngest planifié (quotidien) traite tout ce qui dépasse le délai de grâce (30 jours par défaut, configurable) — mais **pas de la même façon selon le type de donnée** :

**Données personnelles liées à une personne réelle** (Élève, Parent, Enseignant, et leurs données académiques associées — notes, bulletins, historique) : après le délai de grâce, **jamais de vrai `DELETE`** — la ligne est déplacée vers une table d'archive séparée (ex. `StudentProfileArchive`), hors des tables actives, mais conservée. Raisons combinées :
- Obligations de conservation de dossiers scolaires (relevés, historique MINESEC) sur plusieurs années.
- Capacité à répondre correctement à une future demande légale d'accès ou d'effacement (procédure formelle, section 1.5), plutôt que d'avoir déjà perdu la donnée.
- Le stockage de lignes de base de données archivées est négligeable en coût (ce n'est pas du contenu media/fichier volumineux) — conserver plusieurs années de dossiers archivés n'est pas un problème de coût ou de performance en soi.
- **Durée de rétention de l'archive** : aucune règle camerounaise spécifique trouvée pour la conservation numérique des dossiers scolaires. Point de référence le plus proche (système éducatif structurellement comparable) : l'instruction française sur les archives scolaires fixe une durée d'utilité administrative de **10 à 50 ans** pour les dossiers scolaires et bulletins (le registre matricule se garde 50 ans, pour permettre de délivrer une attestation de scolarité à un ancien élève des décennies plus tard). Vu que le coût de stockage de lignes archivées est négligeable, la recommandation retenue : **ne jamais purger automatiquement les données cœur d'un élève** (identité, scolarité, diplômes) — rétention longue par défaut, sans suppression automatique programmée, plutôt qu'un chiffre arbitraire trop court. À confirmer directement auprès du MINESEC ou d'un juriste avant de considérer ce point comme définitivement tranché — mais en attendant, mieux vaut pécher par excès de conservation (coût quasi nul) que l'inverse.

**Données structurelles non liées à une personne identifiable** (définition de matière, gabarit de classe, paramétrage) : après le délai de grâce, un vrai `DELETE` est acceptable — pas de nécessité d'archive longue durée, moins de sensibilité et moins d'obligation légale.

## 1.5 Authentification renforcée pour toute action destructive — fenêtre de grâce + gradation par gravité

**La MFA existe déjà et fonctionne dans ZekoulABia** — ce mécanisme s'appuie donc sur une fonctionnalité existante, pas à construire depuis zéro.

Plutôt qu'une ré-authentification systématique à chaque clic (friction excessive, risque de contournement par les utilisateurs), le mécanisme retenu combine deux règles :

- **Fenêtre de grâce après ré-authentification** : une ré-authentification réussie (mot de passe + MFA) ouvre une "session sensible" de quelques minutes (proposer 10 minutes par défaut, configurable) — pendant cette fenêtre, plusieurs actions destructives peuvent s'enchaîner sans ressaisie. Passé ce délai, la ré-authentification est redemandée.
- **Gradation selon la gravité** :
  - **Ré-authentification complète (mot de passe + MFA) obligatoire** pour : suppression d'un utilisateur (élève, parent, enseignant), et toute suppression en masse déclenchée via l'assistant IA.
  - **Simple confirmation classique** (pas de ressaisie mot de passe/MFA) pour : suppression d'un élément structurel isolé (ex. une matière en double, un paramétrage).

**Ce mécanisme doit être unique et partagé entre les deux chemins d'exécution** — l'action déclenchée directement depuis un écran, et l'action déclenchée via l'assistant IA (function calling). Concrètement : le use case d'exécution de l'action destructive de niveau "complet" exige un jeton de ré-authentification récent (obtenu via un flux dédié, ex. `POST /auth/reauth`, valable pendant la fenêtre de grâce) avant d'exécuter quoi que ce soit — que la demande vienne d'un clic ou d'un appel d'outil de l'assistant. L'assistant IA ne doit jamais pouvoir contourner cette exigence en exécutant l'action à la place de l'utilisateur sans que ce jeton existe.

---

# COUCHE 2 — POINT-IN-TIME RECOVERY (NEON)

## 2.1 Configuration

- Confirmer/passer sur un plan Neon payant offrant une fenêtre de rétention PITR configurable — **minimum 7 à 14 jours**, jamais rester sur les 6 heures du plan gratuit, insuffisant pour être un vrai filet de sécurité.
- Documenter cette configuration (durée choisie, coût associé) dans la documentation technique du projet.

## 2.2 Procédure de restauration (runbook)

- Rédiger une procédure documentée : qui a le droit de déclencher une restauration PITR. **Aujourd'hui, une seule personne (le fondateur) a ce niveau d'accès** — une double validation à deux personnes n'est donc pas réaliste pour l'instant. À la place : une **validation unique avec délai de réflexion obligatoire** — la demande de restauration est enregistrée, puis n'est réellement exécutable qu'après un court délai (ex. 15 minutes) ou une seconde confirmation explicite passé ce délai, pour éviter une exécution impulsive en cas d'erreur de panique. Revoir cette procédure vers une vraie double validation dès qu'une deuxième personne dispose d'un accès admin/technique suffisant.
- Privilégier, quand c'est possible, une restauration vers une **branche séparée** d'abord (pour vérifier que c'est bien l'état voulu) plutôt qu'une restauration en place immédiate sur la branche principale.
- Cette procédure reste manuelle et humaine — pas d'automatisation de déclenchement, cette couche est un recours exceptionnel, pas un mécanisme du quotidien.

---

# COUCHE 3 — EXPORT OFFSITE INDÉPENDANT

## 3.1 Job planifié nocturne

- Tâche planifiée quotidienne (Inngest, ou cron serveur dédié) qui exécute un export complet (`pg_dump`) de la base Neon.
- Export compressé avant envoi.

## 3.2 Stockage

- Envoi vers un stockage **indépendant de Neon** — Backblaze B2 ou Cloudflare R2 (compatibles S3, coût faible).
- Chiffrement de l'export au repos (les données exportées contiennent des données personnelles sensibles).

## 3.3 Rotation des exports (schéma dégressif)

Ne pas garder tous les exports indéfiniment (coût inutile) ni seulement les tout derniers (pas de profondeur historique) — rotation dégressive standard :
- Les **7 derniers exports quotidiens**.
- Les **4 dernières semaines** (un export hebdomadaire conservé, les quotidiens intermédiaires supprimés).
- Les **12 derniers mois** (un export mensuel conservé).

Un job de nettoyage applique cette règle après chaque nouvel export réussi.

---

# TÂCHES DE DÉVELOPPEMENT (ordre suggéré)

1. Ajouter `deletedAt` sur les entités concernées (migration Prisma) — personnelles et structurelles.
2. Middleware/base repository imposant le filtre `deletedAt: null` sur toutes les lectures standard.
3. Faire passer toutes les actions "supprimer" existantes de `DELETE` réel à mise à jour de `deletedAt` (audit du code existant pour repérer tout `DELETE` direct restant).
4. Créer les tables d'archive pour les entités personnelles (ex. `StudentProfileArchive`).
5. Job Inngest de purge planifiée : différencie personnelles (→ archive) vs structurelles (→ suppression réelle), délai de grâce configurable (30 jours par défaut).
6. Écran Corbeille (liste + restauration), avec RBAC cohérent avec les rôles déjà définis dans le projet.
7. Flux de ré-authentification (`POST /auth/reauth` ou équivalent) — mot de passe + MFA si actif — avec jeton court terme.
8. Brancher ce flux de ré-authentification sur : mise à la corbeille, restauration, et toute suppression en masse via l'assistant IA (function calling) — un seul mécanisme partagé, pas deux implémentations séparées.
9. Configuration Neon : vérifier/mettre à niveau le plan pour une rétention PITR de 7-14 jours minimum.
10. Rédiger le runbook de restauration PITR (accès, double validation, procédure de branche de vérification).
11. Job Inngest d'export nocturne (`pg_dump`) + upload vers B2/R2 + chiffrement.
12. Job de nettoyage appliquant la rotation dégressive (7 quotidiens / 4 hebdomadaires / 12 mensuels).
13. Tests : suppression → apparition en corbeille → restauration ; purge après délai de grâce → vérification archive (personnelles) vs suppression réelle (structurelles) ; tentative de suppression sans jeton de ré-authentification valide → refus ; suppression en masse via l'assistant IA → même exigence de ré-authentification que l'action manuelle.

---

# DEFINITION OF DONE

- Aucune action de l'application ne déclenche plus jamais un `DELETE` SQL direct sur les entités concernées — uniquement via le job de purge planifié, et selon la distinction personnelles/structurelles.
- Un admin peut restaurer un élément de la corbeille en quelques secondes.
- Toute action destructive (suppression, restauration, suppression en masse via l'IA) exige une ré-authentification (mot de passe + MFA si actif) avant exécution, quel que soit le chemin (écran ou assistant).
- La base Neon est configurée avec une rétention PITR d'au moins 7 jours, et un runbook de restauration documenté existe.
- Un export offsite indépendant tourne chaque nuit, avec la rotation dégressive appliquée automatiquement.
- Les données personnelles purgées de la corbeille sont archivées (jamais réellement supprimées) sans purge automatique programmée pour les données cœur de l'élève, sauf demande légale d'effacement traitée via une procédure séparée et documentée.
