# Plan d'audit & renforcement offline-first et ergonomie mobile — Dashboard Administrateur

## 1. Objectif
Garantir un fonctionnement offline-first total, instantané (0 ms via Dexie IndexedDB chiffré) et une ergonomie mobile irréprochable (drawer avec fermeture tactile, hamburger haute réactivité) sur l'ensemble du Dashboard Administrateur (`/admin/dashboard`), sans aucune dépendance réseau obligatoire une fois les données préchargées.

## 2. Contexte
- Le dashboard administrateur (`frontend/src/app/admin/dashboard`) est le hub central de pilotage de l'établissement scolaire.
- État des lieux actuel :
  - `AdminSidebar.tsx` : le tiroir mobile n'a pas de bouton `X` explicite dans son bloc en-tête ZekoulABia, créant une confusion visuelle sur mobile.
  - `AdminTopbar.tsx` : le bouton hamburger n'a pas de retour tactile `active:scale-90`, ni de délimitation tactile optimale ; `CalendarTopbarButton` n'est pas sécurisé avec `shrink-0`.
  - `page.tsx` : ne possède aucun Background Preloader pour alimenter Dexie avec les statistiques de pilotage, classes, utilisateurs, finances, années scolaires et emplois du temps.
  - `SectionClasses.tsx` : charge `/api/v2/classes` sans lecture Dexie préalable ni mise en cache offline.
  - `SectionUsers.tsx` : charge `/api/v2/users` sans lecture Dexie préalable ni mise en cache offline.
  - `SectionFinance.tsx` : charge `/api/v2/finance/fee-plans` et `/api/v2/finance/invoices` sans lecture Dexie préalable.
  - `SectionAcademicYear.tsx` : charge `/api/v2/academic-years` sans fallback Dexie.
  - `SectionTimetable.tsx` : charge `/api/v2/classes` et `/api/v2/timetable-grid-config` sans fallback Dexie.

## 3. Impact sur l'architecture
- **Architecture Frontend Hexagonale & Offline** :
  - Utilisation exclusive des helpers éprouvés `@/lib/offline/db` (`getCachedData`, `putCachedData`) déjà chiffrés avec AES-GCM et clé de dérivation locale.
  - Respect strict des types TypeScript, zéro `as any`.
  - Partage transparent des données déjà mises en cache entre le dashboard Staff et le dashboard Admin (ex: `staff:classes` et `admin:classes`).
- **Isolation et robustesse** :
  - Tout appel réseau en mode hors ligne s'interrompt immédiatement avec affichage direct des données locales.
  - En mode en ligne, les données reçues rafraîchissent l'interface et mettent à jour le cache Dexie en arrière-plan.

## 4. Fichiers concernés
- `frontend/src/app/admin/dashboard/_components/AdminSidebar.tsx` (modifié)
- `frontend/src/app/admin/dashboard/_components/AdminTopbar.tsx` (modifié)
- `frontend/src/app/admin/dashboard/_components/SectionClasses.tsx` (modifié)
- `frontend/src/app/admin/dashboard/_components/SectionUsers.tsx` (modifié)
- `frontend/src/app/admin/dashboard/_components/SectionFinance.tsx` (modifié)
- `frontend/src/app/admin/dashboard/_components/SectionAcademicYear.tsx` (modifié)
- `frontend/src/app/admin/dashboard/_components/SectionTimetable.tsx` (modifié)
- `frontend/src/app/admin/dashboard/page.tsx` (modifié)
- `docs/plan_audit_dashboard_admin_offline_first_mobile.md` (créé)

## 5. Étapes

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| 1 | Ajout du bouton de fermeture `X` tactile dans le header du drawer mobile de `AdminSidebar.tsx` | Faible | DeepSeek / exécutante |
| 2 | Optimisation tactile du bouton hamburger (`active:scale-90`, bordure, `shrink-0`) et protection `shrink-0` sur `CalendarTopbarButton` dans `AdminTopbar.tsx` | Faible | DeepSeek / exécutante |
| 3 | Intégration du cache Dexie offline-first (`getCachedData`, `putCachedData`) dans `SectionClasses.tsx` | Moyenne | DeepSeek / exécutante |
| 4 | Intégration du cache Dexie offline-first dans `SectionUsers.tsx` pour la consultation de l'annuaire | Moyenne | DeepSeek / exécutante |
| 5 | Intégration du cache Dexie offline-first dans `SectionFinance.tsx` pour les plans tarifaires et factures | Moyenne | DeepSeek / exécutante |
| 6 | Intégration du cache Dexie offline-first dans `SectionAcademicYear.tsx` pour les années et périodes | Moyenne | DeepSeek / exécutante |
| 7 | Intégration du cache Dexie offline-first dans `SectionTimetable.tsx` pour les configurations de grille et emplois du temps | Moyenne | DeepSeek / exécutante |
| 8 | Mise en place du Background Preloader exhaustif dans `frontend/src/app/admin/dashboard/page.tsx` | Élevée | Claude Code / Tech Lead |
| 9 | Vérification complète de la compilation TypeScript (`tsc --noEmit` frontend et backend) | Moyenne | Claude Code |

## 6. Dépendances
- `frontend/src/lib/offline/db.ts` pour `getCachedData` et `putCachedData`.
- Aucune migration de schéma de base de données requise.

## 7. Risques
- Risque d'incohérence entre les clés de cache partagées : harmoniser les clés (`admin:classes` aligné ou synchronisé avec `staff:classes`).
- Risque de type casting : veiller au typage de `getCachedData` qui renvoie `{ data: T, cachedAt: number } | undefined`.
- Risque de surcharge réseau au login : le Background Preloader doit être asynchrone, non-bloquant et utiliser `Promise.allSettled`.

## 8. Critères de validation (Definition of Done)
1. Aucune régression sur les fonctionnalités desktop ou mobile de l'administration.
2. Affichage instantané (0 ms) des écrans Classes, Utilisateurs, Finances, Années scolaires et Emplois du temps en mode hors-ligne.
3. Aucune erreur bloquante ni toast rouge intempestif en cas de déconnexion réseau.
4. Fermeture fluide du drawer mobile via la croix `X` sans conflit avec le logo.
5. Sortie de `./node_modules/.bin/tsc --noEmit` avec code 0 (frontend et backend).

## 9. Plan de test
1. Test de compilation stricte TypeScript sur frontend et backend.
2. Test de rendu des données en cache local sans appel API.
3. Vérification de l'absence de fichier temporaire ou de régression de linting.

## 10. Retour arrière (Rollback)
Annulation via `git checkout` sur les fichiers modifiés dans `frontend/src/app/admin/dashboard/`.
