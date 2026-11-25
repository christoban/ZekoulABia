# Runbook — Restauration Point-in-Time Recovery (Neon)

### Couche 2 du système de sauvegarde à trois couches (`PLAN_IMPLEMENTATION_BACKUP.md`)

Protège contre : bug applicatif, corruption de données, mauvaise migration. Ne protège **pas**
contre une panne chez Neon lui-même (voir Couche 3, export offsite indépendant) ni contre une
erreur humaine isolée du quotidien (voir Couche 1, corbeille — plus rapide et en libre-service
pour ce cas-là, ne pas utiliser le PITR pour restaurer un seul élément supprimé par erreur).

---

## ⚠️ État actuel — action requise avant que cette couche soit un vrai filet de sécurité

**Vérifié le 2026-08-02 : le projet est sur le plan gratuit Neon, rétention PITR = 6 heures.**
C'est très en dessous du minimum recommandé par le plan (7 à 14 jours). Avec 6h de fenêtre, un
problème découvert le lendemain d'un incident est déjà irrécupérable par cette couche.

**Avant de considérer cette couche comme opérationnelle** :
1. Passer sur un plan Neon payant offrant une fenêtre de rétention PITR configurable.
2. Choisir une rétention d'au moins 7 jours (14 jours si le coût le permet — plus de marge pour
   détecter un problème qui ne saute pas aux yeux immédiatement, ex. une migration qui corrompt
   des données silencieusement sur plusieurs jours).
3. Mettre à jour cette section avec la durée réellement choisie et son coût mensuel, une fois fait :

> **Rétention PITR actuelle : _(à renseigner après la mise à niveau)_**
> **Coût mensuel : _(à renseigner)_**
> **Date de mise à niveau : _(à renseigner)_**

---

## Qui peut déclencher une restauration

**Aujourd'hui, une seule personne (le fondateur) a l'accès nécessaire au dashboard Neon.** Une
double validation à deux personnes n'est donc pas réaliste pour l'instant — la procédure ci-dessous
compense par un délai de réflexion obligatoire plutôt qu'un deuxième regard humain.

**Dès qu'une deuxième personne dispose d'un accès admin/technique suffisant au projet**, cette
procédure doit être revue vers une vraie double validation (une personne déclenche, une autre
confirme avant exécution réelle) — ne pas continuer à opérer en solo par habitude une fois que
ce n'est plus la seule option.

## Quand utiliser cette procédure (et quand ne pas l'utiliser)

**Utiliser le PITR pour** :
- Une migration de base de données qui s'est mal passée et a corrompu des données à grande échelle.
- Un bug applicatif qui a écrit des données incorrectes sur plusieurs lignes/tables, découvert
  après coup.
- Une suppression en masse accidentelle qui dépasse ce que la Corbeille (Couche 1) peut couvrir
  (ex. un script mal ciblé qui a fait de vrais `DELETE`, hors du chemin normal de l'application).

**Ne PAS utiliser le PITR pour** :
- Un seul élément supprimé par erreur (élève, classe, matière) → utiliser la Corbeille
  (`/api/v2/corbeille` côté admin), restauration en quelques secondes, sans reculer toute la base.
- Un problème qui ne touche qu'une école alors que d'autres écoles ont eu des écritures légitimes
  entre-temps → une restauration PITR recule **toute la base**, pas une école isolée ; réfléchir
  d'abord à une correction ciblée avant d'envisager un recul global.

## Procédure

### 1. Enregistrer la demande (délai de réflexion obligatoire)

Avant toute exécution réelle, noter par écrit (message à soi-même, ticket, ou simple note datée) :
- Quel est le problème exact observé.
- Le point dans le temps visé pour la restauration (date/heure précise).
- L'heure à laquelle cette demande est enregistrée.

**Attendre au moins 15 minutes** après cette étape avant de passer à l'exécution — ou, si le délai
n'est pas tenable (incident actif), obtenir une seconde confirmation explicite de soi-même après
avoir relu la demande à froid. Ce délai sert uniquement à éviter une exécution impulsive en
pleine panique — ce n'est pas une formalité à contourner.

### 2. Restaurer vers une branche séparée d'abord (jamais directement en place si évitable)

Neon permet de créer une **branche** à un point dans le temps donné, séparée de la branche
principale (`main`/production) :

1. Dashboard Neon → projet → onglet **Branches** → **Create branch**.
2. Choisir **"Time travel"** / point-in-time, préciser la date/heure cible (celle notée à l'étape 1).
3. Nommer la branche clairement, ex. `restore-verif-2026-08-02`.
4. Une fois créée, se connecter à cette branche avec un client Postgres (`psql`, DBeaver, ou
   temporairement pointer une instance backend locale dessus via `DATABASE_URL`) et **vérifier
   que c'est bien l'état voulu** — les données attendues sont présentes, le problème identifié a
   bien disparu à ce point dans le temps.

### 3. Basculer en production uniquement après vérification

Seulement après avoir confirmé sur la branche de vérification que c'est le bon état :

- **Option A (recommandée)** — Promouvoir la branche vérifiée en branche principale via le
  dashboard Neon (« Set as default » / procédure de promotion de branche Neon), puis mettre à
  jour `DATABASE_URL` si l'identifiant de connexion a changé.
- **Option B** — Si Neon propose une restauration en place directe (« Restore » sur la branche
  `main` elle-même), ne l'utiliser que si l'option A n'est pas disponible pour ce plan — une
  restauration en place est irréversible immédiatement, sans étape de vérification préalable
  possible sur les données réelles de production.

### 4. Après restauration

- Vérifier que l'application redémarre et fonctionne normalement (santé de l'API, connexion DB).
- Supprimer la branche de vérification temporaire une fois la promotion confirmée stable (garder
  quelques jours si un doute subsiste, pas indéfiniment — coût de stockage Neon par branche).
- Noter dans le même endroit que l'étape 1 : l'heure de fin, le résultat, et toute donnée écrite
  légitimement entre l'incident et la restauration qui serait maintenant perdue (à communiquer si
  pertinent — ex. un paiement enregistré par une école entre-temps).

## Ce que cette procédure ne couvre pas (rappel)

Reste **manuelle et humaine** — pas d'automatisation de déclenchement, cette couche est un recours
exceptionnel, pas un mécanisme du quotidien. Rien dans cette procédure ne doit être scripté pour
s'exécuter automatiquement sans une décision humaine à chaque étape.
