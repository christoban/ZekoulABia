# ARCHITECTURE — ZEKOULABIA

> Vision globale de l'application. À lire en premier par toute IA ou tout développeur qui rejoint le projet.
> Documents liés : [MODULE_INDEX.md](MODULE_INDEX.md) · [FEATURES.md](FEATURES.md) · [CONVENTIONS.md](CONVENTIONS.md) · [AGENTS.md](AGENTS.md)

---

## 1. Qu'est-ce qu'ZEKOULABIA ?

SaaS **multi-tenant** de gestion scolaire pour les établissements **camerounais** (système MINESEC). Une seule base gère plusieurs écoles isolées par `schoolId`. Le produit couvre l'inscription/onboarding d'un établissement, la gestion des utilisateurs, classes, matières, notes, bulletins, présences, emplois du temps, finances (Mobile Money), communications, orientation, RH, discipline, etc.

Spécificités métier camerounaises structurantes (voir [FEATURES.md](FEATURES.md)) :
- **Sous-systèmes** : `FRANCOPHONE`, `ANGLOPHONE`, `BILINGUAL` (deux sections cohabitant).
- **Templates d'établissement** (~17 : CES, Lycée général/technique, GHS/GSS anglophones, primaire, maternelle, complexe…).
- **Cycles** : maternelle / primaire / 1er cycle (6e–3e) / 2nd cycle (2nde–Tle) / technique.
- **Programme Spécial Bilingue (PEBS)** : variable orthogonale activable sur tout établissement général.
- **LV2** (2e langue vivante) : commence en 4e.
- **Anglophone** : O-Level / A-Level (GCE), streams Arts/Sciences.
- Coefficients MINESEC déterministes, mentions, séries BAC.

---

## 2. Vue d'ensemble (monorepo)

```
ZEKOULABIA/
├── backend/      API — Bun + Express + Prisma + PostgreSQL — architecture HEXAGONALE
├── frontend/     Web — Next.js 16 (App Router) + React 19 + Tailwind v4
└── *.md          Documentation projet (ce fichier, MODULE_INDEX, FEATURES, CONVENTIONS, AGENTS)
```

- **Runtime** : **Bun** partout (backend exécute le TS directement, pas de build backend).
- **Plateforme de dev** : Fedora Linux (héritage Windows jusqu'à mi-2026 — voir gotchas §9 et [AGENTS.md](AGENTS.md)).
- **Communication front↔back** : REST `/api/v2/*` (cookies HTTP-only pour l'auth) + **Socket.io** (temps réel) + **Inngest** (jobs asynchrones).

---

## 3. Backend — architecture hexagonale (Ports & Adapters)

Le backend applique une **architecture hexagonale** stricte en 3 couches. Règle de dépendance : **l'extérieur dépend de l'intérieur, jamais l'inverse**.

```
                 ┌──────────────────────────────────────────────┐
   HTTP / Socket │              INFRASTRUCTURE                   │  ← adapters (Express, Prisma,
   / Inngest ───▶│  controllers · routes · repositories Prisma  │     Groq, Campay, Resend, PDFKit…)
                 │  services externes · container · bootstrap    │
                 └───────────────────┬──────────────────────────┘
                                     │ implémente les PORTS / appelle les USE CASES
                 ┌───────────────────▼──────────────────────────┐
                 │               APPLICATION                     │  ← orchestration métier
                 │   Use Cases (par domaine) — sans I/O direct   │
                 └───────────────────┬──────────────────────────┘
                                     │ dépend des ENTITÉS + PORTS (interfaces)
                 ┌───────────────────▼──────────────────────────┐
                 │                 DOMAIN                        │  ← cœur métier pur
                 │  entities · value-objects · rules · ports     │     (aucune dépendance technique)
                 │  errors · types · constants                   │
                 └──────────────────────────────────────────────┘
```

### 3.1 `domain/` — le cœur métier (aucune dépendance technique)
- `entities/` : agrégats riches avec logique métier (`School`, `User`, `Classe`, `Note`, `Bulletin`, `Facture`, `Paiement`, `Presence`, `EmploiDuTemps`, `CreneauHoraire`, `FicheOrientation`, `Depense`, `PlanFrais`).
- `ports/repositories/` : **interfaces** de persistance (ce dont le métier a besoin, pas comment).
- `ports/services/` : **interfaces** des services externes (`EmailService`, `PdfService`, `IAService`, `SmsService`, `PaiementService`, `TokenService`, `NotificationService`).
- `rules/` : règles métier pures (ex. `StaffPermissionRules` — titre terrain → permissions).
- `value-objects/`, `types/` (enums), `constants/`, `errors/` (erreurs domaine typées).

### 3.2 `application/` — les cas d'usage (orchestration)
40 modules par domaine : `academicEvent`, `academicYear`, `ai`, `announcement`, `apee`, `assistant`, `attendance`, `class`, `classCouncil`, `discipline`, `eleveOnboarding`, `entranceExam`, `examen`, `finance`, `grade`, `hr`, `lv2Choice`, `masterAdmin`, `matricule`, `messagerie`, `messaging`, `orientation`, `paiementMinesec`, `parent`, `pebsExam`, `pushNotification`, `reportCard`, `room`, `school`, `schoolGroup`, `schoolSettings`, `shared`, `statisticalCampaign`, `statisticalCampaignMinedub`, `student`, `studentGroup`, `subject`, `suivi`, `timetable`, `user`. Chaque use case :
- reçoit ses dépendances par **injection de constructeur** (ports, pas d'implémentations) ;
- ne touche **jamais** Prisma/HTTP directement (sauf `prisma?` optionnel injecté ponctuellement pour des lectures, cf. `GenererBulletinUseCase`) ;
- porte une méthode `execute(commande)` retournant un résultat typé ;
- est **testable en isolation** via des repos/services in-memory (`tests/unit/application/<module>/helpers/`).

### 3.3 `infrastructure/` — les adapters (le monde réel)
- `http/controllers/` (65) : traduisent HTTP ↔ use cases. `http/routes/` (59) : montage Express + middlewares (`requireAuth`, `requireRole`). `http/dto/`, `http/middlewares/`.
- `persistence/prisma/` (27 repos) : implémentent les ports repository via Prisma.
- `services/` : adapters externes + clients techniques, organisés par domaine — `ai/` (GroqIAService, GroqClient, DocumentAiOrchestrator…), `email/`, `sms/`, `payment/`, `notification/`, `auth/`, `storage/`, `pdf/`, `scraping/`.
- `config/container.ts` : **composition root** — instancie repos + services + use cases et les câble. `config/hexagonal.bootstrap.ts` : monte toutes les routes sur l'app Express à partir du container.
- `inngest/`, `socket/`, `pdf/`.

> ⚠️ Le repo contient aussi des **dossiers utilitaires hors hexagone** (historiques ou transverses) : `utils/` (reportCards, schoolDocuments, hrDocuments, emailTemplates, languageHelper), `inngest/`, `socket/`, `scripts/`, `validation/`, `lib/`. Ils sont utilisés directement par l'infrastructure. Ne pas les confondre avec les couches hexagonales.

### 3.4 Point d'entrée
`backend/src/server.ts` → crée l'app Express, appelle le bootstrap (container + routes), démarre Socket.io et le serveur HTTP.

---

## 4. Frontend — Next.js App Router par rôle

```
frontend/src/
├── app/
│   ├── login/ · reset-password/ · invite/            pages publiques
│   ├── onboarding/[token]/                            Phase 1 : questionnaire d'inscription (wizard)
│   ├── admin/configuration/                           Phase 2 : onboarding conversationnel + activation
│   ├── admin/ teacher/ staff/ parent/ student/ master/  dashboards par rôle (voir MODULE_INDEX)
│   └── api/                                           routes Next (le cas échéant)
├── components/     partagés : AnimatedBackground, ThemeToggle, LanguageSwitch, LandingPage, ui/ (shadcn)
└── lib/            fetchApi, i18n/, offline/ (Dexie/PWA), userAuth, colors, utils
```

- **Dashboards** : chaque rôle a un `dashboard/page.tsx` + `_components/Section*.tsx` (admin 32, teacher 12, staff 16, parent 8, student 7) + une sidebar + topbar + toasts. S'y ajoutent les espaces **master** (plateforme) et **group** (propriétaire d'un groupe d'écoles : `frontend/src/app/group/`), ainsi que l'onboarding élève dédié (`frontend/src/app/eleve-onboarding/`).
- **Styles** : **inline styles** majoritaires + tokens CSS (`var(--bg)`, `var(--text)`…) définis dans `globals.css`, plus quelques utilitaires Tailwind. Thème clair/sombre via **next-themes** + `@custom-variant dark` (Tailwind v4).
- **i18n** : système **maison** (`src/lib/i18n`), 13 namespaces × fr/en, dictionnaires importés **statiquement**. La langue du dashboard est personnelle à chaque utilisateur ; les contenus générés restent dérivés de l'établissement/section (jamais de l'URL).
- **Offline/PWA** : `@ducanh2912/next-pwa` + **Dexie** (IndexedDB) pour la file d'attente offline (`lib/offline`).
- **Data fetching** : `fetchApi` (wrapper `fetch` avec cookies) vers `/api/v2/*`. Temps réel via `socket.io-client`.

---

## 5. Rôles & multi-tenancy

| Rôle | Portée | Auth |
|---|---|---|
| **MASTER** | Plateforme (super-admin ZEKOULABIA) : invite/approuve/suspend les écoles | JWT master + **MFA (otplib)**, audit |
| **GROUP_MASTER** | Groupe d'écoles (`SchoolGroup`) : transferts d'élèves/enseignants entre écoles du groupe, KPI consolidés | Connexion dédiée (`LoginGroupOwnerUseCase`), JWT group owner |
| **ADMIN / STAFF / TEACHER** | Une école ; STAFF a des permissions granulaires via `StaffPermissionType` (Censeur, Intendant, Surveillant Général, HOD…) | Connexion à 3 facteurs **obligatoire** : mot de passe → code email → TOTP (`otplib`). Configuration MFA forcée dès la 1ère connexion (aucun accès dashboard tant qu'elle n'est pas activée), jamais désactivable ensuite (reconfiguration guardée uniquement). JWT cookie `access_token`, `schoolId` (+ `permissions[]` pour STAFF) |
| **PARENT / STUDENT** | Une école, périmètre restreint | Mot de passe + code email (pas de MFA). JWT cookie `access_token`, `schoolId` |

- **Isolation** : chaque requête est bornée par `req.user.schoolId` ; toutes les requêtes Prisma filtrent par `schoolId`.
- **Connexion multi-étapes (juillet 2026)** : `POST /api/v2/users/auth/login` n'émet plus de session directement — un cookie temporaire (`pending_login_token`) porte l'utilisateur à travers les étapes (code email, puis TOTP ou configuration MFA obligatoire selon le rôle) jusqu'à l'émission des cookies `access_token`/`refresh_token` finaux. Voir `UserController.ts` (`verifyLoginOtp`, `verifyLoginMfa`, `firstMfaSetup`, `firstMfaEnable`), `LoginEmailOtpUseCase`, `VerifierMfaConnexionUseCase`. Réinitialisation MFA d'un compte bloqué : capacité Master dédiée (`MasterAdminHexController.reinitialiserMfaUtilisateur`).
- **RBAC** : `requireAuth` (vérifie le JWT) + `requireRole(...)` (middleware). Les titres staff → permissions via `domain/rules/StaffPermissionRules`.

---

## 6. Circulation des données (exemple : générer les bulletins d'une classe)

```
Frontend (SectionBulletins) ──POST /api/v2/report-cards/generate──▶ ReportCardController
   └─▶ GenererBulletinUseCase.execute()                    (application)
        ├─ lit notes/élèves/coeffs via repositories        (ports → PrismaRepositories)
        ├─ calcule moyennes / rangs / mentions             (domain: Bulletin, règles)
        ├─ résout la langue via resolveLanguage()          (utils/languageHelper)
        └─ PdfService.genererBulletin()                    (port → PdfKitBulletinService → utils/reportCards)
   └─▶ réponse JSON (stats) ; PDF stocké / envoyé
```

Autres flux importants :
- **Jobs asynchrones (Inngest)** : génération de bulletins en masse, génération auto d'emploi du temps (IA), notifications — `inngest/functions.ts`.
- **Temps réel (Socket.io)** : notifications in-app poussées via `SocketNotificationService`.
- **Paiement Mobile Money** : `InitierPaiementMobileMoneyUseCase` → `CampayPaiementService` → webhook Campay → `TraiterWebhookCampayUseCase`.
- **IA (Groq)** : assistant, insights, commentaires de bulletin, EDT auto — via `infrastructure/services/ai/GroqClient.ts` / `GroqIAService` (modèle **Groq** `openai/gpt-oss-120b`).
- **Examens & Admissions** : concours d'entrée 6e (sessions, candidats, CEP, création compte élève), sélection PEBS (transfert classe en masse), choix LV2 numérisé (fenêtres, soumission élève/admin) — modules `lv2Choice`, `entranceExam`, `pebsExam`. IA intégrée : scan Vision, détection d'anomalies, copilot admin.

---

## 7. Dépendances importantes

**Backend** : Express, Prisma/PostgreSQL, Zod (validation), jsonwebtoken + bcryptjs + otplib (auth/MFA), `@ai-sdk/groq` + `ai` (IA), Inngest (jobs), Socket.io (temps réel), PDFKit (bulletins), Nodemailer + Resend (email), Campay via axios (Mobile Money), multer + xlsx (imports), archiver (ZIP), qrcode (documents vérifiables), helmet + cors + express-rate-limit (sécurité).

**Frontend** : Next 16 + React 19, Tailwind v4, next-themes (thème), Recharts (graphes), framer-motion + lenis (animations), react-hook-form + @hookform/resolvers + zod (formulaires), @dnd-kit (drag & drop, ex. emploi du temps), Dexie + next-pwa (offline), socket.io-client, sonner (toasts), lucide-react (icônes), shadcn/@base-ui (primitives UI).

---

## 8. Décisions architecturales importantes (ADR condensées)

1. **Hexagonal côté backend** : découple le métier des frameworks → testabilité (92 fichiers de tests, repos in-memory) et remplaçabilité des adapters.
2. **Multi-tenant à base partagée** (`schoolId`) plutôt qu'une base par école : simplicité opérationnelle ; l'isolation est une **responsabilité applicative stricte**.
3. **Langue de l'interface et langue métier sont séparées** :
   - **Dashboard connecté** : chaque utilisateur choisit librement FR ou EN. Le choix est isolé par `userId` dans `localStorage` (`zekoulabia_dashboard_lang_<userId>`), afin qu'un choix ne soit jamais appliqué au compte suivant sur le même navigateur. Le choix effectué sur le login est repris dans cette préférence personnelle.
   - **Pages universelles** — `login`, landing, onboarding : elles servent tous les établissements et utilisent la préférence publique `zekoulabia_lang_override`, indépendante des comptes.
   - **Contenus générés** — bulletins, documents, SMS, emails : la langue reste dérivée de l'établissement et de la section via `resolveLanguage(subsystem, sectionCode?)` côté backend. Un dashboard bilingue ne change pas cette règle métier.
4. **Onboarding en 2 phases** : Phase 1 wizard token (structure) → Phase 2 conversationnel (affinage + activation déterministe). La Phase 2 **se nourrit** de la Phase 1 (réconciliation).
5. **Exécution déterministe de la configuration** (coefficients MINESEC exacts) plutôt que génération 100 % LLM.
6. **PEBS orthogonal au template** : le « bilingue » établissement (2 sections) ≠ le Programme Spécial Bilingue (flag activable). Ne pas les fusionner.
7. **i18n frontend maison** (pas de lib) + dictionnaires **statiques** : bascule FR↔EN fiable sur tout appareil.
8. **Thème via tokens CSS + next-themes** : migration progressive des couleurs hex vers `var(--token)`.
9. **IA via Groq** — point d'entrée `generateWithGroq` / `groqModel` (`infrastructure/services/ai/GroqClient.ts`), adapter `GroqIAService`.
10. **Multi-plateforme (Desktop/Android/iPhone) — PWA maintenant, Capacitor plus tard pour mobile** (juillet 2026). Un seul codebase Next.js, pas d'app native écrite séparément. Desktop reste PWA pure indéfiniment (pas d'équivalent natif pour un navigateur de bureau). Mobile (Android **et** iPhone — base d'utilisateurs iPhone significative au Cameroun, ne pas sous-estimer) : empaquetage **Capacitor** prévu **plus tôt que "si le besoin apparaît"**, car la PWA seule a deux limites réelles côté iOS — pas de présence App Store (découvrabilité), et les notifications push Safari sont limitées (support iOS 16.4+ uniquement, et seulement après que l'utilisateur ait fait "Ajouter à l'écran d'accueil" manuellement — jamais automatique). Ne jamais forcer le téléchargement de l'app une fois Capacitor livré : le web doit rester utilisable sans installation (fracture numérique — téléphones d'entrée de gamme à stockage limité, cf. constat enquête terrain). Prévoir un bandeau discret, fermable, orienté bénéfice concret (son personnalisé fiable, ouverture rapide, icône écran d'accueil) plutôt qu'un blocage.
    - **Conséquence directe sur le son des notifications** (voir §12 de [FEATURES.md](FEATURES.md)) : le son **in-app** (app ouverte, reçu via Socket.io) est indépendant de tout ça et déjà implémenté (`fe/lib/notificationSound.ts`, synthétisé en Web Audio API, pas de fichier audio). Le son **personnalisé du push** (app fermée/tél. verrouillé) est en revanche **bloqué par la plateforme** tant que l'app tourne en Web Push standard (`fe/worker/index.js` — la Notification API des navigateurs n'accepte qu'un son système on/off, `silent: false`, jamais un fichier audio custom, quasi inexistant sur iOS). Ce n'est **pas un manque de développement**, c'est une limite du navigateur — non résoluble avant l'empaquetage. **Au moment de Capacitor** : passer par `@capacitor/push-notifications` (APNs/FCM natifs), qui accepte un champ son personnalisé dans le payload — fournir un fichier `.caf`/`.wav` (iOS) et `.mp3`/`.wav` (Android) à ce moment-là. Rien à préparer avant. Plan détaillé (architecture bundle statique offline-first + défis techniques identifiés) : [Plan_Capacitor_Mobile_ZekoulABia.md](docs/Plan_Capacitor_Mobile_ZekoulABia.md).

---

## 9. Contraintes d'environnement (Fedora Linux) — à respecter absolument

- **Vérif TS** : `cd backend && ./node_modules/.bin/tsc --noEmit` (idem `frontend/`). Jamais `npx tsc`.
- **Migrations** : `npx prisma migrate dev --name X --skip-generate` depuis `backend/`.
- **`prisma generate`** : fonctionne normalement sous Fedora (le moteur est un binaire `.so`, plus soumis au verrouillage `.dll` Windows). Seule précaution : arrêter le serveur dev/`prisma studio` avant de lancer la commande. Le repli `(prisma as any).monModele` ne doit plus être systématique (voir [AGENTS.md](AGENTS.md)).
- **Smoke tests** : `bun _smoke.ts` **dans** `backend/` (jamais `/tmp`), puis supprimer le fichier.
- **Backend sans build** : `bun run dev` / `bun run start`. **Build = frontend uniquement** (`bun run build`).

Détails complets et méthode de travail : voir **[AGENTS.md](AGENTS.md)**.

---

## 10. Maintenance de ce document

Ce fichier fait **partie du projet**. Toute modification structurante (nouvelle couche, nouveau service externe, changement de flux majeur, nouveau rôle) doit s'accompagner d'une mise à jour d'ARCHITECTURE.md et, si besoin, de MODULE_INDEX.md / FEATURES.md. Le Tech Lead (IA architecte) propose ces mises à jour automatiquement.
