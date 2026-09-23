# CONVENTIONS — ZEKOULABIA

> Toutes les conventions à respecter pour rester cohérent dans le temps. Extraites du code réel.
> Liés : [ARCHITECTURE.md](ARCHITECTURE.md) · [MODULE_INDEX.md](MODULE_INDEX.md) · [AGENTS.md](AGENTS.md)

**Principe directeur : le code que tu écris doit se fondre dans le code existant.** Reproduis le style du fichier voisin (nommage, densité de commentaires, idiome) plutôt que d'imposer le tien.

---

## 1. Langue du code (bilingue FR/EN — c'est voulu)

- **Le métier est nommé en FRANÇAIS** : use cases, entités, variables domaine (`CreerClasseUseCase`, `nomComplet`, `moyenneGenerale`, `niveaux1erCycle`, `filieres`, `commande`, `resultat`). C'est la convention historique — **conserve-la** dans le code métier.
- **Le technique/générique reste souvent en anglais** (`UserRepository`, `findById`, `save`, `Props`, hooks React).
- **Ne « traduis » pas** un fichier existant vers l'anglais. Suis la langue déjà en place dans le fichier.
- Ne pas confondre avec l'**i18n utilisateur** (§7) : là, tout texte affiché passe par `useT`.

---

## 2. Nommage des fichiers

| Type | Convention | Exemple |
|---|---|---|
| Use case | `PascalCase` + suffixe `UseCase.ts` (verbe FR) | `GenererBulletinUseCase.ts` |
| Entité domaine | `PascalCase.ts` (FR) | `Bulletin.ts`, `Classe.ts` |
| Port repository | `PascalCase` + `Repository.ts` (interface) | `NoteRepository.ts` |
| Repository Prisma | `Prisma<Nom>Repository.ts` | `PrismaBulletinRepository.ts` |
| Controller | `PascalCase` + `Controller.ts` | `ReportCardController.ts` |
| Route Express | `<domaine>.routes.ts`, export `creer<Domaine>Routes(...)` | `grade.routes.ts` |
| Service (adapter) | `PascalCase` + `Service.ts` | `CampayPaiementService.ts` |
| Section frontend | `Section<Nom>.tsx` dans `_components/` | `SectionBulletins.tsx` |
| Composant partagé | `PascalCase.tsx` | `AnimatedBackground.tsx` |
| Hook | `useXxx` | `useT`, `useLanguage` |
| Test | `<Nom>.test.ts` dans `tests/unit|integration/...` | `tests/unit/application/grade/SaisirNoteUseCase.test.ts` |
| i18n | `locales/{fr,en}/<namespace>.json` | `locales/fr/admin.json` |

---

## 3. Structure des dossiers (rappel — détail dans ARCHITECTURE/MODULE_INDEX)

- **Backend** = hexagonal : `domain/` (entities, ports, rules, types, value-objects, errors) → `application/<module>/` (use cases) → `infrastructure/` (http, persistence, services, config). Transverses : `services/`, `utils/`, `middleware/`, `inngest/`, `socket/`, `scripts/`. Tests centralisés dans `tests/` (`unit/` et `integration/`).
- **Frontend** = App Router : `app/<role>/dashboard/_components/Section*.tsx`, `components/`, `lib/`, `locales/`.
- **Un use case par fichier** ; regroupés par domaine ; `index.ts` de barrel par module.

---

## 4. Backend — règles hexagonales

1. **Sens des dépendances** : `domain` ne dépend de rien ; `application` dépend de `domain` (ports + entités) ; `infrastructure` dépend des deux. **Jamais l'inverse.**
2. **Use cases** : dépendances par **injection de constructeur** (interfaces/ports uniquement). Méthode publique `execute(commande)`. **Zéro accès direct à Prisma/HTTP** — `application/` ne dépend que de ports (`domain/ports/`). Règle exécutable : `backend/tests/unit/p1ArchitectureGuard.test.ts` échoue si `@prisma/client` / `this.prisma` / `ctx.prisma` réapparaît dans `application/`.
3. **Validation d'autorisation** dans le use case quand c'est du métier (ex. `if (commande.demandeurRole !== 'ADMIN') throw`), + `requireRole` au niveau route (défense en profondeur).
4. **Multi-tenant** : toute requête Prisma **doit** filtrer par `schoolId` (`req.user!.schoolId`). Vérifier l'appartenance avant toute mutation/suppression.
5. **Câblage** : un nouveau use case s'instancie dans `infra/config/container.ts` ; une nouvelle route se monte dans `infra/config/hexagonal.bootstrap.ts`.
6. **Erreurs** : `throw new Error('message clair')` ou erreurs domaine typées (`domain/errors/`) ; le controller traduit en HTTP.
7. **Validation d'entrée** : Zod (`validation/`, `middleware/validate.ts`) côté controller/route.

---

## 5. Prisma & base de données (Fedora Linux)

- **Migrations** : `npx prisma migrate dev --name <nom> --skip-generate` depuis `backend/`.
- **`prisma generate`** : fonctionne normalement sous Fedora (binaire `.so`, plus de verrou `.dll` Windows). Arrêter le serveur dev/`prisma studio` avant de lancer la commande. Le repli `(prisma as any).monModele` n'est plus systématique (héritage Windows).
- **Nouveau modèle** = ajouter au `schema.prisma` + migration + index `@@index([schoolId])` par défaut. Respecter le style des modèles voisins (relations nommées, `onDelete: Cascade` cohérent).
- **Jamais** supprimer une colonne sans (i) preuve qu'elle n'est lue nulle part, (ii) retrait préalable du code, (iii) justification. En cas de doute : garder + documenter.

---

## 6. Frontend — composants & styles

1. **Styles inline + tokens CSS** : privilégier `style={{ ... }}` avec des **tokens** `var(--bg)`, `var(--surface)`, `var(--text)`, `var(--green)`, `var(--border)`… (définis dans `globals.css`). **Éviter les couleurs hex en dur** dans l'UI (sauf couleurs sémantiques volontaires : badges LV2, gradients d'avatar).
2. **Thème** : ne jamais coder une couleur qui ne réagit pas au thème sombre. Utiliser les tokens `.dark`. Le variant Tailwind sombre = `@custom-variant dark` (v4), pas `darkMode` dans le config.
3. **Sections** : un écran = `Section<Nom>.tsx` dans `app/<role>/dashboard/_components/`, props `{ onToast }` typiques, données via `fetchApi('/api/v2/...')`.
4. **Flexbox plein écran** : tout conteneur scrollable dans une colonne `flex` doit avoir **`minHeight: 0`** (sinon il pousse le contenu hors écran) ; les blocs fixes en `flexShrink: 0`. Préférer le **style inline** pour ces propriétés critiques (Tailwind v4 ne génère pas toujours `min-h-0`/`shrink-0` ici).
5. **Next.js** : cette version diffère des habitudes (`frontend/AGENTS.md`). Lire la doc locale (`node_modules/next/dist/docs/`) avant d'utiliser une API Next. `'use client'` en tête des composants interactifs.
6. **Formulaires** : `react-hook-form` + `zod` quand la complexité le justifie ; sinon `useState` local (cohérent avec l'existant).
7. **Pas d'`import()` dynamique de JSON** pour l'i18n (fragile ici) — imports statiques.

---

## 7. Internationalisation (règle non négociable)

- **Tout texte affiché** passe par `useT('<namespace>')('clé')`. Aucune chaîne UTF en dur destinée à l'utilisateur.
- **Parité stricte fr/en** : toute clé ajoutée dans `locales/fr/<ns>.json` doit exister dans `locales/en/<ns>.json` (et vice-versa). Vérifier la parité (mêmes clés, même nombre).
- **Namespaces** : `common, navigation, admin, teacher, staff, parent, student, grades, finance, discipline, errors, onboarding, hrSelfService`.
- **Langue du dashboard** : préférence personnelle FR/EN, stockée par `userId` dans `localStorage` (`zekoulabia_dashboard_lang_<userId>`). Deux comptes utilisant le même navigateur ne doivent jamais partager cette préférence. Le choix fait sur le login est repris pour le compte qui vient de se connecter.
- **Langue des contenus générés** : **une seule** fonction backend `resolveLanguage(subsystem, sectionCode?)` (`utils/languageHelper`). Elle reste limitée aux bulletins, documents, SMS et emails ; ne jamais la remplacer par la préférence d'interface d'un utilisateur.
- **Pages « universelles » (login, landing publique, onboarding)** : elles ne concernent **aucun établissement précis** (elles servent FR **et** EN). Elles utilisent la préférence publique `localStorage.zekoulabia_lang_override`, sans la propager à un autre compte connecté.
- **Prompts Groq / emails / SMS** : toujours injecter la langue via `resolveLanguage` (+ `instructionLangue` pour les prompts).

---

## 8. Conventions API

- Préfixe **`/api/v2/*`**. Auth par **cookie HTTP-only** (`credentials: 'include'` côté front).
- Réponse standard : `{ success: boolean, data?, message? }`.
- Middlewares systématiques : `requireAuth`, puis `requireRole('ADMIN'|'STAFF'|…)` selon le besoin, rate-limit sur les écritures sensibles.

---

## 9. Tests

- Tests unitaires de use cases avec des **repos/services in-memory** dans `tests/unit/application/<module>/helpers/`.
- `bun test` (ou `bun test tests/unit/domain/rules tests/unit/utils`). Ne pas casser les tests existants.
- **Smoke test runtime** : fichier temporaire `_smoke_*.ts` **dans `backend/`** exécuté avec `bun`, puis supprimé (voir [AGENTS.md](AGENTS.md)).

---

## 10. Git & sécurité

- Ne **jamais** `commit`/`push` ni opération git destructive sans demande explicite. Si on branche : créer une branche, ne pas travailler sur `main` par défaut.
- Fins de ligne : le repo est en **LF** (warnings CRLF sous Windows = bénins). Un `.gitattributes` (`* text=auto eol=lf`) peut être ajouté dans un commit dédié.
- Pas de secrets en dur ajoutés au repo. Respecter `.env`.

---

## 11. Documentation vivante

- Les fichiers `ARCHITECTURE.md`, `FEATURES.md`, `MODULE_INDEX.md`, `CONVENTIONS.md`, `AGENTS.md` font **partie du projet**.
- Toute évolution structurante (nouveau module/rôle/service externe/flux) → **proposer la mise à jour** du/des documents concernés dans le même lot.
