# Blueprint d'harmonisation — Admissions, concours et inscriptions (ZekoulABia)

Document de référence pour l'assistant d'implémentation. Il **remplace la logique « par phases techniques »** des plans précédents par une logique de **parcours utilisateurs reliés entre eux**. En cas de contradiction avec les documents précédents, **celui-ci prévaut**.

---

## 0. Consignes à l'assistant

### 0.1 Le problème à résoudre
Beaucoup de code existe déjà. Le problème n'est plus l'absence de fonctionnalités, mais leur **liaison** : écrans isolés, réglages qui contredisent les règles, mécanismes parallèles (par exemple un formulaire « Créer une session » pour le secrétaire alors que les concours sont des événements lancés par l'administrateur), libellés incohérents, écrans que personne ne trouve. Ta mission : **relier, aligner et nettoyer**, pas ajouter du code de plus.

### 0.2 Méthode
1. Lis ce document en entier.
2. Compare-le au code et aux captures d'écran (section 6) et produis un **tableau d'écarts** : élément attendu | état actuel | action.
3. Exécute par **lots** (section 8), dans l'ordre. Un lot n'est terminé que s'il respecte la définition de « terminé » ci-dessous.
4. Rapport après chaque lot.

### 0.3 Définition de « terminé » (checklist d'intégration, pour CHAQUE fonctionnalité)
- [ ] Accessible depuis le menu **du bon rôle**, sur desktop **et** mobile.
- [ ] Conditionnée par la bonne **permission** ET la bonne **règle** (événement actif, réglage de l'établissement).
- [ ] Raccordée au bon **événement** et aux bonnes **notifications**.
- [ ] États vide, chargement, erreur soignés, avec un message adapté (un vide n'est pas « aucun résultat pour votre recherche »).
- [ ] Libellés en français (ou anglais selon l'établissement) : **aucune clé de traduction brute, aucun « v2 », aucun code technique** (ADMIN, STAFF, AUTOSERVICE…).
- [ ] Thème clair et sombre, mobile (375 px) à desktop (1920 px), bouton « Assistant IA » sans chevauchement.
- [ ] Testée (unitaire et parcours de bout en bout).

### 0.4 Interdits
- Aucun deuxième mécanisme parallèle : les campagnes datées passent **uniquement** par les **Événements académiques**.
- Aucun réglage qui permette de contourner une règle fixe de la section 1.
- Aucune suppression d'écran ou de donnée sans accord de Chris.
- Aucun nouveau backend sans son écran et son point d'entrée dans le même lot.

### 0.5 Décisions à confirmer
Les points marqués **[À CONFIRMER]** ont une valeur par défaut. Applique-la, rends-la configurable si c'est simple, et signale-la dans ton rapport.

---

## 1. La colonne vertébrale

### 1.1 Six principes d'harmonie
1. **L'événement académique est le déclencheur.** L'administrateur lance des fenêtres datées (concours, choix LV2, etc.). Les écrans liés apparaissent dans la navigation **pendant la période active** : c'est le mécanisme déjà décrit dans l'écran des événements, et il devient la règle pour les concours.
2. **Un concours = un événement + une session d'examen (relation 1 pour 1).** La création de l'événement « Concours d'entrée » crée la session d'examen. **Le secrétaire ne crée jamais de concours.** Il voit l'événement en cours, de façon synchronisée, et inscrit les candidats.
3. **Deux voies d'entrée dans l'établissement :**
   - **Voie concours** (6e toujours ; autres niveaux si l'établissement les a activés) : les admis réussissent, sont confirmés (CEP pour la 6e), et sont inscrits **sans validation supplémentaire de l'administrateur**. L'administrateur a déjà décidé en délibérant et en publiant.
   - **Voie dossier** (inscription ponctuelle) : pour ceux qui n'ont pas fait le concours, l'ont échoué, étaient absents, ou entrent à un niveau sans concours. Le secrétaire crée le dossier, l'administrateur **valide**, renvoie ou refuse. L'administrateur a toujours le dernier mot sur la voie dossier.
4. **Un vocabulaire unique** de statuts (section 1.2), utilisé dans tous les écrans, notifications et rapports.
5. **Une seule règle de cycle** : `CycleResolver` (1er cycle, 2nd cycle). Les libellés d'écran en dérivent ; aucun texte codé en dur (« Form 4+ », etc.).
6. **Papier et numérique cohabitent.** La plateforme génère les **fiches imprimables** (fiche d'inscription, fiche de candidature au concours, liste des pièces) avec **toutes les informations dont le système a besoin** de la part de l'élève et du parent. La famille les remplit à la main ; le secrétaire transcrit dans le dossier.

### 1.2 Vocabulaire des statuts (libellés affichés)

**Dossier d'inscription**
| Statut technique | Libellé |
|---|---|
| DRAFT | Brouillon |
| LINK_SENT | Chez la famille |
| SUBMITTED | Soumis à la direction |
| RETURNED | À compléter |
| VALIDATED → ACTIVATED | Inscrit |
| REJECTED | Refusé |
| EXPIRED | Expiré |
Source du dossier (pastille) : Concours · Hors concours · Transfert · Lien famille · Import.

**Candidat au concours**
Inscrit · Présent / Absent · Noté · Admis provisoirement · Liste complémentaire · Non admis · Confirmé · Place perdue (échec au CEP) · Désisté.

### 1.3 Rôles et pouvoirs (rappel)
- **Secrétaire** : prépare les dossiers, inscrit les candidats, gère convocations, émargement, notes, saisie des résultats du CEP (soumis à validation), finalise les inscriptions des admis. Ne crée ni événement, ni session, ne valide rien, ne publie rien.
- **Administrateur** : lance et clôture les événements, configure les concours, délibère, publie les résultats, valide la saisie du CEP, valide les dossiers de la voie dossier, accorde les dérogations de capacité. Il ne crée ni plans de frais ni factures (supervision financière en lecture seule).

---

## 2. Les parcours, pas à pas

### J1 — Concours d'entrée en 6e (et J2 : autres concours, même circuit)

| # | Qui | Quoi | Où | Effet / synchronisation |
|---|---|---|---|---|
| 1 | Administrateur | Planifie l'événement « Concours d'entrée en 6e » : niveaux visés, dates, places, épreuves et coefficients, frais, pièces de candidature, confirmation par le CEP | Événements académiques > Nouvel événement | Création de la session liée. |
| 2 | Système | À la date d'ouverture (ou au clic « Lancer ») | — | L'entrée « Concours d'entrée » apparaît dans la sidebar du secrétaire ; carte « Événement en cours » sur son tableau de bord ; notification. |
| 3 | Secrétaire | Inscrit les candidats : saisie, fichier Excel/CSV, PDF/Word numérique, photo/scan | Concours d'entrée > Candidats | Code candidat généré ; détection des doublons ; pièces et frais suivis. |
| 4 | Secrétaire | Répartit en salles, imprime convocations et listes d'émargement, envoie les convocations par SMS | Concours d'entrée > Convocations & salles | — |
| 5 | Secrétaire | Émargement le jour J (présent/absent) | Concours d'entrée > Émargement | Utilisable hors ligne. |
| 6 | Secrétaire | Saisit les notes par épreuve (anonymat si activé) | Concours d'entrée > Notes | — |
| 7 | Administrateur | Délibère : seuil, places, liste complémentaire | Concours (cockpit) > Délibération | Verrouillage de la délibération. |
| 8 | Administrateur | Publie les résultats | Concours (cockpit) > Publication | **SMS à TOUS les parents** (admis provisoirement, non admis, liste complémentaire) après estimation et confirmation ; affiche imprimable ; consultation individuelle. |
| 9 | Secrétaire | Saisit les résultats du CEP quand ils sortent (en lot) et les soumet | Concours d'entrée > Résultats du CEP | — |
| 10 | Administrateur | Valide la saisie du CEP (un clic) | Concours (cockpit) > Résultats du CEP | Confirmés → dossier pré-rempli créé pour le secrétaire, **aucun SMS** ; échec → place libérée, promotion de la liste complémentaire (SMS **au promu uniquement**, à confirmer). |
| 11 | Secrétaire | Finalise l'inscription des confirmés : complète famille, pièces, classe | Inscriptions > « Admis à finaliser » | **Inscrit sans validation de l'administrateur.** Comptes créés selon le profil d'accès. |
| 12 | Administrateur | Clôture l'événement | Événements académiques | L'entrée disparaît des sidebars ; l'historique reste dans Rapports > Sessions de concours. |

### J3 — Inscription ponctuelle sur dossier (voie dossier)
1. Le secrétaire reçoit la famille (ou son dossier), remet la **fiche d'inscription imprimable** si besoin.
2. Il crée le dossier (« Nouveau dossier », origine « Hors concours » ou « Transfert »), le complète, le **soumet**.
3. L'administrateur est notifié, examine, **valide / renvoie avec commentaire / refuse** (motif).
4. À la validation, l'inscription est activée (comptes, classe) dans la même transaction. Le secrétaire est notifié.

### J4 — Retardataires, échoués, absents au concours
Même circuit que J3, avec la source « Hors concours » et un **motif** obligatoire (absent au concours, échec, arrivée tardive, autre) affiché à l'administrateur. Ces candidats peuvent toujours faire la demande, même après la clôture du concours.

---

## 3. Le secrétaire : sidebar et pages

### 3.1 Sidebar finale (neuf entrées au maximum)

```
Tableau de bord
ADMISSIONS & CONCOURS
   Inscriptions
   Concours d'entrée            (visible seulement pendant un concours actif)
   Élèves & familles            [À CONFIRMER : recommandé]
VIE SCOLAIRE & SUIVI
   Rapports & Statistiques
COMMUNICATION
   Messagerie
   Babillard
MON COMPTE
   Mon profil RH
   Synchronisation hors ligne   (badge = éléments en attente)
```
Le sous-titre sous le logo et sous le nom d'utilisateur affiche le **titre du rôle** (« Secrétaire » : déjà fait). L'entrée « Configuration » n'existe pas pour un secrétaire seul.

### 3.2 Tableau de bord (aujourd'hui vide : à construire en priorité)

**Objectif** : en 5 secondes, le secrétaire sait ce qui est en cours et ce qu'il doit faire maintenant.

**Desktop** (grille à 12 colonnes) :
1. **En-tête** : « Bonjour, Nga » ; sous-titre « Secrétaire · Lycée de Bafia · 2025–2026 » ; à droite « Actualiser » et l'heure de la dernière mise à jour.
2. **Bandeau « Événement en cours »** (pleine largeur, une carte par événement actif, deux au plus puis « voir tout ») :
   - icône, nom (« Concours d'entrée en 6e »), pastille de phase (« Inscriptions ouvertes »), frise miniature des phases ;
   - dates clés (« Clôture des inscriptions dans 5 jours »), compteurs (« 142 candidats / 120 places »), barre de progression ;
   - boutons : « Inscrire des candidats » (principal), « Ouvrir le concours ».
   - Si aucun événement actif mais un à venir : carte discrète « À venir : Concours … ouverture le … ». Sinon, la zone n'apparaît pas.
3. **Cinq cartes d'action cliquables** (grand compteur, libellé, explication d'une ligne) :
   - « À compléter » (renvoyés par la direction) : accent orange, **en premier**, avec le dernier commentaire ;
   - « Admis à finaliser » (visible s'il y a des dossiers de concours) ;
   - « Brouillons » ;
   - « Chez la famille » ;
   - « En attente de la direction ».
   Chaque clic ouvre Inscriptions avec le bon filtre.
4. **Colonne gauche (2/3) « À faire maintenant »** : liste priorisée (8 lignes maximum) : dossiers à compléter (avec ancienneté), doublons à examiner, pièces manquantes depuis plus de 7 jours, liens famille qui expirent sous 3 jours, SMS échoués à relancer, candidats sans téléphone parent à informer sur papier, résultats du CEP à saisir. Chaque ligne : icône, phrase, bouton d'action. Vide : « Rien d'urgent pour l'instant. »
5. **Colonne droite (1/3)** : « Effectifs » (deux barres par cycle et les trois classes proches de la capacité) ; « Activité récente » (dix dernières actions, dont les décisions de l'administrateur) ; « Synchronisation » (éléments hors ligne en attente).
6. **Raccourcis** : Nouveau dossier (principal), Importer une liste, Imprimer la fiche d'inscription, Documents scolaires, Messagerie.

**Mobile** : colonne unique dans l'ordre événement, cartes d'action (défilement horizontal), à faire maintenant, raccourcis en grille 2×2, effectifs, activité.
**Données** : un endpoint d'agrégation ; actualisation automatique toutes les 60 secondes et à la reprise de la connexion. États : squelettes, erreur avec réessayer.

### 3.3 Inscriptions

**En-tête** : titre « Inscriptions », sous-titre « Dossiers hors concours et dossiers des admis ».
Actions à droite : « Nouveau dossier » (principal) ; « Importer une liste » ; « Imprimer la fiche » (menu : fiche vierge, fiche pré-remplie d'un dossier, fiche de candidature au concours) ; sélecteur de vue **Kanban | Liste**. (« Documents scolaires » quitte cet en-tête : voir 3.6.)

**Bandeau d'alerte** si des dossiers sont « À compléter » : « N dossiers renvoyés par la direction » avec lien.

**Filtres** : recherche (nom, numéro interne) ; niveau/classe ; source ; période ; puces rapides « Admis à finaliser (n) », « Refusés (n) », « Expirés (n) ».

**Kanban à 5 colonnes** (les statuts « Refusé » et « Expiré » ne sont **pas** des colonnes : ils apparaissent par les puces de filtre) :
Brouillons · Chez la famille · Soumis à la direction · À compléter · Inscrits.
- Largeur minimale 260 px ; en dessous de 1280 px, défilement horizontal avec accroche ; sur mobile, puces de statut + liste de cartes.
- En-tête de colonne : icône, libellé, compteur. Colonne vide : phrase courte (« Aucun brouillon », grammaire correcte) ; la première colonne propose « Nouveau dossier ».
- Les dossiers des admis du concours apparaissent dans « Brouillons » avec la pastille « Concours », triés en premier.
- **Carte** : photo ou initiales, nom, classe demandée, pastille de source, anneau de complétude, date de dernière modification, icônes d'alerte (doublon, classe pleine, pièces manquantes), commentaire de la direction sur deux lignes pour « À compléter », menu ⋯.

**Vue Liste** : colonnes Élève, Niveau/Classe, Source, Statut, Complétude, Modifié le, Actions ; tri, sélection multiple (soumettre en lot les brouillons complets), pagination.
**États** : vide global avec illustration sobre et « Créer le premier dossier ».
**Mobile** : le bouton « Nouveau dossier » va dans la barre du haut (le coin bas droit est pris par « Assistant IA »).

### 3.4 Nouveau dossier — assistant en six étapes

**Mise en page desktop** : formulaire centré (760 px maximum) + **panneau latéral droit** (320 px, fixe) : nom et niveau, anneau de complétude, alertes en direct (« Élève très proche déjà enregistré », « 6e A : 38/40 places »), et l'**accès numérique résolu** en une phrase. Barre d'étapes en haut (les étapes validées sont cliquables). **Enregistrement automatique** (« Brouillon enregistré à 10:42 »).
**Validation** : « Continuer » est bloqué tant qu'un champ obligatoire de l'étape est vide (erreur sous le champ, focus dessus). Les étapes de l'écran actuel laissent passer avec des champs vides : à corriger.

**Étape 1 — Élève**
- Origine (choix segmenté) : Hors concours (défaut) · Admis au concours (ouvre un sélecteur de candidat confirmé et **pré-remplit**) · Transfert · Autre. **Plus de code brut « AUTOSERVICE ».**
- Nom*, Prénom(s)*, Sexe*, Date de naissance* (sélecteur de date et saisie JJ/MM/AAAA), Lieu de naissance, Nationalité (défaut : camerounaise), Photo (facultative, prise de photo sur mobile), Sous-système (défaut : celui de l'établissement), Matricule national (facultatif).
- Doublon détecté dès que nom et date de naissance sont saisis.

**Étape 2 — Scolarité**
- Niveau demandé* : **liste des niveaux réels** de l'établissement (plus de champ libre).
- Série/filière si 2nd cycle.
- **Classes proposées** sous forme de cartes triées par places disponibles (« 6e A — 34/40 ») ; les classes pleines sont grisées avec la mention « dérogation de la direction ».
- Établissement d'origine, dernière classe suivie, année, redoublant, LV2 et PEBS si applicables.
- Si le niveau admet le concours et que l'origine est « Hors concours » : message « Ce niveau admet sur concours : le dossier sera signalé "hors concours" à la direction » et **motif obligatoire**.

**Étape 3 — Famille**
- Blocs Père, Mère, Tuteur légal (au moins un responsable*) : nom, prénom, lien, téléphone, email, profession (facultatif), adresse ou quartier ; cases « Contact principal » et « Responsable financier » ; contact d'urgence.
- Case **« Aucun téléphone disponible »** : autorise la poursuite et marque « à informer sur papier » (le téléphone du parent n'est donc plus un champ bloquant).

**Étape 4 — Accès numérique**
- Question élève : Aucun téléphone · Téléphone simple · Smartphone Android · iPhone.
- Question parent responsable : mêmes choix.
- **Carte résultat** calculée par `resoudreProfilAcces` et `CycleResolver` : une phrase claire (« L'élève n'a pas de compte ; tout passe par le parent ; notifications par SMS ») et trois pictogrammes : compte élève (complet / lecture / aucun), profil géré par (parent / élève / secrétariat), notifications (appli / SMS / papier). Bouton « Modifier manuellement » (tracé).
- Supprimer le libellé « (Second cycle / Form 4+) » : la question s'adresse à **tous** les élèves ; c'est le cycle qui décide des droits.

**Étape 5 — Pièces**
- Liste de contrôle configurée dans Paramètres, selon l'origine : intitulé, obligatoire/facultative, interrupteur « Reçue » (date automatique, nom du réceptionnaire), note. Anneau de complétude.
- Case « Dossier validable sous réserve » si des pièces obligatoires manquent.
- Bouton « Imprimer la liste des pièces manquantes » (à remettre à la famille).

**Étape 6 — Récapitulatif**
- Résumé lisible par sections avec liens « Modifier » ; avertissements (doublon, capacité, pièces).
- Boutons : « Enregistrer le brouillon » ; « **Soumettre à la direction** » (voie dossier) ou « **Finaliser l'inscription** » (admis au concours : pas de validation) ; « Imprimer la fiche pré-remplie ».
- L'écran actuel affiche « (Sexe non précisé) » à la place du nom, « Classe : Non affectée », et un titre « Récapitulatif & Validation » sous un onglet nommé « Pièces & Finalisation » : à harmoniser.
- Après envoi : message de succès avec la suite (« Dossier soumis : la direction est notifiée ») et boutons « Nouveau dossier » / « Retour aux dossiers ».

**Mobile** : barre d'étapes compacte ; le panneau de résumé devient un bandeau en bas (« Résumé — 2 alertes ») qui s'ouvre en feuille.

### 3.5 Dossier ouvert (page ou tiroir)
- **En-tête** : photo, nom, numéro interne, pastille de statut, classe, source. Actions selon le statut : Modifier, Soumettre, Imprimer la fiche, Envoyer le lien à la famille, Supprimer le brouillon.
- **Bandeau « Renvoyé par la direction »** : commentaire complet, date, auteur, bouton « Corriger ».
- **Onglets** : Résumé · Élève · Famille · Scolarité & classe · Accès numérique · Pièces · Frais (lecture seule, état de facturation) · Historique (chronologie : créé, soumis, renvoyé, validé, SMS envoyés).
- Mobile : onglets défilants.

### 3.6 Concours d'entrée (côté secrétaire)

**Visibilité** : l'entrée apparaît dans la sidebar **du lancement de l'événement jusqu'à sa clôture finale**. Elle couvre donc la composition, la correction, la délibération, la publication et la confirmation par le CEP. Après la clôture, l'historique reste dans Rapports > Sessions de concours. [À CONFIRMER : visible seulement pendant l'événement actif]

**Le formulaire « Créer une session » disparaît de cet écran.** La configuration (places, seuil, épreuves, frais, dates) est faite par l'administrateur dans l'événement ; le secrétaire peut la **consulter** (bouton « Voir la configuration »). Retirer aussi le libellé « Gestion complète v2 ».

**Page** :
- **Sélecteur d'événement** (cartes horizontales) s'il y a plusieurs concours actifs (par exemple « Concours 6e » et « Concours 4e / 2nde »).
- **Carte d'en-tête** : nom, niveaux visés, **frise des phases** (Inscriptions → Convocations → Composition → Correction → Délibération → Publication → Confirmation CEP → Clôture) avec la phase courante ; dates clés ; compteurs ; ligne « Prochaine action du secrétariat : … » avec bouton contextuel.
- **Onglets** (tous visibles ; ceux qui ne sont pas encore disponibles sont verrouillés avec une explication : « Disponible après la clôture des inscriptions ») :
  1. **Candidats** : tableau (code, nom, niveau visé, école d'origine, téléphone parent, source, pièces, frais) ; bouton « Ajouter des candidats » qui ouvre l'assistant à **quatre sources** (Saisie · Fichier Excel/CSV · PDF/Word numérique · Photo ou scan) menant à **un seul écran de vérification** (tableau modifiable, doublons, erreurs en rouge, confirmation avant enregistrement) ; compteur « inscrits / places » ; export ; impression de la fiche de candidature ; filtres « pièces manquantes », « frais non réglés ».
  2. **Convocations & salles** : répartition automatique (capacité des salles), modification manuelle, PDF des convocations avec QR code, listes d'émargement, envoi des convocations par SMS.
  3. **Émargement** : recherche ou scan du code, présent/absent par salle, compteurs, fonctionne hors ligne.
  4. **Notes** : grille par épreuve, contrôle du maximum, double saisie facultative, fiches à souche et anonymat si activé, progression par épreuve.
  5. **Résultats** (lecture seule) : état de la délibération, listes une fois publiées, **suivi des SMS** (envoyés, échoués, relance), affiche PDF.
  6. **Résultats du CEP** : saisie en lot (import de liste ou liste à cocher, rapprochement nom + date de naissance), puis « Soumettre à la direction pour validation ».
  7. **Admis à finaliser** : dossiers pré-remplis des confirmés, bouton « Finaliser », progression.
- **Mobile** : onglets défilants ; les tableaux deviennent des cartes.

### 3.7 Élèves & familles [À CONFIRMER : page recommandée]
Remplace la fenêtre « Documents scolaires » cachée dans Inscriptions et donne au secrétaire un point d'entrée sur les élèves déjà inscrits.
- Recherche (nom, matricule, numéro interne, téléphone du parent), filtres (niveau, classe, statut, accès numérique), liste.
- **Fiche élève** : identité, classe, famille (parents, tuteurs, contacts), **profil d'accès** avec actions (renvoyer les identifiants, autoriser la connexion, modifier), documents (certificat de scolarité, carte scolaire, lettre de transfert : aperçu et impression), historique d'inscription, correction de l'état civil (journalisée).
- Permission `MANAGE_ENROLLMENT` ; toute modification est tracée.

### 3.8 Rapports & Statistiques
Onglets : **Effectifs & capacités** · **Dossiers en cours** (renommer « Dossiers incomplets ») · **Sessions de concours** (statistiques par session : inscrits, présents, moyenne, admis, confirmés, taux ; historique) ; export Excel. Les libellés de cycles viennent de `CycleResolver`. Conserver les états vides déjà corrects.

### 3.9 Import Excel
- **Le secrétaire ne voit que « Élèves + Parents » et « Parents ».** Les cartes « Enseignants », « Personnel » et « Classes » sont **masquées pour lui et refusées par le serveur (403)** : un secrétaire qui importerait des comptes du personnel pourrait créer des comptes avec des permissions qu'il n'a pas. Vérifie la liste blanche des types d'import **côté serveur**, par permission.
- Corriger le sous-titre affiché en clé brute (`users.import_modal.step0_desc`).
- Les listes de candidats au concours ne passent pas par cet écran : elles passent par l'assistant de l'onglet Candidats.

### 3.10 Synchronisation hors ligne
Liste des brouillons et émargements en attente (type, date, statut, conflit éventuel), bouton « Synchroniser maintenant », résolution des conflits, badge dans la sidebar.

### 3.11 Notifications (cloche)
Nouvel événement lancé · dossier renvoyé · dossier validé ou refusé · saisie du CEP validée · SMS échoués.

---

## 4. L'administrateur : écrans liés à ce chantier

### 4.1 Sidebar
Un groupe **ADMISSIONS & CONCOURS** (même nom que chez le secrétaire) : « Validation des inscriptions » (badge), « Concours » (visible pendant un concours actif). « Événements académiques » reste dans Communication & vie scolaire. « Supervision financière » (lecture seule) reste dans Pilotage. L'entrée actuelle « Inscriptions en cours d'année » (groupe Administration & comptes) devient « Validation des inscriptions ». Vérifie qu'un accès au concours existe : je ne l'ai pas vu dans la sidebar de l'administrateur.

### 4.2 Événements académiques
**Page** : titre, bandeau explicatif raccourci, « Nouvel événement ».
- **Suggestions** sous forme de cartes : « Concours d'entrée en 6e — non planifié [Planifier] », les autres concours si activés, Choix LV2, Rentrée, PEBS. Fini l'écran vide.
- **Liste en cartes** par état : En cours · À venir · Terminés. Chaque carte : type, nom, dates, phase, compteurs (candidats, dossiers), actions **Gérer · Modifier · Clôturer**. Vue calendrier facultative.

**Assistant « Nouvel événement »** (à la place de la fenêtre actuelle) :
1. **Type** (« Concours d'entrée » en tête de liste) et titre généré (« Concours d'entrée en 6e — 2026-2027 », modifiable). Catégorie : Date fixe (ouverture et clôture automatiques) · Ouverture manuelle.
2. **Cibles** (concours) : niveaux et séries proposés à partir des classes réelles ; la 6e est cochée par défaut ; **places et seuil par cible**.
3. **Calendrier** : ouverture des inscriptions, clôture, date de composition, publication prévue, date attendue des résultats du CEP. **Dates avec heures.**
4. **Épreuves** par cible : nom, coefficient, note maximale ; modèle par défaut modifiable ; anonymat activé ou non.
5. **Frais et pièces** : frais de concours, pièces de candidature, **confirmation par l'examen officiel** (CEP, libellé selon le sous-système) par cible.
6. **Notifications** : rôles à notifier avec libellés français (Administration, Personnel administratif, Enseignants, Parents d'élèves, Élèves) ; **défaut d'un concours : Administration + Personnel administratif**. Les codes ADMIN / STAFF / TEACHER / PARENT / STUDENT ne s'affichent plus.
7. Récapitulatif → « Planifier » ou « Lancer maintenant ».
**Effets** : création de la session liée, notification, apparition dans la sidebar et sur le tableau de bord du secrétaire. Après l'ouverture, seules les dates sont prolongeables ; les épreuves sont verrouillées dès la première note.

### 4.3 Concours (tableau de bord de l'administrateur)
Frise des phases et compteurs en haut. Onglets :
- **Vue d'ensemble** : compteurs, alertes (places, résultats du CEP attendus, SMS échoués).
- **Candidats** : lecture et export.
- **Délibération** : simulateur de seuil (curseur seuil ↔ nombre d'admis, histogramme, ex æquo, liste complémentaire), verrouillage.
- **Publication** : aperçu des trois messages (admis, non admis, liste complémentaire), **estimation du nombre et du coût des SMS**, confirmation, affiche PDF, page publique de consultation.
- **Résultats du CEP** : validation en un clic de la saisie du secrétaire ; places libérées ; promotions de la liste complémentaire à confirmer.
- **Configuration** : lecture, modification limitée.
- **Journal**.
Actions réservées : ouvrir, clôturer, délibérer, publier, valider le CEP, accorder une dérogation.

### 4.4 Validation des inscriptions
- **Bandeau corrigé** : « Les inscriptions sont préparées par le secrétariat. Vous validez chaque dossier hors concours. » Supprimer « Responsable(s) : Censeur / Secrétariat » et « capacité d'intervention directe », qui contredisent la règle. Les boutons « Hub Supervision » et « Mode Supervision » : garder seulement s'ils servent à autre chose, sinon retirer.
- **Titre** : « Validation des inscriptions ». Retirer « (Dossier v2) ».
- **Onglets** : À valider (n) · Renvoyés · Refusés · Historique.
- **Cartes** : élève, classe demandée, source (avec **motif « hors concours »**), complétude, alertes (doublon, capacité, pièces manquantes), ancienneté.
- **Tiroir de revue** : synthèse, pièces, accès numérique résolu, capacité de la classe, historique. Actions **Valider** (contrôle de capacité), **Renvoyer** (commentaire, modèles de motifs), **Refuser** (motif obligatoire).
- **Validation par lot** : case « Tout sélectionner » sur les dossiers sans alerte.
- **États vides distincts** : « Aucun dossier à valider. Tout est à jour. » (sans filtre) et « Aucun dossier ne correspond à votre recherche » (avec filtre).
- **Ligne d'information** : « Les admis au concours sont inscrits sans validation : N cette semaine (voir la liste) », en lecture seule.

### 4.5 Tableau de bord administrateur
Widgets : inscriptions à valider (n), événement en cours, alertes de capacité, échecs de SMS, indicateurs financiers de supervision.

### 4.6 Finances
Supervision en lecture seule (décision déjà prise). Aucune option de gestion des finances par l'administrateur.

---

## 5. Paramètres > Admissions (liste finale)

**A. Concours d'entrée**
- Concours d'entrée en 6e : actif (carte d'information, non désactivable [À CONFIRMER : désactivable pour un établissement qui admet sur dossier]) avec ses **valeurs par défaut** : épreuves et coefficients, frais, pièces de candidature, confirmation par le CEP (libellé selon le sous-système), mode de publication (alphabétique ou classement), liste publique en ligne (non par défaut), délai de réservation de place (14 jours).
- « Concours pour d'autres niveaux » : interrupteur, puis niveaux et séries à cocher (issus des classes réelles), avec les mêmes valeurs par défaut par cible. Les événements reprennent ces valeurs.

**B. Dossiers d'inscription**
- Liste des pièces justificatives par cas (nouvel élève, transfert, redoublant, admis au concours) : obligatoire ou facultative.
- **Marge de capacité tolérée (%)** : au-delà de « capacité + marge », seul l'administrateur peut déroger, avec motif.
- Numéro interne : préfixe et format.
- **Lien d'inscription pour les familles (sur invitation)** : activer, durée de validité (14 jours), rappel automatique. Renommer « Portail d'auto-inscription public », qui laisse croire à une page ouverte à tous. [À CONFIRMER : pas de page publique ouverte sans invitation]

**C. Gouvernance**
- **Règle fixe, affichée en information (non désactivable)** : « Tout dossier hors concours est validé par l'administrateur. Les admis au concours sont inscrits sans validation supplémentaire. »
- Supprimer l'interrupteur « Validation obligatoire par l'Administrateur » : il permettrait de contourner une règle décidée.
- Garder l'interrupteur « L'administrateur peut aussi inscrire lui-même » (`adminGereInscriptions`).
- **Supprimer « Gestion directe des finances par l'Admin »** (décision de Chris).

**D. Accès numériques**
- Règle affichée en information : 1er cycle → le parent gère le profil ; 2nd cycle avec smartphone → l'élève gère le sien ; sans smartphone → tout passe par le parent ; parent sans smartphone → SMS ; sans téléphone → papier.
- Envoi automatique des identifiants par SMS : oui/non.
- **Supprimer** « Seuil d'âge pour accès Parent obligatoire (15 ans) » et « Destinataire par défaut des accès : Élève uniquement » : la règle du cycle les remplace (l'âge reste un repli interne si le niveau est inconnu).

**E. SMS et notifications**
Messages du concours (aperçu, langue), seuil de confirmation avant envoi en masse (50 par défaut), nom d'expéditeur.

**F. Documents imprimables**
En-tête de l'établissement (logo, devise), langue de la fiche d'inscription, image de cachet (facultative).

**Retirer** « Admission directe sans concours » : la voie dossier est toujours disponible (avec validation), cet interrupteur contredit le modèle.
**Ergonomie** : barre d'enregistrement collée en bas de page avec marge de sécurité (le bouton « Enregistrer » est aujourd'hui **masqué par « Assistant IA »**) ; indicateur « modifications non enregistrées ».

---

## 6. Défauts relevés sur les captures (par écran)

**Événements académiques (liste, modal)**
- Écran vide sans aide ; aucun événement de type concours proposé ; la fenêtre actuelle n'a **aucun champ propre au concours**.
- Rôles à notifier en codes anglais bruts (ADMIN, STAFF, TEACHER, PARENT, STUDENT).
- Dates sans heure. Type par défaut « Rentrée 6e/5e ».

**Paramètres > Admissions** : voir section 5. En plus : interrupteur « Gestion directe des finances » encore présent ; bouton « Enregistrer » partiellement masqué.

**Validation des inscriptions (administrateur)** : « (Dossier v2) » dans le titre ; bandeau contradictoire ; message vide « Aucun dossier ne correspond à votre recherche » alors qu'il n'y a aucun dossier ; entrée nommée « Inscriptions en cours d'année ».

**Inscriptions (secrétaire, kanban)** : six colonnes qui passent sur deux lignes en laissant un vide ; « Aucun dossier brouillons internes » (grammaire) ; pas de sélecteur Kanban | Liste ; « Documents scolaires » dans l'en-tête ; pas de bandeau « à compléter ».

**Nouveau dossier (secrétaire)**
- Étape 1 : « Prénom(s) » et « Date de naissance » facultatifs ; « Origine du dossier » affichée « Inscription directe / Secrétariat » alors que le récapitulatif indique **AUTOSERVICE** (incohérence de données).
- Étape 2 : simple champ libre « Niveau recherché » ; aucune classe, aucune capacité, aucune proposition.
- Étape 3 : ni nom du parent, ni lien de parenté, ni adresse, ni contact d'urgence ; téléphone du parent obligatoire (bloque le cas « aucun téléphone ») ; libellé « (Second cycle / Form 4+) » qui contredit `CycleResolver` (les Rapports indiquent Form 1–5 en 1er cycle).
- Étape 4 : aucune pièce, alors que l'étape se nomme « Pièces & Finalisation » et le titre « Récapitulatif & Validation » ; la liste est associée « en validant » (invisible avant) ; **on peut avancer et soumettre avec des champs vides**.
- Aucune fiche imprimable, aucun panneau de résumé, aucune jauge, aucune indication d'enregistrement automatique.

**Concours d'entrée (secrétaire)** : le formulaire « Créer une session » (nom, date, année, seuil, places) contredit le principe « l'administrateur lance l'événement » ; « Gestion complète v2 » visible ; un seul seuil et un seul nombre de places pour toute la session.

**Import Excel** : clé brute affichée ; types d'import (Enseignants, Personnel, Classes) hors du rôle du secrétaire.

**Rapports** : c'est le meilleur écran : traduction et libellés corrigés. À harmoniser : « Dossiers en cours », onglet Concours détaillé.

**Tableau de bord du secrétaire** : toujours vide.

---

## 7. Règles transversales

**Design** : mêmes jetons, polices et espacements que le babillard ; pages de gestion plus sobres, cartes « papier » pour les dossiers ; pastilles de statut avec libellé (jamais la couleur seule) ; anneaux de complétude ; animations sobres (tampon « Validé »), désactivées si l'utilisateur préfère moins d'animations. Thème sombre : ne jamais forcer une couleur de texte sur une surface qui ne change pas de thème. 13 px minimum pour les textes secondaires. Bouton d'action principal facile à toucher (44 px). Marge basse pour ne jamais passer sous « Assistant IA ».

**Langue** : libellés selon le sous-système de l'établissement (francophone, anglophone, ou langue choisie par l'utilisateur pour un établissement bilingue).

**Sécurité et permissions** : tout est vérifié côté serveur. Import : liste blanche des types par permission. Aucun lien public permanent vers des pièces ou des données de mineurs. Page publique de résultats : limitation de débit dédiée, réponse identique que le code existe ou non.

**Notifications** : SMS de résultats du concours à **tous** les parents à la publication (admis provisoirement, non admis, liste complémentaire) ; **aucun** SMS à la confirmation par le CEP ; SMS au promu de la liste complémentaire ; estimation et confirmation avant tout envoi en masse ; identifiant de campagne pour éviter les doublons ; nouvelles tentatives des échecs ; suivi visible.

**Traçabilité** : chaque transition de dossier ou de concours est écrite dans le journal, **dans la transaction**.

---

## 8. Ordre d'exécution : cinq lots reliés

Chaque lot doit remplir la définition de « terminé » (0.3) **et** rester cohérent avec les précédents.

**Lot 1 — La colonne vertébrale (événement ↔ concours ↔ navigation)**
- Événements académiques : suggestions, assistant « Nouvel événement » avec le type Concours d'entrée, libellés français, dates avec heures.
- Création de la session liée, suppression du formulaire « Créer une session » côté secrétaire, visibilité des entrées de sidebar (secrétaire, administrateur) pendant l'événement actif, carte « Événement en cours » et notification.
- **Critère** : l'administrateur lance un concours, l'entrée apparaît chez le secrétaire sans rechargement manuel [ou après actualisation], et disparaît à la clôture.

**Lot 2 — La voie dossier (hors concours)**
- Assistant « Nouveau dossier » en six étapes, fiche imprimable, page « Validation des inscriptions » complète, Paramètres > Admissions nettoyés (section 5), import restreint, fiche du dossier ouvert.
- **Critère** : parcours J3 et J4 de bout en bout (création, soumission, renvoi, correction, validation, activation), sans aucune clé brute ni code technique.

**Lot 3 — La voie concours**
- Pages du secrétaire (Candidats avec les quatre sources, Convocations & salles, Émargement, Notes, Résultats, Résultats du CEP, Admis à finaliser) et cockpit de l'administrateur (délibération, publication, validation du CEP).
- Règle de notification (section 7), libération des places, promotion de la liste complémentaire, dossier pré-rempli et finalisation **sans validation de l'administrateur**.
- **Critère** : le scénario de bout en bout (10 candidats, un import Excel, notes, délibération, publication avec estimation des SMS, CEP en lot, validation, promotion, finalisation) passe en mode SMS simulé.

**Lot 4 — Finances en supervision**
Déjà spécifié : suppression de `adminGereFinances`, lecture seule pour l'administrateur, écran complet de l'intendant, historique des modifications.

**Lot 5 — Tableaux de bord, « Élèves & familles » et vérification**
- Tableau de bord du secrétaire (3.2) et widgets de l'administrateur (4.5).
- Page « Élèves & familles » [À CONFIRMER].
- Matrice « fonctionnalité × rôle × écran monté », tests automatisés (sidebar par titre, composants orphelins, parcours par rôle), comptes de démonstration par rôle, données de démonstration.

**Rapport de chaque lot** : ce qui existait, ce qui a été modifié, ce qui reste ; captures **par écran** en clair et sombre, mobile et desktop ; résultats des tests ; écarts avec ce document.

---

## 9. Décisions à confirmer par Chris

1. L'entrée « Concours d'entrée » n'apparaît **que pendant un événement actif** (défaut) ou reste visible toute l'année ?
2. Les admis au concours sont inscrits **sans validation** de l'administrateur (décidé). Une **dérogation de capacité** reste-t-elle réservée à l'administrateur ? (défaut : oui)
3. Ajouter la page **« Élèves & familles »** dans la sidebar du secrétaire ? (défaut : oui)
4. Le **lien d'inscription pour les familles** est-il uniquement sur invitation (défaut) ou existe-t-il une page publique ouverte ?
5. Le concours d'entrée en 6e est-il **désactivable** pour un établissement qui admet tout le monde sur dossier ? (défaut : oui)
6. Qui saisit les **notes** du concours : le secrétaire (défaut) ou des correcteurs désignés ?
7. Langue des fiches imprimables : celle de l'établissement, avec version bilingue à la demande ?
