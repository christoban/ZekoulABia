# Analyse & Plan d'Architecture — Matérialisation de `OfficialProgrammeProgression` vers les `Programme` / `Chapitre` d'école

> **Statut** : **Document d'analyse et de planification uniquement (aucun code écrit pour ce chantier).** En attente de validation des décisions d'arbitrage (§11) avant toute implémentation.

---

## 1. Objectif

Permettre aux établissements scolaires et aux enseignants de consommer concrètement les **308 progressions officielles** (`OfficialProgrammeProgression`, 17 133 leçons) importées dans le référentiel national, en les matérialisant en `Programme` et `Chapitre` scopés par école et année académique, afin d'offrir :
1. Un suivi enseignant **leçon par leçon, groupé par module**, avec **taux de progression calculé sur le nombre de leçons** (et non sur des heures fictives).
2. La coexistence propre entre **coche directe sur la leçon** et **lien `CahierDeTexte.chapitreId`**.
3. Un premier lot livrable rapidement pour un **établissement pilote**, sans régression sur les écoles déjà actives.

---

## 2. Contexte — État actuel du code réel

### 2.1 Référentiel national (Master Admin)
- **Modèle Prisma** : [schema.prisma](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/backend/prisma/schema.prisma#L1151-L1169) — `OfficialProgrammeProgression` identifié par la clé unique `(templateCode, level, filiere, subjectName)`, avec `chapitres: Json` contenant `{ ordre, titre, volumeHeuresPrevu?, sequenceCibleFin?, moduleOrdre?, moduleTitre?, leconNumero?, numeroAffiche?, positionDansModule?, positionSource?, sourceUrl? }`, plus `importChecksum` et `manuallyEdited`.
- **Règle d'expansion des matières** : [officialProgressionSubjects.test.ts](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/backend/tests/unit/domain/rules/officialProgressionSubjects.test.ts#L1-L103) — `etendreMatieresReferenceImport` et `normaliserNiveauScolaire` (`4ème` → `4e`, `6ème` → `6e`, `1ère` → `1ere`). Les 308 progressions importées utilisent toutes `templateCode = "__ALL__"` et les **noms concrets** (`Latin`, `Grec`, `Allemand`, `Arabe`, `Chinois`, `Espagnol`, `Italien`, `Intensive English`, `SVTEEHB`, `Physique-Chimie-Technologie`, etc.).
- **Aucun lien actuel vers les écoles** : un `grep` sur `officialProgrammeProgression` dans `backend/src/` confirme que cette table n'est encore lue nulle part côté établissement (`activation`, `class`, `pedagogie`).

### 2.2 Modèle côté école (Pédagogie)
- **Modèles Prisma** : [schema.prisma](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/backend/prisma/schema.prisma#L3750-L3810) :
  - `Programme` : `(id, schoolId, subjectId, classId?, level?, academicYearId, titre)`. **Lacunes actuelles** : pas de `filiere` ni de référence `officialProgressionId` / `sourceChecksum`, pas de contrainte d'unicité sur `(schoolId, academicYearId, subjectId, classId)` ou `(level, filiere)`.
  - `Chapitre` : `(id, programmeId, titre, ordre, volumeHeuresPrevu @default(2), sequenceCibleFin?)`. **Lacunes actuelles** : pas de `moduleOrdre`, `moduleTitre`, `numeroAffiche`, `sourceKey` (pour le rapprochement lors d'une resynchronisation), ni de statut d'atelier optionnel (`actif` / `groupeAtelier`), ni de coche directe de réalisation.
  - `CahierDeTexte` : `(id, schoolId, teacherId, classId, subjectId, academicYearId, chapitreId?, date, contenuRealise?, contenuLibre?, devoirsDonnes?)`.
- **Résolution actuelle d'un programme** : [PrismaProgrammeRepository.ts](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/backend/src/infrastructure/persistence/prisma/PrismaProgrammeRepository.ts#L32-L37) :
  - `findByClassSubject(schoolId, subjectId, academicYearId, classId, level)` cherche `OR: [{ classId }, { level, classId: null }]` **sans `orderBy`** (si un programme spécifique à la classe ET un programme de niveau existent, l'ordre de retour est non déterministe !) et **sans distinction de filière** (`FR_GENERAL` vs `FR_PEBS` sur un même niveau `6e` pour `Français` ou `Mathématiques`, ou `2nde C` vs `2nde A4`!).
- **Calcul de progression actuel** : [CalculerProgressionProgrammeUseCase.ts](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/backend/src/application/pedagogie/CalculerProgressionProgrammeUseCase.ts#L79-L108) :
  - `chapitresAbordees` = `Set(entries.map(e => e.chapitreId))` (uniquement via `CahierDeTexte`).
  - `progressionPct = Math.round((chapitresRealises / chapitresTotal) * 100)` → **le pourcentage est déjà calculé par nombre de chapitres/leçons !** Seul l'affichage `({c.volumeHeuresPrevu}h)` dans [CahierSaisieTab.tsx](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/frontend/src/app/teacher/dashboard/_components/cahier/CahierSaisieTab.tsx#L130) et `totalHeuresPrevu`/`heuresRealisees` reposent encore sur `volumeHeuresPrevu = 2` par défaut.
- **Modèles `Class` & `Subject`** : [schema.prisma](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/backend/prisma/schema.prisma#L1315-L1411) :
  - `Class` possède déjà `level` (ex. `"6e"`, `"Form1"`), `filiere` (ex. `"FR_GENERAL"`, `"FR_PEBS"`, `"EN_GENERAL"`, `"EN_PEBS"`), `serie` (ex. `"C"`, `"D"`, `"A4"`, `"ABI"`), `pebsMixte: Boolean`.
  - `Subject` possède `name`, `isLV2: Boolean`, `restrictedToGroupId`.

---

## 3. Analyse approfondie des 6 questions techniques

### 3.1 Résolution du programme officiel pour une `(classe, matière)` d'école

Créer un **service de domaine pur** (`backend/src/domain/rules/officialProgressionResolution.ts`, zéro dépendance Prisma) qui, à partir de `(school.templateCode, classe.level, classe.filiere, classe.serie, classe.pebsMixte, subject.name)`, détermine la/les clé(s) candidates dans `OfficialProgrammeProgression` :

1. **Priorité de `templateCode`** : chercher d'abord `school.templateCode` (si une surcharge spécifique au template existe), sinon repli sur **`"__ALL__"`** (où vivent nos 308 progressions).
2. **Normalisation du niveau** : réutiliser `normaliserNiveauScolaire(classe.level)` (`6ème` → `6e`, `4ème` → `4e`, `1ère` → `1ere`, etc.).
3. **Résolution de la `filiere` cible** :
   - **1er cycle FR (`6e`–`3e`)** : `classe.filiere` (`FR_GENERAL` ou `FR_PEBS`). **Cas `pebsMixte === true`** : une classe `FR_GENERAL` mixte porte aussi des matières PEBS (`Intensive English`, `Citizenship Education`, `Sport and Physical Education`, `Manual Labour`) via `ClassSubjectOverride` (`activationReconciliation.ts` L179–248) → si la recherche dans `FR_GENERAL` ne trouve rien et `classe.pebsMixte === true`, basculer sur `FR_PEBS` !
   - **2nd cycle FR (`2nde`, `1ere`, `Tle`)** : utiliser **`classe.serie`** (`A1`–`A5`, `ABI`, `C`, `D`, `E`, `TI`, `SH`, `AC`), car `BacCoefficient` et l'import utilisent `filiere = serie` (et pour une classe `A4-Arabe` / `A4-Espagnol`, extraire la série `A4` avant le tiret, comme le fait déjà `SubjectAssignmentHelper.ts` L160).
   - **Anglophone (`Form1`–`Form5`)** : `classe.filiere` (`EN_GENERAL` ou `EN_PEBS`). **Cas `LowerSixth` / `UpperSixth`** : `EN_GENERAL` (unique filière dans `AnglophoneSubjectLoad`).
4. **Cas particuliers de matières** :
   - **Langues vivantes concrètes (`Allemand`, `Arabe`, `Chinois`, `Espagnol`, `Italien`)** : à l'onboarding (`activationReconciliation.ts` L96–114 et `SubjectAssignmentHelper.ts` L204–207), la matière en base d'école s'appelle déjà exactement `"Allemand"`, `"Espagnol"`, etc. → **matching direct 1-pour-1** sur `subject.name` ! (Zéro mapping spécial requis.)
   - **Matière composite `Lettres classiques (Latin/Grec)`** : aujourd'hui `premier-cycle.ts` injecte encore dans les écoles une matière `Subject.name = "Lettres classiques (Latin/Grec)"`, alors que le référentiel national stocke **`"Latin"`** (`6e`–`3e`) et **`"Grec"`** (`4e`–`3e`).
     - En **`6e` et `5e`** : seul `"Latin"` existe → résolution automatique sans ambiguïté vers `subjectName = "Latin"`.
     - En **`4e` et `3e`** : **deux programmes distincts existent (`Latin` et `Grec`)** → ne pas fusionner silencieusement ; proposer au choix explicite de l'école / de l'enseignant (ou de l'AP) lors de la matérialisation : *« Choisir le programme officiel : Latin ou Grec »* (ou créer un `Programme` par classe selon l'option choisie). Si l'école crée directement des matières `"Latin"` / `"Grec"`, le matching direct joue immédiatement.
   - **`Intensive English` (`FR_PEBS`)** : la matière en base d'école s'appelle déjà `"Intensive English"` (`premier-cycle.ts` L71) et le référentiel national contient déjà **1 seul** `OfficialProgrammeProgression` nommé `"Intensive English"` (fusion `Anglais` + `Literature awareness`, 9–11 modules) → **matching direct 1-pour-1 !**
   - **`Travail Manuel` (`6e`–`3e` `FR_GENERAL`) & `Manual Labour` (`FR_PEBS` / `EN_PEBS`)** : le programme officiel contient **3 ateliers par niveau** (ex. en `6e` : *Artisanat / kiosque* [M1, 32 lecs], *Production animale / poulets de chair* [M2–M3, 30 lecs], *Plants et pépinière* [M4–M5, 31 lecs] = 93 leçons), alors qu'une classe / un enseignant n'en réalise qu'**un seul** (ou un sous-ensemble) durant l'année.
     - **Impact critique sur le taux de progression** : si l'on compte les 93 leçons au dénominateur alors que l'enseignant ne fait qu'un atelier (30 leçons), son taux plafonnera à **32 %** toute l'année et déclenchera des fausses alertes de retard !
     - **Solution propre** : copier tous les modules/leçons du programme officiel, et permettre à l'enseignant (ou à l'AP) de **sélectionner les modules actifs** (ou de désactiver les modules des ateliers non retenus : champ `Chapitre.actif Boolean @default(true)` ou `Programme.modulesActifs`). Les chapitres désactivés restent visibles dans un tiroir « Modules non retenus / hors atelier » (réactivables en 1 clic, zéro perte de données) mais sont **exclus du dénominateur** du calcul de progression et des alertes de retard !

### 3.2 Quand copier & comment rester cohérent avec les mises à jour du référentiel national ?

| Moment de matérialisation | Avantages | Limites | Recommandation |
|---|---|---|---|
| **A. À l'activation d'une nouvelle école** (`ActiverEtablissementUseCase`) | L'école démarre immédiatement prête avec tous ses programmes dès le jour 1. | Ne couvre pas les écoles déjà actives ni les classes créées plus tard. | **Oui (Lot 2)**, best-effort idempotent dans la phase post-classes. |
| **B. À la création d'une classe** (`CreerClasseUseCase`) | Toute nouvelle classe ajoutée en cours d'année reçoit automatiquement ses programmes. | Ne couvre pas les classes existantes ni une mise à jour ultérieure du référentiel. | **Oui (Lot 2)**, best-effort idempotent. |
| **C. À la demande** (bouton admin/AP « Initialiser les programmes officiels » + lazy-init ou bouton « Charger le programme officiel » côté enseignant) | Couvre **immédiatement les écoles déjà actives**, zéro migration risquée sur les données existantes, permet de choisir Latin/Grec ou d'actualiser. | Demande 1 clic si A/B non encore branchés. | **Oui — PRIORITÉ Lot 1 (établissement pilote)** ! |

**Stratégie de cohérence si le Super Admin met à jour `OfficialProgrammeProgression` ensuite** :
- **Ne jamais écraser silencieusement un `Programme` d'école** (un enseignant peut déjà avoir lié des `CahierDeTexte` à des `Chapitre.id` ou coché des leçons !).
- **Mécanisme de synchronisation explicite (pattern `propose/apply` déjà standard sur ZekoulABia)** :
  1. Stocker sur `Programme` : `officialProgressionId String?` et `sourceChecksum String?` (copié depuis `OfficialProgrammeProgression.importChecksum`).
  2. Stocker sur `Chapitre` : `sourceKey String?` (clé stable `${moduleOrdre}:${positionDansModule}`, identique à la clé d'unicité de `chapitresNormalisation.ts`).
  3. Lorsqu'un `OfficialProgrammeProgression.importChecksum` diffère de `Programme.sourceChecksum`, afficher un badge discret côté Admin/AP : *« Mise à jour officielle disponible »*.
  4. L'action de resynchronisation (`propose` puis `apply` en transaction unique) :
     - **Met à jour** le titre/module des chapitres existants identifiés par `sourceKey` **sans changer leur `id`** (donc `CahierDeTexte.chapitreId` et les coches restent 100 % intacts !).
     - **Ajoute** les nouvelles leçons.
     - **Archive (`actif = false`)** plutôt que supprimer une leçon retirée du référentiel si elle est déjà référencée par un `CahierDeTexte` ou une coche (protection des données `AGENTS.md §2`).

### 3.3 Modèle côté école : 1 leçon = 1 `Chapitre` & gestion de `volumeHeuresPrevu`

- **Oui : chaque leçon de `OfficialProgrammeProgression.chapitres` devient 1 ligne `Chapitre`** rattachée au `Programme` de l'école.
  - Volume réaliste : une école secondaire type (ex. 12 niveaux × ~15 matières × ~55 leçons) = ~10 000 lignes `Chapitre` par année scolaire → parfaitement trivial pour PostgreSQL avec un index sur `(programmeId, ordre)` et `(programmeId, moduleOrdre)`.
  - **Scope recommandé du `Programme` d'école** : **1 `Programme` par `(schoolId, academicYearId, classId, subjectId)`** (scopé à la **classe**, plutôt que partagé par `level` seul). Pourquoi ?
    - Deux classes de `6e` peuvent être l'une `FR_GENERAL` et l'autre `FR_PEBS` (`Programme.level = "6e"` seul ne distingue pas la filière !).
    - En `Travail Manuel`, la `6e A` peut faire l'atelier *Artisanat* tandis que la `6e B` fait *Production animale* (et deux enseignants différents peuvent cocher leur avancement indépendamment par classe !).
    - `CalculerProgressionProgrammeUseCase` et `PrismaProgrammeRepository.findByClassSubject` supportent **déjà** `classId` en priorité (il faut juste ajouter `orderBy: { classId: 'asc' }` / préférer explicitement le match exact `classId` avant le fallback `classId: null` pour les programmes historiques créés par niveau).
- **Que faire de `volumeHeuresPrevu` (`Int @default(2)`) ?**
  - Les 308 progressions MINESEC importées n'ont **aucun volume horaire par leçon** (`volumeHeuresPrevu` absent du JSON).
  - Mettre `2` par défaut fausserait tous les compteurs d'heures (ex. `Français 6e` : 154 leçons × 2h = 308h affichées pour un cours de ~150h annuelles !).
  - **Recommandation** : rendre `Chapitre.volumeHeuresPrevu` **nullable (`Int?`)** (sans toucher aux lignes existantes qui gardent leur valeur), laisser `null` pour les leçons issues du référentiel MINESEC, et dans l'UI / les calculs :
    - **Afficher le taux et le compteur par nombre de leçons** (`12 / 67 leçons · 18 %`).
    - N'afficher les heures (`totalHeuresPrevu` / `heuresRealisees`) **que si au moins un chapitre du programme a `volumeHeuresPrevu != null`** (repli sûr, zéro régression pour les programmes manuels existants !).

### 3.4 Progression : coche directe enseignant + coexistence avec `CahierDeTexte.chapitreId`

Aujourd'hui, une leçon est considérée `realise = true` uniquement si `∃ CahierDeTexte` avec `chapitreId = chapitre.id` (`CalculerProgressionProgrammeUseCase.ts` L79). Or sur le terrain, un enseignant peut vouloir **cocher rapidement sa progression de la semaine** sans rédiger systématiquement une entrée complète de cahier de texte (ou inversement saisir son cahier de texte sans avoir à recocher).

- **Modèle proposé (propre, auditable, multi-classe sûr)** :
  - Si chaque `Programme` est scopé à `classId`, on peut soit :
    - **Option 1 (recommandée — table dédiée `ChapitreAvancement`)** : `(id, schoolId, classId, chapitreId, academicYearId, statut: 'FAIT' | 'EN_COURS', cocheParId, cocheLe, note?)` avec `@@unique([classId, chapitreId])`.
      - **Avantage décisif** : fonctionne **même** pour les anciens programmes partagés au niveau `level` (`classId = null`) sans mélanger l'avancement de `6e A` et `6e B` ! Et garde une trace d'audit complète (`qui` / `quand` a coché).
    - **Option 2 (champs sur `Chapitre`)** : `estRealise`, `realiseLe`, `realiseParId` — plus simple, mais **casse** dès qu'un `Programme` est partagé sur plusieurs classes (`classId = null`).
- **Règle de coexistence entre coche directe et `CahierDeTexte`** :
  - Une leçon est **réalisée** si et seulement si :
    `realise = (hasCahierDeTexteEntry || hasDirectCheck)`
  - Dans la réponse API, exposer explicitement la source : `sourceRealisation: 'CAHIER' | 'COCHE' | 'LES_DEUX' | null`, `nbSeancesCahier: number`, `cocheLe: Date | null`.
  - **Comportements UI sans friction** :
    - Saisir un `CahierDeTexte` lié à `chapitreId` marque automatiquement la leçon comme faite (`source: 'CAHIER'`, icône cahier).
    - Cliquer la case à cocher d'une leçon non liée au cahier crée/supprime l'entrée `ChapitreAvancement` (`source: 'COCHE'`, icône coche).
    - Si une leçon est déjà liée à un `CahierDeTexte` et que l'enseignant clique pour décocher : ne pas supprimer le cahier de texte silencieusement — afficher un message explicatif (*« Cette leçon est liée à N séance(s) du cahier de texte »*) ; seule la coche manuelle est décochable directement.
  - **RBAC obligatoire (`AGENTS.md §4.12`)** : un enseignant (`TEACHER`) ne peut cocher/décocher une leçon que sur un `(classId, subjectId)` auquel il est explicitement affecté (`RattachementEnseignantRepository.estRattacheALaClasse`, même contrôle que `GererCahierDeTexteUseCase.ts` L63–73), avec isolation `schoolId` stricte et journalisation.

### 3.5 Affichage enseignant groupé par module & taux de progression

- **Côté backend** (`CalculerProgressionProgrammeUseCase` + `ListerProgrammeUseCase`) :
  - Retourner sur chaque chapitre : `moduleOrdre`, `moduleTitre`, `numeroAffiche`, `actif`, `realise`, `sourceRealisation`, `nbSeancesCahier`, `cocheLe`.
  - Calculer les compteurs **uniquement sur les chapitres actifs** (`chapitresActifs = chapitres.filter(c => c.actif)`) :
    - `leconsTotal = chapitresActifs.length` (alias maintenu `chapitresTotal` pour zéro régression).
    - `leconsRealisees = chapitresActifs.filter(c => c.realise).length`.
    - `progressionPct = leconsTotal > 0 ? Math.round((leconsRealisees / leconsTotal) * 100) : null`.
  - Retourner un résumé par module (`modules: [{ moduleOrdre, moduleTitre, total, realisees, pct, actif }]`) pour éviter de dupliquer le calcul dans le frontend (`DRY`).
- **Côté frontend enseignant** :
  - **Nouvel onglet « Ma progression »** dans [SectionCahierDeTexte.tsx](file:///home/ndzanachristophe/Documents/PosteTravail/ZekoulABia/frontend/src/app/teacher/dashboard/_components/SectionCahierDeTexte.tsx) (ou composant dédié sous `frontend/src/app/teacher/dashboard/_components/cahier/`, respectant la matrice de placement `frontend/AGENTS.md` et `< 500` lignes) :
    - Sélecteur `(Classe, Matière)` → barre de progression globale (`X / Y leçons · Z %` + comparaison attendu calendaire).
    - **Accordéons par module** (ex. `Module 1 — FAMILY AND SOCIAL LIFE · 8 / 12 leçons`) :
      - Chaque leçon affiche sa case à cocher directe, son badge `numeroAffiche` (`Leçon 1`, `TD1`), son titre, un badge si liée au cahier de texte (`1 séance`), et un raccourci **« Saisir au cahier »** qui pré-remplit l'onglet Saisie avec `(classId, subjectId, chapitreId)`.
      - Pour les matières multi-ateliers (`Travail Manuel`, `Manual Labour`) ou à la demande : bouton par module *« Désactiver cet atelier / module »* qui bascule `actif` (mettant à jour immédiatement le dénominateur).
  - **Dans `CahierSaisieTab.tsx` (sélecteur de leçon)** : remplacer le `<select>` plat `Ch.1 — ... (2h)` par des `<optgroup label="Module 1 : ...">` groupés par module, masquant `(Xh)` quand `volumeHeuresPrevu === null` et indiquant un `✓` devant les leçons déjà faites !
  - **i18n** : toutes les nouvelles chaînes UI ajoutées en parité stricte `fr` / `en` via `useT('teacher')`.

---

## 4. Impact sur l'architecture

- **Couche `domain/`** :
  - Nouveau module pur `officialProgressionResolution.ts` (résolution `(templateCode, level, filiere, serie, pebsMixte, subjectName)` → critères référentiel, détection multi-options `Latin`/`Grec`).
  - Extension du port `ProgrammeRepository` / `ChapitreRepository` + nouveau port `ChapitreAvancementRepository` (ou méthodes dédiées dans un port spécifique — Interface Segregation `SOLID`).
- **Couche `application/`** :
  - Nouveau use case `MaterialiserProgrammesEcoleUseCase` (mode `proposer` + `appliquer` atomique, utilisable par l'admin/AP, l'onboarding et la création de classe).
  - Nouveau use case `BasculerAvancementChapitreUseCase` (coche/décoche directe enseignant avec contrôle RBAC + tenant).
  - Nouveau use case `BasculerModuleActifUseCase` (activation/désactivation d'un atelier/module pour `Travail Manuel`, etc.).
  - Évolution rétrocompatible de `CalculerProgressionProgrammeUseCase` (intégration `ChapitreAvancement` + filtrage `actif = true` + agrégation par module).
- **Couche `infrastructure/`** :
  - Migration Prisma additive (aucune suppression de colonne).
  - Adapters Prisma + routes Express protégées par RBAC + validation Zod.
- **Couche `frontend/`** :
  - Écran enseignant colocalisé dans `frontend/src/app/teacher/dashboard/_components/cahier/` (nouveaux sous-composants `< 300` lignes) + bouton d'initialisation dans `SectionPedagogie.tsx` (Admin) et `DeptProgrammesTab.tsx` (AP).
  - **Zéro `any`**, `architectureGuard.test.ts` backend et frontend verts à 100 %.

---

## 5. Fichiers concernés (prévisionnel exact — à n'éditer qu'après validation)

### Créés
- `backend/prisma/migrations/<ts>_materialisation_programmes_officiels/migration.sql`
- `backend/src/domain/rules/officialProgressionResolution.ts`
- `backend/src/domain/ports/repositories/ChapitreAvancementRepository.ts`
- `backend/src/application/pedagogie/MaterialiserProgrammesEcoleUseCase.ts`
- `backend/src/application/pedagogie/BasculerAvancementChapitreUseCase.ts`
- `backend/src/application/pedagogie/BasculerModuleActifUseCase.ts`
- `backend/src/infrastructure/persistence/prisma/PrismaChapitreAvancementRepository.ts`
- `backend/tests/unit/domain/rules/officialProgressionResolution.test.ts`
- `backend/tests/unit/application/pedagogie/MaterialiserProgrammesEcoleUseCase.test.ts`
- `backend/tests/unit/application/pedagogie/CalculerProgressionCoexistence.test.ts`
- `frontend/src/app/teacher/dashboard/_components/cahier/CahierProgressionTab.tsx`
- `frontend/src/app/teacher/dashboard/_components/cahier/ModuleProgressionAccordion.tsx`

### Modifiés
- `backend/prisma/schema.prisma` (`Programme`, `Chapitre`, nouveau modèle `ChapitreAvancement`)
- `backend/src/domain/ports/repositories/ProgrammeRepository.ts` & `ChapitreRepository.ts`
- `backend/src/infrastructure/persistence/prisma/PrismaProgrammeRepository.ts` & `PrismaChapitreRepository.ts`
- `backend/src/application/pedagogie/CalculerProgressionProgrammeUseCase.ts`
- `backend/src/infrastructure/http/controllers/PedagogieController.ts` & routes `pedagogie.routes.ts`
- `backend/src/infrastructure/config/bootstrap/` (wiring container)
- *(Lot 2)* `backend/src/application/school/ActiverEtablissementUseCase.ts` & `backend/src/application/class/CreerClasseUseCase.ts`
- `frontend/src/app/teacher/dashboard/_components/SectionCahierDeTexte.tsx`, `cahier/CahierSaisieTab.tsx`, `cahier/useCahierData.ts`, `cahier/types.ts`
- `frontend/src/app/admin/dashboard/_components/SectionPedagogie.tsx` (bouton « Initialiser depuis le référentiel officiel »)
- `frontend/src/locales/{fr,en}/teacher.json` (parité stricte FR/EN)

---

## 6. Plan en étapes (avec complexité et IA recommandée — `AGENTS.md §7`)

| Étape | Lot | Description | Difficulté | IA recommandée |
|---|---|---|---|---|
| **1** | **Pilote (Lot 1)** | **Migration Prisma additive** : ajouter `officialProgressionId`, `sourceChecksum`, `filiere` sur `Programme` ; `moduleOrdre`, `moduleTitre`, `numeroAffiche`, `sourceKey`, `actif` sur `Chapitre`, passer `volumeHeuresPrevu` en `Int?` ; créer la table `ChapitreAvancement` (`@@unique([classId, chapitreId])`). | **Élevée** | Claude Code |
| **2** | **Pilote (Lot 1)** | **Règle domaine de résolution** (`officialProgressionResolution.ts`) : résolution `(templateCode→__ALL__, level normalisé, filiere/serie, pebsMixte, subjectName)` + détection des cas à choix explicite (`Lettres classiques` en 4e/3e) + tests unitaires exhaustifs. | **Moyenne** | Exécutante / Claude Code |
| **3** | **Pilote (Lot 1)** | **Use case `MaterialiserProgrammesEcoleUseCase`** (`proposer` + `appliquer` en transaction atomique, idempotent, préservation des `Programme` manuels existants, choix explicite Latin/Grec en 4e/3e) + routes API Admin/AP (`RBAC` + `schoolId`). | **Élevée** | Claude Code |
| **4** | **Pilote (Lot 1)** | **Coche directe & progression par module/leçon** : `ChapitreAvancementRepository`, `BasculerAvancementChapitreUseCase` (RBAC enseignant strict), `BasculerModuleActifUseCase` (ateliers `Travail Manuel`), mise à jour `CalculerProgressionProgrammeUseCase` (union `CahierDeTexte ∪ ChapitreAvancement`, dénominateur sur `actif = true`, agrégat par module, `volumeHeuresPrevu` optionnel) + tests. | **Élevée** | Claude Code |
| **5** | **Pilote (Lot 1)** | **UI Enseignant + bouton Admin/AP** : onglet « Ma progression » groupé par module (accordéons, coche directe, toggle atelier, raccourci « Saisir au cahier »), `<optgroup>` par module dans `CahierSaisieTab.tsx` (sans `(2h)` si null), bouton « Charger les programmes officiels » côté Admin/AP, parité i18n `fr`/`en`. | **Moyenne** | Exécutante |
| **6** | **Lot 2** | **Matérialisation automatique au cycle de vie** : brancher `MaterialiserProgrammesEcoleUseCase` (mode silencieux idempotent) à la fin de `ActiverEtablissementUseCase` et de `CreerClasseUseCase`. | **Élevée** | Claude Code |
| **7** | **Lot 3** | **Resynchronisation après mise à jour Super Admin** : détection de dérive `sourceChecksum !== importChecksum`, prévisualisation des ajouts/modifications/archivages (`propose/apply`), conservation des `Chapitre.id` existants. | **Très élevée** | Claude Code (Tech Lead) |

### Ce qui peut être livré en premier pour un établissement pilote
Le **Lot 1 (Étapes 1 à 5)** est autonome, sûr et suffisant pour un établissement pilote :
- L'Admin ou l'Animateur Pédagogique clique une fois sur **« Initialiser depuis le référentiel officiel »** (avec aperçu `propose/apply`).
- Toutes les classes/matières du pilote (y compris LV2 concrètes, `Intensive English`, `SVTEEHB`, `PCT`, `Latin` 6e–5e, et choix `Latin`/`Grec` en 4e–3e) reçoivent instantanément leurs modules et leçons.
- Les enseignants suivent leur avancement **par module et par leçon**, par **coche directe** ou **cahier de texte**, et peuvent désactiver les ateliers non retenus en `Travail Manuel`.
- Les Lots 2 (auto-provisionnement onboarding/création classe) et 3 (resync différentielle) s'ajoutent ensuite sans changer le schéma.

---

## 7. Dépendances

- **Interne** : les 308 progressions sont déjà en base ; `normaliserNiveauScolaire` (`domain/rules/officialProgressionSubjects.ts`) est déjà en place.
- **Migration** : une seule migration Prisma additive à l'Étape 1 (`prisma migrate dev --name materialisation_programmes_officiels`).
- **Second cycle FR (`2nde`, `1ere`, `Tle`)** : le mécanisme de résolution par `classe.serie` sera prêt dès le Lot 1 ; les programmes de 2nd cycle apparaîtront automatiquement dès qu'ils seront importés dans `OfficialProgrammeProgression`.

---

## 8. Risques & protection des données existantes

| Risque | Impact | Parade |
|---|---|---|
| **Écoles déjà actives ayant des `Programme` créés manuellement** | Écrasement de chapitres liés à des `CahierDeTexte`. | Idempotence stricte : ne jamais écraser un `Programme` existant sans confirmation explicite ; en mode auto (Lot 2), ignorer tout `(classId, subjectId)` ayant déjà un `Programme`. |
| **Non-déterminisme de `PrismaProgrammeRepository.findByClassSubject`** | Si un programme de niveau (`classId: null`) et un programme de classe coexistent, `findFirst` sans tri renvoie l'un ou l'autre au hasard. | Prioriser explicitement la requête `classId === input.classId`, puis fallback `level === classe.level && classId === null`. |
| **`volumeHeuresPrevu` nullable sur d'anciens consommateurs** | `reduce((s, c) => s + c.volumeHeuresPrevu, 0)` peut donner `NaN` si un consommateur oublie `?? 0`. | `grep` exhaustif sur `volumeHeuresPrevu` avant migration + `?? 0` et `hasHeuresPrevu: boolean` dans les DTO. |
| **Fausse alerte de retard en `Travail Manuel` (93 leçons / 3 ateliers)** | Taux bloqué à ~33 %, faux positifs dans `calculerAlertesRetardProgramme`. | Champ `Chapitre.actif` + toggle par module excluant les ateliers non retenus du dénominateur. |
| **Fuite RBAC sur la coche directe** | Un enseignant cocherait les leçons d'un collègue ou d'une autre école. | Contrôle systématique `schoolId` + `estRattacheALaClasse(teacherId, classId, subjectId)` (comme `GererCahierDeTexteUseCase`). |

---

## 9. Critères de validation (Definition of Done)

- `tsc --noEmit` vert à 100 % (backend et frontend), `architectureGuard.test.ts` vert (backend et frontend), zéro `any`.
- Tests unitaires verts : résolution sur tous les cas (6e FR_GENERAL, 6e FR_PEBS, classe `pebsMixte`, 4e Allemand/Espagnol, 6e vs 4e `Lettres classiques`, Form1 EN_GENERAL/EN_PEBS, 2nde/1ère A4-Arabe/C), idempotence `MaterialiserProgrammesEcoleUseCase`, coexistence `CahierDeTexte` + coche directe, calcul de progression après désactivation de 2 ateliers en `Travail Manuel`, contrôle RBAC rejetant un enseignant non affecté.
- Parité i18n `fr`/`en` vérifiée sur toutes les clés ajoutées.
- Aucune régression sur la saisie libre du cahier de texte (matière sans programme) ni sur les programmes manuels existants.

---

## 10. Retour arrière (Rollback)

- Migration 100 % additive (nouvelles colonnes nullables ou avec défaut + nouvelle table `ChapitreAvancement`) : en cas de problème, désactiver les nouvelles routes/onglets par feature-flag ou revert applicatif ne casse aucune donnée existante (`Programme`, `Chapitre`, `CahierDeTexte` restent intacts).
- Les programmes matérialisés portant `officialProgressionId != null` sont identifiables et supprimables proprement (tant qu'aucun `CahierDeTexte` ne les référence).

---

## 11. Décisions à arbitrer par le propriétaire avant de coder

Merci de confirmer tes choix sur ces **5 points précis** avant le démarrage du Lot 1 :

1. **Scope de matérialisation** : préfères-tu **1 `Programme` par classe (`classId` renseigné)** *(recommandé : gère `FR_GENERAL` vs `FR_PEBS`, ateliers distincts de `Travail Manuel`, et personnalisation par enseignant)* ou **1 `Programme` partagé par `(level, filiere)`** ?
2. **`volumeHeuresPrevu`** : valides-tu de passer `Chapitre.volumeHeuresPrevu` en **`Int?` (nullable, `null` pour les leçons MINESEC)** et de n'afficher les heures que lorsqu'elles sont renseignées, le suivi reposant uniquement sur le **nombre de leçons** ?
3. **Stockage de la coche directe** : valides-tu la table dédiée **`ChapitreAvancement(classId, chapitreId, statut, cocheParId, cocheLe)`** *(recommandé : compatible aussi avec d'éventuels anciens programmes partagés par `level` + audit trail natif)* ?
4. **Gestion des 3 ateliers de `Travail Manuel` / `Manual Labour`** : valides-tu de **copier les 3 ateliers et d'offrir un bouton « Activer / désactiver ce module »** (qui ajuste le dénominateur du taux de progression) ? Qui peut activer/désactiver un module : **enseignant affecté + AP + Admin** ?
5. **Périmètre de livraison** : démarre-t-on directement sur le **Lot 1 seul (Étapes 1 à 5 — établissement pilote avec initialisation à la demande)** avant d'enchaîner sur le Lot 2 (auto à l'onboarding/création classe) et le Lot 3 (resync différentielle) ?
