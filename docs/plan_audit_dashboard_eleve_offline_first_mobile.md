# Plan d'Audit & Refactorisation — Dashboard Élève (Offline-First & Ergonomie Mobile)

---

## 1. Objectif
Rendre le tableau de bord de l'élève (`/student/dashboard`) 100% opérationnel en mode **hors connexion (Offline-First)** dès la connexion initiale ou lors d'une coupure réseau, et assainir l'ergonomie mobile en supprimant le débordement/chevauchement de la Topbar (bouton hamburger, calendrier, logo du tiroir) et en compacifiant l'empilement excessif de bannières et de badges.

---

## 2. Contexte (état actuel du code concerné)
1. **Rupture Offline-First sur l'Authentification & Restauration de session** :
   - `frontend/src/app/login/page.tsx` (L155-L175, L254-L300) : si l'appareil est hors-ligne ou que l'API réseau échoue avec `TypeError: Failed to fetch`, l'exception n'est pas interceptée comme un basculement hors-ligne si `navigator.onLine` était à `true`. L'application affiche alors le formulaire de connexion, qui échoue sur une erreur réseau bloquante au lieu de permettre l'ouverture du tableau de bord depuis `localStorage` / `Dexie`.
   - `frontend/src/app/student/dashboard/page.tsx` (L108-L133) : au chargement, `user` est initialisé avec les champs minimaux de `localStorage` sans `studentProfile` (`classId`, etc. sont `undefined`). Si la requête `/api/v2/users/me` ne s'exécute pas (offline), `user.studentProfile` reste `undefined`, ce qui bloque le chargement de toutes les sous-sections.
2. **Absence de cache pour les données pivot (Séquences & Années scolaires)** :
   - `frontend/src/app/student/dashboard/_components/SectionStudentGrades.tsx` (L66-L90) : les séquences dépendent de `/api/v2/academic-years` qui n'a aucun mécanisme de cache local. En mode offline, `sequences` reste vide `[]`, `selectedSequenceId` reste `''`, et aucune note n'est chargée même si les notes étaient stockées dans Dexie.
   - `frontend/src/app/student/dashboard/_components/SectionStudentTimetable.tsx` (L76-L98) : dépendance directe à `/api/v2/timetable-grid-config` sans mise en cache.
3. **Préchargement Offline incomplet** :
   - `frontend/src/app/student/dashboard/page.tsx` (L176-L209) : le préchargement en arrière-plan ne met en cache que les bulletins et l'assiduité. L'emploi du temps, les notes de toutes les séquences, le cahier de texte et l'accueil ne sont pas préchargés systématiquement.
4. **Ergonomie Mobile & Chevauchement de la Topbar** :
   - `frontend/src/app/student/dashboard/_components/StudentTopbar.tsx` (L101-L130) : sur un écran mobile (< 390px), le cumul `Hamburger (40px) + Titre + CalendarTopbarButton (avec libellé textuel long) + Cloche (40px) + Kebab (40px) + Avatar (32px)` dépasse 400px de large, provoquant un écrasement horizontal qui masque ou bloque le bouton hamburger.
   - `frontend/src/app/student/dashboard/_components/StudentSidebar.tsx` (L120-L130, L233-L243) : le tiroir mobile n'a aucun bouton de fermeture explicite (`X`) dans son en-tête. Le logo ZekoulABia en haut à gauche du tiroir donne l'impression de s'être superposé sur le hamburger sans possibilité de fermer sauf clic extérieur.
   - Empilement vertical de 5 bannières simultanées (`EventCenterWidget`, `HealthAlertBanner`, `ProfileIncompleteBanner`, `Lv2ChoiceBanner`, `OrientationCheckpointBanner`) consommant plus de 400px de hauteur sur mobile avant d'accéder au tableau de bord.

---

## 3. Impact sur l'architecture
- **Couches touchées** : Frontend uniquement (Next.js App Router, Dexie IDB, hooks offline).
- **Respect des conventions** :
  - Architecture Offline-First unifiée (Dexie `cachedData` et `userSession`).
  - Utilisation de `useCachedFetch` avec clés déterministes.
  - Zéro `as any` ajouté.
  - Styles avec tokens CSS existants (`var(--primary)`, `var(--surface)`, `var(--border)`, etc.).
  - Isolation multi-tenant et respect de la session élève.

---

## 4. Fichiers concernés
- **Modifiés** :
  1. `frontend/src/app/login/page.tsx` (gestion offline robuste de la reprise de session)
  2. `frontend/src/app/student/dashboard/page.tsx` (préchargement offline complet + persistance Dexie du profil complet)
  3. `frontend/src/app/student/dashboard/_components/StudentTopbar.tsx` (adaptation responsive compacte sans débordement)
  4. `frontend/src/app/student/dashboard/_components/StudentSidebar.tsx` (ajout du bouton fermer `X` dans le header mobile)
  5. `frontend/src/app/student/dashboard/_components/SectionStudentGrades.tsx` (mise en cache des séquences et fallback offline)
  6. `frontend/src/app/student/dashboard/_components/SectionStudentDashboard.tsx` (accordéon / compacification des bannières sur mobile)
  7. `frontend/src/components/CalendarTopbarButton.tsx` (variante mobile ultra-compacte sans texte encombrant)

---

## 5. Étapes de réalisation

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| **1** | **Reprise de session et accès offline dans `login/page.tsx`** : Détecter l'indisponibilité réseau lors de `/api/v2/users/me` et autoriser le basculement direct sur le dashboard sans blocage lorsque `zekoulabia_user` est présent. Ajouter un lien de repli explicite « Accéder hors-connexion » si une session existe. | Moyenne | Claude Code |
| **2** | **Persistance et préchargement global dans `student/dashboard/page.tsx`** : Stocker `fullProfile` dans Dexie dès le premier fetch, et précharger en arrière-plan : profil académique, séquences actives, notes, emploi du temps de la classe, devoirs du cahier de texte. | Moyenne | Claude Code |
| **3** | **Résilience offline dans `SectionStudentGrades.tsx` et `SectionStudentTimetable.tsx`** : Mettre en cache la liste des années/séquences dans Dexie (`student:academic-years`) pour que le sélecteur de séquence fonctionne hors-ligne. Idem pour la configuration de grille horaire. | Moyenne | DeepSeek |
| **4** | **Correction du chevauchement Topbar & Hamburger (`StudentTopbar.tsx` & `CalendarTopbarButton.tsx`)** : Sur mobile (`< md`), masquer le texte de la date dans le bouton calendrier (icône seule compacte), ajuster les espacements et marges pour garantir que le bouton hamburger reste 100% visible, dégagé et cliquable. | Faible | DeepSeek |
| **5** | **Bouton Fermer explicite dans le tiroir mobile (`StudentSidebar.tsx`)** : Ajouter un bouton `X` stylisé dans le header du tiroir à côté du logo ZekoulABia pour permettre une fermeture fluide et intuitive. | Faible | DeepSeek |
| **6** | **Compacification des bannières d'alertes sur mobile (`SectionStudentDashboard.tsx`)** : Regrouper ou replier les bannières multiples dans un conteneur accordéon compact (« Vos alertes et démarches (3) ») sur mobile pour ne pas écraser l'écran. | Moyenne | DeepSeek |

---

## 6. Dépendances
- Dépend uniquement du stockage local Dexie (`src/lib/offline/db.ts`) et de `fetchApi`. Aucune dépendance externe ni migration de base de données nécessaire.

---

## 7. Risques & Points sensibles
- **Sécurité** : Ne jamais exposer de données d'un autre élève dans le cache Dexie ; toutes les clés de cache restent strictement partitionnées par `user.id`.
- **Régression** : Vérifier que le mode en ligne continue de mettre à jour le cache de façon transparente et silencieuse (stratégie Stale-While-Revalidate).

---

## 8. Critères de validation (Definition of Done)
1. **Test Offline** :
   - Lorsque l'utilisateur coupe la connexion réseau (ou simule hors-ligne), l'élève peut accéder au dashboard sans être bloqué sur l'écran de login.
   - Toutes les sections clés (Dashboard, Notes, Emploi du temps, Cahier de texte, Assiduité, Bulletins) affichent leurs données depuis le cache Dexie avec le badge `Mode hors connexion`.
2. **Test Mobile** :
   - Sur écran mobile (360px - 390px), le hamburger est parfaitement visible, dégagé, et ouvre le tiroir sans chevauchement.
   - Le tiroir mobile affiche un bouton de fermeture `X` évident.
   - Les bannières ne masquent pas le contenu principal et s'affichent proprement.
3. **TypeScript** : `cd frontend && ./node_modules/.bin/tsc --noEmit` avec 0 erreur.

---

## 9. Plan de test
- Test de compilation statique : `./node_modules/.bin/tsc --noEmit`.
- Test de simulation déconnectée : navigation avec données pré-remplies dans Dexie.
- Test visuel via le browser subagent en émulation mobile (375x667).

---

## 10. Retour arrière (Rollback)
- Les modifications sont purement isolées au frontend ; un simple `git checkout` sur les composants concernés permet d'annuler les modifications sans impact sur la base de données.
