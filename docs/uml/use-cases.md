# Diagrammes de cas d'utilisation corrigés — ZEKOULABIA

> Diagrammes PlantUML vérifiés et alignés sur le code réel du backend.
> Chaque diagramme est suivi des justifications des corrections apportées.

---

## DCU — Gérer comptes utilisateurs

**Acteurs :** Administrateur (Admin), Utilisateur.

```plantuml
@startuml DCU_GererComptesUtilisateurs

left to right direction

actor "Administrateur" as Admin
actor "Utilisateur" as User

' ─── UC principal : gestion des comptes (Admin) ───
usecase "Gérer comptes utilisateurs" as UC
usecase "Créer un compte utilisateur\n(envoi automatique du lien\nsi email fourni)" as UC1
usecase "Modifier un compte utilisateur" as UC2
usecase "Désactiver / Réactiver un compte" as UC3
usecase "Supprimer un compte (corbeille)" as UC4
usecase "Importer des utilisateurs en masse" as UC5
usecase "Réinitialiser le mot de passe" as UC6
usecase "Changer l'email" as UC2b
usecase "Forcer un nouveau mot de passe" as UC2c
usecase "Affecter des matières (enseignant)" as UC2d
usecase "Changer la classe (élève)" as UC2e

Admin --> UC

UC ..> UC1 : <<include>>
UC ..> UC2 : <<include>>
UC ..> UC3 : <<include>>
UC ..> UC4 : <<include>>
UC ..> UC5 : <<include>>
UC ..> UC6 : <<include>>

UC2 ..> UC2b : <<extend>>
UC2 ..> UC2c : <<extend>>
UC2 ..> UC2d : <<extend>>
UC2 ..> UC2e : <<extend>>

' ─── UC autonomes : l'utilisateur lui-même ───
usecase "S'authentifier\n(login + OTP + MFA)" as Auth
usecase "Créer son mot de passe\nvia le lien d'invitation" as Invite2
usecase "Changer son mot de passe" as Auth2
usecase "Gérer la MFA\n(activer / reconfigurer)" as Auth3

User --> Auth
User --> Invite2
User --> Auth2
User --> Auth3

@enduml
```

### Justifications

- **« Inviter » n'est pas un UC à part** : l'envoi du lien d'invitation est un effet de bord automatique de `register` et `import` (prod + email fourni) — voir `UserController.ts:570` et `ImporterUtilisateursUseCase.ts:406`. Pas de route « envoyer une invitation » séparée.
- **« Désactiver / Réactiver »** passe par `PUT /:id` avec `isActive` → `ModifierUtilisateurUseCase.ts:54` (réservé Admin).
- **Extensions de « Modifier »** : email (`isActive`/`email`/`passwordHash`/`subjectIds`/`classeId`), toutes réservées Admin sauf le self-service `change-password`.
- **`S'authentifier` en UC autonome** : précondition globale (login + OTP + MFA), pas une sous-fonction de la gestion.

---

## DCU — Gérer établissements

**Acteurs :** Super Administrateur (Master), Responsable Établissement.

```plantuml
@startuml DCU_GererEtablissements

left to right direction

actor "Super Administrateur" as SuperAdmin
actor "Responsable Établissement" as Resp

' ─── UC principal : gestion des établissements ───
usecase "Gérer établissements" as UC
usecase "Inviter un établissement" as UC1
usecase "Approuver un établissement" as UC2
usecase "Rejeter un établissement" as UC3
usecase "Suspendre un établissement" as UC4
usecase "Réactiver un établissement" as UC5
usecase "Supprimer un établissement\n(brouillon uniquement)" as UC6
usecase "Annuler une approbation" as UC7
usecase "Réexaminer un établissement" as UC8
usecase "Changer le plan d'un établissement" as UC9
usecase "Renvoyer une invitation" as UC10

SuperAdmin --> UC

UC ..> UC1  : <<include>>
UC ..> UC2  : <<include>>
UC ..> UC3  : <<include>>
UC ..> UC4  : <<include>>
UC ..> UC5  : <<include>>
UC ..> UC6  : <<include>>
UC ..> UC7  : <<include>>
UC ..> UC8  : <<include>>
UC ..> UC9  : <<include>>
UC ..> UC10 : <<include>>

' ─── Sous-flux du cycle suspendu → archivé (extensions) ───
usecase "Engager le compte à rebours d'archivage (90j)" as E1
usecase "Archiver un établissement" as E2
usecase "Stopper le compte à rebours" as E3
usecase "Notification hebdomadaire (90 jours)" as E4

UC4 ..> E1 : <<extend>>
E1 ..> E4 : <<include>>
E1 ..> E2 : <<extend>>
UC5 ..> E3 : <<extend>>
E1 ..> E3 : <<extend>>

' ─── Garde-fous ───
usecase "Vérifier hasProductionData\n(bloque la suppression si vraies données)" as G1
UC6 ..> G1 : <<include>>

' ─── S'authentifier : précondition globale (UC autonome) ───
usecase "S'authentifier\n(Master + MFA)" as Auth
SuperAdmin --> Auth

' ─── Self-service : l'établissement invité s'inscrit ───
usecase "S'inscrire (onboarding)\naprès invitation" as Self
Resp --> Self

' ─── Notifications reçues par l'établissement ───
usecase "Recevoir les notifications\nde suspension / archivage" as N
Resp --> N

@enduml
```

### Justifications

- **« Créer » → « Inviter »** : le Super Admin ne crée jamais une école directement — il invite (`POST /schools/invite`), puis l'école s'inscrit elle-même via `POST /register` (acteur Responsable Établissement).
- **`<<extend>>` du cycle suspendu → archivé** :
  - `UC4 ..> E1` : engager le compte à rebours est **optionnel**, seulement depuis une suspension — comportement conditionnel.
  - `E1 ..> E2` : l'archivage n'arrive **que si** 90 jours s'écoulent sans réaction.
  - `UC5 ..> E3` et `E1 ..> E3` : stopper le compte à rebours est une **variante optionnelle** de la réactivation (ou du compte à rebours en cours).
  - `E1 ..> E4` : la notification hebdomadaire est **obligatoire** une fois le compte à rebours engagé (`include`).
- **`Supprimer` → « brouillon uniquement »** : `hasProductionData` (élèves avec bulletin publié OU paiement enregistré) bloque toute suppression (409) — garde-fou **obligatoire** (`UC6 ..> G1 : include`). Un brouillon sans données peut être supprimé en dur.
- **Cycle de vie cible** : `DRAFT → PENDING → APPROVED → ACTIVE → SUSPENDED → ARCHIVED`, ou `SUSPENDED → ACTIVE` (réactivation). Ajout du statut `ARCHIVED` à l'enum (`schema.prisma:2210`).
- **`motif` obligatoire** pour suspendre / réactiver / archiver (déjà en place pour `reject`, `MasterAdminHexController.ts:84`).
- **`S'authentifier` extrait** de l'include : précondition globale (Master + MFA obligatoire), pas une sous-fonction.
- **`requireMasterSensitiveAuth`** : toutes les actions « décisives » (inviter, rejeter, suspendre, supprimer…) exigent une vérification d'identité renforcée.

### Changements schéma requis

```prisma
enum SchoolStatus {
  DRAFT
  PENDING
  APPROVED
  ACTIVE
  REJECTED
  SUSPENDED
  ARCHIVED            // ← ajout
}

model School {
  // ajouts :
  suspensionMotif       String?    // motif obligatoire à la suspension
  archiveCompteARebours DateTime?  // date limite de compte à rebours (null = pas engagé)
  archiveMotif          String?
  archiveNotifDerniere  DateTime?  // dernier push hebdo 90j
}
```

---

## DCU — Gérer orientation

**Acteurs :** Staff (Conseiller d'orientation), Élève.

Le module a **deux workflows** distincts : un manuel (fiche + entretiens) et un **moteur de checkpoints** automatique (fin 3ème / fin Seconde C) où **l'élève a le dernier mot**.

```plantuml
@startuml DCU_GererOrientation

left to right direction

actor "Staff (Conseiller d'orientation)" as Staff
actor "Élève" as Eleve

' ─── UC principal : gestion de l'orientation ───
usecase "Gérer l'orientation" as UC
usecase "Créer une fiche d'orientation" as UC1
usecase "Documenter l'élève (entretiens, suivis)" as UC2
usecase "Créer une recommandation de série" as UC3
usecase "Configurer les checkpoints" as UC4
usecase "Consulter les stats d'orientation" as UC5
usecase "Consulter les élèves à orienter" as UC6

Staff --> UC

UC ..> UC1 : <<include>>
UC ..> UC2 : <<include>>
UC ..> UC3 : <<include>>
UC ..> UC4 : <<include>>
UC ..> UC5 : <<include>>
UC ..> UC6 : <<include>>

' ─── Workflow moteur de checkpoints (Workflow B) ───
' La génération est AUTOMATIQUE (cron quotidien 7h) — pas un UC d'acteur.
usecase "Valider la recommandation (conseiller)" as W2
usecase "Proposer la recommandation à l'élève" as W3

UC ..> W2 : <<include>>
W2 ..> W3 : <<include>>

' ─── Extensions : sources de données optionnelles du calcul ───
usecase "Effectuer un test d'aptitude" as E1
usecase "Saisir ses aspirations" as E2

UC ..> E1 : <<extend>>
UC ..> E2 : <<extend>>

' Le test d'aptitude n'apparaît dans le workflow QUE si configuré par l'école
UC4 ..> E1 : <<extend>>

' ─── UC côté élève ───
usecase "Choisir sa piste" as P1
usecase "Consulter sa recommandation" as P2

Eleve --> P1
Eleve --> P2
Eleve --> E2

' ─── Automatique (jobs quotidiens 7h) ───
usecase "Relancer les élèves en attente" as J1
usecase "Finaliser par défaut (15j sans réponse)" as J2
usecase "Suggérer une fiche sur risque critique" as J3

Staff ..> J1
Staff ..> J2
Staff ..> J3

' ─── Précondition globale ───
usecase "S'authentifier" as Auth
Staff --> Auth
Eleve --> Auth

@enduml
```

### Justifications

- **Deux workflows** (`schema.prisma:2417-2431`) : manuel (`PROPOSEE → VALIDEE_ADMIN → ACCEPTEE_PARENT → TRANSMISE_DRES`) et moteur de checkpoints (`CALCULEE → VALIDEE_CONSEILLER → PROPOSEE_A_L_ELEVE → VALIDEE_ELEVE / VALIDEE_PAR_DEFAUT`).
- **Checkpoints** (`schema.prisma:2433`) : `FIN_TROISIEME` (3ème→Seconde, A/SES/C) et `FIN_SECONDE_C` (Seconde C→Première, C/D/TI).
- **`<<include>>` du workflow B** : ordre obligatoire (`W2 → W3`), pas de saut possible. **La génération est exclue du diagramme** : c'est une action **automatique** (cron quotidien 7h, `functions.ts:1360`), pas un UC d'acteur — le Staff n'appuie pas sur un bouton « générer ».
- **`<<extend>>`** :
  - `UC ..> E1` : le test d'aptitude alimente le calcul **s'il est présent** (optionnel par école, `psychotechnicalTestRequired` défaut `false`).
  - `UC4 ..> E1` : la config **déclenche** l'exigence du test — deux `<<extend>>` qui racontent les deux côtés (déclenchement + alimentation).
  - `UC ..> E2` : les aspirations de l'élève alimentent le calcul **si saisies**.
- **Jobs automatiques** (`functions.ts:1360`, cron quotidien 7h) : relancer, finaliser par défaut, suggérer sur risque critique — le Staff est destinataire/notifié, pas déclencheur.
- **`S'authentifier` extrait** : précondition globale, pas une sous-fonction de la gestion.