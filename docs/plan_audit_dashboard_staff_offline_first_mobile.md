# Plan — Audit & Fiabilisation Offline-First et Mobile du Dashboard Staff

## 1. Objectif
Garantir une autonomie hors-ligne totale (0ms sans connexion) et une ergonomie mobile optimale sur l'ensemble du Tableau de Bord Staff (`/staff/dashboard`), pour tous les profils de personnel (Direction des études / Censeur, Surveillant Général, Secrétariat, Intendance / Finance).

## 2. Contexte
- Le Dashboard Staff (`frontend/src/app/staff/dashboard`) comporte plus de 15 modules métiers.
- Constats d'audit :
  1. `StaffSidebar.tsx` : le tiroir mobile n'a aucun bouton de fermeture (`X`) à côté du logo, laissant croire que le logo masque le bouton hamburger sous-jacent.
  2. `StaffTopbar.tsx` : le hamburger manque de réactivité tactile (`active:scale-90`, `shrink-0`) et le calendrier peut comprimer la barre.
  3. `page.tsx` : absence totale de preloader en arrière-plan. Si le membre du personnel est hors-ligne, les classes, élèves par classe, emplois du temps, conseils de classe et validations de bulletins sont inaccessibles s'ils n'ont pas été consultés individuellement au préalable.
  4. `SectionClassesStaff.tsx` : pas de repli local Dexie pour les classes et années académiques.
  5. `SectionElevesFamillesStaff.tsx` : l'annuaire des élèves et familles par classe ne lit pas le cache Dexie en mode hors-ligne.
  6. `SectionBulletinValidation.tsx` : pas de mise en cache Dexie des sessions de validation de bulletins.
  7. `SectionCouncil.tsx` : pas de mise en cache Dexie des sessions de conseils de classe.
  8. `SectionDiscipline.tsx` : pas de repli Dexie pour les sanctions et conseils de discipline.

## 3. Impact sur l'architecture
- Aucun changement de contrat API ni modification du backend requise.
- Utilisation de la couche Dexie chiffrée (`@/lib/offline/db.ts`) et de l'outbox queue (`useSyncQueue`).
- Respect strict des conventions ZekoulABia : tokens CSS, styles inline, i18n via `useT`, zéro régression, zéro `as any`.

## 4. Fichiers concernés
- `frontend/src/app/staff/dashboard/_components/StaffSidebar.tsx`
- `frontend/src/app/staff/dashboard/_components/StaffTopbar.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionClassesStaff.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionElevesFamillesStaff.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionBulletinValidation.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionCouncil.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionDiscipline.tsx`
- `frontend/src/app/staff/dashboard/page.tsx`

## 5. Étapes

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| **Étape 1** | **Ergonomie Mobile & Header Drawer** : Ajouter le bouton tactile de fermeture `X` (`onMobileClose`) dans `StaffSidebar.tsx` à côté du logo, et perfectionner le bouton hamburger dans `StaffTopbar.tsx`. | Faible | DeepSeek |
| **Étape 2** | **Structure & Annuaire Hors-Ligne** : Ajouter le cache et repli Dexie dans `SectionClassesStaff.tsx` et `SectionElevesFamillesStaff.tsx`. | Moyenne | DeepSeek |
| **Étape 3** | **Conseils, Bulletins & Discipline Hors-Ligne** : Mettre en cache Dexie et ajouter le repli dans `SectionBulletinValidation.tsx`, `SectionCouncil.tsx` et `SectionDiscipline.tsx`. | Moyenne | DeepSeek |
| **Étape 4** | **Preloader global Staff dans `page.tsx`** : Précharger en tâche de fond pour le staff (classes, annuaire des élèves, emplois du temps, affectations, conseils, validations, discipline, finance). | Élevée | Claude Code |
| **Étape 5** | **Vérification globale** : Validation TypeScript (`tsc --noEmit` frontend + backend). | Moyenne | Claude Code |

## 6. Dépendances
- Dexie IndexedDB chiffré (`@/lib/offline/db.ts`).
- Hooks et file d'attente d'actions (`useSyncQueue`).

## 7. Risques
- Risque de collision de clés de cache : utiliser les clés standardisées préfixées par `staff:`.
- Données chiffrées au repos via `putCachedData`.

## 8. Critères de validation (Definition of Done)
1. Le tiroir mobile affiche un bouton `X` propre permettant une fermeture instantanée.
2. Le hamburger de la topbar est tactile, non compressé par le calendrier ou les badges.
3. En coupure réseau totale, le staff peut :
   - Consulter la structure des classes et années académiques.
   - Consulter l'annuaire des élèves et coordonnées des familles.
   - Consulter l'emploi du temps de n'importe quelle classe.
   - Consulter les sessions de conseils de classe et validations de bulletins.
   - Consulter le registre de discipline et les factures en attente.
4. `tsc --noEmit` propre sur frontend et backend (code 0).

## 9. Plan de test
- `./node_modules/.bin/tsc --noEmit` sur `frontend/` et `backend/`.

## 10. Retour arrière (Rollback)
- Annulation des modifications des fichiers via Git.
