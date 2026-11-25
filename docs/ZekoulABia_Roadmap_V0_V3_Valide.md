# ZekoulABia — Roadmap de développement V0 → V3 (version finale)
*Adaptée à partir de la proposition de ChatGPT, corrigée à la lumière de toutes les décisions prises dans nos échanges. Conçue comme si on repartait de zéro — la comparaison avec l'existant se fait dans un second temps, séparément.*

## Vue d'ensemble (inchangée)

```
V0 — Fondations
   ↓
V1 — Cœur ERP scolaire (établissement fonctionnel au quotidien)
   ↓
V2 — Automatisation des processus scolaires
   ↓
V3 — Plateforme intelligente + offline-first mature
```

---

# V0 — FONDATIONS DE LA PLATEFORME

**Objectif :** peut-on créer plusieurs établissements complètement isolés avec une structure scolaire cohérente ?

## V0.1 — Architecture (inchangé)
Hexagonal : Domain / Application / Infrastructure / Presentation. Le domaine ne connaît ni PostgreSQL, ni Express, ni Inngest, ni Next.js, ni fournisseur de paiement.

## V0.2 — Multi-tenant — **enrichi**
```
Platform
   │
   ▼
Tenant / Groupe scolaire
   │
   ├── School A
   ├── School B
   └── School C
```
**Ajout : le modèle Tenant/Groupe scolaire est conçu dès maintenant** (Platform → Tenant/Groupe scolaire → Écoles), même si la construction complète (facturation groupée, reporting consolidé multi-établissement) reste V2/V3 — décision prise parce que c'est une dépendance bloquante sur la couche identité, pas une simple fonctionnalité additive qu'on peut concevoir plus tard sans risque.

**Gestion de l'établissement** : informations générales, paramètres, identité visuelle, coordonnées, structure propre à chaque école.

Critère de sortie inchangé : impossible pour l'établissement A de lire/modifier les données de B.

## V0.3 — Identité et sécurité (inchangé)
Utilisateurs, authentification, sessions/tokens, rôles, permissions, RBAC, MFA/TOTP, journalisation.

**Précision : l'audit trail commence ici, pas en V3.** La journalisation des actions sensibles doit être en place dès V0 — V3.7 ne fait que l'enrichir (contexte, "pourquoi", vues séparées). Ajouter l'audit après coup sur des modules déjà écrits est un chantier de reprise, pas un ajout.

**Rôles de référence — remplacés par la liste propre à ZekoulABia** (pas la liste générique) : Super Admin, Admin établissement, Chef d'établissement, Censeur, Surveillant Général, Intendant, Conseiller pédagogique, Professeur principal, Enseignant, Parent, Élève, Personnel administratif.

## V0.4 — Template Engine — **enrichi**
**Architecture à 4 couches (posée dès V0, absente de la roadmap originale) :**
```
1. Référentiel curriculaire national  (Arrêté N°92/22/MINESEC : 12 séries francophones
                                       A1-A5, ABI, C, D, E, TI, SH, AC avec matières/
                                       coefficients/heures ; GCE Board : 21 matières
                                       O-Level codes 0505-0595, 20 A-Level 0705-0796)
   ↓
2. Template d'établissement           (Template → Template Version → Template Configuration)
   ↓
3. Configuration par établissement (tenant)
   ↓
4. Couche opérationnelle (données de l'année)
```
Le référentiel national est partagé et immuable côté plateforme — un établissement n'y touche jamais, il en hérite via son template.

Templates prioritaires (8 du MVP) : LYCEE_FR, PRIVE_FR, GHS_EN, PRIVE_EN, LYCEE_BILINGUE, CES_FR, GSS_EN, COMPLEXE_SCOLAIRE (structure prête, données en brouillon/non peuplées).

**Règle d'override, à poser dès V0 :**
```
champ personnalisé de l'établissement → toujours prioritaire
champ non personnalisé → hérite du template
mise à jour de template → ne réécrit jamais un champ personnalisé, conflit signalé à l'admin
```
**Cas bilingue — configuration composée, pas fusion de deux templates :**
```
LYCEE_BILINGUE
├── Core commun
├── Configuration FR
└── Configuration EN
Priorité : établissement > sous-système > template générique
```

## V0.5 — Structure académique (inchangé, déjà correctement conçu par ChatGPT)
Cycles, niveaux, filières, classes, matières, groupes, spécialités, années scolaires.

```
Student ≠ Enrollment     (Student tenant-scoped, Enrollment year-scoped)
Teacher ≠ TeachingAssignment (Teacher tenant-scoped, TeachingAssignment year-scoped)
```
> **✅ RÉSOLU (chantier 2026-08-20)** : le `classId` direct a été supprimé. La classe d'un élève se lit uniquement via `Enrollment` year-scoped (`status='ACTIVE'` + `academicYear.isCurrent=true`), centralisée dans `backend/src/application/shared/studentEnrollment.ts`. 71 fichiers migrés, `tsc --noEmit` propre. Détail : `docs/AUDIT_ROADMAP.md` → V0.5.

## V0.6 — Année scolaire (inchangé)
`SchoolYear`, périodes, trimestres/séquences, période active, clôture, changement d'année.

**JALON V0 (inchangé) :** créer "Lycée privé francophone XYZ — 2026/2027" et obtenir automatiquement une structure cohérente.

---

# V1 — CŒUR ERP SCOLAIRE

**Objectif :** un établissement peut fonctionner quotidiennement avec ZekoulABia.

## V1.1 — Gestion des élèves — **enrichi**
Dossier élève, matricule, identité, documents, statut, inscription, réinscription, changement de classe, archivage.
```
Student → Enrollment 2025/26 → Enrollment 2026/27 → Enrollment 2027/28
```
**Ajout : historique longitudinal comme objet explicite** (parcours 6e→5e→4e→3e→2nde avec performances, absences, sanctions, choix, orientations, décisions de conseil de classe) — pas seulement une suite d'Enrollments dispersés. C'est ce qui rend l'orientation utile plus tard (6 ans de parcours plutôt que la dernière moyenne).

**Ajout : onboarding élèves et parents** (distinct de l'onboarding établissement en V2.1) — `StudentOnboarding` avec `sourceType` (autoservice / concours / import de masse), mécanisme unique à jeton avec rappels et validation admin. Onboarding parents à trois canaux : lien smartphone, guide SMS, saisie par l'établissement, avec canal préféré capté par famille. Rappels ancrés sur horodatage serveur, jamais sur l'horloge de l'appareil.

**Ajouts absents de la roadmap originale :**
- **`StudentOnboarding` avec `sourceType`** (AUTOSERVICE, CONCOURS, IMPORT_MASSE) — un seul mécanisme à token convergeant l'inscription autonome, la confirmation de concours et l'import de masse, avec rappels asynchrones et validation admin. Les timers de rappel s'ancrent sur l'horodatage serveur, jamais sur celui de l'appareil.
- **Profil académique de l'élève** — construction progressive (performances, évolution, matières fortes/faibles, absences, résultats, historique). C'est la source unique qui alimentera ensuite Early Warning (V3.4), Orientation (V2.9) et Conseil de classe (V1.13).
- **Historique longitudinal** — parcours conservé sur toute la scolarité (6e → Tle), pas seulement l'année courante. C'est l'argument différenciant réel pour l'orientation : une décision fondée sur 6 ans de parcours vaut mieux qu'une décision sur la dernière moyenne.

## V1.2 — Gestion des enseignants (inchangé)
Profil, matières, compétences, disponibilité, statut, historique.
```
TeachingAssignment = Teacher + Subject + Class + SchoolYear
```

## V1.3 — Personnel et responsables (inchangé)
Personnel administratif, surveillants, censeurs, responsables, parents/tuteurs, relations parent↔élève.

## V1.4 — Importation massive (inchangé)
CSV/Excel pour élèves, enseignants, personnel, parents, classes. Pipeline : Upload → Mapping → Validation → Preview → Correction → Import.

## V1.5 — Socle emploi du temps — **déplacé de V2 vers V1, avec justification**
ChatGPT plaçait tout le Scheduling en V2. **Correction :** un socle minimal (domaine + saisie manuelle) est en réalité une dépendance de V1, pas une nouveauté de V2 — ton système de présence par QR croisé avec l'emploi du temps a besoin d'un `TimetableSlot` existant pour fonctionner, et le jalon V1 ("faire cours") le suppose implicitement.

Construire ici (= S1 + S2 du document dédié) :
```
Teacher, Class, Subject, Room, TimeSlot, TeachingAssignment, CourseBlock, Timetable
```
**Manual Scheduler** — un humain peut créer/modifier un emploi du temps manuellement, sans automatisation. Objectif : valider le modèle de domaine avant de brancher un solveur (voir V2.5 pour la suite).

**SchoolSchedulePolicy** configurable par établissement (heures, pauses, jours travaillés) — jamais codée en dur.

## V1.6 — Évaluations — **considérablement enrichi**
Le V1.5 original de ChatGPT ne reprenait aucune de nos décisions détaillées. Version corrigée :

**Assessment ≠ Grade** — `AssessmentParticipation` relie Student↔Grade. `EvaluationPolicy` portée par le template (types autorisés, échelle, coefficients, règles de calcul/validation/publication) — jamais en if/else par template dans le code.

`AssessmentScope` (classe/plusieurs classes/niveau/filière/établissement), `HarmonizedAssessmentSession` (rattache automatiquement plusieurs classes), `InvigilationPolicy` configurable et **explicitement non obligatoire en V1**.

Grade distinct d'Attendance (un 7/20 absent ≠ un 7/20 présent).

**Workflow de statut, réutilisant le pattern déjà existant pour la publication des frais :**
```
DRAFT → SUBMITTED → VALIDATED → PUBLISHED
```
Verrouillage après publication, modification uniquement via demande auditée.

**Examens officiels (BEPC/Probatoire/Bac/GCE) séparés** via une entité `OfficialExam` distincte — ZekoulABia enregistre, ne remplace jamais l'infrastructure MINESEC/GCE.

**Assessment Calendar** — calendrier central avec vues différenciées (élève : mes évaluations ; enseignant : mes copies à corriger ; parent : évaluations de mon enfant ; administration : toutes). **Assessment Workload** — alerte configurable de surcharge ("la 3eA a 4 évaluations en 3 jours"), aide à la planification, pas une règle imposée.

## V1.7 — Calcul académique — **corrigé**
```
Note → Moyenne matière → Moyenne période → Moyenne générale → Classement/statistiques
```
**Correction : pas de `GradingEngine` généralisé et configurable dès maintenant** — commencer par une fonction de calcul bien testée pour un seul template (LYCEE_FR), extraire une vraie interface seulement quand 2-3 templates montrent des règles réellement différentes.

## V1.8 — Bulletins (inchangé)
Génération, consultation, validation, publication, impression, PDF, historique. Le bulletin est une **projection** des données déjà validées, jamais une saisie séparée.

## V1.9 — Absences et discipline (inchangé)
Présence, absence, retard, justification, sanctions, observations.

## V1.10 — Communication de base (inchangé)
Babillard (publication, ciblage, catégories, expiration, lecture) + Messagerie (parent↔établissement, parent↔enseignant, administration↔enseignant).

## V1.11 — Paiements et frais — **ajouté, absent de la roadmap originale**
CampPay (MTN MoMo + Orange Money). Matricule national (cartescolaire.cm) intégré, obligatoire pour tout paiement/inscription aux examens.
**Workflow de publication des frais, réutilisé plus tard par le module évaluation :**
```
DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED (validation proviseur obligatoire)
```
Montants officiels confirmés (7 500/10 000 FCFA scolarité, 12 000 FCFA examens OBC, ~7 000 FCFA DECC).

## V1.12 — Conseil de classe — **ajouté, absent de la roadmap originale**
*(prépare les décisions de promotion V2.7 et d'orientation V2.9 ; s'enrichit de l'analyse forces/faiblesses V3.4 quand elle existe)*
Vue synthétique par classe préparant les décisions : effectif, élèves promus d'office, à surveiller, nécessitant une décision d'orientation, cas disciplinaires, élèves en forte baisse. S'appuie entièrement sur des données déjà présentes (résultats, absences, discipline) — coût d'ajout faible, forte valeur perçue. Identifié comme la meilleure idée nouvelle de tout le backlog.

## V1.13 — Reporting initial (inchangé, reste simple)
Effectifs, résultats, absences, répartition, statistiques par classe/sexe.

**JALON V1 (inchangé) :** inscrire élèves → affecter enseignants → faire cours → faire évaluations physiques → saisir notes → calculer résultats → produire bulletins → communiquer avec parents.

---

# V2 — AUTOMATISATION DES PROCESSUS SCOLAIRES

**Objectif :** ne plus seulement stocker les données, orchestrer le fonctionnement de l'établissement.

## V2.1 — Onboarding Engine (inchangé)
Invitation → Création compte → Identification template → Génération configuration → Personnalisation → Import données → Validation → Établissement opérationnel.

## V2.2 — Configuration intelligente (inchangé, déjà cohérent avec V0.4)
"Configuration locale > template" — une mise à jour de template n'écrase jamais une personnalisation locale.

## V2.3 — Gestion des salles (inchangé)
Salles, laboratoires, ateliers, capacité, disponibilité, ressources, contraintes.

## V2.4 — Affectation des enseignants (inchangé, déjà posé en V1.2/V1.5)
Professeur principal, plusieurs classes/matières, disponibilités, contraintes.

## V2.5 — Scheduling Engine (optimisation) — **considérablement enrichi et recentré**
Le socle (domaine + Manual Scheduler) est désormais en V1.5 — V2 se concentre sur l'**optimisation automatique**.

**Hard constraints** (non négociables) : conflit enseignant, conflit classe, conflit salle, disponibilité enseignant, volume horaire exact, séance de 2h réellement consécutive.

**Soft constraints — modélisation unifiée (score numérique pondéré, tranché entre les deux propositions concurrentes de ChatGPT) :**
```
Mathématiques le matin        → +10
Éviter trou enseignant        → +8
Éviter 3 cours consécutifs    → +6
Équilibrer la semaine         → +5
```

**Solveur : Google OR-Tools, composant CP-SAT — vérifié techniquement.** Pas de binding Node.js/TypeScript officiel (Python/C++/Java/.NET seulement) ; solution retenue : `or-tools-wasm` (projet communautaire, Apache 2.0), compile OR-Tools en WebAssembly avec API TypeScript, testé sur Bun/Node/Deno — évite le microservice Python classique. **Spike technique obligatoire avant d'engager l'architecture complète** (cas CP-SAT jouet dans l'environnement Bun réel).

**Port hexagonal :**
```
SchedulingEngine → SchedulingSolverPort → ORToolsWasmAdapter (aujourd'hui) / FutureSolverAdapter (si besoin)
```

Plusieurs solutions scorées (94/91/88), modification humaine → réoptimisation automatique, réparation automatique sur conflit, "Explain My Timetable" (pas besoin d'IA, les raisons sont dans les règles évaluées), "What if?" (simulation sans modifier le réel).

**Lien avec Assessment (déjà tranché) :** port `AssessmentScheduleQuery` possédé par Assessment, consommé par Scheduling ; mise à jour réactive via événement `AssessmentScheduled` sur Inngest — jamais de dépendance bidirectionnelle directe.

## V2.6 — Événements et workflows (inchangé, déjà la référence)
```
Use Case → Domain Rule (fonction pure) → Action → événement Inngest
```
Pas de second Event Bus — Inngest gère notifications, rappels, audit, tâches asynchrones, synchronisation.

## V2.7 — Promotions (inchangé)
```
Fin année → Évaluation → Décision → Promotion → Nouvel Enrollment
```
Conservation complète de l'historique. Codé en dur comme `PromoteStudentUseCase` (pas de moteur générique). S'appuie sur le Conseil de classe (V1.12) comme vue de préparation des décisions.

## V2.8 — Choix académiques — **précisé avec les spécificités déjà modélisées**
LV2, choix de filière, options, délais, validation — même logique de use cases nommés.

**LV2 modélisée classe par classe** (`lv2SubjectId` sur le profil élève, marqueur de créneau LV2 sur l'emploi du temps), pas au niveau du niveau scolaire.

**PEBS (Programme d'Éducation Bilingue)** — admission en 6e via un concours interne organisé en cours d'année, imposant un mécanisme de réorganisation des classes (élèves placés provisoirement, redistribués après le concours). Cas particulier à traiter explicitement, pas un simple choix d'option.

*À signaler : "Anglais Renforcé" (colonne du recensement MINESEC 4e/3e) est distinct de Bilingue/PEBS et de la LV2 — actuellement non modélisé, champ laissé vide et signalé dans les exports statistiques, en attente de vérification terrain (aucune source institutionnelle ne définit son mécanisme).*

## V2.9 — Orientation — **enrichi avec l'architecture déjà validée**
Le système outille le conseiller, ne décide jamais à sa place. Analyse notes réelles (dégradation progressive selon profondeur d'historique) + résultat psychotechnique optionnel (configurable par établissement) + aspirations déclarées.

**Deux points de bascule couverts par un même moteur générique paramétrable :**
- Checkpoint 1 — fin 3e : A / SES / C
- Checkpoint 2 — fin Seconde C : C / D / TI

**Sortie narrative obligatoire, jamais un score brut** ("progression constante en maths et physique, performances linguistiques moyennes" — jamais "72/100 → profil scientifique"). Toujours 2-3 pistes proposées, jamais un verdict fermé. Dernier mot à l'élève ; le conseiller valide une proposition, délai de réponse configurable avec rappels, proposition retenue par défaut à l'échéance.

## V2.10 — Concours et événements scolaires (inchangé)
Concours d'entrée, dossiers candidats (Candidate ≠ Student, transition explicite à l'admission), tests, résultats, admission, affectation.

## V2.11 — Présence enseignants/personnel — **ajouté, absent de la roadmap originale**
QR code par salle croisé avec l'emploi du temps (scan obligatoire avant cahier de texte), ping GPS ponctuel (pas de tracking continu), fallback photo validée manuellement pour les établissements non équipés. Limité aux enseignants/personnel, pas d'extension aux élèves.

## V2.12 — Notifications (inchangé, déjà la référence)
```
Urgence → Canal disponible → Préférence utilisateur → Coût/efficacité
CRITIQUE → SMS + push obligatoire, ignore les préférences
```
100% déterministe, jamais de ML pour le routage.

**Ajout : suivi de diffusion** — envoyé / reçu / lu / confirmé par destinataire. Transforme une annonce passive en donnée exploitable ("98/127 reçus, 81 ouverts, 43 confirmés").

## V2.13 — Traçabilité financière — **enrichi**
Dépenses, catégories, justificatifs, validations, historique, rapports. **Ajout explicite : gestion des APE** (montants, gouvernance — qui autorise, qui valide, qui consulte) — identifié comme un vrai vide de gestion, pas seulement une "traçabilité financière" générique. Objectif : savoir qui a enregistré quoi, pourquoi, quand — pas devenir un logiciel comptable complet.

## V2.14 — Recensement statistique MINESEC — **ajouté, absent de la roadmap originale**
Pipeline de remplissage automatisé du questionnaire officiel (17 feuilles classifiées par fiabilité de donnée : auto-remplissable / partiel / manuel).

## V2.15 — Tâches administratives — **ajouté, absent de la roadmap originale**
Tâche, responsable, échéance, pièces jointes, commentaires, statut (à faire → en cours → terminé → validé), historique. Remplace les échanges WhatsApp informels pour les demandes internes (ex. le chef d'établissement demande au censeur la liste des élèves sous 10 de moyenne pour vendredi). Scope volontairement modeste, pas de sur-ingénierie.

**JALON V2 (inchangé) :** Données → Règles → Workflows → Automatisation → Notifications. ZekoulABia gère les processus, pas seulement les données.

---

# V3 — PLATEFORME INTELLIGENTE + OFFLINE-FIRST MATURE

## V3.1 — Offline-first mature — **enrichi avec l'architecture déjà détaillée**
```
UI → Service Worker + IndexedDB (chiffré) → Outbox (clés d'idempotence) → Sync Engine → API → Database
```
Vérification d'idempotence côté serveur. Cache miroir exact du filtrage RBAC serveur.

**Dépendance graduée par opération :**
- Fortement dépendant : saisie notes, absences, consultation élèves, emploi du temps.
- Moyennement dépendant : communication, workflows, certains rapports.
- Faiblement dépendant : administration centrale, configuration, finances sensibles.

Refresh token gradué par rôle (7j Admin/Intendant, 30j Enseignant/Élève/Parent). Purge cache immédiate sur déconnexion explicite seulement.

## V3.2 — Stratégie de conflits — **précisé**
```
Client A modifie X, Client B modifie X → Conflict → Conflict Resolution Policy
```
**Différenciée par type de donnée (déjà tranché) :** dernier écrit gagne pour les champs mineurs ; double-version + arbitrage humain obligatoire pour notes et paiements — jamais de résolution automatique silencieuse sur ces deux catégories.

**✅ Paiements — mis en œuvre 2026-08-20 :** version = `Invoice.updatedAt` (`@updatedAt`, migration `add_paiement_version_conflit`) ; `EnregistrerPaiementCashUseCase` accepte `baseUpdatedAt` et lève `ConflitVersionPaiementError` en cas de divergence ; **encaissement cash atomique** (`encaisserCash` : `$transaction` + `SELECT … FOR UPDATE` + garde du solde restant) — deux encaissements simultanés ne peuvent pas dépasser la facture ; controller → 409 `CONFLIT_VERSION` avec données d'arbitrage. Aucune résolution automatique silencieuse. Notes : mécanisme déjà en place (`GradeController.ts:298-345` + UI `SectionOfflineStatus.tsx`).

## V3.3 — Assistant IA multi-rôle — **élargi au-delà de l'onboarding/orientation**
Pattern non négociable : `LLM → Intent/Command → Validation des règles → Confirmation utilisateur → Persistence`. L'IA ne fait jamais `LLM → UPDATE database` directement.

Commence par le rôle Admin (exécution d'actions + réponses informatives, confirmation obligatoire sur actions destructrices, RBAC strict), étendu ensuite à Enseignant, Censeur, Surveillant Général, Intendant, Parent, Élève — chacun avec ses actions permises propres au rôle.

Cas d'usage onboarding : comprendre les descriptions, aider à choisir le template, mapper les fichiers Excel mal structurés, détecter les anomalies.
Cas d'usage orientation : voir V2.9 — l'IA améliore la recommandation, ne la remplace jamais.

**Sécurité (déjà conçue en détail) :** audit catalogue des actions liées aux identifiants/rôles (à supprimer entièrement si trouvées, jamais juste restreintes), autorisation lue depuis la session serveur réelle, jamais depuis le contenu de la conversation. `AIActionAuditLog` complet, deux vues d'audit séparées (établissement vs sécurité plateforme), alerte automatique sur actions refusées répétées.

## V3.4 — Student Monitoring / Early Warning — **déjà largement conçu, précisé ici**
```
Grades, Attendance, Results → Indicators → Rules → Risk Detection → Alert
```
Index de santé scolaire recalculé nocturne (framework ABC : notes/absences/discipline + statut de paiement en 4e signal), seuils configurables, détection temps réel de baisse par matière, routage par rôle (parent, professeur principal, censeur — enseignant de matière pour son propre signal), conseils IA personnalisés persistés.

**Ajout : analyse des forces et faiblesses par matière** *(alimente aussi le Conseil de classe, V1.12)* — identification des matières où l'élève montre force, difficulté, progression ou régression. Complémentaire (pas redondant) avec la détection de tendance temporelle ci-dessus : celle-ci regarde les matières, l'autre regarde l'évolution dans le temps. Alimente directement l'orientation (V2.9).

**100% rule-based au départ, IA seulement en complément plus tard**, jamais "notre modèle pense que" — toujours une explication ("baisse de 15→11→8 sur trois périodes, 4 absences").

Actions de suivi avec chaîne d'escalade stricte (Professeur principal d'abord, Conseiller pédagogique seulement sur cas déjà escaladé) : programmer entretien parent, signaler au conseiller, noter une observation, convoquer l'élève.

## V3.5 — Reporting Engine mature — **précisé**
```
Données métier → Métriques versionnées → Modèles de rapports → Agrégations (cache) → Rapport
```
**Précision : ne pas construire l'abstraction de métrique versionnée avant 4-5 rapports réels** — calculer directement les 2-3 premiers, extraire l'interface seulement quand un rapport supplémentaire force la réutilisation.

**Rapports administratifs — trois statuts distincts :** MINESEC (formats officiels connus, déjà couvert en V2.14) ; MINEDUB (reconstruction non officielle, backlog bloqué tant que non confirmé terrain) ; rapports début/fin d'année (mentionnés par un contact, non confirmés — à vérifier via l'outil d'enquête terrain).

## V3.6 — Pilotage établissement / School State (inchangé, avec précision)
Tableau de bord actionnable, pas juste descriptif ("23 élèves en baisse, dont 7 dans au moins 3 matières"). **School Timeline = simple vue chronologique filtrée sur l'Audit Trail déjà existant, pas un moteur séparé.**

## V3.7 — Audit et traçabilité avancés (inchangé, déjà largement posé plus tôt)
Qui/quoi/quand/avant/après/pourquoi, particulièrement pour notes, bulletins, inscriptions, promotions, paiements, configurations, permissions.

## V3.8 — Sécurité et résilience — **précisé avec les décisions déjà prises**
MFA (déjà fonctionnel), RBAC, audit, isolation tenant.
**Sauvegarde à trois couches :** corbeille soft-delete (accès limité à ce que chaque rôle a lui-même supprimé), Neon PITR, dump nocturne externalisé (rotation 7j/4sem/12mois).
**Ré-authentification graduée** : fenêtre de grâce de 10 min après mot de passe+MFA, ré-auth complète seulement pour suppression d'utilisateur et suppression en masse par l'assistant IA.
**Rétention des données élève : jamais de purge automatique** du cœur (identité, scolarité, diplômes) — à confirmer plus tard avec MINESEC/un juriste, référence française (10-50 ans) utilisée en attendant.

## V3.9 — Tests de bout en bout (inchangé)
Scénarios : création établissement→onboarding→import→configuration ; élève→inscription→évaluations→bulletin→promotion→nouvelle année ; parent→notification→consultation→messagerie ; coupure→offline→reconnexion→sync→conflit ; évaluation→résultat→orientation→décision→affectation.

## V3.10 — Tests sur données représentatives (inchangé)
Un jeu de données par grande famille de template (francophone/anglophone/bilingue × 1er/2nd cycle), même si les 8 templates prioritaires restent la cible réelle.

**JALON FINAL V3 :** plateforme opérationnelle, automatisée, intelligente et résiliente — structure, données et workflows alimentant une couche intelligence (IA, analytics, alertes) posée sur un socle offline-first mature.

---

## Hors périmètre à toutes les versions (confirmé, inchangé depuis le backlog)
E-learning, marketplace scolaire, réseau social scolaire, fonctionnalités ajoutées "parce que tous les ERP en ont", IA sans problème identifié, moteur Rule/Workflow/Event **générique** tant que les cas concrets (promotion/LV2/concours/orientation) ne sont pas stabilisés.

## Prérequis transverse — enquête terrain
Un outil d'enquête terrain a été construit (site autonome, sauvegarde par établissement, référentiel national confirmé intégré en lecture seule pour ne valider que les écarts locaux). Les points qu'il doit confirmer avant de figer certaines règles, et qui bloquent ou fragilisent plusieurs sections ci-dessus :
- **Pondérations réelles interro/devoir/composition** et nombre de séquences par trimestre (bloque le calage définitif de V1.7) — obtenir un bulletin réel anonymisé.
- **Règles de promotion effectivement appliquées** vs règle officielle (V2.7).
- **Contraintes dures vs souples d'emploi du temps** telles que pratiquées par les responsables (V2.5).
- **Gouvernance APE** — qui autorise, qui valide, quelle preuve conservée (V2.13).
- **Rapports début/fin d'année** — existence à confirmer (V3.5).
- **Mécanisme d'"Anglais Renforcé"** (V2.8).
- **Formulaire statistique MINEDUB officiel** — la version actuelle est une reconstruction non officielle.
- **Poids à donner aux critères d'orientation** — à valider avec un vrai conseiller d'orientation avant de figer (V2.9).

## Filtre à appliquer avant tout ajout futur à cette roadmap
1. Quel problème concret résout-elle ?
2. Qui l'utilise ?
3. À quelle fréquence ?
4. Conséquence si elle n'existe pas ?
5. Pourquoi dans ZekoulABia précisément ?
6. Fonctionnalité indépendante, ou capacité déjà existante du système ?
