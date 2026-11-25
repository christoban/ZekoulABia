# PLAN DE DÉVELOPPEMENT V2 — Écosystème IA ZekoulABia
## Feuille de route long terme : LLM interchangeable, RAG, modèles prédictifs ML, assistant pédagogique de révision

> **Date de rédaction :** juillet 2026
> **Statut :** vision long terme — hors périmètre du MVP actuel et du dossier de candidature au Concours National du Meilleur Projet TIC 2026 (à l'exception d'une mention de contexte/faisabilité, la fonctionnalité de détection des élèves à risque étant déjà partiellement construite — voir Section 5). Document de mémoire de conception, pas un plan d'implémentation à exécuter immédiatement.
> **Origine :** séance de cadrage avec ChatGPT sur l'architecture IA cible d'EDUNEXUS/ZekoulABia (transcription conservée dans `Ambition.docx` à la racine du projet). Ce document en est la synthèse structurée, complétée par le plan détaillé de l'assistant de révision déjà rédigé séparément (Section 4).
> **Pourquoi ce document existe :** pour ne jamais perdre le fil de cette vision entre deux chantiers — chaque phase ci-dessous n'est démarrée que lorsque ses prérequis réels (matériel, données, base de clients) sont réunis, jamais avant.

---

## SOMMAIRE

- Section 0 — Vision et principes directeurs
- Section 1 — Pourquoi une architecture par briques, pas un seul gros modèle
- Section 2 — La feuille de route en 5 phases
- Section 3 — Architecture technique cible (schéma)
- Section 4 — Phase 4 en détail : assistant de révision personnalisé (élève)
- Section 5 — État des lieux réel (juillet 2026) : ce qui est déjà construit
- Section 6 — Modèles et algorithmes envisagés pour la Phase 3 (tableau de référence)
- Section 7 — Conditions de déclenchement de chaque phase

---

# SECTION 0 — VISION ET PRINCIPES DIRECTEURS

La vision long terme n'est plus « ZekoulABia est un logiciel de gestion scolaire avec un chatbot en plus », mais : **ZekoulABia est une plateforme intelligente de gestion et d'accompagnement éducatif, où chaque acteur de l'établissement (administrateur, enseignant, parent, élève, direction) dispose de son propre assistant IA, limité à ses droits, capable de comprendre le contexte réel de l'école et, pour certains rôles, d'agir dans son périmètre.**

Principes qui traversent les 5 phases, hérités de ce qui est déjà appliqué au copilot administratif actuel (`Plan_Copilot_Unifie_ZekoulABia.md`) et au système de détection des élèves à risque livré ce mois-ci :

1. **Un seul LLM conversationnel suffit, pas cinq.** Ce qui change d'un assistant à l'autre (Administrateur, Enseignant, Élève, Parent), ce n'est pas le modèle, c'est le contexte et les outils qu'on lui donne — mêmes principes que le catalogue d'actions RBAC déjà en place pour le copilot Admin.
2. **Moteur IA interchangeable, jamais figé.** Aujourd'hui : appel API (Groq). Demain, si le matériel le permet : LLM open source local (Qwen 3 ou équivalent au moment venu). L'architecture doit permettre ce remplacement sans toucher au reste de l'application — le port `IAService` déjà en place (`backend/src/domain/ports/services/IAService.ts`) est précisément conçu pour ça.
3. **Machine learning spécialisé pour la prédiction, pas un LLM.** Détecter un élève à risque, un décrochage, ou regrouper des profils d'élèves relève de modèles tabulaires légers (CatBoost, XGBoost, LightGBM, Isolation Forest, K-Means), pas d'un grand modèle de langage — le LLM n'intervient qu'ensuite, pour transformer un score en explication et un conseil personnalisés lisibles par un humain.
4. **Offline-first, y compris pour l'IA à terme.** Cohérent avec le reste de la plateforme (mode hors ligne déjà opérationnel pour les fonctions cœur) : viser à terme un fonctionnement local de l'IA principale, sans dépendre en permanence d'une connexion Internet, tout en acceptant qu'aujourd'hui l'IA passe par une API externe (Groq) en attendant les moyens matériels.
5. **IA gouvernée et jamais sur une supposition.** Un assistant qui agit (Brique 2 / Phase 5) ne fait jamais l'action lui-même : il propose, le backend revérifie les permissions réelles de l'utilisateur, et exécute — jamais l'inverse. Même logique stricte pour l'assistant de révision (Section 4) : jamais d'aide sur une évaluation en cours.
6. **On ne construit que ce qui est nécessaire à l'étape en cours.** Concevoir l'architecture dès aujourd'hui pour que l'ajout d'un RAG, d'un modèle prédictif ou d'un LLM local dans deux ou trois ans n'exige pas de reconstruire l'application — mais ne rien développer avant d'en avoir réellement besoin (moyens matériels, données réelles, base de clients).

---

# SECTION 1 — POURQUOI UNE ARCHITECTURE PAR BRIQUES, PAS UN SEUL GROS MODÈLE

La conversation de cadrage a permis de trancher un point de conception important : ZekoulABia n'a jamais eu besoin de plusieurs LLM entraînés séparément. La bonne architecture sépare clairement :

| Brique | Rôle | Type de modèle |
|---|---|---|
| **Cerveau conversationnel** | Comprendre, répondre, rédiger, expliquer, dialoguer — pour tous les rôles | 1 seul LLM (aujourd'hui Groq/Llama 3.3, demain un modèle open source local) |
| **RAG (Retrieval-Augmented Generation)** | Aller chercher les informations pertinentes (élèves, notes, règlements, programmes officiels) avant que le LLM ne réponde, pour qu'il ne réponde qu'avec des données réelles et autorisées | Pas un modèle — une architecture (base vectorielle + moteur de recherche) |
| **Agents IA / Function Calling** | Transformer une demande en langage naturel en appel d'une fonction précise de l'application (créer un élève, valider des notes...), sous contrôle des permissions | Le même LLM, avec des outils différents selon le rôle — déjà implémenté pour l'Admin (`adminActionCatalog.ts`) |
| **Modèles prédictifs ML** | Détecter des élèves à risque, un décrochage, regrouper des profils, détecter des anomalies — à partir de données tabulaires (notes, présence, discipline) | Plusieurs petits modèles spécialisés (CatBoost, XGBoost, LightGBM, Isolation Forest, K-Means) — pas un LLM |
| **Mémoire de l'établissement** | Le LLM ne mémorise jamais directement toute la base — il interroge à la demande la base de données scolaire, les documents internes, l'historique, dans la limite des permissions de l'utilisateur | Base de données + index de recherche |

Chaque brique fait ce qu'elle sait faire le mieux ; c'est cette séparation qui permet de faire évoluer chaque composant indépendamment sans reconstruire toute la plateforme.

---

# SECTION 2 — LA FEUILLE DE ROUTE EN 5 PHASES

## Phase 1 — Version actuelle (MVP) — ✅ EN GRANDE PARTIE FAITE

**Objectif.** Disposer d'une plateforme entièrement fonctionnelle avec une première génération d'assistants IA, via une API externe, sans dépendance matérielle lourde.

**Contenu :**
- Utilisation d'un modèle via API (Groq / Llama 3.3), pas de modèle entraîné ou hébergé localement.
- Assistant Administrateur : copilot gouverné, catalogue d'actions RBAC (54 actions au 20 juillet 2026), function calling, confirmation obligatoire avant toute action destructive.
- Génération de commentaires de bulletin, d'insights pédagogiques, de chat contextualisé à l'établissement.
- Détection des élèves à risque et recommandations personnalisées — voir Section 5, cette brique de la Phase 3 a été anticipée et partiellement construite dès la Phase 1, avec des règles + LLM plutôt qu'un modèle ML entraîné (voir justification en Section 5).
- Architecture dès maintenant modulaire : le port `IAService` isole tout appel au modèle de langage du reste de l'application, pour permettre un remplacement du moteur IA (Groq → LLM local) sans toucher aux use cases qui l'utilisent.

## Phase 2 — IA hybride (déclenchée par : accès à du matériel/serveur adapté)

**Objectif.** Réduire progressivement la dépendance à l'API externe Groq.

**Contenu envisagé :**
- Déploiement d'un LLM open source local — candidat pressenti au moment de la conversation de cadrage : **Qwen 3** (bon raisonnement, très bon en français, performant en appels de fonctions, existe en plusieurs tailles selon la machine disponible). À reconfirmer par une nouvelle recherche au moment de lancer cette phase, les modèles open source évoluant vite.
- Mise en place d'un moteur RAG (base vectorielle — Qdrant en production, ChromaDB pour démarrer plus simplement) + modèle d'embeddings multilingue compatible français (ex. `bge-m3` au moment de la conversation) pour transformer les textes en vecteurs recherchables.
- Base documentaire scolaire (programmes officiels, règlements, cours) alimentant ce RAG.
- Mémoire de l'établissement : le LLM interroge la base de données scolaire + les documents internes + l'historique à la demande, jamais par mémorisation directe.
- Fonctionnement offline-first pour l'IA principale, cohérent avec le reste de la plateforme.
- **Note de déploiement importante** (issue de la conversation de cadrage) : si un LLM tourne localement, il fait partie intégrante de l'infrastructure serveur (au même titre que PostgreSQL ou Redis) — il est téléchargé une fois à l'installation, pas à chaque déploiement applicatif.

## Phase 3 — IA décisionnelle (déclenchée par : données réelles collectées auprès d'écoles utilisatrices)

**Objectif.** Faire passer l'IA du rôle de simple assistant à celui de conseiller intelligent, fondé sur des modèles prédictifs entraînés sur des données scolaires réelles.

**Contenu envisagé :**
- Détection des élèves à risque et du décrochage scolaire, par un modèle ML spécialisé entraîné sur l'historique réel (notes, absences, retards, discipline, évolution des résultats) plutôt que sur les règles/seuils utilisés aujourd'hui.
- Analyse des performances, rapports intelligents.
- Recommandations automatiques générées par le LLM à partir du score produit par le modèle prédictif — même logique de séparation des rôles ("le modèle prédit, le LLM explique") que celle déjà appliquée dans le système de détection livré ce mois-ci (Section 5), mais avec un vrai modèle ML entraîné à la place des seuils configurables actuels.
- Modèles candidats et leur usage — voir tableau détaillé en Section 6.
- **Prérequis explicite, non négociable** (souligné dans la conversation de cadrage) : il ne s'agit pas de choisir le meilleur algorithme d'abord, mais d'avoir d'abord des données de qualité. Sans historique réel suffisant (plusieurs séquences, plusieurs établissements), même le meilleur modèle ne produira pas de résultats fiables — cette phase ne démarre donc qu'une fois une base d'écoles utilisatrices réelles constituée, avec le consentement nécessaire et dans le respect de la Loi n°2024/017 sur la protection des données personnelles.

## Phase 4 — IA pédagogique (déclenchée par : Phase 2 disponible, socle de programmes officiels numérisé)

**Objectif.** Créer un véritable tuteur intelligent côté élève — l'assistant de révision personnalisé.

Détaillée intégralement en **Section 4** ci-dessous (plan déjà rédigé, conservé tel quel car suffisamment mûr).

## Phase 5 — Écosystème IA complet (horizon long terme)

**Objectif.** Faire de ZekoulABia une plateforme où chaque rôle de l'établissement dispose de son propre assistant IA, limité à ses droits et capable d'agir dans son périmètre — Administrateur, Enseignant, Élève, Parent, Direction, Responsable informatique.

Chaque assistant aura uniquement accès :
- aux données auxquelles son rôle a droit (même moteur RBAC que le catalogue d'actions Admin actuel, étendu à tous les rôles) ;
- aux actions que son rôle est autorisé à effectuer ;
- aux outils (function calling) correspondant à son périmètre.

C'est l'aboutissement naturel de la philosophie déjà appliquée à l'Admin : un seul LLM, un contexte et des outils différents par rôle — pas cinq assistants séparés à maintenir.

---

# SECTION 3 — ARCHITECTURE TECHNIQUE CIBLE (SCHÉMA)

```
                    LLM principal (Groq aujourd'hui → LLM local demain)
                                    │
                    ┌───────────────┴───────────────┐
                    │                                │
                   RAG                          Agents IA
                    │                                │
            Base documentaire              Function Calling
         (programmes, règlements)      (catalogue d'actions RBAC,
                    │                   un par rôle à terme)
         Base de données scolaire
                    │
        ┌───────────┴────────────────────────┐
        │      Modèles ML spécialisés          │
        │  (indépendants du LLM, Phase 3)      │
        ├───────────────────────────────────────┤
        │ • Élèves à risque      → CatBoost     │
        │ • Décrochage scolaire  → XGBoost      │
        │ • Réussite aux examens → LightGBM     │
        │ • Détection d'anomalies→ Isolation    │
        │                           Forest       │
        │ • Regroupement profils → K-Means      │
        └───────────────────────────────────────┘
```

Le LLM ne mémorise jamais directement toute l'école : à chaque question, il recherche les informations nécessaires (RAG), construit le contexte (dans la limite des permissions de l'utilisateur), puis répond ou agit.

---

# SECTION 4 — PHASE 4 EN DÉTAIL : ASSISTANT DE RÉVISION PERSONNALISÉ (ÉLÈVE)

*Plan déjà rédigé et suffisamment mûr pour être conservé tel quel — reproduit intégralement ci-dessous.*

## 4.1 Vision

Aujourd'hui, le copilote IA de ZekoulABia assiste l'administration (chefs d'établissement, censeurs, enseignants) dans des tâches de gestion, sous contrôle strict des permissions. La Phase 4 étend cette même philosophie — un assistant gouverné, jamais un exécutant en roue libre — au dashboard de l'élève, sous la forme d'un assistant de révision personnalisé.

L'idée centrale : l'assistant connaît le programme officiel réel de l'élève — sa classe, sa série (ex. Terminale A = série littéraire), et le contenu attendu pour chaque matière — et l'aide à réviser sur cette base, tout au long de l'année, pas seulement à l'approche des examens.

## 4.2 Fonctionnalités envisagées

**4.2.1 — Connaissance du programme par classe et série.** L'assistant est alimenté avec le référentiel officiel du programme scolaire camerounais, décliné par classe et par série (littéraire, scientifique, technique...). Il sait donc, pour un élève donné, quel contenu est attendu dans chaque matière à ce stade de l'année.

**4.2.2 — Assistant de révision par matière et par notion.** L'élève peut interroger l'assistant sur une notion précise du programme ; l'assistant explique, reformule, propose des exercices d'entraînement ciblés sur cette notion.

**4.2.3 — Détection de lacunes à partir de travaux déjà corrigés.**
**Garde-fou de conception, non négociable :** cette fonctionnalité s'applique exclusivement à des **devoirs, exercices d'entraînement ou anciennes épreuves déjà corrigés**, jamais à une épreuve en cours de passation. L'élève peut photographier ou téléverser une copie déjà rendue et notée ; l'assistant analyse les erreurs récurrentes et identifie les notions à retravailler en priorité.

Ce garde-fou n'est pas une précaution accessoire : un assistant qui aiderait un élève pendant une épreuve en cours constituerait une forme de fraude assistée par IA — précisément le type de dérive que le Concours National du Meilleur Projet TIC entend combattre (thème « protéger le cyberespace des dérives de l'intelligence artificielle »). La fonctionnalité doit être techniquement et explicitement limitée aux travaux déjà clos et corrigés.

**4.2.4 — Recherche et approfondissement encadrés.** Sur une notion mal maîtrisée, l'assistant peut rechercher des ressources complémentaires (définitions, exemples, exercices), et les présenter de façon pédagogique — dans une logique d'accompagnement à la compréhension, jamais de réponse « clé en main » qui se substituerait au travail de l'élève ou à l'enseignant.

**4.2.5 — Usage continu, pas seulement en période d'examen.** L'assistant est conçu pour un usage régulier, séquence par séquence, tout au long de l'année scolaire — pas comme un outil de « dernier recours » avant le Bac ou le Brevet. L'intensification naturelle de l'usage en période d'examen (Bac, Probatoire, BEPC) est un cas d'usage important, mais ne doit pas être le seul mis en avant, pour ne pas réduire l'outil à une béquille de fin d'année.

**4.2.6 — Répétiteur virtuel / banque de preuves (piste complémentaire, non détaillée).** Une piste encore peu mûrie à ce stade : un mode « répétiteur » plus poussé, éventuellement adossé à une banque d'anciennes épreuves et corrigés (« banque de preuves ») pour enrichir la détection de lacunes et l'entraînement ciblé. À creuser dans une itération ultérieure, une fois le socle des points 4.2.1 à 4.2.5 stabilisé.

## 4.3 Principes de conception à respecter (hérités du copilote administratif actuel)

- **Assistant gouverné, jamais en roue libre** : l'IA explique et entraîne, elle ne fait jamais le travail à la place de l'élève ni ne fournit de réponse à une évaluation en cours.
- **Jamais sur une épreuve en cours de passation** — uniquement sur des travaux déjà clos et corrigés (voir 4.2.3).
- **Transparence pédagogique** : l'élève et l'enseignant doivent pouvoir voir ce que l'assistant a identifié comme lacune, pas une boîte noire.
- **Cohérence avec le programme officiel réel**, pas un contenu générique déconnecté du référentiel MINESEC/MINEDUB par série.

## 4.4 Lien avec l'existant (mise à jour juillet 2026)

Le système de détection précoce des élèves à risque livré ce mois-ci (Section 5) constitue une première brique concrète et directement réutilisable pour cette phase : le mécanisme de génération de conseil personnalisé par destinataire (`IAService.genererConseilPersonnalise`, trois tons distincts élève/parent/enseignant) et le modèle de persistance (`StudentRecommendation`) pourront être étendus, le moment venu, pour y intégrer des conseils de révision ciblés par notion plutôt que par alerte de santé scolaire uniquement.

---

# SECTION 5 — ÉTAT DES LIEUX RÉEL (JUILLET 2026) : CE QUI EST DÉJÀ CONSTRUIT

Ce document a été rédigé comme vision long terme "à ne pas développer avant d'en avoir besoin". Un fait nouveau mérite d'être noté : **une partie substantielle du raisonnement de la Phase 3 (détection des élèves à risque + recommandations automatiques) a déjà été implémentée**, plus tôt que prévu dans cette feuille de route — sous une forme volontairement plus légère que celle envisagée initialement (règles + seuils configurables + LLM, plutôt qu'un modèle ML entraîné type CatBoost/XGBoost), précisément parce que le prérequis "données réelles suffisantes" identifié en Section 2 (Phase 3) n'est pas encore réuni.

**Ce qui existe concrètement aujourd'hui (Early Warning System) :**
- Un indice de santé scolaire par élève (notes, présence, discipline, paiements), recalculé chaque nuit, avec seuils d'alerte configurables par établissement (`SchoolConfig.aiRiskThreshold`, `aiRiskThresholdCritical`).
- Une détection en temps réel de chute significative dans une matière précise, dès la validation des notes d'une séquence — pas seulement une moyenne générale.
- Un routage des alertes par rôle : parent (push puis SMS), professeur principal, censeur.
- Un conseil IA personnalisé et distinct généré pour chaque destinataire (élève, parent, enseignant) — trois tons, trois angles d'action — persisté (modèle `StudentRecommendation`) pour alimenter des vues dédiées côté enseignant, parent et élève.
- Une intégration au Conseil de Classe (élèves à risque signalés dans le détail d'une session) et à l'Orientation (le conseiller est notifié en cas de risque critique persistant, mais aucune fiche de suivi n'est jamais créée automatiquement à sa place).
- Une extension du copilot administratif avec deux actions de lecture dédiées (`lister_eleves_a_risque`, `resume_risque_eleve`).

**Ce que ça change pour la suite de ce document :**
- La Phase 3 telle que décrite en Section 2 n'est donc plus un point de départ à zéro : l'architecture de routage par rôle, de génération de conseil personnalisé et de gouvernance (jamais d'action automatique sur une supposition) est déjà en place et éprouvée. Le travail restant pour une "vraie" Phase 3 se limite, le moment venu, à remplacer les seuils/règles actuels par un modèle ML entraîné sur des données réelles — sans toucher au reste de l'architecture (routage, notification, persistance, gouvernance), déjà construite et réutilisable telle quelle.
- Cela confirme aussi, de façon très concrète, la faisabilité de la Phase 4 (assistant de révision) : le mécanisme de génération de conseil personnalisé par destinataire, brique centrale de cette phase, existe déjà et fonctionne en production.

---

# SECTION 6 — MODÈLES ET ALGORITHMES ENVISAGÉS POUR LA PHASE 3 (TABLEAU DE RÉFÉRENCE)

*Recommandations issues de la conversation de cadrage — à reconfirmer par une nouvelle recherche au moment de lancer cette phase, l'écosystème des modèles open source évoluant vite.*

| Tâche | Algorithme envisagé | Pourquoi |
|---|---|---|
| Élèves à risque | **CatBoost** | Excellent avec des données comportant beaucoup de variables catégorielles (classe, série, sexe, établissement) — typique des données scolaires camerounaises. |
| Décrochage scolaire | **XGBoost** | Très bon pour les prédictions sur données tabulaires, référence éprouvée. |
| Réussite aux examens | **LightGBM** | Rapide, précis, facile à mettre à jour au fil des séquences. |
| Détection d'anomalies (ex. chute brutale de notes, modification suspecte en masse) | **Isolation Forest** | Conçu spécifiquement pour repérer des comportements hors norme sans historique d'exemples "anormaux" étiquetés. |
| Regroupement automatique de profils d'élèves (excellents / moyens / en difficulté) | **K-Means** | Classification non supervisée, utile pour des vues de pilotage par le personnel. |

Pour le RAG (Phase 2) : base vectorielle (Qdrant en production, ChromaDB pour démarrer) + modèle d'embeddings multilingue compatible français (ex. `bge-m3` au moment de la conversation de cadrage).

---

# SECTION 7 — CONDITIONS DE DÉCLENCHEMENT DE CHAQUE PHASE

| Phase | Se déclenche quand... |
|---|---|
| Phase 2 (IA hybride) | Accès à un serveur/matériel capable de faire tourner un LLM open source en local (au moment de la conversation de cadrage : bloquant, faute de RAM/GPU suffisants). |
| Phase 3 (IA décisionnelle, vrais modèles ML) | Une base d'établissements clients réels existe, avec un historique de plusieurs séquences de données (notes, présence, discipline) et le consentement nécessaire au traitement — jamais avant, un modèle entraîné sur des données insuffisantes ou synthétiques ne serait pas fiable. |
| Phase 4 (assistant de révision) | Phase 2 disponible (ou volume d'usage justifiant un coût d'API plus élevé) + référentiel des programmes officiels camerounais numérisé et structuré par classe/série/matière. |
| Phase 5 (écosystème complet) | Les catalogues d'actions RBAC des rôles Enseignant, Parent et Élève existent et sont suffisamment matures (walking avant de courir — même logique de déploiement par couches que le reste des chantiers de ce projet). |

---

*Document de mémoire de conception — ZekoulABia / EDUNEXUS. À relire avant de démarrer une nouvelle phase de ce plan, pour vérifier que les conditions de déclenchement (Section 7) sont bien réunies avant de commencer.*
