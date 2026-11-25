# Suivi — Reste à faire (Roadmap V0 → V3)

> **Source** : `docs/AUDIT_ROADMAP.md` — révision du **2026-08-21** (après clôture V2.5 : 662 tests verts, `tsc` 0).
> **Légende statut** : ⬜ ABSENT · 🟠 PARTIEL · 🟡 FAIT NON TESTÉ
> **Légende faisabilité** : ✅ **Muse Spark** (exécutante — je peux le faire, Faible/Moyenne, pattern existant) · ⚠️ **Tech Lead humain / Claude Code** (Élevée/Très élevée — décision produit/archi/sécurité, ou hardware)
> **Note** : la section F « Incohérences de la roadmap » a été retirée — 4 incohérences corrigées dans `AUDIT_ROADMAP.md` (V1.7, V0.6, §1 n°99 et n°103).

---

## A. Fonctionnalités ABSENTES (⬜) — à construire de zéro

| # | Section | Détail | Faisabilité |
|---|---|---|---|
| V3.9 | Tests de bout en bout (e2e) | Aucun `playwright.config`/`cypress.config` ; `playwright` en dépendance mais jamais importé ; 0 des 5 scénarios e2e demandés. | ✅ Muse Spark (scaffold) / ⚠️ Humain (choix des 5 scénarios) |

---

## B. Fonctionnalités PARTIELLES (🟠) — à compléter

| # | Manque précis | Faisabilité |
|---|---|---|
| V2.14 | Recensement MINESEC : **~7 feuilles sur 17** couvertes (ajout Students_ESG_Eng, Students_ESTP_Eng, Manuels-Didactics, Themes_Tranversaux en A_AUTO/C_MANUAL). Reste : feuilles doc/réservées (NOTICE, Variables Essentielles…) hors périmètre école. | ✅ Muse Spark |
| V3.3 | Confirmation utilisateur obligatoire = **2 actions sur ~54** seulement ; le reste s'exécute sans confirmation (undo a posteriori). | ⚠️ Tech Lead — généraliser = décision sécurité transverse |
| V3.8 | Neon PITR = **6h de rétention** (plan gratuit), très sous le minimum. | ⚠️ Humain — décision infra/coût (changer de plan Neon) |
---

## C. Fait mais NON TESTÉ (🟡) — prioritaires en couverture

> Tous ces tests suivent un pattern déjà dans le repo (`InMemory*Repository`, `User.reconstituer`). C'est ma zone la plus sûre.

| # | Use cases / zones non testés | Faisabilité |
|---|---|---|
| V3.3 | `AssistantController`, catalogues d'actions, RBAC/anti-hallucination — **zéro test** (seule la journalisation en aval est testée). | ✅ Muse Spark pour RBAC (mocker Groq) / ⚠️ Tech Lead pour `/execute` non déterministe |
|
> **Note** : V0.6 figure ici car la roadmap le laisse en 🟡 malgré les 10 tests d'intégration ajoutés en §3.5 — statut conservé tel quel, à arbitrer si passage en ✅.

---

## D. Écarts d'architecture (§1) — à corriger

| # | Écart | Faisabilité |
|---|---|---|
| 1 | **V3.3** : pattern « confirmation obligatoire avant persistence » non généralisé (~54 actions, **2 seulement** confirmées). | ⚠️ Tech Lead — décision sécurité + UX |

---

## E. Les 5 zones risquées (§3) — restes ouverts

| # | Risque | Reste | Faisabilité |
|---|---|---|---|
| 1 | Assistant IA `/execute` | Non couvert (nécessite un **mock du modèle Groq** non déterministe — décision à prendre). | ⚠️ Tech Lead — mock + revue du non-déterminisme |
| 2 | Paiements offline — conflit de version (V3.2) | **Manque de conception**, pas seulement de test. | ⚠️ Tech Lead — conception à faire avant le test |
| 3 | Permissions / isolation / MFA | `authorizeSchool` (RBAC `perm:*`) + les 3 use cases MFA toujours sans test ; isolation démontrée sur **15 routes** (3 + 12). | ✅ Muse Spark (tests) / ⚠️ Tech Lead (RBAC `perm:*` = revue sécurité) |
| 4 | Mentions complémentaires | `middleware/idempotency.ts` (anti-double-exécution) non testée ; `AppliquerTransfertPebsUseCase` non testée ; `ImporterUtilisateursUseCase` non testé. | ✅ Muse Spark |

---

## Synthèse — 3 grands chantiers restants

1. **Couvrir ce qui est construit mais non testé** (§C) — le plus volumineux, à forte valeur : `ActiverEtablissementUseCase`, `ImporterUtilisateursUseCase`, MFA, orientation, LV2/PEBS, concours, APEE, MINESEC, pipeline Inngest, assistant IA. → **✅ Muse Spark** (lot par lot, `tsc` + tests verts).
2. **Compléter les fonctionnalités partielles** (§B) — workflow de validation des frais (V1.11), moteur de routage des notifications (V2.12), moteur de reporting (V3.5), tâches (V2.15), ré-application de template (V0.4/V2.2), présence géolocalisée (V2.11), timeline unifiée (V3.6), e2e (V3.9). → **Mixte** : V1.11/V2.13/V2.14/V3.6/V3.7 = ✅ Muse Spark ; le reste = ⚠️ Tech Lead (spec manquante).
3. **Corriger les écarts d'architecture** (§D) — fuites hexagonales, canal de notification codé en dur, confirmation IA non généralisée. → **⚠️ Tech Lead** (revue transverse).

*Dernière mise à jour : 2026-08-21 — après clôture V2.5. Source : `AUDIT_ROADMAP.md` (F retirée, déjà corrigée). Faisabilité annotée par **Muse Spark** (exécutante) — les lignes ⚠️ nécessitent un arbitrage produit/archi avant implémentation.*
