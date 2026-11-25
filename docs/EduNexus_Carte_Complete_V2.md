# EduNexus — La Carte Complète V2
## Le Guide de l'Aventurier jusqu'au Trésor

> **Développeur :** Ndzana Christophe
> **Cartographe :** Claude Sonnet 4.6 — Juin 2026
> **Sources :** Spécification fonctionnelle exhaustive · Cahier des charges MINESEC (Décret 2001/041) · Enquêtes terrain Garoua · Analyse bulletins physiques · Transcripts de développement · Analyse marché éducatif camerounais (UNESCO, Banque Mondiale, MINESEC, Transparency International, presse camerounaise 2021–2026)
>
> **⚠️ Mise à jour état réel — Juillet 2026 (Claude Sonnet 5) :** Ce document décrivait à l'origine une cible *aspirationnelle* (frontend Vite + React Router, structure `pages/`). Le projet a depuis pivoté vers **Next.js App Router** (`frontend/src/app/...`) et le backend a une structure hexagonale **partielle** (`domain/ · application/ · infrastructure/` existent réellement). Un audit de code a été fait pour vérifier module par module ce qui est réellement construit — voir la nouvelle section **"État réel d'implémentation"** juste après le sommaire, et les marqueurs `[RÉEL: ...]` insérés dans les PARTIES IV, V, VII et VIII. Le contenu original (non marqué) reste la référence fonctionnelle/métier — il n'a pas changé, seul l'état d'avancement est annoté.

---

> *"Pour qu'un aventurier se lance à la chasse au trésor, il lui faut d'abord la carte complète en main — même si le voyage prendra des mois."*

---

## Ce qui a changé dans cette version

Cette V2 intègre :
- **Architecture hexagonale complète** (ports & adapters) — appliquée dès le départ, à partir de zéro
- **Module Transparence Financière APEE** — réponse au scandale national documenté
- **Journal de présence numérique enseignant** — aligné sur la mission biométrique MINESEC 2026 **[Note Juillet 2026 — recherche externe]** : la mission biométrique réelle 2026 (lancée le 9 mars, prolongée au 15 avril, 16 000+ enseignants concernés) est un **recensement administratif ponctuel** — chaque chef d'établissement soumet une liste nominative signée de son personnel en versions physique et numérique (format Excel, modèle fourni par l'administration centrale), **pas** un système de pointage biométrique continu par cours intégré aux logiciels des écoles. Le vrai "Journal de présence par cours" décrit ici reste une ambition produit valable, mais son urgence de conformité MINESEC est plus faible que supposé — voir en revanche le nouveau chantier "Export Liste nominale conforme MINESEC" (MODULE 19), plus petit et directement branché sur cette actualité.
- **Détection précoce élèves à risque d'échec** — réponse aux taux BAC 37% (2024)
- ~~**Messagerie bidirectionnelle parent** — premier acteur camerounais à le proposer de manière intégrée~~ **→ REPORTÉ à une prochaine version** (voir note dans MODULE 10)     
- **Module Groupe Scolaire** (multi-établissements, dashboard consolidé) — Phase 5
- **Accès lecture DDES/DRES** — pilotage du système par les inspections régionales
- **Matricule unique numérique** — aligné sur la vision MINESEC
- **Workflow Entrée en 6e** — concours + CEPE + synchronisation automatique des admis (Phase 6)
- ~~**Banque d'anciennes épreuves** — mise à disposition par classe d'examen (Phase 6)~~ **→ REPORTÉ à une prochaine version**
- ~~**Répétiteurs en ligne** — mise en relation parent/enseignant disponible (Phase 7 — Scale)~~ **→ REPORTÉ à une prochaine version**
- **Calendrier scolaire dynamique** — suivi automatique jour par jour selon l'emploi du temps
- **Plans d'abonnement mis à jour** avec plan Groupe Scolaire
- **Perspectives d'expansion** Afrique centrale documentées

---

## Comment lire cette carte

Cette carte est organisée en 8 grandes sections :

- **PARTIE I** — Les Acteurs : qui sont les utilisateurs, leurs rôles, leurs droits
- **PARTIE II** — Les Établissements : les 17 types d'écoles, leurs classes, leurs configurations
- **PARTIE III** — Les Relations : comment les données sont connectées entre elles
- **PARTIE IV** — Les Modules : ce que fait chaque partie du produit
- **PARTIE V** — Le Plan de Développement : dans quel ordre tout construire, tâche par tâche
- **PARTIE VI** — Les Lois du Royaume : les règles métier MINESEC à ne jamais violer
- **PARTIE VII** — L'Architecture Hexagonale : structure du code, ports & adapters
- **PARTIE VIII** — Plans d'abonnement, Stack Technique, Commandes

---

## État réel d'implémentation (audit de code — Juillet 2026)

> Vue d'ensemble rapide avant de plonger dans le détail. Pour chaque module de la PARTIE IV, le statut réel (basé sur une lecture directe du code, pas une estimation) est repris entre crochets `[RÉEL: ...]` à côté du titre du module. Légende : **✅ FAIT** (code réel fonctionnel, pas un stub) · **🟡 PARTIEL** (une partie existe, le reste manque — détaillé) · **⬜ PAS FAIT** (aucune trace) · **⏸️ REPORTÉ** (volontairement mis de côté pour une prochaine version, sur décision produit).

### ✅ Ce qui est vraiment fait et solide
- **Onboarding établissement** — wizard complet (Phase 1 questions + Phase 2 conversationnel), détection de template automatique, 19 templates seedés (17 d'origine + `GTC_EN`/`GTC_GTHS_EN` technique anglophone ajoutés depuis)
- **Auth & sécurité Master Admin** — JWT + refresh rotation, MFA TOTP complet, 2FA
- **Notes & bulletins** — workflow DRAFT→SUBMITTED→VALIDATED→LOCKED, génération PDF, conseil de classe (`TenirConseilClasseUseCase`) avec blocage si notes non validées
- **Finance & Mobile Money** — `FeePlan`/`Invoice`/`Payment`, webhook Campay réel, cautions, factures en masse
- **Fin d'année scolaire** — clôture + vérification prérequis + promotions (`CloturerAnneeUseCase`)
- **Matricule unique + cartescolaire.cm** — plus avancé que prévu : import, vérification fuzzy-matching, sync automatique du statut de paiement par scraping
- **Workflow Entrée en 6e** — calcul admission concours, détection anomalies, scan IA des listes de candidats, croisement CEPE
- **PEBS (Programme Spécial Bilingue)** — sessions, candidats, onboarding dédié
- **Orientation scolaire** — fiches, entretiens, tests d'aptitude, recommandations de série (7 use cases réels)
- **RH self-service** — profil employé, analyse IA de diplôme (vision Groq), relances congés/documents
- **IA — Indice de santé scolaire élève** — `CalculerIndiceSanteUseCase` réel, câblé au frontend
- **Statistiques MINESEC/MINEDUB** — modules de déclaration statistique officielle (remplissage du vrai fichier `.xls` MINESEC, rapport MINEDUB). Pipeline de génération migré de SheetJS (bug de formules Excel silencieusement cassées) vers LibreOffice headless + exceljs (Juillet 2026) — formules et mise en forme du fichier officiel désormais préservées, voir MODULE 19.
- **Emploi du temps manuel** — CRUD créneaux + publication ; génération IA existe aussi (via **Groq**, pas Gemini contrairement à ce que dit le stack plus bas). **Détection de conflit enseignant** (double réservation) — confirmée réelle Juillet 2026 après vérification approfondie (voir MODULE 12) : l'audit précédent avait affirmé à tort son absence.
- **Notifications Push + Cloche IN_APP + Centre de notifications** (Juillet 2026) — Web Push (Service Worker + VAPID) fonctionnel pour tout utilisateur ayant un compte actif, cloche IN_APP avec connexion Socket.io authentifiée, persistance en base (`Notification`), et désormais un centre de notifications dédié (historique paginé, filtres par type et par lu/non-lu) dans les 5 dashboards. Voir MODULE 10 — distinct de la messagerie bidirectionnelle, qui reste reportée.
- **Conseil de Discipline conforme Art. 30** (Juillet 2026) — les sanctions de base (`DisciplineRecord`, 5 types déjà dans l'enum) avaient déjà un vrai CRUD fonctionnel (routes inline dans `hexagonal.bootstrap.ts`, non trouvées par l'audit initial faute de recherche assez profonde — corrigé). Ajouté : `DisciplineCouncilSession` bloque désormais toute création directe de `COUNCIL_DECISION`/`PERMANENT_EXCLUSION` sans passer par une convocation (délai légal 72h, re-vérifié à la tenue pour empêcher le contournement) + composition légale complète (6 rôles Art. 30) + PV PDF exportable. Voir MODULE 13/17.
- **Aide contextuelle intelligente du copilot Admin** (Juillet 2026) — extension du copilot exécutant existant (`AssistantController.execute`), pas un second chatbot. Le frontend transmet `screenKey` (dérivé du `section` React actif, ex. `admin.grades` — le dashboard n'a pas de vrai routing Next.js) à chaque appel ; le backend cherche les fiches `HelpArticle` correspondantes (nouveau modèle, contenu plateforme non multi-tenant) et les injecte dans le prompt système pour que l'assistant réponde en connaissance de cause plutôt que d'inventer. 5 fiches initiales seedées (notes, LV2, PEBS, import matricules Excel, bulletins). Si aucune fiche ne couvre l'écran et que le modèle n'est pas sûr, un tool `escalate_to_support` (même mécanisme de function calling que les actions) déclenche une réponse d'escalade vers un contact support (placeholder `ASSISTANT_SUPPORT_CONTACT`, pas de valeur en dur). Surlignage réel des éléments UI référencés par une fiche via le bus d'évènements déjà existant (`zekoulabia:highlight`, nouveau `HighlightController.tsx`) sur des attributs `data-help-id` posés sur les boutons clés des 5 écrans. Bulle discrète "Besoin d'aide ?" après 90s d'inactivité sur un écran prioritaire (`useIdleDetection.ts`, fusionné dans `AssistantWidget.tsx` plutôt qu'un composant séparé — plus simple, pas de canal d'évènement supplémentaire nécessaire). Chaque question posée est journalisée (`AssistantHelpQueryLog`) avec écran/rôle/fiche-trouvée pour analytique produit future.
- **Commentaires de bulletin générés par IA** (Juillet 2026) — `POST /api/v2/report-cards/:id/generate-comment` (réservé au Professeur Principal de la classe ou à un Admin, même règle que l'écriture manuelle). Réutilise `IAService.genererCommentaireBulletin` (Groq, `llama-3.3-70b-versatile`, déjà écrit mais jamais branché) : construit le prompt à partir des `ReportCardSubjectLine` déjà en base (points forts ≥14, points faibles <10, évolution vs bulletin précédent du même élève). Le résultat est stocké dans `aiComment` (champ dédié, distinct de `classMasterComment`) et affiché dans le textarea existant de `SectionAppreciationsPP.tsx` via un bouton "Générer avec l'IA" — le PP le modifie ensuite normalement (auto-save debounced + file d'attente hors-ligne déjà en place, action de génération elle-même désactivée hors-ligne car appel IA externe).
- **Authentification renforcée obligatoire Admin/Staff/Enseignant** (Juillet 2026) — connexion refondue en plusieurs étapes : mot de passe → code envoyé par email → TOTP obligatoire (application d'authentification), miroir du mécanisme déjà réel côté Master (`otplib`) mais étendu aux comptes d'établissement avec une exigence plus stricte : configuration MFA forcée dès la 1ère connexion (aucun accès dashboard sans elle), jamais désactivable ensuite (reconfiguration guardée uniquement, mot de passe + code actuel). Parent/Élève : code email seul, pas de MFA. Nouveaux champs `User.mfa*`/`loginEmailOtp*` (miroir `MasterUser`), `LoginEmailOtpUseCase`, `VerifierMfaConnexionUseCase`, stepper `frontend/src/app/login/page.tsx`, composant partagé `MfaSettings.tsx` (dashboards Admin + Staff/Enseignant). Déblocage de compte (perte authenticator + codes de récupération) : capacité Master dédiée et journalisée. Testé en conditions réelles par l'utilisateur.
- **Copilot Unifié étendu aux 4 rôles non-Admin** (Juillet 2026) — catalogue d'actions combiné passant de 54 à **84 actions** sur un seul `AssistantController` (Principe « un seul copilot »). Enseignant (10 actions — notes, présences, cahier de texte, rattrapage), Censeur/Staff (11 — Discipline, APEE, Bibliothèque, Orientation : domaines sans aucun écran Admin, jamais couverts jusqu'ici), Parent (5 — consultation + paiement Mobile Money, résolveur dédié empêchant l'accès aux données d'un autre enfant), Élève (4 — lecture seule uniquement). Moteur générique extrait dans `catalogShared.ts` (`allowedRoles`), un bug RBAC réel corrigé au passage (`allowedRoles` court-circuitait `requiredPermission`). Non vérifié en conditions réelles (conversation effective) — base de développement locale vide, vérification statique uniquement (`tsc`, audit exhaustif section/entité/navigation). Voir `Plan_Copilot_Unifie_ZekoulABia.md`.
- **Son des notifications in-app** (Juillet 2026) — carillon synthétisé en Web Audio API (`frontend/src/lib/notificationSound.ts`, aucun fichier audio), déclenché depuis `NotificationContext.tsx` sur chaque notification Socket.io réellement nouvelle — un seul point de branchement, actif sur les 5 dashboards. Le son **personnalisé** des notifications **push** (app fermée) reste hors de portée en Web Push standard (limite navigateur, pas de code manquant) — voir ⏸️ ci-dessous, dépend de l'empaquetage Capacitor.

### 🟡 Ce qui existe partiellement
- **Mode hors ligne / PWA** (Juillet 2026) — infrastructure déjà bien plus avancée que supposé à l'audit initial : `manifest.json` réel (icônes, `display: standalone`). **✅ Bloquant Service Worker résolu** : l'apostrophe dans l'ancien chemin absolu du projet ("God's Grace") cassait la génération Workbox — résolu en renommant le dossier. Bug annexe indépendant découvert et corrigé dans la foulée : `next build` bascule par défaut sur Turbopack, incompatible avec `next-pwa` (accroché uniquement au hook `webpack()`) — build « réussi » mais sans aucun Service Worker généré, sans erreur. Corrigé via `next build --webpack` (`frontend/package.json`). Precaching d'app-shell et notifications push buildent désormais correctement pour la production (vérifié via `bun run build` + `bun run start`).
  - **Écriture différée (`useSyncQueue`)** : les 3 flux enseignant d'origine (présences, notes, cahier de texte) + appréciations Professeur Principal, complétés cette session par tous les candidats identifiés par l'inventaire dédié (classification A/B/C par écran, voir rapport agent Juillet 2026) : sanction disciplinaire simple + levée de sanction (`SectionDiscipline.tsx`, hors conseil de discipline — délai légal 72h, reste en ligne), transaction APEE (`SectionAPEEStaff.tsx`), ajout/édition d'ouvrage bibliothèque (`SectionLibrary.tsx`, emprunt reste en ligne — stock temps réel), affectation enseignant↔matière (admin+staff), configuration grille horaire (admin+staff), programmes/chapitres pédagogiques (admin), fiches/entretiens/tests/suivis/recommandation de série d'orientation (staff — validation de recommandation et convocation restent en ligne).
  - **Cache de lecture (`useCachedFetch`)** : au-delà des écrans déjà câblés (dashboards parent/élève, notes/présences enseignant, Transparence APEE, Bibliothèque parent/élève/staff), étendu cette session à l'écrasante majorité des écrans de consultation identifiés par le même inventaire : IA/santé scolaire, supervision présences, tableau de bord et notes admin, statistiques (4 graphiques), départements/présences staff, département AP + Professeur Principal + classes + dashboard enseignant, dashboard élève, et le Centre de notifications transverse (5 dashboards). `OfflineEmptyState` reste utilisé pour les écrans devant rester strictement en ligne (paiement, emprunt, convocation conseil, années scolaires, examens de concours, etc. — voir rapport agent pour la liste complète).
- **Journal de présence enseignant** — ce qui existe (`StaffAttendance`) est une présence journalière classique, **pas** le pointage "démarrer/terminer le cours" décrit dans ce document
- **Landing page** — le formulaire de démo existe visuellement (`DemoModal.tsx`), mais son branchement vers un vrai `SchoolInvite`/lead n'a pas été confirmé

### ⬜ Ce qui n'a pas du tout été commencé
- **Module Groupe Scolaire** (multi-établissements, `SCHOOL_GROUP_OWNER`)
- **Accès lecture DDES/DRES** (aucun rôle, aucune route)
- **API publique & webhooks sortants** (seul webhook = Campay entrant)
- **Comptable-Matières / Patrimoine** (inventaire NS-2) — seulement un nom de permission dans la liste, rien derrière

### ⏸️ Reporté volontairement à une prochaine version
- **Messagerie bidirectionnelle type WhatsApp** (Canal Classe, Canal Parents, Message Privé, justification d'absence en réponse directe, Socket.io temps réel) — décision produit : **mis de côté pour l'instant**. Le code existant est un stub pur (modèles Prisma `Conversation`/`Message` présents dans le schema mais jamais utilisés nulle part dans `backend/src`, aucune UI). Ce qui existe et qui *reste actif* : la diffusion à sens unique (SMS/Email en masse via `CommunicationsController.ts` + `BroadcastLog`) — ça continue d'être développé normalement, ce n'est PAS concerné par le report.
- **Banque d'anciennes épreuves** (`ExamArchive`) — aucune trace dans le code, décision produit de la reporter à une prochaine version plutôt que de la prioriser maintenant.
- **Répétiteurs en ligne** — aucune trace dans le code, déjà positionné comme vision long terme dans le document d'origine ; confirmé reporté explicitement.
- **Empaquetage mobile natif via Capacitor (iOS + Android)** (décision actée Juillet 2026, détail complet dans `ARCHITECTURE.md` §8 ADR-10) — la PWA reste la stratégie immédiate et **le desktop y reste indéfiniment** (pas d'équivalent natif pour un navigateur de bureau) ; seul le mobile est concerné, et positionné **plus tôt que "si le besoin apparaît"** vu la base d'utilisateurs iPhone significative au Cameroun. Deux limites réelles de la PWA seule motivent ce choix côté iOS : pas de présence App Store (découvrabilité), et push Safari limité (support iOS 16.4+ uniquement, et seulement après ajout manuel à l'écran d'accueil — jamais automatique). Empaquette la PWA existante telle quelle (zéro réécriture) via `@capacitor/push-notifications` (APNs/FCM natifs). **À faire à ce moment précis, pas avant** : fournir un fichier son de notification personnalisé (`.caf`/`.wav` iOS, `.mp3`/`.wav` Android) dans le payload push — actuellement bloqué par la plateforme, pas par le code (le son in-app, lui, est déjà fait, voir ci-dessus). **Règle produit à respecter à l'implémentation** : ne jamais forcer le téléchargement de l'app, le web doit rester utilisable sans installation (fracture numérique — téléphones d'entrée de gamme à stockage limité, cf. constat enquête terrain) ; prévoir un bandeau discret et fermable orienté bénéfice concret plutôt qu'un blocage.

### 🧭 Contexte marché — concurrents identifiés (recherche Juillet 2026)

La carte d'origine ne cite aucun concurrent nommé, seulement des statistiques macro (taux BAC 37%, scandales APEE). Recherche externe menée en juillet 2026 : des solutions camerounaises de gestion scolaire existent déjà et sont actives commercialement — **Wacni**, **Scola+**, **Zukulu Feg**, **Ascouza**, **SYGEST**, **Galactis**, **Schooler**, **La Gestion Scolaire**. Aucune trace publique trouvée, pour l'instant, d'une fonctionnalité de transparence financière APEE chez l'un de ces concurrents (absence d'évidence dans une recherche, pas preuve d'absence certaine — à vérifier plus finement si besoin). C'est le signal principal qui a motivé le choix de prioriser la Transparence APEE comme prochain chantier de différenciation (voir "🎯 Chantiers actifs" ci-dessous).

### ✅ Chantiers Juillet 2026 — terminés

Deux chantiers engagés suite à la recherche de marché ci-dessus, tous deux implémentés et vérifiés (`tsc` propre + smoke tests) :

1. **Export "Liste nominale conforme MINESEC"** (MODULE 19) — ✅ FAIT. `HRController.exportListeNominaleMinesec` (réutilise les données RH déjà réelles) + bouton "Export MINESEC" dans la section RH du dashboard Admin. Colonnes basées sur les champs disponibles côté EduNexus (nom, prénom, fonction, N° CNPS, date de prise de service, statut) — le modèle exact de l'administration centrale n'a pas été trouvé publiquement, à ajuster une fois confirmé sur le terrain.
2. **Transparence financière APEE** (MODULE 7 & 11, `PHASE 3 / BLOC 1`) — ✅ FAIT. Modèle `APEETransaction` (collecte/dépense, justificatif obligatoire avant validation d'une dépense), use cases `CreerTransactionAPEEUseCase`/`ValiderDepenseAPEEUseCase`, `APEEController` (`/api/v2/apee`), rapport PDF exportable. Frontend : nouvelle section "Transparence APEE" côté Intendant (saisie, upload justificatif, validation) et côté Parent (lecture seule, anonymisée — jamais l'identité de qui a créé/validé une transaction).

---

# PARTIE I — LES ACTEURS

## 1.1 MasterUser — Le Super Admin EduNexus (hors MINESEC)

**Qui c'est :** Ndzana Christophe. Rôle système, n'existe pas dans la hiérarchie MINESEC. Gère toute la plateforme depuis un espace séparé.

**Sous-rôles :**
- `SUPER_ADMIN` — accès total plateforme
- `PLATFORM_ADMIN` — gestion écoles + rapports
- `SCHOOL_MANAGER` — gestion des demandes d'inscription
- `SUPPORT` — lecture seule pour le support

**Ce qu'il peut faire :**
- Inviter des établissements (token unique 72h + email)
- Approuver / rejeter / suspendre / réactiver des écoles
- Voir les statistiques globales de toute la plateforme
- Gérer son propre 2FA TOTP
- Changer son mot de passe via double vérification
- Voir les journaux d'audit complets
- Configurer les plans d'abonnement

**Ce qu'il ne peut PAS faire :**
- Consulter les notes, bulletins ou finances d'un établissement
- S'impersonnifier en tant qu'utilisateur d'une école
- Accéder aux données pédagogiques des élèves

**Sécurité :** Connexion sur URL cachée · email + password → code OTP email → code TOTP Authenticator · cookie `master_jwt` httpOnly 8h

---

## 1.2 ADMIN — Proviseur / Directeur / Principal

**Qui c'est :** Le chef de l'établissement. Il a TOUTES les permissions dans son école.

**Titre selon l'établissement :**
- Lycée FR / bilingue → **Proviseur**
- CES / Privé FR → **Directeur**
- GHS / GSS EN → **Principal**
- Primaire → **Directeur**

**Ce qu'il peut faire :**
- Tout ce que tous les STAFF peuvent faire
- Prononcer les exclusions définitives (SEUL RÔLE HABILITÉ — Art. 30)
- Ordonner les dépenses (Art. 34 — ordonnateur)
- Signer les conventions de stage CMA
- Valider les recrutements élèves et vacataires
- Générer et transmettre les rapports DDES/DRES
- Accéder aux dossiers médicaux des élèves
- Configurer l'établissement (templates, bulletins, calendrier)
- Valider les rapports financiers APEE pour transparence parent

---

## 1.3 STAFF — 9 sous-rôles distincts

### 1.3.1 Censeur / Vice-Principal

**Qui c'est :** L'adjoint pédagogique. Bras droit du Proviseur pour tout ce qui est académique.

**Titre :** Lycée FR → Censeur · GHS/GSS EN → Vice-Principal

**Permissions :**
```
MANAGE_TIMETABLE           — Créer et publier les emplois du temps
VALIDATE_GRADES            — Valider ou rejeter les notes des enseignants
MANAGE_EXAMS               — Organiser les compositions
SUPERVISE_TEACHERS         — Superviser l'assiduité des enseignants
MANAGE_CURRICULUM          — Valider les projets pédagogiques et fiches de progression
MANAGE_CATCHUP_REQUESTS    — Approuver les cours de rattrapage et réservations salles
VIEW_TEACHER_PERFORMANCE   — Consulter les stats assiduité/ponctualité
GENERATE_CLASS_COUNCIL_REPORT — Générer le rapport officiel du Conseil de Classe
```

**Actions clés :** Valide les notes (SUBMITTED → VALIDATED) · Co-préside les Conseils de Classe · Approuve les projets pédagogiques des enseignants · Reçoit les rapports CE des AP

**Dans un établissement bilingue :** Un Censeur FR (section FR uniquement) + un Vice-Principal EN (section EN uniquement) sous le Proviseur général

---

### 1.3.2 Surveillant Général / Discipline Master

**Qui c'est :** Responsable de la vie scolaire, des absences, de la discipline.

**Titre :** Lycée FR → Surveillant Général · GHS/GSS EN → Discipline Master

**Permissions :**
```
MANAGE_ATTENDANCE   — Consolider les présences des enseignants, gérer les absences
MANAGE_DISCIPLINE   — Saisir et gérer les incidents disciplinaires
MANAGE_INCIDENTS    — Ouvrir des dossiers disciplinaires, instruire les cas
```

**Actions clés :** Consolide les feuilles d'appel · Instruit les dossiers disciplinaires · Membre de droit du Conseil de Discipline · Notifie les parents · Gère le règlement intérieur

---

### 1.3.3 Chef des Travaux

**Qui c'est :** Responsable des ateliers et de la formation technique. Exclusif aux lycées techniques.

**Établissements :** `LYCEE_TECHNIQUE_FR`, `CETIC`

**Permissions :**
```
MANAGE_ATELIERS          — Planning occupation ateliers et labs
MANAGE_PRACTICAL_GRADES  — Saisir notes pratiques TP
MANAGE_INTERNSHIPS       — Gérer les stages entreprises
MANAGE_STAGE_CONVENTIONS — Créer les conventions de stage CMA (4 sem 1ère / 5 sem Tle)
MANAGE_WORKSHOP_STOCK    — Gérer stocks matière d'œuvre (huiles, pièces, consommables)
MANAGE_WORKSHOP_TOOLS    — Inventaire outillage + prêts par TP
```

**Actions clés :** Crée les conventions de stage tripartites · Suit les stages terrain · Gère les stocks d'atelier · Saisit "Attitude professionnelle en atelier" /20 · Signe les rapports de stage

---

### 1.3.4 Intendant / Bursar / Économe

**Qui c'est :** L'agent financier. Exécute les dépenses ordonnées par le Proviseur.

**Titre :** Lycée FR → Intendant ou Économe · GHS/GSS EN → Bursar

**Permissions :**
```
MANAGE_FINANCE      — Gérer le budget, les lignes budgétaires, les dépenses
VALIDATE_PAYMENTS   — Valider les paiements reçus
GENERATE_REPORTS    — Générer les rapports financiers
MANAGE_APEE_TRANSPARENCY — Gérer le tableau de bord APEE visible par les parents
```

**Actions clés :** Collecte les frais de scolarité via Mobile Money · Exécute les ordres de paiement (jamais les ordonne — séparation obligatoire) · Gère les cautions remboursables · Prépare le budget · Paie les bourses · Publie le rapport de dépenses APEE pour les représentants de parents

---

### 1.3.5 Comptable-Matières

**Qui c'est :** Gestionnaire du patrimoine physique de l'établissement.

**Permissions :**
```
MANAGE_PATRIMOINE     — Inventaire NS-2 (Classes 214/215 OHADA), marquage, amortissements
MANAGE_DEGRADATIONS   — Saisir dégradations + générer factures aux parents
```

**Actions clés :** Inventorie tous les biens (tables-bancs, projecteurs, équipements) · Attribue des numéros NS-2 · Signale et facture les dégradations · Produit le rapport annuel patrimoine

---

### 1.3.6 Documentaliste

**Qui c'est :** Responsable du Centre de Documentation et d'Information (CDI).

**Permissions :**
```
MANAGE_LIBRARY         — Cataloguer livres, gérer emprunts, gérer manuels officiels
MANAGE_EXAM_ARCHIVES   — Gérer la banque d'anciennes épreuves (Phase 6)
```

**Actions clés :** Catalogue les livres · Gère les emprunts/retours · Alerte sur les retards · Publie les listes de manuels officiels au programme MINESEC · (Phase 6) Gère la banque d'épreuves BAC/BEPC/GCE par discipline et par année

---

### 1.3.7 Conseiller d'Orientation

**Qui c'est :** Guide les élèves dans leurs choix de filières.

**Permissions :**
```
MANAGE_ORIENTATION   — Tests psychotechniques, profils orientation, recommandations filières
```

**Actions clés :** Administre les tests psychotechniques · Établit des profils d'orientation · Recommande des filières · Participe aux Conseils de Classe (Art. 29) · Organise la journée d'orientation

---

### 1.3.8 Animateur Pédagogique / HOD

**Qui c'est :** Chef d'un département disciplinaire. Supervise la qualité pédagogique.

**Titre :** Lycée FR → Animateur Pédagogique (AP) · GHS/GSS EN → Head of Department (HOD)

**Règle volume horaire :** ≤ 14h d'enseignement par semaine (Circulaire 32/09/MINESEC/IGE)

**Permissions :**
```
VIEW_DEPARTMENT_GRADES          — Consulter les notes de son département (lecture seule)
SUPERVISE_DEPARTMENT_TEACHERS   — Superviser les enseignants de son département
VALIDATE_DEPARTMENT_TIMETABLE   — Valider l'EDT du département
GENERATE_DEPARTMENT_REPORTS     — Générer rapports de performance du département
VIEW_SUPERVISED_GRADES          — Consulter les notes des enseignants sous supervision
SUPERVISE_LESSON_PLANS          — Accéder aux plans de cours et ressources
GENERATE_PEDAGOGICAL_REPORTS    — Générer des rapports pédagogiques pour la direction
MANAGE_CE_REPORTS               — Convoquer CE, rédiger et transmettre les rapports CE
MANAGE_PEDAGOGICAL_BRIEF        — Mallette pédagogique numérique + banque de sujets APC
MANAGE_SUBJECT_STATISTICS       — Taux couverture programmes + taux réussite discipline
VALIDATE_PEDAGOGICAL_PROJECTS   — Valider/refuser les projets pédagogiques des enseignants
```

**Ce qu'il ne peut PAS faire :** Modifier les notes d'un enseignant · Valider les bulletins · Gérer l'emploi du temps global

---

### 1.3.9 Professeur Principal / Class Master / Titulaire de Classe

**Qui c'est :** Enseignant désigné sur une classe spécifique via `Class.professorPrincipalId`. Ce n'est pas un rôle séparé — c'est une désignation sur la table `Class`.

**Permissions supplémentaires (au-delà de TEACHER standard) :**
```
VIEW_CLASS_MEDICAL_PROFILES      — Profils médicaux des élèves de sa classe
GENERATE_CLASS_COUNCIL_REPORT    — Rapport officiel Conseil de Classe (canevas MINESEC)
```

**Actions clés :** Génère le rapport officiel du Conseil de Classe · Voit les profils médicaux · Suit les résultats de sa classe · Rédige les rapports mensuels · Surveille les cahiers de textes

---

## 1.4 TEACHER — Enseignant / Instituteur / Class Teacher

**Qui c'est :** Le cœur académique. Saisit les notes, prend les présences, publie les devoirs.

**Titre :**
- Lycée FR → Enseignant / Professeur
- Primaire FR → Instituteur / Institutrice
- GHS/GSS EN → Teacher / Class Teacher

**Journal de présence numérique :** À chaque cours, l'enseignant signe sa feuille de présence numérique (même hors ligne via PWA). Cette signature est la preuve qu'il a assuré son cours. Données consolidées par le SG et visibles par l'Admin et la DDES (lecture).

**Particularité vacataire :** Un enseignant vacataire peut enseigner dans plusieurs établissements. Il a un compte séparé par école (même email, `schoolId` différent). La connexion exige le subdomain pour différencier.

---

## 1.5 PARENT — Parent / Tuteur

**Qui c'est :** Le parent ou tuteur légal d'un ou plusieurs élèves.

**Sous-rôle — Représentant APE/PTA :** Accès aux PV du Conseil d'Établissement, aux rapports synthétiques, et au **tableau de bord de transparence APEE** (dépenses catégorisées, soldes, justificatifs uploadés).

**Messagerie bidirectionnelle :** Le parent peut répondre directement à une notification d'absence dans l'application pour justifier. L'enseignant et le SG sont notifiés. Tout est tracé. C'est une première sur le marché camerounais.

**Primaire public :** Les frais APE sont les seuls frais légaux. Calculés chaque année : budget prévisionnel ÷ effectif.

---

## 1.6 STUDENT — Élève

**Qui c'est :** L'élève inscrit dans l'établissement.

**Sous-rôle — Délégué de classe :** Participe aux Conseils de Classe et de Discipline comme membre de droit (Art. 29 et 30).

---

## 1.7 DDES/DRES — Délégation Départementale/Régionale (Phase 5)

**Qui c'est :** L'inspecteur ou délégué de l'enseignement secondaire au niveau départemental ou régional. Rôle en lecture seule, aucune modification possible sur les données d'un établissement.

**Permissions :**
```
VIEW_REGIONAL_SCHOOLS      — Voir tous les établissements de sa circonscription
VIEW_TEACHER_ATTENDANCE    — Consulter les journaux de présence des enseignants
VIEW_EXAM_PERFORMANCE      — Voir les taux de réussite agrégés par établissement
VIEW_FINANCIAL_REPORTS     — Voir les rapports financiers synthétiques
RECEIVE_DDES_REPORTS       — Recevoir les rapports officiels générés par les Admin
```

**Ce que ça apporte :** Le MINESEC peut piloter le système en temps réel, sans opération biométrique coûteuse. EduNexus devient l'outil que le ministère cherche à construire depuis 2026.

---

## 1.8 SCHOOL_GROUP_OWNER — Fondateur de Groupe Scolaire (Phase 5)

**Qui c'est :** Le fondateur ou propriétaire d'un réseau de plusieurs établissements (primaire + collège + lycée) sous une direction commune.

**Permissions :**
```
VIEW_ALL_SCHOOLS_IN_GROUP    — Tableau de bord consolidé multi-écoles
VIEW_GROUP_FINANCIALS        — Performance financière agrégée de tous les établissements
VIEW_GROUP_PEDAGOGY          — Taux de réussite agrégés par établissement et par niveau
MANAGE_GROUP_STAFF_TRANSFER  — Faciliter les transferts d'enseignants entre établissements du groupe
```

**Isolation des données :** Chaque école reste un tenant isolé. Le fondateur voit des agrégats, jamais les données individuelles d'élèves.

---

# PARTIE II — LES ÉTABLISSEMENTS

## 2.1 Les 19 Templates (seedés — [RÉEL: ✅ FAIT, confirmé dans `backend/prisma/seed.ts`])

> Mis à jour : 17 templates d'origine + `GTC_EN` (Government Technical College, technique anglophone 1er cycle) et `GTC_GTHS_EN` (cycle complet, miroir anglophone de `LYCEE_TECHNIQUE_FR`/`CETIC`) ajoutés depuis. Un attribut `admissionType` (MIXTE/FILLES/GARCONS) existe désormais sur `School` pour couvrir les variantes filles (GGTC/CETIF) sans dupliquer de template.

### Francophones (9)

| Code | Nom | Niveaux | Séries/Filières | Examens | Chef |
|------|-----|---------|----------------|---------|------|
| `LYCEE_FR` | Lycée général FR | 6e·5e·4e·3e + 2nde·1ère·Tle | A4·C·D (2nde) · A4·C·D·TI (1ère+Tle) | BEPC · Probatoire · BAC | Proviseur |
| `CES_FR` | Collège d'Enseignement Secondaire | 6e·5e·4e·3e uniquement | — | BEPC | Directeur |
| `PRIVE_FR` | Institut privé francophone | 6e→Tle | A4·C·D·TI | BEPC · Probatoire · BAC | Directeur |
| `LYCEE_TECHNIQUE_FR` | Lycée Technique | CAP1-4 + BT1-3 | F1·F2·F3·G1·G2·G3·INFOR·HOTEL·COUTURE... | CAP · Probatoire Technique · BT | Proviseur |
| `CETIC` | Collège d'Enseignement Technique | CAP1-4 uniquement | F1·G2 + filières terrain (MAEL·TMI·ECS·ESF·IH) | CAP | Directeur |
| `SAR_SM` | Section Artisanale Rurale / Ménagère | Année1-2 | SAR · SM | — | Directeur |
| `CFM` | Centre de Formation des Métiers | Année1-2 | métiers artisanaux | Certificat métier | Directeur |
| `PRIMAIRE_FR` | École primaire francophone | SIL·CP·CE1·CE2·CM1·CM2 | APC 300 pts · 6 compétences | CEPE · Concours 6e | Directeur |
| `MATERNELLE_FR` | Maternelle francophone | Petite·Moyenne·Grande section | — | — | Directeur |

### Anglophones (7)

| Code | Nom | Niveaux | Filières Upper | Examens | Chef |
|------|-----|---------|---------------|---------|------|
| `GHS_EN` | Government High School | Form1-5 + LowerSixth + UpperSixth | A1-A4 (Arts) · S1-S4 (Sciences) à Form4+ | GCE O-Level (Form5) · GCE A-Level (UpperSixth) | Principal |
| `GSS_EN` | Government Secondary School | Form1-5 uniquement | — | GCE O-Level | Principal |
| `PRIVE_EN` | Private school anglophone | Form1→UpperSixth | A1-A4 · S1-S4 | GCE O-Level · GCE A-Level | Principal |
| `PRIMARY_EN` | Primary School | Class1→Class6 | — | FSLC · Common Entrance | Head Teacher |
| `NURSERY_EN` | Nursery School | PreNursery·Nursery1·Nursery2 | — | — | Head Teacher |
| `GTC_EN` *(ajouté)* | Government Technical College | Form1-4 uniquement | STT · IND | CAP | Principal |
| `GTC_GTHS_EN` *(ajouté)* | Government Technical College & High School | Form1-4 + LowerSixth + UpperSixth | STT · IND | CAP · Probatoire Technique · Bac Technique | Principal |

> Détail matière par matière de STT/IND : adaptation raisonnable du F1/G2 francophone, **non confirmée** par un document MINESEC anglophone officiel — à corriger si une source authentique est trouvée (voir `backend/src/application/school/curriculum/anglophone/technical.ts`).

### Bilingues (2)

| Code | Nom | Sections | Particularités |
|------|-----|---------|---------------|
| `LYCEE_BILINGUE` | Lycée bilingue | FR : 6e→Tle (+ série ABI) · EN : Form1→UpperSixth | Intensive English coeff=5 en ABI (confirmé terrain) · Censeur FR + VP EN |
| `PRIMARY_BILINGUAL` | École primaire bilingue | FR : SIL→CM2 · EN : Class1→6 | Deux systèmes de bulletins parallèles |

### Multi-niveaux (1)

| Code | Nom | Description |
|------|-----|-------------|
| `COMPLEXE_SCOLAIRE` | Complexe scolaire | Maternelle + Primaire + Secondaire sous une direction unique · Proviseur Général |

---

## 2.2 Niveaux de classes par système

### Francophone secondaire général
```
1er cycle : 6e · 5e · 4e · 3e  (aucune série)
2nd cycle :
  2nde : A4 · C · D  (TI INTERDIT en 2nde — règle MINESEC)
  1ère : A4 · C · D · TI
  Tle  : A4 · C · D · TI
Bilingue :
  2nde-Tle : + série ABI (Anglophone Bilingue Intensive)
```

### Anglophone secondaire
```
Lower cycle : Form1 · Form2 · Form3  (sans filière)
Upper cycle :
  Form4 : sans filière affichée (préparation)
  Form5 : sans filière (GCE O-Level)
  LowerSixth  : Arts (A1/A2/A3/A4) · Sciences (S1/S2/S3/S4)
  UpperSixth  : Arts (A1/A2/A3/A4) · Sciences (S1/S2/S3/S4)
RÈGLE : filières uniquement à partir de Form4+
```

### Technique francophone
```
1er cycle : CAP1 · CAP2 · CAP3 · CAP4
2e cycle  : BT1 · BT2 · BT3
Filières officielles MINESEC : F1 · F2 · F3 · G1 · G2 · G3 · INFOR · HOTEL · COUTURE · AGRIC · SAR · SM
Filières terrain confirmées  : MAEL · TMI · ECS · ESF · IH
Double nomenclature : "2A MAEL" = CAP2 filière MAEL
```

### Primaire
```
Francophone  : SIL · CP · CE1 · CE2 · CM1 · CM2
Anglophone   : Class1 · Class2 · Class3 · Class4 · Class5 · Class6
Maternelle   : Petite section · Moyenne section · Grande section
Nursery      : PreNursery · Nursery1 · Nursery2
```

---

## 2.3 Systèmes d'évaluation par type

### Secondaire francophone — cas majoritaire (confirmé terrain)
- **1 note DS** par séquence (weight=100) — cas de **loin majoritaire**
- Cas minoritaire (ex: Collège Le Québécois) : CC×30% + DS×70% — configurable par Admin
- Formule 3 notes : DS1×1 + DS2×1 + Compo×2 ÷ 4 (à confirmer avec d'autres établissements avant de hardcoder)
- 2 séquences par trimestre → moyenne trimestre = (Séq1 + Séq2) ÷ 2
- Notes /20 · passmark = 10/20

### Secondaire anglophone
- Class Tests 30-40% + Terminal Exam 60-70% (proportions configurables par Admin)
- Notes /20 (confirmé G.B.H.S. Kollere terrain) ou /100 selon établissement
- Passmark = 10/20 ou 40/100

### Lycée bilingue — section FR
- Mêmes règles que secondaire FR
- Série ABI : Intensive English coeff=5 (confirmé bulletins 2nde ABI Garoua 2020/2021)
- Champ "Compétence visée" (libellé court) par matière sur le bulletin (confirmé Garoua)
- Bulletin annuel : 3 trimestres + 6 évaluations côte à côte + 10 rangs

### Lycée technique
- 2 évaluations (Eval1 + Eval2) par trimestre (confirmé bulletins Djamboutou)
- 3 groupes de matières : Enseignement Général + Professionnel + Divers
- Notes théorie et pratique **séparées** (deux lignes sur le bulletin)
- Champ "Attitude professionnelle en atelier" /20 : ponctualité · sécurité · tenue · initiative
- Si 3e trimestre incomplet (grèves) → `seq6Score = null` — cas normal, pas d'erreur

### Primaire francophone — système APC
- 300 points total · 6 compétences · 8 Unités d'Apprentissage par an
- T1 : UA1-3 (3 évals) · T2 : UA4-6 (3 évals) · T3 : UA7-8 (2 évals)
- 4 composantes : Oral · Écrit · Savoir-faire · Savoir-être
- **Appel 2×/jour** (matin + après-midi) — confirmé terrain Cholère + Nakong
- Barèmes : Français/Anglais /30 · Maths/Sciences/TIC /40 · autres /20
- **Pas de coefficients** au primaire — chaque matière a son propre barème
- Cotes : Expert (18-20) / A Acquis (15-17) / ECA En Cours (11-14) / NA Non Acquis (0-10)
- Matières ajoutées à partir de CE1 : Histoire, Géographie, Langue Nationale
- Promotion collective au sein d'un même niveau (SIL/CP ensemble, CE1/CE2 ensemble, CM1/CM2 ensemble)
- Passage strict entre niveaux (SIL/CP → CE1/CE2 → CM1/CM2 → 6e)

### Primaire anglophone
- Bulletin **MENSUEL** (Month 1 Term 1) — pas trimestriel
- Barèmes variables par sous-compétence (40, 70, 10, 15...)
- Primary School Le Québécois : confirmé terrain Class 5

---

## 2.4 Coefficients BAC (Décret 95-035) — préchargés, non modifiables par les écoles

| Matière | Série A4 | Série C | Série D | Série TI | Série ABI |
|---------|----------|---------|---------|----------|-----------|
| Mathématiques | 3 | 6 | 4 | 5 | — |
| Français | 6 | 4 | 4 | 3 | — |
| Physique-Chimie | 2 | 5 | 3 | 4 | — |
| SVT / Biologie | 2 | 2 | 4 | 2 | — |
| Philosophie | 5 | 3 | 3 | 2 | — |
| Histoire-Géographie | 4 | 2 | 2 | 2 | — |
| Anglais | 3 | 2 | 2 | 2 | — |
| Intensive English | — | — | — | — | **5** |

> Séries ABI/E/A1-A5/SH/AC : à confirmer auprès OBC avant de remplir

---

## 2.5 Bulletins — 6 templates

| Template | Établissements | Notes | Particularités |
|----------|---------------|-------|---------------|
| `FR_SECONDARY` | Lycée/CES/Privé FR | /20 | DS1·DS2·Compo · mentions FR · appréciation Censeur/PP |
| `EN_SECONDARY` | GHS/GSS/Privé EN | /20 ou /100 | Grades · teacher comment · Form Master remark |
| `TECHNICAL_FR` | Lycée Technique/CETIC | /20 | Théorie + Pratique séparés · Comportement professionnel atelier |
| `PRIMARY` | Primaire FR/EN | barèmes variables | APC compétences · cotes A/ECA/NA · observation instituteur |
| `ANNUAL` | Tous les lycées | /20 | 3 trimestres + 6 évals côte à côte · rangs annuels + trimestriels |
| `MONTHLY` | Primary EN | barèmes variables | Mensuel · Month 1 Term 1 · Total Marks / On |

### Mentions FR (bornes exactes)
| Mention | Min | Max |
|---------|-----|-----|
| Excellent | 18.00 | 20.00 |
| Très Bien | 16.00 | 17.99 |
| Bien | 14.00 | 15.99 |
| Assez Bien | 12.00 | 13.99 |
| Passable | 10.00 | 11.99 |
| Insuffisant | 8.00 | 9.99 |
| Très Insuffisant | 6.00 | 7.99 |
| Médiocre | 0.00 | 5.99 |

### Mentions EN
| Grade | Min (%) | Max (%) |
|-------|---------|---------|
| Excellent | 80 | 100 |
| Very Good | 70 | 79.99 |
| Good | 60 | 69.99 |
| Average / Pass | 50 | 59.99 |
| Poor | 0 | 49.99 |

---

# PARTIE III — LES RELATIONS

## 3.1 Schéma des relations clés

```
MasterUser
  ├── invite ──────────→ SchoolInvite (token UUID, 72h) ──→ School
  ├── approuve ─────────────────────────────────────────→ School (ACTIVE)
  └── (isolation totale — aucun accès données internes)

School (schoolId sur TOUT)
  ├── SchoolTemplate (référence seed)
  ├── SchoolConfig   (paramètres configurables)
  ├── SchoolSettings (timezone, locale, currency, features JSONB)
  ├── Section[]      (FR / EN / BILINGUAL)
  │     └── Class[]  (niveau + série + filière)
  │           ├── professorPrincipalId → User (TEACHER)
  │           ├── StudentProfile[]
  │           │     └── User (STUDENT)
  │           └── ClassSubGroup[] (Groupe A / B pour TP)
  ├── User[]
  │     ├── role: ADMIN  → (pas de profil séparé)
  │     ├── role: STAFF  → StaffProfile → StaffPermission[]
  │     │                               → sectionId? (FR ou EN)
  │     ├── role: TEACHER → TeacherProfile → TeacherSubject[]
  │     │                                  → TeacherAttendanceLog[] (journal présence)
  │     │                                  → classesProfessorPrincipal[]
  │     ├── role: PARENT → ParentProfile → ParentStudent[] → StudentProfile[]
  │     └── role: STUDENT → StudentProfile → Class
  ├── Subject[]
  │     ├── SubjectCoefficient[] (par niveau + série)
  │     ├── TeacherSubject[]
  │     └── Grade[]
  ├── AcademicYear[]
  │     ├── AcademicPeriod[] (trimestres/terms)
  │     │     └── AcademicSequence[] (séquences)
  │     │           └── Grade[] ──→ (élève + matière + enseignant)
  │     └── TimetableSlot[]
  │           └── TeacherAttendanceLog[] (présence enseignant par créneau)
  ├── ReportCard[] ──→ (élève + période)
  │     └── ReportCardSubjectLine[] (une ligne par matière)
  ├── ClassCouncilSession[] ──→ (classe + période)
  │     └── ClassCouncilDecision[] (une décision par élève)
  ├── DisciplineRecord[] ──→ (élève + auteur)
  ├── Payment[] ──→ (élève + FeePlan)
  ├── Invoice[] ──→ (élève + FeePlan)
  ├── FeePlan[] ──→ (type + niveau + montant)
  ├── APEEReport[] ──→ (période + montants + justificatifs)
  ├── Conversation[] → Message[] (4 types)
  ├── Notification[]
  ├── AttendanceRecord[] ──→ (élève + cours + date)
  ├── PedagogicalProject[] (AP → Enseignant)
  ├── CEReport[] (rapport Conseil d'Enseignement AP)
  ├── StageConvention[] (élève + entreprise — technique)
  ├── PatrimoineItem[] (inventaire NS-2 Comptable-Matières)
  ├── ExamArchive[] (Phase 6 — anciennes épreuves par matière+année+examen)
  └── ActivitiesLog[]

SchoolGroup (Phase 5)
  ├── School[] (tous les établissements du groupe)
  └── SchoolGroupOwner → User

BacCoefficient (global, pas par école — 8 matières × séries)
GradeFormula (default: par école après onboarding)
MentionRule (default: par école après onboarding)
SchoolInvite (lien invitation → masterUserId + schoolId)
```

---

## 3.2 Règles d'isolation multi-tenant

**Règle absolue :** Chaque requête qui concerne des données d'école **DOIT** filtrer par `schoolId`. Sans exception.

**Comment ça marche :**
1. L'utilisateur se connecte → son `schoolId` est dans le payload JWT
2. Le middleware `authMultiTenant` vérifie que le `schoolId` dans l'URL correspond au `schoolId` du token
3. Chaque use case du domaine reçoit le `schoolId` en paramètre et l'applique à toutes ses requêtes

**Exemple de violation à éviter :**
```typescript
// ❌ INTERDIT — peut lire les données d'une autre école
const user = await userRepository.findByEmail(email);

// ✅ CORRECT — isolation garantie
const user = await userRepository.findByEmailAndSchool(email, schoolId);
```

---

# PARTIE IV — LES MODULES ET LEURS FONCTIONNALITÉS

## MODULE 0 — Fondation & Infrastructure ✅ TERMINÉ [RÉEL: ✅ FAIT — `backend/src/{domain,application,infrastructure}` existent et sont peuplés, la restructuration hexagonale a bien eu lieu, pas seulement prévue]

**Ce que c'est :** La fondation invisible. Sans elle, rien n'existe.

**Ce qui est fait :**
- Schema Prisma complet (toutes tables, relations, enums)
- 17 SchoolTemplates seedés avec configurations complètes
- 8 BacCoefficients (Décret 95-035) — Maths/Français/PC/SVT/Philo/HG/Anglais/Intensive English
- 2 GradeFormulas par défaut : FR (DS seul weight=100) · EN (ClassTest 30% + Exam 70%)
- 4 MentionRules par défaut : FR (8 niveaux) · EN (5 niveaux)
- `classSerieValidator.ts` — validation séries/filières MINESEC
- Setup technique complet : Bun + Express + Prisma + Redis + Inngest + Socket.io
- Structure hexagonale : dossiers `domain/`, `application/`, `infrastructure/`, `interfaces/` créés

**À refaire / restructurer (démarrage de zéro en hexagonal) :**
- ~~Toute la logique métier existante dans les anciens controllers est à déplacer dans les Use Cases de domaine~~ **[RÉEL : fait dans une large mesure — la logique vit bien dans `application/<domaine>/*UseCase.ts`, ex: `TenirConseilClasseUseCase`, `CloturerAnneeUseCase`, `CalculerAdmissionConcoursUseCase`. Non vérifié à 100% fichier par fichier si quelques anciens controllers contiennent encore de la logique résiduelle.]**
- Voir PARTIE VII pour la structure complète (mise à jour : le dossier réel est `backend/src/domain/{entities,ports,rules,value-objects,constants,types}` — légèrement différent de la structure imaginée à l'origine, mais le principe ports/adapters est respecté)

---

## MODULE 1 — Super Admin (MasterUser) 🟡 EN COURS [RÉEL: ✅ FAIT pour l'essentiel — invitation/approbation/suspension/réactivation/suppression école, MFA TOTP complet (setup QR + recovery codes + désactivation), logs & sécurité, dashboard écoles avec onglets, changement mot de passe à double vérification tous confirmés en code (`SectionSchools.tsx`, `SectionLogs.tsx`, `MasterModals.tsx`, `SectionOverview.tsx`). Non vérifié : comparaison anonymisée inter-établissements, export CSV/PDF global.]

**Tableau de bord global**
- Vue centralisée de tous les établissements (Active / Pending / Suspended / Rejected)
- Filtres : statut · région · type d'établissement · plan d'abonnement
- KPIs globaux : écoles actives · utilisateurs totaux · revenus · nouveaux ce mois
- Indice de santé par établissement (taux réussite + taux paiement + taux assiduité)
- Tableau comparatif anonymisé entre établissements
- Dark mode professionnel noir/bleu

**Gestion des établissements**
- Invitation sécurisée : email + token UUID 72h + email automatique Resend
- Approbation d'une demande → déclenche la configuration automatique atomique
- Rejet d'une demande avec motif → notification Admin de l'école
- Suspension d'une école active (accès bloqué pour tous les utilisateurs)
- Réactivation d'une école suspendue
- Suppression définitive avec confirmation textuelle obligatoire
- Changement de plan d'abonnement
- Extension ou résiliation de contrat
- Fiche détaillée : infos + config technique + journal d'audit + utilisateurs actifs
- Régénération d'une invitation expirée
- Renvoi de l'email d'invitation

**Sécurité & audit**
- 2FA TOTP obligatoire (otplib) — QR code + clé manuelle + 10 recovery codes
- Setup MFA en 2 étapes : `beginMasterMfaEnable` (QR) → `confirmMasterMfaEnable` (TOTP)
- Désactivation MFA avec vérification renforcée (password + code MFA actuel)
- Régénération recovery codes (password + code MFA actuel)
- Changement de mot de passe : password + MFA → code email → nouveau password
- Page de connexion sur URL cachée non indexée
- Journal d'audit complet (toutes actions + IP + horodatage)
- Historique des connexions

**Reporting global**
- Vue agrégée des revenus de toutes les écoles
- Statistiques d'utilisation par école (connexions, données créées)
- Export données globales CSV/PDF
- Comparaison performance inter-établissements (anonymisée)

---

## MODULE 2 — Onboarding École 🟡 EN COURS [RÉEL: ✅ FAIT — wizard Phase 1 (5 étapes) + Phase 2 conversationnel confirmés, détection automatique de template (avec correctifs récents pour le technique anglophone), configuration atomique post-approbation câblée (`ActiverEtablissementUseCase.ts`, `ApprouverEcoleUseCase.ts`, `OnboarderEcoleUseCase.ts`, `ConfigurerEtablissementUseCase.ts`)]

**Étape 1 — Vérification du lien d'invitation**
- Validation du token : existe en DB ? non expiré (72h) ? statut PENDING ? non déjà utilisé ?
- Pré-remplissage : nom de l'école + email de l'admin
- Si invalide : message clair + bouton "Demander une nouvelle invitation"

**Étape 2 — Informations de l'établissement**      
- Nom officiel                                
- Adresse physique, ville, région (10 régions du Cameroun)            
- Téléphone de l'établissement
- Email de contact officiel
- Logo (upload optionnel, max 2MB, PNG/JPG)

**Étape 3 — Configuration technique (4 questions → template auto)**
- Q1 : Niveau → Maternelle / Primaire / Secondaire / Multi-niveaux
- Q2 : Sous-système → Francophone / Anglophone / Bilingue
- Q3 : Type d'enseignement → Général / Technique / Professionnel / Mixte
- Q4 : Statut → Public / Privé laïc / Privé confessionnel
- Résultat affiché : "Lycée bilingue public détecté" + récapitulatif du template

**Étape 4 — Création du compte Admin**
- Titre affiché selon template (Proviseur / Directeur / Principal)
- Prénom, nom, email (pré-rempli), mot de passe (min 8 chars + confirmation)

**Étape 5 — Confirmation**
- Récapitulatif complet
- Soumission → statut `PENDING`
- Email de confirmation à l'admin
- Notification Super Admin pour approbation
- Message : "Votre demande est en cours d'examen. Vous serez notifié par email."

**Configuration automatique post-approbation (transaction Prisma atomique)**
1. Création des `Section(s)` selon le template (FR / EN / les deux)
2. Création des `Class[]` pré-configurées (niveau + série + filière selon template)
3. Création de l'`AcademicYear` courante avec ses 3 `AcademicPeriod[]` et 6 `AcademicSequence[]`
4. Clonage de la `GradeFormula` par défaut pour l'école
5. Clonage des `MentionRule` par défaut pour l'école
6. Création du `SchoolConfig` (paramètres par défaut : passMark=10, termsPerYear=3, maxAbsences=10)
7. Création du `SchoolSettings` (timezone: Africa/Douala, locale: fr-CM, currency: XAF)
8. Passage du statut de l'école à `ACTIVE`
9. Marquage de l'invitation comme `USED` (usage unique)
10. Email de bienvenue à l'Admin avec le lien de connexion et le subdomain

---

## MODULE 3 — Authentification & Accès ✅ FAIT [RÉEL: ✅ FAIT — utilisé sans interruption tout au long du développement (login, refresh rotation, logout). **Mise à jour juillet 2026** : connexion refondue en plusieurs étapes obligatoires — email OTP pour tous les rôles, puis MFA TOTP obligatoire pour ADMIN/STAFF/TEACHER (configuration forcée dès la 1ère connexion, jamais désactivable, reconfiguration guardée depuis le dashboard). Testé en conditions réelles par l'utilisateur.]

**Connexion utilisateur école**
- Formulaire : email + mot de passe + subdomain de l'établissement
- Résolution de l'école depuis le subdomain (ou le nom)
- Vérification : école ACTIVE ? utilisateur actif ?
- Pour STAFF : récupération des permissions depuis `StaffPermission[]`
- Génération access token 15min (cookie httpOnly `access_token`)
- Génération refresh token 7j (cookie httpOnly `refresh_token`)
- Mise à jour `User.lastLogin`
- Réponse : profil utilisateur (sans token en clair)

**Rotation du refresh token**
- Route `POST /auth/refresh-token` : vérifie le cookie `refresh_token`
- Vérifie `tokenType === "refresh"`
- Vérifie user actif + école ACTIVE en DB
- Récupère les permissions à jour depuis la DB
- Génère un nouveau couple (access + refresh) → remplace les deux cookies
- L'ancien refresh token devient invalide (last-write-wins)

**Déconnexion**
- Efface les deux cookies (`access_token` + `refresh_token`)
- Redirection vers `/login`

**Réinitialisation du mot de passe**
- Formulaire : email + subdomain
- Génération d'un token de réinitialisation (UUID, expiration 1h)
- Envoi email avec lien sécurisé
- Formulaire nouveau mot de passe + confirmation
- Invalidation du token après usage

**MFA obligatoire pour Admin/Staff/Enseignant [RÉEL: ✅ FAIT, juillet 2026 — remplace l'ancienne ambition "2FA optionnel"]**
- Connexion à 3 facteurs : mot de passe → code envoyé par email → code TOTP (application d'authentification)
- 1ère connexion sans MFA configuré : accès dashboard bloqué tant que la configuration (QR + confirmation + codes de récupération) n'est pas terminée — jamais de contournement
- MFA non désactivable ensuite : seule une reconfiguration guardée (mot de passe + code actuel) est proposée depuis les paramètres du dashboard
- Codes de récupération à usage unique (8, format `ABCD-1234-EFGH-5678`) en cas de perte de l'authenticator
- Déblocage d'un compte ayant perdu authenticator ET codes de récupération : action dédiée côté Master (`/api/v2/master/users/mfa-reset`), journalisée dans l'audit
- Parent/Élève : email seul, pas de MFA (moindre sensibilité du compte)

---

## MODULE 4 — Rôles & Permissions STAFF 🟡 EN COURS [RÉEL: ✅ FAIT — `StaffPermissionRules.ts` existe et gouverne les 9 sous-rôles STAFF, utilisé par les sections Admin (RH, Classes, etc.) tout au long de la session]

**Création d'un compte STAFF**
- Sélection du titre terrain dans une liste (Censeur, SG, Intendant, Chef des Travaux, etc.)
- Assignation automatique des permissions correspondant au titre choisi
- Ajustement manuel des permissions (Admin peut modifier)
- Assignation à une section : FR · EN · Les deux (pour établissements bilingues)

**Vérification des permissions à chaque requête**
- Middleware `requirePermission('MANAGE_FINANCE')` sur les routes sensibles
- Si permission manquante → 403 avec message explicite
- Le payload JWT contient `permissions[]` pour éviter des requêtes DB supplémentaires

---

## MODULE 5 — Administration École [RÉEL: ✅ FAIT pour l'essentiel — dashboard, utilisateurs, classes, matières, année scolaire, annonces, paramètres tous confirmés avec du vrai code (`SectionDashboard.tsx`, `SectionUsers.tsx`, `SectionClasses.tsx`, `SectionSubjects.tsx`, `SectionAcademicYear.tsx`, `SectionSettings.tsx`). 🟡 Le "suivi automatique quotidien" du calendrier (job Inngest qui avance seul au jour suivant) n'a pas été confirmé dans l'audit — à vérifier.]

**Tableau de bord Admin**
- KPIs temps réel : effectifs totaux · enseignants actifs · taux de réussite · taux paiement · absences du jour
- Performance globale par classe (code couleur vert/orange/rouge)
- Alertes : élèves en difficulté · paiements en retard · notes non soumises · événements
- Activités récentes (journal des 50 dernières actions)
- Actions rapides : ajouter élève · saisir notes · présences · annonce
- **Alerte absentéisme enseignants** : tableau des enseignants n'ayant pas signé leur feuille de présence ce jour

**Gestion des utilisateurs**
- CRUD complet : enseignants, élèves, parents, STAFF
- Création STAFF avec sélection permissions granulaires
- Assignation enseignant → matières + classes
- Assignation élève → classe
- Assignation parent → enfant(s) (lien `ParentStudent`)
- Assignation STAFF → section(s)
- Import en masse CSV/Excel avec rapport d'erreurs
- Export liste utilisateurs CSV/PDF
- Recherche et filtrage multi-critères
- Transfert d'élève entre classes (log dans `StudentPromotion`)
- Désignation Professeur Principal : `PATCH /classes/:id/professor-principal`

**Gestion des classes**
- CRUD : création, modification, suppression
- Configuration : niveau · série · section · filière
- Convention de nommage configurable ("6e A", "2nde C1", "Form 2A", "CAP1 MAEL")
- Capacité maximale par classe
- Vue détaillée : liste élèves + moyenne générale + taux de présence
- Sous-groupes TP : Groupe A / Groupe B (chacun avec sa liste d'élèves)

**Gestion des matières**
- CRUD matières
- Coefficient par matière × par série (configurables pour le 1er cycle, figés pour BAC)
- Type : THEORETICAL · PRACTICAL · MIXED
- Heures hebdomadaires par matière
- Association matières ↔ classes ↔ séries

**Gestion de l'année scolaire**
- Création avec date début/fin
- Définition 3 trimestres (FR) ou 3 terms (EN) avec dates
- Définition 2 séquences par trimestre/term
- Marquage de la période et séquence courante
- Archivage des années précédentes

**Calendrier scolaire dynamique**
- Date de rentrée officielle
- Vacances Noël (début + fin), Vacances Pâques (début + fin)
- Date fin d'année officielle
- Jours fériés camerounais (pré-chargés, modifiables)
- Jours de compositions par trimestre/term
- Samedi matin : actif/inactif (configurable par semaine ou par période)
- **Suivi automatique quotidien (Inngest job à minuit) :** la plateforme avance au jour suivant selon le calendrier configuré. Tant que les présences du jour courant ne sont pas toutes renseignées, un rappel est envoyé aux enseignants concernés. Dès que le jour est "fermé", le système passe automatiquement au prochain jour ouvré selon l'EDT.

**Annonces**
- Création avec ciblage par rôle
- Épinglage
- Historique daté

**Paramètres établissement**
- Informations générales (nom, logo, adresse, subdomain)
- Config bulletins (template, mentions, règles, logo)
- Formule calcul notes (configurable via GradeFormula)
- Seuil d'alerte absence (défaut : 3)
- Activation/désactivation modules (bibliothèque, offline, etc.)
- Modération messages (on/off + modérateur désigné)
- Préférences notifications (SMS · push · email)

---

## MODULE 6 — Enseignant [RÉEL: 🟡 PARTIEL — dashboard, présences élèves, notes, devoirs, emploi du temps, cahier de texte, ressources tous confirmés avec du vrai code. Voir ⬇️ pour le "Journal de présence numérique" qui n'est PAS ce qui a été construit.]

**Tableau de bord**
- Mes classes et matières du jour
- Emploi du temps du jour avec salle
- Alertes IA : élèves en risque d'échec / en difficulté / en progression
- Actions rapides

**Journal de présence numérique (nouvelle fonctionnalité V2) [RÉEL: ⬜ PAS FAIT tel que décrit ici]**
- À chaque cours, l'enseignant clique "Démarrer le cours" → horodatage enregistré
- À la fin du cours, il clique "Terminer le cours" → durée effective enregistrée
- Fonctionne hors ligne (sync automatique au retour du réseau)
- Données visibles par : l'enseignant lui-même · le SG · le Proviseur · la DDES (Phase 5)
- Rapport hebdomadaire automatique pour le SG : enseignants qui ont assuré tous leurs cours vs ceux avec des manques
- **[RÉEL] Ce qui existe à la place :** `StaffAttendance` — une présence journalière classique (Présent/Absent/Retard, un enregistrement par jour), pas un pointage par cours avec horodatage démarrer/terminer. Le concept "clock-in par créneau" reste à construire si on le garde au plan.

**Vue par classe (6 onglets)**
Vue d'ensemble · Élèves · Présence · Notes · Devoirs · Messages

**Prise de présences élèves**
- Sélection classe + date + période (MORNING / AFTERNOON)
- Marquage par élève : Présent / Absent / Retard
- Pour sous-groupes TP : présence par sous-groupe
- Mode hors ligne avec file d'attente et sync automatique
- Notification automatique au parent dès absence enregistrée

**Saisie des notes (workflow)**
1. Enseignant saisit → statut `DRAFT`
2. Enseignant clique "Soumettre pour validation" → statut `SUBMITTED`
3. Censeur valide → `VALIDATED` (note verrouillée pour l'enseignant)
4. Génération bulletin → `LOCKED`
5. Rejet Censeur + motif → `DRAFT` (enseignant notifié, corrige et resoumet)

**Calcul automatique**
- Moyenne matière selon la GradeFormula configurée
- Moyenne générale pondérée par les coefficients
- Rang dans la classe (départage par matière principale en cas d'égalité)
- Code couleur rouge (<8) / orange (8-10) / vert (≥10)

**Gestion des devoirs**
- Création : titre · description · date limite · fichier joint
- Publication dans le canal classe
- Suivi soumissions (à faire / soumis / noté)
- Notation en ligne

**Emploi du temps**
- Vue hebdomadaire par classe et par enseignant
- Demande de cours de rattrapage → notification Censeur/SG

**Ressources pédagogiques**
- Upload PDF, images, vidéos
- Organisation par classe et matière
- Partage avec les élèves

**AP/HOD — Mallette pédagogique numérique**
- Programmes officiels MINESEC par discipline
- Banque de sujets APC
- Gestion des Conseils d'Enseignement
  - Convocation CE (minimum 2×/trimestre)
  - Rédaction et transmission rapports CE
  - Chronomètre règle 8 jours avec alertes J-3 (orange) J-1 (rouge)
  - Blocage soumission nouveaux projets si rapport en retard
- Validation des projets pédagogiques et fiches de progression
- Circuit : Enseignant soumet → AP valide/refuse → Censeur approuve
- Statistiques : taux couverture programmes · taux réussite discipline

---

## MODULE 7 — Parent [RÉEL: 🟡 PARTIEL — dashboard, suivi par enfant, paiements tous confirmés (`SectionParent*.tsx`). ✅ "Transparence APEE" ci-dessous : FAIT (Juillet 2026), voir `SectionParentAPEE.tsx`. ⏸️ "Communication bidirectionnelle" ci-dessous : reportée, voir MODULE 10.]

**Tableau de bord**
- Vue d'ensemble par enfant : moyenne · présences · dernières notes
- Alertes : absence · baisse performance · paiement en retard
- Indice de santé scolaire de l'enfant (0-100)
- Accès rapide par enfant (si plusieurs)

**Suivi par enfant (5 onglets)**
Vue d'ensemble · Notes · Présence · Comportement · Devoirs

- Graphique évolution des moyennes dans le temps
- Moyennes par matière vs moyenne de la classe
- Historique complet présences et absences
- Calendrier des devoirs
- Consultation et téléchargement bulletin PDF
- Détection progressions remarquables (alerte positive)

**Paiements**
- Frais à régler : scolarité · APEE · examen · tenue · caution · atelier
- Statut : payé / en attente / en retard
- Paiement MTN MoMo ou Orange Money depuis l'app
- Reçu PDF automatique après paiement
- Historique complet transactions
- Factures dégradations biens avec paiement en ligne

**Transparence APEE (nouvelle fonctionnalité V2) [RÉEL: ⬜ PAS FAIT — aucun modèle, aucun use case, `APEE_PTA` n'existe que comme valeur d'énumération de type de frais]**
- Onglet dédié "APEE / Gestion des fonds"
- Tableau des montants collectés vs dépensés par catégorie (entretien, matériel, activités…)
- Justificatifs uploadés par l'Intendant (factures scannées, bons de commande)
- Journal chronologique de toutes les transactions APEE
- Export PDF du rapport APEE pour les représentants de parents
- **Verrou légal :** aucune dépense APEE ne peut apparaître sans un justificatif joint (règle système — pas de contournement possible)

**Communication bidirectionnelle (nouvelle fonctionnalité V2) [RÉEL: ⏸️ REPORTÉE à une prochaine version — décision produit. Ce qui existe dans le code : `Conversation`/`Message` dans le schema Prisma mais jamais utilisés (0 référence dans `backend/src`), aucune UI. Ce qui marche et reste actif : diffusion à sens unique SMS/Email en masse (`CommunicationsController.ts`).]**
- Messagerie privée avec les enseignants
- Réponse directe à une notification d'absence pour la justifier (avec pièce jointe optionnelle)
- Canal Parents de la classe
- Notifications : absence · alerte IA · bulletin disponible · rappel paiement
- SMS pour alertes critiques (même sans smartphone)
- Convocations Conseil de Discipline + confirmation présence

---

## MODULE 8 — Élève [RÉEL: ✅ FAIT pour l'essentiel — dashboard, notes/bulletins, devoirs, présences, bibliothèque tous confirmés (`SectionStudent*.tsx`). Le paiement via cartescolaire.cm est même plus avancé que prévu grâce au module Matricule.]

**Tableau de bord**
- Moyenne générale · classement · absences
- Cours du jour avec salle
- Devoirs à rendre
- Notes récentes
- Indice de santé scolaire

**Cours et ressources**
- Emploi du temps hebdomadaire
- Ressources des enseignants
- Téléchargement documents de cours

**Notes et bulletins**
- Toutes les notes par matière et période
- Moyenne générale avec coefficients (détail affiché)
- Bulletin PDF consulter et télécharger
- Historique bulletins par année

**Devoirs**
- Liste avec statut (à faire / soumis / noté)
- Soumission fichier joint
- Consultation corrections et notes

**Paiement**
- Via cartescolaire.cm (matricule unique national MINESEC)
- Téléchargement quitus de paiement

---

## MODULE 9 — Bulletins Scolaires [RÉEL: ✅ FAIT — génération PDF réelle via `PdfKitBulletinService.ts`, workflow de blocage sur notes non validées confirmé. Non vérifié en détail : les 6 templates sont-ils TOUS couverts individuellement (FR/EN/Technique/Primary/Annual/Monthly) ou seulement les principaux.]

**Pré-requis obligatoire (bloquant)**
- Toutes les notes de la classe en `VALIDATED`
- Si manquante → génération bloquée + liste des matières/enseignants concernés

**Fonctionnalités communes**
- Génération PDF individuelle (PDFKit)
- Export PDF en masse par classe (zip)
- Envoi automatique aux parents par email
- Historique bulletins par année scolaire
- Commentaire narratif IA (Phase 4)
- Mention calculée automatiquement selon MentionRule configurée

**Template FR_SECONDARY**
- En-tête : logo + nom école + année + période
- Tableau : matière · coeff · DS1 · DS2 · Compo · moyenne · rang · appréciation enseignant
- Appréciation générale Censeur + PP
- Récapitulatif : absences justifiées/non justifiées/retards/avertissements
- Profil classe : moy. premier · moy. dernier · nb admis · taux réussite · moy. classe
- 3 signatures + visa parent
- Décision Conseil de Classe si tenu

**Template EN_SECONDARY**
- Langue anglais
- Grades sur 20 ou 100
- Teacher comment · Form Master remark · Principal/VP remark
- Mentions EN

**Template TECHNICAL_FR**
- Deux lignes par matière technique (Théorie + Pratique)
- Section "Comportement professionnel en atelier" /20
- Appréciation Chef des Travaux

**Template PRIMARY**
- FR : barèmes variables + cotes A/ECA/NA + conduite + assiduité + observation instituteur
- EN : sous-compétences + Total / On + visa Head Teacher

**Template ANNUAL**
- 3 trimestres côte à côte + 6 évaluations côte à côte
- Rangs annuels + rangs trimestriels + rangs par évaluation
- Décision finale : PROMU / REDOUBLE

**Template MONTHLY**
- Primaire anglophone uniquement
- Résultat mensuel + performance classe

---

## MODULE 10 — Communication [⏸️ MESSAGERIE REPORTÉE À UNE PROCHAINE VERSION — décision produit, Juillet 2026]

> **Décision :** la partie "messagerie type WhatsApp" de ce module (les 4 couches ci-dessous, temps réel Socket.io, centre de conversation) est **mise de côté volontairement**. Ce n'est pas un abandon — c'est une priorisation : ça reviendra dans une prochaine version. **[RÉEL] État du code à ce jour :** les modèles Prisma `Conversation`/`Message`/`MessageReadStatus` existent dans le schema mais ne sont référencés nulle part dans `backend/src` (0 controller, 0 use case, 0 UI) — c'est un stub de schéma, pas une fonctionnalité entamée. Rien à "finir à moitié" ici, c'est un vrai point de départ à zéro le jour où on le reprend.
>
> **Ce qui N'EST PAS concerné par le report** et continue de vivre normalement : les **Notifications multi-canal** (SMS/Email/Push à sens unique) ci-dessous — `CommunicationsController.ts` + `BroadcastLog` sont réels et fonctionnels (diffusion ciblée par rôle/classe/statut de paiement, confirmée en code cette session). **Mise à jour Juillet 2026 :** Push (Web Push/VAPID) et la cloche IN_APP (centre de notifications, historique, marquer comme lu) sont désormais également réels et fonctionnels — construits cette session, voir détail ci-dessous.

**4 couches de messagerie ⏸️ [REPORTÉ]**
1. **Canal Classe** → enseignant vers toute la classe (élèves + parents) : annonces, devoirs
2. **Canal Parents** → admin/enseignant vers parents de la classe : espace dédié
3. **Message Privé** → conversation 1-1 (tous rôles)
4. **Notifications Système** → messages automatiques (absence, paiement, alerte IA)

**Modération (si activée) ⏸️ [REPORTÉ — dépend des couches de messagerie ci-dessus]**
- Message soumis → statut PENDING (invisible pour les autres)
- Modérateur notifié immédiatement
- 2h sans action → relance expéditeur · 4h sans action → relance modérateur
- Approbation → message publié · Rejet → message supprimé + expéditeur notifié avec motif
- Exemptés de modération : Messages Privés + Notifications Système

**Temps réel ⏸️ [REPORTÉ]**
- Socket.io pour la messagerie
- Indicateur messages non lus
- Partage fichiers (PDF, images)
- Recherche dans les conversations

**Notifications multi-canal [RÉEL: 🟡 PARTIEL — actif et non reporté, largement construit]**
- Push (Web Push/VAPID, pas FCM — décision produit Juillet 2026 pour rester réutilisable tel quel par une future appli desktop Electron/mobile Capacitor sans dépendance Google) — **✅ FAIT**, `PushSubscription` + `SouscrirePushUseCase`/`DesinscrirePushUseCase`, Service Worker + clés VAPID, `PUSH_MIGRATED_EVENT_TYPES` : bulletins disponibles, rappels/reçus de paiement, relances notes 48h/72h, alertes absence, notifications discipline basculent en push en priorité (email en repli si pas de souscription active)
- SMS (MTN/Orange via gateway Techsoft ou équivalent camerounais) — `SmsNotificationService.ts` confirmé réel
- Email (Resend) — confirmé réel (`NodemailerEmailService.ts`/Resend), reste le canal exclusif pour les personnes sans compte encore créé (onboarding)
- **Repli push-d'abord généralisé aux alertes parent** (Juillet 2026) — `PushFirstNotifier.ts` (`notifierParentsPushDabord`) : cloche systématique + push tenté en premier pour chaque parent individuellement, SMS envoyé uniquement aux parents dont le push n'a atteint aucun appareil — jamais les deux à la fois pour la même personne. Appliqué aux 4 alertes parent existantes : absence (`notifyAbsenceSms`), retard de paiement (`notifyOverdueInvoiceSms`), sanction disciplinaire (`notifyDisciplineSms`), retard de bibliothèque (`notifyOverdueBookSms`). Répond directement au besoin "SMS natif pour parents sans smartphone" — le SMS reste garanti pour ces parents-là (push jamais délivré → repli automatique), tout en évitant son coût pour les parents déjà joignables par push.
- Cloche IN_APP (aperçu live, dropdown) : historique · marquer comme lu · badge non-lus — **✅ FAIT** (modèle `Notification` persisté, connexion Socket.io authentifiée par rooms `user:{userId}`/`school:{schoolId}:role:{role}`, composant `NotificationBell.tsx` câblé dans les 6 dashboards)
- Centre de notifications (vue complète dédiée, pas juste le dropdown) : historique paginé + filtres par type et par lu/non-lu — **✅ FAIT** (Juillet 2026) — `NotificationController.list` étendu (page/type/isRead, rétrocompatible avec la cloche), composant partagé `NotificationCenter.tsx`, section "Notifications" dans les 5 dashboards (Admin/Staff/Teacher/Student/Parent). Tri par priorité — non fait.
- Préférences personnalisables par utilisateur — non confirmé
- Moteur de règles configurable par Admin — non confirmé

---

## MODULE 11 — Finance & Mobile Money [RÉEL: ✅ FAIT — `FeePlan`/`Invoice`/`Payment`, webhook Campay réel (`TraiterWebhookCampayUseCase`), cautions, factures en masse, et désormais la sous-section "Transparence APEE" ci-dessous (✅ FAIT, Juillet 2026, voir aussi MODULE 7).]

**Types de frais**
| Type | Géré par | Mobile Money |
|------|---------|-------------|
| Scolarité / APEE | Intendant | Obligatoire (public) |
| Examen BEPC/BAC/GCE | OBC/GCE Board | Via cartescolaire.cm |
| Tenue / uniforme | Établissement | Variable |
| Caution (remboursable) | Établissement | Variable |
| Ateliers / stages | Établissement | Variable |
| PTA Levy / Development Levy (EN) | Établissement | Variable |
| Inscription début d'année | Établissement | Variable |

**Intégration Mobile Money (Campay API)**
- MTN Mobile Money Cameroun (priorité 1)
- Orange Money Cameroun (priorité 1)
- Express Union (priorité 2)
- Flux : initiation depuis l'app → callback Campay → mise à jour DB → reçu PDF → email/SMS

**Gestion des cautions**
1. Collecte → statut `CAUTION_RETENUE`
2. Suivi Intendant (colonne dédiée)
3. Remboursement individuel ou groupé → virement Mobile Money → `CAUTION_REMBOURSEE`
4. Non-remboursement (dommages) → motif + `CAUTION_RETENUE_DEFINITIF` + notification parent

**Transparence APEE — tableau de bord dédié (nouvelle fonctionnalité V2) [RÉEL: ✅ FAIT — Juillet 2026, voir "✅ Chantiers Juillet 2026" en tête de document. `APEETransaction` (collecte/dépense, justificatif obligatoire avant validation), `APEEController`, dashboard Intendant + vue Parent lecture seule anonymisée, rapport PDF. Priorisé suite à recherche de marché : point de douleur documenté et aucun concurrent camerounais identifié ne semble le proposer publiquement.]**
- Chaque collecte APEE crée un `APEETransaction` avec montant + date + catégorie
- Chaque dépense APEE exige un justificatif joint (PDF/image) avant validation
- Tableau de bord Intendant : solde APEE · collectes · dépenses · justificatifs manquants
- Tableau de bord parent (lecture seule) : même vue, anonymisée au niveau individuel
- Rapport PDF APEE exportable pour l'Assemblée Générale des parents

**Dashboard Intendant**
- Total attendu / reçu / retard + taux recouvrement par classe
- Paiements récents avec statut
- Plans de frais (création par type et niveau)
- Suivi dépenses
- Vue dédiée "Cautions"
- Vue dédiée "APEE Transparence"
- Rapports financiers : mensuel + trimestriel

**Blocages non-paiement**
- Alerte parent dès échéance dépassée
- Blocage inscription examens officiels (sans preuve)
- Blocage FENASCO/assurance scolaire
- Exclusion cours (privé uniquement — interdit public)

**Relances automatiques Inngest**
- J-7, J-3, J-0, J+3 après date limite → notifications Mobile + SMS

---

## MODULE 12 — Emploi du Temps [RÉEL: 🟡 PARTIEL]

**Mode manuel (Phase 2) [RÉEL: ✅ FAIT — CRUD créneaux + publication confirmés (`CreerEmploiDuTempsUseCase`, `AjouterCreneauUseCase`, `PublierEmploiDuTempsUseCase`). **Correction Juillet 2026** : l'audit précédent affirmait à tort que la détection de conflit était absente — en réalité elle existe et fonctionne bout en bout : `CreneauHoraire.verifierConflitEnseignant()` (chevauchement d'intervalles), câblée dans `AjouterCreneauUseCase` ET `ModifierCreneauUseCase` (avec exclusion du créneau édité), `ConflitHoraireError` → HTTP 409 `CONFLIT_HORAIRE` dans `TimetableController`, message affiché côté frontend (`SectionTimetableStaff.tsx`), et couverte par un test unitaire réel (8/8 passent). Rien à construire ici.]**
- Création par Censeur/VP
- Détection conflits : même enseignant à la même heure → erreur 409
- Vérification volume horaire AP ≤ 14h/semaine (verrou)
- Vue hebdomadaire par classe et par enseignant
- Samedi matin configurable
- Salles spéciales (TP, ateliers, labo)
- Sous-groupes TP : créneau assigné au Groupe A ou Groupe B
- Types de créneaux : CLASS · BREAK · ACTIVITY · TD
- Demandes de rattrapage → workflow validation Censeur/SG
- **Lien avec le calendrier dynamique :** chaque créneau de l'EDT alimente le calendrier quotidien. Le système sait exactement quels cours sont prévus chaque jour et peut détecter les absences enseignants par comparaison avec les journaux de présence.

**Mode IA (Phase 4) [RÉEL: ✅ FAIT mais avec un LLM différent — `TimetableAutoController.ts` existe et utilise **Groq**, pas Google Gemini comme écrit ici. Voir aussi correction Stack Technique en PARTIE VIII.]**
- Génération Google Gemini
- Contraintes : enseignants, salles, matières, plages, samedi, sous-groupes, AP ≤ 14h
- Traitement asynchrone Inngest + statut temps réel
- Modification manuelle post-génération

---

## MODULE 13 — Présences & Discipline [RÉEL: 🟡 PARTIEL — présences élèves ✅ FAIT, discipline ✅ FAIT (Juillet 2026, voir ci-dessous), seul le "journal de présence enseignant" par cours (pointage démarrer/terminer) reste ⬜ manquant — voir État réel d'implémentation]

**Prise de présences élèves [RÉEL: ✅ FAIT]**
- Enseignant : fin de cours · Présent / Absent / Retard
- Sous-groupes TP : présence par sous-groupe
- SG : consolidation des présences
- Mode hors ligne avec sync automatique
- Notification parent dès absence enregistrée

**Journal de présence enseignant (nouvelle fonctionnalité V2) [RÉEL: ⬜ PAS FAIT tel que décrit — voir la note détaillée au MODULE 6. `StaffAttendance` couvre une présence journalière classique, pas ce système par créneau lié à `TimetableSlot`.]**
- Lié à chaque `TimetableSlot`
- Statuts : `SCHEDULED` · `PRESENT` · `ABSENT` · `CATCHUP_DONE`
- Renseigné par l'enseignant lui-même (démarrer/terminer cours)
- Consolidé par le SG pour rapport hebdomadaire
- Exportable par l'Admin en rapport mensuel PDF
- Visible en lecture seule par la DDES (Phase 5) via leur espace dédié
- Données ne peuvent pas être rétroactivement modifiées par l'enseignant une fois la période fermée

**Seuils et alertes élèves**
- Défaut : 3 absences non justifiées → notification PP + parent
- 5 absences consécutives → alerte SG
- Configurable dans `SchoolConfig.absenceAlertThreshold`

**Seuils et alertes enseignants**
- 3 cours non assurés dans un trimestre → alerte Proviseur
- Seuil configurable dans `SchoolConfig.teacherAbsenceAlertThreshold`

**Registre de discipline — 5 niveaux [RÉEL: ✅ FAIT — corrigé Juillet 2026. `DisciplineRecord` a un vrai CRUD (routes `/api/v2/discipline`, notification SMS+email automatique aux parents, levée de sanction) — l'audit initial ne l'avait pas trouvé car les routes sont déclarées inline dans `hexagonal.bootstrap.ts`, pas via un contrôleur dédié. Niveaux 1-3 (avertissements, exclusion temporaire) : libres, au jugement du personnel. **Niveaux 4-5 (Conseil de Discipline / exclusion définitive) : désormais bloqués sans passer par le workflow ci-dessous** — `POST /api/v2/discipline` refuse leur création directe.]**
1. Avertissement oral (SG) → enregistré + parent notifié
2. Avertissement écrit → document signé + conservé dans dossier
3. Exclusion temporaire (1-3 jours) → décision SG + SMS parent
4. Conseil de Discipline → cas graves ou récidives
5. Exclusion définitive → uniquement Conseil de Discipline + PV + transmission MINESEC si public

**Composition légale du Conseil de Discipline (Art. 30) [RÉEL: ✅ FAIT — Juillet 2026]**
Chef établissement (président) + Censeur + SG + PP + représentant parents + représentant élèves
Convocation parents : minimum 72h avant (règle absolue) — `DisciplineCouncilSession` (`ConvoquerConseilDisciplineUseCase`, `TenirConseilDisciplineUseCase`, `/api/v2/discipline-council`), délai revérifié à la tenue (pas seulement à la convocation) pour empêcher le contournement, PV PDF exportable, composition légale complète exigée avant convocation. Frontend : onglet dédié dans `SectionDiscipline.tsx` (staff).

**Note de comportement professionnel (technique)**
- Champ "Attitude professionnelle en atelier" /20
- Critères : ponctualité · sécurité · tenue · initiative
- Saisi par Chef des Travaux ou enseignant TP
- Figure sur le bulletin technique en section séparée

---

## MODULE 14 — Intelligence Artificielle (Phase 4) [RÉEL: 🟡 PARTIEL — Indice de santé scolaire élève ✅ FAIT (`CalculerIndiceSanteUseCase.ts`, câblé au frontend `SectionAdminAI.tsx`) · Génération EDT IA ✅ FAIT (via Groq) · Indice de santé établissement / commentaires narratifs bulletins / centre d'aide chatbot : non confirmés dans l'audit, statut à vérifier]

**Indice de santé scolaire élève (0-100)**
| Composante | Poids | Calcul |
|-----------|-------|--------|
| Notes | 35% | Moy. générale normalisée (0→20 = 0→100) |
| Assiduité | 25% | (Jours présents / Jours total) × 100 |
| Tendance | 20% | Évolution moy. sur 3 dernières périodes |
| Comportement | 10% | Sanctions / nb de périodes |
| Paiements | 10% | Frais réglés / frais totaux |

Niveaux d'alerte : 0-30 Critique · 31-50 Élevé · 51-70 Moyen · 71-85 Stable · 86-100 Progression

**Indice de santé de l'établissement (0-100) — pour le MasterUser et la DDES**
| Composante | Poids |
|-----------|-------|
| Taux de réussite moyen | 30% |
| Taux de recouvrement des frais | 25% |
| Taux d'assiduité enseignants | 25% |
| Taux de complétion des notes | 10% |
| Taux communication parent | 10% |

**Détection risque d'échec**
- Moteur de scoring sur les 5 variables
- Tableau de bord IA par classe
- Recommandations textuelles automatiques enseignant + admin
- Alertes simultanées parent + enseignant + admin
- Seuils configurables par établissement

**Détection progressions remarquables**
- Alerte positive si hausse ≥ 2 points entre deux périodes
- Valorisation et encouragement

**Génération EDT par IA**
- Google Gemini + AI SDK
- Traitement asynchrone Inngest + statut temps réel frontend
- Modification manuelle post-génération

**Commentaires narratifs bulletins**
- Génération automatique du commentaire par élève
- Appréciation personnalisée basée sur données réelles

**Centre d'aide IA**
- Chatbot contextuel utilisation de la plateforme

---

## MODULE 15 — Mode Hors Ligne / PWA (Phase 4) [RÉEL: 🟡 PARTIEL — corrigé Juillet 2026. Vraie PWA installable désormais fonctionnelle : Service Worker Workbox (precaching app-shell) + manifest.json + worker custom push buildent et s'enregistrent correctement en production (bug bloquant de build résolu, voir ci-dessus MODULE PWA). Infrastructure de queue (`OfflineQueue` Prisma, `useSyncQueue.ts`, `lib/offline/db.ts`, `OfflineIndicator.tsx`, `SectionOfflineStatus.tsx`) étendue à la quasi-totalité des écrans d'écriture et de lecture identifiés par un audit dédié (voir section "Ce qui existe partiellement" plus haut). Reste non couvert : grilles horaires (génération auto), notes admin (validation), RH — classés catégorie C (doit rester en ligne) ou non prioritaires.]

**Infrastructure**
- Progressive Web App installable Android sans Play Store
- Service Worker + IndexedDB Dexie.js (présences, notes, listes élèves, EDT, journaux présence enseignant)
- Bannière indicatrice mode hors ligne
- Indicateur données en attente de synchronisation

**Fonctionnalités hors ligne**
- Saisie présences élèves · Saisie notes · Consultation liste élèves · Consultation EDT
- **Journal de présence enseignant** (démarrer/terminer cours même sans connexion)

**Synchronisation**
- Automatique au retour du réseau
- last-write-wins pour présences et notes non validées
- Notes déjà VALIDATED : modification hors ligne bloquée + alerte enseignant + notification Admin
- Rapport de sync : accepté / rejeté + motif (transparence totale)

**Mode SMS (Phase 4)**
- `PRES#6eA#2026-05-13#ABS:3,7,12` → parser → enregistrement en DB
- Via gateway SMS local (Techsoft ou équivalent)

---

## MODULE 16 — Bibliothèque (Optionnel) [RÉEL: ✅ FAIT — corrigé Juillet 2026. Contrairement à l'audit précédent ("coquille visuelle"), le backend était déjà quasi-complet (routes inline dans `hexagonal.bootstrap.ts`, non trouvées faute de recherche assez profonde — même schéma que le conflit d'EDT et la discipline) : CRUD ouvrages, emprunts/retours transactionnels (stock décrémenté/incrémenté), vue élève et vue parent scopées par enfant, job Inngest quotidien `markOverdueLoans` marquant automatiquement les retards. Finalisé Juillet 2026 : bouton "Modifier" un ouvrage (le backend avait déjà `PATCH /books/:id`, l'UI ne l'exposait pas), renouvellement d'emprunt (`PATCH /loans/:id/renew`), KPI "Livres en retard" ajouté au tableau de bord staff (page d'accueil, absente jusque-là de tout indicateur bibliothèque). Notification de retard revue pour utiliser le push en priorité (élève ET parents, cohérent avec le reste de la plateforme) plutôt que le SMS seul : élève → cloche + push best-effort (pas de repli SMS, un élève camerounais a rarement un numéro propre) ; chaque parent → cloche systématique + push d'abord, SMS uniquement si le push n'atteint aucun appareil de ce parent précis (même logique de repli que l'email en Phase B, appliquée ici au SMS).]

**Activation :** Paramètres école → `School.features JSONB`

- Inventaire : titre · auteur · ISBN · exemplaires · rayon · catégorie
- Emprunts/retours avec date de retour prévue
- Relances automatiques pour retards
- Réservation en ligne
- Recommandations des enseignants par classe
- Suggestions lecture par matière

---

## MODULE 17 — Conseil de Classe & Réunions [RÉEL: 🟡 PARTIEL — Conseil de Classe ✅ FAIT (`TenirConseilClasseUseCase.ts`, blocage réel sur notes non validées, composition légale respectée). Conseil de Discipline ✅ FAIT (Juillet 2026, voir MODULE 13). Réunion parents-profs : voir note ci-dessous.]

**Pré-requis bloquant**
Toutes les notes de la classe en `VALIDATED` → sinon session bloquée + liste des manquantes

**Workflow Conseil de Classe**
1. Admin/Censeur crée la session (classId + academicPeriodId)
2. Vérification notes validées
3. Saisie décisions par élève : PASS · REPEAT · DELIBERATION
4. `ClassCouncilDecision` stockée (élèveId · classeId · periodeId · décision · observations)
5. Session verrouillée après validation (modification : Admin uniquement)
6. Visibilité : Admin + Censeur voient tout · Élève + Parent voient uniquement leur décision

**Rapport officiel Conseil de Classe (canevas MINESEC)**
- Effectifs + genre + profils spéciaux
- Situation pédagogique : admis · moyennes · pics (meilleur/plus faible)
- Situation disciplinaire
- Performances enseignants : taux couverture · ponctualité · assiduité
- Analyse croisée : discipline ↔ performance

**Conseil de Discipline [RÉEL: ✅ FAIT — voir MODULE 13, Juillet 2026]**
- Voir Module 13 — workflow complet

**Module Réunion parents-profs [RÉEL: ⬜ non confirmé dans l'audit — probablement pas fait]**
- Planification en ligne
- Confirmation de présence
- Compte-rendu post-réunion

---

## MODULE 18 — Fin d'Année Scolaire [RÉEL: ✅ FAIT — `CloturerAnneeUseCase.ts` + `VerifierPrerequisClotureUseCase.ts` (avec tests), `ClassPromotion`/`StudentPromotion` réels]

**Prérequis bloquants**
- Toutes les notes → `VALIDATED`
- Tous les Conseils de Classe de fin d'année → validés (décision pour chaque élève)
- Bulletins de fin d'année → générés et archivés

**Workflow de clôture**
1. `POST /academic-years/:id/pre-close-check` → liste des blocages
2. Si OK : `POST /academic-years/:id/close` → année passe en `ARCHIVED`
3. Données conservées, accessibles en lecture seule
4. Promotion automatique selon décisions conseil (mapping prédéfini par template)
5. Terminale/UpperSixth → statut `GRADUATED` ou `LEFT`
6. Admin crée la nouvelle année + périodes + séquences
7. Classes de la nouvelle année vides (prêtes pour nouvelles assignations)
8. Historique accessible depuis le profil élève

---

## MODULE 19 — Rapports & Analytics [RÉEL: 🟡 PARTIEL]

**Déclaration statistique MINESEC — pipeline de génération [RÉEL: ✅ FAIT, migré Juillet 2026]** : le remplissage du vrai fichier `.xls` officiel MINESEC utilisait SheetJS en écriture BIFF8 directe, ce qui cassait silencieusement les formules Excel (totaux affichés à 0) et perdait la mise en forme d'origine — migré vers LibreOffice headless (conversion ponctuelle, pas un service permanent) + exceljs pour l'écriture des valeurs. Formules et mise en forme désormais préservées. `CampaignFieldMapping` inchangée, déchiffrement VelvetSweatshop inchangé.

**Export "Liste nominale conforme MINESEC" (nouveau chantier, Juillet 2026) [RÉEL: ✅ FAIT]** — `HRController.exportListeNominaleMinesec` (`GET /api/v2/hr/export/liste-nominale-minesec`), bouton "Export MINESEC" dans la section RH du dashboard Admin. Colonnes livrées : nom, prénom, fonction, N° CNPS, date de prise de service, statut — au format et modèle exact fourni par l'administration centrale (modèle précis non trouvé en recherche publique ; structure du use case volontairement centralisée pour être ajustable rapidement dès confirmation du vrai modèle par un chef d'établissement).

**Rapports périodiques [RÉEL: non confirmé dans l'audit — à vérifier]**
- Rapport mensuel PDF automatique (plan Premium) → 1er du mois via Inngest
- Top/flop matières · élèves à risque · taux paiement
- Rapport financier trimestriel
- Rapport annuel fin d'année

**Rapports DDES/DRES (nouvelle fonctionnalité V2) [RÉEL: ⬜ PAS FAIT — aucun rôle DDES/DRES, aucune route, aucun espace de réception. Ce qui EST fait et proche dans l'esprit : les modules de déclaration statistique MINESEC/MINEDUB (remplissage du vrai fichier `.xls` officiel) — mais ce sont des déclarations vers le ministère, pas un espace de lecture DDES en direct dans la plateforme (voir MODULE 22).]**
- Génération en un clic par l'Admin : rapport officiel au format MINESEC
- Transmission directe depuis la plateforme vers l'espace lecture DDES
- Contenu : effectifs · résultats examens · taux de présence enseignants · situations disciplinaires majeures

**Analytics**
- Performance par classe (graphique tendance)
- Évolution moyennes dans le temps par élève
- Comparaison inter-classes
- Indice de santé de l'établissement
- **Carte de chaleur absentéisme enseignants** (par jour, par matière)
- **Comparaison taux de réussite** par rapport aux moyennes nationales disponibles (BAC, BEPC)

---

## MODULE 20 — Matricule Unique Numérique (Phase 5) [RÉEL: ✅ FAIT, plus avancé que prévu — 8 use cases réels dans `backend/src/application/matricule/` : import, vérification, sync automatique du statut de paiement par scraping cartescolaire.cm (`SyncFromCarteScolaireUseCase`), correspondance fuzzy-matching, signalement d'erreur. Ce module planifié pour la Phase 5 est en réalité déjà construit.]

**Contexte :** Le MINESEC a lancé l'initiative du matricule unique pour chaque élève camerounais. EduNexus génère déjà un matricule interne par élève. À l'échelle, la plateforme devient un registre national décentralisé.

**Fonctionnalités :**
- Chaque élève reçoit un `studentNationalId` généré selon un format standard (région + établissement + année + séquence)
- Historique scolaire complet accessible via ce matricule : notes, promotions, établissements fréquentés
- Vérification matricule lors d'un transfert entrant : si l'école d'origine est sur EduNexus, l'historique est importé automatiquement
- Détection doublons : même nom + date de naissance + matricule → alerte Admin + MasterUser

---

## MODULE 21 — Groupe Scolaire (Phase 5) [RÉEL: ✅ FAIT, en avance sur la planification (prévu Phase 5, déjà construit — juillet 2026) — voir `Plan_Groupe_Scolaire_ZekoulABia.md` pour le détail. Compte séparé `SchoolGroupOwner` (jamais un rôle `User`, cf. décision d'architecture Section 1) avec sa propre auth 3FA (`/api/v2/group/auth`, cookie `group_jwt`), dashboard `/group/dashboard` (KPIs agrégés + liste écoles + transferts). Agrégation toujours calculée école-par-école, jamais un `schoolId IN (...)` sur une table individuelle (isolation multi-tenant préservée). Transferts élève/enseignant via `GroupTransferRequest` : jamais de mutation directe de `schoolId`, l'ancien compte reste intact (marqué `studentStatus: TRANSFERRED`), le nouveau dossier passe par le même mécanisme de lien sécurisé/validation humaine que l'onboarding classique. `PlanType.ETABLISSEMENT_PLUS` ajouté. Volontairement PAS fait dans ce premier jet (Section 12 du plan) : facturation consolidée automatisée, comptes délégués/lecture-seule pour un groupe, héritage de calendrier scolaire à l'échelle du groupe, dashboard marque blanche.]

**Contexte :** De nombreux fondateurs gèrent plusieurs établissements (primaire + collège + lycée) sous une même direction. Aujourd'hui, aucun outil ne leur offre une vue consolidée.

**Fonctionnalités :**
- Création d'un `SchoolGroup` regroupant plusieurs `School` existants
- Compte `SCHOOL_GROUP_OWNER` avec dashboard consolidé
- KPIs agrégés : effectifs totaux · taux réussite global · revenus cumulés · absentéisme global
- Transfert facilité d'élèves entre établissements du même groupe (du primaire au collège, par exemple)
- Transfert d'enseignants vacataires entre établissements du groupe
- Isolation des données maintenue : chaque école reste un tenant indépendant
- Plan tarifaire dédié "Établissement+" avec remise sur volume

---

## MODULE 22 — Accès DDES/DRES (Phase 5) [RÉEL: ⬜ PAS FAIT — pas de rôle, pas de route, pas d'espace. `TRANSMISE_DRES` n'existe que comme valeur de statut dans le module de déclaration statistique MINESEC. Cohérent avec la planification Phase 5.]

**Contexte :** La DDES n'a aujourd'hui aucun outil pour piloter les établissements de sa circonscription en temps réel. Les données arrivent sur papier, avec des semaines de retard.

**Fonctionnalités :**
- Espace DDES séparé (URL dédiée, pas d'accès aux espaces des écoles)
- Tableau de bord : tous les établissements de la circonscription, avec filtres
- Vue agrégée : taux de présence des enseignants · taux de réussite · signalements disciplinaires majeurs
- Réception des rapports officiels transmis par les Admins
- Export CSV/PDF des données agrégées pour les rapports ministériels
- Aucune permission d'écriture — lecture seule totale

---

## MODULE 23 — Workflow Entrée en 6e (Phase 6) [RÉEL: ✅ FAIT, en avance sur la planification (prévu Phase 6, déjà construit) — `application/entranceExam/` : calcul admission, détection d'anomalies, scan IA des listes de candidats, `EnregistrerResultatCepUseCase` qui croise le CEPE et pré-remplit un squelette d'onboarding (validation humaine requise, pas d'auto-assignation aveugle).]

**Contexte :** Au Cameroun, l'entrée en 6e est conditionnée par deux éléments : l'obtention du CEPE (Certificat d'Études Primaires et Élémentaires) ET la réussite au concours d'entrée en 6e. Ce concours se passe physiquement dans les établissements secondaires. Il n'y a pas de passage en ligne.

**Workflow :**
1. L'école primaire configure le "Concours d'entrée en 6e" dans son espace EduNexus
2. Les familles s'inscrivent via le portail de l'établissement cible (secondaire) — dossier numérique : nom · date de naissance · école d'origine · numéro CEPE si disponible
3. Le jour du concours : les épreuves sont physiques (en salle). EduNexus n'interfère pas dans la passation.
4. Après le concours, l'Admin du lycée/collège saisit les résultats dans EduNexus (ou import CSV)
5. Croisement automatique : liste des candidats + liste CEPE importée (si l'école primaire est aussi sur EduNexus) → détection automatique des admis ayant les deux conditions remplies
6. Publication des résultats sur le portail de l'établissement (liste officielle des admis)
7. Les admis → statut `PRE_ENROLLED` automatiquement, avec leur dossier pré-rempli
8. L'Admin finalise les inscriptions : assignation de classe 6e, création du compte élève complet
9. Dès que la rentrée arrive, les élèves sont directement en 6e dans la plateforme avec leur historique primaire lié (si disponible)

**Lien avec le CEPE :**
- Si l'école primaire d'origine est sur EduNexus → l'historique est lié automatiquement via le matricule
- Si elle ne l'est pas → saisie manuelle du numéro CEPE à des fins d'archivage

---

## MODULE 24 — Banque d'Anciennes Épreuves (Phase 6) [⏸️ REPORTÉ À UNE PROCHAINE VERSION — décision produit, Juillet 2026] [RÉEL: ⬜ PAS FAIT — pas de modèle `ExamArchive`. `Exam`/`ExamRegistration` existent mais servent aux examens en cours, pas à une bibliothèque d'archives.]

**Contexte :** Les élèves préparant le BEPC, le BAC, le GCE O-Level et A-Level ont besoin d'accéder aux anciens sujets. Aujourd'hui, ces sujets circulent de manière informelle (photocopies, groupes WhatsApp). EduNexus peut les centraliser de façon structurée, accessible et légale.

**Fonctionnalités :**
- Gestion par le Documentaliste : upload des épreuves par matière · examen · session (année) · série
- Formats acceptés : PDF uniquement
- Accès conditionnel : uniquement aux élèves des classes d'examen (3e pour BEPC, Tle pour BAC, Form5 pour GCE O-Level, UpperSixth pour A-Level)
- Accès automatiquement déverrouillé selon la classe de l'élève
- Filtres : matière · année · série · type d'épreuve (officielle, épreuve blanche)
- Téléchargement PDF depuis l'espace élève et parent
- L'enseignant peut épingler des épreuves recommandées pour sa classe
- **Limite légale :** seules les épreuves officielles publiées par l'OBC/GCE Board sont acceptées. Pas de sujets d'établissements privés non autorisés.

---

## MODULE 25 — Répétiteurs en ligne (Phase 7 — Scale) [⏸️ REPORTÉ À UNE PROCHAINE VERSION — décision produit, Juillet 2026] [RÉEL: ⬜ PAS FAIT — aucune trace, cohérent avec le statut "optionnel, vision long terme" déjà indiqué ici]

**Contexte :** Beaucoup de parents cherchent des cours particuliers pour leurs enfants, surtout en période de préparation aux examens. Ce marché est actif à Yaoundé et Douala. EduNexus peut s'y positionner comme intermédiaire de confiance.

**Vision :**
- Section optionnelle dans l'espace parent : "Trouver un répétiteur"
- Quand un élève est détecté "à risque" dans une matière → suggestion automatique de répétiteurs disponibles pour cette matière
- Profil répétiteur : matières · niveaux · tarif · disponibilités · évaluations parents
- Mise en relation directe via messagerie EduNexus
- Commission EduNexus sur chaque mise en relation réussie (modèle à définir)
- **Ce module est optionnel et non inclus dans les phases 1-6. Il est mentionné ici pour la vision long terme.**

---

## MODULE 26 — API Publique & Intégrations (Phase 5) [RÉEL: ⬜ PAS FAIT / 🟡 le webhook Campay entrant existe déjà (voir MODULE 11) mais ce n'est pas une API publique documentée ni un système de webhooks sortants pour des tiers. Cohérent avec la planification Phase 5.]

- API RESTful documentée OpenAPI
- Webhooks pour notifications externes
- Partenariats apps de tutorat camerounaises
- Partenariats éditeurs manuels numériques
- Intégration OBC (résultats BAC)
- Intégration GCE Board (résultats A-Level)
- Intégration cartescolaire.cm (paiements via matricule unique national)

---

## MODULE 27 — Landing Page Publique [RÉEL: 🟡 PARTIEL — `LandingPage.tsx` + `DemoModal.tsx` confirmés réels (formulaire fonctionnel, pas juste statique) mais le branchement du formulaire vers un vrai `SchoolInvite`/lead en base n'a pas été confirmé — à vérifier.]

- Présentation de la plateforme
- 6 fonctionnalités clés (dont transparence APEE et mode hors ligne en avant)
- Tarifs : 3 plans visibles
- Contact + formulaire de demande de démo
- Bouton "Demander une démo" → formulaire → notification Super Admin
- Footer informations légales
- Formulaire "Demande d'accès" → crée `SchoolInvite` en attente

---

# PARTIE V — LE PLAN DE DÉVELOPPEMENT PAR PHASE

## Légende
- ✅ Terminé
- 🟡 En cours
- ⬜ À faire
- 🔴 Critique (bloquant si non fait)

---

## PHASE 0 — Fondation ✅ TERMINÉE [RÉEL: ✅ confirmé — la restructuration hexagonale listée ci-dessous comme "à faire" a en réalité déjà eu lieu]

**Tout ce qui devait être fait est fait :**
- ✅ Schema Prisma complet avec toutes les tables, relations, enums
- ✅ 17 SchoolTemplates seedés
- ✅ 8 BacCoefficients
- ✅ 2 GradeFormulas + 4 MentionRules
- ✅ Migration appliquée
- ✅ `classSerieValidator.ts`
- ✅ `CLAUDE.md`

**À ajouter (migration vers hexagonal — démarrage de zéro) :**
- ✅ **[RÉEL]** Restructuration des dossiers selon architecture hexagonale (voir PARTIE VII) — **faite**, `domain/application/infrastructure` existent et sont peuplés
- 🟡 **[RÉEL]** Ajout table `TeacherAttendanceLog` (clock-in par cours) au schema Prisma — non trouvée telle quelle ; seul `StaffAttendance` (présence journalière classique) existe. Reste à faire si on garde ce concept précis.
- ⬜ **[RÉEL]** Ajout table `APEETransaction` + `APEEReport` au schema Prisma — toujours pas fait
- ⬜ **[RÉEL]** Ajout table `SchoolGroup` + `SchoolGroupOwner` au schema Prisma — toujours pas fait
- ⬜ **[RÉEL]** Ajout table `ExamArchive` au schema Prisma — toujours pas fait
- 🟡 **[RÉEL]** Ajout champ `studentNationalId` à `StudentProfile` — probable vu l'ampleur du module Matricule déjà construit, mais non vérifié précisément par ce nom de champ

---

## PHASE 1 — Auth & Onboarding 🟡 EN COURS [RÉEL: ✅ globalement FAITE — Bloc 1, 2 et 3 confirmés réels (voir MODULE 2/3). Détail des tâches individuelles ci-dessous non ré-audité ligne par ligne, mais la fonctionnalité de bout en bout (invitation → onboarding → approbation → connexion Admin) est vécue en pratique tout au long de cette session.]
**Durée estimée :** Mai–Juin 2026

---

### BLOC 1 — Sécurité Auth ✅ TERMINÉ

| Tâche | Fichier | Statut |
|-------|---------|--------|
| Access token 15min + refresh token 7j | `infrastructure/auth/generateToken.ts` | ✅ |
| Deux cookies httpOnly séparés | `infrastructure/auth/generateToken.ts` | ✅ |
| `clearTokens()` pour le logout | `infrastructure/auth/generateToken.ts` | ✅ |
| Payload JWT complet (userId, schoolId, role, permissions, tokenType) | `infrastructure/auth/generateToken.ts` | ✅ |
| `requireAuth` lit uniquement le cookie + vérifie tokenType=access | `interfaces/http/middleware/auth.ts` | ✅ |
| `AuthPayload` avec permissions[] | `interfaces/http/middleware/auth.ts` | ✅ |
| `withCredentials: true` | `infrastructure/http/api.ts` | ✅ |
| Login récupère les permissions STAFF | `application/usecases/auth/LoginUseCase.ts` | ✅ |
| Logout appelle `clearTokens()` | `application/usecases/auth/LogoutUseCase.ts` | ✅ |
| Refresh token avec rotation | `application/usecases/auth/RefreshTokenUseCase.ts` | ✅ |
| Route `POST /auth/refresh-token` avec authLimiter | `interfaces/http/routes/auth.routes.ts` | ✅ |

---

### BLOC 2 — MFA Master Admin ✅ TERMINÉ

| Tâche | Fichier | Statut |
|-------|---------|--------|
| Vraie vérification TOTP avec otplib | `interfaces/http/middleware/masterSensitiveAuth.ts` | ✅ |
| Vérification et consommation recovery codes | `interfaces/http/middleware/masterSensitiveAuth.ts` | ✅ |
| `getMasterMfaStatus` lit la DB | `application/usecases/masterAdmin/GetMfaStatusUseCase.ts` | ✅ |
| `beginMasterMfaEnable` génère secret + QR code | `application/usecases/masterAdmin/BeginMfaEnableUseCase.ts` | ✅ |
| `confirmMasterMfaEnable` vérifie TOTP + active MFA + recovery codes | `application/usecases/masterAdmin/ConfirmMfaEnableUseCase.ts` | ✅ |
| `disableMasterMfa` efface tous les champs MFA | `application/usecases/masterAdmin/DisableMfaUseCase.ts` | ✅ |
| `regenerateMasterRecoveryCodes` | `application/usecases/masterAdmin/RegenerateRecoveryCodesUseCase.ts` | ✅ |
| Cookie `master_jwt` : httpOnly + strict + 8h | `infrastructure/auth/masterToken.ts` | ✅ |
| Invitations expirent à 72h | `application/usecases/masterAdmin/InviteSchoolUseCase.ts` | ✅ |

---

### BLOC 3 — Onboarding École ⬜ À FAIRE [RÉEL: ✅ FAIT — le wizard complet (5 étapes + version conversationnelle) existe et fonctionne, confirmé par un usage direct répété cette session. Les noms de fichiers ci-dessous (`JoinSchoolUseCase.ts` etc.) ne correspondent pas exactement aux noms réels (`OnboarderEcoleUseCase.ts`, `ApprouverEcoleUseCase.ts`, `ActiverEtablissementUseCase.ts`) mais la fonctionnalité derrière est bien là.]

**Application — Use Cases**

| Tâche | Use Case | Priorité |
|-------|---------|---------|
| Vérifier token invitation | `VerifyInviteTokenUseCase.ts` | 🔴 |
| Créer demande d'onboarding | `CreateOnboardingRequestUseCase.ts` | 🔴 |
| Valider le token + créer compte Admin | `JoinSchoolUseCase.ts` | 🔴 |
| Configuration automatique post-approbation (transaction atomique) | `ApproveSchoolUseCase.ts` | 🔴 |
| Rejeter avec motif + notifier Admin | `RejectSchoolUseCase.ts` | ⬜ |
| Email de bienvenue post-approbation | `SendWelcomeEmailUseCase.ts` | ⬜ |

**Infrastructure — Routes**

| Tâche | Fichier | Priorité |
|-------|---------|---------|
| `GET /onboarding/invite/:token` | `onboarding.routes.ts` | 🔴 |
| `POST /onboarding/requests` | `onboarding.routes.ts` | 🔴 |
| `POST /onboarding/join/:token` | `onboarding.routes.ts` | 🔴 |
| `POST /onboarding/approve/:requestId` | `onboarding.routes.ts` | 🔴 |
| `requireMasterSensitiveAuth` sur `POST /schools/invite` | `masterAdmin.routes.ts` | 🔴 |

**Frontend**

| Tâche | Page | Priorité |
|-------|------|---------|
| `SchoolOnboarding.tsx` — 5 étapes avec state machine | `pages/onboarding/` | 🔴 |
| Étape 1 : vérification token + infos pré-remplies | dans `SchoolOnboarding.tsx` | 🔴 |
| Étape 2 : formulaire infos école | dans `SchoolOnboarding.tsx` | 🔴 |
| Étape 3 : 4 questions → détection template automatique | dans `SchoolOnboarding.tsx` | 🔴 |
| Étape 4 : création compte Admin | dans `SchoolOnboarding.tsx` | 🔴 |
| Étape 5 : confirmation + soumission | dans `SchoolOnboarding.tsx` | 🔴 |
| Barre de progression entre les étapes | composant partagé | ⬜ |
| Gestion erreurs : token expiré, email existant | dans `SchoolOnboarding.tsx` | 🔴 |

---

### BLOC 4 — Finitions Super Admin ⬜ À FAIRE [RÉEL: 🟡 PARTIEL probable — le dashboard Master (MODULE 1) est confirmé mature (`SchoolDetailPage`-équivalent = `SectionSchools.tsx`/slide-over détail école, avec vrais formulaires, pas de `window.prompt()` retrouvé dans ce qui a été audité). Les tâches précises ci-dessous n'ont pas été vérifiées une par une.]

| Tâche | Fichier | Priorité |
|-------|---------|---------|
| Remplacer `window.prompt()` par Dialog avec vrais inputs | `pages/superadmin/SchoolDetailPage.tsx` | 🔴 |
| Implémenter `SchoolOnboardingForm.tsx` | `pages/superadmin/SchoolOnboardingForm.tsx` | ⬜ |
| Corriger `setSchoolConfig`/`getSchoolConfig` : supprimer champs inexistants | Use Case dédié | 🔴 |
| Typage fort dans `authMultiTenant.ts` | `interfaces/http/middleware/authMultiTenant.ts` | ⬜ |

**Validation Phase 1 complète :**
- [ ] `bunx tsc --noEmit` → 0 erreur
- [ ] `bun run dev` → serveur démarre
- [ ] Test manuel : invitation → onboarding → approbation → connexion Admin
- [ ] Test manuel : MasterUser login → email OTP → TOTP → dashboard

---

## PHASE 2 — Cœur Académique [RÉEL: ✅ globalement FAITE — utilisateurs/classes/matières/année scolaire (Bloc 1), présences élèves (Bloc 2, hors "journal enseignant" qui manque), notes (Bloc 3), bulletins (Bloc 4), EDT manuel avec détection de conflit confirmée (Bloc 5), conseil de classe + fin d'année (Bloc 6) tous confirmés réels par l'audit de code. C'est la phase la plus avancée du projet dans les faits, malgré le marqueur ⬜ d'origine.]
**Durée estimée :** Juin–Juillet 2026

---

### BLOC 1 — Utilisateurs & Structure de l'École ⬜

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| CRUD utilisateurs complet | `User/CreateUserUseCase.ts` etc. | Avec filtres rôle · classe · statut · section |
| Créer `StaffProfile` à la création STAFF | `CreateStaffProfileUseCase.ts` | |
| Import masse CSV | `ImportUsersUseCase.ts` | Validation + rapport d'erreurs |
| Transfert élève entre classes | `TransferStudentUseCase.ts` | Log dans `StudentPromotion` |
| Désignation Professeur Principal | `AssignClassMasterUseCase.ts` | |
| CRUD classes | `Class/CreateClassUseCase.ts` etc. | |
| Création sous-groupes TP | `CreateClassSubGroupUseCase.ts` | |
| CRUD matières + coefficients | `Subject/CreateSubjectUseCase.ts` etc. | |
| Gestion année scolaire | `AcademicYear/CreateAcademicYearUseCase.ts` etc. | |
| Calendrier scolaire | `UpdateSchoolCalendarUseCase.ts` | |
| Job quotidien calendrier dynamique | Inngest job `daily-calendar-advance` | Avancer au jour suivant automatiquement |

**Infrastructure — Routes**

| Tâche | Route | Détail |
|-------|-------|--------|
| CRUD utilisateurs | `GET/POST/PUT/DELETE /users` | |
| Import masse | `POST /users/import` | |
| Export liste | `GET /users/export` | |
| Transfert élève | `POST /students/:id/transfer` | |
| CRUD classes + sous-groupes | `GET/POST/PUT/DELETE /classes` | |
| CRUD matières + coefficients | `GET/POST/PUT/DELETE /subjects` | |
| Année scolaire | `GET/POST/PUT/DELETE /academic-years` | |
| Calendrier | `PUT /schools/:id/calendar` | |

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Dashboard Admin | `pages/admin/Dashboard.tsx` | KPIs + alertes + calendrier dynamique |
| Gestion utilisateurs | `pages/admin/Users.tsx` | CRUD + import CSV + export |
| Gestion classes | `pages/admin/Classes.tsx` | CRUD + sous-groupes TP |
| Gestion matières | `pages/admin/Subjects.tsx` | CRUD + coefficients |
| Paramètres école | `pages/admin/Settings.tsx` | Config complète |

---

### BLOC 2 — Présences (élèves + enseignants) ⬜

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Enregistrer présences élèves | `RecordStudentAttendanceUseCase.ts` | MORNING/AFTERNOON + subgroupId optionnel |
| Justifier une absence | `JustifyAbsenceUseCase.ts` | Justification + document joint |
| Statistiques présences | `GetAttendanceStatsUseCase.ts` | |
| Notification parent auto | Inngest job `notify-parent-on-absence` | |
| Démarrer un cours (enseignant) | `StartTeacherLessonUseCase.ts` | Crée `TeacherAttendanceLog` avec horodatage |
| Terminer un cours (enseignant) | `EndTeacherLessonUseCase.ts` | Durée effective enregistrée |
| Rapport hebdomadaire présence enseignants | `GetTeacherAttendanceReportUseCase.ts` | Pour SG |

**Infrastructure — Routes**

| Tâche | Route | Détail |
|-------|-------|--------|
| Présences élèves | `POST /attendance` | |
| Récupérer présences | `GET /attendance` | |
| Justifier absence | `PATCH /attendance/:id` | |
| Démarrer cours | `POST /teacher-attendance/start` | |
| Terminer cours | `POST /teacher-attendance/end` | |
| Rapport présences enseignants | `GET /teacher-attendance/report` | |

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Interface prise présences élèves | `pages/teacher/Attendance.tsx` | Liste + P/A/R + compteur |
| Interface journal présence enseignant | `pages/teacher/TeacherAttendance.tsx` | Bouton démarrer/terminer cours |
| Vue consolidation SG | `pages/staff/Attendance.tsx` | Présences élèves + journal enseignants |
| Rapport hebdo absences enseignants | `pages/staff/TeacherAttendanceReport.tsx` | |
| Tableau de bord absences Admin | `pages/admin/Absences.tsx` | Stats élèves + enseignants |
| Indicateur hors ligne | composant partagé | Bannière + données en attente |

---

### BLOC 3 — Notes ⬜

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Saisir une note | `CreateGradeUseCase.ts` | Vérifier enseignant assigné |
| Modifier une note | `UpdateGradeUseCase.ts` | Uniquement si statut DRAFT |
| Soumettre pour validation | `SubmitGradeUseCase.ts` | DRAFT → SUBMITTED |
| Valider une note | `ValidateGradeUseCase.ts` | Censeur uniquement |
| Rejeter une note | `RejectGradeUseCase.ts` | Censeur + motif |
| Valider en bloc | `BulkValidateGradesUseCase.ts` | |
| Calcul moyennes | `ComputeAveragesUseCase.ts` | Selon GradeFormula |
| Relance 48h/72h | Inngest jobs | |

**Infrastructure — Routes**

| Tâche | Route | Détail |
|-------|-------|--------|
| Saisir/modifier note | `POST/PUT /grades` | |
| Soumettre | `POST /grades/:id/submit` | |
| Valider/rejeter | `POST /grades/:id/validate` | |
| Valider en bloc | `POST /grades/bulk-validate` | |

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Interface saisie notes enseignant | `pages/teacher/Grades.tsx` | Par matière + séquence + code couleur |
| Vue statut note | dans `Grades.tsx` | DRAFT/SUBMITTED/VALIDATED/REJECTED |
| Vue Censeur : soumissions en attente | `pages/staff/GradeValidation.tsx` | |
| Vue Admin : tableau statut notes | `pages/admin/GradeStatus.tsx` | |

---

### BLOC 4 — Bulletins ⬜

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Vérification pré-génération | `CheckBulletinReadinessUseCase.ts` | Toutes notes VALIDATED ? |
| Générer bulletins | `GenerateReportCardsUseCase.ts` | Calculs + création ReportCard |
| Générer PDF individuel | `GenerateReportCardPdfUseCase.ts` | PDFKit — 6 templates |
| Export PDF masse | `ExportClassReportCardsUseCase.ts` | ZIP |
| Envoyer aux parents | `SendReportCardToParentsUseCase.ts` | Email avec PDF joint |

**Fonctions de génération PDF — une par template :**
```
domain/reportCards/
  generateFrSecondaryBulletin.ts
  generateEnSecondaryBulletin.ts
  generateTechnicalBulletin.ts
  generatePrimaryBulletin.ts
  generateAnnualBulletin.ts
  generateMonthlyBulletin.ts
```

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Tableau de bord génération | `pages/admin/ReportCards.tsx` | Statut par classe + boutons |
| Vue parent | `pages/parent/ReportCards.tsx` | Consultation + téléchargement |
| Vue élève | `pages/student/ReportCards.tsx` | Idem |

---

### BLOC 5 — Emploi du Temps (mode manuel) ⬜

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Créer EDT | `CreateTimetableUseCase.ts` | |
| Ajouter créneau | `AddTimetableSlotUseCase.ts` | Détection conflits incluse |
| Publier EDT | `PublishTimetableUseCase.ts` | |
| Demande de rattrapage | `CreateCatchupRequestUseCase.ts` | |

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Interface création EDT | `pages/staff/Timetable.tsx` | Grille drag & drop + conflits en rouge |
| Vue hebdomadaire enseignant | `pages/teacher/MyTimetable.tsx` | Lecture seule |

---

### BLOC 6 — Conseil de Classe & Fin d'Année ⬜

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Créer session conseil | `CreateClassCouncilUseCase.ts` | Vérifier notes VALIDATED |
| Saisir décision par élève | `RecordCouncilDecisionUseCase.ts` | PASS/REPEAT/DELIBERATION |
| Verrouiller session | `LockClassCouncilUseCase.ts` | |
| Générer rapport officiel | `GenerateCouncilReportUseCase.ts` | Canevas MINESEC |
| Vérification pré-clôture | `PreCloseYearCheckUseCase.ts` | |
| Clôturer l'année | `CloseAcademicYearUseCase.ts` | Archivage + promotions |

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Interface conseil de classe | `pages/staff/ClassCouncil.tsx` | Saisie décisions par élève |
| Interface fin d'année | `pages/admin/YearEnd.tsx` | Workflow clôture + checklist |

---

**Validation Phase 2 :**
- [ ] Cycle complet : créer élève → prendre présences → saisir notes → valider → générer bulletin → envoyer parent
- [ ] Test journal présence enseignant : démarrer/terminer → rapport SG
- [ ] Test imports CSV
- [ ] Test génération des 6 templates de bulletins
- [ ] Test conseil de classe → fin d'année → promotion automatique
- [ ] Test vérifications métier (notes non validées → bulletin bloqué)
- [ ] Test calendrier dynamique : avancement automatique au jour suivant

---

## PHASE 3 — Finance & Communication [RÉEL: 🟡 PARTIEL — Bloc 1 (Finance/Mobile Money + transparence APEE) ✅ FAIT en totalité (Juillet 2026). Bloc 2 : messagerie ⏸️ REPORTÉE à une prochaine version (voir MODULE 10) mais notifications multi-canal (push + cloche IN_APP) ✅ FAIT, construites Juillet 2026 — distinctes de la messagerie, ne pas les confondre.]
**Durée estimée :** Août–Septembre 2026

---

### BLOC 1 — Finance, Mobile Money & Transparence APEE ⬜ [RÉEL: ✅ FAIT en totalité — Finance/Mobile Money (webhook Campay réel confirmé) et Transparence APEE (Juillet 2026, voir MODULE 7/11)]

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Plans de frais | `FeePlan/CreateFeePlanUseCase.ts` etc. | |
| Générer factures | `GenerateInvoiceUseCase.ts` | |
| Initier paiement Mobile Money | `InitiatePaymentUseCase.ts` | Via Campay |
| Webhook paiement | `HandlePaymentWebhookUseCase.ts` | |
| Gestion cautions | `Caution/CollectCautionUseCase.ts` etc. | |
| Créer transaction APEE | `CreateAPEETransactionUseCase.ts` | Collecte ou dépense |
| Valider dépense APEE | `ValidateAPEEExpenseUseCase.ts` | Justificatif obligatoire |
| Rapport APEE | `GenerateAPEEReportUseCase.ts` | PDF exportable |
| Relances automatiques | Inngest jobs J-7/J-3/J-0/J+3 | |

**Infrastructure — Routes**

| Tâche | Route | Détail |
|-------|-------|--------|
| Plans de frais | `GET/POST/PUT/DELETE /fee-plans` | |
| Factures | `POST /invoices` + `/bulk` | |
| Paiement | `POST /payments/initiate` + `/webhook` | |
| APEE Transactions | `POST /apee/transactions` | |
| APEE Rapport | `GET /apee/report` | |
| Cautions | Routes dédiées | |

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Dashboard Intendant | `pages/staff/Finance.tsx` | Vue globale + plans + cautions + APEE |
| Transparence APEE Intendant | `pages/staff/APEETransparency.tsx` | Saisie dépenses + upload justificatif |
| Transparence APEE Parent | `pages/parent/APEETransparency.tsx` | Lecture seule |
| Vue parent paiements | `pages/parent/Payments.tsx` | Statuts + paiement MTN/Orange |

---

### BLOC 2 — Messagerie bidirectionnelle & Notifications ⬜ [RÉEL: ⏸️ MESSAGERIE (conversations, modération) REPORTÉE — décision produit, voir MODULE 10. Le centre de notifications ci-dessous N'EST PAS reporté : Push (Web Push/VAPID) et cloche IN_APP avec historique/marquer comme lu sont ✅ FAIT (Juillet 2026), en plus des notifications SMS/Email à sens unique déjà construites — pas besoin de refaire ce sous-bloc "notifications", seule la partie "conversations" reste à zéro.]

**Application — Use Cases**

| Tâche | Use Case | Détail |
|-------|---------|--------|
| Créer conversation | `CreateConversationUseCase.ts` | PRIVATE/CLASS/PARENT |
| Envoyer message | `SendMessageUseCase.ts` | Avec fichiers joints |
| Justifier absence depuis notif | `JustifyAbsenceFromNotificationUseCase.ts` | Parent répond à une notif absence |
| Modération | `ModerateMessageUseCase.ts` | ⏸️ reporté avec le reste de la messagerie |
| Push notification | ✅ FAIT — Web Push/VAPID (pas FCM), `SouscrirePushUseCase`/`DesinscrirePushUseCase` | |
| SMS | Via gateway Techsoft | ✅ FAIT (`SmsNotificationService.ts`) |

**Socket.io**
- Connexion authentifiée (token dans le handshake)
- Rooms par school + par class + par conversation
- Events : `new_message` · `message_moderated` · `notification` · `attendance_updated` · `absence_justified`

**Frontend**

| Tâche | Page | Détail |
|-------|------|--------|
| Interface messagerie | `pages/messaging/` | ⏸️ reportée avec le reste de la messagerie |
| Réponse justification absence | dans `pages/parent/` | ⏸️ reportée (dépend de la messagerie) |
| Centre de notifications | ✅ FAIT — `components/NotificationBell.tsx` | Historique + badge + marquer comme lu ; tri par priorité non fait |
| Vue modération | `pages/staff/Moderation.tsx` | ⏸️ reportée avec le reste de la messagerie |

---

**Validation Phase 3 :**
- [ ] Test paiement MTN MoMo end-to-end (sandbox Campay)
- [ ] Test APEE : dépense sans justificatif → blocage système
- [ ] Test caution : collecte → remboursement
- [ ] Test messagerie temps réel (Socket.io)
- [ ] Test justification absence bidirectionnelle parent
- [ ] Test notifications SMS (gateway sandbox)

---

## PHASE 4 — IA & PWA [RÉEL: 🟡 PARTIEL, en avance sur son calendrier prévu (Oct-Déc 2026) — indice de santé élève ✅, génération EDT IA ✅ (via Groq) et commentaires bulletins IA ✅ (Juillet 2026, voir "Ce qui est vraiment fait et solide" plus haut) sont déjà construits alors que cette phase n'est même pas censée avoir commencé. **BLOC 2 (PWA) essentiellement FAIT** (Juillet 2026, voir "Ce qui existe partiellement" plus haut) : Service Worker + manifest + `useSyncQueue`/`useCachedFetch` étendus à la quasi-totalité des écrans. Reste dans ce bloc : mode SMS de secours (parser `PRES#6eA#...`), non commencé. BLOC 1 restant : chatbot d'aide contextuel — non construit.]
**Durée estimée :** Octobre–Décembre 2026

---

### BLOC 1 — Intelligence Artificielle ⬜

| Tâche | Use Case / Job | Détail |
|-------|---------|--------|
| Calcul indice santé scolaire élève | Inngest job quotidien `compute-student-health-score` | 5 composantes pondérées |
| Calcul indice santé établissement | Inngest job quotidien `compute-school-health-score` | 5 composantes pour MasterUser + DDES |
| Dashboard IA enseignant | `pages/teacher/AIInsights.tsx` | Liste élèves classés par niveau d'alerte |
| Alertes automatiques | Selon niveau → SMS/push/recommandation | |
| Détection risque d'échec | `DetectAtRiskStudentsUseCase.ts` | |
| Détection progressions | `DetectProgressionsUseCase.ts` | Hausse ≥ 2 pts → alerte positive |
| Génération EDT IA | Gemini + Inngest | Contraintes complètes + statut temps réel |
| Commentaires bulletins IA ✅ | `ReportCardController.genererCommentaireIA` | Par élève via Groq (pas Gemini) — modifiable ensuite par le PP |
| Centre d'aide IA | Chatbot contextuel | |

---

### BLOC 2 — Mode Hors Ligne (PWA) ⬜

| Tâche | Détail |
|-------|--------|
| Setup vite-plugin-pwa | Service Worker + manifeste |
| IndexedDB Dexie.js | Présences élèves · notes · listes élèves · EDT · journal présence enseignant |
| File d'attente sync `OfflineQueue` | Synchronisation automatique au retour |
| Gestion conflits | last-write-wins sauf notes validées |
| Rapport sync | Accepté / rejeté + motif |
| Bannière hors ligne | Indicateur + compteur données en attente |
| Mode SMS | Parser `PRES#6eA#...` → DB |

---

**Validation Phase 4 :**
- [ ] Test indice santé scolaire (calcul correct sur toutes composantes)
- [ ] Test indice santé établissement
- [ ] Test alertes IA (seuils configurés + déclenchement correct)
- [ ] Test génération EDT IA (toutes contraintes respectées)
- [ ] Test hors ligne : saisie présences + notes + journal enseignant sans connexion
- [ ] Test sync au retour du réseau
- [ ] Test blocage modification note validée en hors ligne

---

## PHASE 5 — Features Avancées [RÉEL: 🟡 PARTIEL — Matricule Unique Numérique ✅ FAIT et déjà en avance (voir MODULE 20), Groupe Scolaire et DDES/DRES ⬜ toujours pas commencés]
**Durée estimée :** T1 2027

| Tâche | Détail | [RÉEL] |
|-------|--------|--------|
| Module Groupe Scolaire | `SchoolGroup` + dashboard consolidé + plan Établissement+ | ⬜ PAS FAIT |
| Accès DDES/DRES | Espace lecture seule + réception rapports officiels | ⬜ PAS FAIT |
| Matricule Unique Numérique | `studentNationalId` + vérification transferts + détection doublons | ✅ FAIT (en avance) |
| App mobile native Flutter | Android priorité · iOS secondaire |
| API publique RESTful | Documentation OpenAPI complète |
| Webhooks | Pour intégrations tierces |
| Intégration OBC | Résultats BAC |
| Intégration GCE Board | Résultats A-Level |
| Intégration cartescolaire.cm | Matricule unique national MINESEC |
| Détection conflits vacataires inter-établissements | Dans le contexte Groupe Scolaire |

---

## PHASE 6 — Workflow Entrée en 6e & Banque d'Épreuves [RÉEL: 🟡 PARTIEL — Entrée en 6e ✅ FAIT et déjà en avance (voir MODULE 23). Banque d'Épreuves : ⏸️ REPORTÉE à une prochaine version (décision produit) — ne plus la considérer comme faisant partie de cette phase pour l'instant.]
**Durée estimée :** T2 2027

| Tâche | Détail | [RÉEL] |
|-------|--------|--------|
| Portail inscription Entrée en 6e | Dossier numérique candidat | ✅ FAIT |
| Saisie + import résultats concours | Par l'Admin du lycée/collège | ✅ FAIT |
| Croisement automatique CEPE + concours | Détection admis avec les deux conditions | ✅ FAIT (`EnregistrerResultatCepUseCase`) |
| Publication liste des admis | Portail établissement | 🟡 non vérifié précisément |
| Workflow `PRE_ENROLLED` → inscrit | Assignation classe + création compte | 🟡 pré-remplissage confirmé, validation humaine requise (pas d'auto-assignation aveugle) |
| Lien historique primaire → secondaire | Via matricule ou saisie manuelle | 🟡 probable vu le module Matricule, non vérifié précisément |
| Module Banque d'Épreuves | Upload · filtres · accès conditionnel par classe · téléchargement PDF | ⏸️ REPORTÉ à une prochaine version |

---

## PHASE 7 — Scale & Répétiteurs [⏸️ Module Répétiteurs REPORTÉ à une prochaine version — décision produit, Juillet 2026] [RÉEL: ⬜ PAS COMMENCÉ]
**Durée estimée :** T3–T4 2027

| Tâche | Détail | [RÉEL] |
|-------|--------|--------|
| Module Répétiteurs | Profils · mise en relation · messagerie · commission | ⏸️ REPORTÉ à une prochaine version |
| Expansion Afrique centrale | Congo · Gabon · Côte d'Ivoire | ⬜ pas commencé |
| Partenariats éditeurs manuels numériques | | ⬜ pas commencé |
| Partenariats apps de tutorat camerounaises | | ⬜ pas commencé |

---

# PARTIE VI — LES LOIS DU ROYAUME (règles métier MINESEC)

## Verrous absolus — ne jamais contourner dans le code

### Loi 1 — Exclusion élève (Art. 30 + Réf. Titulaire Août 2024)
```
SEUL role === "ADMIN" peut créer un DisciplineRecord
avec type TEMP_EXCLUSION ou PERMANENT_EXCLUSION.

Code : vérification dans le Use Case AVANT tout insert.
Si violation → 403 + message : "Seul le Chef d'Établissement peut prononcer une exclusion (Art. 30)"
```

### Loi 2 — Séparation Ordonnateur/Comptable (Art. 34 et 39)
```
Le Proviseur ordonne les dépenses.
L'Intendant les exécute.
Ces deux actions ne peuvent JAMAIS être faites par la même personne.

Code : ordre.ordonnateurId !== executant.userId lors de l'exécution.
```

### Loi 3 — Contributions exigibles (Art. 48)
```
Aucune facturation supérieure aux seuils légaux MINESEC.

Code : vérifier le seuil légal avant tout insert de facture.
Si dépassement → blocage + signalement dans le journal d'audit + alerte Admin.
```

### Loi 4 — Bulletin sans notes validées
```
Si une seule note de la classe est en DRAFT ou SUBMITTED
→ génération de bulletin bloquée pour TOUTE la classe.
→ Afficher la liste des matières/enseignants concernés.
```

### Loi 5 — Conseil sans notes validées
```
Si une seule note de la classe n'est pas VALIDATED
→ création de ClassCouncilSession bloquée.
```

### Loi 6 — Note validée non modifiable hors ligne
```
À la synchronisation : si Grade.validationStatus === "VALIDATED"
et que l'offline queue contient une modification de cette note
→ modification rejetée + alerte enseignant + notification Admin.
```

### Loi 7 — Volume horaire AP (Circulaire 32/09/MINESEC/IGE)
```
Si TimetableSlot.teacher = AP et total slots AP ≥ 15h/semaine
→ blocage de l'ajout du créneau + message clair.
```

### Loi 8 — Dépense APEE sans justificatif (nouvelle loi V2)
```
Aucune APEETransaction de type EXPENSE ne peut passer
en statut VALIDATED sans au moins un justificatif joint (document URL non nul).

Code : vérification dans ValidateAPEEExpenseUseCase.ts avant tout update.
Si violation → 400 + message : "Un justificatif est obligatoire pour toute dépense APEE"
```

### Loi 9 — Convocation Conseil de Discipline (Art. 30)
```
La convocation des parents doit être enregistrée minimum 72h
avant la date du Conseil de Discipline.

Code : disciplineCouncil.parentNotifiedAt + 72h <= disciplineCouncil.scheduledAt
Si violation → blocage + message clair.
```

---

## Alertes automatiques obligatoires

### Alerte 1 — Règle des 8 jours AP
```
Date rapport CE + 8 jours = date limite transmission DDES.
Inngest job quotidien :
  J-3 : alerte orange à l'AP
  J-1 : alerte rouge à l'AP
  J+0 : blocage soumission nouveaux projets pédagogiques
  J+3 : signalement Chef établissement + DDES
```

### Alerte 2 — Notes non validées par le Censeur
```
Note SUBMITTED depuis 48h → relance Censeur
Note SUBMITTED depuis 72h → notification Admin
Via Inngest job récurrent.
```

### Alerte 3 — Absence élève
```
Défaut : 3 absences non justifiées → notification PP + parent
5 absences consécutives → alerte SG
Seuil configurable dans SchoolConfig.absenceAlertThreshold
```

### Alerte 4 — CE insuffisant
```
Si nombre de CE tenus < 2 pour un trimestre terminé
→ alerte Proviseur pour chaque discipline concernée
```

### Alerte 5 — Absentéisme enseignant (nouvelle alerte V2)
```
Si un enseignant n'a pas signé de journal de présence pour 3 cours consécutifs
→ alerte SG le jour même
Si un enseignant totalise > seuil de cours non assurés dans le trimestre
→ alerte Proviseur + signalement possible DDES
Seuil configurable dans SchoolConfig.teacherAbsenceAlertThreshold
```

### Alerte 6 — Présences non renseignées (nouvelle alerte V2)
```
Job quotidien à 18h :
Si un cours de l'EDT du jour n'a pas de feuille de présence élèves renseignée
→ notification Push + SMS à l'enseignant concerné
→ Si toujours absent à 21h → alerte SG
```

---

## Règles de calcul

### Calcul moyenne FR
```
Formule par défaut : Grade.score (weight=100) → moy matière = score
Formule alternative : (CC × %CC + DS × %DS) / 100
Formule 3 notes : (DS1 + DS2 + Compo×2) / 4
→ Configurable via GradeFormula.formula

Moyenne générale = Σ(moy_matière × coefficient) / Σ(coefficients)
Rang = tri décroissant par moyenne générale (départage par matière principale)
```

### Calcul passage/redoublement
```
≥ 10.00 → Passe (règle générale)
9.00 à 9.99 → Délibération (décision collégiale Conseil de Classe)
< 9.00 → Redouble
Exception primaire : l'instituteur a pouvoir discrétionnaire final
  → EduNexus ALERTE si NA mais ne bloque jamais la promotion
```

---

# PARTIE VII — L'ARCHITECTURE HEXAGONALE

> **[RÉEL] Note d'état :** cette partie décrit la structure *cible*. La structure **réelle** de `backend/src/` est proche mais pas identique :
> ```
> backend/src/
> ├── domain/            (entities, ports, rules, value-objects, constants, types)
> ├── application/        (dossiers par domaine métier, ex: grade/, attendance/, finance/, matricule/, entranceExam/, hr/, orientation/, ai/, assistant/, messaging/ — chacun avec ses *UseCase.ts directement dedans, pas de sous-dossier usecases/)
> ├── infrastructure/     (config, http, inngest, pdf, persistence, seed, services, socket, statisticalCampaign)
> ├── middleware/
> ├── inngest/
> ├── socket/
> └── server.ts
> ```
> Le principe ports/adapters est globalement respecté (le domaine ne dépend pas directement de Prisma/Express), mais l'arborescence détaillée ci-dessous (`interfaces/http/controllers`, `application/usecases/<domaine>/`, `container.ts`) est une simplification illustrative plus qu'un plan exact à suivre au caractère près. Utiliser cette partie pour le *principe*, pas comme une checklist de chemins de fichiers à créer.

## Principe général

EduNexus est développé en **architecture hexagonale** (Ports & Adapters) dès le départ. Cette architecture garantit que la logique métier (domaine) est complètement indépendante des détails techniques (base de données, framework, API externe).

```
Le domaine ne connaît pas Prisma.
Le domaine ne connaît pas Express.
Le domaine ne connaît pas Campay.
Le domaine ne connaît pas Google Gemini.
```

La logique métier peut être testée sans démarrer le serveur, sans base de données, sans aucune dépendance externe.

---

## Structure des dossiers

```
src/
├── domain/                          # Cœur métier — aucune dépendance externe
│   ├── entities/                    # Entités métier
│   │   ├── School.ts
│   │   ├── User.ts
│   │   ├── Student.ts
│   │   ├── Grade.ts
│   │   ├── Attendance.ts
│   │   ├── TeacherAttendanceLog.ts
│   │   ├── APEETransaction.ts
│   │   └── ...
│   ├── repositories/                # Interfaces (ports) — jamais d'implémentation ici
│   │   ├── IUserRepository.ts
│   │   ├── ISchoolRepository.ts
│   │   ├── IGradeRepository.ts
│   │   ├── IAttendanceRepository.ts
│   │   ├── ITeacherAttendanceRepository.ts
│   │   ├── IAPEERepository.ts
│   │   └── ...
│   ├── services/                    # Interfaces des services externes (ports sortants)
│   │   ├── IEmailService.ts
│   │   ├── ISmsService.ts
│   │   ├── IPaymentService.ts
│   │   ├── IAIService.ts
│   │   └── IStorageService.ts
│   └── validators/                  # Validateurs métier purs
│       ├── classSerieValidator.ts
│       ├── gradeValidator.ts
│       └── apeeValidator.ts
│
├── application/                     # Use Cases — orchestrent le domaine
│   └── usecases/
│       ├── auth/
│       │   ├── LoginUseCase.ts
│       │   ├── LogoutUseCase.ts
│       │   └── RefreshTokenUseCase.ts
│       ├── masterAdmin/
│       │   ├── InviteSchoolUseCase.ts
│       │   ├── ApproveSchoolUseCase.ts
│       │   └── ...
│       ├── onboarding/
│       │   ├── VerifyInviteTokenUseCase.ts
│       │   ├── JoinSchoolUseCase.ts
│       │   └── ...
│       ├── attendance/
│       │   ├── RecordStudentAttendanceUseCase.ts
│       │   ├── StartTeacherLessonUseCase.ts
│       │   ├── EndTeacherLessonUseCase.ts
│       │   └── GetTeacherAttendanceReportUseCase.ts
│       ├── grades/
│       │   ├── CreateGradeUseCase.ts
│       │   ├── ValidateGradeUseCase.ts
│       │   └── ...
│       ├── finance/
│       │   ├── InitiatePaymentUseCase.ts
│       │   ├── CreateAPEETransactionUseCase.ts
│       │   ├── ValidateAPEEExpenseUseCase.ts
│       │   └── GenerateAPEEReportUseCase.ts
│       ├── reportCards/
│       │   ├── GenerateReportCardsUseCase.ts
│       │   └── GenerateReportCardPdfUseCase.ts
│       └── ...
│
├── infrastructure/                  # Adapters — implémentations concrètes
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── PrismaUserRepository.ts         # Implémente IUserRepository
│   │   │   ├── PrismaGradeRepository.ts        # Implémente IGradeRepository
│   │   │   ├── PrismaAttendanceRepository.ts   # ...
│   │   │   └── ...
│   │   └── schema.prisma                       # Schema Prisma (inchangé)
│   ├── auth/
│   │   ├── generateToken.ts
│   │   └── masterToken.ts
│   ├── email/
│   │   └── ResendEmailService.ts               # Implémente IEmailService
│   ├── sms/
│   │   └── TechsoftSmsService.ts               # Implémente ISmsService
│   ├── payment/
│   │   └── CampayPaymentService.ts             # Implémente IPaymentService
│   ├── ai/
│   │   └── GeminiAIService.ts                  # Implémente IAIService
│   ├── storage/
│   │   └── LocalStorageService.ts              # Implémente IStorageService
│   └── jobs/
│       └── inngest/
│           ├── daily-calendar-advance.ts
│           ├── notify-parent-on-absence.ts
│           ├── compute-student-health-score.ts
│           ├── grade-validation-reminders.ts
│           └── ...
│
├── interfaces/                      # Points d'entrée — HTTP, Socket.io
│   └── http/
│       ├── controllers/             # Minimalistes — reçoivent la requête, appellent le Use Case
│       │   ├── AuthController.ts
│       │   ├── GradeController.ts
│       │   ├── AttendanceController.ts
│       │   ├── FinanceController.ts
│       │   └── ...
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── grades.routes.ts
│       │   ├── attendance.routes.ts
│       │   └── ...
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── authMultiTenant.ts
│       │   ├── requirePermission.ts
│       │   └── masterSensitiveAuth.ts
│       └── validators/              # Validation des inputs HTTP (Zod)
│           ├── gradeSchema.ts
│           └── ...
│
└── container.ts                     # Injection de dépendances — assemble tout
```

---

## Règle de flux — la flèche ne va que dans un sens

```
interfaces/ → application/ → domain/
                         ↑
            infrastructure/ (injecté via container.ts)
```

- Un controller ne connaît pas Prisma
- Un Use Case ne connaît pas Express
- Une entité de domaine ne connaît pas les DTOs HTTP
- L'infrastructure implémente les interfaces du domaine

---

## Exemple concret : Valider une note

```typescript
// 1. DOMAIN — Entité + Port
// domain/entities/Grade.ts
export class Grade {
  constructor(
    public readonly id: string,
    public score: number,
    public status: 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED'
  ) {}

  validate(): Grade {
    if (this.status !== 'SUBMITTED') {
      throw new Error('Only SUBMITTED grades can be validated');
    }
    return new Grade(this.id, this.score, 'VALIDATED');
  }
}

// domain/repositories/IGradeRepository.ts
export interface IGradeRepository {
  findById(id: string, schoolId: string): Promise<Grade | null>;
  save(grade: Grade): Promise<Grade>;
}

// 2. APPLICATION — Use Case
// application/usecases/grades/ValidateGradeUseCase.ts
export class ValidateGradeUseCase {
  constructor(private gradeRepo: IGradeRepository) {}

  async execute(gradeId: string, schoolId: string): Promise<Grade> {
    const grade = await this.gradeRepo.findById(gradeId, schoolId);
    if (!grade) throw new NotFoundError('Grade not found');
    const validated = grade.validate(); // logique dans l'entité
    return this.gradeRepo.save(validated);
  }
}

// 3. INFRASTRUCTURE — Adapter Prisma
// infrastructure/database/prisma/PrismaGradeRepository.ts
export class PrismaGradeRepository implements IGradeRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, schoolId: string): Promise<Grade | null> {
    const raw = await this.prisma.grade.findFirst({ where: { id, schoolId } });
    if (!raw) return null;
    return new Grade(raw.id, raw.score, raw.validationStatus);
  }

  async save(grade: Grade): Promise<Grade> {
    const raw = await this.prisma.grade.update({
      where: { id: grade.id },
      data: { validationStatus: grade.status }
    });
    return new Grade(raw.id, raw.score, raw.validationStatus);
  }
}

// 4. INTERFACE — Controller minimaliste
// interfaces/http/controllers/GradeController.ts
export class GradeController {
  constructor(private validateGradeUseCase: ValidateGradeUseCase) {}

  async validate(req: AuthenticatedRequest, res: Response) {
    const grade = await this.validateGradeUseCase.execute(
      req.params.id,
      req.user.schoolId
    );
    res.json({ success: true, grade });
  }
}

// 5. CONTAINER — Assemblage
// container.ts
const prismaGradeRepo = new PrismaGradeRepository(prisma);
const validateGradeUseCase = new ValidateGradeUseCase(prismaGradeRepo);
export const gradeController = new GradeController(validateGradeUseCase);
```

---

## Convention de nommage

| Couche | Suffixe | Exemple |
|--------|---------|---------|
| Entité domaine | (aucun) | `Grade.ts`, `School.ts` |
| Port sortant (repo) | `IXxxRepository` | `IGradeRepository.ts` |
| Port sortant (service) | `IXxxService` | `IEmailService.ts` |
| Use Case | `XxxUseCase` | `ValidateGradeUseCase.ts` |
| Adapter Prisma | `PrismaXxxRepository` | `PrismaGradeRepository.ts` |
| Adapter service | `XxxService` (provider) | `ResendEmailService.ts` |
| Controller HTTP | `XxxController` | `GradeController.ts` |

---

# PARTIE VIII — PLANS, STACK & COMMANDES

## SECTION G — PLANS D'ABONNEMENT

| Plan | Prix | Élèves | Ce qui est inclus |
|------|------|--------|------------------|
| Découverte | Gratuit 3 mois | ≤ 100 | Notes · Présences · Bulletins de base |
| Standard | 15 000 FCFA/mois | ≤ 500 | + Finance · Mobile Money · Communication · Bulletins avancés · Transparence APEE |
| Premium | 35 000 FCFA/mois | Illimité | + IA complète · Mode hors ligne · Rapports mensuels auto · Messagerie avancée · Journal présence enseignant · Accès DDES |
| Établissement+ | Sur devis | Réseau | Multi-établissements sous direction unique · Dashboard consolidé fondateur |

**Revenus complémentaires**
- Commission 0.5-1% sur transactions Mobile Money
- Module SMS vendu à l'usage (par tranche de 100 SMS)
- Formation et accompagnement onboarding
- Personnalisation avancée (logo, couleurs, domaine propre)
- Commission sur mises en relation répétiteurs (Phase 7)

---

## SECTION H — STACK TECHNIQUE

> **[RÉEL] Correction :** le frontend a pivoté vers **Next.js (App Router)** — pas Vite + React Router comme écrit ci-dessous. Chemins réels : `frontend/src/app/{admin,teacher,staff,student,parent,master}/dashboard/...`, pas `pages/`. L'IA utilise **`@ai-sdk/groq` ET `@ai-sdk/google`** (Groq confirmé utilisé pour le copilot assistant, l'analyse de diplôme RH, et la génération d'EDT — pas seulement en "backup" comme indiqué plus bas). Le reste de la stack backend (Bun/Express/Prisma/Redis/Inngest/Socket.io/Campay) est confirmé exact.

```
BACKEND
  Runtime     : Bun
  Framework   : Express.js + TypeScript (strict)
  Architecture: Hexagonale (Ports & Adapters)
  ORM         : Prisma → PostgreSQL 15+
  Auth        : JWT (httpOnly cookies) + bcryptjs + otplib
  Cache       : Redis
  Jobs async  : Inngest
  Temps réel  : Socket.io
  Email       : Resend / NodeMailer
  PDF         : PDFKit
  Validation  : Zod (couche interfaces HTTP uniquement)
  Sécurité    : Helmet + express-rate-limit
  Tests       : Bun test (use cases testables sans DB)

FRONTEND
  Framework   : Next.js (App Router) + React 19 + TypeScript  [RÉEL — pivot depuis Vite]
  Routing     : Next.js App Router (frontend/src/app/...)     [RÉEL — pas React Router]
  Styles      : TailwindCSS + tokens CSS (var(--green), var(--sidebar)...) + icônes lucide-react
  HTTP        : fetch/axios avec cookies httpOnly
  Temps réel  : Socket.io-client (infrastructure présente, chat non branché — voir MODULE 10)
  i18n        : dictionnaires JSON fr/en maison (frontend/src/locales/)
  PWA         : [RÉEL] non confirmé — pas de vite-plugin-pwa, pas de config PWA Next.js trouvée
  Offline DB  : [RÉEL] queue de sync maison (`useSyncQueue`, `lib/offline/db.ts`) — pas confirmé être Dexie.js précisément
  PDF         : PDFKit côté serveur (bulletins) — visualisation PDF côté client non vérifiée
  Design      : "Warm African" — cream #f7f3ee · forest green #1a2e1e
                accent #059669 · Nunito + Spectral

PAIEMENT
  MTN MoMo    : Campay API (partenaire officiel MINESEC depuis 2018)
  Orange Money: Campay API
  Express Union: API directe

SMS
  Cameroun    : Techsoft API (ou gateway local équivalent)
  Fallback    : Twilio

IA
  LLM         : Google Gemini via AI SDK
  Jobs        : Inngest (traitement asynchrone)
  Backup      : Groq (inférence rapide pour features temps réel)

INFRASTRUCTURE
  Hébergement : Cameroun (Camtel/CIPRE) ou AWS Africa Cape Town
  CDN         : Accélération contenu statique
  SSL         : Let's Encrypt
  Backup      : Quotidien chiffré + hors site
  CI/CD       : GitHub Actions
```

---

## SECTION I — COMMANDES UTILES

```bash
# Développement
bun run dev                                           # Démarrer le serveur
bun run build                                         # Build production

# Prisma
bunx prisma generate                                  # Régénérer le client Prisma
bunx prisma migrate dev --name <nom_descriptif>       # Créer et appliquer une migration
bunx prisma migrate deploy                            # Appliquer migrations en production
bunx prisma db seed                                   # Seeder la base de données
bunx prisma studio                                    # Interface visuelle DB
bunx prisma validate                                  # Valider le schema

# TypeScript
bunx tsc --noEmit                                     # Vérifier TypeScript sans compiler

# Tests
bun test                                              # Tous les tests
bun test src/application/usecases/grades              # Tests use cases notes
bun test src/application/usecases/finance             # Tests use cases finance
bun test src/domain                                   # Tests domaine (sans DB)

# Utilitaires
bunx prisma db push                                   # Push schema sans migration (dev uniquement)
```

---

## SECTION J — POSITIONNEMENT STRATÉGIQUE

### La proposition de valeur en une phrase

> **EduNexus est la seule plateforme de gestion scolaire camerounaise qui couvre les 17 types d'établissements MINESEC, fonctionne hors ligne, intègre Mobile Money nativement, rend les finances APEE transparentes pour les parents, et fournit en temps réel les données de présence des enseignants que le MINESEC cherche à construire.**

### Les trois angles pour convaincre le MINESEC

**Angle 1 — La transparence financière**
"EduNexus rend traçable chaque franc collecté dans les établissements. Nous résolvons le problème APEE que le ministère combat depuis 2021, avec 16,3 millions de FCFA sortis sans justificatifs dans un seul lycée."

**Angle 2 — Le pilotage du système**
"EduNexus donne aux DDES et DRES des données en temps réel sur la présence des enseignants. En 2026, 3 442 enseignants ont été identifiés hors du territoire — EduNexus aurait détecté leurs absences en temps réel, sans opération biométrique coûteuse."

**Angle 3 — La conformité totale**
"EduNexus est le seul outil construit à partir des textes officiels MINESEC : Décret 2001/041, arrêtés GCE Board, Circulaire 32/09/MINESEC/IGE. Chaque type d'école, chaque règle de notation, chaque template de bulletin."

### Les trois cibles commerciales prioritaires

1. **Les écoles privées de taille moyenne** (200–600 élèves) — elles ont les moyens de payer, elles souffrent des problèmes de gestion documentés, et elles ne sont pas encore équipées ou équipées avec des solutions insatisfaisantes.

2. **Les groupes scolaires** (fondateurs avec plusieurs établissements) — un seul contrat, plusieurs écoles. Effet de levier commercial massif.

3. **Le MINESEC comme partenaire institutionnel** — pas comme client direct au départ, mais comme ambassadeur. Si le MINESEC recommande EduNexus dans ses circulaires (comme il l'a fait pour le paiement Mobile Money), l'adoption s'accélère massivement.

### Tableau récapitulatif "Le Plus"

| Problème réel documenté | Ce que les concurrents proposent | Ce qu'EduNexus apporte en plus |
|---|---|---|
| Opacité financière APEE (16,3M FCFA sans justificatifs) | Rien | Traçabilité complète · justificatif obligatoire · espace parent transparent |
| Absentéisme enseignants (3 442 hors territoire en 2026) | Rien | Journal présence numérique · alertes SG · données DDES temps réel |
| Taux d'échec BAC 37% (2024) | Rien | Détection précoce élèves à risque dès Séquence 2 |
| Rapports DDES chronophages | Rien | Génération en un clic + transmission directe |
| Connectivité erratique (40% du territoire) | Serveur local sans sync auto | PWA + offline Dexie.js + sync automatique au retour |
| 17 types d'établissements | Couverture partielle | Couverture complète avec règles spécifiques par type |
| Communication parents unilatérale | SMS unidirectionnel | Messagerie bidirectionnelle · justification absence en réponse directe |
| Groupes scolaires (fondateur multi-écoles) | Non documenté | Multi-tenant + dashboard consolidé fondateur |
| Contrôle inspecteur | Inexistant | Accès lecture DDES/DRES intégré |
| Matricule unique | Non implémenté | Registre décentralisé · transferts vérifiables |

---

*Document vivant — mis à jour à chaque fin de phase.*
*Dernière mise à jour : Juin 2026 — Version 2 — Refonte complète en architecture hexagonale.*
*Prochaine mise à jour attendue : fin Phase 1 (Juillet 2026)*
*Annotations `[RÉEL: ...]` ajoutées Juillet 2026 (Claude Sonnet 5) — audit de code module par module. Reportés à une prochaine version sur décision produit : Messagerie bidirectionnelle (MODULE 10), Banque d'anciennes épreuves (MODULE 24), Répétiteurs en ligne (MODULE 25). Le contenu original non annoté reste la référence fonctionnelle/métier.*
