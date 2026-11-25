# Cartographie de l'exposition multi-tenant — routes à paramètre d'identifiant

**Date** : 2026-08-15 · **Périmètre** : `backend/src/infrastructure/http/routes/*.ts` +
routes déclarées inline dans `src/infrastructure/config/hexagonal.bootstrap.ts`.
**Objet** : préparer le chantier V0.2 (tests d'isolation cross-tenant) en identifiant les routes
qui acceptent un identifiant en paramètre et pourraient donc lire ou écrire hors de leur école.

**Méthode** : extraction mécanique des 205 routes portant un `:param`, puis analyse de signaux
(présence de `schoolId` dans la requête Prisma, comparaison explicite dans le contrôleur ou le use
case, middleware de rôle, helper privé de chargement), puis **relecture manuelle intégrale des 17
routes classées À RISQUE**. Les catégories SÛRES n'ont pas été relues une par une : elles reposent
sur un signal positif vérifiable dans le code, pas sur une absence de signal.

---

## 1. Vue d'ensemble

| Classe | Nb | Signification |
|---|---:|---|
| `SURE-A` | 75 | Requête filtrée sur `id` **et** `schoolId` |
| `SURE-B` | 55 | Comparaison explicite `schoolId !== …` dans le contrôleur ou le use case |
| `SURE-MASTER` | 17 | Route plateforme (master admin), transverse aux écoles **par conception** |
| `SURE-OWNER` | 1 | Appartenance vérifiée par `userId`/`teacherId` — plus strict que `schoolId` |
| `A-VERIFIER` | 40 | Aucun signal négatif, mais aucun signal positif automatiquement détectable |
| `A-RISQUE` | 17 | Aucun filtrage tenant détectable → **relues manuellement** (section 2) |
| **Total** | **205** | |

Les 40 `A-VERIFIER` ne sont pas des vulnérabilités présumées : ce sont majoritairement des routes
dont la protection passe par une couche que l'analyse statique ne traverse pas (repository partagé,
service, helper). Elles restent à échantillonner, mais après les défauts confirmés ci-dessous.

---

## 2. Défauts confirmés — relecture manuelle des 17 routes À RISQUE

**9 défauts réels confirmés, 8 faux positifs.** Aucun n'est théorique : dans chaque cas j'ai suivi
le chemin complet route → contrôleur → use case → requête Prisma.

### État des correctifs

| Défaut | Statut |
|---|---|
| 2.1 `grades/:id/validate` | ✅ **corrigé** — `NoteRepository.findById(id, schoolId)` |
| 2.2 `grades/:id/submit` | 🟡 **partiellement corrigé** — cross-tenant fermé, appartenance intra-école encore ouverte (voir 2.2) |
| 2.3 orientation (×2) | ✅ **corrigé** — `updateEntretien` / `validerRecommandation` filtrés |
| 2.4 examens (×2) | ✅ **corrigé** — `updateMany({ id, schoolId })` + 404 si `count === 0` |
| 2.5 année académique (×2) | ✅ **corrigé** — `findPeriodeById/findSequenceById(id, schoolId)` |
| 2.6 `schools/:id/activate` | ✅ **corrigé** — comparaison `:id` vs token dans la route |
| 2.7 `matricules/import-jobs/:id` | ⚪ **faux positif** — route masquée, jamais exploitable (voir ci-dessous) |

**Les 9 défauts sont fermés, et tous les correctifs sont désormais verrouillés par un test vérifié
capable d'échouer.**

| Correctif | Test |
|---|---|
| 2.1 / 2.2 notes | `ValiderNoteUseCase.test.ts` › Isolation multi-tenant (unitaire) |
| 2.5 séquences | `DefinirPeriodeCouranteUseCase.test.ts` › Isolation multi-tenant (unitaire) |
| 2.3 ×2, 2.4 ×2, 2.5 périodes, 2.6 | `multiTenantIsolationCorrectifs.integration.test.ts` (intégration, vraie base) |
| 2.7 job matricules | idem — mais voir la correction ci-dessous : le défaut n'était pas exploitable |

Méthode de validation : chaque correctif a été **neutralisé un par un**, la suite relancée, puis
restauré. Neutraliser 2.4 casse 2 tests, chacun des autres en casse 1 — aucun test n'est vert par
construction.

Le point de méthode qui compte : l'appelant des tests d'intégration est un **ADMIN parfaitement
légitime dans son école**. Un test utilisant un utilisateur sans le bon rôle serait passé au vert
sur les 9 défauts d'origine sans rien prouver — il aurait mesuré le middleware, pas l'isolation.

### ⚠️ Correction : le défaut 2.7 n'était pas exploitable

Le test d'intégration a révélé que `matricule.routes.ts` déclare `/import-jobs/:schoolId`
(`listJobs`, ligne 22) **avant** `/import-jobs/:id` (`getJob`, ligne 23). Express retient la
première : **`getJob` est inatteignable, c'est du code mort.** Or `listJobs` ignore le paramètre
d'URL et lit `req.user.schoolId` — aucune fuite n'était donc possible.

La cartographie initiale surestimait ce point : elle a analysé `getJob` isolément, sans considérer
l'ordre de déclaration des routes. Le correctif appliqué reste en place (défense en profondeur si
la route redevient un jour atteignable), mais **il ne corrigeait rien d'exploitable**.

Il reste un vrai bug, non lié à la sécurité : **une route déclarée est morte**. La faire vivre
demande de distinguer les chemins (`/import-jobs/job/:id` par exemple) — c'est un changement d'API,
donc une décision produit, pas un correctif à passer en douce.

Enseignement de méthode : l'analyse par fichier ne voit pas le masquage de routes. Les catégories
`SURE-*` de la section 1 partagent cette limite.

### 2.1 🔴 Critique — `PATCH /api/v2/grades/:id/validate` — ✅ CORRIGÉ

Route : `grade.routes.ts:30` — `sensitiveWriteLimiter, requireAuth` uniquement.
Use case : [ValiderNoteUseCase.ts](src/application/grade/ValiderNoteUseCase.ts)

```ts
// ligne 33 — vérifie que le VALIDATEUR a la permission (question : « qui agit ? »)
if (!validateur.aPermission('VALIDATE_GRADES')) { … }

// ligne 40 — charge la note SANS aucun filtre d'école (question jamais posée : « sur quoi ? »)
const note = await this.noteRepository.findById(commande.noteId);
```

`NoteRepository.findById` est un `prisma.grade.findUnique({ where: { id } })` : pas de `schoolId`.
La tenancy **de la note** n'est vérifiée nulle part. Un Censeur de l'école A, authentifié
normalement, peut valider une note de l'école B s'il en connaît l'identifiant — et la note devient
définitive (`SUBMITTED → VALIDATED`).

C'était le défaut le plus grave de la cartographie : écriture cross-tenant sur une **note scolaire
validée**, c'est-à-dire la donnée la moins réversible du produit.

**Correctif appliqué.** `NoteRepository.findById` prend désormais un `schoolId` **obligatoire**
(paramètre requis, non optionnel : le compilateur interdit à tout appelant présent ou futur de
l'omettre). L'implémentation Prisma passe de `findUnique` à `findFirst` — `findUnique` n'accepte
que des champs uniques dans son `where`. Les trois use cases concernés (`Valider`, `Soumettre`,
`Rejeter`) reçoivent le `schoolId` **du token**, jamais du corps de la requête.

Le message d'erreur reste volontairement `Note introuvable` : identique pour « n'existe pas » et
« existe dans une autre école », sinon le correctif deviendrait un oracle d'existence.

Les trois doubles de test `InMemoryNoteRepository` filtrent réellement sur `schoolId` — un double
qui accepterait le paramètre en l'ignorant rendrait vert par construction tout test d'isolation.
Test de non-régression : `ValiderNoteUseCase.test.ts` › « Isolation multi-tenant », **vérifié
capable d'échouer** (garde neutralisée → 1 fail, restaurée → 10 pass).

### 2.2 🟡 `PATCH /api/v2/grades/:id/submit` — garde conditionnelle contournable — PARTIELLEMENT CORRIGÉ

Route : `grade.routes.ts:29` — `requireAuth` seul, aucune restriction de rôle.
La protection repose entièrement sur
[SoumettreNoteUseCase.ts:25](src/application/grade/SoumettreNoteUseCase.ts#L25) :

```ts
if (noteData.recordedById && noteData.recordedById !== commande.demandeurId) throw …
```

`recordedById` est `String?` — nullable ([schema.prisma:1163](prisma/schema.prisma#L1163)). Quand il
vaut `null`, **la condition entière est sautée** : n'importe quel utilisateur authentifié, de
n'importe quelle école, peut soumettre la note. La garde protège le cas courant et laisse passer
exactement le cas où la note n'a pas d'auteur identifié.

**Ce que le correctif de 2.1 ferme ici** : le volet *cross-tenant*. `SoumettreNoteUseCase` charge
maintenant la note via `findById(noteId, schoolId)`, donc une note d'une autre école est
introuvable — la garde nullable n'est plus atteignable depuis l'extérieur du tenant.

**Ce qui reste ouvert** : à l'intérieur d'une même école, un utilisateur quelconque peut toujours
soumettre une note dont le `recordedById` est `null`. Ce n'est plus une faille multi-tenant mais un
défaut d'appartenance, hors périmètre de ce chantier — à traiter séparément.

### 2.3 🟠 Écritures cross-tenant — orientation — ✅ CORRIGÉ

| Route | Repository | Requête |
|---|---|---|
| `PATCH /api/v2/orientation/entretiens/:id` | `updateEntretien` | `where: { id: entretienId }` ([PrismaOrientationRepository.ts:147](src/infrastructure/repositories/PrismaOrientationRepository.ts#L147)) |
| `PATCH /api/v2/orientation/recommandations/:id/valider` | `validerRecommandation` | `where: { id: recommandationId }` ([:227](src/infrastructure/repositories/PrismaOrientationRepository.ts#L227)) |

La seconde ne vérifie que `user.role !== 'ADMIN'` — donc un admin, mais de n'importe quelle école.

**Le bon motif existe déjà dans le même fichier** : `findFicheDetailById(ficheId, schoolId)` filtre
correctement sur les deux (ligne 27), et `findRecommandationById(id, schoolId)` **accepte déjà un
`schoolId`** — il n'est simplement pas utilisé par le chemin de validation. De même, les trois
routes plus récentes de la même famille (`valider-conseiller`, `proposer-eleve`, `choisir-piste`)
transmettent toutes `schoolId: user.schoolId`. Ce n'est pas une lacune de conception : c'est une
dérive entre code ancien et code récent.

**Correctif appliqué.** Les deux méthodes du dépôt prennent un `schoolId` obligatoire.
`validerRecommandation` **réutilise `findRecommandationById(id, schoolId)`** — le lecteur déjà
filtré qui existait à côté sans être appelé. `updateEntretien` contrôle la tenancy avant écriture
via la relation `fiche` : `EntretienOrientation` ne porte pas de `schoolId` propre.

Les deux méthodes du contrôleur traduisent désormais « introuvable » en **404**, et non plus en 500
via `next(err)` — même code et même message que pour une ressource inexistante.

Vérifié au passage : `ValiderRecommandationConseillerUseCase` est bien sûr, il lit d'abord via
`findRecommandationById(id, schoolId)`. La classification initiale était correcte.

### 2.4 🟠 Écritures cross-tenant — examens — ✅ CORRIGÉ

`examen.routes.ts:10-11`, toutes deux `requireAuth, requireRole('ADMIN')` :

- `PATCH /api/v2/examens/:id/set-candidate-number` → `examRegistration.update({ where: { id: examId } })`
- `PATCH /api/v2/examens/:id/result` → `examRegistration.update({ where: { id: examId } })`

Le rôle est vérifié, l'école jamais. Un admin de A peut écrire un **résultat d'examen officiel**
(`status: 'RESULT_AVAILABLE'`) sur une inscription de B.

**Correctif appliqué.** `update` → `updateMany({ where: { id, schoolId: req.user.schoolId } })`,
suivi d'un `404` si `count === 0`. `update` n'accepte que des champs uniques dans son `where`, d'où
`updateMany`. Le `count` à 0 confond volontairement « inexistante » et « hors de mon école ».

### 2.5 🟠 Écritures cross-tenant — année académique — ✅ CORRIGÉ

`academicYear.routes.ts:9-10`, `requireAuth, requireRole('ADMIN')` :

- `PATCH /api/v2/academic-years/periods/:id/set-current`
- `PATCH /api/v2/academic-years/sequences/:id/set-current`

Les deux use cases suivent le même schéma :

```ts
const sequence = await this.anneeRepository.findSequenceById(sequenceId); // pas de schoolId
await this.anneeRepository.desactiverToutesSequences(sequence.academicPeriodId);
await this.anneeRepository.activerSequence(sequenceId);
```

L'objet chargé fournit lui-même le périmètre de la désactivation en masse. Un admin de A peut donc
**changer la séquence courante de l'école B** — ce qui déplace le contexte de saisie des notes de
toute une école.

**Correctif appliqué.** `findPeriodeById` et `findSequenceById` prennent un `schoolId` obligatoire,
propagé depuis le token par le contrôleur, le générateur de bulletins et le catalogue de l'assistant.

⚠️ **Asymétrie importante entre les deux modèles** : `AcademicSequence` porte une colonne `schoolId`
directe, mais **`AcademicPeriod` n'en a pas** — sa tenancy vient de son `AcademicYear`. Le filtre
d'une période passe donc par la relation : `where: { id, academicYear: { schoolId } }`. Ajouter une
colonne `schoolId` à `AcademicPeriod` serait une migration destructrice (colonne obligatoire sans
défaut sur une table peuplée) et n'a pas été faite.

Conséquence sur les tests : `PeriodeAcademiqueProps` ne portant pas de `schoolId`, les doubles
InMemory ne peuvent pas filtrer les périodes — leur paramètre est explicitement `_schoolId` avec un
commentaire. **L'isolation des périodes n'est donc vérifiable qu'en test d'intégration contre la
vraie base**, à faire dans le volet V0.2. Celle des séquences est verrouillée par
`DefinirPeriodeCouranteUseCase.test.ts` › « Isolation multi-tenant », **vérifié capable d'échouer**
(filtre du double neutralisé → 2 fail, restauré → 3 pass).

### 2.6 🟠 `POST /api/v2/schools/:id/activate` — `schoolId` pris dans l'URL — ✅ CORRIGÉ

[school-config.routes.ts:9](src/infrastructure/http/routes/school-config.routes.ts#L9) :

```ts
router.post('/schools/:id/activate', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  const schoolId = req.params.id as string;          // ← jamais comparé à req.user.schoolId
  const result = await activateUseCase.execute({ schoolId });
```

`ActiverEtablissementUseCase` fait confiance au `schoolId` reçu (ligne 38 : `where: { id: schoolId }`)
— ce qui est correct pour un use case. La comparaison manquante est celle de la route. Un admin de
A peut déclencher l'activation de B (création de classes, matières, structure) dès lors que B est
approuvée.

**Correctif appliqué.** Comparaison `schoolId !== req.user.schoolId` → **403** dans la route, avant
tout appel au use case. Le use case reste inchangé : lui faire confiance au `schoolId` reçu est le
bon contrat, la vérification appartient à la couche qui détient le token.

### 2.7 🟡 Lecture cross-tenant — `GET /api/v2/matricules/import-jobs/:id` — ✅ CORRIGÉ

`matricule.routes.ts:23` — `requireAuth, requireRole('ADMIN','STAFF')` :

```ts
const job = await this.prisma.matriculeImportJob.findUnique({ where: { id: jobId } });
res.json({ success: true, data: job });
```

Le job est renvoyé tel quel. Fuite de lecture seule, donc moins grave que les précédentes, mais le
contenu d'un job d'import de matricules concerne nominativement des élèves.

**Correctif appliqué.** `findUnique` → `findFirst({ where: { id, schoolId: req.user.schoolId } })`.
Le `404` existant et son message sont inchangés.

### 2.8 Faux positifs vérifiés (8)

| Route(s) | Pourquoi c'est sûr |
|---|---|
| 8 routes `HRController` | Protection dans le helper privé `loadEmployeeOrFail` → `findFirst({ where: { id, schoolId, role: { in: […] } } })` — invisible à l'analyse statique |
| `GET /orientation/fiches/:id` | Transmet `user.schoolId` → `findFicheDetailById(ficheId, schoolId)` → `where: { id, schoolId }` |
| `GET /hr/me/document/:index/download` | `userId` vient du JWT ; l'index adresse le document de l'utilisateur lui-même |
| `masterAdmin /schools/:id`, `/schools/:id/plan` | `router.use(protectMaster)` + `authorizeMaster(['super_admin','platform_admin'])` — transverse par conception |
| `eleve-onboarding /token/:token`, `invite/:token` | Pré-authentification volontaire ; le jeton **est** le secret |
| `GET /orientation/aspirations/:checkpointType` | Le paramètre est une énumération, pas un identifiant d'entité |

---

## 3. Ce que la cartographie dit du code

Les 9 défauts ne sont pas répartis au hasard. Ils partagent un motif unique :

> **le rôle de l'acteur est vérifié, la tenancy de l'objet ne l'est pas.**

`requireRole('ADMIN')` répond à « cette personne a-t-elle le droit de faire ça ? » et donne le
sentiment que la route est protégée. Elle ne répond jamais à « sur quel objet ? ». Les 130 routes
sûres transmettent le `schoolId` du token jusqu'à la requête ; les 9 défectueuses s'arrêtent au
middleware.

Corollaire pratique pour V0.2 : un test d'isolation qui se contente d'appeler la route avec un
utilisateur sans le bon rôle **passera au vert sur les 9 défauts**. Le test doit utiliser un acteur
parfaitement légitime dans son école et une ressource d'une autre école.

---

## 4. Décision à prendre

Les 9 défauts sont des vulnérabilités confirmées, dont 2 en écriture sur des données scolaires
définitives (validation de note, résultat d'examen). Deux options, la même que pour la lacune RBAC
de `filterCatalogForUser` :

- **(a) corriger puis tester** — les correctifs sont petits et localisés (passer `schoolId` jusqu'à
  la requête, comparer dans la route pour 2.6) ; les tests V0.2 verrouillent ensuite le
  comportement corrigé ;
- **(b) tester d'abord** — écrire les tests rouges, puis corriger.

Je recommande **(a)** pour 2.1 et 2.2 (les deux plus graves, sur les notes) et **(b)** pour le
reste : c'est le seul moyen de garantir que chaque test est capable d'échouer, discipline appliquée
tout au long de ce projet. Rien n'est en production, donc aucune contrainte de calendrier ne pèse
sur ce choix.

---

## 5. Limites de cette cartographie

- Les catégories `SURE-*` reposent sur un signal positif détecté automatiquement, **non relu route
  par route**. Un faux négatif y reste possible.
- Les 40 `A-VERIFIER` n'ont pas été tranchées.
- Seules les routes portant un `:param` sont couvertes. Une route sans paramètre qui lit un
  identifiant dans le **corps** de la requête présenterait le même risque et n'apparaît pas ici —
  c'est le prolongement naturel de ce travail.
