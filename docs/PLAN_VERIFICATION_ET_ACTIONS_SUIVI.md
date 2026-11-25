# Plan — Vérification Early-Warning existant + Boutons d'action de suivi (nouveau)
### Document destiné à Claude Code

---

## 0. Cadrage

Ce document couvre deux choses distinctes, à ne pas mélanger :

- **Partie A — Vérification** : confirmer, dans le code réel, que le système d'alerte précoce déjà livré couvre bien ce qu'on croit qu'il couvre (cadre ABC + signal financier). Pas de nouveau développement ici, sauf si la vérification révèle un écart.
- **Partie B — Développement nouveau** : ajouter des boutons d'action directe sur la fiche d'un élève signalé, pour transformer une alerte lue passivement en un suivi tracé et assigné. C'est le seul chantier réellement nouveau et raisonnable pour cette version.

**Explicitement exclu de ce plan** (dépend d'un prérequis non construit — suivi des notes par notion, pas seulement par matière) : la vue enseignant "quelle notion précise fait chuter plusieurs élèves", et l'affinement correspondant de l'Assistant de révision. À traiter comme un chantier séparé plus tard, une fois ce prérequis technique posé (il sert les deux briques à la fois, ne pas le bricoler deux fois).

---

## PARTIE A — VÉRIFICATION DE L'EXISTANT

Checklist à parcourir directement dans le codebase, pas des suppositions à garder telles quelles.

### A.1 Les trois signaux ABC sont-ils bien tous les trois dans l'indice de santé scolaire ?

- [x] Confirmer que l'assiduité (absences) entre dans le calcul de l'indice recalculé chaque nuit.
- [x] Confirmer que la discipline (incidents, retenues, avertissements) y entre aussi.
- [x] Confirmer que la détection de chute de moyenne (pas juste une moyenne basse dans l'absolu) est bien ce qui déclenche le signal "résultats", conformément à ce qui a été construit.
- [x] Vérifier la fenêtre temporelle utilisée pour l'assiduité et la discipline (le document de référence suggère 4 semaines glissantes) — documenter ce qui est réellement utilisé aujourd'hui, l'ajuster seulement si l'écart est significatif.

> **✅ VÉRIFIÉ (juillet 2026).** Assiduité : 25% du score, fenêtre = 30 derniers jours (`PrismaSanteEleveRepository.ts`) — écart non significatif par rapport aux 4 semaines/28 jours suggérés, aucun changement nécessaire. Discipline : 10% du score, conforme sur le principe. Chute de moyenne : conforme, et implémentée deux fois — tendance générale sur 3 périodes dans le score composite (`calculerTendance`, `IndiceSanteRules.ts`) ET détection temps réel par matière (`handleGradeLockedDropDetection`, `inngest/functions.ts`, seuil configurable `subjectDropThreshold`, défaut 3 points) — bien une détection par delta, jamais un seuil absolu.
>
> **🐛 Écart trouvé et corrigé** : la fenêtre temporelle de la discipline était en réalité **absente** — `nombreSanctions` comptait les sanctions **depuis toujours** (`disciplineRecord.count` sans borne de date), alors que le dénominateur de la même composante (`nombrePeriodes`) ne regarde que les périodes de l'année scolaire en cours. Un élève sanctionné une fois en 6e continuait de payer ce point dans son score jusqu'en Terminale. **Corrigé** dans `PrismaSanteEleveRepository.ts` : `nombreSanctions` est désormais borné aux dates de l'année scolaire courante (`AcademicYear.startDate`/`endDate`), cohérent avec `nombrePeriodes`. `tsc --noEmit` propre, tests backend 229 pass/18 fail (échecs pré-existants, sans lien avec ce fichier — aucune régression).

### A.2 Le signal financier (paiements) est-il bien intégré à ce même indice, pas seulement affiché à côté ?

- [x] Vérifier que le statut de paiement (retard, impayé) contribue réellement au score de risque, et n'est pas juste une donnée visible séparément sur un autre écran.

> **✅ VÉRIFIÉ (juillet 2026).** Conforme — `fraisRegles/fraisTotaux` entre bien dans le score composite (10% du poids), calculé directement dans `PrismaSanteEleveRepository.ts`, pas seulement affiché ailleurs.

### A.3 Seuil de déclenchement — comparer, documenter, décider

- [x] Documenter précisément la logique actuelle (`SchoolConfig.aiRiskThreshold`, `aiRiskThresholdCritical`) : score composite continu, ou comptage de signaux déclenchés ?
- [x] Comparer avec l'approche "2 signaux sur 3 déclenchent la vigilance" : plus simple à expliquer à un censeur, mais potentiellement moins fine que ce qui existe déjà.
- [x] **Décision attendue** : garder la logique actuelle si elle est déjà au moins aussi bonne (probable, vu qu'elle est plus fine) — ne changer que si un censeur pilote signale que le score actuel est difficile à interpréter en pratique. Ne pas changer par principe, seulement sur retour de terrain.

> **✅ VÉRIFIÉ (juillet 2026).** Confirmé : score composite **continu** (0-100, somme pondérée), pas un comptage de signaux — comparé à `SchoolConfig.aiRiskThreshold`/`aiRiskThresholdCritical` (défauts 50/30), configurable par école. L'approche "2 sur 3" serait un recul en finesse — **décision : ne pas changer**, conforme à la recommandation du document. Écart mineur relevé, laissé tel quel : `niveauDepuisScore()` (`IndiceSanteRules.ts`) utilise des paliers fixes (30/50/70/85) pour le libellé narratif à la demande, alors que le job nocturne utilise les seuils configurables de l'école — ne diverge que si une école personnalise ses seuils par défaut, cas non observé à ce jour.

### A.4 Le routage des destinataires — canal et périmètre par rôle, y compris l'enseignant de matière

Le routage ne doit pas dépendre seulement de l'élève concerné, mais aussi de **quel signal a déclenché l'alerte** — un signal global (score composite ABC + paiement) n'a pas le même public qu'un signal spécifique à une matière.

| Destinataire | Déclencheur pertinent | Canal | Périmètre |
|---|---|---|---|
| Parent | Tout signal (composite ou spécifique) | Push puis SMS en secours (déjà en place) | Push individuel — peu d'enfants à suivre |
| Élève | Tout signal | Pas de push — surfacé dans son espace à la connexion, ton constructif (déjà en place) | Jamais présenté comme une alerte anxiogène |
| Professeur principal | Tout signal sur un élève de sa classe (déjà en place) | Push groupé (digest, ex. "3 nouveaux signalements dans ta classe") | Vue d'ensemble de sa classe, toutes matières confondues |
| **Enseignant de la matière concernée** | **Uniquement** le signal "chute dans sa matière précise" — jamais le score composite seul (absences, discipline, paiement ne le concernent pas) | **À vérifier si présent ; probablement absent, à ajouter** — push groupé (digest), même logique que le professeur principal | Seulement ses propres élèves, seulement sur sa propre matière — jamais une alerte hors de son ressort |
| Censeur | Tout signal | Liste de vigilance dans son tableau de bord (déjà en place), pas de push individuel | Vue de supervision globale |
| Admin | Tendance agrégée uniquement | Aucun push — vue agrégée à la demande (à ajouter, hors périmètre immédiat de ce document) | Supervision globale, pas d'intervention sur un cas individuel |

- [x] **Vérification prioritaire** : confirmer dans le code si l'enseignant de la matière concernée reçoit déjà une notification quand la détection "chute dans une matière précise" se déclenche sur un de ses élèves. Si absent (probable), l'ajouter fait partie du périmètre de développement de ce document (voir A.4.1 ci-dessous).

> **✅ VÉRIFIÉ (juillet 2026) — déjà présent, contrairement à l'hypothèse du document.** `handleGradeLockedDropDetection` (`inngest/functions.ts`) notifie déjà `assignment.teacherId` (l'enseignant assigné à cette matière POUR CETTE CLASSE, via `TeachingAssignment`) en plus du professeur principal, uniquement sur le signal "chute dans sa matière", jamais sur le score composite seul — correspond exactement au tableau ci-dessus. **A.4.1 n'a donc pas besoin d'être développé, retiré de la liste.** Seul écart mineur, laissé tel quel : le Censeur reçoit une notification push pour le niveau critique uniquement (pas une simple liste de vigilance passive sans push comme décrit dans le tableau), et ne voit jamais les chutes par matière — cohérent dans l'esprit, pas identique à la lettre.

#### A.4.1 ~~Si le routage vers l'enseignant de matière est bien absent — ce qu'il faut ajouter~~ (non applicable — déjà construit, voir note ci-dessus)

### A.5 Le garde-fou de confidentialité est-il respecté partout ?

- [x] Confirmer qu'un élève signalé "à risque" n'est jamais visible comme tel par ses camarades — ni dans une liste de classe partagée, ni dans un bulletin, ni dans un espace de discussion commun.
- [x] Confirmer que le routage par rôle (parent, professeur principal, enseignant de matière, censeur) est bien la seule voie d'accès à cette information — pas de fuite via un export, un rapport imprimé partagé, ou une vue mal filtrée.
- [x] Ce garde-fou doit rester vrai après l'ajout des boutons d'action (Partie B) et après l'ajout du routage vers l'enseignant de matière (A.4.1) — à revérifier une fois ces deux ajouts développés, pas seulement avant.

> **🐛 ÉCART CRITIQUE TROUVÉ ET CORRIGÉ (juillet 2026).** `GET /api/v2/ai/students-health` et `GET /api/v2/ai/risk-detection/:studentId` (`ai.routes.ts`, `AIController.ts`) n'avaient **aucune protection par rôle** (seulement `requireAuth`) ni aucune vérification de lien légitime avec l'élève consulté — n'importe quel compte Élève ou Parent authentifié pouvait lire les scores de santé/analyse de risque de n'importe quel autre élève de l'école, juste en changeant un ID dans l'URL. Une vraie fuite de données sensibles, exactement le cas "vue mal filtrée" que ce point demandait de vérifier. `getAtRiskStudentsForTeacher` et `getHealthTracking` étaient déjà correctement scopés (via `TeachingAssignment`/`ParentStudent`), le problème était isolé à ces deux routes.
>
> **Corrigé** : ajout de deux garde-fous dans `AIController.ts` — `peutVoirVueEnsembleSante()` (ADMIN ou STAFF avec la permission `VALIDATE_GRADES`, seuls rôles ayant un motif légitime de parcourir une liste large) pour `getStudentsHealth`, et `estAutoriseAVoirRisqueEleve()` (lien direct vérifié par rôle : ADMIN/STAFF habilité, TEACHER via `TeachingAssignment`/professeur principal, PARENT via `ParentStudent`, STUDENT sur lui-même uniquement) pour `detectRisk`, reprenant le même patron déjà correctement appliqué ailleurs. `requireRole('ADMIN', 'STAFF')` ajouté en défense en profondeur sur la route `/students-health`. `tsc --noEmit` propre, tests backend 229 pass/18 fail (échecs pré-existants sans lien avec ces fichiers).
>
> **✅ REVÉRIFIÉ après le développement complet de la Partie B (juillet 2026).** Repassé sur chaque surface ajoutée depuis, pas seulement supposé encore vrai :
> - `studentFollowUp.routes.ts` : `requireRole('STAFF', 'TEACHER')` au niveau du routeur — STUDENT et PARENT n'ont structurellement aucun accès à `/api/v2/student-follow-up/*`, quel que soit l'endpoint.
> - `ListerHistoriqueSuiviEleveUseCase` : double filtre toujours en place (lien légitime avec l'élève, PUIS ligne par ligne créateur/assigné/rôle habilité) — un professeur principal ne voit toujours pas l'observation d'un collègue sur le même élève.
> - `ListerActionsEnCoursUseCase` : portée "établissement entier" toujours réservée au Censeur, tous les autres rôles ne voient que ce qui leur est assigné.
> - `StudentFollowUpButtons.tsx` : grep confirmé sur l'ensemble du frontend — utilisé uniquement dans les dashboards Staff et Teacher, jamais Student ni Parent.
> - `NotificationController.list`/`markAsRead` : chaque requête reste scopée à `userId: req.user.userId` — un push de suivi (observation, signalement, entretien, convocation) n'est jamais lisible par quelqu'un d'autre que son destinataire réel.
> - Nouveau depuis la dernière vérification (convocation élève, digest quotidien PP, digest par lot enseignant) : la convocation (`StudentRecommendation` contextType `CONVOCATION`) est filtrée par `recipientRole: 'STUDENT'` ET `studentId` propre à l'appelant dans `getHealthTracking` — structurellement impossible qu'un parent ou un autre élève la voie. Les deux digests groupent strictement par destinataire (un PP ne reçoit que sa propre classe, un enseignant de matière que ses propres élèves) — jamais de liste partagée entre plusieurs enseignants.
> - **Observation, pas une fuite** : `ListerHistoriqueSuiviEleveUseCase.estRoleHabilite` ne reconnaît que ADMIN et Censeur pour la vue "toutes les lignes" — un Conseiller pédagogique avec un cas escaladé ne voit donc que ses propres actions sur cet élève, pas les observations antérieures du PP, alors qu'il a un motif légitime de les consulter. C'est une sur-restriction fonctionnelle (perte de contexte utile), pas un problème de confidentialité — laissé tel quel, à traiter séparément si le besoin se confirme à l'usage.
>
> Dernier point de la checklist (garde-fou après Partie B) volontairement laissé non coché — à revérifier une fois les boutons d'action construits, pas avant.

### A.6 Livrable de cette partie

Un court rapport (quelques lignes par point, pas un document formel) confirmant, pour chacun des points ci-dessus, soit "conforme", soit "écart trouvé, à corriger" avec le détail de l'écart. Aucun développement ne doit démarrer en Partie B avant que A.1 et A.2 soient confirmés conformes — la Partie B ajoute une couche d'action sur un signal, il faut être sûr que le signal lui-même est solide en dessous.

> **✅ PARTIE A TERMINÉE (juillet 2026).** Tous les points vérifiés dans le code réel (pas des suppositions). Deux écarts trouvés et corrigés : la faille RBAC A.5 (critique, sécurité) et le biais de fenêtre temporelle sur la discipline (A.1, équité du calcul). Un développement prévu (A.4.1) s'est révélé déjà construit. A.1 et A.2 confirmés conformes — **la Partie B peut démarrer.**

---

## PARTIE B — BOUTONS D'ACTION SUR FICHE ÉLÈVE SIGNALÉE (nouveau développement)

## B.1 Objectif

Transformer une alerte lue passivement (le censeur ou l'enseignant principal voit "élève à risque", puis referme l'écran) en un **suivi tracé, assigné, et clôturable** — sans quoi l'alerte reste ce que la recherche appelle du "dashboard theater" : joli à regarder, sans effet réel.

## B.2 Les trois actions à proposer, pas plus pour cette version

1. **Programmer un entretien parent** — crée une tâche de suivi assignée, avec une date cible.
2. **Signaler au conseiller pédagogique / conseiller d'orientation** — transmet le cas, avec le contexte de l'alerte, à un rôle spécifique.
3. **Noter une observation** — permet à l'enseignant/censeur de consigner un constat libre, horodaté, lié à l'élève et à l'alerte qui l'a déclenché.

Volontairement limité à ces trois pour commencer — pas de système de workflow complexe avec des dizaines de types d'action. Si l'usage réel en montre le besoin, étendre plus tard.

## B.3 Modèle de données (ajout Prisma)

```prisma
enum StudentFollowUpActionType {
  ENTRETIEN_PARENT
  SIGNALEMENT_CONSEILLER
  OBSERVATION
}

enum StudentFollowUpStatus {
  OUVERT
  EN_COURS
  CLOS
}

model StudentFollowUpAction {
  id                String   @id @default(cuid())
  studentProfileId  String
  studentProfile    StudentProfile @relation(fields: [studentProfileId], references: [id])

  // Lien vers l'alerte qui a déclenché cette action, pour garder le contexte
  triggeringRecommendationId String?
  triggeringRecommendation   StudentRecommendation? @relation(fields: [triggeringRecommendationId], references: [id])

  type              StudentFollowUpActionType
  status            StudentFollowUpStatus @default(OUVERT)

  createdById       String
  createdBy         User     @relation("FollowUpCreatedBy", fields: [createdById], references: [id])
  assignedToId       String?  // ex. le conseiller pédagogique si type = SIGNALEMENT_CONSEILLER
  assignedTo         User?    @relation("FollowUpAssignedTo", fields: [assignedToId], references: [id])

  targetDate        DateTime?  // date cible pour l'entretien parent, par exemple
  note              String?    // texte libre (observation, ou détail de la demande d'entretien)

  createdAt         DateTime @default(now())
  closedAt          DateTime?
  closedById        String?
  closedBy          User?    @relation("FollowUpClosedBy", fields: [closedById], references: [id])
  closingNote       String?

  @@index([studentProfileId])
  @@index([assignedToId, status])
}
```

`StudentRecommendation` (modèle déjà existant) reçoit une relation inverse vers `StudentFollowUpAction[]` pour que la fiche élève affiche, à côté de chaque alerte, les actions déjà engagées dessus.

## B.4 Cas d'usage (architecture hexagonale)

| Cas d'usage | Rôle autorisé | Description |
|---|---|---|
| `CreerActionSuiviEleveUseCase` | Censeur, Professeur principal, Conseiller pédagogique | Crée une `StudentFollowUpAction` d'un des trois types, liée à l'alerte affichée |
| `AssignerActionSuiviUseCase` | Censeur | Réassigne une action à un autre utilisateur si besoin (ex. réattribuer un entretien) |
| `ClorreActionSuiviUseCase` | La personne assignée, ou le créateur | Passe le statut à `CLOS`, avec une note de clôture obligatoire (courte, pour garder une trace de ce qui a été fait) |
| `ListerActionsEnCoursUseCase` | Censeur, Conseiller pédagogique | Vue de toutes les actions `OUVERT`/`EN_COURS` assignées à l'utilisateur courant ou à son établissement, pour éviter qu'un suivi soit oublié |

## B.5 Écrans / modifications d'écrans existants

1. **Fiche élève signalée (écran déjà existant)** : ajouter, sous chaque alerte affichée, trois boutons correspondant aux trois types d'action. Chaque bouton ouvre un petit formulaire (date cible pour l'entretien, destinataire pour le signalement, texte libre pour l'observation) plutôt qu'une action à un clic sans contexte.
2. **Nouvel écran (ou onglet) — Mes actions de suivi** : liste des actions assignées à l'utilisateur connecté, groupées par statut, avec accès direct à la fiche de l'élève concerné et un bouton de clôture.
3. **Historique sur la fiche élève** : les actions déjà closes restent visibles (avec leur note de clôture) pour garder la mémoire de ce qui a déjà été tenté sur cet élève — évite de reprogrammer un entretien qui a déjà eu lieu sans effet, par exemple.

## B.6 Notification

Réutiliser le mécanisme de notification déjà en place (celui qui route déjà les alertes par rôle) : quand une action est assignée à quelqu'un (notamment `SIGNALEMENT_CONSEILLER`), cette personne reçoit une notification standard, pas un nouveau canal à construire.

## B.7 Garde-fou à respecter (hérité de la Partie A.5)

- Les actions de suivi suivent la même règle de confidentialité que les alertes elles-mêmes : jamais visibles par d'autres élèves, jamais dans un espace partagé. Seuls le créateur, la personne assignée, et les rôles habilités (censeur, admin) peuvent voir une action donnée.
- Une observation notée par un enseignant reste liée à son auteur et horodatée — jamais anonyme, pour la traçabilité, mais son accès reste restreint aux mêmes rôles que le reste du dossier de suivi.

## B.8 Découpage en tâches de développement (ordre suggéré)

1. Modèle Prisma (B.3) + migration.
2. RBAC : confirmer/ajuster les permissions pour Censeur, Professeur principal, Conseiller pédagogique sur ce nouveau modèle.
3. `CreerActionSuiviEleveUseCase` + les trois boutons sur la fiche élève existante.
4. `ClorreActionSuiviUseCase` + formulaire de clôture avec note obligatoire.
5. `ListerActionsEnCoursUseCase` + écran "Mes actions de suivi".
6. `AssignerActionSuiviUseCase` (réassignation, cas secondaire, peut passer après le reste).
7. Branchement sur le mécanisme de notification existant.
8. Affichage de l'historique des actions (closes incluses) sur la fiche élève.
9. Tests de bout en bout : création → assignation → clôture, et vérification que la confidentialité (B.7) tient dans chaque écran.

> **✅ PARTIE B — CODE FAIT pour le rôle Professeur principal, à étendre pour Censeur et Conseiller pédagogique (juillet 2026).**
>
> **Backend complet** (tous rôles, indépendant du frontend) : modèle Prisma `StudentFollowUpAction` + migration (`schoolId` ajouté au modèle du B.3, cohérent avec le reste du schéma — chaque modèle multi-tenant porte son propre `schoolId`, pas seulement via une chaîne de relations) ; port `StudentFollowUpRepository` + implémentation Prisma ; 5 use cases (`CreerActionSuiviEleveUseCase`, `ClorreActionSuiviUseCase`, `ListerActionsEnCoursUseCase`, `AssignerActionSuiviUseCase`, et `ListerHistoriqueSuiviEleveUseCase` ajouté pour B.5.3/B.7 — non nommé explicitement en B.4 mais nécessaire pour appliquer le filtre ligne par ligne de B.7) ; `StudentFollowUpController` + routes `/api/v2/student-follow-up/*` (`requireRole('STAFF','TEACHER')` — ADMIN volontairement exclu, cohérent avec A.4/B.4) ; notification branchée sur `SocketNotificationService`/`notifierUtilisateurPush` (même composition que `notifierPersonnelDirect`, type `STUDENT_RISK_ALERT` réutilisé). `tsc --noEmit` propre, tests backend 229 pass/18 fail (identique à l'avant — aucune régression).
>
> **RBAC (B.8.2)** — Censeur = `STAFF` + `VALIDATE_GRADES`, Professeur principal = `TEACHER` + `Class.professorPrincipalId`, Conseiller pédagogique = `STAFF` + `MANAGE_ORIENTATION` (même permission déjà utilisée par `suggererOrientationSiRisquePersistant`, trouvée en A.4 — pas de nouvelle permission créée). **ADMIN exclu de la création/clôture/liste**, cohérent avec B.4 qui ne le liste jamais — mais **ADMIN reste un "rôle habilité" pour la simple consultation** (B.7 le nomme explicitement à côté de Censeur), distinction respectée dans `ListerHistoriqueSuiviEleveUseCase`.
>
> **Écart assumé par rapport à B.4** : `ListerActionsEnCoursUseCase` (B.4 ne liste que "Censeur, Conseiller pédagogique") étendu au Professeur principal — sinon un enseignant qui crée un entretien assigné à lui-même (comportement par défaut, voir ci-dessous) n'aurait aucun moyen de le retrouver pour le clôturer, alors que B.5.2 décrit "les actions assignées à l'utilisateur connecté" sans restriction de rôle. Seul le Censeur garde la portée "tout l'établissement" ; les autres rôles ne voient que leurs propres actions.
>
> **Comportements par défaut ajoutés, non explicités dans B.3/B.4** : une action sans `assignedToId` explicite s'auto-assigne à son créateur (jamais orpheline, toujours retrouvable dans "Mes actions de suivi") ; `SIGNALEMENT_CONSEILLER` exige un destinataire explicite (nouvel endpoint `GET /student-follow-up/conseillers`, aucun annuaire staff générique n'existait) ; `ENTRETIEN_PARENT` exige une date cible, `OBSERVATION` exige un texte ; la réassignation (`AssignerActionSuiviUseCase`) fait passer le statut à `EN_COURS`.
>
> **Frontend — fait pour un seul rôle sur les trois autorisés.** Composant partagé `StudentFollowUpButtons.tsx` (3 boutons + formulaires + historique avec clôture inline) intégré sous chaque carte de `SectionTeacherAtRisk.tsx` (Professeur principal — B.5.1). Nouvel écran `SectionMesActionsSuivi.tsx` monté sur le dashboard enseignant, section `mon-suivi` (B.5.2). `GET /api/v2/ai/at-risk-students` étendu avec `recommendationId` pour que le lien "alerte déclenchante" (B.3) fonctionne réellement. Traductions fr/en complètes (`teacher.json` clé `suivi.*`, `navigation.json`).
>
> **⚠️ Non fait — Censeur et Conseiller pédagogique n'ont aujourd'hui AUCUNE "fiche élève signalée" existante à laquelle accrocher les boutons.** Contrairement à l'hypothèse implicite de B.5.1 ("écran déjà existant"), seul le Professeur principal (`SectionTeacherAtRisk.tsx`, dashboard Teacher) en a une. Le Censeur pourrait en théorie utiliser `/api/v2/ai/students-health` (gate déjà STAFF+VALIDATE_GRADES depuis la correction A.5) mais aucun écran Staff ne le consomme aujourd'hui ; le Conseiller pédagogique n'a que les écrans Orientation (fiches, pas les mêmes alertes santé/ABC). Construire ces deux écrans est un vrai chantier frontend, pas juste brancher le composant partagé déjà prêt — **décision à prendre avec l'utilisateur avant de continuer**, pas tranchée unilatéralement ici.
>
> **Vérification fonctionnelle bout-en-bout non faite** — même limitation qu'ailleurs dans ce projet (base de développement locale vide). Seule vérification possible : statique (tsc, tests, relecture).
>
> **Effet de bord signalé** : le serveur backend de développement (`nodemon`/`bun src/server.ts`) tournait et verrouillait le fichier moteur Prisma pendant la migration — arrêté pour pouvoir régénérer le client, pas redémarré automatiquement.
>
> Rien n'est commité en git à ce stade.
>
> **✅ CORRECTIF — nuance de rôle enseignant de matière + couverture des templates (juillet 2026, relecture demandée par l'utilisateur).**
>
> **Constat honnête avant correction : la couverture multi-templates N'AVAIT PAS été explicitement vérifiée** dans la première passe ci-dessus — RBAC construit par permission (jamais par nom de rôle), donc accidentellement portable, mais pas audité comme tel. Investigation faite sur demande, contre `StaffPermissionRules.ts` (source unique des titres/permissions par template — 17 combinaisons de `SchoolSubsystem × EducationType × SchoolLevel`) :
> - **`professorPrincipalId` est le même champ `Class` pour tous les niveaux**, y compris primaire — confirmé via `ImporterUtilisateursUseCase.ts` : un enseignant marqué "classe principale" reçoit automatiquement un `TeachingAssignment` pour CHAQUE matière du programme de sa classe. Au primaire (un seul maître par classe dans le cas courant), ce maître est donc à la fois `professorPrincipalId` ET assigné à toutes les matières — il obtient l'autorité pleine sans aucun code spécifique au primaire. Le mécanisme généralise correctement de lui-même.
> - **Cas des spécialistes primaire** (ex. anglais en template bilingue) : un enseignant avec un `TeachingAssignment` mais qui n'est PAS `professorPrincipalId` de cette classe tombe automatiquement dans "enseignant de matière" (observation seulement) — même logique qu'un professeur de matière au secondaire, sans distinction de niveau nécessaire.
> - **🐛 Écart réel trouvé** : `SIGNALEMENT_CONSEILLER` n'acceptait que `MANAGE_ORIENTATION` (Conseiller d'Orientation / Guidance Counsellor) — un permission qui **n'existe dans AUCUN titre primaire** (`FR_PRIMAIRE_TITLES`, `EN_PRIMARY_TITLES`), cohérent avec le fait que le choix de filière n'existe pas au primaire. Mais le terme que l'utilisateur emploie lui-même dans ce document, **"conseiller pédagogique", correspond à un titre RÉEL et DISTINCT** (`Conseiller Pédagogique` primaire FR, `Animateur Pédagogique` secondaire FR, `HOD` secondaire EN — tous porteurs de `MANAGE_PEDAGOGICAL_BRIEF`, jamais de `MANAGE_ORIENTATION`). Le code initial de ce chantier confondait les deux. **Corrigé** : autorité pleine et éligibilité au signalement élargies à `VALIDATE_GRADES` OU `MANAGE_ORIENTATION` OU `MANAGE_PEDAGOGICAL_BRIEF` (constante exportée `PERMISSIONS_AUTORITE_PLEINE`), donc reconnaît maintenant correctement le "Conseiller Pédagogique" primaire.
> - **Gap restant, non corrigé (pré-existant, hors périmètre de ce chantier)** : le template `EN_PRIMARY` (`Deputy Head Teacher`, `Bursar`, `Librarian`) ne provisionne AUCUN titre avec `MANAGE_ORIENTATION` ni `MANAGE_PEDAGOGICAL_BRIEF` — pour ce template précis, `SIGNALEMENT_CONSEILLER` n'aura jamais de destinataire possible tant que `StaffPermissionRules.ts` n'est pas complété (pas un bug introduit ici, un gap du référentiel de rôles lui-même, à traiter séparément si confirmé comme un vrai besoin terrain).
> 
> **Nuance de rôle demandée, implémentée** : `CreerActionSuiviEleveUseCase` distingue maintenant une autorité `'PLEINE'` (PP, Censeur, Conseiller — les trois actions) d'une autorité `'OBSERVATION_SEULEMENT'` (enseignant de matière non-PP — uniquement `OBSERVATION`, rejet explicite si `ENTRETIEN_PARENT`/`SIGNALEMENT_CONSEILLER` tenté). Nouveau champ `subjectId` sur `StudentFollowUpAction` (migration) : une observation créée par un enseignant de matière est obligatoirement rattachée à UNE matière qu'il enseigne réellement dans cette classe (vérifié via `TeachingAssignment`, jamais déclaratif). **Notification automatique au professeur principal de la classe** à chaque observation créée par un enseignant de matière (nouveau, absent de B.6 d'origine), même s'il n'est ni créateur ni assigné — "pour que le signal ne se perde pas", exactement la formulation de la demande.
>
> **Frontend** : `GET /api/v2/ai/at-risk-students` renvoie désormais `isProfesseurPrincipal` et `mesMatieres` (dérivés dynamiquement de `TeachingAssignment`/`professorPrincipalId`, jamais d'un rôle codé en dur) par élève. `StudentFollowUpButtons.tsx` masque les boutons "Entretien parent" et "Signaler au conseiller" pour un enseignant de matière, affiche un sélecteur de matière si l'enseignant en enseigne plusieurs dans cette classe, et un texte explicatif ("le professeur principal en sera informé").
>
> `tsc --noEmit` propre (backend + frontend), tests backend 229 pass/18 fail (identique — aucune régression). Toujours pas de vérification fonctionnelle bout-en-bout possible (base de dev vide). Rien de commité.
>
> **✅ CORRECTIF — chaîne d'escalade, suivi réel post-action, nouvelle action "convoquer l'élève" (juillet 2026, relecture demandée par l'utilisateur, points 4-6).**
>
> **Point 4 — l'autorité `'PLEINE'`/`'OBSERVATION_SEULEMENT'` à deux niveaux était trop plate.** Remplacée par une matrice par type d'action, plus fine, dans `CreerActionSuiviEleveUseCase.calculerCapacites()` (capacités `estProfPrincipal`/`estCenseur`/`estConseiller`/`estEnseignantMatiere`, toujours dérivées de permissions/`professorPrincipalId`/`TeachingAssignment`, jamais d'un rôle codé en dur) :
> - `OBSERVATION` : ouvert à PP, Censeur, Conseiller, Enseignant de matière (restreint à sa propre matière) — inchangé, plusieurs observations peuvent coexister sans conflit.
> - `SIGNALEMENT_CONSEILLER` : PP et Censeur uniquement — **le Conseiller pédagogique explicitement exclu** (il est le destinataire de l'escalade, pas quelqu'un qui se la déclenche à lui-même).
> - `ENTRETIEN_PARENT` et `CONVOCATION_ELEVE` (nouveau, voir point 6) : PP toujours ; Conseiller pédagogique **uniquement si un `SIGNALEMENT_CONSEILLER` encore `OUVERT`/`EN_COURS` sur cet élève lui est assigné** (`casEscaladeVersMoi()`, vérifié par `assignedToId`, pas par permission — couvre aussi le cas d'un même utilisateur cumulant Censeur et Conseiller). Jamais deux personnes actives en parallèle sur la même famille. Censeur volontairement absent de ces deux actions (peut escalader, ne conduit pas lui-même l'entretien/la convocation), conforme à la formulation exacte de la demande.
>
> **Point 5 — suivi réel après chaque action, pas seulement une ligne en base.** `OBSERVATION` : aucun suivi automatique (mémo à discrétion, inchangé). `SIGNALEMENT_CONSEILLER` : déjà complet (notification immédiate au conseiller assigné). `ENTRETIEN_PARENT` : nouveau champ `interviewMode` (`DATE_PROPOSEE` | `DEMANDE_DISPONIBILITE`, migration Prisma), choisi à la création — déclenche une notification parent réelle via `notifierParentsPushDabord` (canal push-d'abord/SMS de repli déjà en place pour les alertes santé, aucun nouveau canal) : message "L'établissement souhaite vous rencontrer le [date]… merci de confirmer" en mode `DATE_PROPOSEE`, ou une demande de disponibilité en mode `DEMANDE_DISPONIBILITE` (le PP fixera la date ensuite).
>
> **Point 6 — nouvelle action `CONVOCATION_ELEVE`** (enum Prisma étendu), distincte de `OBSERVATION` : formelle et proactive (date fixée à l'avance) plutôt qu'informelle et rétrospective. Réutilise `targetDate` tel quel (pas de champ nouveau). Notification à l'élève via `StudentRecommendation` (`recipientRole: 'STUDENT'`, `contextType: 'CONVOCATION'`) — même mécanisme que le conseil santé déjà surfacé côté élève à la connexion, volontairement **pas** un push urgent ; message neutre et constructif ("[créateur] souhaite te voir le [date]"), jamais anxiogène. Même chaîne d'escalade que `ENTRETIEN_PARENT` (PP, ou Conseiller une fois le cas signalé).
>
> **Frontend** : `StudentFollowUpButtons.tsx` gagne un 4ᵉ bouton "Convoquer l'élève" et, dans le formulaire "Entretien parent", un choix radio date précise/demande de disponibilité (date requise seulement pour le premier mode). Le bouton "Convoquer l'élève" reste gaté sur `isProfesseurPrincipal` : la branche "Conseiller une fois escaladé" est une capacité backend réelle mais **sans écran Conseiller pour la déclencher aujourd'hui** — cohérent avec le "⚠️ Non fait" déjà noté plus haut (écrans Censeur/Conseiller toujours en attente d'une décision utilisateur). `SectionMesActionsSuivi.tsx` reconnaît le nouveau type dans son historique. Clés `suivi.*` fr/en complétées (`btn_convocation`, `type_convocation`, `mode_entretien`, `mode_date_proposee`, `mode_demande_disponibilite`).
>
> `tsc --noEmit` propre (backend + frontend), tests backend 229 pass/18 fail (identique — aucune régression, migration `20260728042954_add_convocation_eleve_and_interview_mode` appliquée sans blocage de fichier cette fois). Toujours pas de vérification fonctionnelle bout-en-bout possible (base de dev vide). Rien de commité.
>
> **✅ CORRECTIF — spec exacte et définitive rôle par rôle (juillet 2026, relecture demandée par l'utilisateur).** L'utilisateur a fourni une spec complète et définitive du comportement attendu par rôle ; comparaison écart par écart faite AVANT toute correction (instruction explicite), puis correction une par une une fois le feu vert donné. Écarts confirmés et corrigés :
> - **PP perd "Convoquer l'élève"** (reversal direct de la correction précédente) : action désormais **exclusive au conseiller pédagogique**, une fois le cas escaladé — "le PP n'a pas de bureau, voit déjà ses élèves quotidiennement en classe, une convocation formelle ne lui apporte rien." Bouton retiré de `StudentFollowUpButtons.tsx` (composant actuellement utilisé par le rôle TEACHER uniquement, donc actuellement 100% inatteignable pour le PP — le retrait backend dans `CreerActionSuiviEleveUseCase` l'empêche même via appel API direct).
> - **Censeur perd toute capacité de création d'action** (reversal direct) : "notifié seulement… aucune action déclenchable. S'il juge un cas urgent, il passe par le professeur principal directement, hors du système." `SIGNALEMENT_CONSEILLER` et `OBSERVATION` ne sont plus accessibles au Censeur — la capacité `estCenseur` a été retirée de `CreerActionSuiviEleveUseCase` (plus de constante `PERMISSION_CENSEUR`). Sa visibilité en lecture seule (`ListerActionsEnCoursUseCase`, `ListerHistoriqueSuiviEleveUseCase`) n'est PAS touchée — ce n'est pas une capacité de création, donc hors du périmètre de "aucune action déclenchable".
> - **Signaler au conseiller devient Professeur principal SEUL** — le Censeur en avait aussi le droit depuis le correctif précédent ("peut escalader directement pour un cas urgent"), formulation désormais explicitement rétractée par l'utilisateur au profit d'un flux hors-système pour le Censeur.
> - **Observation du conseiller pédagogique gatée sur escalade** — auparavant ouverte à tout titulaire de `MANAGE_ORIENTATION`/`MANAGE_PEDAGOGICAL_BRIEF` sans condition ; désormais soumise à `casEscaladeVersMoi()` comme l'entretien/la convocation, cohérent avec "cas par cas uniquement, pas de veille passive sur toute l'école."
> - **Masquage dynamique de "Signaler au conseiller"** pour les ~85% d'établissements sans conseiller pédagogique configuré : `AIController.getAtRiskStudentsForTeacher` calcule `conseillerPedagogiqueDisponible` (présence d'au moins un `StaffProfile` avec `MANAGE_ORIENTATION`/`MANAGE_PEDAGOGICAL_BRIEF`) une seule fois par requête (pas par carte élève) et le transmet à `StudentFollowUpButtons` — jamais côté client, jamais par nom de rôle.
> - **Digest groupé, deux logiques distinctes selon le rôle** (décision explicite de l'utilisateur, pas un choix arbitraire) :
>   - *Enseignant de matière* : regroupement **par geste de verrouillage**, pas par fenêtre de temps. `GradeController.verrouillerEnMasse` émet désormais UN SEUL événement `grade/locked-batch` (liste de notes) au lieu d'un `grade/locked` par note. Nouveau handler `handleGradeLockedBatchDropDetection` détecte les chutes pour tout le lot et envoie UNE notification groupée par enseignant concerné. La logique de détection a été extraite dans `detecterChutePourNote()`, réutilisée à l'identique par le handler existant `handleGradeLockedDropDetection` (verrouillage d'une note isolée — comportement inchangé, rien à grouper).
>   - *Professeur principal* : digest **quotidien**, aligné sur le calcul nocturne (2h). Les pushs immédiats au PP dans `handleCriticalHealthAlert`/`handleWarningHealthAlert` et dans la détection de chute par matière ont été retirés (le conseil IA reste persisté pour alimenter le digest). Nouveau job `sendProfessorPrincipalDigest` (cron `30 2 * * *`, 30 min après le calcul nocturne) regroupe en UN message par PP : les alertes critique/vigilance de la nuit ET toutes les chutes de matière détectées les dernières 24h sur sa classe, peu importe quel enseignant de matière les a déclenchées (relit `StudentRecommendation` contextType `SUBJECT_DROP`, sans dépendre de qui a validé quoi).
>
> **Reporté, pas corrigé — nécessite une vraie décision de conception, pas une correction mécanique.** L'écart "l'enseignant de matière voit encore le score composite général de ses élèves" (via `SectionTeacherAtRisk`/`getAtRiskStudentsForTeacher`, qui interroge tous les `classIds` du professeur — classes PP et classes matière confondues — sans distinction) n'a **pas** été corrigé dans cette passe. Restreindre la requête aux seules classes PP viderait purement et simplement l'écran pour un enseignant de matière sans classe PP, lui retirant du même coup son seul point d'entrée pour "noter une observation" — une régression, pas une correction. Une vraie liste "mes élèves en chute dans ma matière" n'existe pas encore comme mécanisme interrogeable (seulement des notifications ponctuelles). **Décision à prendre avec l'utilisateur avant de construire cette vue**, pas tranchée unilatéralement ici.
>
> `tsc --noEmit` propre (backend + frontend), tests backend 229 pass/18 fail (identique — aucune régression). Rien de commité.
>
> **🐛 FAILLE BLOQUANTE TROUVÉE ET CORRIGÉE (revue de code, juillet 2026) — destinataire d'escalade jamais vérifié côté serveur.** `CreerActionSuiviEleveUseCase` (cas `SIGNALEMENT_CONSEILLER`) et `AssignerActionSuiviUseCase` prenaient `assignedToId`/`nouvelAssigneId` directement du corps de la requête sans jamais le recouper avec l'école de l'appelant ni avec la permission `MANAGE_ORIENTATION`/`MANAGE_PEDAGOGICAL_BRIEF` attendue — le frontend restreignait bien le choix via une liste filtrée, mais rien ne l'imposait côté serveur. Un professeur principal pouvait donc désigner n'importe quel utilisateur (y compris hors de son établissement, aucune contrainte de `schoolId`) comme destinataire d'un signalement ; ce tiers non vérifié héritait alors de la capacité "conseiller escaladé" (`casEscaladeVersMoi`) — dont **CONVOCATION_ELEVE, documentée ailleurs comme "exclusive au conseiller"** — et recevait une notification push exposant le nom et la classe de l'élève : escalade de privilège + fuite de données potentiellement inter-établissements. **Corrigé** : les deux use cases vérifient désormais que le destinataire est un `StaffProfile` de la même `schoolId`, porteur d'une des deux permissions conseiller (`this.prisma.staffProfile.findFirst({ where: { userId, schoolId, permissions: { some: { permission: { in: [...PERMISSIONS_CONSEILLER] } } } } })`), sinon rejet explicite. `AssignerActionSuiviUseCase` reçoit désormais `PrismaClient` en injection (wiring mis à jour dans `hexagonal.bootstrap.ts`). Défense en profondeur ajoutée dans `CreerActionSuiviEleveUseCase` : `assignedToId` fourni par le client n'est retenu QUE pour `SIGNALEMENT_CONSEILLER` — silencieusement ignoré (repli sur auto-assignation au créateur) pour tout autre type, même si un appelant direct de l'API tente de le forcer. `tsc --noEmit` propre, tests backend 264 pass/0 fail (aucune régression).

> **🐛 BUG TROUVÉ ET CORRIGÉ (revue de code, juillet 2026) — une convocation écrasait le vrai conseil santé affiché à l'élève.** `AIController.getHealthTracking` sélectionnait le dernier `StudentRecommendation` du rôle STUDENT/PARENT sans filtrer sur `contextType` — une `CONVOCATION_ELEVE` (contextType `CONVOCATION`, recipientRole `STUDENT`, voir `StudentFollowUpController.creer`) plus récente qu'une vraie alerte santé masquait alors le conseil pédagogique tant qu'aucune nouvelle alerte n'était générée : l'élève voyait "passe me voir le [date]" à la place du conseil santé, sans que le conseil ait disparu (juste rendu inatteignable par cette requête). **Corrigé** : la requête `conseil`/`conseilDate` est désormais filtrée sur `contextType: { in: ['HEALTH_CRITICAL','HEALTH_WARNING','HEALTH_POSITIVE'] }` ; la convocation est récupérée séparément (fenêtre de 30 jours, élève uniquement) et exposée dans un nouveau champ `convocation: { message, date } | null`, distinct du conseil. `SectionStudentHealthTracking.tsx` affiche désormais les deux dans deux blocs visuellement séparés. Clés `health_tracking.convocation_title` ajoutées fr/en.
>
> **Suite de tests backend remise à zéro échec (264 pass/0 fail, contre 229 pass/18 fail au début de ce chantier)** — creusé à la demande de l'utilisateur, pas patché à l'aveugle. Trois causes distinctes : (1) `InMemoryAnneeAcademiqueRepository.findSequencesByPeriode` était un stub retournant toujours `[]`, jamais branché à une fixture réelle — `GenererBulletinUseCase` (6 tests) ne trouvait donc jamais d'élève avec notes validées ; (2) fixtures `ConnecterUtilisateurUseCase.test.ts` (3 tests) réutilisaient un utilisateur créé pour `school-1` en tentant de se connecter sur `school-2`/`school-3`, échouant avant même la vérification de statut d'école testée, et vérifiaient un texte de message obsolète face à des codes d'erreur (`SCHOOL_SUSPENDED`) ; (3) **vrai bug produit** — `SubjectAssignmentHelper.assignerMatieresPourClasse` ne rappelait jamais son propre fallback `ensureCoefficients()` (documenté "utile pour technique, primaire, etc.") pour les niveaux hors `NIVEAU_MAP` (ex. `CAP1`, `CP`) — un `return` prématuré empêchait toute création de `SubjectCoefficient` pour ces classes. Corrigé en appelant `ensureCoefficients()` avant ce `return`. Les 5 derniers échecs (intégration Prisma) nécessitaient la base `zekoulabia_test` (`.env.test`), jamais migrée — résolu par `prisma migrate deploy` ciblé, sans toucher à la base de développement.
>
> `tsc --noEmit` propre (backend + frontend), tests backend 264 pass/0 fail.

## B.9 Definition of done — Partie B

- Depuis une fiche élève signalée, un censeur ou un enseignant principal peut créer une des trois actions en quelques clics, avec le contexte de l'alerte pré-rempli.
- Chaque action assignée génère une notification via le mécanisme déjà existant.
- Une action peut être close avec une note obligatoire, et reste visible dans l'historique de l'élève après clôture.
- Aucune action de suivi n'est visible par un rôle non habilité, ni par d'autres élèves.
- La Partie A est confirmée conforme avant que cette partie ne soit considérée comme livrable en production.
