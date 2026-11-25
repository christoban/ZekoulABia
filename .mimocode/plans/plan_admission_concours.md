<USER_REQUEST>
ok si la phase 1 est donc terminé on passe à la phase 2: # Plan d'implémentation — Admission, concours et inscription des élèves (ZekoulABia)

Document destiné à l'assistant d'implémentation (Claude Code). Il s'appuie sur l'audit du code du 20 septembre 2026, sur la vision de Chris et sur une recherche de pratiques réelles d'établissements camerounais.

---

## 0. Consignes à l'assistant

1. **Lis d'abord ce document en entier, puis explore le code** concerné (audit déjà fait : `StudentOnboarding`, `EntranceExamSession/Candidate`, `Enrollment`, `ParentStudent`, `StaffPermissionRules`, `EnrollmentRules`, `SchoolOnboardingSettings`). Ne réécris pas ce qui marche : étends.
2. **Travaille par phases** (section 15), un commit par étape, avec tests. Ne saute pas de phase.
3. **Toutes les règles de permission et de validation sont appliquées côté serveur.** Le front ne fait que refléter.
4. Les événements passent par le port `EventPublisher` existant, jamais par `inngest.send()` dans un contrôleur.
5. Tout est **multi-établissement** (`schoolId`) et **traçable** (journal d'audit : qui, quoi, quand, avant/après).
6. Les décisions marquées **[À CONFIRMER]** ont une valeur par défaut retenue ici. Implémente-les avec cette valeur, de façon **configurable** quand c'est indiqué, et signale-les dans ton compte rendu.
7. Le résultat doit être **beau et soigné**, au niveau du babillard (section 12). Une fonctionnalité qui marche mais qui est laide ou confuse n'est pas terminée.
8. En fin de chaque phase, produis un compte rendu : fait, non fait et pourquoi, décisions prises, points à valider.

---

## 1. Ce que montre la recherche (pratiques réelles au Cameroun)

Sources principales : site du Collège Jean Tabi (établissement catholique privé, Yaoundé), note du ministère sur les frais des examens de l'éducation de base, articles de presse. Les dates publiées sur le site du collège sont incohérentes d'une page à l'autre (2024, 2025, 2026) : retenir la **structure du processus**, pas les dates.

**Concours d'entrée d'un établissement privé (Jean Tabi)**
- Un **avis de concours** annonce : la date et l'heure (début à 7 h), la **date limite de dépôt du dossier** (la veille à midi), la constitution du dossier, les matières.
- **Dossier de candidature** : une fiche d'inscription (retirée physiquement à l'établissement, remplie à la main), les **frais de concours** (7 500 F), deux photos, une photocopie non légalisée de l'acte de naissance.
- **Matières** : dictée, étude de texte, culture générale, anglais, mathématiques, calcul rapide (donc plusieurs épreuves, avec des coefficients).
- **Résultats** : liste des « définitivement admis », **par ordre alphabétique** (pas de classement), avec un **code candidat** (type `CCJT1800`), le nom complet et le niveau, signée du chef d'établissement avec lieu et date.
- Le même établissement organise **d'autres concours par niveau** (5e, 4e, 3e, 2nde A4, 2nde C) à une autre date. Autrement dit : un établissement peut demander un concours pour **plusieurs niveaux**, pas seulement la 6e.
- Une préinscription en ligne existe via un « Espace parent ».

**Niveau national (éducation de base)**
- Le CEP et le concours d'entrée en 6e sont des examens nationaux, avec des frais d'inscription fixés à 6 000 FCFA depuis 2023.
- Les résultats des concours nationaux sont **affichés sur des babillards** dans les centres d'écrit, avec une date limite de publication : c'est l'origine du besoin de « babillard numérique ».

**Concours dans les lycées publics (article de presse ancien, 2016)**
- Dans plusieurs établissements, le nombre de places dépasse le nombre de candidats : le concours sert alors autant à répartir qu'à sélectionner. Un lycée bilingue organisait en plus un concours interne pour une section spéciale.

**Limites de cette recherche.** Je n'ai pas trouvé la procédure détaillée d'un lycée public (affectation par l'administration, quotas). Un seul établissement privé est documenté en détail. **Chris doit confirmer le fonctionnement réel de l'établissement client** (section 16).

**Conséquences de conception**
- Le concours doit être **configurable par niveau** (pas seulement la 6e).
- Les épreuves sont **multiples, avec coefficients**.
- Le dossier réel est **papier** : le numérique doit suivre « pièce reçue oui/non » plutôt que d'exiger un téléversement.
- Le candidat a un **code**, pas un compte.
- La liste de résultats est **alphabétique** dans la pratique : le mode de publication doit être un réglage (alphabétique ou classement).
- Il faut **imprimer** : fiche d'inscription, convocation, liste d'émargement, affiche des résultats.

---

## 2. Principes de conception

1. **L'administrateur supervise, il n'exécute pas.** Le secrétaire (inscriptions) et le comptable/intendant (finances) exécutent ; l'administrateur valide, contrôle et a le dernier mot.
2. **Une option de délégation, pas un code en dur.** L'administrateur peut activer « je fais aussi ce travail moi-même » pour chaque domaine (inscriptions, finances). Désactivée par défaut. Utile pour les petits établissements sans secrétaire ni comptable.
3. **Le système s'adapte à l'établissement** : concours ou pas, pour quels niveaux, quelles pièces, quels canaux de contact. Rien n'est imposé.
4. **Le système raisonne** : il propose (classe, seuil d'admission, profil d'accès numérique), détecte (doublons, dossiers incomplets, classe pleine), relance, et l'humain décide.
5. **Aucun élève n'est perdu** : même sans smartphone, sans email, sans parent joignable, l'élève est enregistré et compté (bulletins, statistiques).
6. **Papier et numérique cohabitent** : tout ce qui se remplit à la main a son équivalent imprimable, avec la même organisation des champs.

---

## 3. Politique d'admission de l'établissement (configuration)

### 3.1 Où la configurer
- **Onboarding de l'établissement, deuxième phase** : une étape « Comment les élèves entrent-ils dans votre établissement ? ».
- **Paramètres** de l'établissement, page « Admissions » : mêmes réglages, **modifiables** par l'administrateur. À la modification, avertir si un concours ou des dossiers sont en cours ([À CONFIRMER] : modifiable, avec avertissement).

### 3.2 Contenu de la politique

```
SchoolAdmissionPolicy
  concoursEnabled               bool (défaut false)
  concoursLevels                niveaux concernés par un concours (ex. 6E ; ou 6E,5E,4E,3E,2NDE_A4,2NDE_C)
                                (les autres niveaux s'inscrivent sur dossier)
  requireCepForAdmission        bool  [À CONFIRMER] défaut : comportement actuel du code
  scoresPublicationMode         ALPHABETIQUE | CLASSEMENT   (défaut ALPHABETIQUE)
  publicListEnabled             bool (défaut false : consultation individuelle uniquement)
  seatReservationDays           entier (défaut 14, aligné sur tokenExpiryDays)
  adminGereInscriptions         bool (défaut false)  → l'admin peut aussi créer des dossiers
  adminGereFinances             bool (défaut false)  → l'admin peut aussi créer plans de frais et factures
  piecesChecklist               liste configurable (voir section 6)
```

### 3.3 Interface de l'étape d'onboarding
Trois grandes cartes à choisir, avec icône et une phrase :
- **Sur concours d'entrée** : les candidats passent un concours avant d'être admis.
- **Sur dossier** : les familles déposent un dossier, le secrétariat le prépare.
- **Selon le niveau** : concours pour certains niveaux, dossier pour les autres.

Si concours : sélecteur de niveaux (puces, avec « entrée du 1er cycle » présélectionnée). Une phrase de synthèse se met à jour en direct : « Les candidats à l'entrée en 6e passent un concours. Les autres niveaux s'inscrivent sur dossier. »
Sous-système anglophone : libellés adaptés (Form 1, Common Entrance, etc.).

Puis un **bloc « Qui fait quoi ? »** avec deux interrupteurs :
- « Le secrétaire inscrit les élèves ; je valide. » (par défaut) / « Je peux aussi inscrire moi-même ».
- « Le comptable gère les frais ; je supervise. » (par défaut) / « Je peux aussi gérer les frais moi-même ».
Avertissement si aucun utilisateur n'a le rôle correspondant (secrétaire, comptable/intendant) : proposer d'activer l'option ou d'inviter quelqu'un.

---

## 4. Rôles et permissions

### 4.1 Changements demandés

Créer des **permissions distinctes** dans le RBAC (ne pas coder « si rôle === ADMIN ») :

| Permission | Secrétaire | Administrateur | Comptable / Intendant |
|---|---|---|---|
| `ENROLLMENT_DRAFT` (créer, modifier, soumettre un dossier) | oui | seulement si `adminGereInscriptions` | non |
| `ENROLLMENT_VALIDATE` (valider, renvoyer, refuser) | non | **oui, exclusivement** | non |
| `ENTRANCE_EXAM_REGISTER` (inscrire les candidats, présences) | oui | seulement si `adminGereInscriptions` | non |
| `ENTRANCE_EXAM_GRADE` (saisir les notes) | oui [À CONFIRMER] | non par défaut | non |
| `ENTRANCE_EXAM_CONFIGURE` (session, barème, salles) | prépare (brouillon) | **ouvre, clôt, publie** | non |
| `ENTRANCE_EXAM_PUBLISH` (délibération, résultats) | non | **oui** | non |
| `FEE_PLAN_MANAGE`, `INVOICE_CREATE` | non | seulement si `adminGereFinances` | **oui** |
| `FINANCE_VIEW`, rapports | non | oui (supervision) | oui |
| `GENERATE_REPORTS` (aujourd'hui inerte) | oui, **à brancher** (section 11) | oui | oui |

### 4.2 Règles
- Un utilisateur qui **crée** un dossier ne peut jamais le **valider** lui-même, sauf l'administrateur avec `adminGereInscriptions` activé (auto-validation tracée, avec la mention « inscrit directement par l'administrateur »).
- L'administrateur **perd** l'accès aux actions d'inscription et de création de frais quand l'option de délégation correspondante est désactivée. Il conserve la **lecture et le contrôle**.
- Migrer les établissements existants : `adminGereInscriptions` et `adminGereFinances` gardent le comportement actuel pour ne rien casser, puis l'administrateur est invité à confirmer ses choix (bandeau dans les Paramètres).
- Le secrétaire ne publie pas sur le babillard (décision prise précédemment).
- Le secrétaire dispose dans son tableau de bord d'une section **Inscriptions** complète (section 8). Aujourd'hui, l'écran d'onboarding n'existe que côté administrateur : c'est le défaut principal de l'audit.

---

## 5. Machine à états du dossier d'inscription

Réutiliser `StudentOnboarding` comme **dossier d'inscription**. Statuts existants : `DRAFT, LINK_SENT, SUBMITTED, VALIDATED, ACTIVATED, REJECTED, EXPIRED`. Ajouter `RETURNED` (« À compléter »).

```
DRAFT (brouillon du secrétaire)
   │  soumettre  (ENROLLMENT_DRAFT)
   ▼
SUBMITTED (à valider) ◄────────────── RETURNED (à compléter, avec commentaire)
   │                                         ▲
   │  valider (ENROLLMENT_VALIDATE)          │ renvoyer avec commentaire
   ▼                                         │
VALIDATED ───────────────────────────────────┘ (l'administrateur peut aussi refuser → REJECTED)
   │  activation automatique (transaction existante : User + StudentProfile + Enrollment + parent + ParentStudent)
   ▼
ACTIVATED (inscrit)
```

- L'ancienne action `POST /eleve-onboarding/:id/inscrire` **exige désormais** le statut `VALIDATED` avec un `validatedById` ayant `ENROLLMENT_VALIDATE`. Réutiliser la transaction atomique existante pour l'activation. Exception : administrateur avec `adminGereInscriptions` (création + validation en une action, tracées).
- Le **lien auto-service** (famille remplit en ligne) reste un **canal optionnel** : le secrétaire peut envoyer un lien pour pré-remplir ; le dossier arrive en `SUBMITTED` ou reste modifiable par le secrétaire avant soumission.
- Chaque transition est enregistrée (acteur, date, commentaire) et notifie l'acteur suivant : secrétaire → administrateur à la soumission ; administrateur → secrétaire à la décision.
- Délai d'expiration et relances : conserver le job existant.

**Concours** : un candidat admis crée un dossier **pré-rempli** (aucune ressaisie) en `DRAFT`, avec un délai de réservation de place (`seatReservationDays`). Il suit ensuite le même circuit, y compris la validation de l'administrateur. Pour les admis d'un concours, prévoir la **validation par lot** (section 8.3).

---

## 6. Dossier de l'élève

### 6.1 Rubriques (assistant en étapes)
1. **Élève** : nom, prénoms, sexe, date et lieu de naissance, nationalité, photo (optionnelle).
2. **Scolarité** : classe demandée, sous-système (francophone/anglophone), établissement d'origine, dernière classe, résultats antérieurs (facultatif), redoublant, LV2, filière PEBS si applicable.
3. **Famille** : père, mère, tuteur légal (nom, lien de parenté, téléphone, email si disponible, adresse). Un contact d'urgence.
4. **Accès numérique** : voir section 7.
5. **Pièces** : liste de contrôle (6.2).
6. **Frais** : état des frais d'inscription selon le module Finances (lecture seule pour le secrétaire, section 11).
7. **Récapitulatif et soumission**.

Ne pas ajouter de dossier médical dans cette phase (donnée sensible de mineur : à décider séparément).

### 6.2 Pièces justificatives : suivre le papier
Aujourd'hui, aucune pièce n'est gérée. La réalité est papier. Donc :
- **Phase 2** : liste de contrôle configurable **« pièce reçue oui/non »** avec date et nom de la personne qui l'a réceptionnée, plus une note.
- **Phase 5** : numérisation optionnelle (photo prise avec le téléphone, PDF), stockage protégé (jamais d'URL publique permanente).

Liste par défaut, **configurable par établissement** et par cas (nouvel élève, transfert, redoublant) :
fiche d'inscription remplie ; photos d'identité ; copie de l'acte de naissance ; bulletin ou relevé de notes précédent ; certificat de transfert (transferts) ; attestation de réussite à l'examen précédent selon le niveau ; reçu des frais. [Liste à valider par Chris avec l'établissement client.]

Chaque pièce : `code`, libellé, obligatoire ou facultative, s'applique à quels cas. La **complétude** du dossier est calculée (jauge en pourcentage).

Un dossier peut être soumis **avec des pièces manquantes** si le secrétaire coche « dossier validable sous réserve » ; l'administrateur voit alors clairement ce qui manque.

### 6.3 Parent-élève
- Ajouter sur le lien `ParentStudent` : `relation` (PERE, MERE, TUTEUR_LEGAL, AUTRE), `contactPrincipal` (bool), `responsableFinancier` (bool). Aujourd'hui aucun statut n'existe.
- Rapprochement d'un parent existant (email ou téléphone) : conserver, avec **confirmation visuelle** au secrétaire (« Ce numéro correspond à M. X, déjà parent de 2 élèves. Lier ? »), pas de liaison silencieuse.
- Le parent invité reçoit un code à usage unique **remis sur la fiche imprimée** (liaison autonome sécurisée) : [À CONFIRMER, phase ultérieure].

### 6.4 Identifiant élève
- Le matricule national (`cartescolaire.cm`) reste externe et facultatif.
- Ajouter un **numéro interne** généré à l'activation, format `{CODE_ETABLISSEMENT}-{ANNÉE}-{SÉQUENCE}`, unique par établissement. [À CONFIRMER]
- Ne jamais bloquer une inscription parce que le matricule national manque.

### 6.5 Doublons et capacité
- Réutiliser le calcul de similarité existant (`matchScore`) à la création du dossier **et** à l'inscription d'un candidat : avertir « un élève très proche existe déjà ».
- **Capacité de classe** : brancher `peutAccueillir/estPleine` (jamais appelé aujourd'hui) :
  - avertissement à la soumission par le secrétaire ;
  - à la validation, **alerte bloquante** que l'administrateur peut **contourner en saisissant un motif** (tracé). [À CONFIRMER]
- **Proposition de classe** : le système propose les classes du niveau, triées par places disponibles (et LV2/section si pertinent), avec l'effectif affiché. Le secrétaire choisit.

---

## 7. Profil d'accès numérique (smartphone, cycle, SMS)

### 7.1 Questions à poser dans le dossier
- L'élève a-t-il un smartphone ? (Android, iOS, autre : conserver `eleveDispositifOS`).
- Le parent (ou tuteur) a-t-il un smartphone ? Sinon un téléphone simple ? Sinon aucun contact ?
Ces champs existent déjà (`eleveADispositif`, `parentADispositif` et les champs OS) : réutiliser.

### 7.2 Règle de décision (fonction unique, testée)

`resoudreProfilAcces(cycle, eleveSmartphone, parentSmartphone, parentTelSimple)`

| Cycle | Élève avec smartphone | Parent | Compte de connexion de l'élève | Qui gère le profil | Canal des notifications |
|---|---|---|---|---|---|
| 1er cycle (6e à 3e / Form 1 à 5) | oui | smartphone | **oui, accès limité** (lecture) | **le parent** | appli parent |
| 1er cycle | non | smartphone | **non** (dossier enregistré, pas d'identifiants) | le parent | appli parent |
| 1er cycle | (indifférent) | téléphone simple | selon smartphone élève | le parent, par le secrétariat | **SMS** |
| 1er cycle | (indifférent) | aucun contact | non | le secrétariat | **papier** (convocations et bulletins imprimés) |
| 2nd cycle (2nde à Tle / Sixième) | oui | (indifférent) | **oui, complet** | **l'élève** (le parent garde la lecture) | appli élève, parent informé |
| 2nd cycle | non | smartphone | non | le parent | appli parent |
| 2nd cycle | non | téléphone simple ou aucun | non | le secrétariat | SMS ou papier |

Cas limite à trancher [À CONFIRMER] : élève de 1er cycle **avec** smartphone mais parent **sans smartphone**. Valeur par défaut : compte de l'élève **en lecture seule**, le parent est informé par SMS, les modifications de profil passent par le secrétariat.

### 7.3 Principe technique
- Le `User` de l'élève doit rester créé (le `StudentProfile` s'y rattache) : ne pas le supprimer. Ajouter un état explicite **« sans connexion »** (`loginEnabled = false`, aucun identifiant généré ni SMS d'identifiants envoyé). L'élève est compté partout (bulletins, effectifs, statistiques).
- Le calcul du **cycle** vient de la **classe** de l'élève, pas de son âge. Conserver l'âge comme repli si la classe n'a pas de cycle défini.
- **Recalcul automatique** à la clôture d'année (passage de la 3e à la 2nde) : proposer « Activer le compte de cet élève ? » aux familles concernées ; et à tout changement de situation (la famille acquiert un smartphone).
- Le résultat de la fonction est **affiché clairement** dans le dossier (« Accès : l'élève n'a pas de compte ; tout passe par le parent, notifications par SMS »), avec possibilité de le modifier manuellement (tracé).

---

## 8. Parcours et écrans

### 8.1 Secrétaire : section « Inscriptions » (nouveau)

Onglets :
1. **Tableau de bord** : bande de compteurs (Brouillons, À valider, À compléter, Inscrits cette année, Dossiers incomplets) et **tableau kanban** des dossiers (colonnes Brouillon → Soumis → À compléter → Validé/Inscrit). Recherche, filtres (niveau, classe, statut). Les dossiers « À compléter » remontent en tête avec le commentaire de l'administrateur.
2. **Nouveau dossier** : assistant en étapes (6.1), enregistrement automatique en brouillon, reprise possible, jauge de complétude qui se met à jour, panneau récapitulatif à droite (desktop), alertes en direct (doublon, classe pleine, pièce manquante).
3. **Concours** (visible seulement si activé) : voir section 9.
4. **Import Excel** (existant, conservé).
5. **Documents** : fiche d'inscription vierge et pré-remplie (PDF), certificats, cartes (déjà existants).

La **fiche d'inscription imprimable** reproduit **dans le même ordre** les champs du formulaire numérique et porte un QR code : le secrétaire scanne ou saisit le code, retrouve le dossier, et transcrit la fiche sans se perdre.

### 8.2 Administrateur : file « Inscriptions à valider » (nouveau)
- Badge du nombre de dossiers en attente dans le menu.
- **Liste en cartes** : photo, nom, classe demandée, complétude, alertes (doublon, capacité, pièces manquantes), ancienneté.
- **Panneau de revue** (tiroir latéral) : synthèse du dossier, liste des pièces, résultat du concours si pertinent, accès numérique résolu, capacité de la classe, historique. Trois actions : **Valider**, **Renvoyer avec commentaire** (modèles de motifs proposés), **Refuser** (motif obligatoire).
- **Validation par lot** : sélectionner tous les dossiers sans alerte et valider en une action (obligatoire de pouvoir le faire pour les admis d'un concours).
- L'administrateur ne voit **pas** de bouton « Inscrire » ni de création de dossier, sauf si `adminGereInscriptions`.

### 8.3 Notifications
- Soumission → administrateur (notification interne, SMS ou email selon ses préférences).
- Décision → secrétaire.
- Validation → famille (SMS ou appli selon le profil d'accès), avec les prochaines étapes.

---

## 9. Concours d'entrée (visible si `concoursEnabled`)

### 9.1 Vue d'ensemble : une frise en 7 étapes

`Préparation → Inscriptions ouvertes → Convocations → Composition → Correction → Délibération → Publication → Finalisation`

Chaque session affiche cette frise en haut de l'écran, avec l'étape courante, ce qui reste à faire pour passer à la suivante, et les compteurs. On ne peut pas sauter une étape (par exemple pas de publication sans délibération).

### 9.2 Étape par étape

**1. Préparation** (secrétaire prépare, administrateur ouvre)
- Niveau(x) concerné(s), date et heure, lieu, **date limite de dépôt**, frais, nombre de places, **matières avec coefficient et note maximale**, règle d'admission (seuil, ou nombre de places, ou les deux), CEP requis ou non (`requireCepForAdmission`).
- Génération d'un **avis de concours** prêt à publier (texte + affiche imprimable + publication sur le babillard).

**2. Inscriptions ouvertes** (secrétaire)
- Formulaire candidat court : identité, date de naissance, établissement d'origine, niveau visé, téléphone du parent, accès numérique (7.1), pièces (fiche, photos, copie de l'acte de naissance, reçu de frais).
- **Code candidat** généré automatiquement (préfixe de l'établissement + numéro, ex. `LBAF0001`), unique par session, **ne révélant aucune identité**.
- Détection de doublon d'inscription.
- Frais de concours : le secrétaire saisit le numéro du reçu ; la confirmation d'encaissement revient au comptable. [À CONFIRMER : qui encaisse]
- Fermeture automatique à la date limite (paramétrable, avec dérogation tracée).

**3. Convocations**
- Répartition automatique en **salles** (capacité par salle, tri par code, ou mélange), avec possibilité de modifier.
- Documents PDF : **carte de candidat / convocation** (nom, photo si disponible, code, date, heure, salle, matières, QR code vérifiable via le mécanisme existant de documents vérifiables), **liste d'émargement par salle**.
- Envoi de la convocation aux parents (SMS ou appli selon le profil d'accès).

**4. Composition**
- **Émargement** : le jour J, présent/absent par salle (recherche par code ou scan du QR), utilisable **sans connexion** puis synchronisé (phase 5).

**5. Correction**
- **Anonymat** : réutiliser le mécanisme d'anonymat des copies s'il existe côté code (codes de composition distincts du code candidat) ; sinon en définir un minimal (`codeAnonyme` par copie, table de correspondance masquée à la saisie).
- Saisie des notes **par matière**, avec contrôle du maximum, **double saisie facultative** (deux saisies indépendantes, alerte en cas d'écart).
- Calcul de la moyenne pondérée et du rang.

**6. Délibération** (administrateur)
- **Simulateur de seuil** : curseur « seuil de moyenne » ↔ « nombre d'admis », avec les places disponibles, la distribution des notes (histogramme) et le nombre de candidats à égalité au seuil.
- Aides : « proposer le seuil qui remplit les places », gestion des **ex æquo** (règle à choisir), **liste complémentaire** (candidats classés juste après le seuil).
- Statuts candidats : `ADMIS`, `LISTE_ATTENTE`, `NON_ADMIS`, `ABSENT`, puis `CONFIRME`, `DESISTE`.
- Verrouillage de la délibération (traçable) avant publication.

**7. Publication des résultats** : section 10.

**8. Finalisation**
- Chaque admis reçoit un message (SMS ou appli) : résultat, **date limite pour finaliser** (`seatReservationDays`), pièces à apporter.
- Un **dossier d'inscription pré-rempli** est créé pour chaque admis (section 5).
- Passé le délai sans finalisation, la place est **libérée** et le premier de la liste complémentaire est **notifié automatiquement** (l'administrateur peut confirmer ou désactiver cette automatisation).
- Les candidats non admis reçoivent un message respectueux.

### 9.3 Correction du flux actuel
L'audit montre que le concours est aujourd'hui **réservé à l'administrateur**, avec un seul barème global et une conversion directe en dossier selon le CEP. À faire évoluer : rôles selon la section 4, notes par matière, codes candidats, salles, liste complémentaire, et CEP configurable.

---

## 10. Publication des résultats

Les candidats **n'ont pas de compte** : la publication ne peut pas reposer seulement sur le babillard interne.

1. **Consultation individuelle** (par défaut) : page publique de l'établissement où le parent saisit le **code candidat + date de naissance** : résultat, prochaine étape, date limite. Limiter les tentatives (protection contre le balayage de codes).
2. **SMS / appli** : chaque parent reçoit le résultat de son enfant.
3. **Affiche imprimable** (PDF) : liste **alphabétique** (ou classement selon `scoresPublicationMode`) avec code candidat, nom, niveau, signature du chef d'établissement, lieu et date. Reproduit ce que les établissements affichent aujourd'hui.
4. **Liste publique en ligne** : seulement si `publicListEnabled` (désactivée par défaut, car il s'agit de mineurs ; à laisser à l'administrateur).
5. **Babillard interne** : une publication de type `RESULTATS` (préparée dans la spécification du babillard) qui renvoie vers le résumé du concours (chiffres, seuil, liste), visible du personnel.

---

## 11. Intégrations

- **Finances.** À la validation d'un dossier, émettre l'événement `enrollment.validated` (via `EventPublisher`). Le module Finances (comptable) le consomme : soit création automatique des obligations de paiement selon le **plan de frais que le comptable a défini**, soit tâche « nouvel élève à facturer ». [À CONFIRMER : automatique ou tâche]. Le secrétaire voit l'état des frais en **lecture seule**. L'administrateur voit les indicateurs. Les plans de frais et factures sont créés par le comptable ou l'intendant.
- **Classes.** Vérification de capacité (6.5), proposition de classe.
- **Rapports** (permission `GENERATE_REPORTS`, aujourd'hui inerte) : effectifs par classe, dossiers incomplets, statistiques du concours, export Excel. Les brancher à des écrans et routes réels.
- **Clôture d'année.** Recalcul du profil d'accès (7.3), conservation de l'historique d'inscription.
- **Inscription MINESEC.** Le doublon `Enrollment` / `InscriptionMinesec` existe : ne pas y toucher dans ce chantier, mais documenter le lien et **ne pas créer un troisième modèle**.
- **Hors ligne.** Aujourd'hui, aucun flux d'inscription ne fonctionne sans connexion. En phase 5 : brouillons de dossiers conservés localement et synchronisés, émargement du concours hors ligne. La **soumission, la validation et la publication exigent la connexion**.

---

## 12. Design et expérience

Même niveau de soin que le babillard. Référence visuelle : surfaces chaudes et papier, typographie à empattement pour les titres, punaises et bandeaux pour l'accent, sobriété.

**Écrans de gestion (secrétariat, validation)** : privilégier la clarté à la décoration. Utiliser les mêmes jetons de thème que le babillard, un fond de page calme, des cartes « papier » pour les dossiers, des badges de statut colorés **avec libellé** (jamais la couleur seule).

**Composants à créer**
- `PipelineBoard` (kanban des dossiers), `DossierCard`, `StatusPill`
- `CompletenessRing` (jauge de complétude), `PieceChecklist` (cases « reçue » avec date et nom)
- `StepperForm` (étapes, enregistrement automatique, panneau récapitulatif)
- `ValidationDrawer` (revue administrateur), `BulkValidationBar`
- `ExamTimeline` (frise du concours), `ThresholdSimulator` (curseur + histogramme), `CandidateCard` (carte de candidat, aspect « carte imprimée »)
- `AccessProfileBadge` (résumé de l'accès numérique et de la voie de notification)
- `ResultsLookup` (page publique de consultation)

**Micro-interactions** : tampon « Validé » à la validation, jauge qui se remplit, transitions douces. Tout désactivé si `prefers-reduced-motion`. Pas de gadgets.

**Règles héritées de la revue du babillard (à respecter dès le départ)**
- Aucun texte forcé en couleur claire ou foncée sur une surface qui ne change pas de thème ; tester **thème clair et thème sombre**.
- Pas de hauteur fixe qui laisse un grand vide ou coupe le contenu ; pas de `min-height: 100vh` inutile ; marge basse suffisante pour ne pas passer sous le bouton « Assistant IA » et la barre de navigation mobile.
- Une seule barre d'outils par écran ; les actions destructives dans un menu `⋯` avec confirmation.
- Erreurs de validation **sous le champ**, avec focus sur le premier champ invalide ; aucun bandeau qui décale la mise en page.
- Libellés en français, aucun code de rôle en anglais visible ; textes secondaires de **13 px minimum**.
- Mobile : le contenu utile commence dans le premier tiers de l'écran ; boutons d'action principaux pleine largeur.
- Vérifier à 375, 768, 1280 et 1920 px.

---

## 13. Modèle de données : ajouts et modifications

- `SchoolAdmissionPolicy` (ou champs sur `SchoolOnboardingSettings`) : section 3.2.
- `StudentOnboarding` : statut `RETURNED` ; `submittedById`, `submittedAt`, `returnedComment`, `completenessScore`, `validableSousReserve` ; `accessProfile` résolu (JSON ou champs) ; `numeroInterne` ; lien vers le candidat du concours (existe : `examCandidateId`).
- `EnrollmentDocumentRequirement` (configuration des pièces par établissement et par cas) et `EnrollmentDocument` (dossier, code, `received`, `receivedAt`, `receivedById`, note, plus `fileKey` en phase 5).
- `ParentStudent` : `relation`, `contactPrincipal`, `responsableFinancier`.
- `User` / élève : état « sans connexion » (`loginEnabled`), ou nouvelle valeur d'`accessMode`.
- `StudentProfile` : `numeroInterne` (unique par établissement).
- Concours : `EntranceExamSubject` (matière, coefficient, note max), `EntranceExamScore` (candidat, matière, note, saisie 1/2), `EntranceExamRoom` (salle, capacité), `EntranceExamCandidate` : `codeCandidat`, `codeAnonyme`, `roomId`, `present`, `feeReceiptNo`, `feeConfirmed`, `piecesCheck`, `rank`, `deliberationStatus` ; extension de `AdmissionStatus` (`LISTE_ATTENTE`, `NON_ADMIS`, `DESISTE`) ; `EntranceExamSession` : champs de la section 9.2 (deadline, fees, règles).
- Journal d'audit : toutes les transitions.
- Migrations **réversibles**, données existantes préservées.

---

## 14. API (à adapter aux conventions du projet)

```
GET/PUT  /schools/:id/admission-policy
GET      /enrollments?statut=&niveau=&q=
POST     /enrollments                     créer un brouillon
PATCH    /enrollments/:id                 modifier
POST     /enrollments/:id/submit          soumettre à validation
POST     /enrollments/:id/validate        (ENROLLMENT_VALIDATE)
POST     /enrollments/:id/return          renvoyer avec commentaire
POST     /enrollments/:id/reject          refuser avec motif
POST     /enrollments/validate-batch      validation par lot
GET      /enrollments/:id/access-profile  résolution du profil d'accès
GET      /enrollments/:id/class-suggestions
PUT      /enrollments/:id/documents/:code marquer une pièce reçue
GET      /enrollments/:id/form.pdf        fiche d'inscription

GET/POST /entrance-exams ; /:id/subjects ; /:id/rooms ; /:id/candidates
POST     /entrance-exams/:id/open | /close-registration | /assign-rooms
GET      /entrance-exams/:id/convocations.pdf | /attendance-sheets.pdf
POST     /entrance-exams/:id/attendance   présences
PUT      /entrance-exams/:id/scores       notes par matière
GET      /entrance-exams/:id/simulation?threshold=&seats=
POST     /entrance-exams/:id/deliberate | /publish
GET      /public/:schoolSlug/results/:sessionId?code=&dob=   (public, limité en débit)
GET      /entrance-exams/:id/results-poster.pdf
```

Chaque endpoint : authentification, `schoolId`, permission serveur, validation d'entrée, journal d'audit.

---

## 15. Plan par phases

### Phase 1 — Politique, permissions et validation obligatoire
- Modèle `SchoolAdmissionPolicy`, migration, écran dans les **Paramètres**, étape dans l'**onboarding** (section 3.3).
- Nouvelles permissions, refonte des règles (`EnrollmentRules`, `StaffPermissionRules`), interrupteurs de délégation (inscriptions, finances), migration des établissements existants.
- Passerelle de validation : `inscrire` exige `VALIDATED` par un titulaire de `ENROLLMENT_VALIDATE`.
- Retrait de la création de plans de frais et de factures pour l'administrateur sauf `adminGereFinances`.
- Accès du secrétaire à l'écran d'onboarding (première version) et file de validation de l'administrateur (première version).
- **Critères** : le secrétaire soumet, l'administrateur valide, sinon 403 (tests d'API) ; un établissement sans secrétaire peut activer l'option et fonctionner ; l'administrateur ne crée plus de frais par défaut.

### Phase 2 — Dossier v2
- Assistant en étapes avec enregistrement automatique, jauge de complétude, liste de pièces « reçue oui/non », profil d'accès (fonction + tests unitaires sur toutes les lignes du tableau 7.2), capacité de classe, proposition de classe, détection de doublon avec confirmation, relation parent-élève, numéro interne, fiche imprimable avec QR.
- File de validation complète (tiroir, renvoi avec commentaire, refus, validation par lot).
- Section « Inscriptions » du secrétaire (tableau kanban).
- **Critères** : élève sans smartphone créé sans identifiants et compté dans les statistiques ; parent au téléphone simple reçoit les notifications par SMS ; dépassement de capacité alerté et contournable seulement avec motif tracé.

### Phase 3 — Concours v2
- Configuration par niveau, matières avec coefficients, code candidat, inscription des candidats par le secrétaire, salles, convocations et listes d'émargement (PDF), émargement, saisie des notes par matière (anonymat), simulateur de seuil, liste complémentaire, délibération, publication (individuelle + SMS + affiche PDF), finalisation avec dossier pré-rempli et libération automatique des places.
- **Critères** : de l'inscription au dossier pré-rempli sans ressaisie ; résultats consultables par code + date de naissance avec limitation des tentatives ; liste alphabétique imprimable.

### Phase 4 — Finances, rapports, cycles
- Événement `enrollment.validated` consommé par Finances ; état des frais en lecture seule pour le secrétaire.
- Brancher `GENERATE_REPORTS` à de vrais écrans (effectifs, dossiers incomplets, stats concours, export Excel).
- Recalcul du profil d'accès à la clôture d'année.

### Phase 5 — Hors ligne et pièces numérisées
- Brouillons de dossiers hors ligne, émargement hors ligne, file de synchronisation (réutiliser `useSyncQueue`).
- Numérisation de pièces (photo du téléphone, PDF), stockage protégé, vérification.

---

## 16. Décisions à confirmer par Chris (valeurs par défaut retenues)

1. **Processus réel de l'établissement client** (à décrire) : niveaux concernés, dates, frais, épreuves, façon d'afficher les résultats. *Défaut : concours configurable par niveau, entrée du 1er cycle présélectionnée.* 
2. **Après le concours**, l'administrateur valide-t-il toujours chaque admis ? *Défaut : oui, validation obligatoire, mais par lot.*
3. **Frais de concours et d'inscription** : qui encaisse ? *Défaut : le secrétaire saisit le reçu, le comptable confirme.*
4. **Publication des résultats** : consultation individuelle ou liste publique ? *Défaut : individuelle + SMS + affiche imprimable ; liste publique en option.*
5. **CEP requis pour l'admission ?** *Défaut : comportement actuel du code, mais configurable.*
6. **Paramètre d'admission** : modifiable par l'administrateur après l'onboarding ? *Défaut : oui, avec avertissement s'il y a des opérations en cours.*
7. **Finances** : même mécanisme de délégation que pour les inscriptions ? *Défaut : oui (interrupteur, désactivé).*
8. **Élève de 1er cycle avec smartphone, parent sans smartphone** : *Défaut : compte de l'élève en lecture seule, parent informé par SMS.*
9. **Saisie des notes du concours** : par le secrétaire ou par des enseignants désignés ? *Défaut : le secrétaire saisit ; l'administrateur peut désigner d'autres correcteurs plus tard.*
10. **Numéro interne provisoire** et **liste de pièces** par défaut. *Défaut : section 6.*
11. **Dépassement de capacité** : blocage contournable avec motif (défaut) ou blocage strict.

---

## 17. Tests attendus

- **Permissions (API)** : chaque ligne du tableau 4.1, pour chaque rôle, avec et sans option de délégation (403 attendu).
- **Machine à états** : toutes les transitions autorisées et interdites, activation impossible sans validation, idempotence.
- **Profil d'accès** : une ligne de test par ligne du tableau 7.2, plus les cas limites et le recalcul au changement de cycle.
- **Concours** : génération des codes (unicité), répartition en salles, calcul de moyenne pondérée, simulateur (ex æquo), libération de place et promotion de la liste complémentaire, consultation publique limitée en débit et non énumérable.
- **Multi-établissement** : aucun accès entre établissements.
- **Migration** : établissements existants inchangés en comportement jusqu'à confirmation.
- **Interface** : 375 / 768 / 1280 / 1920 px, thème clair et sombre, clavier, `prefers-reduced-motion`.

---

## 18. Ce qu'il ne faut pas faire

- Ne pas laisser un rôle valider ce qu'il a créé lui-même (hors administrateur avec délégation activée).
- Ne pas exposer de liste publique de mineurs par défaut.
- Ne pas bloquer une inscription faute de smartphone, d'email ou de matricule national.
- Ne pas créer d'URL publique permanente pour des pièces justificatives.
- Ne pas coder de contrôle de rôle « en dur » dans l'interface : passer par les permissions.
- Ne pas appeler `inngest.send()` depuis un contrôleur.  # Addendum v2 — Ajustements du plan après vérification du code

À lire **avec** le document `plan-admission-inscription-zekoulabia.md`. En cas de contradiction, **cet addendum prévaut**. Il est fondé sur le rapport de vérification du code (12 points) remis par Chris.

---

## 1. Constats du code qui changent le plan

| # | Constat vérifié dans le code | Conséquence sur le plan |
|---|---|---|
| 1 | `adminGereInscriptions` existe déjà, sur la table `School` (défaut `false`), avec un interrupteur dans l'écran d'onboarding de l'administrateur et un cas d'usage `ChangerGestionInscriptionsAdminUseCase` qui journalise `ADMIN_GESTION_INSCRIPTIONS_CHANGED`. | **Ne pas recréer** cette option. La réutiliser, la déplacer dans Paramètres > Admissions (l'ancien interrupteur appelle le même cas d'usage). |
| 2 | `SchoolOnboardingSettings` existe déjà (`selfServiceEnabled`, `ageThresholdForParent`, `tokenExpiryDays`, `reminderDelayDays`), lue et écrite par `GET/PATCH /eleve-onboarding/settings`. | Y **ajouter** les champs de politique d'admission plutôt que de créer `SchoolAdmissionPolicy`. Les deux options de délégation (`adminGereInscriptions` existant, `adminGereFinances` nouveau) restent sur `School`. Une seule API et un seul écran les exposent. |
| 3 | Les règles `RejeterOnboardingUseCase` et `InscrireEleveUseCase` s'appuient sur `adminGereInscriptions`. Il existe aussi un `ValiderOnboardingUseCase`. Une migration du 18 septembre s'appelle `simplify_inscriptions_workflow`. | À vérifier dès la phase 0 : quel chemin est réellement branché, ce que cette migration a retiré, et si l'administrateur peut aujourd'hui **refuser** un dossier quand l'option est désactivée. Règle cible : **l'administrateur peut toujours valider ou refuser**, quelle que soit l'option. |
| 4 | Le formulaire de création de plans de frais et de facturation en masse n'existe **que dans l'écran administrateur** (`SectionFinance`). L'écran du personnel (`SectionFinanceStaff`) n'a aucun formulaire de création, alors que le backend l'autorise (`MANAGE_FINANCE`). | Si l'on retire ces droits à l'administrateur sans précaution, **plus personne ne peut créer de plan de frais**. Il faut d'abord construire l'écran de création côté comptable/intendant (voir phases). |
| 5 | La route `PATCH /finance/fee-plans/:id/status` applique déjà une règle de **séparation ordonnateur / payeur**. | Cette règle **doit être conservée** et testée après la refonte des permissions. |
| 6 | L'onboarding de l'établissement contient déjà les étapes `fees` et `tranches` (l'administrateur configure les frais à l'installation). | [À CONFIRMER, voir section 5] Défaut : la **configuration initiale** reste faisable par l'administrateur à l'installation ; ensuite, plans et factures relèvent du comptable/intendant (ou de l'administrateur si `adminGereFinances`). |
| 7 | Il n'existe **aucun champ `cycle`** sur `Class`. Le cycle se déduit de `Class.level` (texte libre) avec **deux listes de constantes différentes** (`SubjectAssignmentHelper` et `GenererPaiementsMinesecUseCase`, formats `6e`, `6ème`, `Form1`, `UpperSixth`…). | Créer **un seul service de domaine `CycleResolver`** (normalisation des libellés + cycle), testé, et le faire utiliser par la nouvelle fonction de profil d'accès **et** par ces deux modules. Ne pas ajouter une troisième liste de constantes. |
| 8 | `User.passwordHash` est obligatoire. La connexion (`ConnecterUtilisateurUseCase`) **ne regarde jamais `accessMode`**. Aujourd'hui `SMS_ONLY` est attribué à l'élève sans appareil qui a un téléphone de contact. | Un élève « sans compte » doit rester un `User` (contrainte du schéma) avec un mot de passe aléatoire **jamais communiqué**, et **le login doit refuser** les comptes qui ne sont pas `FULL_ACCESS`. C'est aussi une correction de sécurité (section 4). |
| 9 | Le concours n'a **ni matières, ni coefficients, ni salles, ni code candidat, ni anonymat, ni liste complémentaire**. Les candidats sous le seuil restent `PENDING`. Le CEP n'est saisi que pour les `ADMIS_PROVISOIRE` (REUSSI → `CONFIRME` + dossier `StudentOnboarding` source `CONCOURS`, ECHOUE → `ANNULE`). Un seul fichier de test (6 cas). | Voir section 2.5. Ajouter d'abord des **tests de caractérisation** du comportement actuel, puis faire évoluer. Ajouter `NON_ADMIS` : rester en `PENDING` après délibération est ambigu. Le CEP requis correspond au comportement actuel : valeur par défaut retenue. |
| 10 | L'anonymat existe dans le module Évaluations : `AnonymatCode` (code de 4 caractères, 2 lettres + 2 chiffres, soit environ 67 600 combinaisons), `NoteAnonyme`, machine à états `AnonymatRules`, générateur, écrans staff/enseignant, page publique. **Pas** de fiche de composition imprimable, **pas** de lien avec le concours. | Réutiliser `AnonymatRules`, `AnonymatCodeGenerator` et l'écran de correction, en les **généralisant** au candidat de concours (voir 2.5). Ajouter la **fiche de composition à souche détachable** en PDF (utile aussi aux évaluations). |
| 11 | SMS : fournisseur TechSoft, 18 modèles bilingues, envoi « fire-and-forget » sans nouvelle tentative, lots de 100, **aucun suivi de coût ni de solde**, échecs dans `SmsLog`, mode simulation si la clé manque. | Le jour des résultats, des centaines de SMS partiront : ajouter estimation du coût, confirmation avant envoi en masse, nouvelle tentative automatique des échecs, écran de suivi (section 2.6). |
| 12 | La route publique protégée par `authLimiter` : **10 requêtes par 15 minutes par IP**. Le token d'onboarding (64 caractères hexadécimaux, usage unique, 14 jours) est un bon modèle. | Ce limiteur est trop strict pour une page de résultats publique (les opérateurs mobiles partagent souvent une même IP entre de nombreux abonnés) et insuffisant contre le balayage de codes. Prévoir un limiteur dédié (section 2.6). |
| 13 | `ActivitiesLog` : `action`, `description`, `metadata` JSON ; appelé **après** la transaction (une panne du journal après validation peut laisser une décision sans trace). | Pour les décisions d'inscription (soumission, validation, retour, refus, activation) et de concours (délibération, publication), écrire le journal **dans la même transaction**. |
| 14 | Hors ligne : file IndexedDB chiffrée (Dexie), niveaux de risque `FORT` (refusé hors ligne) et `MOYEN` (mis en file), en-tête `Idempotency-Key`, conflits `409`. Écran « sync-offline » déjà dans le tableau de bord du personnel. | Ajouter `ENROLLMENT_DRAFT` et `EXAM_ATTENDANCE` en `MOYEN`. Classer **validation, publication, activation** en `FORT`. Vérifier que le serveur **honore** `Idempotency-Key` sur les endpoints concernés. |
| 15 | `FeeType.INSCRIPTION` existe. | S'en servir pour le lien inscription ↔ finances (phase 4). |

---

## 2. Corrections section par section

### 2.1 Politique d'admission (remplace 3.2)
Champs à **ajouter à `SchoolOnboardingSettings`** :

```
concoursEnabled            bool  défaut false
concoursTargets            liste de { level, serie? }   // ex. { '6e' } ou { '2nde', 'A4' }
requireCepForAdmission     bool  défaut true            // comportement actuel
scoresPublicationMode      ALPHABETIQUE | CLASSEMENT    // défaut ALPHABETIQUE
publicListEnabled          bool  défaut false
seatReservationDays        entier défaut 14
smsBulkConfirmThreshold    entier défaut 50             // voir 2.6
piecesChecklist            configuration des pièces (section 6 du plan)
```
Sur `School` : `adminGereInscriptions` (existant) et `adminGereFinances` (nouveau, défaut `false`).

**Les niveaux du concours ne sont pas une liste fixe** : le sélecteur propose les niveaux et séries **réellement présents** dans les classes de l'établissement (`Class.level`, `Class.serie`), affichés avec les libellés du sous-système (francophone/anglophone).

### 2.2 Étape d'onboarding (précise 3.3)
Insérer une étape `admissions` dans le tableau des étapes de `ConversationalOnboarding.tsx`, **après `direction` et avant `recap`**, avec le bloc de rendu correspondant dans le `switch (stepKey)`. Elle contient les trois cartes (concours / dossier / selon le niveau), le sélecteur de niveaux et le bloc « Qui fait quoi ? ». Ajouter les nouvelles valeurs au récapitulatif final. Dans Paramètres, ajouter la page **Admissions** dans `SectionSettings.tsx`, alimentée par les mêmes endpoints (`/eleve-onboarding/settings` et le cas d'usage des délégations).

### 2.3 Permissions et finances (précise 4)
- `canValidateEnrollment(user)` : **l'administrateur toujours**, sans dépendre de `adminGereInscriptions`.
- `canDraftEnrollment(user)` : personnel avec `MANAGE_ENROLLMENT`, **ou** administrateur si `adminGereInscriptions`.
- Remplacer, dans `FinanceController`, le contrôle `role === 'ADMIN' || MANAGE_FINANCE` par : `MANAGE_FINANCE` **ou** (administrateur **et** `adminGereFinances`). Appliquer aux 5 routes d'écriture (`fee-plans`, `copy-from-previous-year`, `fee-plans/:id/status`, `invoices`, `invoices/bulk`).
- **Ordre obligatoire** : ne retirer l'écriture financière à l'administrateur qu'**après** la livraison de l'écran de création côté personnel (phase 1B).
- Migration : pour les établissements existants, `adminGereFinances = true` au départ (rien ne casse), avec un **bandeau** invitant l'administrateur à confirmer. Pour les nouveaux établissements : `false`.
- Conserver la règle de séparation ordonnateur/payeur ; ajouter un test.
- Le rôle « comptable » : vérifier dans `StaffPermissionRules` quels titres portent `MANAGE_FINANCE` (le rapport mentionne Intendant/Économe). Si « Comptable » n'existe pas, le signaler ; ne pas le créer sans décision de Chris.

### 2.4 Machine à états (précise 5)
- Réutiliser `ValiderOnboardingUseCase` (validation), `RejeterOnboardingUseCase` (refus) et `InscrireEleveUseCase` (activation transactionnelle). Décider **un seul chemin** : `soumettre → valider → activer`, et supprimer ou désactiver tout raccourci qui contourne la validation.
- L'activation exige `VALIDATED` avec un valideur ayant `canValidateEnrollment`. Exception : administrateur avec `adminGereInscriptions` (création, validation et activation tracées comme « inscription directe par l'administrateur »).
- Journal (dans la transaction) : `ENROLLMENT_SUBMITTED`, `ENROLLMENT_RETURNED`, `ENROLLMENT_VALIDATED`, `ENROLLMENT_REJECTED`, `ENROLLMENT_ACTIVATED`, `ADMISSION_POLICY_CHANGED`, avec `metadata` contenant l'état **avant/après** et le commentaire. Le nom actuel `ONBOARDING_VALIDATED` (utilisé à l'activation) doit être clarifié et migré.

### 2.5 Concours (précise 9)
1. **Tests d'abord** : écrire des tests de caractérisation pour `EnregistrerResultatCepUseCase`, `ScannerListeCandidatsUseCase` (à lire et réutiliser, son rôle exact est à confirmer) et les routes du concours, avant toute modification.
2. **Statuts** : ajouter `NON_ADMIS`, `LISTE_ATTENTE`, `DESISTE`, `ABSENT`. Après délibération, plus de candidats laissés en `PENDING`.
3. **CEP** : comportement actuel conservé par défaut (`requireCepForAdmission = true` : le résultat du CEP suit l'admission provisoire). Si désactivé, l'admission provisoire ouvre directement le dossier pré-rempli.
4. **Notes par matière** : `EntranceExamSubject`, `EntranceExamScore` comme prévu. Conserver `examScore` comme **moyenne pondérée calculée** pour ne pas casser `CalculerAdmissionConcoursUseCase` et ses tests.
5. **Codes et anonymat** :
   - `codeCandidat` public (préfixe établissement + numéro), unique par session.
   - Anonymat : **généraliser** `AnonymatCode` au candidat (colonne optionnelle `candidateId`, ou table jumelle si le couplage avec les évaluations est trop fort : à décider après lecture). Contrainte d'unicité **par session**. Avec environ 67 600 combinaisons, prévoir l'erreur claire si une session dépasse la capacité.
   - Fiche de composition **à souche détachable** en PDF (PDFKit) : la souche porte l'identité et le `codeCandidat`, la copie ne porte que le code anonyme.
6. **Documents PDF** : ajouter `EXAM_CONVOCATION` (et, si utile, `EXAM_RESULTS`) à `VerifiableDocumentType`, avec migration. La liste d'émargement et l'affiche des résultats n'ont pas besoin d'être vérifiables. Réutiliser `SchoolDocumentPdfRenderer` (PDFKit + QR déjà présents).
7. **Anti-régression** : garder les modèles SMS existants (admission provisoire, confirmation CEP, annulation CEP) et les faire évoluer, sans les casser.

### 2.6 Résultats, SMS et exposition publique (précise 10)
- **Limiteur dédié** aux pages de résultats, **différent d'`authLimiter`** : limite par IP **large** (pour absorber les IP partagées des opérateurs), et limite **par code candidat** (par exemple 5 essais de date de naissance erronés par heure, puis blocage temporaire). Réponse **identique** que le code existe ou non (pas d'énumération).
- **Lien direct par SMS** : chaque parent reçoit un lien contenant un **jeton secret propre au candidat** (même approche que le token d'onboarding : aléatoire de 64 caractères, révocable). Le jeton ouvre directement le résultat ; la saisie code + date de naissance sert de solution de secours.
- **Envoi en masse** :
  1. **Estimation** avant envoi (nombre de SMS, découpage Unicode des messages avec accents, coût si le tarif unitaire est configuré).
  2. **Confirmation obligatoire** de l'administrateur au-delà de `smsBulkConfirmThreshold`.
  3. **File d'envoi avec nouvelles tentatives** (Inngest, avec attente croissante) pour les échecs enregistrés dans `SmsLog`, plafonnées, avec état final visible.
  4. **Écran de suivi** : envoyés, en attente, échoués, avec relance en un clic.
  5. Messages **courts** (limiter les caractères accentués pour ne pas doubler le nombre de segments).
- Suivi de coût et solde par établissement : **hors périmètre**, sauf décision de Chris (question en section 5).

### 2.7 Profil d'accès (précise 7)
- Étendre `UserAccessMode` avec `NO_LOGIN` (élève sans compte, géré par le parent ou le secrétariat). `SMS_ONLY` reste pour les utilisateurs qui n'ont qu'un téléphone simple. Appliquer la fonction `resoudreProfilAcces` aux **élèves et aux parents** (aujourd'hui seul l'élève reçoit un mode).
- **Login** : `ConnecterUtilisateurUseCase` refuse `SMS_ONLY` et `NO_LOGIN` avec un code d'erreur explicite. Avant de déployer, **compter** en base les utilisateurs `SMS_ONLY` et vérifier qu'aucun ne se connecte aujourd'hui.
- **Élève en accès limité** (1er cycle avec smartphone) : ajouter `studentAccessScope` (`FULL` / `READ_ONLY`) et `profileManagedBy` (`PARENT` / `STUDENT` / `SECRETARIAT`) sur `StudentProfile`, et faire respecter `READ_ONLY` par les endpoints de modification du profil élève.
- Le cycle vient de **`CycleResolver`** (constat 7). La règle d'âge (`ageThresholdForParent`) reste un repli si le niveau est inconnu.

### 2.8 Finances et inscriptions (précise 11)
- L'événement `enrollment.validated` (publié via `EventPublisher`) est consommé par Finances : tâche « nouvel élève à facturer », ou création automatique des obligations selon le plan de frais du niveau si un plan actif de type `INSCRIPTION` existe [À CONFIRMER].
- Le secrétaire voit l'état des frais en lecture seule.

### 2.9 Hors ligne (précise 11 du plan)
- Types : `ENROLLMENT_DRAFT` et `EXAM_ATTENDANCE` en risque `MOYEN`. `ENROLLMENT_VALIDATE`, `ENROLLMENT_ACTIVATE`, `EXAM_PUBLISH` en `FORT` (refusés hors ligne).
- Le serveur doit **respecter `Idempotency-Key`** sur les endpoints de brouillon et d'émargement (à vérifier, et à implémenter s'il ne l'est pas).
- Utiliser l'écran « sync-offline » du secrétaire pour montrer les brouillons en attente.

---

## 3. Nouvel ordre des phases

### Phase 0 — Sécurité et vérifications (avant toute fonctionnalité)
1. Vérifications de la section 6 (rapport court à Chris).
2. **Login** : refuser `SMS_ONLY` et `NO_LOGIN` (après comptage des comptes concernés).
3. **Admin toujours capable de valider/refuser** (constat 3).
4. Journal d'audit dans la transaction pour les décisions d'inscription.
5. `CycleResolver` + tests, branché dans les deux modules existants.
6. Tests de caractérisation du concours actuel.

### Phase 1A — Politique, permissions inscriptions, validation obligatoire
Comme la phase 1 du plan, **sans** toucher aux droits financiers de l'administrateur.

### Phase 1B — Finances côté personnel
Écran de création de plans de frais et de facturation en masse pour les titres avec `MANAGE_FINANCE`, avec règle ordonnateur/payeur conservée. Puis, seulement ensuite, activation de `adminGereFinances` (défaut `false` pour les nouveaux établissements, `true` pour les existants avec bandeau de confirmation).

### Phases 2 à 5
Comme dans le plan, avec les ajouts de la section 2 de cet addendum (concours en phase 3 : tests de caractérisation d'abord, généralisation de l'anonymat, fiche à souche, limiteur dédié, suivi des SMS).

---

## 4. Corrections de sécurité à traiter tout de suite (phase 0)

1. **Le login ignore `accessMode`.** Un compte `SMS_ONLY` peut se connecter s'il connaît son mot de passe. Corriger, avec message explicite.
2. **L'administrateur ne doit pas être bloqué** dans le refus de dossiers selon l'option de délégation.
3. **Audit hors transaction** pour les décisions critiques.
4. **Capacité de classe non contrôlée** : brancher `peutAccueillir/estPleine` dans l'onboarding **et** dans l'import Excel (`StudentImportHandler`), avec alerte et contournement motivé.
5. **Route publique des résultats** : ne pas réutiliser `authLimiter` tel quel.

---

## 5. Décisions à confirmer (ajouts et rappels)

Nouvelles :
- **A. Étapes `fees` et `tranches` de l'onboarding** : l'administrateur configure-t-il toujours les frais à l'installation ? *Défaut : oui pour la configuration initiale ; ensuite, comptable/intendant.*
- **B. Coût des SMS** : qui paie (établissement ou plateforme) et faut-il suivre un solde par établissement ? *Défaut : estimation + confirmation au-delà de 50 SMS, sans suivi de solde.*
- **C. Élève sans compte** : représenter l'état par un nouveau `UserAccessMode.NO_LOGIN`. *Défaut : oui.*

Rappel (valeurs par défaut du plan, section 16) : processus réel du concours de l'établissement client, validation des admis par l'administrateur (par lot), qui encaisse les frais, publication individuelle ou liste publique, paramètre modifiable, cas élève 1er cycle avec smartphone et parent sans smartphone, saisie des notes, numéro interne, dépassement de capacité.

---

## 6. Vérifications à faire au début de la phase 0 (lecture seule, rapport court)

1. Quel chemin d'inscription est réellement branché aujourd'hui : `ValiderOnboardingUseCase` ou seulement `InscrireEleveUseCase` ? Que retire la migration `simplify_inscriptions_workflow` ?
2. L'administrateur peut-il refuser un dossier quand `adminGereInscriptions = false` ? (`RejeterOnboardingUseCase`, lignes autour de 42-44.)
3. Titres du personnel (`StaffPermissionRules`) qui portent `MANAGE_FINANCE`. Existe-t-il un titre « Comptable » ?
4. Détail de la règle de séparation ordonnateur/payeur dans `FinanceController` (ligne autour de 358).
5. Rôle exact de `ScannerListeCandidatsUseCase`.
6. Couplage de `AnonymatCode` / `NoteAnonyme` avec les modèles d'évaluations : colonnes obligatoires, relations. Faisabilité de la généralisation au candidat de concours.
7. Le serveur honore-t-il `Idempotency-Key` ? Sur quels endpoints ?
8. Schéma de `SmsLog` et point d'entrée pour une file de nouvelles tentatives Inngest.
9. Nombre de comptes `SMS_ONLY` existants en base et dernière connexion de chacun.
10. Comment l'application front vérifie-t-elle aujourd'hui le rôle pour afficher la section Finance dans le tableau de bord du personnel (`allowedSections`, `_types.ts`) : ce qu'il faut ajouter pour l'écran de création de plans.

---

## 7. Critères d'acceptation supplémentaires

- [ ] Un compte `SMS_ONLY` ou `NO_LOGIN` ne peut pas se connecter (message explicite) ; aucun compte existant légitime n'est bloqué.
- [ ] L'administrateur valide et refuse quel que soit `adminGereInscriptions`.
- [ ] Les décisions d'inscription apparaissent dans le journal **même si** le service de journal échoue après coup (écriture dans la transaction).
- [ ] Une seule source de vérité pour le cycle (`CycleResolver`), utilisée par les trois modules, avec tests sur `6e`, `6ème`, `Form1`, `LowerSixth`, `UpperSixth`, `2nde`, `1ère`, `Tle`.
- [ ] Un plan de frais peut être créé par le comptable/intendant depuis son écran **avant** que l'administrateur perde ce droit.
- [ ] La séparation ordonnateur/payeur est testée avant et après la refonte.
- [ ] Un concours de 500 candidats : codes anonymes uniques, aucune collision ; erreur claire si la capacité du format de code est dépassée.
- [ ] Page publique de résultats : 5 essais erronés sur un code le bloquent temporairement ; la réponse ne révèle pas l'existence du code ; un lien SMS personnel fonctionne sans saisie.
- [ ] Envoi de résultats en masse : estimation affichée, confirmation demandée, échecs relancés automatiquement, tableau de suivi consultable.
- [ ] Les tests existants du concours (6 cas) passent toujours ; de nouveaux tests couvrent CEP, statuts et routes.   EXIGENCE DE DESIGN (aussi importante que le fonctionnel)

Une page qui marche mais qui est laide ou mal adaptée au mobile n'est pas terminée. La première impression, c'est ce que les utilisateurs voient : soigne la forme autant que le fond.

Référence : le babillard (panneau, feuilles, punaises, cadre, vue de lecture, formulaire avec aperçu). Vise le même niveau de finition sur TOUTES les pages de ce chantier : politique d'admission, section Inscriptions du secrétaire, file de validation de l'administrateur, assistant de dossier, écrans du concours, pages publiques de résultats.

Règles :
1. Même langage visuel que le babillard : mêmes jetons de thème, mêmes polices (titres à empattement), surfaces « papier », mêmes badges et mêmes espacements. Aucune page qui ressemble à un autre produit.
2. Hiérarchie claire : un titre, une action principale bien visible, des espaces généreux, pas de bruit.
3. THÈME CLAIR ET THÈME SOMBRE : chaque page doit être lisible et belle dans les deux. Ne jamais forcer une couleur de texte sur une surface qui ne change pas de thème. Vérifier contrastes, bordures, champs, badges et graphiques dans les deux thèmes.
4. RESPONSIVE : conçois d'abord pour le mobile (375 px), puis adapte pour 768, 1280 et 1920 px. Rien ne déborde, aucun texte coupé, aucune barre qui se chevauche, boutons principaux faciles à toucher (44 px minimum). Le bouton « Assistant IA » ne doit jamais masquer du contenu : prévoir la marge basse. Pas de grand vide inutile en bas de page.
5. États soignés : chargement (squelettes), vide (illustration + action), erreur (message clair + réessayer), succès. Erreurs de formulaire sous le champ concerné, avec focus sur le premier champ invalide.
6. Textes en français, lisibles (13 px minimum pour les textes secondaires), aucun code technique visible (pas de ADMIN, STAFF, PENDING…).
7. Micro-interactions sobres (tampon « Validé », jauge qui se remplit, transitions douces), désactivées si l'utilisateur préfère moins d'animations.
8. Accessibilité : navigation clavier, focus visible, état jamais indiqué par la couleur seule.
je pense que tu venais de finir l'étape 1A donc on poursuis à partir de la suite de la phase 1 je crois:

**Phase 1B : finances côté personnel**
- 1B.1 Extraire les composants de création de plans et de facturation en masse vers un module partagé.
- 1B.2 Écran du comptable, de l'intendant ou de l'économe (protégé par `MANAGE_FINANCE`).
- 1B.3 Contrôle des routes : `MANAGE_FINANCE`, ou administrateur avec `adminGereFinances`. C'est ici que la colonne de la 1A commence à servir.
- 1B.4 Bandeau de confirmation, et tests de la règle de séparation sur les dépenses.

**Phase 2 : dossier v2**
- 2.1 Assistant en étapes avec enregistrement automatique et jauge de complétude.
- 2.2 Liste de contrôle des pièces « reçue oui/non ».
- 2.3 Profil d'accès numérique (fonction de décision, `NO_LOGIN`, accès limité de l'élève).
- 2.4 Proposition de classe et capacité (le contrôle de base existe déjà).
- 2.5 Doublons, relation parent-élève, numéro interne.
- 2.6 Fiche d'inscription imprimable avec QR code.
- 2.7 File de validation complète (tiroir de revue, validation par lot).
- 2.8 Tableau kanban du secrétaire.

**Phase 3 : concours v2**
- 3.1 Configuration par niveau et série.
- 3.2 Inscription des candidats (avec le scanner de liste papier) et codes candidats.
- 3.3 Salles, convocations, listes d'émargement.
- 3.4 Notes par matière, anonymat, fiche de composition à souche.
- 3.5 Délibération : simulateur de seuil, liste complémentaire, nouveaux statuts.
- 3.6 Publication : page de résultats publique avec limiteur dédié, lien SMS personnel, affiche PDF, SMS en masse (estimation, confirmation, nouvelles tentatives, suivi).
- 3.7 Finalisation : dossiers pré-remplis, libération des places, promotion de la liste complémentaire.

**Phase 4 : finances, rapports, cycles**
- 4.1 Événement `enrollment.validated` vers Finances (`FeeType.INSCRIPTION`).
- 4.2 État des frais en lecture seule pour le secrétaire.
- 4.3 Écrans de rapports (`GENERATE_REPORTS`).
- 4.4 Recalcul du profil d'accès à la clôture d'année.

**Phase 5 : hors ligne et pièces numérisées**
- 5.1 Brouillons de dossiers hors ligne.
- 5.2 Émargement du concours hors ligne.
- 5.3 Numérisation des pièces (photo, PDF) avec stockage protégé.

L'exigence de design (beau, thème clair et sombre, responsive) s'applique à chaque phase qui produit des écrans.

</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-20T21:33:23+01:00.

The user's current state is as follows:
Active Document: /home/ndzanachristophe/Documents/Poste de travail/ZekoulABia/frontend/src/app/admin/dashboard/_components/SectionAdmissions.tsx (LANGUAGE_TSX)
Cursor is on line: 1
Other open documents:
- /home/ndzanachristophe/Documents/Poste de travail/ZekoulABia/frontend/src/app/admin/dashboard/_components/SectionSettings.tsx (LANGUAGE_TSX)
- /home/ndzanachristophe/Documents/Poste de travail/ZekoulABia/frontend/src/features/babillard/components/UnreadAnnouncementBanner.tsx (LANGUAGE_TSX)
- /home/ndzanachristophe/Documents/Poste de travail/ZekoulABia/frontend/src/app/admin/dashboard/_components/SectionAdmissions.tsx (LANGUAGE_TSX)
</ADDITIONAL_METADATA>