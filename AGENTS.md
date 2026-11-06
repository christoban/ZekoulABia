# AGENTS.md — Guide officiel des agents IA sur ZEKOULABIA

> Ce fichier est lu automatiquement par les agents IA (Claude Code, opencode, etc.) travaillant sur ZEKOULABIA, ainsi qu'au début de chaque session (OpenCode et Claude Code).
> Il définit **comment** travailler. Il prime sur les habitudes de l'agent, et s'ajoute à la tâche donnée.
> Applique les règles ci-dessous à chaque modification de code, sans qu'on ait besoin de te les rappeler.
> Documents projet à connaître : [ARCHITECTURE.md](ARCHITECTURE.md) · [MODULE_INDEX.md](MODULE_INDEX.md) · [FEATURES.md](FEATURES.md) · [CONVENTIONS.md](CONVENTIONS.md)

---

## 0. Avant toute chose — quels documents lire

Selon la tâche, lis **d'abord** (dans l'ordre) :
1. **Cette page** (méthode).
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — comprendre l'organisation générale.
3. **[MODULE_INDEX.md](MODULE_INDEX.md)** — trouver **où** intervenir.
4. **[FEATURES.md](FEATURES.md)** — comprendre la fonctionnalité et ses interactions.
5. **[CONVENTIONS.md](CONVENTIONS.md)** — écrire du code cohérent.
6. Si frontend : **`frontend/AGENTS.md`** (Next.js « pas celui que tu connais »).

Puis explore le **code réel** concerné avant de conclure quoi que ce soit.

---

## 1. Comment analyser une tâche (workflow obligatoire)

1. **Reformule l'objectif** en une phrase, et identifie le périmètre explicite (ce qui est demandé) **et** la section « CE QU'IL NE FAUT PAS TOUCHER ».
2. **Analyse préalable** : localise dans le code réel les fichiers concernés (via MODULE_INDEX + recherche). **Restitue** cette analyse (fichiers/lignes, décisions) avant d'agir.
3. **En mode Tech Lead / architecte** (par défaut, sauf demande explicite de coder) : produis un **PLAN** au format standard (§6) au lieu d'écrire le code.
4. **Signale les ambiguïtés** : si un choix te manque ou si le périmètre est flou, **pose la question / documente l'hypothèse** — ne devine pas, n'élargis pas.
5. **Implémente** (si demandé) le strict nécessaire, en respectant les conventions.
6. **Vérifie** (§8) et **rends le rapport** (§9).

---

## 2. Règles d'or (résumé — détail dans CONVENTIONS.md et §4 ci-dessous)

- **Fais EXACTEMENT ce qui est demandé, rien de plus.** N'élargis jamais le périmètre de ta propre initiative.
- **Limite les modifications aux seuls fichiers nécessaires.** Ne « refactore » pas au passage. Ne reformate pas des fichiers non concernés.
- **Zéro régression** : ne casse pas l'existant. En cas de doute, préfère un ajout guardé (repli sûr) à une modification globale. Vérifie les non-régressions annoncées dans la Definition of Done.
- **Respecte les conventions** ([CONVENTIONS.md](CONVENTIONS.md)) : nommage FR pour le métier, styles inline + tokens CSS, i18n via `useT` + parité fr/en, source unique `resolveLanguage`, hexagonal côté backend.
- **Ne prétends jamais « fait/vérifié » sans preuve** (sortie de commande). Sois honnête sur ce qui n'a pas pu être testé.
- **Protection des données** : aucune suppression (colonne, fichier, donnée) sans preuve « zéro usage » + justification. En cas de doute : garder + documenter.
- **Jamais** de `git commit/push` ni d'opération destructive sauf demande explicite.
- **N'invente rien** : si un fichier/feature supposé n'existe pas, signale-le.

---

## 3. Comment réagir si tu repères une violation en passant

Si en lisant ou modifiant du code tu repères une violation d'une règle de la §4 **dans une partie du code que tu ne modifies pas directement** :
1. Termine la tâche demandée normalement.
2. Signale-le brièvement dans ta réponse.
3. Ajoute une ligne dans `CODE_REVIEW_NOTES.md` (à la racine, créer si absent) au format :
   - `[AAAA-MM-JJ] fichier:ligne — règle violée — description courte`
4. Ne corrige jamais une violation hors-scope sans confirmation explicite (ce n'est pas ton rôle de refactorer ce qu'on ne t'a pas demandé de toucher).

---

## 4. Règles de développement (principes de design)

### 4.1 Taille des fichiers
- Cible confortable : 150-250 lignes
- Signal d'alerte : 300-400 lignes → vérifier si le fichier fait plus d'une chose
- Plafond dur : 500 lignes → split obligatoire
- La taille est un symptôme, pas la règle elle-même : la vraie question est toujours Single Responsibility (voir SOLID ci-dessous)

### 4.2 SOLID
- **S — Single Responsibility** : une classe/module/use case = une seule raison de changer. Un controller HTTP ne doit jamais contenir de logique métier (voir l'incident `GradingEngine` : le calcul vivait dans un controller au lieu d'un moteur dédié)
- **O — Open/Closed** : étendre sans modifier. C'est le rôle des `Port`/`Adapter` — un nouveau canal de notification ou un nouveau solveur de scheduling s'ajoute par un nouvel adapter, jamais en modifiant le code appelant
- **L — Liskov Substitution** : toute implémentation d'un `Port` doit être interchangeable avec une autre sans changer le comportement attendu par l'appelant
- **I — Interface Segregation** : plusieurs petites interfaces spécifiques plutôt qu'une interface générique fourre-tout. Ne jamais construire un moteur générique (Event/Rule/Workflow) avant d'avoir 2-3 cas réels différents qui le justifient
- **D — Dependency Inversion** : le domaine dépend d'abstractions (`Port`), jamais directement de Prisma, d'un SDK externe, ou d'un framework HTTP

### 4.3 Architecture hexagonale (Ports & Adapters) — déjà en place, à ne jamais casser
- Le domaine métier ne connaît jamais les détails techniques (base de données, API externe, framework HTTP)
- Toute communication avec l'extérieur passe par un `Port` (interface) implémenté par un `Adapter`
- Communication entre moteurs/bounded contexts (Assessment, Scheduling, Onboarding...) : ports unidirectionnels + événements asynchrones (Inngest), jamais d'appel direct bidirectionnel entre deux moteurs

### 4.3.1 Règles bloquantes d'architecture
- `domain/` ne peut importer ni `application/`, ni `infrastructure/`, ni Prisma, Express ou un SDK technique.
- `application/` ne peut importer ni `infrastructure/`, ni Prisma, Express ou un SDK technique. Elle dépend uniquement du domaine et de ports.
- Un controller HTTP ne contient pas de logique métier, de requête Prisma ou d'appel SDK : il valide l'entrée, appelle un use case, puis mappe la réponse HTTP.
- Toute intégration externe nouvelle passe par un port domaine/application, un adapter infrastructure et le wiring du container. Aucun raccourci direct depuis un use case.
- Le test `backend/tests/unit/architectureGuard.test.ts` est bloquant : s'il échoue, la tâche n'est pas terminée et le guard ne doit pas être affaibli pour faire passer le code.

### 4.4 DRY (Don't Repeat Yourself)
- Une seule source de vérité par calcul/règle métier
- Avant d'écrire une nouvelle implémentation d'une logique existante, chercher si elle existe déjà (le bug de coefficient de notation venait de 8 implémentations dupliquées du même calcul)

### 4.5 YAGNI (You Aren't Gonna Need It) — déjà appliqué, continuer
- Ne jamais construire une abstraction générique "au cas où" — construire pour le besoin réel actuel
- Pas de moteur générique avant 2-3 cas concrets différents qui le justifient
- Ponytail applique déjà ce principe automatiquement pour le code généré — cette règle sert surtout de garde-fou pour les décisions de conception plus larges (nouvelles tables, nouveaux modules) que Ponytail ne voit pas

### 4.6 KISS (Keep It Simple)
- Préférer la solution la plus simple qui marche à la solution la plus "élégante" ou générique
- Si une fonction native/librairie déjà installée fait le travail, ne pas réinventer

### 4.7 Separation of Concerns
- Chaque module (Assessment, Scheduling, Onboarding, Communication...) garde sa responsabilité propre
- Ne jamais mélanger logique de présentation (controller/route), logique métier (use case/domain), et accès aux données (repository/Prisma) dans le même bloc

### 4.8 Composition over Inheritance
- En TypeScript, préférer composer des comportements plutôt que créer des hiérarchies de classes profondes
- Éviter l'héritage sauf cas explicitement justifié

### 4.9 Law of Demeter
- Éviter les chaînes d'appels type `a.b.c.d.faireQuelqueChose()` qui couplent trop fortement les objets entre eux
- Un objet ne devrait parler qu'à ses "voisins directs"

### 4.10 Fail Fast
- Valider les entrées/préconditions le plus tôt possible, jamais laisser une erreur se propager silencieusement
- Piège de référence à ne jamais reproduire : `.filter(Boolean)` sur une valeur qui peut être `0` en JS/TS (falsy) — a supprimé silencieusement tous les créneaux du lundi (`dayOfWeek: 0`) dans le chantier scheduling. Toujours vérifier explicitement `!== null && !== undefined` plutôt que de compter sur la troncature JS

### 4.11 Boy Scout Rule
- Laisser le code un peu plus propre que trouvé, sans faire de refactoring massif non demandé
- Ne jamais confondre ça avec une réécriture hors-scope (voir §3 « Comment réagir »)

### 4.12 Conventions spécifiques à ZekoulABia (déjà établies — jamais à réinventer)
- **Zéro `any` par défaut dans tout le code source** : interdits aussi `any[]`, `Promise<any>`, `Promise<any | null>`, `Record<string, any>`, `Array<any>`, tuples contenant `any` et variantes équivalentes. Utiliser un type métier, `unknown` avec narrowing, un type Prisma dans l'adapter, ou un type structurel minimal dans un port.
- **Échappatoire `any` exceptionnelle uniquement** : elle doit être indispensable, localisée, revue explicitement et porter sur la même ligne `// hex-allow-any: <raison concrète>`. Une échappatoire ne doit jamais masquer une erreur de contrat ou remplacer un vrai type.
- **Aucun affaiblissement du guard** : si une nouvelle syntaxe de `any` échappe au guard, corriger le guard et supprimer les occurrences existantes avant de poursuivre. Ne pas ajouter d'exception globale, de fichier ignoré ou de regex plus étroite pour obtenir un résultat vert.
- **Pattern propose/apply** pour toute action destructrice ou structurante (clôture d'année, application d'un emploi du temps généré) : une route `propose-X` qui ne persiste rien, une route `apply-X` qui écrit dans une transaction Prisma unique et atomique après confirmation explicite — jamais d'écriture directe silencieuse
- **Idempotence explicite** : une action déjà effectuée doit renvoyer un 409 explicite, jamais recommencer silencieusement depuis zéro
- **RBAC vérifié à chaque route sensible**, jamais supposé hérité d'un contrôle en amont — vérifier explicitement qui peut voir/modifier quoi (l'incident RBAC sur `students-health/risk-detection` en est l'exemple : n'importe quel Élève/Parent pouvait voir n'importe quel élève)
- **Isolation multi-tenant systématique** : toute requête doit être scopée au tenant/établissement courant, jamais une requête globale non filtrée
- **Audit trail** : toute action sensible (suppression, changement de statut, publication) doit être tracée (qui/quoi/quand/avant/après)
- **Transactions atomiques** : toute écriture multi-table liée doit être dans une transaction unique (tout ou rien) — tester en cassant volontairement la transaction pour confirmer que les tests détecteraient une fuite
- **Ponytail (YAGNI/minimal implementation) ne prime jamais sur cette liste (§4.12)** : le réflexe "implémentation minimale" de Ponytail est utile pour éviter la sur-ingénierie, mais RBAC, isolation multi-tenant, audit trail, pattern propose/apply et idempotence ne sont **jamais** des ajouts optionnels ou "au cas où" — ce sont des exigences métier actées, au même titre qu'une fonctionnalité demandée explicitement. Si une étape touche une route sensible (accès élève/parent/notes/données de santé, action destructrice, changement de statut), le contrôle RBAC/tenant/audit correspondant fait partie du périmètre de la tâche, même s'il n'a pas été mentionné explicitement dans la demande — l'omettre au nom de la simplicité est une régression de sécurité, pas une simplification légitime.

### 4.13 12-Factor App (pertinent pour une SaaS multi-tenant sur Azure)
- Configuration via variables d'environnement, jamais en dur dans le code
- Processus stateless — aucun état local qui ne survivrait pas à un redémarrage/scaling
- Logs traités comme un flux d'événements, pas gérés manuellement en fichier

### 4.14 Tests
- Tout chantier corrigeant un bug doit inclure un test de non-régression qui casse volontairement l'ancien comportement pour prouver que le test le détecte (discipline déjà appliquée : chantier `dayOfWeek`, chantier transaction atomique)
- Ne jamais merger un chantier qui fait baisser le nombre de tests qui passent

---

## 5. Stack & environnement (Fedora Linux) — rappels critiques

> Historique : le projet a été développé sous Windows jusqu'à mi-2026, ce qui explique certaines conventions ci-dessous marquées « héritage Windows ». L'environnement de développement est désormais **Fedora Linux**.

- Backend : **Bun + Express + Prisma + PostgreSQL**, **hexagonal**. Pas de build backend (`bun run dev`/`start`). Build = **frontend uniquement** (`bun run build`).
- IA : **Groq** via `@ai-sdk/groq`, façade `generateWithGroq()` / `groqModel` (`backend/src/infrastructure/services/ai/GroqClient.ts`).
- **Vérif TS** : `cd backend && ./node_modules/.bin/tsc --noEmit` (et/ou `frontend/`). **Jamais `npx tsc`.**
- **Migrations** : `npx prisma migrate dev --name <nom> --skip-generate` (depuis `backend/`).
- **`prisma generate`** : sous Fedora, ce n'est **plus un contournement obligatoire** — l'erreur `EPERM: operation not permitted, unlink ... query_engine-windows.dll.node` était propre à Windows (verrou de fichier `.dll` par l'OS et/ou un antivirus pendant que le process est chargé). Sous Linux, le moteur Prisma est un binaire `.so`, non soumis à ce verrouillage. `prisma generate` devrait donc s'exécuter normalement. Seule précaution qui reste valable : stopper le serveur dev/`prisma studio` avant de lancer la commande, pour éviter qu'un process ne tienne le fichier ouvert. Si un nouveau modèle n'est pas encore reconnu par le client généré, arrêter et signaler le problème : aucun `(prisma as any)` de repli n'est autorisé.
- **Smoke tests** : fichier `_smoke_*.ts` **dans `backend/`** (jamais `/tmp`), `bun _smoke.ts`, puis **supprime-le**.
- La recherche d'outil peut renvoyer « No matches » à tort → recoupe avec `grep -rn`.
- Ne laisse **aucun fichier parasite**. *(Héritage Windows : le fichier `nul` généré par une redirection `> nul` n'a pas d'équivalent sous Fedora — `/dev/null` est utilisé nativement et ne crée pas de fichier parasite. Le point reste valable en général : ne pas laisser de fichiers temporaires oubliés.)*
- **Base de test VIDE** (aucune école/élève) → pas de démo live de bout en bout ; vérifie par `tsc` + smoke déterministes, et dis honnêtement ce qui n'a pas été testé en conditions réelles.

---

## 6. Format de PLAN standard (obligatoire)

Quand tu produis un plan (mode par défaut), utilise **toujours** cette structure, dans cet ordre :

```
1. Objectif                — le résultat attendu, en 1–2 phrases
2. Contexte                — état actuel du code concerné (fichiers/lignes réels)
3. Impact sur l'architecture — couches/modules touchés ; respect des conventions ; risque de couplage
4. Fichiers concernés      — liste exacte (chemins), créés/modifiés
5. Étapes (Étape 1, 2, 3…) — actions atomiques et ordonnées ; pour CHAQUE étape : difficulté + IA recommandée (voir §7 table)
6. Dépendances             — entre étapes, et externes (migration, service, clé API…)
7. Risques                 — régressions possibles, points sensibles, données à protéger
8. Critères de validation  — Definition of Done vérifiable
9. Plan de test            — comment prouver que ça marche (tsc, smoke, parcours, parité i18n…)
10. Retour arrière (Rollback) — comment annuler proprement si ça tourne mal
```

But : que **toutes les IA** travaillent avec un format identique → moins d'ambiguïté.

---

## 7. Estimation de complexité & IA recommandée (par étape)

Attribue à **chaque étape** du plan une difficulté et une IA recommandée :

| Difficulté | Type de travail typique | IA recommandée |
|---|---|---|
| **Faible** | Créer/ajuster un composant React, ajouter des clés i18n, texte/style | IA « exécutante » (ex. DeepSeek / autre modèle) |
| **Moyenne** | Modifier une logique métier localisée, un use case, un endpoint | IA « exécutante » (avec ce guide) |
| **Élevée** | Refactorer plusieurs modules, toucher au container/bootstrap, migration schéma | **Claude Code** |
| **Très élevée** | Revue/décision d'architecture, changement de flux transverse, sécurité/RBAC | **Claude Code** (Tech Lead) |

Format recommandé dans le plan :

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| 1 | … | Faible | DeepSeek |
| 2 | … | Moyenne | DeepSeek |
| 3 | … | Élevée | Claude Code |

---

## 8. Vérification avant de terminer

- **`tsc` clean** (backend et/ou frontend selon la tâche) — montre la sortie.
- **Architecture guard** : depuis `backend/`, `bun test tests/unit/architectureGuard.test.ts` doit être vert à 100 %.
- **Contrôle lexical `any`** : vérifier également `grep -rn '\bany\b' backend/src --include='*.ts'` et justifier chaque résultat autorisé ; le guard reste la preuve automatisée de référence.
- **Smoke test** du chemin le plus risqué — montre la sortie. (Bulletins PDF : patcher `PDFDocument.prototype.text` pour capturer les libellés dessinés.)
- **i18n** : si texte UI ajouté → parité fr/en vérifiée (mêmes clés).
- **Non-régression** : re-vérifier les points listés dans la Definition of Done.
- Supprimer tous les fichiers temporaires `_smoke_*`.

---

## 9. Livrable — rapport final (format imposé)

Rapport **en français, structuré** :
1. **Analyse préalable** restituée (fichiers/lignes, décisions) ;
2. Pour chaque décision non triviale (surtout suppression) : **justification + preuve grep** ;
3. **Résultats de vérification** : `tsc` + smoke, **avec la sortie réelle** ;
4. **Liste des fichiers modifiés/créés** ;
5. **Note d'honnêteté** : ce qui n'a pas pu être testé en conditions réelles (base vide) ;
6. Confirmation que les `_smoke_*` sont supprimés.

Ne considère la tâche « terminée » que si **tous** les critères de fin sont couverts, preuves à l'appui.

---

## 10. Synchronisation de la documentation

Les documents `ARCHITECTURE.md`, `FEATURES.md`, `MODULE_INDEX.md`, `CONVENTIONS.md` et ce guide **font partie du projet**. Si ta tâche change l'architecture, un flux, un module, un rôle ou une convention, **propose la mise à jour** du/des documents concernés dans le même lot, pour qu'ils restent synchronisés avec le code.

---

*Dernière mise à jour : à réviser après chaque nouvelle convention validée avec l'encadrant. Ce fichier doit rester la source unique de vérité — pas de duplication dans un second document qui finirait par diverger.*
