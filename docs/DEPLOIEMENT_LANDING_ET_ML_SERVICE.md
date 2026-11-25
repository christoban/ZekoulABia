# Déploiement — site marketing (`landing/`) et microservice OCR (`ml-service/`)

Document de référence à consulter le jour où tu es prêt à déployer ces deux morceaux. Rien
d'urgent : tant que ça n'est pas fait, `frontend/` continue de servir la landing page comme
avant, et `ml-service` reste optionnel (dégradation gracieuse déjà prévue dans le code — voir
`DocumentAiOrchestrator.ts`).

---

## 0. Vue d'ensemble — ce qu'on construit au final

Aujourd'hui, tout tourne en un seul bloc. La cible :

```
zekoulabia.com          →  landing/    (nouveau projet Vercel séparé)
app.zekoulabia.com      →  frontend/   (le projet existant, inchangé)

Projet Railway "ZekoulABia" (celui du backend, déjà existant)
 ├── Service "backend"       ← déjà là
 └── Service "ml-service"    ← nouveau service, ajouté dans LE MÊME projet
```

Deux hébergeurs différents pour deux raisons différentes, pas par accident :

- **`landing/` va sur Vercel**, comme `frontend/` — c'est un site Next.js léger, sans process
  qui doit rester allumé en continu. Vercel est fait pour ça.
- **`ml-service` va sur Railway, dans le MÊME projet que le backend** — pas sur Vercel — parce
  que (a) c'est un service Python qui garde un modèle OCR chargé en mémoire entre les appels
  (incompatible avec le modèle "serverless, redémarre à chaque requête" de Vercel), et (b) ton
  backend Express tourne déjà avec Socket.io (connexions WebSocket persistantes), donc il vit
  déjà sur un hébergeur à process long-vivant type Railway — `ml-service` doit être à côté de
  lui, pas ailleurs.

---

## 1. Déployer `landing/` sur Vercel

### 1.1 Créer le projet

1. Sur [vercel.com](https://vercel.com), **"Add New..." → "Project"**.
2. Importer le même repo GitHub que `frontend/`.
3. Dans les réglages du projet AVANT le premier déploiement (ou après, dans Settings) :
   **"Root Directory" → `landing`**. C'est le réglage le plus important — sans lui, Vercel
   essaie de builder depuis la racine du repo et échoue (ou build le mauvais dossier).
4. Framework Preset : Vercel doit détecter **Next.js** automatiquement une fois le Root
   Directory réglé sur `landing`.

### 1.2 Variable d'environnement

Dans Settings → Environment Variables du projet `landing` :

| Nom | Valeur | Note |
|---|---|---|
| `BACKEND_URL` | l'URL réelle de ton backend en production (ex. celle de ton service Railway) | Utilisée UNIQUEMENT côté serveur par le proxy `next.config.ts` (`rewrites`) — jamais exposée au navigateur. Sans elle, `landing/next.config.ts` retombe sur `http://localhost:5000`, qui ne marchera pas en production. |

### 1.3 Domaine

Dans Settings → Domains du projet `landing` : ajoute `zekoulabia.com` (et `www.zekoulabia.com`
si tu veux les deux). Vercel affiche les enregistrements DNS exacts à créer chez ton registrar
(généralement un enregistrement `A` ou `CNAME` selon le cas).

### 1.4 Vérification

- Le build doit afficher `✓ Compiled successfully` (déjà testé en local dans ce chantier —
  build de production réussi avant ce document).
- Une fois en ligne : ouvre le site, clique "Demander une démo", remplis le formulaire, envoie.
  Si `BACKEND_URL` est mal configuré, la requête échouera avec un message d'erreur visible dans
  le formulaire (`DemoModal.tsx` affiche le message d'erreur retourné) — pas un échec silencieux.

---

## 2. Déployer `ml-service` sur Railway

### 2.1 Fichiers déjà en place dans le repo (rien à faire ici, juste pour comprendre)

- **`ml-service/railway.json`** — dit à Railway comment lancer le service :
  ```json
  {
    "$schema": "https://railway.app/railway.schema.json",
    "build": { "builder": "NIXPACKS" },
    "deploy": { "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT" }
  }
  ```
  `--host 0.0.0.0` (pas `127.0.0.1`, sinon Railway ne peut pas router le trafic vers le
  service) et `--port $PORT` (Railway assigne le port dynamiquement, jamais 8001 en dur comme
  en local).

- **`ml-service/.python-version`** — contient `3.12`, pour figer la même version Python que
  celle testée en local avec succès (`paddlepaddle 3.3.1` + `paddleocr 3.7.0`). Sans ce
  fichier, Nixpacks (le système de build de Railway) utilise Python 3.11 par défaut — non
  testé pour ce projet, à éviter par prudence (paddlepaddle distribue des paquets pré-compilés
  spécifiques à chaque version de Python).

### 2.2 Créer le nouveau service — DANS LE PROJET EXISTANT, pas un nouveau projet

Railway isole son réseau privé **par projet** — deux projets séparés ne peuvent pas se parler
en interne. Il faut donc ajouter `ml-service` comme un service de plus dans le projet où vit
déjà le backend, jamais dans un projet à part.

1. Ouvre ton projet Railway existant (celui du backend) — tu arrives sur le "canvas" (vue avec
   des boîtes, une par service).
2. En haut à droite, clique **"New"** (ou raccourci **Ctrl+K** → tape "new service").
3. Choisis **"GitHub Repo"** dans le menu de sources proposées (les autres options sont
   "Database", "Docker Image", "Empty Service" — pas celles-là).
4. Sélectionne le même repo GitHub que celui déjà utilisé par ton service backend.
5. Railway crée une nouvelle boîte sur le canvas. **Renomme-la `ml-service`** (clique sur le
   nom en haut de la boîte de service) — ce nom sert directement à construire l'adresse interne
   utilisée à l'étape 2.5, donc autant que ce soit explicite.

### 2.3 Dire à Railway où trouver le code (Root Directory)

1. Clique sur le service `ml-service` fraîchement créé.
2. Onglet **"Settings"** → section **"Source"** → champ **"Root Directory"**.
3. Tape `ml-service`.
4. Sauvegarde.

À partir de là, Railway ne regarde QUE ce qui est dans `ml-service/` pour ce service — même
logique que le Root Directory réglé sur `landing` pour Vercel (section 1.1).

### 2.4 Vérifier la commande de lancement

Grâce à `railway.json` (déjà dans le repo, voir 2.1), Railway devrait automatiquement :
- Détecter un projet Python (présence de `requirements.txt`) → utiliser **Nixpacks**.
- Installer les dépendances : `pip install -r requirements.txt` — ça inclut `paddlepaddle` et
  `paddleocr`. **Le tout premier build sera lent** (plusieurs minutes), à cause du poids de
  `paddlepaddle` (~500 Mo). Les builds suivants seront plus rapides (cache).
- Lancer avec la commande du `railway.json`.

**Vérification à faire** : Settings → section "Deploy" → champ "Start Command" — ça doit déjà
afficher `uvicorn main:app --host 0.0.0.0 --port $PORT`, repris automatiquement du
`railway.json`. Si le champ est vide, colle la commande manuellement.

**Ne configure PAS de domaine public** pour ce service (section "Networking" → "Public
Networking" doit rester désactivé) — c'est un outil purement interne, jamais censé être
joignable depuis internet.

### 2.5 Relier les deux services (la partie la plus importante)

Railway donne **automatiquement** à chaque service une variable `RAILWAY_PRIVATE_DOMAIN` —
l'adresse interne de ce service précis, sans rien à configurer pour l'obtenir.

1. Va sur ton service **backend** (pas `ml-service` — l'autre boîte).
2. Onglet **"Variables"**.
3. Ajoute une nouvelle variable, nom : `ML_SERVICE_URL`.
4. Dans le champ valeur, tape `${{` — Railway ouvre une liste déroulante avec autocomplétion,
   listant tous les services du projet (dont `ml-service`) et leurs variables disponibles.
5. Sélectionne `ml-service` puis `RAILWAY_PRIVATE_DOMAIN`. Le champ se remplit avec :
   ```
   ${{ml-service.RAILWAY_PRIVATE_DOMAIN}}
   ```
6. Complète manuellement pour obtenir :
   ```
   http://${{ml-service.RAILWAY_PRIVATE_DOMAIN}}
   ```
   En `http://`, jamais `https://` — le trafic interne est déjà chiffré par le réseau privé de
   Railway (Wireguard), `https` ajouterait juste de la latence pour rien.
7. Sauvegarde. Railway redéploie automatiquement le backend avec cette variable disponible.

**Aucune modification de code nécessaire** — le backend lit déjà cette variable :
```ts
// DocumentAiOrchestrator.ts et TabPfnPredictionService.ts
process.env.ML_SERVICE_URL ?? process.env.TABPFN_SERVICE_URL ?? 'http://localhost:8001'
```

### 2.6 Vérifier que ça marche

1. Regarde les **logs de build** de `ml-service` (onglet "Deployments") — patiente le temps de
   l'installation de `paddlepaddle`/`paddleocr`.
2. Une fois déployé, le statut doit être vert ("Success"/"Active"), pas rouge.
3. Dans les **logs runtime** (clique sur le déploiement actif), tu dois voir une ligne du type
   `Uvicorn running on http://0.0.0.0:XXXX`.
4. Test réel : déclenche une action côté backend qui appelle `ml-service` (un scan de document
   — diplôme RH, liste de candidats, cahier de textes). Si `ML_SERVICE_URL` est mal configuré,
   l'orchestrateur bascule silencieusement sur le modèle vision (dégradation gracieuse déjà
   prévue, pas de crash) — regarde les logs backend pour un message
   `[Orchestrateur] Service OCR indisponible` qui indiquerait un problème de connexion.

### 2.7 Point de vigilance connu (signalé par la doc Railway elle-même)

Des utilisateurs ont rapporté que les variables de référence (`${{service.RAILWAY_PRIVATE_DOMAIN}}`)
ne se résolvent pas toujours correctement du premier coup, de façon intermittente. Si
`ML_SERVICE_URL` semble vide ou ne fonctionne pas après avoir suivi les étapes ci-dessus, le
contournement le plus rapporté : **supprime la variable puis recrée-la** (au lieu de juste la
modifier).

---

## 3. Checklist récapitulative

- [ ] `landing/` : projet Vercel créé, Root Directory = `landing`, `BACKEND_URL` configurée,
      domaine `zekoulabia.com` ajouté et DNS mis à jour chez le registrar.
- [ ] `landing/` : build réussi, formulaire "Demander une démo" testé en vrai (soumission
      réussie, pas seulement l'affichage de la page).
- [ ] `ml-service` : nouveau service créé **dans le projet Railway existant** (pas un nouveau
      projet), Root Directory = `ml-service`.
- [ ] `ml-service` : build réussi malgré le poids de `paddlepaddle` (patience sur le premier
      build), logs runtime confirmant `Uvicorn running on http://0.0.0.0:XXXX`.
- [ ] `ml-service` : aucun domaine public configuré (reste interne).
- [ ] Backend : variable `ML_SERVICE_URL` = `http://${{ml-service.RAILWAY_PRIVATE_DOMAIN}}`
      ajoutée et résolue correctement (pas vide).
- [ ] Test de bout en bout : un scan de document réel (diplôme, liste, cahier) passe par l'OCR
      sans basculer sur le fallback vision (confirmé via les logs backend).
- [ ] `app.zekoulabia.com` : DNS pointé vers le projet `frontend/` existant, une fois les deux
      autres étapes validées.

---

## Sources consultées (août 2026)

- [Vercel — Root Directory / Monorepos](https://vercel.com/docs/monorepos)
- [Railway — Deploying a Monorepo](https://docs.railway.com/deployments/monorepo)
- [Railway — Networking / Private Networking](https://docs.railway.com/networking/private-networking)
- [Railway — How Private Networking Works](https://docs.railway.com/networking/private-networking/how-it-works)
- [Railway — Variables Reference](https://docs.railway.com/variables/reference)
- [Nixpacks — Python provider](https://nixpacks.com/docs/providers/python)
- [Railway Central Station — problème connu de résolution de variables de référence](https://station.railway.com/questions/internal-variable-references-completely-dd15e295)
