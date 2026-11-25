# ZekoulABia — Site marketing

Site vitrine/conversion, séparé de l'application principale (`../frontend`) — voir la
discussion qui a motivé cette séparation dans l'historique du projet : tant que ZekoulABia est
en phase d'acquisition (pas encore de base d'écoles clientes qui reviennent taper le domaine
principal par réflexe), le domaine public doit rester 100% orienté conversion ("Demander une
démo"), sans bouton "Se connecter" qui distrairait un public à 95%+ composé de prospects sans
compte. Modèle confirmé par Logesco (concurrent camerounais, >10 ans de présence, toujours zéro
bouton de connexion sur son site).

## Pourquoi un projet séparé

- **Léger** : pas de Prisma, pas de TanStack Query, pas de logique d'authentification — juste
  Next.js + Tailwind + Framer Motion, pour un chargement rapide (SEO, conversion).
- **Cycle de déploiement indépendant** : changer un texte marketing ou un tarif ne redéploie
  jamais l'app où tournent les vraies écoles.
- **Domaine séparé prévu** : `zekoulabia.com` (ce projet) vs `app.zekoulabia.com` (`../frontend`).
  Un utilisateur déjà connecté n'atterrit structurellement jamais ici — sa session (cookies
  httpOnly) vit sur l'autre origine, jamais partagée avec celle-ci.

## Ce qui a été porté depuis `../frontend`

`LandingPage.tsx`, `DemoModal.tsx`, `AnimatedBackground.tsx`, `LanguageSwitch.tsx`,
`globals.css`, `tailwind.config.ts`, `logo.svg`, `favicon.png` — copiés puis adaptés :

- **Pas de vérification de session** dans `LandingPage.tsx` (contrairement à la version dans
  `../frontend`, qui redirige un utilisateur déjà connecté vers son tableau de bord) — inutile
  ici, localStorage n'est jamais partagé entre deux origines différentes.
- **`src/lib/i18n.tsx` est un système minimal réécrit**, PAS une copie de
  `../frontend/src/lib/i18n/index.tsx` : ce dernier charge 13 espaces de traductions
  (admin/teacher/staff/grades/finance/...) hors sujet pour un site marketing dont le contenu vit
  déjà entièrement dans `textsFR`/`textsEN` à l'intérieur de `LandingPage.tsx`. Seul le
  changement de langue FR/EN a été conservé.
- **`next.config.ts` proxy `/api/v2/*` vers le backend** (même pattern que
  `../frontend/next.config.ts`) — le seul appel réseau de ce site (`DemoModal` →
  `/api/v2/public/demo-request`) reste un chemin relatif, sans CORS à configurer côté backend
  malgré le domaine séparé.

## Développement local

```bash
bun install
cp .env.example .env   # BACKEND_URL=http://localhost:5000 par défaut
bun run dev
```

## Déploiement — ce qui reste à faire (hors de portée d'un agent de code)

Ce projet est prêt à déployer, mais les étapes suivantes nécessitent un accès à
l'hébergeur/registrar que je n'ai pas :

1. Créer un nouveau projet d'hébergement (Vercel ou équivalent) pointant sur ce dossier
   (`landing/`), séparé du projet `frontend/`.
2. Configurer `BACKEND_URL` dans les variables d'environnement du projet déployé (URL réelle du
   backend en production, pas `localhost`).
3. Configurer le DNS : `zekoulabia.com` (et `www.`) → ce projet ; `app.zekoulabia.com` → le
   projet `frontend/` existant.
4. Une fois les deux domaines en place, remplacer le lien de contact/onboarding pointant
   aujourd'hui vers l'app (s'il y en a un dans le contenu marketing) par une URL absolue vers
   `app.zekoulabia.com` — vérifié à ce jour : aucun lien de ce type n'existe dans `LandingPage.tsx`
   (le seul chemin utilisateur est "Demander une démo" → e-mail/contact manuel → invitation, pas
   une inscription directe).

Tant que ces étapes ne sont pas faites, ce projet reste un scaffold prêt à l'emploi mais non
déployé — la landing page actuelle continue de vivre dans `../frontend` (`src/app/page.tsx`)
sans que rien ne casse.
