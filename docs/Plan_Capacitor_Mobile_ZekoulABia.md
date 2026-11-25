# PLAN — Empaquetage mobile natif (Capacitor) : offline-first + push natif avec son personnalisé

> Document de référence, écrit AVANT le démarrage du chantier, pour s'y référer le moment venu.
> Statut au moment de la rédaction : **non démarré**, `@capacitor/*` absent de `frontend/package.json`, aucun déploiement public (frontend/backend) trouvé.
> Priorités actées avec l'utilisateur (à ne pas dévier) : **offline-first = priorité absolue**, **push natif avec son personnalisé = objectif tout aussi ferme**. Les deux sont compatibles, mais ensemble ils imposent une architecture précise (détaillée ci-dessous) — ne pas partir sur l'option "WebView pointée sur le site en ligne", qui casserait l'offline-first.

---

## 1. Objectif et non-objectif

**Objectif** : empaqueter l'app existante (Android + iOS) via Capacitor pour obtenir :
1. Une app qui reste **pleinement utilisable hors connexion** (déjà largement le cas en PWA, voir État des lieux) — priorité absolue, ne jamais régresser dessus.
2. Des **notifications push natives** (FCM/APNs) avec **son personnalisé**, actuellement bloquées par la limite du Web Push standard (voir `ARCHITECTURE.md` §8 ADR-10, `FEATURES.md` §12).
3. Présence App Store / Play Store (découvrabilité, installation propre côté iPhone en particulier).

**Non-objectif** : ne jamais forcer l'installation de l'app. Le web (PWA) doit rester utilisable sans rien installer — règle produit déjà actée dans `ARCHITECTURE.md` (fracture numérique, téléphones d'entrée de gamme). Prévoir un bandeau discret et fermable, jamais un blocage.

---

## 2. État des lieux — ce qui existe DÉJÀ (à ne pas refaire)

L'app a une base offline-first bien plus avancée qu'un simple cache de lecture. Inventaire vérifié en juillet/août 2026 :

### 2.1 Lecture avec cache (stale-while-revalidate)
- `frontend/src/lib/offline/db.ts` — base IndexedDB via **Dexie** (`ZekoulABiaDB`), table `cachedData` (clé, données, horodatage).
- `frontend/src/hooks/useCachedFetch.ts` — hook générique : en ligne, fetch + réécrit le cache ; hors ligne (ou erreur réseau), sert le cache local. Retourne `fromCache`/`cachedAt` pour affichage.
- Déjà utilisé par plusieurs sections (ex. `SectionStudentHealthTracking.tsx`) et par les pré-chargements au montage des dashboards (parent/élève — voir `page.tsx` de chaque rôle, blocs `db.cachedData.put(...)`).

### 2.2 Écriture en file d'attente (queue de synchronisation)
- `frontend/src/lib/offline/db.ts` — table `pendingActions` : type d'action, payload, endpoint, méthode HTTP, statut (`PENDING`/`SYNCING`/`FAILED`), horodatage.
- Types d'actions déjà couverts par le typage : `ATTENDANCE`, `GRADE`, `CAHIER_DE_TEXTE_CREATE`, `APPRECIATION_PP`, `DISCIPLINE_SANCTION`, `DISCIPLINE_SANCTION_LIFT`, `APEE_TRANSACTION`, `LIBRARY_BOOK_CREATE`, `LIBRARY_BOOK_UPDATE`, `TEACHER_ASSIGNMENT`, `TIMETABLE_GRID_CONFIG`, `PEDAGOGY_PROGRAM`, `ORIENTATION_RECORD`.
- `frontend/src/hooks/useSyncQueue.ts` — `addToQueue()` (mise en attente), `syncQueue()` (rejoue les actions `PENDING` dès le retour en ligne, marque `FAILED` si l'appel échoue, supprime si succès).
- Consommé notamment par `SectionCahierDeTexte.tsx` (enseignant) et affiché par `SectionOfflineStatus.tsx`.
- `frontend/src/components/OfflineIndicator.tsx` — indicateur visuel global d'état de connexion.

### 2.3 PWA / Service Worker
- `frontend/worker/index.js` — Service Worker : gère déjà le Web Push (`showNotification`, `silent: false`).
- `@ducanh2912/next-pwa` déjà configuré dans `next.config.ts`.
- Manifest PWA déjà présent (installation "Ajouter à l'écran d'accueil" déjà fonctionnelle).

### 2.4 Son des notifications
- **In-app (app ouverte)** : fait. `frontend/src/lib/notificationSound.ts`, carillon synthétisé en Web Audio API, déclenché depuis `frontend/src/hooks/NotificationContext.tsx`.
- **Push (app fermée)** : son système par défaut uniquement — c'est précisément ce que ce chantier doit débloquer.

### 2.5 Push actuel (Web Push / VAPID)
- `PushSubscription` (modèle), `SouscrirePushUseCase` / `DesinscrirePushUseCase`.
- Décision produit déjà actée (juillet 2026) : **Web Push/VAPID plutôt que FCM**, précisément pour rester réutilisable "sans dépendance Google" par une future app Electron/Capacitor — cette décision devra être **réexaminée** au moment de Capacitor (voir §4.6 ci-dessous, FCM est quasiment incontournable pour le push natif Android, et souvent utilisé aussi comme relais pour iOS).
- Événements déjà basculés en push prioritaire (email en repli) : bulletins disponibles, rappels/reçus de paiement, relances notes 48h/72h, alertes absence, notifications discipline.

**Conclusion de l'état des lieux** : ne pas repartir de zéro. Le travail de ce chantier n'est pas "construire l'offline-first" (déjà là), c'est (a) **vérifier/durcir** ce qui existe pour un contexte de bundle statique local plutôt que serveur Next.js live, et (b) **ajouter** la couche push natif par-dessus.

---

## 3. Décision d'architecture — bundle statique local, PAS de WebView pointée sur un site distant

Deux façons d'utiliser Capacitor :

| Mode | Comment ça marche | Offline-first ? |
|---|---|---|
| **A — Bundle statique local** (`webDir`) | Les fichiers HTML/CSS/JS sont copiés DANS l'app, servis localement par la WebView, sans réseau | ✅ Oui — l'app démarre même sans connexion |
| **B — `server.url` distant** | La WebView charge une URL en ligne, comme un navigateur | ❌ Non — rien ne s'affiche sans réseau à part ce que le Service Worker a mis en cache, et le comportement diffère d'une vraie app Capacitor |

**Décision : mode A, bundle statique local.** C'est le seul cohérent avec "offline-first = priorité absolue". Le mode B avait été suggéré dans un échange précédent en supposant (à tort) que seul le push natif comptait — corrigé ici : les deux objectifs (offline-first ET push natif) sont compatibles, mais imposent le mode A.

Cette décision a des conséquences techniques concrètes, détaillées au §4.

---

## 4. Défis techniques identifiés — à résoudre AVANT ou PENDANT le chantier

### 4.1 `next.config.ts` utilise `rewrites()` — incompatible avec l'export statique

```ts
async rewrites() {
  return [{ source: "/api/v2/:path*", destination: `${BACKEND_URL}/api/v2/:path*` }];
}
```

`rewrites()` a besoin d'un serveur Next.js qui tourne. Un export statique (`output: 'export'`, requis pour le mode A du §3) n'a pas de serveur — cette fonction ne sera simplement jamais appelée dans le bundle Capacitor.

**Impact** : ce proxy servait à trois choses (voir commentaire dans le fichier) : un seul tunnel ngrok en dev, pas de CORS, cookies httpOnly same-origin. Dans l'app Capacitor, aucune de ces trois raisons ne s'applique de la même façon — il faut un mécanisme différent (voir 4.2 et 4.3).

**À faire** : configurer `next.config.ts` avec un export conditionnel — build web normal (avec `rewrites()`) reste inchangé pour le déploiement web ; un build séparé pour Capacitor (`output: 'export'`, variable d'env ou config dédiée) appelle le backend en URL absolue.

### 4.2 `fetchApi` utilise des chemins relatifs (`/api/v2/...`)

`frontend/src/lib/fetchApi.ts` et tout le code appelant (`fetchApi('/api/v2/...')`) suppose une résolution relative à l'origine de la page — ça marche aujourd'hui grâce au proxy `rewrites()` (même origine apparente). Dans le bundle Capacitor (origine `capacitor://localhost` ou `https://localhost` selon la plateforme), un chemin relatif ne pointera PAS vers le vrai backend.

**À faire** : introduire une base URL configurable (ex. `NEXT_PUBLIC_API_BASE_URL`, vide en web normal → chemins relatifs inchangés ; pointant vers `https://api.zekoulabia.com` en build Capacitor) et l'utiliser dans `fetchApi` pour préfixer les chemins. Un seul point de modification si bien centralisé — vérifier qu'aucun autre endroit de l'app n'appelle `fetch('/api/...')` directement en contournant `fetchApi`.

### 4.3 Authentification par cookie httpOnly — cross-origin sur mobile

L'auth actuelle repose sur des cookies httpOnly, posés par le backend, lus en `credentials: 'include'`, et ça marche en "same-origin apparent" grâce au proxy. Une fois l'app Capacitor en bundle statique appelant un backend sur un **vrai domaine distant différent**, on est en cross-origin strict — et les navigateurs mobiles (Safari/WebKit sur iOS en particulier, via l'Intelligent Tracking Prevention) sont agressifs sur les cookies cross-site, y compris dans une WebView Capacitor.

**Deux options, à trancher au moment venu** (pas de décision prise ici, juste les options) :
- **Option 1 — `server.hostname` Capacitor** : configurer Capacitor pour que la WebView s'exécute sous un nom d'hôte qui correspond à ton vrai domaine (technique documentée par Capacitor précisément pour ce cas : cookies same-site). Change le moins de code, mais demande une config native précise par plateforme.
- **Option 2 — Basculer l'auth mobile sur un token** (ex. JWT en `Authorization: Bearer`, stocké via `@capacitor/preferences` ou `@capacitor-community/secure-storage`) au lieu du cookie httpOnly, uniquement pour le build Capacitor. Plus de travail (deux mécanismes d'auth à maintenir), mais élimine tout le problème de cookies cross-origin.

**Recommandation à ce stade (à revalider le moment venu avec les versions Capacitor d'alors)** : commencer par tester l'Option 1 (plus proche du système actuel, donc moins de divergence entre web et mobile) ; basculer sur l'Option 2 seulement si l'Option 1 s'avère peu fiable en pratique sur iOS.

### 4.4 Vérifier la compatibilité de `next export` avec le code actuel

`output: 'export'` interdit : Server Actions, certains usages de Middleware, les routes dynamiques sans `generateStaticParams`, les Route Handlers dépendant du runtime serveur. `frontend/AGENTS.md` prévient déjà : *"This is NOT the Next.js you know — read the docs before writing any code"* — signe d'une version/config non standard, à ne pas présumer compatible sans vérification.

**À faire, en tout premier, avant tout le reste** : lancer `next build` avec `output: 'export'` sur une branche de test et lister tout ce qui casse. C'est le vrai go/no-go technique du chantier — s'il y a des Server Actions/Server Components profondément utilisés, ça peut vouloir dire adapter des pans entiers du frontend, pas juste la config.

### 4.5 Muscler la queue de synchronisation existante avant un usage mobile intensif

`useSyncQueue.ts` fonctionne mais a des limites qui deviendront plus visibles avec un usage mobile hors-ligne prolongé (coupures réseau plus fréquentes/longues qu'en usage desktop) :
- **Pas de retry avec backoff** — une action `FAILED` reste `FAILED` définitivement, jamais retentée automatiquement.
- **Pas de résolution de conflit** — si la même donnée a été modifiée ailleurs entre-temps (ex. une note saisie hors-ligne puis modifiée par un collègue avant la synchro), c'est un écrasement silencieux (dernier arrivé gagne), jamais signalé à l'utilisateur.
- **Pas de limite de rétention** — des actions `FAILED` anciennes s'accumulent indéfiniment dans IndexedDB sans mécanisme de nettoyage/purge visible.

**À faire** : décider si ces trois points sont acceptables tels quels pour un premier lancement mobile, ou s'ils doivent être traités avant (probablement au moins le retry — un enseignant hors ligne toute une journée de cours ne doit pas perdre silencieusement ses notes saisies).

### 4.6 Push natif — nouveau chemin d'enregistrement, décision FCM à réexaminer

Le push actuel (VAPID/Web Push) et le push natif Capacitor sont **deux mécanismes distincts**, pas juste deux "canaux" d'un même système :
- Aujourd'hui : navigateur → VAPID → `PushSubscription` (clé publique/privée maison, pas de dépendance Google).
- Capacitor natif : `@capacitor/push-notifications` → jeton d'appareil FCM (Android, et couramment utilisé aussi comme relais pour iOS/APNs) → nécessite un **projet Firebase**.

La décision "Web Push plutôt que FCM pour rester indépendant de Google" (actée juillet 2026) entre en tension directe avec le natif : FCM est de facto le chemin standard pour Android natif, et simplifie beaucoup iOS. **À réexaminer explicitement au moment venu** plutôt que de découvrir la tension en cours de route — options : accepter FCM pour le canal natif uniquement (le web garde VAPID, deux systèmes cohabitent), ou chercher une alternative sans Google (plus de travail, à évaluer si c'est vraiment un principe non négociable ou une préférence).

**À faire, backend** : nouvelle table/colonne pour stocker les jetons d'appareil FCM/APNs par utilisateur (distincte de `PushSubscription`), et adapter les points d'envoi existants (bulletins, rappels paiement, relances notes, alertes absence, discipline) pour envoyer sur les DEUX canaux (Web Push pour les navigateurs, natif pour l'app Capacitor) selon ce que l'utilisateur a souscrit.

### 4.7 CORS backend — ajouter l'origine Capacitor

`backend/src/server.ts` (lignes ~74-98) a une allowlist stricte (`allowedOrigins`) construite depuis `CLIENT_URL` + hôtes de dev connus. L'origine envoyée par une WebView Capacitor (`capacitor://localhost` sur iOS, `https://localhost` sur Android par défaut, ou le hostname personnalisé si l'Option 1 du §4.3 est retenue) devra être ajoutée explicitement à cette liste, sinon toute requête de l'app mobile sera rejetée par CORS.

---

## 5. Plan étape par étape (au moment venu)

### Phase 0 — Vérification go/no-go (avant tout achat de compte, avant tout `npx cap add`)
1. Tester `next build` avec `output: 'export'` sur une branche dédiée. Lister exhaustivement ce qui casse (§4.4).
2. Si la casse est massive (beaucoup de Server Actions/Components) : réévaluer l'ampleur réelle du chantier (le "2-3 semaines" déjà estimé dans `ANALYSE_COMPLETE.md` suppose une compatibilité raisonnable — à revalider).

### Phase 1 — Déploiement public (prérequis indépendant de Capacitor)
3. Déployer `backend` sur un vrai domaine (Railway déjà utilisé pour `ml-service` — candidat naturel) avec HTTPS.
4. Décider de la stratégie de build frontend : garder le déploiement web normal (SSR/rewrites intacts) EN PLUS du build statique dédié Capacitor — ce sont deux artefacts de build différents à partir du même code source (§4.1).
5. Mettre à jour CORS backend (§4.7) une fois l'origine Capacitor connue.

### Phase 2 — Setup Capacitor
6. `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`.
7. `npx cap init` — `webDir` pointant vers le build statique (PAS `server.url`, voir §3).
8. `npx cap add ios` / `npx cap add android`.
9. Résoudre l'auth cross-origin (§4.3 — Option 1 ou 2, décidée à ce moment).
10. Introduire la base URL API configurable (§4.2) et vérifier tous les appels réseau de l'app (pas seulement `fetchApi` — chercher tout `fetch(` direct).

### Phase 3 — Offline-first en contexte natif
11. Tester la queue de synchronisation (§2.2, §4.5) en conditions réelles sur appareil (mode avion prolongé, coupures répétées).
12. Traiter au minimum le retry avec backoff (§4.5) avant de considérer le offline-first "prêt" pour un vrai lancement.
13. Vérifier que le Service Worker PWA existant ne rentre pas en conflit avec le comportement natif de Capacitor (deux couches de cache/offline qui se chevauchent potentiellement — à tester, pas à présumer sans risque).

### Phase 4 — Push natif
14. Créer le projet Firebase (FCM) — ou trancher l'alternative si la décision "sans Google" est maintenue (§4.6).
15. `npm install @capacitor/push-notifications`, configuration APNs (certificats/clés Apple) + FCM (Android).
16. Backend : nouveau modèle de jeton d'appareil natif + adapter les points d'envoi de notification existants (§4.6).
17. **Le point de départ de tout ce chantier** : fournir le fichier son personnalisé dans le payload push — `.wav`/`.mp3` (Android), `.caf`/`.wav` (iOS). Le son in-app existe déjà (§2.4), seul le son du push natif est nouveau.
18. Tester réellement sur appareil (le comportement du son push ne se voit pas dans un simulateur/émulateur de façon fiable — vérifier sur téléphone physique, iOS ET Android).

### Phase 5 — Build, signature, stores
19. **Contrainte concrète** : build/signature iOS nécessite Xcode → macOS. Environnement de dev actuel = Windows. Options : Mac physique, service cloud (Codemagic, EAS Build, GitHub Actions runner macOS, MacinCloud).
20. Comptes développeur : Apple Developer Program (99 $/an), Google Play Console (25 $ une fois).
21. Icônes/splash screens via `@capacitor/assets`.
22. Fiches store (captures d'écran, description, politique de confidentialité — obligatoire pour les deux stores).
23. Bandeau discret et fermable sur le web faisant la promotion de l'app (règle produit déjà actée, jamais un blocage — voir §1).

---

## 6. Séquencement recommandé (quand démarrer)

Ne pas démarrer avant que :
- Le socle fonctionnel de l'app soit raisonnablement stable (pas de refonte d'architecture en cours) — sinon la Phase 0 (§5) doit être refaite à chaque changement structurant.
- Le déploiement public (Phase 1) soit de toute façon prévu à court terme — c'est un prérequis partagé avec la mise en production normale, pas un coût additionnel spécifique à Capacitor.

Une fois ces deux conditions réunies : commencer strictement par la **Phase 0** (§5, point 1) avant tout autre engagement (comptes payants, temps de setup) — c'est le seul test qui peut invalider ou réduire drastiquement l'estimation actuelle de 2-3 semaines.

---

## 7. Décisions ouvertes à trancher le moment venu (pas de réponse figée ici)

- [ ] Auth cross-origin : Option 1 (hostname Capacitor) ou Option 2 (token) — §4.3.
- [ ] FCM accepté pour le canal natif, ou alternative sans Google recherchée — §4.6.
- [ ] Niveau d'investissement dans le durcissement de la queue de synchro avant lancement (retry, conflits, purge) — §4.5.
- [ ] Provider pour les builds iOS (Mac physique vs service cloud, et lequel) — §5 Phase 5.
- [ ] Un seul push natif pour Android+iOS via FCM, ou APNs direct pour iOS sans passer par FCM.

---

*Document créé le 2026-08-03, à mettre à jour à chaque décision prise ou changement d'état du chantier (comme `ARCHITECTURE.md`/`FEATURES.md`/`ANALYSE_COMPLETE.md`, qui restent les documents de référence pour l'état déjà tranché).*
