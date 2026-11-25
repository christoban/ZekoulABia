# Rendre ZekoulABia vivante : les fonctionnalités événementielles liées au calendrier académique

> **Date de rédaction :** juillet 2026
> **Statut :** ✅ implémenté (MVP fonctionnel) — voir Section 9 pour le détail exact de ce qui est construit.

---

## 1. Le constat de départ

ZekoulABia est déjà une plateforme dynamique au sens technique (données en temps réel, notifications, synchronisation). Mais elle donne une impression de **statisme** parce que toutes les fonctionnalités sont visibles en permanence, qu'elles servent ou non au moment où l'utilisateur les regarde.

Or un établissement scolaire camerounais ne vit pas de façon uniforme toute l'année. Il traverse des **temps forts** : la rentrée, la bascule vers le programme bilingue après les résultats d'un examen, le choix d'une LV2 en fin de 5ème, la clôture d'année. En dehors de ces moments, la fonctionnalité correspondante n'a tout simplement rien à faire là — elle occupe de l'espace mental et visuel sans apporter de valeur.

**Le principe adopté :** distinguer clairement deux familles de fonctionnalités.

| | Fonctionnalités permanentes | Fonctionnalités événementielles |
|---|---|---|
| Exemples | Notes, présences, séquences, communication | Configuration rentrée 6ème/5ème, migration post-examen bilingue, choix LV2 |
| Rythme | Actives toute l'année scolaire | Actives seulement pendant une fenêtre précise |
| Ce qui doit rester visible en dehors de leur fenêtre | Toujours | Discret ou archivé, jamais supprimé |

---

## 2. Trois types d'événements — et pourquoi la distinction change tout techniquement

### Type 1 — Événement à date connue à l'avance
**Exemple :** configuration de l'entrée en 6ème/5ème à la rentrée.

La date est connue longtemps en avance (le calendrier scolaire est publié par le MINESEC). On peut donc programmer une ouverture et une fermeture automatiques à des dates fixes — même principe que les **feature flags programmés dans le temps** ("scheduled feature flags" / "time-based rollouts") : la date n'est jamais codée en dur, elle est un paramètre, et le système active/désactive automatiquement la fonctionnalité aux dates prévues, sans intervention manuelle ni redéploiement.

### Type 2 — Événement déclenché par un fait externe imprévisible
**Exemple :** migration des élèves de 6ème vers la classe bilingue, après la publication des résultats de l'examen du programme spécial bilingue.

Pas de date fixe fiable à l'avance : la date réelle dépend d'un événement extérieur qui peut glisser dans le temps. **Le bon mécanisme n'est pas la programmation automatique, mais un "interrupteur opérationnel"** : la fonctionnalité existe et attend, désactivée par défaut, et c'est un administrateur qui l'active manuellement au moment réel où l'événement se produit — même principe que les "kill switches" / "operational toggles" utilisés pour des événements sensibles ou imprévisibles.

### Type 3 — Événement à fenêtre glissante et floue
**Exemple :** choix de la LV2, ouvert "à partir de la deuxième période", sans date de fin rigide.

Une date de début approximative mais pas de coupure nette obligatoire. Le bon mécanisme : une fenêtre par défaut proposée automatiquement, mais avec une date de fermeture **ajustable par l'administrateur de l'établissement**, pas figée dans le code.

---

## 3. Le principe transversal : ne jamais tout automatiser à 100%

**Un système entièrement automatique et rigide est plus fragile qu'un système à moitié automatisé mais supervisable.** La réalité d'un établissement (retard de résultats, décision de dernière minute, événement exceptionnel) doit toujours pouvoir prendre le pas sur une date programmée à l'avance :
- Type 1 : automatique, avec possibilité de report manuel par l'administrateur si besoin.
- Type 2 : jamais automatique par défaut — déclenché manuellement.
- Type 3 : fenêtre par défaut automatique, mais bornes ajustables.

---

## 4. Le mécanisme de notification

Deux moments de notification pour chaque événement :
1. **Notification d'ouverture** — dès qu'une fenêtre s'ouvre, les rôles concernés reçoivent une notification les informant que l'action est désormais possible.
2. **Rappel avant fermeture** — un rappel automatique (3 jours ouvrés scolaires avant la fermeture) pour les personnes n'ayant pas encore agi.

---

## 5. Représentation dans l'interface

Plutôt que de faire apparaître/disparaître des pans entiers du menu (ce qui désoriente un utilisateur), structurer le tableau de bord **autour des tâches à accomplir plutôt que d'une simple taxonomie de fonctionnalités figée** :
- Un **centre d'événements** (bandeau en tête de dashboard) qui remonte les événements actuellement actifs ou dont l'ouverture approche.
- En dehors de sa fenêtre active, la fonctionnalité reste accessible en historique/archive, jamais supprimée.
- Un badge/indicateur simple pendant qu'un module est « en vie », sans redessiner toute l'interface.

---

## 6. Modèle de données

Chaque « événement académique » est représenté par une entité avec : un type, une catégorie (les trois du point 2), une date d'ouverture, une date de fermeture, une cible (rôles concernés), un statut (à venir / actif / clos).

---

## 7. Pourquoi c'est aussi un vrai argument produit

Un ERP scolaire générique n'a aucune raison de penser en termes de cycle de vie académique camerounais précis (rentrée en 6ème/5ème, bascule bilingue post-examen, choix LV2 en 5ème).

---

## 8. La conscience du calendrier scolaire : congés, vacances et jours fériés

Tout le système événementiel repose sur une couche encore plus basique : **la connaissance du calendrier scolaire lui-même.**

### 8.1 Deux niveaux de calendrier

- **Un calendrier national de référence** — le calendrier officiel MINESEC/MINEDUB.
- **Un calendrier propre à chaque établissement**, qui **hérite** du calendrier national mais peut ajouter ses propres exceptions locales.

L'établissement ne redéfinit jamais tout un calendrier à partir de zéro — il part du calendrier national et n'ajoute que ses écarts.

### 8.2 Pourquoi cette couche doit exister avant les trois types d'événements

Sans elle : un événement Type 1 pourrait s'ouvrir un jour de fermeture ; un rappel pourrait partir pendant les vacances de Noël ; un délai « 3 jours avant la clôture » calculé en jours calendaires tomberait faux — mieux vaut raisonner en **jours ouvrés scolaires**.

### 8.3 Ce que ça change pour le moteur d'événements

- Fenêtres et rappels calculés par rapport au calendrier ouvré de l'établissement, pas au calendrier civil.
- Une fenêtre Type 3 qui chevauche des vacances est automatiquement prolongée.
- Le centre d'événements peut afficher les congés à venir comme information de contexte.

### 8.4 Note — groupes scolaires (complexes multi-établissements)

Le même principe d'héritage (national → établissement) s'applique naturellement à un niveau intermédiaire pour les groupes scolaires multi-établissements (voir feuille de route du dossier de candidature, section « multi-établissements ») : un groupe pourrait définir ses propres exceptions communes à tous ses établissements, chaque établissement du groupe héritant ensuite à son tour et ajoutant ses propres écarts locaux. Non implémenté à ce stade (le module multi-établissements lui-même reste sur la feuille de route), mais l'architecture actuelle (exceptions par `schoolId`) n'empêche pas cette extension le moment venu.

---

## 9. État de l'implémentation (mise à jour juillet 2026)

**Ce qui est construit et fonctionnel :**

- **Modèles Prisma** `AcademicEvent` (type, catégorie, dates, rôles cibles, statut, traçabilité création/déclenchement) et `SchoolCalendarException` (exceptions locales par établissement).
- **Calendrier scolaire réutilisé, pas réinventé** (`backend/src/utils/schoolCalendar.ts`) : les vacances se déduisent des intervalles entre `AcademicPeriod` déjà définies pour l'année courante, plus les exceptions locales — pas de calendrier national à maintenir séparément. Complété par les jours fériés nationaux camerounais à date fixe (Jour de l'an, Fête de la Jeunesse, Fête du Travail, Fête Nationale, Assomption, Noël) et le lundi de Pâques (calculé par l'algorithme de Computus) — ces jours tombent souvent EN PLEIN MILIEU d'un trimestre actif et ne seraient jamais détectés par le seul découpage en périodes. Les fêtes à date mobile non calculables de façon fiable (Aïd el-Fitr, Aïd el-Kebir, Mawlid — calendrier lunaire, confirmées chaque année par les autorités religieuses) ne sont volontairement pas devinées : un établissement qui les observe les ajoute lui-même via `SchoolCalendarException`, mécanisme déjà prévu pour ce cas. Fonctions `estJourOuvreScolaire`, `ajouterJoursOuvresScolaires`, `prolongerSiFermetureAujourdhui`.
- **5 use cases** (`backend/src/application/academicEvent/`) : création (validation spécifique par catégorie), déclenchement manuel (Type 2), ajustement de fenêtre (Type 3), liste de gestion (Admin), liste active filtrée par rôle (centre d'événements).
- **Job Inngest quotidien** (`checkAcademicEvents`, cron 6h) : active les événements Type 1 arrivés à échéance, envoie les rappels à 3 jours ouvrés scolaires de la clôture (une seule fois), clôture les événements dont la date de fin est dépassée. Pour la prolongation Type 3 : vérifie CHAQUE jour (pas seulement le jour de clôture) si la journée en cours est fermée, et prolonge d'un jour à chaque fois tant que la fenêtre est encore ouverte — une coupure de plusieurs semaines en plein milieu de la fenêtre (vacances de Noël pendant le choix LV2, par exemple) est ainsi intégralement compensée au fil des passages du job, pas seulement le cas où la clôture coïncide par hasard avec un jour fermé (bug identifié en revue et corrigé avant la première version).
- **API REST** (`/api/v2/academic-events`) : CRUD de gestion (Admin uniquement), déclenchement manuel, ajustement de fenêtre, endpoint public `/active` pour le centre d'événements (filtré par rôle de l'appelant).
- **Frontend Admin** : section de gestion complète (création avec formulaire adapté par catégorie, liste avec KPIs, déclenchement manuel en un clic, ajustement de clôture) + widget « centre d'événements » discret en tête de dashboard, avec notification d'ouverture/rappel réutilisant l'infrastructure de notification existante (cloche in-app + push).

**Ce qui reste hors périmètre de ce premier jet (itération future si besoin) :**
- Héritage de calendrier à l'échelle d'un groupe scolaire multi-établissements (section 8.4) — dépend du module multi-établissements lui-même, non construit.
- SMS pour les notifications d'événement (actuellement in-app + push uniquement, cohérent avec le choix de ne pas engager de coût SMS pour du contenu informatif non urgent).

**Mise à jour — centre d'événements étendu à tous les rôles :** le widget `EventCenterWidget` a été extrait en composant partagé (`frontend/src/components/EventCenterWidget.tsx`, i18n dans `common.json`) et monté sur les cinq dashboards (Admin, Staff, Enseignant, Parent, Élève) — l'endpoint `/api/v2/academic-events/active` filtrait déjà par rôle côté serveur, seul le câblage frontend restait à faire. Seul l'Admin a un bouton « Voir » menant à l'écran de gestion (`onNav` optionnel) ; les autres rôles voient le bandeau informatif avec fermeture (X) uniquement, puisqu'ils n'ont pas d'écran de gestion des événements.

**Mise à jour — unification avec la fonctionnalité réelle CHOIX_LV2 (correction d'un écart critique signalé en revue) :** jusqu'ici, `AcademicEvent` était un système de suivi/notification totalement déconnecté du mécanisme métier réel qui gère la fonctionnalité Choix LV2 (`Lv2ChoiceWindow`, préexistant à ce chantier) — un admin pouvait créer un événement CHOIX_LV2 (notification, bandeau) sans que la fenêtre réelle ne s'ouvre, et inversement. Corrigé : `AcademicEvent` gagne un champ `level` (Lv2ChoiceWindow est scopée par niveau, pas seulement par école) et `linkedResourceId` ; l'activation d'un événement CHOIX_LV2 (création immédiate, déclenchement manuel, ou activation Type 1 par le job quotidien) ouvre RÉELLEMENT la fenêtre via `OuvrirFenetreChoixLV2UseCase`, et n'est jamais marquée ACTIVE si cette ouverture échoue — jamais un menu qui s'affiche pour une fonctionnalité qui n'est pas vraiment ouverte. Les ajustements/prolongations de clôture et la clôture elle-même sont répercutés sur la vraie fenêtre. Côté frontend, le menu « Choix LV2 » de la sidebar Admin n'apparaît désormais QUE si un `AcademicEvent` CHOIX_LV2 est actif.

Deux bugs pré-existants (non liés à ce chantier, mais qui auraient bloqué cette intégration) ont été trouvés et corrigés au passage : l'endpoint `GET /api/v2/lv2-choice-windows` n'existait pas (l'écran de suivi LV2 appelait un endpoint 404 depuis sa création) ; `OuvrirFenetreChoixLV2UseCase` filtrait les élèves sur un champ `StudentProfile.schoolId` qui n'existe pas dans le schéma (l'école se filtre via la relation `user`). Les deux n'avaient jamais été exercés en conditions réelles faute de chemin d'exécution complet — vérifiés par un smoke test dédié (création, doublon refusé sans orphelin, ajustement synchronisé, clôture synchronisée, étanchéité entre types d'événements).

**Mise à jour — extension du même principe au concours d'entrée en 6e et à la sélection PEBS, avec un mécanisme différent de LV2 (délibérément) :** ces deux fonctionnalités (`EntranceExamSession`/`PebsExamSession`) existaient déjà, créées directement par l'admin, avec leur propre machine à états (`DRAFT → RESULTS_PENDING → CLOSED` / `DRAFT → RESULTS_PENDING → APPLIED`) — contrairement à LV2, il n'y avait pas besoin d'un `AcademicEvent` par-dessus : le statut réel du modèle est déjà la source de vérité, un `AcademicEvent` intermédiaire ne ferait que le dupliquer (risque de divergence, exactement le défaut initial qu'on corrige). Le menu Admin correspondant (`entrance-exams`/`pebs-exams`) est maintenant gaté directement sur ce statut réel (`status != CLOSED` / `!= APPLIED`), calculé côté frontend à partir d'un simple GET de liste.

Deux ajouts significatifs ont été nécessaires pour que cette règle ait un sens :
- **Clôture automatique de `EntranceExamSession`** — elle ne transitionnait jamais vers `CLOSED` nulle part dans le code existant (le menu serait resté visible indéfiniment après la première session créée). Ajoutée dans `EnregistrerResultatCepUseCase` : la session se clôture d'elle-même dès que plus aucun candidat n'est en attente de traitement (`PENDING`/`ADMIS_PROVISOIRE`) — un signal réel de fin de processus, pas une date arbitraire. `PebsExamSession` avait déjà sa transition terminale (`AppliquerTransfertPebsUseCase` → `APPLIED`), rien à ajouter de ce côté.
- **Notifications ADMIN/STAFF à l'ouverture et à la clôture** (réutilisation directe de `academicEventNotifier.ts`, appelée depuis les use cases `CreerSessionConcoursUseCase`, `CreerSessionPebsUseCase`, `EnregistrerResultatCepUseCase` et `AppliquerTransfertPebsUseCase`) — la notification accompagne le changement de visibilité, elle ne le remplace pas, cohérent avec LV2.

Au passage, l'endpoint `GET /api/v2/entrance-exams` et `GET /api/v2/pebs-exams` (liste des sessions) n'existaient pas non plus — même défaut que LV2, jamais exercé faute d'écran de gestion pleinement fonctionnel. Ajoutés ; les écrans `SectionAdminEntranceExams.tsx`/`SectionAdminPebsExams.tsx`, qui les appelaient déjà en silence sur un 404, sont donc désormais réellement fonctionnels pour la première fois. Vérifié par un smoke test dédié à la clôture automatique (session reste ouverte tant qu'un candidat est en attente, se clôture au dernier).

**Régression trouvée et corrigée :** le passage par `AcademicEvent`/`activerRessourceLieeSiApplicable` pour ouvrir une fenêtre LV2 appelle `OuvrirFenetreChoixLV2UseCase` directement, en court-circuitant `Lv2ChoiceController.creerFenetre` — qui envoyait le SMS d'ouverture au téléphone du parent (`notifyLv2WindowOpenSms`). Ce SMS ne partait donc plus pour les fenêtres ouvertes via `AcademicEvent`. Réintégré directement dans `activerRessourceLieeSiApplicable`.

**Vérifié au passage (recherche, sans changement de code) :** le choix LV2 côté élève était déjà entièrement fonctionnel avant ce chantier — endpoints dédiés (`GET/POST /api/v2/students/me/lv2-choice*`) et bannière auto-masquante (`Lv2ChoiceBanner.tsx`, `return null` hors fenêtre active) qui respectait déjà le principe « rien du tout en dehors de la fenêtre, jamais grisé ». Concours 6e et PEBS n'ont, à ce stade du processus, aucun rôle élève/parent dans le système (le candidat n'a pas encore de compte) — confirmé par l'absence de toute route non-ADMIN/STAFF ; la notification (SMS) du candidat/parent existait déjà et est solide (`notifyCepResultSms`, `notifierOnboardingLienCree`), rien à y ajouter.
