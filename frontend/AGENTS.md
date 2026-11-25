<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Structure frontend — Matrice de placement & Gouvernance (`architectureGuard.test.ts`)

Avant de créer ou modifier un fichier dans `frontend/src/`, applique obligatoirement cet **arbre de décision** (contrôlé automatiquement par `frontend/src/tests/architectureGuard.test.ts`) :

```text
Ton composant / module concerne...
├─ 1. Coque UI transverse (Topbar, Sidebar, BottomNav, Toast, ConfirmDialog)
│    └─ src/components/shell/ uniquement.
│       Les coques de rôle (`*Topbar`, `*BottomNav`, `*Sidebar`, `*Toast`) doivent déléguer à `@/components/shell/`.
│       JAMAIS de `alert()`, `window.alert()`, `confirm()` ou `window.confirm()` → utiliser `<AppToast />` et `confirmAction()`.
├─ 2. Une fonctionnalité métier partagée par ≥ 2 portails / routes (ex. Admin + Staff)
│    └─ src/features/<domaine>/
│       Le fichier `app/<role>/dashboard/_components/Section*.tsx` reste un wrapper fin (≤ 30–40 lignes si vue 100 % partagée)
│       ou importe explicitement le socle `@/features/<domaine>/` (zéro logique dupliquée).
├─ 3. Un écran propre à UNE seule route / un seul portail
│    └─ src/app/<role>/dashboard/_components/ (colocalisé dans `_components/`).
└─ 4. Une primitive UI ou utilitaire purement générique (sans logique métier ni d'écran)
     └─ src/components/ui/ (shadcn) ou src/components/.
        ⚠️ Isolation stricte : `components/shell/` et `components/ui/` n'importent JAMAIS depuis `app/` ou `features/`.
```

---

## Domaines déjà centralisés dans `frontend/src/features/`

Ne crée pas de doublon dans `app/*/dashboard/_components/` pour ces domaines — réutilise ou enrichis le module partagé existant :
- `affectations` · `attendance` · `babillard` · `carnet-liaison` · `classes` · `communication` · `concours` · `council`
- `examens` · `finance` · `messagerie` · `rh` · `student` · `studentTransfer` · `suivi-eleves` · `timetable`

---

## Règles bloquantes vérifiées par `bun test src/tests/architectureGuard.test.ts`

1. **Zéro `any` non justifié** dans `frontend/src/**/*.{ts,tsx}` (hors `tests/` et `__tests__/`). Utiliser des interfaces métier, `unknown` + narrowing, `PropertyKey`, `LucideIcon`, etc.
2. **Zéro dialogue natif** (`alert`, `window.alert`, `confirm`, `window.confirm`) → passer par `confirmAction()` (`@/components/shell/ConfirmDialog`) et `AppToast`.
3. **Isolation des primitives** : `components/shell/` et `components/ui/` n'importent jamais `app/` ni `features/`.
4. **Shells par rôle liés au shell partagé** : tous les `*(Toast|BottomNav|Topbar|Sidebar).tsx` (hors `MasterTopbar.tsx` legacy) doivent importer `@/components/shell/`.
5. **Wrappers & socles Admin/Staff** : les wrappers factorisés restent `<= 30` lignes et les 8 paires importent leur module `@/features/<domaine>/`.
6. **Plafond de 500 lignes avec effet cliquet (Ratchet)** :
   - Tout **nouveau** fichier `.ts`/`.tsx` sous `frontend/src/` est strictement plafonné à **500 lignes maximum**.
   - Les fichiers historiques déjà `> 500` lignes ont un plafond gelé dans `LEGACY_OVERSIZED_MAX_LINES` : aucune croissance n'est tolérée sans découpage.
