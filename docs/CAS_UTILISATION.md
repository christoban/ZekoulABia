# DIAGRAMME DE CAS D'UTILISATION — ZEKOULABIA

> Chaque cas d'utilisation = **un objectif métier** qu'un acteur veut atteindre grâce au système.
> Les sous-cas d'utilisation sont indentés sous leur parent.
> Acteurs identifiés : **8 types d'acteurs humains**.

---

## ACTEUR : VISITEUR (non connecté)

Personne qui n'a pas encore de compte ou qui n'est pas connectée.

```
Utiliser la plateforme
├── Découvrir ZekoulABia (landing page)
├── Se connecter
│   ├── S'authentifier par mot de passe
│   ├── Valider le code email (OTP)
│   └── Valider le code TOTP (MFA) — si ADMIN/STAFF/TEACHER
├── Réinitialiser son mot de passe
├── Accepter une invitation
│   └── Définir son mot de passe
└── Effectuer l'onboarding Phase 1 (wizard d'inscription)
    ├── Renseigner le sous-système (FRANCOPHONE/ANGLOPHONE/BILINGUAL)
    ├── Choisir le template d'établissement
    ├── Configurer les cycles et niveaux
    ├── Activer le PEBS (Programme Spécial Bilingue) si applicable
    └── Définir le mot de passe administrateur
```

---

## ACTEUR : MASTER (super-admin plateforme)

Gère l'ensemble des écoles clientes et la plateforme.

```
Gérer la plateforme
├── Gérer le cycle de vie des écoles
│   ├── Inviter une nouvelle école
│   ├── Approuver une école (après wizard Phase 1)
│   ├── Rejeter une école
│   ├── Suspendre une école
│   ├── Réactiver une école suspendue
│   └── Changer le plan d'abonnement d'une école
├── Administrer son compte Master
│   ├── Se connecter (MFA obligatoire)
│   ├── Configurer le MFA
│   └── Consulter les logs d'authentification
├── Débloquer un compte utilisateur
│   └── Réinitialiser le MFA d'un compte bloqué
├── Consulter les statistiques plateforme
│   ├── Voir la liste des écoles (actives/suspendues/en attente)
│   └── Voir les logs d'activité
└── Gérer son profil
```

---

## ACTEUR : ADMIN (chef d'établissement)

Rôle central : configure et administre l'établissement au quotidien.

```
1. Configurer l'établissement
├── Effectuer l'onboarding Phase 2 (conversationnel)
│   ├── Réconcilier les données de la Phase 1
│   ├── Compléter les questions manquantes (LV2, calendrier, frais)
│   └── Activer l'établissement (création déterministe classes/matières/sections)
├── Modifier le profil de l'établissement
│   ├── Mettre à jour le nom, ville, téléphone, email
│   ├── Modifier le sous-domaine
│   ├── Modifier le logo
│   └── Définir le code MINESEC
├── Paramétrer l'établissement
│   ├── Configurer les paramètres régionaux (fuseau, devise)
│   ├── Configurer les notifications
│   └── Configurer la politique des bulletins
└── Gérer les templates et coefficients
    ├── Consulter/mettre à jour les coefficients par cycle
    ├── Consulter les coefficients BAC officiels
    └── Synchroniser les coefficients manquants

2. Gérer la structure pédagogique
├── Gérer les classes
│   ├── Créer une classe
│   ├── Modifier une classe
│   ├── Supprimer une classe
│   ├── Assigner un professeur principal
│   └── Créer des sous-groupes TP
├── Gérer les matières
│   ├── Créer une matière
│   ├── Modifier une matière
│   ├── Supprimer une matière
│   ├── Assigner un enseignant à une matière
│   └── Définir les coefficients
├── Gérer les sections (pour établissements bilingues)
├── Gérer les départements pédagogiques
│   ├── Créer un département
│   └── Affecter des matières à un département
└── Gérer les combinaisons A-Level
    ├── Affecter les matières A-Level à un élève
    ├── Préremplir depuis une combinaison officielle
    └── Appliquer une combinaison à toute une classe

3. Gérer l'année académique
├── Créer une année académique
├── Définir les périodes (trimestres/terms)
├── Définir les séquences (DS, composition, examens)
├── Définir la période courante
├── Mettre à jour le calendrier scolaire
├── Gérer les événements académiques
│   ├── Créer un événement (examen, vacance, réunion)
│   ├── Déclencher un événement planifié
│   └── Lier une ressource (LV2, concours) à un événement
└── Clôturer l'année
    ├── Vérifier les prérequis de clôture
    └── Promouvoir les élèves

4. Gérer les utilisateurs
├── Gérer les enseignants
│   ├── Créer un compte enseignant
│   ├── Modifier un compte enseignant
│   ├── Supprimer un compte enseignant
│   ├── Importer des enseignants (Excel)
│   └── Designer un animateur pédagogique (AP)
├── Gérer les élèves
│   ├── Créer un compte élève
│   ├── Inscrire un élève
│   ├── Transférer un élève vers une autre classe
│   ├── Importer des élèves (Excel)
│   └── Supprimer un compte élève
├── Gérer le personnel (STAFF)
│   ├── Créer un compte staff avec titre et permissions
│   ├── Modifier un compte staff
│   └── Supprimer un compte staff
├── Gérer les parents
│   ├── Créer un compte parent
│   └── Associer un parent à un ou plusieurs élèves
└── Gérer les comptes
    ├── Lister tous les utilisateurs (filtrés par rôle/classe)
    ├── Rechercher un utilisateur
    ├── Modifier le rôle d'un utilisateur
    └── Supprimer un utilisateur

5. Gérer les notes
├── Voir l'état des notes (par classe, période, matière)
├── Valider une note (soumise par l'enseignant)
├── Valider des notes en bloc
├── Rejeter une note (avec notification à l'enseignant)
└── Consulter les notes verrouillées après génération des bulletins

6. Gérer les bulletins
├── Générer les bulletins d'une classe
│   ├── Vérifier les prérequis (notes VALIDATED + conseil de classe verrouillé)
│   ├── Calculer les moyennes, rangs et mentions
│   └── Générer les PDF (par template) + verrouiller les notes
├── Envoyer les bulletins aux parents (email)
├── Consulter les bulletins générés
└── Configurer les templates de bulletins

7. Gérer les présences
├── Consulter les statistiques de présence par classe/période
├── Configurer les seuils d'alerte d'absence
└── Visualiser les absences justifiées/non justifiées

8. Gérer les emplois du temps
├── Créer un emploi du temps
│   ├── Définir la grille horaire (créneaux, pauses)
│   └── Ajouter des créneaux (matière, enseignant, salle)
├── Modifier un créneau
├── Publier un emploi du temps
├── Gérer la génération automatique (IA Groq)
├── Configurer la grille horaire
│   ├── Définir les jours ouvrés
│   └── Paramétrer les horaires
├── Gérer les créneaux électifs
│   ├── Créer un créneau LV2
│   └── Créer un créneau A-Level
└── Consulter les demandes de rattrapage

9. Gérer les finances
├── Gérer les plans de frais
│   ├── Créer un plan de frais (type, montant, échéances)
│   ├── Copier les plans de l'année précédente
│   └── Modifier/Supprimer un plan
├── Gérer les factures
│   ├── Générer une facture individuelle
│   ├── Générer des factures en masse
│   └── Consulter l'état des factures (impayées, payées, en retard)
├── Gérer les paiements
│   ├── Enregistrer un paiement en espèces (cash)
│   ├── Initier un paiement Mobile Money (MTN/Orange)
│   ├── Traiter les notifications de paiement (webhook Campay)
│   └── Rembourser une caution
├── Gérer les dépenses
│   ├── Enregistrer une dépense
│   └── Consulter l'historique des dépenses
├── Gérer les cautions
│   ├── Consulter les cautions en cours
│   └── Rembourser une caution
└── Consulter les rapports financiers
    ├── Voir les revenus par période
    ├── Voir les impayés par élève
    └── Consulter les transactions APEE

10. Gérer les concours d'entrée (6e)
├── Créer une session de concours
├── Ajouter des candidats (manuel / Excel / scan IA)
│   └── Scanner une liste papier via IA (Groq Vision)
├── Calculer l'admission (seuil/places)
├── Enregistrer les résultats du CEP
│   └── Confirmer l'admission → créer le dossier d'onboarding élève
├── Détecter des anomalies (doublons, scores suspects)
├── Consulter le résumé d'une session
└── Suivre le statut des candidats (PENDING → ADMIS → CONFIRME/ANNULE)

11. Gérer les examens PEBS
├── Créer une session PEBS (niveau + classe cible)
├── Inscrire des candidats
├── Calculer la sélection
├── Appliquer le transfert (confirmation explicite → changement de classe)
├── Détecter des anomalies
├── Consulter le résumé d'une session
└── Scanner une liste de candidats (IA Vision)

12. Gérer les choix LV2
├── Ouvrir une fenêtre de choix LV2 (niveau, dates)
├── Suivre les soumissions des élèves
├── Saisir un choix manuellement (pour un élève sans accès)
└── Appliquer les choix (affectation LV2 en masse)

13. Gérer l'orientation scolaire
├── Créer une fiche d'orientation pour un élève
├── Configurer les checkpoints d'orientation
├── Saisir les aspirations de l'élève
├── Ajouter un entretien d'orientation
├── Ajouter un test d'aptitude
├── Créer une recommandation de série
├── Valider une recommandation (conseiller)
├── Suivre l'orientation
├── Consulter les statistiques d'orientation
├── Liste des élèves à orienter
├── Générer une recommandation via IA
├── Proposer une recommandation à l'élève
├── Choisir une piste (élève)
├── Relancer les élèves en attente
└── Finaliser l'orientation par défaut

14. Gérer la discipline
├── Créer une sanction disciplinaire (hors conseil)
├── Lever une sanction
├── Convoquer un conseil de discipline (Art. 30)
│   ├── Notifier les parents (72h avant)
│   └── Définir la composition légale du conseil
└── Tenir un conseil de discipline (PV, décision)

15. Gérer la pédagogie
├── Gérer les programmes
│   ├── Créer un programme par matière/niveau
│   └── Définir les chapitres
├── Suivre le cahier de texte
│   └── Consulter l'avancement des programmes (alertes de retard)
└── Partager des ressources pédagogiques

16. Gérer les ressources humaines
├── Créer un dossier employé
├── Gérer les événements de carrière
├── Gérer les congés
│   ├── Demander un congé
│   └── Approuver/Refuser un congé
├── Gérer les ordres de mission
├── Suivre les présences du personnel
└── Générer des documents RH (attestations, certificats)

17. Gérer la bibliothèque
├── Ajouter un ouvrage
├── Modifier un ouvrage
├── Gérer les prêts
│   └── Enregistrer un emprunt / retour
└── Signaler les retards (notifications)

18. Gérer les communications
├── Envoyer une annonce (à une classe, un rôle, toute l'école)
├── Diffuser un message (email, SMS, push)
├── Consulter les logs d'envoi
├── Gérer les conversations (messagerie in-app)
└── Gérer les notifications push

19. Gérer les campagnes statistiques
├── Générer la déclaration statistique MINESEC
│   └── Vérifier la complétude du supplément
├── Générer le rapport statistique MINEDUB (primaire/maternelle)
└── Consulter les soumissions

20. Gérer les paiements MINESEC
├── Générer les paiements MINESEC pour l'école
├── Consulter le tableau de bord des paiements élèves
└── Voir l'aperçu global des paiements

21. Gérer l'onboarding des élèves (auto-service)
├── Créer un squelette d'onboarding (pour admission concours)
├── Soumettre un formulaire d'onboarding (parent/élève)
├── Valider un dossier d'onboarding
├── Rejeter un dossier d'onboarding
└── Suivre le statut des onboardings

22. Gérer les transferts inter-écoles (groupe)
├── Créer une demande de transfert (élève ou enseignant)
├── Consulter les demandes entrantes
├── Accepter un transfert
└── Rejeter un transfert

23. Gérer le suivi des élèves à risque
├── Créer une action de suivi
├── Assigner une action à un responsable
├── Clore une action de suivi
├── Lister les actions en cours
└── Consulter l'historique des actions

24. Utiliser l'assistant IA (copilot admin)
├── Exécuter une action via l'assistant
│   ├── Créer/Supprimer/Modifier une classe
│   ├── Créer/Supprimer/Modifier une matière
│   ├── Affecter un enseignant
│   ├── Créer une session concours/PEBS
│   ├── Ouvrir une fenêtre LV2
│   ├── Générer/Envoyer des bulletins
│   ├── Valider des notes en bloc
│   ├── Publier un emploi du temps
│   ├── Créer un plan de frais
│   └── Générer des factures
├── Confirmer une action destructive
└── Annuler une action (undo)

25. Consulter les analyses et indicateurs
├── Consulter le tableau de bord (synthèse)
├── Voir les statistiques (notes, présences, finances)
├── Consulter l'indice de santé scolaire (IA)
│   └── Voir les recommandations IA pour les élèves à risque
├── Consulter les graphiques et tendances (Recharts)
└── Voir les KPIs de l'établissement

26. Gérer les inscriptions aux examens officiels
└── Enregistrer les inscriptions aux examens (probatoire, BAC, GCE)

27. Gérer les matricules et cartes scolaires
├── Importer des matricules
├── Vérifier un matricule
├── Synchroniser depuis la carte scolaire (scraping)
├── Vérifier un reçu de carte scolaire
├── Confirmer une correspondance floue (fuzzy matching)
└── Signaler une erreur de carte scolaire

28. Gérer les événements académiques
├── Lister les événements actifs (LV2, examens, vacances)
├── Activer une ressource liée à un événement
└── Synchroniser la clôture d'une ressource liée

29. Gérer son profil et sa sécurité
├── Modifier son profil
├── Changer son mot de passe
├── Configurer le MFA (obligatoire à la 1ère connexion)
│   ├── Scanner le QR code TOTP
│   └── Sauvegarder les codes de récupération
├── Consulter ses notifications (cloche)
└── Gérer ses préférences de notification
```

---

## ACTEUR : TEACHER (enseignant)

```
1. Gérer les notes
├── Saisir les notes d'une classe (par séquence)
├── Soumettre les notes pour validation
├── Modifier une note avant soumission
└── Consulter ses notes soumises/validées

2. Gérer les présences
├── Faire l'appel (matin/après-midi)
└── Consulter l'historique des présences de ses classes

3. Consulter son environnement de travail
├── Consulter son emploi du temps
├── Consulter la liste de ses classes
├── Consulter la liste de ses élèves (par classe)
│   └── Voir les effectifs par créneau (LV2/A-Level)
└── Consulter ses matières assignées

4. Gérer la pédagogie
├── Remplir le cahier de texte (séance par séance)
├── Gérer les chapitres de son programme
├── Suivre l'avancement du programme
└── Consulter les alertes de retard

5. Rôle de professeur principal
├── Consulter la liste de sa classe
├── Ajouter un commentaire sur le bulletin
├── Suivre les résultats de sa classe
├── Consulter les alertes de ses élèves à risque
└── Recevoir le digest hebdomadaire

6. Gérer sa progression
├── Consulter ses indicateurs de performance
└── Voir les alertes élèves à risque (détection de décrochage)

7. Gérer les rattrapages
└── Demander un rattrapage pour une séance manquée

8. Gérer les actions de suivi
├── Créer une action de suivi pour un élève
├── Voir les actions qui lui sont assignées
└── Clore une action de suivi

9. Utiliser l'assistant IA (copilot enseignant)
├── Saisir une note via assistant
├── Enregistrer une présence via assistant
├── Demander un rattrapage via assistant
└── Soumettre des notes via assistant

10. Gérer son profil
├── Modifier son profil
├── Changer son mot de passe
├── Consulter ses notifications
└── Gérer ses préférences de notification
```

---

## ACTEUR : STAFF (personnel administratif)

*Les permissions varient selon le titre (Censeur, Intendant, Surveillant Général, etc.)*

```
1. Gérer les notes et évaluations (Censeur, Vice-Principal)
├── Valider les notes soumises par les enseignants
├── Rejeter des notes
├── Consulter l'état des notes par département/classe
└── Consulter les notes en vue de leur département

2. Gérer les emplois du temps (Censeur, Vice-Principal, Animateur Pédagogique)
├── Créer/Modifier des créneaux
├── Publier l'emploi du temps
├── Valider l'emploi du temps du département
└── Gérer les demandes de rattrapage

3. Gérer les présences (Surveillant Général, Discipline Master)
├── Consulter les présences par classe
├── Gérer les justificatifs d'absence
└── Configurer les seuils d'alerte

4. Gérer la discipline (Surveillant Général, Discipline Master)
├── Créer une sanction disciplinaire
├── Lever une sanction
└── Consulter l'historique disciplinaire

5. Gérer les finances (Intendant, Bursar, Économe)
├── Consulter les plans de frais
├── Gérer les factures
├── Enregistrer un paiement
├── Consulter les impayés
├── Gérer les dépenses
└── Gérer les cautions

6. Gérer l'orientation (Conseiller d'Orientation, Guidance Counsellor)
├── Créer une fiche d'orientation
├── Ajouter un entretien
├── Ajouter un test d'aptitude
├── Faire une recommandation de série
└── Suivre les élèves orientés

7. Gérer la bibliothèque (Documentaliste, Librarian)
├── Ajouter/Modifier un ouvrage
├── Gérer les prêts et retours
└── Signaler les retards

8. Gérer les conseils de classe
├── Participer aux délibérations
├── Consulter les décisions
└── Gérer les PV

9. Gérer les ateliers et travaux pratiques (Chef des Travaux)
├── Gérer les ateliers
├── Gérer les notes pratiques
├── Gérer les stages
└── Gérer le stock des ateliers

10. Gérer les transactions APEE
├── Créer une transaction APEE
└── Valider une dépense APEE

11. Gérer la pédagogie
├── Superviser les plans de cours
├── Générer des rapports pédagogiques
└── Gérer les briefs pédagogiques

12. Gérer le suivi des élèves
├── Consulter les fiches de suivi
├── Créer des actions de suivi
└── Voir l'historique des actions

13. Gérer les inscriptions
└── Gérer les inscriptions des élèves

14. Gérer les départements (HOD, Animateur Pédagogique)
├── Superviser les enseignants du département
├── Valider les emplois du temps du département
└── Générer des rapports départementaux

15. Consulter son profil
├── Modifier son profil
├── Changer son mot de passe
├── Consulter ses notifications
└── Gérer ses préférences
```

---

## ACTEUR : PARENT

```
1. Suivre la scolarité de ses enfants
├── Consulter les notes (par matière, séquence, période)
├── Consulter les bulletins PDF
├── Consulter les présences/absences
├── Consulter l'emploi du temps
└── Consulter les décisions du conseil de classe

2. Gérer les finances
├── Consulter les factures et échéances
├── Payer les frais (Mobile Money MTN/Orange)
│   └── Initier un paiement via assistant IA
├── Consulter l'historique des paiements
└── Consulter les cautions

3. Consulter la bibliothèque
└── Voir le catalogue et les emprunts de son enfant

4. Gérer l'orientation
├── Consulter les recommandations d'orientation
└── Suivre le processus d'orientation de son enfant

5. Gérer les transactions APEE
└── Consulter les transactions APEE

6. Gérer son profil
├── Modifier son profil
├── Changer son mot de passe
├── Consulter ses notifications
├── Gérer ses préférences de notification
└── Utiliser l'assistant IA (initier un paiement)
```

---

## ACTEUR : STUDENT (élève)

```
1. Consulter ses résultats
├── Consulter ses notes
├── Consulter ses bulletins PDF
├── Consulter son rang et sa moyenne
└── Consulter son appréciation

2. Consulter son emploi du temps
├── Voir son emploi du temps hebdomadaire
└── Voir les créneaux LV2/A-Level

3. Consulter ses présences
└── Voir ses statistiques d'absence

4. Gérer sa scolarité
├── Choisir sa LV2 (dans la fenêtre ouverte)
├── Choisir ses options A-Level
└── Consulter son orientation
    ├── Voir ses aspirations
    ├── Participer aux checkpoints d'orientation
    └── Choisir une piste d'orientation

5. Consulter la bibliothèque
└── Voir le catalogue et ses emprunts

6. Consulter son suivi personnel
├── Voir les actions de suivi le concernant
└── Voir son historique de suivi

7. Gérer son profil
├── Modifier son profil
├── Changer son mot de passe
├── Consulter ses notifications
├── Gérer ses préférences
└── Utiliser l'assistant IA (consultation uniquement)
```

---

## ACTEUR : SCHOOL GROUP OWNER (propriétaire de groupe d'écoles)

```
1. Gérer les écoles du groupe
├── Consulter la liste des écoles du groupe
├── Voir les KPIs détaillés de chaque école
└── Consulter le détail d'une école

2. Gérer les transferts inter-écoles
├── Créer une demande de transfert (élève/enseignant)
├── Consulter les demandes entrantes
├── Consulter les demandes sortantes
├── Rechercher une personne dans le groupe
├── Accepter un transfert
└── Rejeter un transfert

3. Administrer son compte
├── Se connecter (MFA obligatoire)
├── Configurer le MFA
└── Gérer son profil
```

---

## ACTEUR : CANDIDAT CONCOURS (personne externe)

```
1. Participer au concours d'entrée en 6e
└── Être inscrit comme candidat (via admin ou import Excel/scan)

2. Être admis
└── Recevoir un lien d'onboarding après réussite au CEP
```

---

## ACTEUR : ÉLÈVE EN ONBOARDING (future élève)

```
1. Compléter son dossier d'inscription
├── Remplir le formulaire d'onboarding (informations personnelles)
├── Soumettre le formulaire
└── Attendre la validation par l'administration
```

---

## ACTEUR : SYSTÈME (tâches automatisées / jobs)

```
1. Générer les emplois du temps (IA)
├── Recevoir la demande de génération
├── Interroger Groq pour la proposition
└── Sauvegarder la proposition

2. Générer les bulletins en masse
├── Parcourir les classes concernées
├── Générer les PDF
└── Notifier les administrateurs

3. Surveiller les seuils d'absence
├── Calculer les absences par élève
└── Déclencher une alerte si seuil dépassé

4. Surveiller la santé scolaire
├── Calculer les indices de risque
├── Déclencher une alerte critique (rouge)
├── Déclencher une alerte attention (orange)
└── Déclencher une alerte positive (vert)

5. Envoyer les rappels de paiement
├── Identifier les factures impayées/échéances
└── Envoyer les notifications (email/push)

6. Surveiller les prêts en retard (bibliothèque)
└── Notifier les emprunteurs en retard

7. Envoyer le digest hebdomadaire au professeur principal

8. Détecter les abandons de matière
├── Après validation d'une note
└── Après validation en bloc

9. Surveiller les événements académiques
├── Vérifier le déclenchement d'un événement planifié
└── Exécuter les actions liées

10. Vérifier les checkpoints d'orientation

11. Sauvegarder les données de l'école

12. Synchroniser les cartes scolaires

13. Relancer les paiements impayés

14. Auditer les matricules

15. Relancer les onboarding en attente

16. Relancer les profils RH incomplets
```

---

## MATRICE ACTEURS ↔ GRANDS DOMAINES

| Domaine | MASTER | ADMIN | TEACHER | STAFF | PARENT | STUDENT | GROUP OWNER |
|---|---|---|---|---|---|---|---|
| Configuration école | ✅ | ✅ | | | | | |
| Gestion des classes/matières | | ✅ | | | | | |
| Année académique | | ✅ | | | | | |
| Utilisateurs | ✅ | ✅ | | | | | |
| Notes | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Bulletins | | ✅ | | | ✅ | ✅ | |
| Emplois du temps | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Présences | | ✅ | ✅ | ✅ | | | |
| Finances | | ✅ | | ✅ | ✅ | | |
| Concours 6e | | ✅ | | | | | |
| PEBS | | ✅ | | | | | |
| LV2 | | ✅ | | | | ✅ | |
| Orientation | | ✅ | | ✅ | ✅ | ✅ | |
| Discipline | | ✅ | | ✅ | | | |
| Pédagogie | | ✅ | ✅ | ✅ | | | |
| RH | | ✅ | | | | | |
| Bibliothèque | | ✅ | | ✅ | | ✅ | |
| Communications | | ✅ | | | ✅ | ✅ | |
| Statistiques MINESEC | | ✅ | | | | | |
| Assistant IA | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Suivi élèves | | ✅ | ✅ | ✅ | | ✅ | |
| Transferts groupe | | ✅ | | | | | ✅ |
| Santé scolaire / IA | | ✅ | ✅ | | | | |
| Matricules | | ✅ | | | | | |
| Groupe d'écoles | | | | | | | ✅ |

---

*Document généré le 30 juillet 2026 — basé sur l'analyse exhaustive du code source.*
