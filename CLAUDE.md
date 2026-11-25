# CLAUDE.md — Point d'entrée gouvernance multi-agents ZEKOULABIA

> Ce fichier est le point d'entrée rapide pour Claude Code et tout assistant IA travaillant sur ce dépôt.
> La source unique de vérité complète reste **[AGENTS.md](AGENTS.md)** (méthode, SOLID, architecture, conventions) complétée par **[frontend/AGENTS.md](frontend/AGENTS.md)** pour le frontend.

---

## 1. Lecture obligatoire avant toute modification

1. **[AGENTS.md](AGENTS.md)** — Workflow obligatoire (analyse préalable, plan par défaut, règles d'or §2, design §4).
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** — Architecture hexagonale Backend + couches Frontend.
3. **[MODULE_INDEX.md](MODULE_INDEX.md)** — Carte « Où intervenir » (backend + frontend).
4. **[CONVENTIONS.md](CONVENTIONS.md)** — Nommage FR métier, i18n `useT`, tokens CSS, API `/api/v2/*`.
5. **[frontend/AGENTS.md](frontend/AGENTS.md)** — Matrice de placement UI (`shell/` vs `features/` vs `_components/` vs `components/ui/`).

---

## 2. Règles critiques à ne jamais contourner

- **Backend (Architecture Hexagonale)** : `domain/` ne dépend de rien ; `application/` ne dépend que de `domain/` ; jamais de Prisma/Express/SDK hors `infrastructure/`. Toujours filtrer par `schoolId` (multi-tenant) et vérifier le RBAC.
- **Frontend (Matrice DRY)** :
  - Navigation / Topbar / Sidebar / BottomNav / Toast / Confirm → **`frontend/src/components/shell/`** (aucun `alert()`/`confirm()` natif).
  - Logique partagée entre ≥ 2 portails (ex. Admin + Staff) → **`frontend/src/features/<domaine>/`** avec wrapper fin dans `app/<role>/dashboard/_components/`.
  - Spécifique à 1 portail → `app/<role>/dashboard/_components/`.
- **Zéro `any` (`AGENTS.md §4.12`)** : interdit partout sauf mention explicite `// hex-allow-any: <raison>` exceptionnellement justifiée.
- **Plafond de 500 lignes (`AGENTS.md §4.1`)** : tout nouveau fichier `<= 500` lignes ; les fichiers existants `> 500` lignes sont sous effet cliquet (ne peuvent pas grossir).

---

## 3. Commandes bloquantes avant de clore une tâche

```bash
# Backend
cd backend && ./node_modules/.bin/tsc --noEmit && bun test tests/unit/architectureGuard.test.ts

# Frontend
cd frontend && ./node_modules/.bin/tsc --noEmit && bun test src/tests/architectureGuard.test.ts
```

*Ne jamais affaiblir un guard ni ajouter d'exception pour contourner un échec.*

