# PLAN D'IMPLÉMENTATION COMPLET
## Copilot Unifié ZekoulABia — Savoir, Agir, Comprendre le Contexte
### Dashboard Admin en premier, extension aux autres rôles ensuite

> **Date :** juillet 2026
> **Statut :** chantier de différenciation majeur (phase « Dépasser Logesco ») — aucun concurrent étudié (Logesco, Zukulu Feg, Wacni) n'a de mécanisme comparable
> **Principe fondateur :** un seul assistant, pas plusieurs outils séparés — qui sait répondre à toute question sur le dashboard et l'école (dans la limite des droits du rôle), qui peut agir avec confirmation sur les actions sensibles, qui voit ce qui se passe en direct pendant qu'il agit, et qui connaît en permanence l'écran sur lequel se trouve l'utilisateur — cette conscience d'écran nourrissant à la fois ses réponses ET ses actions.

---

## SOMMAIRE

- Section 0 — Principes directeurs
- Section 1 — État des lieux (analyse de l'existant avant de construire)
- Section 2 — Architecture unifiée cible
- Section 3 — Le mécanisme central : conscience d'écran partagée
- Section 4 — Déploiement par domaine, Dashboard Admin
- Section 5 — Visibilité en direct des actions
- Section 6 — Séquencement et feuille de route au-delà de l'Admin
- Section 7 — Definition of Done globale
- Section 8 — Risques et points de vigilance

---

# SECTION 0 — PRINCIPES DIRECTEURS

1. **Un seul copilot, pas deux systèmes parallèles.** Le copilot exécutant déjà construit pour l'Admin et le système d'aide contextuelle (HelpArticle) conçu juste avant doivent fusionner en un seul point d'entrée. Les fiches HelpArticle restent utiles comme source de vérité pour les questions sur le fonctionnement de l'interface, mais elles sont consultées par le même assistant qui exécute aussi les actions — jamais deux chatbots distincts dans l'app.

2. **La conscience d'écran nourrit tout, pas seulement l'aide.** Le `screenKey` (et progressivement les filtres fins : classe sélectionnée, séquence active, élève affiché) sert à la fois à répondre aux questions ("qu'est-ce que cet écran affiche ?") et à interpréter les commandes d'action ("change sa note à 15" doit se comprendre grâce à l'élève/la classe actuellement affichés, sans que l'utilisateur ait à tout repréciser).

3. **Respect strict et systématique du RBAC existant.** Chaque nouvelle capacité ajoutée au catalogue de l'assistant — qu'il s'agisse de savoir ou d'agir — doit être filtrée par `StaffPermissionRules` exactement comme une action manuelle dans l'interface. Aucune capacité n'est jamais exposée à un rôle qui n'y aurait pas accès normalement.

4. **Jamais d'action sur une supposition.** Si l'assistant n'est pas certain du contexte réel d'une commande (élève ambigu, classe non précisée, donnée manquante), il pose une question de clarification avant d'agir — jamais de devinette exécutée.

5. **Protection des données non négociable.** Toute action destructive ou irréversible reste soumise à confirmation explicite avec résumé clair de ce qui sera perdu, comme déjà établi. Les actions non-destructives restent exécutées directement, avec historique et possibilité d'annulation.

6. **Déploiement par couches, jamais tout d'un coup.** Chaque domaine fonctionnel (Scolarité, Notes, Finance, RH...) est ajouté au catalogue de l'assistant un par un, testé et validé, avant de passer au domaine suivant — même logique que tous les autres chantiers de ce projet.

7. **Réutilisation systématique de l'existant.** Chaque nouvelle capacité de l'assistant s'appuie sur un use case déjà construit dans l'application — l'assistant ne réimplémente jamais de logique métier, il l'invoque.

---

# SECTION 1 — ÉTAT DES LIEUX (ANALYSE PRÉALABLE OBLIGATOIRE)

Avant toute ligne de code sur ce chantier, une phase d'exploration complète du code existant est requise — ne pas supposer, vérifier. Cette phase doit produire un rapport couvrant les points suivants :

## 1.1 Ce qui existe déjà côté copilot exécutant

- Localiser `AssistantController.ts` et le mécanisme de function calling Groq déjà en place
- Lister précisément le catalogue d'actions actuellement exposé (probablement limité : création de classe, assignation d'enseignant)
- Vérifier le mécanisme de confirmation pour les actions destructives, le système d'annulation pour les non-destructives, et `AssistantActionLog`
- Confirmer comment le filtrage RBAC est actuellement appliqué au catalogue d'actions exposé à Groq

## 1.2 Ce qui existe côté aide contextuelle

- Vérifier l'état d'avancement du système `HelpArticle` et de la transmission `screenKey` (tâche précédente — confirmer si déjà livrée ou encore en cours)
- Identifier si un mécanisme de surlignage d'élément UI existe déjà

## 1.3 Inventaire complet des use cases disponibles sur le dashboard Admin

Pour chaque section du dashboard Admin (déjà connues via l'usage : Tableau de bord, Utilisateurs, Classes, Matières, Présences, Notes, Bulletins, Emploi du temps, Conseil de classe, Pédagogie, Ressources Humaines, Année scolaire, Mobile Money/Finance, IA Santé scolaire, Statistiques, Communications), lister :
- Les use cases backend déjà existants et invocables
- Les endpoints déjà exposés
- Ce qui manque un équivalent de lecture (ex. « obtenir la liste des élèves en retard de paiement ») pour que l'assistant puisse répondre à une question sans qu'un use case de consultation dédié existe déjà

## 1.4 Inventaire des routes frontend (pour le screenKey)

Cartographier toutes les routes du dashboard Admin avec leur `screenKey` proposé, sur le modèle déjà entamé pour HelpArticle — cette cartographie sert à la fois à l'aide contextuelle et à l'interprétation des commandes d'action.

## 1.5 Produire un tableau de correspondance avant de coder

| Domaine | Use cases lecture existants | Use cases action existants | Manques identifiés |
|---|---|---|---|
| Scolarité | ... | ... | ... |
| Notes/Bulletins | ... | ... | ... |
| Finance | ... | ... | ... |
| RH | ... | ... | ... |
| ... | | | |

Ce tableau devient la feuille de route réelle de la Section 4 — ne pas construire les phases suivantes avant que ce tableau soit produit et validé.

> **✅ FAIT (juillet 2026).** État des lieux réalisé. Constat clé : il n'existait qu'UN SEUL endpoint/contrôleur (`/api/v2/assistant/execute`, `AssistantController.ts`) — la fusion évoquée en Section 2.1 comme un objectif à atteindre était déjà un fait accompli, pas un chantier restant. Décision actée : **on garde `/execute`, aucun renommage vers `/interact`** (voir note Section 2.1). Gap réel identifié et corrigé en priorité avant la Section 4 : l'assistant n'avait **aucune mémoire de conversation** (chaque appel Groq était stateless) — cassait directement le Principe 4 (jamais d'action sur une supposition), puisqu'une clarification demandée à l'utilisateur ne pouvait pas être exploitée au tour suivant. Corrigé via `conversationId` + persistance serveur (voir Section 2.2 mise à jour). Deux domaines ont aussi été retirés du périmètre Admin par construction : **Discipline** et **Bibliothèque/APEE** n'ont pas d'écran dans le dashboard Admin (uniquement Staff) — le critère de visibilité en direct (Section 5) ne peut donc pas être rempli pour eux ici ; reportés au chantier Staff (Section 6.2).

---

# SECTION 2 — ARCHITECTURE UNIFIÉE CIBLE

## 2.1 Point d'entrée unique

> **⚠️ DÉCISION ACTÉE — divergence assumée par rapport au texte ci-dessous.** L'endpoint reste **`POST /api/v2/assistant/execute`** (`AssistantController.execute`). Il n'y a jamais eu deux systèmes séparés à fusionner en `/interact` : la fusion catalogue d'actions + aide contextuelle (HelpArticle) était déjà réalisée dans une tâche précédente sur ce même endpoint. Créer un nouvel endpoint aurait été un renommage sans valeur ajoutée. Le schéma de `Body` ci-dessous reste correct dans l'esprit (message + screenKey + conversationId), seul le nom de la route change.

```
POST /api/v2/assistant/execute
Body : { 
  message: string, 
  screenKey: string, 
  screenContext?: Json,  // filtres fins optionnels selon l'écran
  conversationId?: string  // ✅ FAIT — généré au premier appel si absent, réutilisé ensuite
}
```

Cet endpoint remplace/fusionne les endpoints séparés du copilot exécutant et de l'aide contextuelle déjà conçus séparément dans les tâches précédentes.

## 2.2 Logique de traitement unifiée

1. Authentifier l'utilisateur, déterminer son rôle
2. Construire le contexte : `screenKey` + `screenContext` + structure actuelle de l'école + rôle
3. Filtrer le catalogue d'actions ET les fiches HelpArticle disponibles selon le rôle (RBAC)
4. Rechercher dans `HelpArticle` les fiches pertinentes pour ce `screenKey` (contexte informatif de base)
5. Appeler Groq avec function calling sur le catalogue d'actions filtré, en lui donnant aussi accès au contenu des fiches d'aide pertinentes comme contexte
6. Si Groq retourne un appel de fonction (intention d'action) :
   - Double vérification RBAC côté serveur (jamais confiance uniquement au filtrage prompt)
   - Si l'action est ambiguë par rapport au `screenContext` disponible (ex. élève non identifiable), poser une question de clarification plutôt que d'agir
   - Si destructive : confirmation obligatoire avant exécution
   - Si non-destructive : exécution directe, log, possibilité d'annulation
7. Si Groq ne retourne pas d'appel de fonction (question informative) :
   - Répondre en s'appuyant sur les fiches `HelpArticle` trouvées et/ou les données réelles interrogées (ex. « combien d'élèves en 4eA » → vraie requête, pas une fiche statique)
8. Retourner la réponse, avec le cas échéant le sélecteur UI à surligner (mécanisme déjà conçu pour HelpArticle, réutilisé ici)

> **✅ FAIT (juillet 2026) — mémoire de conversation.** Ajout du modèle Prisma `AssistantConversationTurn` (`conversationId`, `schoolId`, `userId`, `role`, `content`, `toolCalls?`, `createdAt`). À chaque appel : les 40 derniers tours de la conversation sont chargés et sérialisés en bloc texte (même principe que le fix déjà appliqué à l'onboarding conversationnel LV2/PEBS — `OnboardingPEBSController.ts` — pas via `messages[]` natif du SDK AI, mais injecté dans le `system` prompt avec instruction explicite de cumuler l'information tour après tour). Chaque tour (message utilisateur + réponse assistant, y compris un résumé synthétique des actions exécutées/en attente/échouées) est sauvegardé en fire-and-forget. Le frontend (`AssistantWidget.tsx`) conserve le `conversationId` reçu et le renvoie à chaque appel suivant du même fil.

## 2.3 Catalogue d'actions étendu — structure

```typescript
interface AssistantCapability {
  name: string;
  description: string;
  type: 'ACTION' | 'QUERY';  // agir vs simplement consulter/répondre
  destructive: boolean;       // uniquement pertinent si type=ACTION
  domain: string;             // "SCOLARITE" | "NOTES" | "FINANCE" | ...
  requiredPermission: string; // référence StaffPermissionType existant
  parameters: JsonSchema;
  useCase: string;            // nom du use case réellement invoqué
  screenKeysRelevant?: string[]; // écrans où cette capacité est 
                                   // particulièrement pertinente, 
                                   // pour prioriser le contexte
}
```

Chaque nouvelle capacité ajoutée dans les phases de la Section 4 suit cette structure, garantissant une cohérence sur tout le catalogue.

---

# SECTION 3 — LE MÉCANISME CENTRAL : CONSCIENCE D'ÉCRAN PARTAGÉE

## 3.1 Rappel du choix déjà validé (premier jet)

`screenKey` seul, transmis à chaque appel, sans filtres fins pour cette phase initiale — décision déjà prise et à respecter comme fondation.

## 3.2 Ce que ça change pour l'interprétation des commandes d'action

Quand l'utilisateur est sur `admin.grades.entry` et tape une commande d'action ambiguë sur une note, l'assistant doit :
- Reconnaître via `screenKey` qu'il est probablement en train de parler d'une note dans le contexte de saisie actuellement affiché
- Si l'identifiant précis (quel élève, quelle matière) n'est pas déductible du seul `screenKey` (puisqu'on n'a pas encore les filtres fins), poser la question de clarification plutôt que de deviner — c'est le comportement attendu et acceptable pour ce premier jet, pas un échec
- Documenter clairement, écran par écran, quand l'ajout d'un filtre fin (Section 3.3) éliminerait cette clarification récurrente — signal pour prioriser l'extension future

## 3.3 Extension future des filtres fins (hors périmètre immédiat, mais à préparer)

Pour les écrans où la clarification devient trop fréquente et frustrante à l'usage, ajouter progressivement le `screenContext` (classe sélectionnée, séquence active, élève affiché) via le Context React partagé déjà évoqué dans la tâche précédente — traiter écran par écran selon la demande réelle observée après le premier jet, pas anticiper.

---

# SECTION 4 — DÉPLOIEMENT PAR DOMAINE, DASHBOARD ADMIN

Ordre proposé, du plus simple/déjà avancé au plus complexe — à ajuster selon ce que révèle le tableau de correspondance de la Section 1.5.

> **⚠️ Numérotation réellement suivie — divergente du plan initial ci-dessous, décidée avec l'utilisateur après l'état des lieux.** Le tableau de correspondance (Section 1.5) a révélé une structure d'écrans Admin différente de ce que ce plan supposait au moment de sa rédaction. Ordre réellement implémenté, catalogue `adminActionCatalog.ts` (34 → **52 actions**), chaque phase vérifiée par `tsc --noEmit` avant de passer à la suivante (Principe 6) :
>
> | # réel | Domaine réellement livré | Statut | Correspondance avec ce plan |
> |---|---|---|---|
> | 4.1 | Scolarité + LV2/PEBS | ✅ FAIT | = 4.1 ci-dessous, tel quel |
> | 4.2 | Notes & Bulletins | ✅ FAIT | = 4.2 ci-dessous, tel quel |
> | 4.3 | Emploi du temps & Conseil de classe | ✅ FAIT | **absent du plan initial** — ajouté car écran Admin réel et prérequis naturel des Bulletins |
> | 4.4 | Année scolaire (période/séquence courante, vérification clôture) | ✅ FAIT | **absent du plan initial** — ajouté, transverse à tous les autres domaines |
> | 4.5 | Finance (hors APEE) | ✅ FAIT | = 4.3 ci-dessous, **APEE explicitement exclue** (pas d'écran Admin, voir note Section 1) |
> | 4.6 | Matricules & Concours d'entrée/PEBS | ✅ FAIT | **absent du plan initial** — ajouté, écrans Admin réels (`entrance-exams`, `pebs-exams`, `matricules`) |
> | 4.7 | Présences (volet Admin de Discipline/Présences) | ✅ FAIT | = 4.5 ci-dessous, **volet Présences uniquement** |
> | 4.8 | Statistiques et Rapports | ✅ FAIT | = 4.6 ci-dessous, tel quel |
> | 4.9 | Ressources Humaines | ✅ FAIT | = 4.4 ci-dessous, périmètre resserré |
> | 4.10 | Pédagogie | ✅ FAIT | **absent du plan initial** — 1 action (lecture) |
> | 4.11 | Communications | ✅ FAIT | **absent du plan initial** — 1 action (diffusion ciblée) |
> | — | Discipline (volet Admin) | ❌ RETIRÉ | = 4.5 ci-dessous, **partiellement** — voir note |
>
> Décision Discipline (actée avec l'utilisateur) : le volet Discipline de la Section 4.5 ci-dessous ne sera **pas** construit dans ce chantier Admin — aucun écran Admin n'existe pour Discipline (`SectionDiscipline.tsx` n'existe que côté Staff), donc le critère de visibilité en direct (Section 5) ne peut pas être rempli. Traité dans le futur chantier Staff (Section 6.2). Le volet **Présences** de la même sous-section, lui, a un vrai écran Admin et reste dû.

## 4.1 Domaine Scolarité (Utilisateurs, Classes, Matières)

**Déjà couvert partiellement** par le catalogue existant du copilot (création de classe, assignation d'enseignant). Cette phase l'étend :

Capacités à ajouter (type ACTION) :
- Créer/modifier/transférer un élève
- Affecter LV2 individuellement ou en masse (réutilise `AffecterLV2EleveUseCase`/`AffecterLV2EnMasseUseCase`)
- Affecter PEBS individuellement ou en masse (réutilise l'équivalent déjà construit)
- Créer/modifier une matière

Capacités à ajouter (type QUERY) :
- « Combien d'élèves dans telle classe ont telle LV2 ? »
- « Quels élèves de 4eA n'ont pas encore de LV2 affectée ? »
- « Quelle est la répartition PEBS de telle classe ? »

**Definition of Done phase 4.1 :**
1. Depuis l'écran de gestion des classes, demander « Affecte l'Allemand à tous les élèves de 4eA » → exécution correcte, historique visible, annulable
2. Demander « Quels élèves de 4eC n'ont pas de LV2 ? » → réponse exacte basée sur une vraie requête, pas une supposition
3. Tenter une action hors permission du rôle test → refus explicite

> **✅ CODE FAIT, vérification fonctionnelle bout-en-bout (les 3 points DoD ci-dessus, en conversation réelle) restant à faire.** 11 actions ajoutées au catalogue (`creer_eleve`, `modifier_eleve`, `transferer_eleve`, `modifier_matiere`, `affecter_lv2_eleve`, `affecter_lv2_masse`, `affecter_pebs_eleve`, `affecter_pebs_masse`, `compter_eleves_par_lv2`, `lister_eleves_sans_lv2`, `repartition_pebs_classe`), `tsc --noEmit` propre.

## 4.2 Domaine Notes et Bulletins

Capacités ACTION :
- Déclencher la génération d'un bulletin pour une classe/élève (réutilise `GenererBulletinUseCase`)
- Déclencher l'import Excel de notes (orienter vers l'écran, pas exécuter l'import à l'aveugle sans le fichier)
- Verrouiller/déverrouiller une séquence de notes si l'utilisateur a la permission

Capacités QUERY :
- « Quelle est la moyenne de la classe 3eB en mathématiques ce trimestre ? »
- « Combien d'élèves ont une moyenne générale inférieure à 10 en 4eA ? »
- « Le conseil de classe de telle classe a-t-il déjà eu lieu ? »

**Definition of Done phase 4.2 :**
1. Demander la moyenne d'une classe réelle → réponse exacte, vérifiable manuellement en comparant à l'écran Notes
2. Demander de générer les bulletins d'une classe → déclenchement réel du use case, fichier généré visible dans l'écran Bulletins

> **✅ CODE FAIT, vérification fonctionnelle bout-en-bout restant à faire.** 7 actions ajoutées (`generer_bulletins_classe`, `envoyer_bulletins_parents`, `valider_notes_en_masse`, `guider_import_excel_notes`, `moyenne_classe_matiere`, `compter_eleves_sous_moyenne`, `conseil_classe_tenu`), `tsc --noEmit` propre. Étendu de facto avec un domaine non prévu ici : **Emploi du temps & Conseil de classe** (publication EDT, ouverture de conseil de classe, classes sans EDT/conseil) et **Année scolaire** (période/séquence courante, vérification des prérequis de clôture — volontairement en lecture seule, la clôture elle-même reste manuelle) — tous deux prérequis naturels des Bulletins et absents du plan initial.

## 4.3 Domaine Finance (CampPay + futur module MINESEC)

Capacités ACTION :
- Créer un plan de frais (réutilise `CreerPlanFrais`)
- Générer des factures en masse
- Enregistrer un paiement cash

Capacités QUERY :
- « Quels élèves ont un solde impayé supérieur à X FCFA ? »
- « Quel est le taux de recouvrement de la classe 3eA ce trimestre ? »
- Une fois le module MINESEC construit (chantier séparé déjà planifié) : « Quels élèves n'ont pas encore de matricule national vérifié ? »

**Note de dépendance :** cette phase peut être développée en deux temps — d'abord sur le système CampPay déjà existant, puis étendue au module MINESEC une fois celui-ci livré, sans bloquer l'un sur l'autre.

**Definition of Done phase 4.3 :**
1. Demander la liste des impayés d'une classe → réponse exacte
2. Demander de créer un plan de frais → exécution correcte avec confirmation appropriée selon la sensibilité de l'action

> **✅ CODE FAIT (hors APEE), vérification fonctionnelle bout-en-bout restant à faire.** 4 actions ajoutées (`creer_plan_frais`, `generer_factures_masse`, `enregistrer_paiement_cash`, `eleves_factures_impayees` — comble le gap « total impayé non exposé » identifié en Section 1.5), `tsc --noEmit` propre. **APEE retirée du périmètre** — pas d'écran Admin (voir note en tête de Section 4). **Bug de production corrigé au passage** : `GenererFacturesEnMasseUseCase` ignorait silencieusement son paramètre `classId` (facturait en réalité TOUS les élèves actifs de l'école, y compris via l'écran Finance existant, pas seulement le copilot) — corrigé à la racine en ajoutant `UserRepository.findByClass()` (port + implémentation Prisma + 6 doublures de test), plus sûr que de contourner uniquement côté catalogue copilot.

## 4.4 Domaine Ressources Humaines

Capacités ACTION :
- Créer/modifier un dossier employé (selon l'avancement réel du module RH déjà identifié comme partiellement construit)
- Approuver une demande de congé

Capacités QUERY :
- « Quels enseignants n'ont pas leur diplôme renseigné ? » (lien direct avec le gap RH déjà identifié via l'analyse du fichier MINESEC)
- « Qui est le professeur principal de telle classe ? »

**Definition of Done phase 4.4 :** cohérent avec l'avancement réel du module RH au moment de cette phase — si le module RH sous-jacent n'est pas encore complet, cette phase se limite aux capacités que les use cases existants permettent réellement, sans en inventer.

> **✅ FAIT** (livré en « 4.9 » réel). Décision tranchée sur le dilemme « refactor préalable ou tel quel » laissé ouvert par l'utilisateur : audit de `HRController.ts`/`PedagogieController.ts`/`CommunicationsController.ts` (700+ lignes chacun) — logique en réalité simple (CRUD + agrégations), sans chaîne de validation métier complexe comparable à Finance (seuil légal Art. 48). Pas de refactor architectural nécessaire ; **extraction chirurgicale et fidèle** (comportement inchangé, pas de réécriture) des seules fonctions nécessaires depuis les contrôleurs vers des fonctions exportées réutilisables (`traiterDemandeConge`, `executerBroadcast`, `calculerAlertesRetardProgramme`) — chaque contrôleur HTTP appelle désormais sa propre fonction extraite au lieu de dupliquer la logique. Respect de la frontière hexagonale : `adminActionCatalog.ts` (couche application) ne référence **aucun** contrôleur d'infrastructure — les 3 fonctions sont injectées comme dépendances de type fonction dans `AdminActionDeps`, câblées uniquement depuis `hexagonal.bootstrap.ts` (couche infrastructure, seule autorisée à connaître les contrôleurs). 3 actions ajoutées : `traiter_demande_conge` (non annulable — déduit le solde congé si approuvée), `enseignants_sans_diplome`, `professeur_principal_classe`. Périmètre RH volontairement resserré : dossier employé, attestations/certificats PDF, ordres de mission restent hors catalogue (génération de documents structurés, même logique que l'import Excel de notes).

> **➕ Deux domaines non prévus par ce plan, ajoutés en même temps que RH (même décision refactor-vs-tel-quel) :**
> - **Pédagogie** (« 4.10 » réel) — 1 action ajoutée : `alertes_retard_programme` (classes/matières en retard sur leur programme, logique extraite `PedagogieController.calculerAlertesRetardProgramme`). Périmètre resserré : créer/modifier programme/chapitre/cahier de texte restent des formulaires structurés, hors catalogue.
> - **Communications** (« 4.11 » réel) — 1 action ajoutée : `diffuser_message` (SMS/email à un groupe ciblé par rôle/classe/niveau/statut de paiement, logique extraite `CommunicationsController.executerBroadcast`). Au moins un critère de ciblage obligatoire (déjà imposé par la logique existante, revérifié dans le catalogue) — aucune diffusion à l'aveugle sur tout l'établissement. Non annulable (messages réels envoyés), même traitement que `envoyer_bulletins_parents`.
>
> `tsc --noEmit` propre (backend + frontend) pour les trois domaines. Écouteurs de rafraîchissement live ajoutés sur `SectionRH.tsx` (leaveRequest) et `SectionCommunications.tsx` (broadcastLog) — Pédagogie n'en a pas besoin (lecture seule).

## 4.5 Domaine Discipline et Présences

Capacités ACTION :
- Enregistrer une sanction (réutilise le use case existant)
- Justifier une absence

Capacités QUERY :
- « Quels élèves ont plus de 3 absences non justifiées ce mois ? »
- « Quelles sanctions ont été prises cette semaine ? »

> **❌ Volet Discipline RETIRÉ du périmètre Admin** (pas d'écran Admin, décision actée — voir note en tête de Section 4 ; traité au chantier Staff, Section 6.2). **✅ Volet Présences FAIT** (livré en « 4.7 » réel) — 2 actions ajoutées (`justifier_absence`, `eleves_absences_non_justifiees`), directement sur `ctx.prisma.attendance` (comme le fait déjà `AttendanceController.justifierAbsence` — aucun use case dédié n'existait, même approche reprise). Écouteur de rafraîchissement live ajouté sur `SectionAdminAttendance.tsx`. `tsc --noEmit` propre (backend + frontend). L'« enregistrement » complet d'une présence de classe (tout le registre du jour) reste volontairement hors catalogue — trop de données structurées (statut par élève) pour une commande en langage naturel, cohérent avec le traitement déjà réservé à l'import Excel de notes.

## 4.6 Domaine Statistiques et Rapports

Capacités QUERY principalement (peu d'actions destructives dans ce domaine) :
- « Quelle est l'évolution de la moyenne générale de l'école sur les 3 derniers trimestres ? »
- « Quelle classe a le meilleur taux de réussite ce trimestre ? »

> **✅ FAIT** (livré en « 4.8 » réel) — 2 actions ajoutées (`evolution_moyenne_generale`, `classement_classes`), toutes deux en lecture seule (aucun écouteur de rafraîchissement live nécessaire — rien n'est muté). Logique de calcul directement dans le catalogue, sur le même principe que `StatisticsController.ts` existant (lui-même sans use case dédié). `tsc --noEmit` propre.

## 4.7 Domaines futurs à intégrer au fur et à mesure de leur construction

- Module d'examens/admissions (concours d'entrée 6e, sélection PEBS) une fois construit
  > **✅ FAIT (juillet 2026, phase « 4.6 » réellement livrée).** Le module était déjà construit — 5 actions ajoutées : `resume_session_concours`, `calculer_admission_concours`, `resume_session_pebs`, `calculer_selection_pebs`, `verifier_matricule_eleve` (recherche cartescolaire.cm, ne modifie jamais le profil automatiquement — confirmation manuelle requise, même principe que le fuzzy-matching déjà en place ailleurs). `tsc --noEmit` propre.
- Module de déclaration statistique MINESEC/MINEDUB une fois construit — capacité type « Génère ma déclaration statistique » directement depuis le copilot

**Principe à ne jamais oublier pour l'avenir :** chaque nouvelle fonctionnalité construite sur ZekoulABia doit se poser la question « cette capacité doit-elle aussi être exposée à l'assistant ? » — sinon l'assistant reste aveugle sur les nouveautés, exactement le risque identifié en discussion.

---

# SECTION 5 — VISIBILITÉ EN DIRECT DES ACTIONS

Rappel du principe déjà établi dans le chantier copilot initial, à maintenir et renforcer à mesure que le catalogue s'étend :

1. Quand l'assistant exécute une action, si l'utilisateur se trouve sur l'écran concerné par cette action (même `screenKey`/domaine), l'interface se met à jour en temps réel sans rechargement de page
2. Si l'action concerne un écran différent de celui où se trouve l'utilisateur (ex. l'utilisateur discute depuis le Tableau de bord mais demande une action sur les Notes), proposer une navigation automatique vers l'écran concerné avec message explicatif, plutôt que d'exécuter une action invisible pour l'utilisateur
3. Chaque domaine ajouté en Section 4 doit vérifier explicitement ce critère de visibilité en direct dans son Definition of Done, pas seulement l'exactitude de l'action elle-même

> **Mécanisme déjà en place (chantier précédent) :** chaque `ActionExecuteResult` du catalogue porte un `section`/`entity` ; `AssistantController` les renvoie dans la réponse JSON ; `AssistantWidget.tsx` (`notifyInterface()`) émet deux `CustomEvent` DOM — `zekoulabia:navigate` (navigation auto, écouté par `admin/dashboard/page.tsx`, couvre le point 2) et `zekoulabia:data-changed` (rafraîchissement live, point 1) — sur lesquels chaque section écran doit s'abonner individuellement pour re-fetcher ses données.
>
> **✅ CORRIGÉ (juillet 2026).** Gap détecté à la relecture : seuls `SectionClasses.tsx` et `SectionSubjects.tsx` écoutaient `zekoulabia:data-changed` — sur les 33 nouvelles actions des Sections 4.1 à 4.6, la plupart déclenchaient la navigation (point 2) mais pas le rafraîchissement live (point 1). Écouteur `zekoulabia:data-changed` ajouté rétroactivement dans les 9 composants d'écran restants concernés par une entité mutée par le catalogue : `SectionUsers.tsx` (user), `SectionAdminEntranceExams.tsx` (entranceExamSession, entranceExamCandidate), `SectionAdminPebsExams.tsx` (pebsExamSession, pebsExamCandidate), `SectionAdminLV2Choice.tsx` (lv2ChoiceWindow, studentProfile), `SectionBulletins.tsx` (reportCard), `SectionGrades.tsx` (grade), `SectionTimetable.tsx` (timetable), `SectionAdminCouncil.tsx` (classCouncilSession), `SectionAcademicYear.tsx` (academicPeriod), `SectionFinance.tsx` (feePlan, invoice, payment). `tsc --noEmit` frontend propre. Les actions purement QUERY (lecture seule, aucune donnée mutée) n'ont volontairement pas reçu d'écouteur.
>
> **✅ RE-VÉRIFIÉ après ajout des domaines 4.7 à 4.11 (Présences, Statistiques, RH, Pédagogie, Communications).** Audit statique complet et systématique de la couverture (impossible de tester en conditions réelles — voir note Section 7) :
> - **Tous les `section:` émis par les 54 actions du catalogue** (`academic-year`, `ai`, `attendance`, `bulletins`, `classes`, `communications`, `council`, `entrance-exams`, `finance`, `grades`, `matricules`, `pebs-exams`, `pedagogie`, `rh`, `statistics`, `subjects`, `timetable`, `users`) **ont un rendu correspondant** dans `admin/dashboard/page.tsx` — aucune navigation vers un écran inexistant.
> - **Tous les `entity:` émis par une action qui MUTE réellement des données** ont un écouteur `zekoulabia:data-changed` sur l'écran qui affiche cette donnée — `SectionAdminAttendance.tsx` (attendance), `SectionCommunications.tsx` (broadcastLog), `SectionRH.tsx` (leaveRequest) ajoutés en plus des 9 déjà listés. Cas vérifiés comme ne nécessitant PAS d'écouteur : `academicYear`/`employeeFile`/`programme` (uniquement lus par des QUERY, jamais mutés) ; `studentProfile` muté par `affecter_pebs_*` mais `SectionAdminPebsExams.tsx` n'affiche aucune donnée de filière PEBS (vérifié par recherche dans le fichier) — pas de risque de donnée obsolète ; `studentProfile` muté par `verifier_matricule_eleve` en réalité jamais — l'action ne modifie jamais le profil (documenté dans son propre code), le tag `entity` ne sert qu'à la navigation.

---

# SECTION 6 — SÉQUENCEMENT ET FEUILLE DE ROUTE AU-DELÀ DE L'ADMIN

## 6.1 Ordre général du chantier

1. Section 1 (état des lieux) — obligatoire avant tout code
2. Section 2-3 (architecture unifiée + conscience d'écran) — fondation technique
3. Section 4, phases 4.1 à 4.6 dans l'ordre — dashboard Admin complet
4. Extension aux autres rôles (Section 6.2) — une fois l'Admin stabilisé et validé à l'usage

## 6.2 Extension future aux autres rôles (déjà en mémoire comme chantier en attente)

Une fois le copilot unifié pleinement opérationnel sur le dashboard Admin, reproduire la même architecture (déjà généralisée, pas à reconstruire) pour :
- Enseignant (notes de ses classes, présences, cahier de texte, emploi du temps)
- Censeur/Staff (discipline, conseils de classe, emploi du temps)
- Parent (informations sur son enfant, paiement — volet informatif d'abord, actions limitées)
- Élève (consultation uniquement, pas d'actions)

Chaque rôle reprend l'architecture de la Section 2 avec son propre catalogue de capacités filtré par ses permissions réelles — ce chantier Admin sert de modèle réutilisable, pas de travail à refaire de zéro.

> **✅ Architecture généralisée (juillet 2026)** — décision actée avec l'utilisateur : **un seul catalogue combiné, un seul contrôleur**, plutôt que des contrôleurs/endpoints séparés par rôle (fidèle au Principe 0.1 « un seul copilot »). Réalisé :
> - Extraction du moteur générique (`ActionContext`, `ActionExecuteResult`, `ActionDefinition`, `filterCatalogForUser`, `buildTools`, resolvers partagés `resolveClass`/`resolveStudent`/etc.) de `adminActionCatalog.ts` vers un nouveau fichier `catalogShared.ts` — extraction fidèle, comportement inchangé, `tsc --noEmit` et tests propres avant/après (223 pass/18 fail, identique).
> - Nouveau champ `allowedRoles?: string[]` sur `ActionDefinition` : omis = comportement historique du catalogue Admin (ADMIN voit tout, STAFF filtré par `requiredPermission`) ; renseigné = action visible UNIQUEMENT pour ces rôles, y compris à l'exclusion d'ADMIN (une action « mes classes » n'a pas de sens hors du contexte personnel d'un enseignant connecté).
> - `AssistantController` instancié UNE FOIS avec le catalogue combiné (`[...adminActionCatalog, ...teacherActionCatalog, ...]`) — aucune modification du contrôleur lui-même, déjà entièrement générique.
> - Routes `/api/v2/assistant/execute|confirm-action|undo-action` étendues de `requireRole('ADMIN')` à `requireRole('ADMIN', 'TEACHER', ...)` au fur et à mesure des rôles ajoutés.
>
> **✅ Rôle Enseignant FAIT (premier rôle non-Admin livré).** État des lieux réalisé (Explore) : la plupart des routes Notes/Présences/Cahier de texte n'ont **aucun `requireRole` au niveau route** (seulement `requireAuth`) — le RBAC enseignant est déjà appliqué à l'intérieur des use cases/contrôleurs (ex. `SaisirNoteUseCase` vérifie `estEnseignantAssigne`). Seul `/api/v2/assistant/execute` lui-même était bloqué à ADMIN — corrigé. Nouveau fichier `teacherActionCatalog.ts`, 10 actions (`allowedRoles: ['TEACHER']`) :
> - **Notes** : `saisir_note` (réversible), `soumettre_mes_notes_classe` (non annulable), `mes_notes_en_attente` (lecture), `moyenne_ma_classe_matiere` (lecture, vérifie l'assignation via `TeachingAssignment` avant de répondre)
> - **Présences** : `marquer_absence_eleve` (réversible — enveloppe `EnregistrerPresenceUseCase` avec un tableau à un seul élève, plus adapté au dialogue que la saisie de classe entière), `mes_stats_presence_classe` (lecture)
> - **Cahier de texte** : `ajouter_cahier_texte` (réversible, direct Prisma — aucun use case dédié n'existait, `createCahierDeTexte` du contrôleur reproduit fidèlement)
> - **Emploi du temps** : `demander_rattrapage` (non annulable — notification déjà envoyée aux censeurs via `DemanderRattrapageUseCase`)
> - **Mes classes** : `mes_classes`, `mes_eleves_classe` (lecture, via `TeachingAssignment`)
>
> Périmètre volontairement resserré : gestion de programme/bulletins/emploi du temps restent hors catalogue (formulaires structurés, même logique que le catalogue Admin). `justifier_absence` volontairement absent — `AttendanceController.justifierAbsence` exclut explicitement TEACHER (403) dans le code existant, pas un oubli.
>
> **Frontend** : `AssistantWidget.tsx` généralisé (nouveaux props `rolePrefix` et `suggestions`, défaut `'admin'`/liste Admin — zéro changement de comportement pour l'Admin) puis monté sur `teacher/dashboard/page.tsx` (`rolePrefix="teacher"`, screenKey `teacher.<section>`) avec son propre écouteur `zekoulabia:navigate`. Écouteurs `zekoulabia:data-changed` ajoutés sur les 3 écrans affichant une entité mutée par le catalogue : `SectionTeacherGrades.tsx` (grade), `SectionTeacherAttendance.tsx` (attendance), `SectionCahierDeTexte.tsx` (cahierDeTexte) — `demander_rattrapage` n'en a pas besoin (la demande n'a pas d'écran de suivi côté enseignant, seulement une notification aux censeurs).
>
> `tsc --noEmit` propre (backend + frontend), tests backend 223 pass/18 fail (identique à l'état précédent — aucune régression). Vérification fonctionnelle bout-en-bout non faite, même limitation que pour l'Admin (base de développement locale vide).
>
> **✅ Rôle Censeur/Staff FAIT (deuxième rôle non-Admin livré).** État des lieux réalisé (Explore) : découverte du mapping `PERM_TO_SECTION` déjà existant côté frontend Staff (`frontend/src/app/staff/dashboard/_types.ts`) — confirme quelles `StaffPermissionType` donnent accès à quelles sections. Décision de périmètre : **ne pas** ouvrir en bloc le catalogue Admin existant (Finance, Notes, Conseil de classe...) à STAFF dans cette passe, même si `requiredPermission` le permettrait techniquement — aucun écran Staff n'a encore d'écouteur `zekoulabia:data-changed`, l'audit complet de cette réutilisation est reporté à une passe dédiée (non fait = pas de risque introduit, juste pas encore de bénéfice). Ce chantier couvre uniquement les domaines strictement neufs, sans aucun équivalent Admin : **Discipline**, **APEE**, **Bibliothèque**, **Orientation**.
>
> **🐛 Bug RBAC trouvé et corrigé avant mise en production** : `filterCatalogForUser` laissait `allowedRoles` court-circuiter `requiredPermission` — une action portant les deux (ex. `allowedRoles: ['STAFF']` + `requiredPermission: 'MANAGE_DISCIPLINE'`) aurait été visible par **N'IMPORTE QUEL** membre du Staff, pas seulement ceux ayant `MANAGE_DISCIPLINE`. Sans conséquence réelle à ce jour (le catalogue Teacher n'utilisait jamais `requiredPermission`, donc jamais exercé), mais aurait été un vrai trou RBAC dès la première action Staff avec permission fine. Corrigé dans `catalogShared.ts` : les deux critères sont maintenant vérifiés ensemble.
>
> Nouveau fichier `staffActionCatalog.ts`, 11 actions (`allowedRoles: ['STAFF']` + `requiredPermission` spécifique à chaque domaine) :
> - **Discipline** (`MANAGE_DISCIPLINE`) : `enregistrer_sanction` (réversible via `lever_sanction` — notifie les parents en réutilisant la même chaîne push→SMS→email que la route REST existante, injectée via `StaffActionDeps` pour respecter la frontière hexagonale), `lever_sanction`, `sanctions_recentes_eleve` (lecture). Volontairement exclu : convocation d'un Conseil de Discipline (Art. 30 — 6 rôles nommés, délai légal 72h, PV) — trop structuré pour le langage naturel, même logique que les exclusions déjà actées côté Admin.
> - **APEE** (`MANAGE_FINANCE` — aucune permission `MANAGE_APEE` dédiée n'existe dans le code) : `enregistrer_transaction_apee`, `valider_depense_apee`, `solde_apee` (lecture)
> - **Bibliothèque** (`MANAGE_LIBRARY`) : `emprunter_livre` (réversible), `retourner_livre`, `livres_disponibles` (lecture)
> - **Orientation** (`MANAGE_ORIENTATION`) : `ajouter_suivi_orientation` (exige une fiche déjà ouverte pour l'élève — pas de création automatique de fiche depuis le copilot), `eleves_a_risque_orientation` (lecture)
>
> **Constat de conformité pour l'avenir** : contrairement au catalogue Admin, les routes REST Discipline/APEE/Bibliothèque ne vérifient **aucune** permission fine côté backend (seulement `requireRole('ADMIN','STAFF')` générique) — seul Orientation le fait réellement. Le filtrage `requiredPermission` du catalogue copilot est donc la SEULE protection fine pour ces 3 domaines, aussi bien pour le copilot que comme référence si ces routes REST sont un jour durcies.
>
> **Frontend** : `AssistantWidget` monté sur `staff/dashboard/page.tsx` (`rolePrefix="staff"`), navigation via le `navTo()` déjà existant (respecte `allowedSections`, défense en profondeur). Écouteurs `zekoulabia:data-changed` ajoutés sur `SectionDiscipline.tsx`, `SectionAPEEStaff.tsx`, `SectionLibrary.tsx`, `SectionOrientation.tsx`.
>
> `tsc --noEmit` propre (backend + frontend), tests 223 pass/18 fail (identique). Audit statique section/entity complet (mêmes critères que Admin/Teacher) : aucun gap trouvé.
>
> **✅ Rôle Parent FAIT (troisième rôle non-Admin livré).** Conforme au plan (« informations sur son enfant, paiement — volet informatif d'abord, actions limitées ») : nouveau fichier `parentActionCatalog.ts`, 5 actions (`allowedRoles: ['PARENT']`) — `mes_enfants`, `notes_mon_enfant`, `presence_mon_enfant`, `solde_mon_enfant` (lecture) et **une seule** action réelle, `initier_paiement_enfant` (Mobile Money via `InitierPaiementMobileMoneyUseCase`, non annulable — la confirmation finale se fait sur le téléphone du parent, hors du copilot).
>
> **Point de sécurité spécifique à ce rôle** : un nouveau resolver `resolveMyChild` (local à `parentActionCatalog.ts`, pas partagé) filtre strictement par la relation `ParentStudent` du parent connecté — contrairement à `resolveStudent` (catalogues Admin/Staff/Teacher) qui cherche parmi TOUS les élèves de l'école. Un parent ne peut donc jamais, même par erreur de nommage, faire remonter les données d'un enfant qui n'est pas le sien.
>
> Frontend : `AssistantWidget` monté sur `parent/dashboard/page.tsx`, écouteur `zekoulabia:data-changed` ajouté sur `SectionParentPayments.tsx` (entity `payment`).
>
> **✅ Rôle Élève FAIT (quatrième et dernier rôle du plan).** Conforme au plan (« consultation uniquement, pas d'actions ») : nouveau fichier `studentActionCatalog.ts`, 4 actions, **toutes en lecture seule**, aucune dépendance à câbler (aucun use case invoqué, uniquement des lectures Prisma directement scopées par `ctx.userId` — l'élève connecté lui-même, jamais de résolution par nom). `mes_notes`, `ma_moyenne_sequence`, `ma_presence`, `mes_livres_empruntes`. Aucun écouteur `zekoulabia:data-changed` nécessaire (rien n'est jamais muté par ce catalogue).
>
> `tsc --noEmit` propre (backend + frontend) et tests 223 pass/18 fail (identique) pour les deux rôles. Audit statique section/entity complet, aucun gap trouvé.
>
> **Section 6.2 terminée — les 4 rôles prévus par le plan sont livrés.** Catalogue combiné final : 54 (Admin) + 10 (Teacher) + 11 (Staff) + 5 (Parent) + 4 (Student) = **84 actions**, un seul `AssistantController`, une seule route `/api/v2/assistant/execute` acceptant `requireRole('ADMIN','TEACHER','STAFF','PARENT','STUDENT')`.
>
> ⏳ **Restent, explicitement hors périmètre de ce chantier ou différés en cours de route** :
> - Réutilisation du catalogue Admin (Finance/Notes/Conseil de classe pédagogique) par STAFF au-delà des 11 actions neuves — décision explicitement différée lors du chantier Staff (nécessite un audit action par action + écouteurs live sur les écrans Staff équivalents).
> - Vérification fonctionnelle bout-en-bout (conversations réelles) pour tous les rôles — non faite pour aucun rôle, base de développement locale vide (voir note Section 7). Seule vérification faite : statique (types, tests unitaires existants, cohérence section/entity).
> - Section 6.3 (assistant proactif) — chantier distinct, non commencé, non concerné par ce plan.

## 6.3 Lien avec l'assistant proactif (chantier distinct déjà en mémoire)

Rappel : l'assistant proactif pour parents/élèves (rappels automatiques à la connexion, type solde impayé) reste un chantier distinct de celui-ci — il est informatif et déclenché automatiquement, pas piloté par une question de l'utilisateur. Les deux pourront partager de l'infrastructure (accès Groq, connaissance du contexte élève/parent) mais restent fonctionnellement séparés.

---

# SECTION 7 — DEFINITION OF DONE GLOBALE

Le chantier Admin est considéré complet quand :

1. Un directeur d'école peut, depuis n'importe quel écran de son dashboard, poser une question sur ses données réelles (élèves, notes, finances, RH, discipline) et recevoir une réponse exacte, fondée sur de vraies requêtes ou fiches d'aide, jamais inventée
2. Il peut demander l'exécution d'une action dans chacun des domaines couverts (Section 4), avec confirmation appropriée selon la sensibilité, et voir le résultat se refléter en direct s'il est sur l'écran concerné
3. Aucune capacité exposée à l'assistant ne dépasse les permissions réelles du rôle connecté, vérifié à double niveau (prompt + serveur)
4. Le mécanisme de conscience d'écran fonctionne de façon cohérente sur tous les domaines déployés
5. Les fiches HelpArticle et les capacités d'action cohabitent naturellement dans les réponses de l'assistant, sans que l'utilisateur ait besoin de savoir laquelle des deux sources répond à sa question

> **⚠️ Point 1 et 2 — vérification fonctionnelle réelle impossible depuis cet environnement (juillet 2026).** La base de données de développement locale (3 écoles) ne contient **aucun utilisateur, aucune classe, aucune matière, aucune année scolaire** — rien à quoi envoyer un vrai message de conversation. Fabriquer artificiellement une école complète uniquement pour « prouver que ça marche » produirait un test qui se vérifie lui-même (données construites exactement à la forme attendue par mon propre code) plutôt qu'un usage réel. À la place : audit statique complet de la couverture Section 5 (ci-dessus) + relecture ligne par ligne du catalogue. **Reste un vrai test de bout en bout par l'utilisateur, dans un environnement peuplé (staging ou dev avec données), avant mise en production** — c'est la seule vérification qui compte réellement pour ce point.
>
> **✅ Corrigé en marge de cette relecture — deux failles concrètes trouvées dans le prompt système** (`AssistantController.buildSystemPrompt`) : (1) la liste d'exemples d'actions dans les « Règles » était restée figée sur les 4 actions du tout premier catalogue (« créer/supprimer une classe... ») alors qu'il y en a 54 aujourd'hui — trompeur, supprimé. (2) Aucune règle n'implémentait explicitement le Principe 4 ni le risque n°4 de la Section 8 (confusion question/ordre) au niveau du prompt lui-même — seulement au niveau du code (erreurs de désambiguïsation dans `resolveStudent`/`resolveClass`). Ajout de deux règles explicites : ne jamais deviner entre une observation et un ordre en cas de doute réel, et n'appeler un tool que si tous les paramètres sont identifiables avec certitude.

---

# SECTION 8 — RISQUES ET POINTS DE VIGILANCE

1. **Dérive du catalogue** — sans discipline, le catalogue d'actions peut devenir difficile à maintenir à mesure qu'il grossit. Prévoir une convention de nommage stricte et une revue du tableau de correspondance (Section 1.5) à chaque nouvelle phase.
2. **Coût Groq croissant** — plus le catalogue de capacités grossit, plus le prompt système transmis à chaque appel grossit potentiellement. Envisager, si nécessaire après la phase 4.3 ou 4.4, un filtrage du catalogue transmis selon le domaine probable de la question plutôt que tout transmettre systématiquement — à évaluer selon l'usage réel, pas anticiper inutilement.
   > **📏 Mesuré (juillet 2026), pas encore agi.** Le checkpoint « après 4.3 ou 4.4 » est largement dépassé (54 actions). Taille JSON des seules descriptions des tools : ~9,7 Ko (~2400 tokens estimés) ; en comptant la sérialisation JSON-schema complète des `inputSchema` Zod (systématiquement plus verbeuse) et l'historique de conversation (jusqu'à 40 tours), le total réel envoyé à chaque message dépasse probablement 6000-10000 tokens sur une conversation déjà avancée. **Décision : ne pas implémenter de filtrage maintenant.** Un filtrage par `screenKey` (le champ `screenKeysRelevant` déjà prévu en Section 2.3 mais jamais rempli) risquerait de casser une exigence explicite de ce même plan (Section 5, point 2 : agir sur un domaine différent de l'écran actuel doit rester possible) si mal conçu — et aucune donnée d'usage réelle n'existe encore pour calibrer un filtrage sûr (copilot jamais utilisé en conditions réelles à ce jour). À réévaluer une fois un usage réel observé, pas avant.
3. **Oubli d'exposer une nouvelle fonctionnalité** — risque déjà identifié en Section 4.7 : instaurer la discipline d'y penser systématiquement pour chaque nouveau chantier futur.
4. **Confusion utilisateur entre "je pose une question" et "je donne un ordre"** — certaines formulations sont ambiguës (« la classe 4eA est en retard de paiement » peut être une question ou une observation). Le comportement par défaut doit toujours pencher vers la question de clarification plutôt que l'action en cas de doute réel.
   > **✅ Corrigé (juillet 2026)** — voir note Section 7 : règle explicite ajoutée au prompt système, ce risque n'était couvert qu'au niveau du code (désambiguïsation), jamais au niveau de l'instruction donnée au modèle lui-même.

---

*Document de pilotage — à mettre à jour à la fin de chaque phase de la Section 4 avec l'état réel constaté en code, pas en intention.*

---

## STATUT GLOBAL (mis à jour juillet 2026)

- ✅ Section 0, 1, 2, 3 — fondations posées (endpoint `/execute` conservé, historique `conversationId` ajouté, `screenKey` déjà en place depuis le chantier HelpArticle)
- ✅ Section 4.1 à 4.11 (numérotation réellement suivie, voir tableau en tête de Section 4) — **catalogue Admin complet, 54 actions**, code fait et `tsc --noEmit` propre à chaque étape
- ✅ Section 5 — audit complet de couverture (navigation + rafraîchissement live) sur les 54 actions, 12 écrans avec écouteur, aucun gap restant identifié statiquement
- ✅ Section 7/8 — deux failles de prompt système corrigées (exemples d'actions obsolètes, absence de règle explicite anti-devinette) ; coût Groq mesuré et documenté, filtrage volontairement différé faute de données d'usage réelles
- ✅ Bug de production corrigé au passage (`GenererFacturesEnMasseUseCase` ignorait `classId`, facturait toute l'école) — voir note Section 4.3
- ⚠️ **Chantier Admin code-complet, non validé en conditions réelles** — base de développement locale vide (aucun utilisateur/classe/année dans les 3 écoles présentes), vérification conversationnelle bout-en-bout impossible depuis cet environnement. Reste un vrai test par l'utilisateur avant mise en production, seule vérification qui compte réellement pour ce point.
- ❌ Discipline et APEE restaient hors périmètre Admin par construction (pas d'écran Admin) — traités dans le chantier Staff (Section 6.2), voir ci-dessous
- ✅ Section 6.2 (extension aux autres rôles) — **TERMINÉE**, les 4 rôles prévus livrés dans l'ordre du plan : Enseignant (10 actions) → Censeur/Staff (11 actions, + fix d'un bug RBAC réel dans `filterCatalogForUser`) → Parent (5 actions) → Élève (4 actions, lecture seule). Catalogue combiné final : **84 actions**, architecture unifiée (un seul `AssistantController`, catalogue combiné, `allowedRoles` généralisé).
- ⏳ Vérification fonctionnelle bout-en-bout (conversations réelles) non faite pour aucun rôle — base de développement locale vide, limitation d'environnement documentée section par section. Seule vérification possible depuis cet environnement : statique (tsc, tests unitaires existants, audit exhaustif section/entity/navigation).
- Non commité en git — en attente de confirmation explicite de l'utilisateur, chantier Section 6.2 maintenant terminé comme demandé
