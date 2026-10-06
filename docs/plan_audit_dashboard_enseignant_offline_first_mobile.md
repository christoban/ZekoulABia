# Plan — Audit & Fiabilisation Offline-First et Mobile du Dashboard Enseignant (Standard, PP & AP)

## 1. Objectif
Garantir une autonomie hors-ligne totale (0ms sans connexion) et une ergonomie mobile irréprochable sur l'ensemble du Tableau de Bord Enseignant (`/teacher/dashboard`), qu'il s'agisse d'un enseignant régulier, d'un Professeur Principal (PP), d'un Animateur Pédagogique (AP) ou des trois rôles cumulés.

## 2. Contexte
- Le Dashboard Enseignant (`frontend/src/app/teacher/dashboard`) comprend 13 sections et widgets métiers.
- Constat d'audit :
  1. `TeacherSidebar.tsx` : le tiroir mobile n'a aucun bouton de fermeture (`X`) à côté du logo, créant l'illusion visuelle que le logo masque le bouton hamburger.
  2. `TeacherTopbar.tsx` : le bouton hamburger manque d'état tactile dynamique (`active:scale-90`, bordure, `shrink-0`).
  3. `page.tsx` : absence totale de préchargement en arrière-plan (preloader). Si l'enseignant arrive dans une classe sans réseau, les listes d'élèves par classe (`teacher:students:${classeId}`), emplois du temps, séquences et cahiers de texte ne sont pas présents en cache.
  4. `SectionAppreciationsPP.tsx` : absence de mise en cache Dexie pour les périodes et les bulletins (`report-cards`), bloquant la saisie des appréciations du PP hors-ligne.
  5. `SectionDepartementAP.tsx` : l'onglet programmes et chapitres ne lit pas le cache Dexie en cas de coupure.
  6. `SectionCahierDeTexte.tsx` : pas de repli local immédiat sur les classes et matières si l'enseignant ouvre l'onglet hors-ligne.
  7. `TeacherPresenceCheckIn.tsx` : pointage enseignant bloqué si le réseau est indisponible au moment de l'appel.

## 3. Impact sur l'architecture
- Aucun changement de contrat API ni modification du backend requise.
- Utilisation de la couche Dexie chiffrée (`@/lib/offline/db.ts`) et de l'outbox queue (`useSyncQueue`).
- Respect strict des conventions ZekoulABia : tokens CSS, styles inline, i18n via `useT`, zéro régression, zéro `as any`.

## 4. Fichiers concernés
- `frontend/src/app/teacher/dashboard/_components/TeacherSidebar.tsx`
- `frontend/src/app/teacher/dashboard/_components/TeacherTopbar.tsx`
- `frontend/src/app/teacher/dashboard/_components/TeacherPresenceCheckIn.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionAppreciationsPP.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionProfesseurPrincipal.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionDepartementAP.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionCahierDeTexte.tsx`
- `frontend/src/app/teacher/dashboard/page.tsx`

## 5. Étapes

| Étape | Description | Difficulté | IA recommandée |
|---|---|---|---|
| **Étape 1** | **Ergonomie Mobile & Header Drawer** : Ajouter le bouton tactile de fermeture `X` (`onMobileClose`) dans `TeacherSidebar.tsx` à côté du logo, et perfectionner le bouton hamburger dans `TeacherTopbar.tsx`. | Faible | DeepSeek |
| **Étape 2** | **Pointage Enseignant & Appel** : Mettre en cache le statut de présence dans `TeacherPresenceCheckIn.tsx` et permettre un repli hors-ligne sans bloquer la prise d'appel des élèves. | Moyenne | DeepSeek |
| **Étape 3** | **Cahier de texte & Programmes** : Ajouter les replis Dexie dans `SectionCahierDeTexte.tsx` (classes, matières, chapitres) et `SectionDepartementAP.tsx` (programmes du département). | Moyenne | DeepSeek |
| **Étape 4** | **Professeur Principal (PP)** : Mettre en cache les périodes et bulletins dans `SectionAppreciationsPP.tsx` et `SectionProfesseurPrincipal.tsx` pour permettre la consultation et la rédaction d'appréciations hors-ligne. | Moyenne | DeepSeek |
| **Étape 5** | **Preloader global Enseignant dans `page.tsx`** : Précharger en tâche de fond pour l'enseignant (classes, élèves de chaque classe, matières, emplois du temps, séquences, classes PP, départements AP). | Élevée | Claude Code |
| **Étape 6** | **Vérification globale** : Validation TypeScript (`tsc --noEmit` frontend + backend). | Moyenne | Claude Code |

## 6. Dépendances
- Synchronisation ascendante via `useSyncQueue` déjà en place.
- Dexie IndexedDB chiffré (`@/lib/offline/db.ts`).

## 7. Risques
- Risque de collision de clés de cache : utiliser les préfixes existants `teacher:classes`, `teacher:students:${clsId}`, `teacher:pp-report-cards:${clsId}:${periodId}`.
- Préservation de la sécurité : les données sont chiffrées au repos par `putCachedData`.

## 8. Critères de validation (Definition of Done)
1. Le tiroir mobile affiche un bouton `X` propre et clair permettant une fermeture immédiate sans confusion.
2. Le hamburger de la topbar est tactile, non compressé par le calendrier ou les badges.
3. En coupure réseau totale, l'enseignant peut :
   - Consulter son dashboard et ses classes.
   - Faire l'appel de n'importe laquelle de ses classes (élèves immédiatement chargés).
   - Consulter et saisir les notes (brouillon local + synchronisation).
   - Remplir le cahier de texte (enregistré en outbox).
   - Rédiger les appréciations de sa classe PP (enregistrées en outbox).
   - Consulter les performances et programmes de son département AP.
4. `tsc --noEmit` propre sur frontend et backend.

## 9. Plan de test
- `./node_modules/.bin/tsc --noEmit` sur `frontend/` et `backend/`.
- Vérification des clés de cache et des flux de données.

## 10. Retour arrière (Rollback)
- Annulation des modifications des fichiers via Git.
