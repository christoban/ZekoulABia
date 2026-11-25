# Corrections et compléments à apporter — Babillard numérique

Ce document liste, de façon exhaustive et actionnable, tout ce qu'il reste à faire pour que
le chantier « babillard » (annonces Admin/Staff visibles par rôle ciblé) soit complet et
utilisable en conditions réelles. Le CRUD backend, les notifications à la publication et
l'affichage Admin/Teacher sont déjà terminés et vérifiés — ce fichier ne couvre QUE ce qui
manque encore.

Chaque section indique : le problème, pourquoi il compte, le(s) fichier(s) à modifier, et le
code exact à écrire. Suivre l'ordre des sections — la section A est bloquante pour tester
quoi que ce soit d'autre.

---

## A. [BLOQUANT] Générer la migration Prisma

**Problème.** `backend/prisma/schema.prisma` a été modifié (nouveaux index sur `Announcement`
et `Message`, nouveau modèle `ConversationParticipant`) mais aucune migration n'a été générée.
`backend/prisma/migrations/` s'arrête à `20260803074059_ajoute_idempotency_record`. La base de
données locale n'a donc PAS les nouvelles colonnes/index attendus par le code déjà écrit.

**Pourquoi ça compte.** Sans ça, rien de ce qui suit n'est testable : `prisma validate` passe
(le schéma est syntaxiquement correct) mais `prisma migrate dev` n'a jamais tourné, donc la
base réelle est désynchronisée du schéma.

**Commande à exécuter** (depuis `backend/`) :

```bash
cd backend
npx prisma migrate dev --name ajoute_index_babillard_et_conversation_participant
```

Vérifier ensuite que le dossier `backend/prisma/migrations/` contient un nouveau dossier
horodaté avec un fichier `migration.sql` qui contient bien :
- `CREATE INDEX` sur `Announcement(schoolId, expiresAt)`
- `CREATE INDEX` sur `Message(conversationId, createdAt)`
- `CREATE TABLE "ConversationParticipant"`

**Vérification** : relancer `npx prisma validate` puis `npx prisma generate` (pour que le
client Prisma TypeScript connaisse les nouveaux champs — sinon les `as any` déjà présents dans
`ListerAnnoncesUseCase.ts` etc. masquent silencieusement toute erreur de type sur ces modèles).

---

## B. [BUG VISIBLE] Clé i18n manquante `group.communication`

**Problème.** `TeacherSidebar.tsx` a été modifié pour ajouter un nouveau groupe de navigation :

```tsx
{
  label: tnav('group.communication'),
  items: [{ id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') }],
},
```

Mais la clé `group.communication` n'existe dans AUCUN des deux fichiers
`frontend/src/locales/{fr,en}/navigation.json` (vérifié par recherche directe — absente des
deux). Le mécanisme de traduction (`frontend/src/lib/i18n/index.tsx`, fonction `resolveKey`)
retourne la clé brute telle quelle quand elle n'est pas trouvée dans le dictionnaire. **Résultat
concret : le libellé du groupe dans la sidebar Enseignant affichera littéralement le texte
`group.communication` au lieu d'un label traduit**, aussi bien en français qu'en anglais.

**Fichiers à corriger** :

`frontend/src/locales/fr/navigation.json` — dans le bloc `"group": { ... }` (ligne ~61),
ajouter :
```json
"communication": "Communication",
```

`frontend/src/locales/en/navigation.json` — dans le bloc `"group": { ... }` équivalent,
ajouter :
```json
"communication": "Communication",
```

Respecter la virgule de fin sur la ligne précédente existante. Vérifier après coup que le JSON
reste valide (`node -e "require('./frontend/src/locales/fr/navigation.json')"` et l'équivalent
`en`).

---

## C. [MANQUE FONCTIONNEL] Câbler le dashboard Staff

**Problème.** Le plan (`PLAN_BABILLARD_ET_MESSAGERIE.md`) prévoit explicitement que
« Admin + tout le personnel STAFF » puisse publier sur le babillard
(`CreerAnnonceUseCase.ts` vérifie déjà `['ADMIN', 'STAFF'].includes(role)` — le backend est
prêt). Mais le dashboard Staff (Censeur, Surveillant général, Econome, etc.) n'a reçu AUCUN
câblage : ni type de section, ni entrée de sidebar, ni rendu de page. Un membre du personnel
Staff n'a donc littéralement aucun endroit où publier ou lire une annonce.

**Particularité du dashboard Staff** : contrairement à Admin/Teacher, la visibilité des
sections Staff est normalement filtrée par permission métier fine (`VALIDATE_GRADES`,
`MANAGE_FINANCE`, etc. — voir `getSectionsFromPermissions` dans `_types.ts`). Le babillard ne
doit PAS suivre cette logique de permission fine : TOUT membre du Staff doit pouvoir y accéder,
exactement comme `mon-profil-rh` et `notifications` qui sont déjà inconditionnels. Donc
`'babillard'` doit rejoindre le Set de base, pas la table `PERM_TO_SECTION`.

### C.1 — `frontend/src/app/staff/dashboard/_types.ts`

Ajouter `'babillard'` à l'union `StaffSection` :
```ts
export type StaffSection =
  | 'dashboard' | 'council' | 'grades' | 'timetable'
  | 'grille-horaire' | 'affectations'
  | 'attendance' | 'finance' | 'cautions' | 'discipline'
  | 'library' | 'orientation' | 'departements' | 'suivi-eleves'
  | 'sync-offline'
  | 'mon-profil-rh' | 'apee' | 'notifications' | 'babillard'
```

Modifier `getSectionsFromPermissions` pour inclure `'babillard'` dans le Set de base (comme
`mon-profil-rh` et `notifications`, PAS dans `PERM_TO_SECTION`) :
```ts
export function getSectionsFromPermissions(permissions: string[]): Set<StaffSection> {
  const set = new Set<StaffSection>(['dashboard', 'mon-profil-rh', 'notifications', 'babillard'])
  for (const { perm, section } of PERM_TO_SECTION) {
    if (permissions.includes(perm)) set.add(section)
  }
  return set
}
```

### C.2 — `frontend/src/app/staff/dashboard/_components/StaffSidebar.tsx`

Importer l'icône `Megaphone` (ajouter à la liste d'imports `lucide-react` en haut du fichier,
à côté de `ShieldAlert`, `IdCard`, etc.).

Ajouter une entrée de navigation. Le plus simple est de l'ajouter dans le groupe
`group.moncompte` existant (à côté de `sync-offline` / `mon-profil-rh`), puisque le babillard
est inconditionnel comme ces deux-là :
```tsx
{ label: tnav('group.moncompte'), items: [
  { id: 'sync-offline', icon: RefreshCw, label: tnav('sidebar.syncOffline') },
  { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
  { id: 'mon-profil-rh', icon: IdCard, label: tnav('sidebar.monProfilRH') },
  ...
]},
```
(reprendre exactement la structure déjà présente autour de la ligne 74-76, juste insérer la
ligne `babillard`).

### C.3 — `frontend/src/app/staff/dashboard/page.tsx`

Importer le composant :
```tsx
import Babillard from '@/components/Babillard'
```

Initialiser `'babillard'` dans le Set par défaut de `allowedSections` (ligne ~50) :
```ts
const [allowedSections, setAllowedSections] = useState<Set<StaffSection>>(new Set(['dashboard', 'mon-profil-rh', 'notifications', 'babillard']))
```

Ajouter le rendu conditionnel, à côté de `mon-profil-rh`/`notifications` (ligne ~190) :
```tsx
{section === 'babillard' && <Babillard role={sessionUser?.role ?? 'STAFF'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} />}
```

`sessionUser.role` vaut `'STAFF'` pour tout utilisateur de ce dashboard, donc
`canPublish` dans `Babillard.tsx` (`role === 'ADMIN' || role === 'STAFF'`) sera `true` —
formulaire de publication visible, cohérent avec le plan.

---

## D. [MANQUE FONCTIONNEL] Câbler le dashboard Parent (lecture seule)

**Problème.** Aucun câblage. Un Parent ne peut pas voir les annonces qui lui sont destinées,
même si le backend les lui sert déjà (`GET /api/v2/announcements` n'a pas de restriction de
rôle, `ListerAnnoncesUseCase` filtre déjà correctement par `targetRoles`). Contrairement au
Staff, ici c'est purement de la lecture : `Babillard.tsx` masque déjà le formulaire de
publication tout seul dès que `role !== 'ADMIN' && role !== 'STAFF'` (`canPublish`), donc rien
à faire côté logique d'autorisation ici — juste brancher l'affichage.

### D.1 — `frontend/src/app/parent/dashboard/_types.ts`

```ts
export type ParentSection = 'children' | 'grades' | 'attendance' | 'payments' | 'timetable' | 'settings' | 'library' | 'apee' | 'notifications' | 'babillard'
```

### D.2 — `frontend/src/app/parent/dashboard/_components/ParentSidebar.tsx`

Ajouter `Megaphone` à l'import `lucide-react` (ligne 3).

Ajouter une entrée dans le groupe `services` (à côté de `library`), avant le commentaire sur
`notifications` retiré :
```tsx
{
  label: tnav('group.services'),
  items: [
    { id: 'payments', icon: Smartphone, label: tnav('sidebar.payments') },
    { id: 'apee',     icon: HandCoins, label: tnav('sidebar.apee') },
    { id: 'library',  icon: BookOpen, label: tnav('sidebar.readings') },
    { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
    // notifications retiré — redondant avec la cloche (permanente sur tous les écrans),
    // qui offre désormais un lien « Voir tout » vers cette même page.
    { id: 'settings', icon: Settings, label: tnav('sidebar.settings') },
  ]
},
```

### D.3 — `frontend/src/app/parent/dashboard/page.tsx`

Importer :
```tsx
import Babillard from '@/components/Babillard'
```

Ajouter `'babillard'` au tableau `PARENT_SECTIONS` (ligne 36) :
```ts
const PARENT_SECTIONS: ParentSection[] = ['children', 'grades', 'attendance', 'payments', 'timetable', 'settings', 'library', 'apee', 'notifications', 'babillard']
```

Ajouter le titre dans `TITLES` (ligne ~50-60) :
```ts
babillard: tnav('sidebar.babillard'),
```
(il n'existe pas de clé `pageTitle.parent_babillard` dédiée — réutiliser `sidebar.babillard`
est suffisant et cohérent avec le pattern déjà utilisé pour `settings`/`library` dans ce même
fichier si applicable ; à défaut créer `pageTitle.parent_babillard` dans `navigation.json` si
la convention du fichier l'exige partout — vérifier les autres entrées de `TITLES` avant de
choisir).

Ajouter le rendu conditionnel à côté de `library` (ligne ~156) :
```tsx
{section === 'babillard' && <Babillard role={user?.role ?? 'PARENT'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} />}
```

---

## E. [MANQUE FONCTIONNEL] Câbler le dashboard Élève (lecture seule)

**Problème identique à D**, pour le rôle STUDENT.

### E.1 — `frontend/src/app/student/dashboard/_types.ts`

```ts
export type StudentSection = 'dashboard' | 'grades' | 'bulletins' | 'timetable' | 'attendance' | 'library' | 'health-tracking' | 'notifications' | 'babillard'
```

### E.2 — `frontend/src/app/student/dashboard/_components/StudentSidebar.tsx`

Ajouter `Megaphone` à l'import `lucide-react` (ligne 3).

Ajouter une entrée dans le groupe `services` (à côté de `library`) :
```tsx
{
  label: tnav('group.services'),
  items: [
    { id: 'library', icon: BookOpen, label: tnav('sidebar.myLibrary') },
    { id: 'babillard', icon: Megaphone, label: tnav('sidebar.babillard') },
  ]
},
```

### E.3 — `frontend/src/app/student/dashboard/page.tsx`

Importer :
```tsx
import Babillard from '@/components/Babillard'
```

Ajouter `'babillard'` au tableau `STUDENT_SECTIONS` (ligne 35) :
```ts
const STUDENT_SECTIONS: StudentSection[] = ['dashboard', 'grades', 'bulletins', 'timetable', 'attendance', 'library', 'health-tracking', 'notifications', 'babillard']
```

Ajouter le titre dans `TITLES` (ligne ~47-56) :
```ts
babillard: tnav('sidebar.babillard'),
```

Ajouter le rendu conditionnel à côté de `library` (ligne ~172) :
```tsx
{section === 'babillard' && <Babillard role={user?.role ?? 'STUDENT'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} />}
```

---

## F. [MANQUE FONCTIONNEL] Purge automatique des annonces expirées

**Problème.** Le plan prévoit un `PurgerAnnoncesExpireesUseCase` déclenché par un job Inngest
quotidien (modelé sur `purgeSchoolLogs` déjà existant dans `backend/src/inngest/functions.ts`).
Rien de tout ça n'existe. Ce n'est pas bloquant pour l'usage (les annonces expirées sont déjà
invisibles côté lecture grâce au filtre de `ListerAnnoncesUseCase`), mais sans purge la table
`Announcement` grossit indéfiniment.

**Règle exacte du plan** : garder les lignes 7 jours après expiration (pas de suppression
immédiate à l'expiration — marge pour audit/export), donc `expiresAt < now() - 7 jours`.

### F.1 — Nouveau fichier `backend/src/application/announcement/PurgerAnnoncesExpireesUseCase.ts`

```ts
import type { PrismaClient } from '@prisma/client';

const DELAI_GRACE_JOURS = 7;

export class PurgerAnnoncesExpireesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<{ count: number }> {
    const seuil = new Date(Date.now() - DELAI_GRACE_JOURS * 24 * 60 * 60 * 1000);

    return (this.prisma as any).announcement.deleteMany({
      where: { expiresAt: { lt: seuil } },
    });
  }
}
```

Remarque : contrairement à `purgeSchoolLogs` (qui boucle sur chaque école car
`purgeSchoolLogsByRetention` applique une politique de rétention *par école*), la purge du
babillard n'a pas de politique par école — `expiresAt` est une date absolue déjà calculée à la
création/modification de l'annonce. Un seul `deleteMany` global suffit, pas besoin de boucler
sur `prisma.school.findMany(...)`.

### F.2 — Dans `backend/src/inngest/functions.ts`

Ajouter l'import en haut du fichier (à côté des autres imports d'use cases s'il y en a, sinon
directement) :
```ts
import { PurgerAnnoncesExpireesUseCase } from "../application/announcement/PurgerAnnoncesExpireesUseCase.ts";
```

Ajouter la fonction Inngest, à la suite de `purgeSchoolLogs` (juste après la fermeture de ce
bloc, ligne ~1433) :
```ts
export const purgeAnnoncesExpirees = inngest.createFunction(
  { id: "purge-annonces-expirees", name: "Purge quotidienne babillard", triggers: [{ cron: "0 1 * * *" }] },
  async ({ step }) => {
    return await step.run("purge-annonces-expirees", async () => {
      const useCase = new PurgerAnnoncesExpireesUseCase(prisma);
      return await useCase.execute();
    });
  }
);
```

### F.3 — Enregistrer le job dans `backend/src/server.ts`

Ajouter à la liste d'imports depuis `./inngest/functions.ts` (ligne ~19-38) :
```ts
purgeAnnoncesExpirees,
```
(l'ajouter par exemple juste après `purgerCorbeille` dans la liste d'imports, ligne 36).

Ajouter dans le tableau `functions: [...]` passé à `serve(...)` (ligne ~174), juste après
`purgerCorbeille,` :
```ts
purgeAnnoncesExpirees,
```

**Sans cet enregistrement dans `server.ts`, le job Inngest est défini mais jamais exécuté** —
c'est une étape facile à oublier, bien vérifier qu'elle est faite.

---

## G. [NON BLOQUANT] Nettoyage namespace i18n

**Problème.** Toutes les clés de traduction du babillard (`publish_title`, `title_placeholder`,
`pin`, `no_expiration`, `create_success`, etc.) ont été ajoutées dans le bloc `communications`
de `frontend/src/locales/{fr,en}/admin.json` — le même bloc que celui utilisé par
`SectionCommunications.tsx`, l'écran de diffusion SMS/Email (`CommunicationsController`,
fonctionnalité explicitement différente du babillard, voir `PLAN_BABILLARD_ET_MESSAGERIE.md`
§0). Vérifié que ça ne casse rien fonctionnellement aujourd'hui (le sélecteur de rôles de
`SectionCommunications` a sa propre liste fixe de `labelKey` et n'utilise pas les nouvelles
clés `admin`/`staff` ajoutées), mais c'est un mélange de deux fonctionnalités distinctes dans
un seul bloc de traduction, source de confusion future. `Babillard.tsx` est en plus un
composant PARTAGÉ entre 5 dashboards différents (Admin/Staff/Teacher/Parent/Élève) — le
rattacher au namespace `admin` spécifiquement n'a pas de sens sémantique, même si ça fonctionne
techniquement (tous les dictionnaires i18n sont chargés globalement au démarrage, voir
`frontend/src/lib/i18n/index.tsx`, fonction `loadAllDictionaries` — donc `useT('admin')` depuis
le dashboard Élève fonctionne, mais c'est trompeur à la lecture du code).

**Correctif recommandé** : déplacer les clés vers un nouveau bloc `babillard` dans
`frontend/src/locales/{fr,en}/common.json` (namespace déjà partagé/générique, chargé partout),
et faire pointer `Babillard.tsx` dessus.

### G.1 — `frontend/src/locales/fr/common.json`

Ajouter un nouveau bloc top-level `"babillard"` :
```json
"babillard": {
  "publish_title": "Publier un communiqué",
  "edit_title": "Modifier le communiqué",
  "title_placeholder": "Titre du communiqué",
  "content_placeholder": "Contenu du communiqué",
  "pin": "Épingler",
  "editing_mode": "Mode édition actif",
  "editing_mode_hint": "Les changements s'appliqueront au communiqué sélectionné.",
  "cancel": "Annuler",
  "cancel_edit": "Fermer l'édition",
  "no_expiration": "Sans expiration",
  "expire_in_days": "Expirer dans N jours",
  "publish": "Publier",
  "save": "Enregistrer",
  "sending": "Publication...",
  "delete": "Supprimer",
  "deleting": "Suppression...",
  "edit": "Modifier",
  "empty": "Aucun communiqué pour le moment.",
  "create_success": "Communiqué publié avec succès.",
  "update_success": "Communiqué modifié avec succès.",
  "generic_error": "Une erreur est survenue.",
  "role_options": {
    "admin": "Admin",
    "staff": "Personnel administratif",
    "teacher": "Enseignants",
    "parent": "Parents d'élèves",
    "student": "Élèves"
  }
}
```
(reprendre les valeurs déjà écrites dans `admin.json` sous `communications.*` — même texte,
juste déplacé).

### G.2 — `frontend/src/locales/en/common.json`

Même bloc, valeurs anglaises déjà présentes dans `admin.json` sous `communications.*`.

### G.3 — `frontend/src/components/Babillard.tsx`

Changer :
```tsx
const t = useT('admin')
```
en :
```tsx
const t = useT('common')
```
et remplacer chaque `t('communications.xxx')` par `t('babillard.xxx')` dans tout le fichier
(recherche/remplace global du préfixe `communications.` → `babillard.`).

### G.4 — Nettoyage

Une fois G.1-G.3 faits et vérifiés, retirer les clés dupliquées ajoutées sous `communications.*`
dans `admin.json` (fr et en) — **sauf** `role_options.admin` et `role_options.staff` si
`SectionCommunications.tsx` les utilise réellement (vérifier avant suppression ; sinon les
retirer aussi puisqu'elles ne servaient qu'au babillard).

Cette section G n'est pas urgente — elle peut être faite en dernier, ou reportée à une session
ultérieure de nettoyage. Les sections A à F sont ce qui rend la fonctionnalité réellement
utilisable par tous les rôles concernés.

---

## Checklist de vérification finale

Une fois toutes les sections ci-dessus traitées :

1. `cd backend && npx prisma validate` — doit passer.
2. `cd backend && ./node_modules/.bin/tsc --noEmit` — doit être propre (aucune sortie).
3. `cd frontend && ./node_modules/.bin/tsc --noEmit` — doit être propre (aucune sortie).
4. `cd backend && bun test` — aucune régression (baseline connue avant ce chantier : 264
   tests verts).
5. Vérification manuelle rapide (si un environnement de dev tourne) : se connecter en Staff,
   Parent et Élève, vérifier que l'entrée « Babillard » apparaît dans la sidebar et affiche
   la liste (vide au départ) sans erreur console.
6. Vérifier que le groupe « Communication » dans la sidebar Enseignant affiche bien un texte
   traduit et non `group.communication` brut (section B).
7. Parité JSON i18n : `node -e "require('./frontend/src/locales/fr/common.json')"` et
   l'équivalent `en`, `admin` (aucune erreur de syntaxe après les éventuelles modifications de
   la section G).
