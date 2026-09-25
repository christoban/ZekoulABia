# CODE_REVIEW_NOTES.md

> Fichier de suivi des violations/notes repérées en passant mais non corrigées (règle §3 de AGENTS.md).
> Format : `[AAAA-MM-JJ] fichier:ligne — règle violée — description courte`

## Résolu

- [2026-08-27] `backend/src/infrastructure/http/controllers/DevController.ts` — dev-only (`NODE_ENV !== 'production'`), réimplémentait la logique métier prod (effectiveSerieCode, computeSlotsFromGrid, EDT, distribution notes) au lieu des vrais UC. **Résolu : supprimé** (2026-09-28) — jamais en prod, aucun test ne le référençait, duplication de logique métier = dette supprimée plutôt que UC sur-ingénierie pour un seed tool.
- [2026-09-23] `frontend/src/app/admin/dashboard/_components/SectionSettings.tsx:539` — thème — onglet actif corrigé avec `var(--surface)`, lisible en mode sombre.

## Dette acceptée (documentée, non bloquante)

- [2026-08-27] `backend/src/infrastructure/http/controllers/AssistantController.ts:84` — `ActionContext.prisma` requis par ~106 appels `ctx.prisma.*` dans les catalogues copilot (`teacher/student/staff/parent/adminActionCatalog.ts`, `catalogShared.ts`). Le controller ne fait plus AUCUNE requête Prisma directe (17 → 0 via `AssistantContextQueryRepository`), mais `prismaClient` est injecté dans `ActionContext` pour le catalogue. Ponytail : découpler 106 sites = sur-ingénierie pour un chantier non demandé. À traiter dans le chantier "copilot IA consomme des ports" si priorité métier.
- [2026-09-03] `backend/src/application/**` (≈28 fichiers) — `any` préexistants non justifiés (~80 occurrences) détectés par `architectureGuard.test.ts` (test `application/ ne contient aucun "any" non justifié`). Les 6 fichiers du périmètre Groupe A ont été corrigés ; le reste (ScannerListeCandidats, paiementMinesec, statisticalCampaign, sante, DetecterChuteMoyenne…) reste en dettes — **chantier dédié** : typer ou ajouter `// hex-allow-any: <raison>` par occurrence pour viser garde-fou 1 fail (inngest). Deux `any` dans `domain/` aussi : `ports/repositories/InvitationRepository.ts:35` (`onboardingConfig?: any` → `JsonValue`) et `reporting/MetricDefinitions.ts:105` (`school as any`, `classe as any`).
- [2026-09-20] `backend/tests/unit/application/subject/AssignerEnseignantMatiereUseCase.test.ts:55` — suite à l'alignement Censeur (commit d925da0), le guard `demandeurRole !== 'ADMIN'` a été assoupli dans le use case mais le test unitaire attendait toujours une exception synchrone "Seul un Admin". À réaligner dans un chantier RBAC Censeur.
- [2026-09-23] `frontend/src/app/admin/dashboard/_components/SectionCommunications.tsx:219` — thème — l’onglet actif force `white` et risque le même défaut de contraste en mode sombre.
- [2026-09-23] `frontend/src/app/admin/dashboard/_components/SectionSubjects.tsx:1498` — thème — les options « Toutes/Classes uniquement » d’une modale forcent aussi `white` et présentent le même risque en mode sombre.
- [2026-09-23] `frontend/src/app/admin/dashboard/_components/SectionSettings.tsx:836` — thème — les lignes alternées du journal d’audit de l’onglet Sécurité forcent `white` et présentent le même risque en mode sombre.
- [2026-09-25] `backend/src/infrastructure/http/controllers/BabillardController.ts` et `MasterReferentielsController.ts` — architecture hexagonale — accès Prisma direct dans des controllers ; hors périmètre du Bloc 2, à traiter dans un chantier hexagonal.
