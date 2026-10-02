# Plan d'implémentation — Babillard numérique & Messagerie bidirectionnelle

> Document de pilotage (même convention que `PLAN_VERIFICATION_ET_ACTIONS_SUIVI.md`) : mis à jour
> en place avec des blockquotes `> ✅ FAIT` au fur et à mesure, jamais laissé purement aspirationnel.
> Décisions actées avec l'utilisateur avant rédaction : **(1)** publication babillard ouverte à
> Admin + tout STAFF, sans nouvelle permission · **(2)** messagerie : les 4 couches (Canal Classe,
> Canal Parents, Message Privé, Notifications Système) construites ensemble en V1 · **(3)** pièces
> jointes reportées à une V1.1, texte seul pour l'instant.

---

## 0. Ce que l'audit du code réel a changé par rapport à ce qui était prévu

Avant d'écrire une ligne de plan, vérification faite dans le code (pas dans le document
`EduNexus_Carte_Complete_V2.md` seul, qui ne mentionne même pas le babillard) :

| Ce qui était supposé | Ce qui est réellement dans le code |
|---|---|
| Aucun modèle pour le babillard, à créer | **`Announcement` existe déjà** dans `schema.prisma` (`title`, `content`, `targetRoles`, `isPinned`, `authorId`, `expiresAt`) — 0 référence dans `backend/src` ni `frontend/src`, un stub pur, jamais câblé |
| Aucun modèle pour la messagerie, à créer | **`Conversation`/`Message`/`MessageReadStatus` existent déjà**, avec `enum ConversationType { PRIVATE, CLASS_CHANNEL, PARENT_CHANNEL, SYSTEM }` — correspond exactement aux "4 couches" déjà pensées il y a plusieurs mois. Stub pur également, 0 référence. |
| Il faut un nouveau système offline-first (`@slimr/dbsync`, `later-queue`, `tyofflinejs`) | **Un système offline-first complet et testé existe déjà** : `frontend/src/hooks/useSyncQueue.ts` (file d'attente Dexie, écriture optimiste, clé d'idempotence UUID générée côté client) + `backend/src/middleware/idempotency.ts` (middleware générique monté globalement, dédoublonne via `IdempotencyRecord`). Actif sur 12+ types d'actions (présences, notes, APEE, discipline...). **Aucune nouvelle librairie nécessaire** — les paquets suggérés dans les conseils reçus ne sont pas identifiables comme des paquets npm réels et largement utilisés ; ne pas les ajouter. |
| Il faut poser la PWA (`@serwist/next`) | **Déjà posée et fonctionnelle** avec `@ducanh2912/next-pwa` — deux bugs de production déjà trouvés et corrigés (Turbopack incompatible avec `next-pwa`, résolu via `next build --webpack` ; chemin avec apostrophe cassait Workbox). Ne pas remplacer un système qui marche par un autre. |
| Diffusion "babillard" à construire depuis zéro | Un mécanisme de diffusion **différent** existe déjà et reste actif : `CommunicationsController.ts` + `BroadcastLog` — diffusion **externe** (SMS/Email) ciblée par rôle/classe/statut de paiement. Ce n'est **pas** le babillard (pas de flux persistant consultable en interne, pas d'expiration, pas d'épinglage) — les deux coexistent, ne pas les confondre ni fusionner. |
| Modèle `OfflineQueue` (table Prisma) à utiliser pour la synchro | **Modèle mort** — présent dans le schema, 0 référence dans `backend/src`. Le vrai mécanisme d'idempotence utilise `IdempotencyRecord`, une table différente. Ne pas s'appuyer sur `OfflineQueue`. |

**Conséquence directe :** ce chantier n'est pas un projet greenfield. C'est du **câblage** de deux
modèles de données déjà bien pensés vers de vrais use cases, controllers, routes et UI —
beaucoup plus proche en volume de travail d'un module comme "Transparence APEE" (déjà livré) que
d'une reconstruction complète.

### Sur les conseils reçus dans les autres conversations

Le conseil de **séparation des rôles** (babillard = diffusion, messagerie = échange, push =
alerte) est juste et directement applicable — il correspond même exactement à la distinction
déjà actée dans le code entre `Announcement` (diffusion) et `Conversation`/`Message` (échange),
la troisième couche (notifications) étant déjà l'infrastructure `Notification` + Web Push +
cloche IN_APP construite cette session pour d'autres fonctionnalités.

Le "cahier des charges offline-first" (métaphore Facebook, UI optimiste, ID généré côté client,
synchronisation à la reconnexion, endpoint de rattrapage `?since=`) décrit **fidèlement** le
système déjà en place — juste avec un vocabulaire différent (leur "Robot/Service Worker qui
surveille la porte" ≈ le hook `useSyncQueue` qui écoute `online`/`offline` et rejoue la file ;
leur "ID généré côté client" ≈ `idempotencyKey` déjà générée en UUID par `crypto.randomUUID()`).
Une seule nuance technique réelle à trancher plus bas (§4.4) : le système actuel synchronise
quand l'onglet redevient en ligne **pendant qu'il est ouvert**, pas via la Background Sync API du
navigateur (qui peut réveiller un Service Worker même appli fermée). Pour la messagerie
spécifiquement — où "recevoir une réponse pendant que je ne regarde pas l'app" compte plus que
pour une saisie de notes — la couverture de ce cas se fait par la Push notification déjà existante
(l'utilisateur est prévenu même appli fermée) plutôt que par une vraie Background Sync, pour ne
pas ajouter une complexité nouvelle non déjà éprouvée dans ce code — voir §4.4 pour le détail.

---

## 1. Vue d'ensemble — qui fait quoi

```
┌─────────────────────────────────────────────────────────────────────┐
│  BABILLARD (Announcement)         │  MESSAGERIE (Conversation/Message)│
│  Diffusion officielle, 1 → tous   │  Échange ciblé, 1 → 1 ou 1 → groupe│
│  Lecture seule pour la majorité   │  Bidirectionnel                   │
│  Expire automatiquement           │  Persiste (historique complet)    │
├─────────────────────────────────────────────────────────────────────┤
│              NOTIFICATIONS (Notification + Push + Socket.io)         │
│         Alerte de livraison uniquement — jamais un espace de texte   │
└─────────────────────────────────────────────────────────────────────┘
```

Règle produit reprise telle quelle (elle est juste) : **le babillard n'est jamais un chat.** Pas
de réponse en fil sous une annonce en V1 — un bouton "Discuter" qui ouvre une conversation liée
est une bonne idée mais explicitement **hors scope V1** (voir §6), pour ne pas faire dépendre le
babillard (le plus petit chantier des deux) de la messagerie (le plus gros) avant que celle-ci
soit stable.

---

## 2. PARTIE A — Babillard numérique

### 2.1 Schéma — état actuel et ajustements nécessaires

```prisma
// DÉJÀ DANS schema.prisma — à vérifier lors de l'implémentation, ajuster si besoin réel
model Announcement {
  id          String     @id @default(cuid())
  schoolId    String
  title       String
  content     String
  targetRoles UserRole[]
  isPinned    Boolean    @default(false)
  authorId    String
  createdAt   DateTime   @default(now())
  expiresAt   DateTime?
  author      User       @relation("AnnouncementAuthor", fields: [authorId], references: [id])
  school      School     @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@index([schoolId])
  @@index([schoolId, isPinned])
}
```

**Ajustements nécessaires** (migration à prévoir) :
- **Index d'expiration manquant** : `@@index([schoolId, expiresAt])` — indispensable pour la
  requête "annonces non expirées" qui tournera à chaque chargement du babillard par tout le monde.
- **Pas de champ pour distinguer les deux modes d'expiration décrits** ("un jour après la date
  concernée passée" vs "N jours fixés par l'admin") — **pas besoin d'un nouveau champ** : les deux
  se résolvent en une seule valeur `expiresAt` calculée côté client/serveur à la création :
  - Mode "date précise + décalage" : l'admin choisit une date cible (ex. date des résultats) →
    `expiresAt = dateCible + 1 jour` (calculé côté backend à la création, pas stocké séparément).
  - Mode "durée fixe" : l'admin choisit un nombre de jours → `expiresAt = now() + N jours`.
  - Mode "sans expiration automatique" : `expiresAt = null`, seule une suppression manuelle la
    retire (nécessaire pour un règlement intérieur permanent, par exemple).
  → Ajouter uniquement un champ **non persisté côté UI** (mode de saisie), le backend ne reçoit et
  stocke que le résultat final `expiresAt`.
- **Pas de compteur de lecture / accusé de lecture** — volontairement absent : le babillard est
  une diffusion, pas un espace où "qui a lu quoi" doit être traqué (à la différence des messages,
  voir `MessageReadStatus`). Décision cohérente avec la séparation des rôles, ne pas ajouter.

### 2.2 Backend

**Nouveau dossier** `backend/src/application/announcement/` (suit la convention hexagonale déjà
établie — voir `backend/src/application/suivi/` du chantier précédent comme référence directe) :

- `CreerAnnonceUseCase.ts` — validation : `title`/`content` non vides, `targetRoles` non vide,
  calcul de `expiresAt` selon le mode reçu (date cible+décalage / durée / aucune), auteur =
  appelant. Autorisation : `role === 'ADMIN' || role === 'STAFF'` — décision actée, aucune
  permission `StaffPermissionType` supplémentaire à créer.
- `ListerAnnoncesUseCase.ts` — filtre `targetRoles` contient le rôle de l'appelant **OU**
  `targetRoles` vide (= "tout le monde"), `expiresAt IS NULL OR expiresAt > now()`, tri : épinglées
  d'abord puis `createdAt DESC`.
- `SupprimerAnnonceUseCase.ts` — autorisé si `appelant.userId === authorId` **OU**
  `appelant.role === 'ADMIN'` (règle donnée explicitement par l'utilisateur : "sauf si l'admin ou
  la personne qui a posté la supprime").
- `PurgerAnnoncesExpireesUseCase.ts` — appelé par le job cron ci-dessous, supprime réellement les
  lignes dont `expiresAt < now() - 7 jours` (garde 7 jours après expiration pour un éventuel
  export/audit, ne supprime pas instantanément à l'expiration — l'expiration cache déjà l'annonce
  de l'affichage via le filtre de `ListerAnnoncesUseCase`, la purge n'est qu'un nettoyage différé
  de la table).

**`AnnouncementController.ts`** (`backend/src/infrastructure/http/controllers/`) : `creer`,
`lister`, `supprimer`, suit le patron exact de `StudentFollowUpController.ts` (constructeur avec
les use cases injectés, gestion d'erreur `error.message → 400`).

**Routes** `backend/src/infrastructure/http/routes/announcement.routes.ts` :
```
POST   /api/v2/announcements            requireAuth, requireRole('ADMIN','STAFF')
GET    /api/v2/announcements            requireAuth  (tous rôles — lecture)
DELETE /api/v2/announcements/:id        requireAuth, requireRole('ADMIN','STAFF')
```

**Notification à la publication** — réutilise l'infrastructure existante, **aucun nouveau canal** :
```ts
// Dans AnnouncementController.creer, après la création réussie
for (const userId of destinatairesConcernes) {  // résolus via targetRoles, requête User.findMany
  await notificationService.envoyer({
    schoolId, userId, type: 'ANNOUNCEMENT_PUBLISHED',
    titre: annonce.title, corps: annonce.content.slice(0, 120),
    canal: 'IN_APP',  // + push automatique, même patron que StudentFollowUpController.notifier()
  });
}
```
Pour une grande école (des centaines de destinataires), envoyer en parallèle par lots
(`Promise.allSettled`, lots de ~50) plutôt qu'une boucle séquentielle — seul point de vigilance
performance réel ici, le reste est un simple CRUD.

**Job de purge** (`backend/src/inngest/functions.ts`, même patron que `purgeSchoolLogs`) :
```ts
export const purgeAnnoncesExpirees = inngest.createFunction(
  { id: "purge-annonces-expirees", name: "Purge quotidienne babillard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => { /* PurgerAnnoncesExpireesUseCase pour chaque école ACTIVE */ }
);
```

### 2.3 Frontend

**Nouveau composant partagé** `frontend/src/components/Babillard.tsx` (même logique de partage
que `StudentFollowUpButtons.tsx` — un seul composant, monté dans les dashboards STAFF/TEACHER
avec droit de publier, et en lecture seule dans STUDENT/PARENT) :
- Liste des annonces (`useCachedFetch` pour la lecture hors-ligne — même patron que `SectionTeacherAtRisk.tsx`), épinglées en tête, badge visuel si épinglée.
- Formulaire de création (Admin/Staff uniquement) : titre, contenu, sélecteur de rôles cibles
  (multi-select), sélecteur de mode d'expiration (date cible + décalage / durée en jours / aucune).
- Bouton supprimer visible uniquement si `estAuteur || estAdmin`.

**Nouvelle section** `'babillard'` dans chacun des 5 dashboards (Admin/Staff/Teacher/Student/
Parent) — ajout dans `_types.ts` (section + éventuellement `PERM_TO_SECTION` côté Staff, mais
puisque TOUT staff peut publier, pas de filtre de permission nécessaire là non plus) + icône
sidebar (`Megaphone` ou `Pin` de `lucide-react`) + entrée dans `page.tsx` de chaque dashboard.

**Écriture hors-ligne** : la CRÉATION d'une annonce n'a **pas** besoin d'passer par la file
`useSyncQueue` — contrairement à une note ou une présence, publier un communiqué est une action
volontairement synchrone et rare (pas de scénario réaliste "je publie un communiqué depuis un
village sans réseau dans l'urgence"). La LECTURE, elle, passe par `useCachedFetch` comme toutes
les autres listes de consultation.

**Locales** : nouvelles clés `fr`/`en` dans chacun des 5 namespaces concernés (`admin.json`,
`staff.json`, `teacher.json`, `student.json`, `parent.json`) + `navigation.json` (libellé sidebar).

### 2.4 Ordre d'implémentation suggéré (Partie A)

1. Migration Prisma (index manquant sur `Announcement`).
2. `CreerAnnonceUseCase`/`ListerAnnoncesUseCase`/`SupprimerAnnonceUseCase` + tests unitaires
   (fakes en mémoire, même patron que `ClorreActionSuiviUseCase.test.ts` du chantier précédent).
3. `AnnouncementController` + routes + wiring `hexagonal.bootstrap.ts`.
4. Notification à la publication (réutilisation directe de l'infra existante).
5. Job de purge Inngest.
6. Frontend : composant partagé, une section à la fois en commençant par Admin+Staff (publication),
   puis Teacher/Student/Parent (lecture seule).
7. `tsc --noEmit` + `bun test` + vérification visuelle réelle (créer une annonce, vérifier
   qu'elle expire bien, vérifier que la suppression respecte la règle auteur/admin).

---

## 3. PARTIE B — Messagerie bidirectionnelle (4 couches, V1 complète)

### 3.1 Schéma — état actuel et ajustements nécessaires

```prisma
// DÉJÀ DANS schema.prisma
enum ConversationType { PRIVATE, CLASS_CHANNEL, PARENT_CHANNEL, SYSTEM }
enum ModerationStatus { PENDING, APPROVED, REJECTED }

model Conversation {
  id                String           @id @default(cuid())
  schoolId          String
  type              ConversationType @default(PRIVATE)
  name              String?
  classId           String?
  level             String?          // Niveau scolaire pour les PARENT_CHANNEL (ex: '6e', '5e', 'Form 1')
  announcementsOnly Boolean          @default(true) // Mode annonces par défaut (contrôlé par les enseignants/admins)
  createdAt         DateTime         @default(now())
  school            School           @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  messages          Message[]
  @@index([schoolId])
  @@index([schoolId, level])
  @@index([schoolId, classId])
}

// ⚠️ RÈGLES DE SÉCURITÉ SCOLAIRE :
// 1. Les élèves (STUDENT) ne peuvent JAMAIS créer ni recevoir de messages privés (DM).
// 2. Les canaux de classe sont en mode announcementsOnly: true par défaut. Seuls les enseignants et la direction peuvent y écrire.
// 3. Les canaux PARENTS sont regroupés par NIVEAU scolaire (Parents — 6e, Parents — 5e, etc.) et non par classe individuelle.
// 4. Membres obligatoires de tous les groupes : Administrateur, Censeur / Vice-Principal, Conseiller d'Orientation.
// 5. Clic MP depuis le volet des membres d'un groupe : redirection ou création directe vers la conversation privée 1-à-1 (idempotente).

model Message {
  id               String              @id @default(cuid())
  conversationId   String
  senderId         String
  content          String
  fileUrl          String?
  moderationStatus ModerationStatus    @default(APPROVED)
  moderatedById    String?
  moderationReason String?
  createdAt        DateTime            @default(now())
  conversation     Conversation        @relation(fields: [conversationId], references: [id])
  moderatedBy      User?               @relation("ModeratedMessages", fields: [moderatedById], references: [id])
  sender           User                @relation("SentMessages", fields: [senderId], references: [id])
  readStatuses     MessageReadStatus[]
}

model MessageReadStatus {
  messageId String
  userId    String
  readAt    DateTime @default(now())
  message   Message  @relation(fields: [messageId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  @@id([messageId, userId])
}
```

**Ajustements nécessaires** (migration à prévoir) :
- **`Conversation` n'a pas de liste explicite de participants** — pour `PRIVATE`, on a besoin de
  savoir QUI participe (pas juste "qui a déjà envoyé un message", puisqu'une conversation privée
  vide doit pouvoir exister dès sa création, avant le premier message). Ajouter :
  ```prisma
  model ConversationParticipant {
    conversationId String
    userId         String
    joinedAt       DateTime     @default(now())
    conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
    user           User         @relation(fields: [userId], references: [id])
    @@id([conversationId, userId])
    @@index([userId])
  }
  ```
  Pour `CLASS_CHANNEL`/`PARENT_CHANNEL`, les participants se déduisent dynamiquement de `classId`
  (élèves+parents de la classe, ou enseignants de la classe) — pas besoin d'y insérer une ligne
  par participant, seulement pour `PRIVATE`. `SYSTEM` n'a pas de participants au sens conversation
  (c'est la couche "Notifications Système" — voir §3.6, elle **ne crée pas** de vraie `Conversation`,
  elle utilise directement le modèle `Notification` déjà existant).
- **Index manquant** : `@@index([conversationId, createdAt])` sur `Message` — requête de lecture
  paginée la plus fréquente de tout le module.
- **`id` généré côté client** : contrairement à la convention Prisma par défaut (`@default(cuid())`
  généré serveur), le pattern offline-first décrit dans les conseils reçus — et confirmé
  applicable ici — exige que **le frontend** génère l'UUID du message au moment du clic, pour
  qu'un message écrit hors-ligne ait déjà son identité définitive avant même d'être synchronisé
  (évite les doublons/conflits de fusion). Solution : garder `@default(cuid())` comme filet de
  sécurité, mais le frontend **envoie explicitement son propre `id`** (UUID v4) dans le payload de
  création — Prisma accepte un `id` fourni explicitement, il ignore juste le `@default` dans ce cas.

### 3.2 Backend — un use case par couche, pas un fourre-tout

`backend/src/application/messagerie/` :

- `EnvoyerMessageUseCase.ts` — commande commune aux 4 couches : `{ appelant, conversationId?,
  type?, destinataireId?, classId?, content, clientMessageId }`. Logique :
  1. Si `conversationId` fourni → vérifie que l'appelant est bien participant (ou déduit pour
     CLASS_CHANNEL/PARENT_CHANNEL via `classId` de la conversation).
  2. Si pas de `conversationId` mais `destinataireId` (PRIVATE) → trouve ou crée la conversation
     1-à-1 (recherche par les deux `ConversationParticipant`, sinon création atomique).
  3. Vérifie `clientMessageId` non déjà utilisé pour cette conversation (défense en profondeur en
     plus de l'idempotence HTTP générique déjà en place — un message dupliqué par un bug frontend
     ne doit pas passer même sans rejouer la file offline).
  4. Persiste, émet Socket.io sur la room `conversation:{conversationId}` (nouvelle convention de
     room, voir §3.3), notifie (push) les participants absents de la room au moment de l'envoi.
- `ListerConversationsUseCase.ts` — conversations de l'appelant (participant direct pour PRIVATE,
  déduites pour CLASS_CHANNEL/PARENT_CHANNEL via ses classes), triées par dernier message.
- `ListerMessagesUseCase.ts` — pagination **et** rattrapage : accepte soit `{ conversationId,
  page }` (chargement initial) soit `{ conversationId, since: DateTime }` (rattrapage après
  reconnexion, exactement le `?since=timestamp` déjà décrit dans les conseils reçus — pattern
  cohérent avec `useSyncQueue`, à réutiliser tel quel côté frontend).
- `MarquerMessagesLusUseCase.ts` — upsert `MessageReadStatus` pour tous les messages non lus d'une
  conversation jusqu'à un `messageId` donné (pattern "tout lu jusqu'ici", pas message par message).
- `CreerCanalClasseUseCase.ts` / `CreerCanalParentsUseCase.ts` — création du `CLASS_CHANNEL`/
  `PARENT_CHANNEL` d'une classe, appelée automatiquement (pas manuellement) au moment de la
  création d'une `Class` (hook dans le use case de création de classe déjà existant, pas un
  nouveau bouton) — un canal de classe doit exister dès qu'une classe existe, jamais à créer à la
  main.
- `ModererMessageUseCase.ts` — si modération activée pour l'école (`SchoolConfig` — nouveau champ
  booléen `messageModerationEnabled`, défaut `false`) : `approuver`/`rejeter`, notifie l'expéditeur
  si rejeté (avec motif). **Exemptés de modération par construction** (jamais mis en `PENDING`) :
  `PRIVATE` et `SYSTEM` — seuls `CLASS_CHANNEL`/`PARENT_CHANNEL` peuvent être modérés, cohérent
  avec le document d'origine ("Exemptés de modération : Messages Privés + Notifications Système").

### 3.3 Temps réel — étendre Socket.io, pas le remplacer

`backend/src/socket/io.ts` a déjà deux rooms (`user:{userId}`, `school:{schoolId}:role:{role}`).
Ajouter une troisième convention, jointe à la demande (pas automatiquement à la connexion, pour
ne pas payer le coût de room pour des conversations jamais ouvertes) :
```ts
socket.on('conversation:join', (conversationId: string) => {
  // vérifier l'appartenance AVANT de join (sinon fuite : n'importe qui pourrait join n'importe
  // quelle conversation en devinant un ID) — requête légère de vérification participant
  socket.join(`conversation:${conversationId}`);
});
```
Émission après un envoi réussi : `io.to(\`conversation:${conversationId}\`).emit('message:new', message)`.

### 3.4 Offline-first — extension du système existant, pas un nouveau

**`frontend/src/lib/offline/db.ts`** — ajouter un type à l'union déjà existante :
```ts
type: '...' | 'MESSAGE_SEND'   // s'ajoute simplement aux 12 types déjà listés
```
**Nouvelle table Dexie dédiée** (les messages ont besoin d'un affichage optimiste immédiat dans le
fil de conversation, pas juste d'être en attente dans une file générique invisible) :
```ts
export interface CachedMessage {
  id: string              // = clientMessageId, l'UUID généré au clic — voir §3.1
  conversationId: string
  senderId: string
  content: string
  createdAt: number
  status: 'PENDING' | 'SENT' | 'FAILED'   // affiché comme icône (horloge / coche / alerte)
}
// + table 'messages' dans ZekoulABiaDB, version 2 (Dexie gère la migration de schema locale)
```
**Composant d'envoi** : écrit dans `db.messages` (affichage instantané, statut `PENDING`) **et**
appelle `addToQueue({ type: 'MESSAGE_SEND', endpoint: '/api/v2/messagerie/messages', method: 'POST',
payload: {...} })` — exactement le même flux que les 12 types déjà en place, zéro nouveau
mécanisme. Le hook `useSyncQueue` existant se charge du reste (retry, idempotence). Après succès
de la synchro, mettre à jour `status: 'SENT'` sur l'entrée `db.messages` correspondante (petit
ajout à `syncQueue()` : un callback optionnel par type, ou une vérification post-sync ciblée sur
les entrées `MESSAGE_SEND`).

**Lecture hors-ligne** : `useCachedFetch` pour la liste des conversations et l'historique de
chaque conversation déjà ouverte — comportement déjà standard, rien de spécifique à inventer.

### 3.5 Ce qui reste strictement en ligne (catégorie C, même logique que le reste de l'app)

- Ouverture d'une **nouvelle** conversation `PRIVATE` (le serveur doit résoudre/créer l'ID, pas
  de sens à le faire en optimiste hors-ligne pour une première conversation).
- Modération (action rare, jamais urgente hors-ligne).
- Marquage "lu" (peu coûteux à perdre, pas la peine de le mettre en file offline — au pire, se
  remet à jour au prochain chargement en ligne).

### 3.6 Couche "Notifications Système" — ne crée PAS de vraies conversations

Contrairement aux 3 autres couches, "Notifications Système" (absence, paiement, alerte IA) **ne
passe pas** par `Conversation`/`Message` — c'est déjà entièrement couvert par le modèle
`Notification` + Push + cloche IN_APP déjà construits cette session pour d'autres chantiers
(suivi élève, alertes santé scolaire, etc.). Le type `ConversationType.SYSTEM` de l'enum reste
présent dans le schema pour rester fidèle à la conception d'origine, mais **rien à construire
dessus en V1** — les 3 couches réelles à câbler sont PRIVATE, CLASS_CHANNEL, PARENT_CHANNEL.

### 3.7 Frontend

**Nouveau composant** `frontend/src/components/Messagerie/` (dossier, pas un fichier unique — le
volume UI le justifie, à la différence du babillard) :
- `ListeConversations.tsx` — liste avec dernier message, badge non-lus, filtrable par type.
- `FilConversation.tsx` — historique + zone de saisie + statut d'envoi par message (horloge/coche).
- `NouveauMessagePrive.tsx` — sélecteur de destinataire (contraint par rôle : un parent ne peut
  écrire qu'aux enseignants/staff de ses propres enfants, jamais à un autre parent — résolveur
  dédié côté backend, même principe déjà appliqué au copilot Parent selon le document d'origine).

**Nouvelle section** `'messagerie'` dans les 5 dashboards, icône `MessageCircle`.

**Badge non-lus dans la sidebar** — réutilise le compteur déjà affiché pour les notifications
(`NotificationBell.tsx`), ajouter un compteur séparé pour les messages non lus (requête dédiée,
pas mélangée au compteur de notifications qui reste conceptuellement distinct).

### 3.8 Ordre d'implémentation suggéré (Partie B)

1. Migration Prisma (`ConversationParticipant`, index manquants, `id` explicite acceptée côté
   création, `SchoolConfig.messageModerationEnabled`).
2. `EnvoyerMessageUseCase` + `ListerConversationsUseCase` + `ListerMessagesUseCase` — cœur du
   système, avec tests unitaires couvrant la résolution PRIVATE (trouver-ou-créer) et le
   rattrapage `since=`.
3. `MarquerMessagesLusUseCase`, `CreerCanalClasseUseCase`/`CreerCanalParentsUseCase` (+ hook dans
   la création de classe existante).
4. `MessagerieController` + routes + wiring bootstrap.
5. Socket.io : room `conversation:{id}`, vérification d'appartenance avant `join`.
6. Notification push à la réception d'un message (réutilisation `notifierParentsPushDabord`-style
   pour les parents, patron `notifier()` de `StudentFollowUpController` pour le personnel).
7. Frontend : Dexie (table `messages`, type `MESSAGE_SEND`), `ListeConversations`,
   `FilConversation`, `NouveauMessagePrive`.
8. Modération (si `messageModerationEnabled` — sinon toujours `APPROVED` par défaut, la fonctionnalité
   entière peut être testée sans jamais l'activer).
9. `ModererMessageUseCase` + petit écran de file d'attente de modération côté Staff (uniquement si
   activée pour l'école).
10. `tsc --noEmit` + tests + vérification réelle en conditions de coupure réseau simulée (mode
    avion) pour valider le flux optimiste → file → sync → confirmation.

---

## 4. Points transverses à trancher pendant l'implémentation (pas avant)

### 4.1 Lien babillard → messagerie ("Discuter")
Bonne idée retenue dans les conseils reçus, explicitement **V1.1** — un bouton sur une annonce
qui crée/ouvre une conversation `PRIVATE` avec l'auteur. Ne bloque rien de la V1, s'ajoute
proprement une fois les deux briques stables séparément.

### 4.2 Compteur "vu par" sur les canaux
`MessageReadStatus` permet techniquement d'afficher "lu par 24/30 élèves" sur un `CLASS_CHANNEL`
— utile pour un enseignant qui veut confirmer qu'une consigne a été vue. Faisable avec le schema
déjà prévu, pas un ajout de V1 mais une extension naturelle une fois la base posée.

### 4.3 Pièces jointes (V1.1, décision déjà actée)
Le champ `fileUrl` existe déjà sur `Message` (String, nullable) — rien à faire au niveau schema
quand ce sera repris, juste brancher l'upload (même service de stockage que les justificatifs
APEE/documents RH) et respecter la règle déjà énoncée dans les conseils reçus : encourager le
texte par défaut, avertir que les médias demandent une connexion plus stable.

### 4.4 Background Sync API — décision proposée, pas tranchée
Le système actuel (`useSyncQueue`) synchronise à la reconnexion **pendant que l'onglet est
ouvert**. Le scénario "je marche jusqu'au coin du village avec l'app fermée en arrière-plan, ça
se synchronise tout seul" décrit dans les conseils reçus nécessiterait la vraie Background Sync
API du navigateur (`registration.sync.register` dans le Service Worker) — **jamais utilisée
ailleurs dans ce code à ce jour**. Proposition : **ne pas l'ajouter en V1** — la Push notification
déjà fonctionnelle couvre déjà "être informé même appli fermée" (le destinataire reçoit un push
dès l'envoi, indépendamment de l'état de connexion de l'expéditeur au moment exact de l'envoi côté
serveur) ; ce qui manque réellement sans Background Sync, c'est que l'**expéditeur** hors-ligne ne
voit son propre message confirmé "envoyé" qu'en rouvrant l'app — un compromis raisonnable pour une
V1, pas un blocage. À réévaluer seulement si l'usage réel montre que ce délai pose problème.

---

## 5. Ce qui reste explicitement hors scope de ce chantier

- Pièces jointes (§4.3 — V1.1 actée).
- Bouton "Discuter" depuis le babillard (§4.1 — V1.1 actée).
- Background Sync API (§4.4 — proposé non nécessaire pour l'instant).
- Recherche dans les conversations (mentionnée dans le document d'origine, jamais évoquée par
  l'utilisateur pour ce tour — à reprendre si demandé explicitement).
- Accès DDES/DRES aux canaux — hors périmètre, rôle non construit à ce jour (voir
  `EduNexus_Carte_Complete_V2.md`).

---

## 6. Fichiers concrets à créer/modifier — check-list de référence

**Backend :**
- `backend/prisma/schema.prisma` (migration : index `Announcement`, `ConversationParticipant`,
  index `Message`, `SchoolConfig.messageModerationEnabled`)
- `backend/src/application/announcement/{Creer,Lister,Supprimer,Purger}AnnonceUseCase.ts`
- `backend/src/application/messagerie/{Envoyer,ListerConversations,ListerMessages,
  MarquerMessagesLus,CreerCanalClasse,CreerCanalParents,ModererMessage}UseCase.ts`
- `backend/src/infrastructure/http/controllers/{AnnouncementController,MessagerieController}.ts`
- `backend/src/infrastructure/http/routes/{announcement,messagerie}.routes.ts`
- `backend/src/infrastructure/config/hexagonal.bootstrap.ts` (wiring des deux)
- `backend/src/socket/io.ts` (room `conversation:{id}` sur événement `conversation:join`)
- `backend/src/inngest/functions.ts` (`purgeAnnoncesExpirees`)

**Frontend :**
- `frontend/src/lib/offline/db.ts` (type `MESSAGE_SEND`, table `messages` v2)
- `frontend/src/components/Babillard.tsx`
- `frontend/src/components/Messagerie/{ListeConversations,FilConversation,NouveauMessagePrive}.tsx`
- Sections `'babillard'`/`'messagerie'` dans les 5 `_types.ts` + `page.tsx` + sidebar de chaque
  dashboard (Admin/Staff/Teacher/Student/Parent)
- Clés `fr`/`en` dans les 5 namespaces + `navigation.json`

**Rien à ajouter au `package.json`** — aucune nouvelle dépendance, ni backend ni frontend.
