/**
 * INFRASTRUCTURE LAYER — Filtre automatique deletedAt (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md §1.2)
 *
 * Le filtre `deletedAt: null` sur les lectures ne doit jamais dépendre de la discipline de chaque
 * développeur à chaque requête (des dizaines de `findMany`/`findUnique` existent déjà sur ces
 * modèles à travers tout le backend) — cette extension Prisma l'impose au niveau du client
 * lui-même, une seule fois, pour toute lecture standard sur les modèles soft-deletables.
 *
 * Échappatoire explicite : un appelant qui a besoin de voir TOUS les statuts (corbeille, job de
 * purge, restauration) passe lui-même `deletedAt` dans son `where` (ex. `{ not: null }` pour ne
 * lister que les éléments à la corbeille, ou `undefined` pour ignorer complètement le filtre) —
 * dès que la clé `deletedAt` est présente dans le `where` de l'appelant, cette extension n'y
 * touche pas. C'est la seule façon prévue de contourner le filtre — jamais une deuxième instance
 * de client non extensionnée.
 */
import { Prisma } from '@prisma/client';

const MODELES_AVEC_SOFT_DELETE = new Set(['User', 'Class', 'Subject', 'Room']);

function injecterFiltre<T>(model: string, args: T): T {
  if (!MODELES_AVEC_SOFT_DELETE.has(model)) return args;
  const where = (args as { where?: Record<string, unknown> })?.where ?? {};
  if ('deletedAt' in where) return args;
  return { ...args, where: { ...where, deletedAt: null } } as T;
}

export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete-filter',
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        return query(injecterFiltre(model, args));
      },
      async findFirst({ model, args, query }) {
        return query(injecterFiltre(model, args));
      },
      async findFirstOrThrow({ model, args, query }) {
        return query(injecterFiltre(model, args));
      },
      async findUnique({ model, args, query }) {
        return query(injecterFiltre(model, args));
      },
      async findUniqueOrThrow({ model, args, query }) {
        return query(injecterFiltre(model, args));
      },
      async count({ model, args, query }) {
        return query(injecterFiltre(model, args));
      },
    },
  },
});
