# Plan d'audit & renforcement offline-first et ergonomie mobile — Modules et Écrans Partagés

## 1. Objectif
Garantir une résilience hors-ligne totale (0 ms via Dexie IndexedDB chiffré), un fonctionnement sans rupture et une ergonomie mobile optimale sur tous les modules partagés entre dashboards : Babillard officiel, Messagerie collaborative, Bandeau d'événements académiques, Modal de calendrier scolaire et Écran de synchronisation hors-ligne.

## 2. Contexte
- Les composants et modules transversaux sont intégrés à l'identique dans les dashboards Élève, Parent, Enseignant, Staff et Administrateur.
- État des lieux actuel :
  - **Babillard** (`BabillardBoard.tsx`) : persistait dans `localStorage` uniquement en cas d'erreur réseau, obligeant l'utilisateur à attendre le réseau à chaque ouverture au lieu d'afficher le cache Dexie chiffré à 0 ms.
  - **EventCenterWidget** (`EventCenterWidget.tsx`) : ne consultait pas Dexie pour les événements actifs et utilisait un padding desktop excessif (`padding: '10px 32px'`) sur les écrans mobiles étroits.
  - **CalendarProgressModal** (`CalendarProgressModal.tsx`) : en cas de coupure réseau, retombait sur des valeurs statiques de secours (2026-2027, 15%) au lieu d'exploiter les années académiques et événements réels stockés dans Dexie.
  - **SectionOfflineStatus** (`SectionOfflineStatus.tsx`) : utilisait des espacements fixes (`padding: '28px 32px'`) rétrécissant l'espace utile sur mobile.
  - **Messagerie** (`index.tsx`, `FilConversation.tsx`, `ListeConversations.tsx`) : déjà dotée du cache Dexie, mais nécessitant une vérification de robustesse et des micro-interactions tactiles renforcées sur mobile.

## 3. Impact sur l'architecture
- **Couche Offline Hexagonale** :
  - Utilisation systématique de `getCachedData` et `putCachedData` de `@/lib/offline/db`.
  - Harmonisation des clés de cache globales : `babillard:publications:${tab}`, `babillard:counts`, `shared:academic-events:active`.
  - Zéro régression sur les dashboards consommateurs (`/student`, `/parent`, `/teacher`, `/staff`, `/admin`).

## 4. Fichiers concernés
- `frontend/src/features/babillard/components/BabillardBoard.tsx` (modifié)
- `frontend/src/features/communication/EventCenterWidget.tsx` (modifié)
- `frontend/src/components/CalendarProgressModal.tsx` (modifié)
- `frontend/src/components/SectionOfflineStatus.tsx` (modifié)
- `frontend/src/features/messagerie/ListeConversations.tsx` (modifié)
- `docs/plan_audit_modules_partages_offline_first_mobile.md` (créé)

## 5. Étapes

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| 1 | Migration de `BabillardBoard.tsx` vers Dexie chiffré avec affichage instantané 0 ms et cache des compteurs d'onglets | Moyenne | DeepSeek / exécutante |
| 2 | Ajout du cache Dexie et optimisation responsive mobile dans `EventCenterWidget.tsx` | Faible | DeepSeek / exécutante |
| 3 | Intégration du cache Dexie des années scolaires et événements réels dans `CalendarProgressModal.tsx` | Moyenne | DeepSeek / exécutante |
| 4 | Optimisation ergonomique et responsive des espacements dans `SectionOfflineStatus.tsx` | Faible | DeepSeek / exécutante |
| 5 | Amélioration tactile mobile dans `ListeConversations.tsx` | Faible | DeepSeek / exécutante |
| 6 | Vérification complète de la compilation TypeScript (`tsc --noEmit` frontend et backend) | Moyenne | Claude Code |

## 6. Dépendances
- `@/lib/offline/db` (tables Dexie `cachedData` et `userSession`).

## 7. Risques
- Risque de désynchronisation des compteurs d'onglets du Babillard en mode hors-ligne : résolu en cachant la structure complète `{ all, pinned, for_me, unread, archives }`.
- Risque de typage sur `getCachedData` : respecter `{ data: T, cachedAt: number } | undefined`.

## 8. Critères de validation (Definition of Done)
1. Affichage instantané (0 ms) des publications du Babillard, des événements scolaires et de la progression de l'année en mode hors-ligne.
2. Aucune régression visuelle ou fonctionnelle sur mobile.
3. Sortie TypeScript 100% clean sur frontend et backend (`tsc --noEmit` code 0).

## 9. Plan de test
- Compilation statique stricte TypeScript (`tsc --noEmit`) sur frontend et backend.
- Validation des structures de cache et suppression des fichiers temporaires.

## 10. Retour arrière (Rollback)
Annulation via `git checkout` sur les fichiers modifiés.
