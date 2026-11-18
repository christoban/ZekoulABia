# Module Bulletins ZekoulABia — Présentation et plan d'implémentation

*Préparé pour Chris Ndzana — 18 novembre 2026*

**Ce que ce document s'appuie sur :** 5 photos de vrais bulletins (Collège Bilingue Le Québécois 3ème, GSB Le Québécois Class V, Lycée Technique de Garoua-Djamboutou, Lycée Bilingue de Garoua 2nde et 1ère annuel), les 3 PDF générés par ZekoulABia (rendus visuellement et inspectés : généré par PDFKit, police Helvetica non embarquée), et des recherches sur la réglementation des séquences et sur les moteurs de génération PDF.

**Ce que je n'ai pas vu :** le code de ZekoulABia. Je ne peux donc pas décrire le mécanisme de templates existant. La Phase 0 du plan (un audit par Claude Code, prompt fourni en annexe) sert à combler ce trou avant de coder quoi que ce soit.

---

## 1. Résumé en 10 lignes

1. Les bulletins actuels sont des **impressions de données**, pas des bulletins : pas d'en-tête officiel, pas de photo ni de matricule, pas de groupes, pas de rang par matière, pas de profil de classe, pas de conseil de classe, pas de cachet.
2. Ils ont aussi des **défauts de rendu** : texte qui se chevauche, colonne d'appréciation trop étroite, bloc moyenne écrasé dans un coin, demi-page vide.
3. Les vrais bulletins ne gagnent pas par leur beauté mais par leur **exhaustivité et leur allure officielle** : tous les repères que le parent et le proviseur cherchent sont là.
4. Il n'existe **pas de modèle officiel unique** : il y a des *familles* de bulletins (général par groupes, technique, APC bilingue, annuel, primaire) avec des variantes par école.
5. La vision proposée : un **Atelier de Bulletins**. Un bulletin = **un instantané scellé des données** + **un modèle déclaratif fait de blocs** + **un moteur de rendu**.
6. Le modèle d'une école se construit **à partir de la photo de son bulletin**, par calibrage assisté (super-admin), pas par conversion automatique magique.
7. Ce que le papier ne sait pas faire et que tu offres : calculs toujours justes, **QR de vérification anti-falsification**, duplicata tracé, mode noir et blanc fiable, bilingue automatique, aperçu parent.
8. Recommandation technique : passer le rendu en **HTML/CSS → PDF (Chromium)** derrière une interface (port) qui permet de garder PDFKit en secours, après un spike de 2 jours.
9. Plan en 8 phases ; les phases 0 à 3 peuvent produire **avant ton voyage à Garoua de décembre** un prototype de bulletin « façon Le Québécois » à montrer aux établissements.
10. Le bulletin devient un argument de vente central : « votre bulletin, à l'identique, mais juste, vérifiable et sans retravail ».

---

## 2. Diagnostic : bulletins réels contre bulletins ZekoulABia

### 2.1 Tableau d'écarts

| Élément | Bulletins réels | ZekoulABia actuel | Gravité |
| --- | --- | --- | --- |
| En-tête officiel (République du Cameroun, devise, ministère, délégations régionale et départementale, logo, version bilingue côte à côte à Garoua) | Présent partout | Nom d'école et devise fictifs seulement, pas de logo | Critique |
| Identité élève : photo, matricule, date et lieu de naissance, sexe, redoublant, effectif, professeur principal | Présents | Nom, classe, rang (l'annuel n'affiche même pas l'effectif) | Critique |
| Regroupement des matières avec moyenne de groupe (1er/2e/3e groupe ; scientifiques/littéraires/autres ; général/professionnel/divers en technique) | Présent | Absent | Haute |
| Rang par matière, moyenne de classe par matière | Présent (Québécois, Djamboutou, Garoua) | Absent | Haute |
| Total note × coefficient | Présent | Colonne « TOTAL POND. » entièrement vide | Critique |
| Règle de calcul visible (ex. EVA/20 = CC×30 % + DS×70 % au Québécois) | Présente | Notes brutes sans règle | Moyenne |
| Appréciation par discipline avec niveau (A+, A, ECA, NA ou acquise / en cours d'acquisition / non acquise) + nom de l'enseignant + visa | Présente | Texte libre, sans niveau, sans nom | Haute |
| Profil de la classe : moyenne du premier, du dernier, de la classe, nombre d'admis, taux de réussite | Présent | Absent | Haute |
| Décision du conseil de classe : tableau d'honneur, encouragements, félicitations, avertissement, blâme, exclusion | Présente | Absente | Haute |
| Conduite et assiduité : absences justifiées/non justifiées **en heures**, retards, consignes, avertissements, blâmes | Présents | « Absences : 3 » | Haute |
| Annuel : décision de fin d'année (promu en / redouble / exclu pour…) | Présente | Absente | Haute |
| Observations du chef d'établissement, visa du parent, cachet, signature, « Garoua, le … » | Présents | Lignes de signature nues | Haute |
| Marque d'authenticité (QR, code de vérification) | Absent | Absent | **Opportunité** |

### 2.2 Défauts de rendu observés sur tes PDF

- **Chevauchement de texte** : sur le bulletin de Terminale D, l'appréciation de Mathématiques déborde sur la ligne de Sciences Physiques (« …géométrie. » écrase « Niveau insuffisant… »). Cause probable : hauteur de ligne fixe, texte non mesuré avant dessin.
- **Colonne d'appréciation trop étroite** alors que la première colonne (matière) et la colonne « TOTAL POND. » (vide) gaspillent de la place, exactement comme tu l'as remarqué.
- **Bloc moyenne / mention / appréciation générale** écrasé dans l'angle droit, sur 5 à 6 lignes très courtes, alors que le reste de la largeur est vide.
- **Environ un tiers à la moitié de la page vide** en bas, alors que les vrais bulletins utilisent toute la page pour l'information.
- **Police Helvetica non embarquée** : le rendu dépend de la machine qui ouvre le PDF et le contrôle typographique est limité.
- **Rouge / orange / vert comme seul signal** de niveau des notes : ça disparaît en noir et blanc, or beaucoup d'écoles impriment en noir et blanc (et certains bulletins, comme l'annuel de Garoua, sont sur papier de couleur).
- **Absences en nombre** au lieu d'heures (J / NJ), comme tu l'as vu.
- **Langues mélangées** : « Élève / Student » partout, pied de page français sur le report card anglophone.

### 2.3 Incohérences de données (à régler avant toute démo)

- Annuel : la moyenne générale affichée est 11,54, alors qu'un calcul pondéré à partir des moyennes annuelles par matière donne environ 12,6.
- Bulletin de Terminale D : Mathématiques 13,50 et 11,00 donnent 12,33 au lieu de 12,25 ; les colonnes de moyenne reprennent exactement les valeurs de l'annuel de la 2nde C, ce qui ressemble à des données de test réutilisées.
- Dans une démo, un chef d'établissement avec une calculatrice repère ça en 30 secondes. Le moteur du bulletin ne doit **jamais calculer** lui-même (voir §5).

---

## 3. Ce que les bulletins réels nous apprennent

### 3.1 Cinq familles observées

| Famille | Exemple | Particularités |
| --- | --- | --- |
| **A. Secondaire général par groupes** | Collège Le Québécois 3ème, Lycée bilingue de Garoua 2nde | Colonnes CC / DS / EVA/20 / Coef / Total / Rang / Appréciation / Enseignant ; totaux par groupe avec moyenne de groupe ; blocs Résultat séquentiel, Profil de la classe, Décision du conseil, Récap conduite |
| **B. Technique** | Lycée technique de Garoua-Djamboutou | Matières en Enseignement général / professionnel / divers, chaque bloc avec sa moyenne et son rang ; appréciations « compétence acquise / non acquise » |
| **C. Bilingue APC** | Lycée bilingue de Garoua | Compétence visée par discipline (libellé court), en-tête FR + EN côte à côte, Trim / Éval 3 / Éval 4 avec rangs séparés |
| **D. Annuel** | Lycée bilingue 1ère A | Tri1, Tri2, Tri3 avec leurs évaluations, Moy. AN., Rang AN., profil de classe, décision de fin d'année (promu / redouble / exclu), observations du chef d'établissement |
| **E. Primaire anglophone** | GSB Le Québécois Class V | Sous-compétences notées sur un total (ex. 24/40), niveaux A+ / A / ECA / NA avec légende, résultat mensuel, performance de la classe, signatures enseignant et directeur, date d'impression |

### 3.2 Axes de variation d'une école à l'autre

Langue (FR, EN, bilingue) ; granularité (séquence, trimestre, mensuel, annuel) ; pondération (ex. CC 30 % + DS 70 %) ; regroupement (par groupes, par type d'enseignement, aucun) ; colonnes présentes ; échelle d'appréciation (texte libre, A+/A/ECA/NA, compétence acquise…) ; présence de la photo ; qui signe ; couleur du papier.

**Conclusion de conception :** il faut un moteur dont chaque axe est un **paramètre**, pas un gabarit codé en dur par école.

### 3.3 Règles officielles utiles (à confirmer sur l'arrêté de l'année en cours)

D'après le texte du calendrier scolaire (page kamerpower, qui reprend l'arrêté MINEDUB/MINESEC et qui date possiblement d'une année précédente, donc à revérifier pour 2026-2027) :

- L'année est organisée en **six séquences**, regroupées en trois trimestres.
- Hors textes particuliers pour le maternel/primaire, la **moyenne annuelle = somme des moyennes des six séquences ÷ 6**.
- Une section du carnet récapitule les résultats après deux séquences consécutives sous forme de bulletin.
- Le bulletin de la 6ème séquence donne un **récapitulatif des moyennes des autres séquences** et la **décision du conseil de classe de fin d'année**.
- Le conseil de classe examine des indicateurs dont le taux de réussite par discipline et la moyenne générale de la classe.

La règle de la moyenne annuelle doit donc être une **politique de calcul configurable avec ce défaut**, car certaines écoles (APC, technique, primaire) font autrement.

---

## 4. La vision : l'Atelier de Bulletins

> **Un bulletin ZekoulABia, c'est le bulletin que l'école connaît déjà, mais calculé juste, scellé et vérifiable.**

### 4.1 Les trois couches

1. **Instantané scellé (BulletinSnapshot)** : les données finales du bulletin, figées au moment de la validation (rattachée à la session de validation du module Assessment). Il contient tout ce qui s'affiche, déjà calculé : notes, moyennes, rangs, profil de classe, absences en heures, appréciations, décision. Il porte une empreinte (hash) et un code de vérification.
2. **Modèle déclaratif (BulletinTemplate)** : un document JSON qui décrit la page en **blocs** (en-tête, identité, tableau des matières, récap, conseil de classe, signatures…) et leurs paramètres (colonnes, largeurs, libellés, regroupement, échelle d'appréciation, langue).
3. **Moteur de rendu** : prend un snapshot + un modèle et produit le PDF. Il ne calcule rien.

Intérêt : changer l'apparence ne touche jamais aux chiffres, et réimprimer un bulletin de 2026 en 2029 donne **exactement le même document**, même si le modèle ou les notes ont évolué depuis.

### 4.2 Les idées originales (ce qui crée le poids)

1. **Calibrage depuis la photo** : le super-admin ouvre un écran à deux colonnes. À gauche, la photo du bulletin de l'école ; à droite, le rendu en direct avec un élève fictif. Il part de la famille la plus proche (A à E), puis ajuste (colonnes, regroupements, libellés, en-tête, ordre des blocs) jusqu'à ressembler à 95 %. Pas d'OCR miracle : un humain valide, c'est plus fiable, et ça s'automatise progressivement.
2. **Sceau de vérification** : un QR code sur chaque bulletin ouvre une page publique minimale (nom, classe, période, moyenne, rang, « document authentique émis par \[école\] ») sans données sensibles superflues, avec un jeton aléatoire révocable. Aucun bulletin papier ne sait faire ça, et c'est un vrai argument face aux falsifications.
3. **Mise en page à l'épreuve des débordements** : le moteur mesure chaque cellule avant de la dessiner, agrandit la ligne, réduit la police dans une limite, et en dernier recours propose « observation complète en annexe ». Plus jamais de texte qui s'écrase.
4. **Noir et blanc d'abord** : aucun niveau n'est signalé uniquement par la couleur ; les couleurs sont un bonus. Les tests incluent une vérification en niveaux de gris.
5. **Kit d'identité de l'école** : logo, armoiries (option), devise, lignes d'en-tête (délégations), couleur, image de cachet et de signature en PNG transparent. L'école configure une fois, tous les modèles en profitent.
6. **Bilingue natif** : dictionnaire de libellés FR / EN, et mode côte à côte pour les en-têtes bilingues (comme Garoua).
7. **Appréciations assistées, pas imposées** : une grille configurable par tranche de moyenne génère une proposition ; une suggestion IA optionnelle peut s'y ajouter ; l'enseignant ou le professeur principal valide toujours. Cela évite le « fait par IA » et garde l'humain responsable.
8. **Duplicata tracé** : une réimpression porte la mention « DUPLICATA » et un compteur, ce qui évite les fraudes par photocopie de l'original.
9. **Plus-values que le papier n'a pas** : petite courbe d'évolution par trimestre (bloc optionnel), moyenne de classe par matière, vue parent sur mobile depuis le même snapshot.
10. **Génération en lot** : toute une classe en un seul PDF (pour imprimer d'un coup) et des PDF individuels, via la file de jobs existante.

---

## 5. Architecture proposée

### 5.1 Principe hexagonal

- **`BulletinSnapshotBuilder`** : seul endroit où l'on calcule, en s'appuyant sur le GradingEngine et le MetricDefinition déjà livrés (V3.5). Source de vérité unique pour toutes les moyennes et tous les rangs.
- **`BulletinRendererPort`** : interface `render(snapshot, template) → PDF`. Deux adaptateurs possibles : `PdfKitRenderer` (évolution du code actuel) et `HtmlChromiumRenderer`.
- **`BulletinTemplateRepository`** : modèles globaux (familles prêtes à l'emploi) et modèles d'établissement.

### 5.2 Choix du moteur de rendu : recommandation et alternatives

| Option | Pour | Contre |
| --- | --- | --- |
| **HTML/CSS → PDF via Chromium (Playwright)** | Fidélité maximale aux mises en page variées ; tableaux et cadres faciles ; modèles éditables en HTML/CSS (ton équipe design peut y contribuer) ; polices web embarquées | Plus lourd : les comparatifs mesurent de l'ordre de 1,3 à 3 secondes par PDF et 200 à 300 Mo de mémoire par instance Chromium ; image de conteneur plus grosse |
| **PDFKit amélioré (moteur de mise en page maison)** | Très rapide et léger, déjà en place | Chaque bloc, chaque cas de débordement et chaque variante d'école est du code à écrire : le coût de reproduire « 95 % » de nombreux modèles grimpe vite |

**Recommandation :** HTML/CSS + Chromium, car ton objectif est de reproduire de nombreux modèles de façon fidèle et d'itérer vite. Pour contenir le coût : navigateur réutilisé entre les PDF, génération en arrière-plan via Inngest, conteneur dédié « document-service » (pour ne pas alourdir le backend), 1 à 2 instances au plus. Ordre de grandeur : une classe de 60 élèves en 1 à 3 minutes, un établissement de 1 000 élèves en une trentaine de minutes en tâche de fond. À valider par un **spike de 2 jours** (voir Phase 2) sur ton environnement Azure, avec ton crédit limité à l'esprit (mise à l'échelle à zéro possible, au prix d'un démarrage à froid).

Si le spike est mauvais (mémoire, coût), le port permet de rester sur PDFKit sans refaire le reste.

### 5.3 Modèle de données (esquisse Prisma, à adapter après l'audit)

- **BulletinTemplate** : id, schoolId (nul pour une famille globale), familyKey (A à E ou autre), name, language (FR, EN, BILINGUAL), spec (JSON), version, status (DRAFT, PUBLISHED), createdBy.
- **BulletinTemplateAssignment** : schoolId, cycle/niveau/classe, periodType (SEQUENCE, TRIMESTRE, ANNUEL, MENSUEL), templateId.
- **BulletinSnapshot** : id, studentId, classId, academicYearId, periodType, periodKey, data (JSON), templateId + templateVersion, contentHash, verifyToken, status (DRAFT, SEALED, REVOKED), sealedAt, sealedBy, reprintCount.
- **SchoolIdentityKit** : schoolId, logo, coatOfArms (option), motto, headerLines (JSON), accentColor, stampImage, signatureImages (par fonction).
- **GradingPolicy** (peut déjà exister dans le moteur de notes) : formule de séquence (ex. CC 30 / DS 70), règle de moyenne trimestrielle et annuelle, arrondi, traitement des notes absentes.

### 5.4 Exemple de spec de modèle (extrait)

```json
{
  "page": { "size": "A4", "orientation": "portrait", "margin": 10 },
  "blocks": [
    { "type": "officialHeader", "bilingual": true, "showLogo": true },
    { "type": "studentCard", "fields": ["photo","matricule","birth","sex","repeater","classSize","mainTeacher"] },
    { "type": "subjectTable",
      "grouping": "byGroup",
      "columns": ["cc","ds","eva","coef","total","rank","appreciation","teacher"],
      "appreciationScale": "A+/A/ECA/NA",
      "groupAverage": true },
    { "type": "classProfile", "fields": ["topAvg","lowAvg","classAvg","passCount","passRate"] },
    { "type": "councilDecision", "items": ["honorRoll","encouragement","congrats","warning","blame"] },
    { "type": "conductSummary", "absenceUnit": "hours", "fields": ["absJ","absNJ","late","detention"] },
    { "type": "signatures", "slots": ["parent","mainTeacher","principal"], "stamp": true, "placeDate": true },
    { "type": "verifyQr", "position": "bottomRight" }
  ]
}
```

---

## 6. Catalogue de modèles prêts à l'emploi (MVP)

| Famille | Couvre en priorité | Templates MVP concernés |
| --- | --- | --- |
| A. Général par groupes (séquence/trimestre) | Réplique Le Québécois 3ème et Garoua 2nde | PRIVE\_FR, LYCEE\_FR, CES\_FR, COMPLEXE\_SCOLAIRE |
| B. Technique (général / professionnel / divers) | Réplique Djamboutou | LYCEE\_FR technique |
| C. Bilingue APC | Réplique Garoua (compétence visée, en-tête FR+EN) | LYCEE\_BILINGUE |
| D. Annuel | Tri1/Tri2/Tri3 + décision de fin d'année | Tous |
| E. Anglophone secondaire (report card) | Class test / Exam / Teacher comment | GHS\_EN, PRIVE\_EN, GSS\_EN |
| F. Primaire | Sous-compétences, niveaux A+/A/ECA/NA, résultat mensuel | Primaire FR, EN, bilingue |

Commence par **A et D**, parce que PRIVE\_FR est ton template de lancement.

---

## 7. Plan d'implémentation

Les durées sont des **estimations indicatives** pour un développeur solo assisté par Claude Code ; elles seront affinées après l'audit de la Phase 0.

### Phase 0 — Audit de l'existant (1 à 2 jours)

- **Livrable :** rapport écrit sur la génération actuelle des bulletins (fichiers, mécanisme de template s'il existe, sources de données, tests) et liste des écarts avec ce plan.
- **Critère d'acceptation :** tu sais exactement quoi garder, quoi remplacer, quoi supprimer.
- Prompt prêt à l'emploi en annexe.

### Phase 1 — Snapshot fiable et calculs (3 à 4 jours)

- `BulletinSnapshotBuilder` branché sur le GradingEngine et MetricDefinition ; politique de calcul configurable (défaut : moyenne annuelle = somme des 6 séquences ÷ 6).
- Données complètes : rangs par matière, moyenne de classe, profil de classe, absences en heures J/NJ, appréciations, décision.
- **Tests de vérité :** jeu de données dont les résultats sont calculés à la main ; aucun écart toléré. Les incohérences du §2.3 doivent disparaître.
- **Critère :** un snapshot de classe complet est produit et relu sans erreur.

### Phase 2 — Moteur de rendu et premier modèle (5 à 7 jours)

- **Spike (2 jours)** : Chromium contre PDFKit, mesures sur une classe de 60 dans ton environnement ; décision écrite.
- Port de rendu, bibliothèque de blocs, polices embarquées, mise en page mesurée sans débordement.
- Premier modèle : **famille A, réplique du Québécois 3ème** avec un élève fictif.
- **Critères :** zéro chevauchement avec jeu de textes extrêmes ; lisible en niveaux de gris ; rendu correct sur une imprimante de bureau.

### Phase 3 — Identité de l'école, signatures et QR (3 à 4 jours)

- `SchoolIdentityKit` (logo, devise, délégations, cachet, signatures), photo de l'élève, bloc signatures avec lieu et date.
- Sceau de vérification : jeton, page publique minimale, révocation.
- **Critère :** un bulletin complet « à l'identique » et vérifiable par scan.

> **Jalon avant Garoua (décembre) :** les Phases 0 à 3 donnent un prototype de bulletin dans le format d'un vrai établissement, rempli avec un élève fictif. À montrer en enquête, c'est beaucoup plus parlant qu'un questionnaire.

### Phase 4 — Autres familles (1 semaine environ)

- D (annuel avec décision), puis B, C, E, F, une famille à la fois, chacune validée sur au moins un vrai bulletin photographié.

### Phase 5 — Atelier du super-admin (1 à 2 semaines)

- Écran de calibrage : photo à gauche, rendu en direct à droite ; choix de la famille de départ ; réglage des colonnes, regroupements, libellés, blocs ; versionnage et publication ; affectation par niveau et type de période.
- **Pour le MVP commercial de janvier-février 2027**, une version minimale suffit : tu codes les modèles toi-même à partir des spec JSON, sans éditeur visuel.

### Phase 6 — Production en volume (3 à 5 jours)

- Génération par classe via la file de jobs, suivi de progression, PDF individuels + PDF de classe, duplicata tracé, partage dans l'espace parent.

### Phase 7 — Validation terrain (en continu)

- Impression sur de vraies imprimantes (noir et blanc inclus), retours de directeurs, secrétaires et professeurs principaux ; ajustement des familles.

### Phase 8 — Assistant de calibrage par IA (optionnel, après le MVP)

- À partir de la photo, l'IA propose un premier JSON de modèle (famille, colonnes, groupes, libellés) que le super-admin valide dans l'Atelier. L'humain reste dans la boucle.

---

## 8. Qualité et tests

- **Jeux de vérité** pour les calculs (moyennes, rangs, ex æquo, notes absentes, coefficients nuls).
- **Tests de débordement** : noms très longs, appréciations de 400 caractères, 22 matières, accents et ligatures.
- **Contrôle visuel automatisé** : rendu en image et comparaison à une référence pour chaque famille.
- **Test niveaux de gris** : aucune information perdue sans couleur.
- **Performance** : objectif indicatif, une classe de 60 en moins de 3 minutes en tâche de fond.
- **Sécurité** : le jeton de vérification est aléatoire, la page publique n'expose que le minimum, la révocation est immédiate.

---

## 9. Risques et décisions ouvertes

1. **Coût mémoire de Chromium sur Azure** avec un crédit limité : à trancher par le spike ; repli possible sur PDFKit grâce au port.
2. **Reproduction des en-têtes officiels et des armoiries** : c'est la pratique des établissements, mais il faut que ce soit l'école qui active et fournisse ses éléments (kit d'identité), pas ZekoulABia qui les impose.
3. **Cachet et signature numériques** : à valider auprès des écoles ; beaucoup imprimeront puis apposeront cachet et signature à la main. Prévoir les deux options (zone vide ou image).
4. **Règle de moyenne annuelle** : à confirmer sur l'arrêté de l'année en cours et auprès des écoles (APC, technique, primaire peuvent différer).
5. **Dépendance au module Assessment** (encore en Phase 2) : le snapshot s'appuie sur la validation des notes ; à synchroniser avec son avancement.
6. **Concurrence :** les bulletins du Québécois portent la mention « Powered by 2FSOFT Consulting » et ceux de Garoua mentionnent une équipe de conception ; il existe donc déjà des logiciels et prestataires en place, à étudier lors de l'enquête.

### Questions à ajouter à ton guide d'enquête (module bulletins)

- Qui fabrique le bulletin aujourd'hui (logiciel, prestataire, Excel, à la main) et combien ça coûte ?
- Quelle formule de calcul exactement (CC/DS, pondération, moyenne trimestrielle, annuelle) ?
- Qui remplit les appréciations et à quel moment ? Qui signe ? Qui appose le cachet ?
- Imprimé en noir et blanc ou en couleur ? Sur quel papier ? Une page ou recto-verso ?
- Quels éléments sont obligatoires pour l'école et quels éléments sont superflus ?
- Combien de temps entre la fin des évaluations et la remise des bulletins, et pourquoi ?
- Les parents réclament-ils souvent des corrections ? Sur quoi ?
- Y a-t-il eu des cas de falsification de bulletin ?

---

## Annexe — Prompt d'audit pour Claude Code (Phase 0)

```
Tu es Tech Lead sur ZekoulABia. Objectif : auditer la génération actuelle des bulletins sans rien modifier.

1. Localise tout le code qui génère des bulletins ou documents PDF (PDFKit ou autre) : fichiers, use cases, controllers, ports, adapters.
2. Décris le mécanisme de templates de bulletin s'il existe : où il est défini, comment un template est choisi (par type d'établissement ? par niveau ?), ce qu'il paramètre.
3. Liste les sources de données utilisées (notes, coefficients, rangs, absences, appréciations) et dis si le calcul de moyenne se fait dans le générateur PDF ou via GradingEngine / MetricDefinition.
4. Liste les écarts de calcul possibles avec le GradingEngine (moyenne générale, moyenne annuelle, arrondis, notes absentes).
5. Indique le nombre de tests existants sur les bulletins et ce qu'ils couvrent.
6. Confronte le résultat à ce plan : pour chaque bloc (en-tête officiel, identité avec photo, groupes, rang par matière, profil de classe, conseil de classe, absences en heures, décision annuelle, signatures, QR) dis s'il existe, partiellement, ou pas du tout.
7. Produis un rapport : ce qu'on garde, ce qu'on remplace, ce qu'on supprime, et les risques.

Règles : aucune modification de code, aucune hypothèse non vérifiée dans le code, cite les fichiers et lignes.
```
