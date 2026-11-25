# ANALYSE COMPLÈTE DU PROJET EDUNEXUS / ZEKOULABIA

> Audit exhaustif réalisé le 30 juillet 2026 — couvre backend, frontend, base de données, documentation.
> Méthodologie : lecture de toute la documentation projet + exploration complète des arborescences + lecture de ~50 fichiers clés + recherche de patterns à risque.

---

## SOMMAIRE

1. [Vue d'ensemble](#1-vue-densemble)
2. [Problèmes critiques](#2-problèmes-critiques)
3. [Problèmes majeurs](#3-problèmes-majeurs)
4. [Problèmes mineurs](#4-problèmes-mineurs)
5. [Suggestions & améliorations](#5-suggestions--améliorations)
6. [Ce qui est sain](#6-ce-qui-est-sain)
7. [Sections manquantes / à développer](#7-sections-manquantes--à-développer)
8. [Risques techniques](#8-risques-techniques)

---

## 1. Vue d'ensemble

| Métrique | Valeur |
|---|---|
| **Taille du backend** | ~430 fichiers dans `src/` |
| **Taille du frontend** | ~165 fichiers dans `src/` |
| **Modèles Prisma** | 89 modèles, 52 enums |
| **Migrations** | 48 migrations (16 juin → 28 juillet 2026) |
| **Use cases** | ~130+ dans 30+ modules |
| **Controllers** | 56 controllers REST |
| **Routes** | 56+ fichiers de routes |
| **Tests** | ~25 tests unitaires, 3 tests d'intégration |
| **Fichiers i18n** | 26 (13 FR + 13 EN), parité parfaite |
| **Sections frontend** | ~60 composants Section* répartis sur 6 rôles |

---

## 2. Problèmes critiques

### C1 — Route dupliquée `PATCH /api/v2/school/profile` (hexagonal.bootstrap.ts)

**Fichier :** `backend/src/infrastructure/config/hexagonal.bootstrap.ts:427` ET `:1903`

Deux handlers Express différents pour la **même route**. Le second (l.1903) est **mort** — Express utilise toujours la première définition. Le premier handler (l.427) gère `minesecSchoolCode` ; le second ne gère que `name, city, phone, email`. Incohérence fonctionnelle.

### C2 — Secret JWT en clair dans le code source

**Fichier :** `backend/src/infrastructure/services/JwtTokenService.ts:8`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'zekoulabia-secret-change-in-production';
```

Si la variable d'environnement `JWT_SECRET` manque en production, n'importe qui lisant le code peut forger des JWT valides. Même risque dans `backend/src/middleware/auth.ts:26` et `authMultiTenant.ts`.

### C3 — DisciplineCouncilController instancie ses propres use cases (DI brisée)

**Fichier :** `backend/src/infrastructure/http/controllers/DisciplineCouncilController.ts:12-19`

```typescript
constructor(private readonly prisma: PrismaClient) {
    this.convoquer = new ConvoquerConseilDisciplineUseCase(prisma);
    this.tenir = new TenirConseilDisciplineUseCase(prisma);
}
```

**Seul** controller dans toute la codebase qui viole le principe d'injection de dépendances. Tous les autres controllers reçoivent leurs use cases par le constructeur. Impossible à tester unitairement sans Prisma.

### C4 — JWT secret fallback partagé entre admin, master et groupe

**Fichier :** `backend/src/middleware/authMultiTenant.ts:6-7`
```typescript
const MASTER_JWT_SECRET = process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET;
```

Le master JWT secret **retombe** sur le JWT_SECRET standard. Si un attaquant compromet le JWT d'un utilisateur standard, il peut aussi usurper le master. Les secrets **doivent être indépendants**.

### C5 — Firebase/Admin SDK non trouvé mais importé potentiellement

L'import de `@capacitor/push-notifications` est mentionné dans ARCHITECTURE.md comme prévu pour plus tard — mais l'absence de `firebase-admin` dans le package.json du backend suggère que les notifications push web utilisent `web-push` (bien), mais le package `firebase-admin` pourrait manquer pour certaines fonctionnalités.

---

## 3. Problèmes majeurs

### M1 — `(prisma as any).monModele` massif (~200 occurrences)

**Fichiers :** ~30 fichiers dans `application/`, particulièrement `entranceExam/`, `pebsExam/`, `eleveOnboarding/`, `academicEvent/`, `lv2Choice/`, `statisticalCampaign/`, `assistant/`, `matricule/`, `suivi/`, `discipline/`, `student/`, `paiementMinesec/`

**Cause racine documentée :** `prisma generate` échoue sur Windows (EPERM verrou DLL). La parade `(prisma as any).monModele` contourne **totalement** la vérification de types TypeScript — aucune faute de frappe, aucune incohérence de relation, aucun oubli de champ n'est détecté à la compilation.

**Risque :** Une migration renomme un champ → pas d'erreur TS → erreur runtime en production.

### M2 — `req.user!` sans vérification de middleware (~230 occurrences)

**Fichiers :** `hexagonal.bootstrap.ts` (60+ occurrences), tous les controllers

L'opérateur `!` suppose que `requireAuth` a toujours été appelé avant. Mais :
- `backend/src/infrastructure/http/routes/ai.routes.ts:10-11` : `requireRole('ADMIN', 'STAFF')` sans `requireAuth` en amont
- Plusieurs routes directes dans `hexagonal.bootstrap.ts` n'ont pas de vérification d'auth systématique

### M3 — Logique métier inline dans `hexagonal.bootstrap.ts` (2869 lignes !)

Le fichier est un monstre de **2869 lignes** qui mélange :
- Définition de classes/controllers (ok)
- Routes déléguées (ok)
- **Logique métier inline** — discipline (l.1923-2050, ~130 lignes), bibliothèque (l.2054-2109), emplois du temps (l.2110-2633), A-Level (l.2635-2775), teacher roster (l.2777-2857)
- Commentaires de chantier : `"Chantier Juillet 2026"` (l.1968)

C'est une **violation directe de l'architecture hexagonale** que le projet prétend suivre.

### M4 — `console.log/warn/error` non structurés (~200 occurrences)

Aucun logger structuré (pino, winston, etc.). Utilisation directe de `console.*` partout, y compris :
- `emailService.ts:88` — expose `OTP` en mode dev
- `SmsNotificationService.ts` — 20+ `console.error` catch-all  
- `functions.ts` (Inngest) — 20+ `console.error`
- `groq.ts:38` — log l'erreur mais pas assez contextuelle

### M5 — Container DI incomplet (modules contournés)

**Fichier :** `backend/src/infrastructure/config/container.ts`

Le container est censé être la **composition root unique**. Des modules entiers sont instanciés **ailleurs** :

| Module | Où est instancié | Problème |
|---|---|---|
| `discipline/` | Dans `DisciplineCouncilController` | DI brisée |
| `suivi/` | Dans `hexagonal.bootstrap.ts` | Direct, pas de container |
| `academicEvent/` | Dans `AcademicEventController` | Direct |
| `student/` (AffecterLV2, AffecterPEBS...) | Dans `hexagonal.bootstrap.ts` | Direct |
| `statisticalCampaign/` | Dans `hexagonal.bootstrap.ts` | Direct |

### M6 — Composant SectionGrilleHoraire dupliqué

- `frontend/src/app/admin/dashboard/_components/SectionGrilleHoraire.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionGrilleHoraire.tsx`

Quasi identiques (2 lignes de différence). Devrait être mutualisé dans `frontend/src/components/`.

### M7 — `react-router-dom` dans le package.json racine

**Fichier :** `package.json:9` — dépendance inutile dans un projet Next.js (qui a son propre routeur). Résidu d'une version antérieure ou tentative de nesting hasardeuse.

### M8 — Absence de préfixe `@infrastructure/` dans certains imports

- `disciplineCouncil.routes.ts:2` : `import { requireAuth } from '../../../middleware/auth'` au lieu de `@infrastructure/...`
- `hexagonal.bootstrap.ts:23` : `import { protectMaster } from '../../middleware/authMultiTenant'`

Incohérence avec le reste du code qui utilise les alias.

---

## 4. Problèmes mineurs

### m1 — `classSerieValidator.ts` : points-virgules inconsistants

**Fichier :** `backend/src/lib/classSerieValidator.ts` — mélange de style avec/sans points-virgules sur ~10 lignes.

### m2 — Mutation d'objets Error via `(err as any)`

**Fichier :** `ConnecterUtilisateurUseCase.ts:71,91`
```typescript
(err as any).availableRoles = rolesDisponibles;
```

Fragile, perte de typage. Pattern à remplacer par des classes d'erreur domaine typées.

### m3 — Index manquants sur `schoolId` dans le schéma Prisma

| Modèle | Ligne | Problème |
|---|---|---|
| `StudentRecommendation` | 292 | Pas d'index `schoolId` |
| `StudentFollowUpAction` | 314 | Pas d'index `schoolId` simple |

Toutes les requêtes multi-tenant filtrent par `schoolId` — ces modèles feront des **full table scans** sur des tables potentiellement grandes.

### m4 — `FRONTEND_URL`/`CLIENT_URL` dupliqué 9 fois

Le pattern `process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'` apparaît dans 9 fichiers. Devrait être centralisé.

### m5 — `StudentRecommendation` a deux index identiques

```prisma
@@index([schoolId, studentId])
@@index([schoolId, studentId])  // doublon !
```

Ligne 292+ — le deuxième index est **exactement identique** au premier. Doublon coûteux en écriture.

### m6 — Hardcoded `'notifications@chri.app'` comme fallback EMAIL_FROM

**Fichier :** `emailService.ts:64` — adresse email en dur. Si l'équipe change de nom, le fallback enverra des emails d'un domaine possiblement non contrôlé.

### m7 — Route `/api/v2/assistant/chat` mal positionnée

**Fichier :** `hexagonal.bootstrap.ts:1442` — montée sur `app.post` directement (pas via un routeur), utilise `aiController` alors que les autres routes assistant utilisent `assistantController`.

---

## 5. Suggestions & améliorations

### s1 — Centraliser la configuration des URLs

Créer `backend/src/lib/env.ts` :
```typescript
export const getFrontendUrl = (): string =>
  process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
```

### s2 — Logger structuré

Remplacer `console.*` par `pino` ou `winston` avec :
- `logger.info()` / `logger.warn()` / `logger.error()` / `logger.debug()`
- Niveaux configurables via `LOG_LEVEL`
- Suppression des OTP en dev mode

### s3 — Extraire la logique inline du bootstrap

**2869 lignes** dans `hexagonal.bootstrap.ts`. Extraire dans :
- `infrastructure/http/handlers/discipline.handler.ts`
- `infrastructure/http/handlers/library.handler.ts`
- `infrastructure/http/handlers/timetable.handler.ts`
- `infrastructure/http/handlers/alevel.handler.ts`
- `infrastructure/http/handlers/teacherRoster.handler.ts`

### s4 — Mutualiser SectionGrilleHoraire

Déplacer `SectionGrilleHoraire.tsx` dans `frontend/src/components/` (ou `frontend/src/components/shared/`) et l'importer depuis admin et staff.

### s5 — Ajouter des index manquants

Migration pour ajouter :
```prisma
@@index([schoolId])  // StudentRecommendation
@@index([schoolId])  // StudentFollowUpAction
```

Et supprimer l'index dupliqué sur `StudentRecommendation`.

### s6 — Tests

Seulement ~25 tests unitaires pour ~130 use cases (taux de couverture < 20%). Les modules les plus critiques (finances, onboarding, assistant, entranceExam, pebsExam) ont **zéro test**. Priorité :
1. `TraiterWebhookCampayUseCase` (argent réel)
2. `GenererBulletinUseCase` (données critiques)
3. `CreerSessionConcoursUseCase` / `EnregistrerResultatCepUseCase` (processus légal)
4. `DisciplineCouncilController` (actuellement non testable)

### s7 — Améliorer la gestion des erreurs Fire-and-Forget

Plusieurs `void (async () => { ... })()` dans le code pour des notifications fire-and-forget. Ces promesses non attendues compliquent le débogage. Envisager une queue Inngest pour ces tâches.

### s8 — Configurer le linting

Aucun linting configuré (pas de `.eslintrc`, pas de `biome.json`). Ajouter Biome ou ESLint pour forcer les conventions de style et détecter les problèmes courants.

### s9 — Supprimer `react-router-dom` des dépendances racine

**Fichier :** `package.json` — ligne 9 : `"react-router-dom": "^7.14.2"`. Inutile avec Next.js.

### s10 — Revoir le duplex `(prisma as any)` pour les modèles non générés

Envisager un module `prismaModels.ts` qui mappe explicitement les noms de modèles :
```typescript
export const models = {
  entranceExamCandidate: () => (prisma as any).entranceExamCandidate,
  pebsExamSession: () => (prisma as any).pebsExamSession,
  // ...
};
```

Au moins centraliser le `as any` pour faciliter une future migration.

### s11 — Correction des Seuils de mention Bulletin

**Fichiers :** `GenererBulletinUseCase.ts:158-164`, `reportCards/helpers.ts:4-39`

Les seuils de mention `mentionApc` (11 = ECA) et `mentionFr` (8 = Insuffisant, 6 = Très Insuffisant) sont **définis en DEUX endroits** différents (use case + helpers), avec des valeurs cohérentes aujourd'hui mais qui dériveront inévitablement. Fusionner dans `domain/rules/` (dans `BulletinPolicy.ts` ou un nouveau `MentionRules.ts`).

---

## 6. Ce qui est sain

| Élément | Statut |
|---|---|
| **Architecture hexagonale** (couches domain/application/infrastructure) | ✅ Bien établie, respectée dans 90% des cas |
| **i18n FR/EN — parité parfaite** | ✅ 26 fichiers, 0 clé manquante |
| **Multi-tenant via schoolId** | ✅ Appliqué partout |
| **Entités domaine** (Bulletin, School, User, Classe...) | ✅ Bien encapsulées, getters, factories |
| **Séparation des rôles** (MASTER/ADMIN/STAFF/TEACHER/PARENT/STUDENT) | ✅ Middleware requireAuth + requireRole |
| **Onboarding 2 phases** (wizard + conversationnel) | ✅ Implémenté proprement |
| **Langue via resolveLanguage** (source unique) | ✅ Respecté partout |
| **Tests unitaires existants** | ✅ Bien structurés (helpers in-memory) |
| **Gestion des migrations PostgreSQL** | ✅ 48 migrations propres |
| **Modèle Prisma riche** | ✅ 89 modèles, 52 enums couvrant le système éducatif camerounais |
| **Sections frontend toutes importées** | ✅ Composants Section* utilisés dans les pages |
| **Gestion des fichiers temporaires** | ✅ Règle de suppression des `_smoke_*` |

---

## 7. Sections manquantes / à développer

### Fonctionnalités annoncées non implémentées ou partielles

| Feature | Statut | Notes |
|---|---|---|
| **Capacitor (empaquetage mobile)** | Non démarré | Documenté comme "plus tard" dans ARCHITECTURE.md |
| **Son personnalisé des notifications push** | Bloqué | Limite navigateur, pas avant Capacitor |
| **Conseil de Discipline Art. 30 workflow complet** | Partiel | Logique inline dans bootstrap + chantier Juillet 2026 mentionné |
| **Messagerie in-app** | Vide | `application/messaging/.gitkeep` — pas de use cases implémentés |
| **Notifications push avancées** | Partiel | Web Push basique fonctionnel, pas de fallback FCM/APNs |
| **Groupe d'établissements** | Récent | Dernière migration 27 juillet — modules jeunes, tests manquants |
| **Checkpoint orientation** | Récent | Migration 27 juillet 2026 — très récent |
| **Suivi élève (StudentFollowUp)** | Récent | Migration 28 juillet 2026 — très récent |

### Tests manquants par module critique

| Module | Use cases | Tests existants |
|---|---|---|
| `finance/` | 10 UC | 4 tests (CreerPlanFrais, EnregistrerDepense, RembourserCaution, TraiterWebhook) |
| `entranceExam/` | 7 UC | **0 test** |
| `pebsExam/` | 7 UC | **0 test** |
| `lv2Choice/` | 5 UC | **0 test** |
| `school/` | 4 UC | 2 tests |
| `orientation/` | 15 UC | **0 test** |
| `schoolGroup/` | 12 UC | **0 test** |
| `assistant/` | catalog | **0 test** |
| `academicYear/` | 5 UC | 3 tests |

---

## 8. Risques techniques

### R1 — Stabilité runtime Windows (`prisma generate`)

Comme documenté, `prisma generate` échoue sur Windows (EPERM). La parade `(prisma as any)` fonctionne au runtime mais élimine toute sécurité de type. **Risque :** une refactor qui renomme un champ Prisma passe inaperçue jusqu'au runtime.

**Mitigation :** Exécuter `prisma generate` sur un environnement CI/CD Linux + copier le client généré. Ou utiliser WSL2 pour le développement.

### R2 — Base de test vide

Aucune école/élève en base de développement. Impossible de tester les flux de bout en bout. Les tests "smoke" sont déterministes mais ne couvrent pas les cas réels.

### R3 — Taux de couverture de tests < 20%

Pour un SaaS multi-tenant manipulant de l'argent (Mobile Money via Campay), des données sensibles (bulletins, notes) et des processus légaux (conseils de discipline, concours d'entrée), un investissement dans les tests est prioritaire.

### R4 — Absence de CI/CD

Aucun fichier `.github/workflows/` ou pipeline CI trouvé. La vérification TypeScript (`tsc --noEmit`) doit être exécutée manuellement.

### R5 — Monolithe `hexagonal.bootstrap.ts`

À 2869 lignes, ce fichier est un goulot d'étranglement :
- Difficile à reviewer
- Risque de conflits git élevé
- La logique inline (discipline, bibliothèque, EDT, A-Level, roster) dégrade l'architecture hexagonale

### R6 — Aucun linting/formatting configuré

Pas d'ESLint/Prettier/Biome. Le code a des incohérences de style (points-virgules, guillemets, espaces). Risque de divergence croissante entre les contributeurs.

---

## Résumé exécutif

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| **🔥 Immédiat** | C2 — Secret JWT en clair → forcer via `process.env.JWT_SECRET` avec `throw` si absent | 30 min | Sécurité |
| **🔥 Immédiat** | C1 — Supprimer la route dupliquée `PATCH /api/v2/school/profile` | 15 min | Stabilité |
| **🔥 Immédiat** | C4 — Séparer MASTER_JWT_SECRET de JWT_SECRET | 30 min | Sécurité |
| **🔥 Immédiat** | C5 — Supprimer `react-router-dom` de package.json | 5 min | Propreté |
| **⚠️ Haute** | M3 — Extraire la logique inline du bootstrap en handlers dédiés | 1-2 jours | Architecture |
| **⚠️ Haute** | M5 — Compléter le container DI pour tous les modules | 1 jour | Architecture |
| **⚠️ Haute** | s5 — Ajouter les index manquants + supprimer le doublon | 30 min | Performance |
| **⚠️ Haute** | m5 — Supprimer l'index dupliqué sur StudentRecommendation | 15 min | Performance |
| **⚠️ Haute** | M4 — Logger structuré (pino) | 2-3 jours | Maintenance |
| **⚠️ Haute** | s6 — Tests sur les modules critiques (finance, concours, PEBS) | 3-5 jours | Fiabilité |
| **🔄 Moyenne** | M1 — Centraliser `(prisma as any)` dans un module dédié | 1 jour | Maintenabilité |
| **🔄 Moyenne** | M6 — Mutualiser SectionGrilleHoraire | 1 heure | DRY |
| **🔄 Moyenne** | s1 — Centraliser `getFrontendUrl()` | 30 min | DRY |
| **🔄 Moyenne** | s8 — Configurer Biome/ESLint | 1-2 jours | Qualité |
| **🔄 Moyenne** | s11 — Fusionner les seuils de mention dans domain/rules/ | 1 heure | Cohérence |
| **📋 Basse** | m2 → Remplacer `(err as any)` par des classes d'erreur typées | 1 jour | Qualité |
| **📋 Basse** | m4 → Extraire discipline/bibliothèque/roster en handlers | 1 jour | Architecture |
| **📋 Basse** | s3 → Route assistant/chat mal positionnée → recâbler | 30 min | Architecture |
| **📋 Future** | Capacitor empaquetage mobile — plan détaillé : [Plan_Capacitor_Mobile_ZekoulABia.md](Plan_Capacitor_Mobile_ZekoulABia.md) | 2-3 sem (à revalider — voir Phase 0 du plan) | Feature |

---

*Document généré le 30 juillet 2026 — à mettre à jour après chaque phase de correction.*
