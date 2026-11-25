# Plan d'Audit & Refactorisation — Dashboard Parent (Offline-First & Ergonomie Mobile)

---

## 1. Objectif
Rendre le tableau de bord du parent (`/parent/dashboard`) 100% résilient en mode **hors connexion (Offline-First)** dès la connexion initiale ou lors d'une coupure réseau inopinée (accès aux enfants, notes de toutes les séquences, bulletins, assiduité, devoirs, factures et emploi du temps), et optimiser l'ergonomie mobile en intégrant la croix de fermeture (`X`) dans le tiroir mobile et en fluidifiant le bouton hamburger sur la Topbar.

---

## 2. Contexte (état actuel du code concerné)
1. **Rupture des Notes continues hors-connexion (`SectionParentGrades.tsx`)** :
   - Lignes 120-145 : Le chargement des séquences scolaires dépend exclusivement de `/api/v2/academic-years` sans aucune lecture dans Dexie. Hors-ligne, `sequences` reste vide `[]`, `selectedSequenceId` reste `''`, et aucune note continue n'est affichée pour aucun des enfants.
2. **Préchargement d'arrière-plan insuffisant (`parent/dashboard/page.tsx`)** :
   - Lignes 173-191 : Seules les factures globales et les bulletins sont mis en cache. Les notes séquentielles (`parent:grades:seq:...`), le journal d'assiduité (`parent:attendance:journal:...`), les devoirs (`parent:cahier:...`) et l'emploi du temps ne sont pas préchargés pour les enfants du parent.
   - Incohérence de clé : `page.tsx` préchargeait `parent:attendance:${uid}` alors que `SectionParentAttendance.tsx` cherchait dans `parent:attendance:children:${userId}`.
3. **Ergonomie Mobile & Tiroir sans fermeture (`ParentSidebar.tsx` & `ParentTopbar.tsx`)** :
   - `ParentSidebar.tsx` (L111-L125) : L'en-tête du tiroir mobile affiche le logo ZekoulABia à l'endroit exact où se trouvait le bouton hamburger mais ne propose aucun bouton de fermeture `X`.
   - `ParentTopbar.tsx` (L101-L120) : Le bouton hamburger manque de souplesse tactile sur mobile.

---

## 3. Impact sur l'architecture
- **Couches touchées** : Frontend uniquement (Next.js App Router, Dexie IDB, hooks offline).
- **Respect des conventions** :
  - Clés déterministes partitionnées par `userId` et `studentId`.
  - Stale-While-Revalidate via `useCachedFetch`.
  - Tokens CSS existants et typage TypeScript strict (0 `as any` ajouté).

---

## 4. Fichiers concernés
- **Modifiés** :
  1. `frontend/src/app/parent/dashboard/page.tsx` (préchargement complet des enfants, notes, assiduité, devoirs et emplois du temps)
  2. `frontend/src/app/parent/dashboard/_components/SectionParentGrades.tsx` (résilience hors-ligne des séquences et notes)
  3. `frontend/src/app/parent/dashboard/_components/SectionParentAttendance.tsx` (harmonisation des clés de cache)
  4. `frontend/src/app/parent/dashboard/_components/SectionParentTimetable.tsx` (cache de la grille horaire)
  5. `frontend/src/app/parent/dashboard/_components/ParentSidebar.tsx` (bouton `X` de fermeture mobile dans l'en-tête)
  6. `frontend/src/app/parent/dashboard/_components/ParentTopbar.tsx` (dégagement hamburger et espacements tactiles)

---

## 5. Étapes de réalisation

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| **1** | **Bouton Fermer (`X`) et dégagement mobile (`ParentSidebar.tsx` & `ParentTopbar.tsx`)** : Ajouter la croix de fermeture dans l'en-tête du tiroir mobile à côté du logo ZekoulABia et optimiser le bouton hamburger sur la Topbar. | Faible | DeepSeek |
| **2** | **Résilience offline des Notes & Séquences (`SectionParentGrades.tsx`)** : Mettre en cache la liste des années/séquences dans Dexie (`parent:academic-years`) et repli automatique sans réseau pour que le sélecteur de séquence et les notes fonctionnent hors-ligne. | Moyenne | Claude Code |
| **3** | **Harmonisation et résilience Assiduité & Emploi du temps (`SectionParentAttendance.tsx` & `SectionParentTimetable.tsx`)** : Harmoniser la clé de cache des enfants et sécuriser le fallback de la grille horaire. | Faible | DeepSeek |
| **4** | **Préchargement complet d'arrière-plan (`parent/dashboard/page.tsx`)** : Précharger proactivement pour chaque enfant : notes de toutes les séquences, journal d'assiduité, emploi du temps et cahier de devoirs. | Moyenne | Claude Code |

---

## 6. Critères de validation (Definition of Done)
1. Compilation `tsc --noEmit` à 0 erreur sur frontend et backend.
2. Sur mobile, le tiroir s'ouvre et se referme via la croix `X` sans obstruction.
3. En coupant la connexion, le parent peut consulter la liste de ses enfants, leurs notes (avec changement de séquence), leurs bulletins, leurs devoirs et leur assiduité directement depuis le cache Dexie avec le badge hors-connexion.
