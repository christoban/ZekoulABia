import { z } from 'zod';

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .refine(
    (v) => v.length === 0 || /^https?:\/\/\S+$/i.test(v),
    { message: 'sourceUrl doit être une URL http(s) valide' },
  )
  .nullable()
  .optional();

/**
 * Un élément de `chapitres` (1 leçon pour les imports MINESEC, ou 1 chapitre plat rétrocompatible).
 * - `leconNumero` est NULLABLE et NON UNIQUE (ne jamais l'utiliser dans une clé naturelle).
 * - `volumeHeuresPrevu` est optionnel (la source nationale ne fournit pas toujours de durée).
 */
export const chapitreImportSchema = z.object({
  ordre: z.number().int().min(0).optional(),
  titre: z.string().trim().min(1, 'Le titre de la leçon/chapitre est requis'),
  volumeHeuresPrevu: z.number().finite().min(0).nullable().optional(),
  sequenceCibleFin: z.number().int().min(1).nullable().optional(),
  moduleOrdre: z.number().int().min(0).nullable().optional(),
  moduleTitre: z.string().trim().nullable().optional(),
  titreModuleParasite: z.boolean().optional(),
  leconNumero: z.union([z.number().int(), z.string().trim()]).nullable().optional(),
  numeroAffiche: z.string().trim().nullable().optional(),
  positionDansModule: z.number().int().min(0).nullable().optional(),
  positionSource: z.number().int().min(0).nullable().optional(),
  sourceUrl: optionalHttpUrlSchema,
  exclure: z.boolean().optional().default(false),
});

export const progressionImportItemSchema = z.object({
  templateCode: z.string().trim().min(1).default('__ALL__'),
  level: z.string().trim().min(1, 'level est requis'),
  filiere: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => v ?? ''),
  subjectName: z.string().trim().min(1, 'subjectName est requis'),
  subjectNameSource: z.string().trim().nullable().optional(),
  titre: z.string().trim().min(1, 'titre est requis'),
  source: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional().default(true),
  chapitres: z.array(chapitreImportSchema).min(1, 'Au moins un chapitre/leçon est requis'),
});

export const proposeProgressionsImportSchema = z.object({
  source: z.string().trim().min(1).optional().default('minesec-distance-learning'),
  level: z.string().trim().min(1).optional(),
  items: z.array(progressionImportItemSchema).min(1, 'Le tableau items ne peut pas être vide'),
});

export const applyProgressionsImportSchema = proposeProgressionsImportSchema.extend({
  confirmOverwriteManualIds: z.array(z.string().trim().min(1)).optional().default([]),
  skipManuallyEdited: z.boolean().optional().default(false),
});

export type ProposeProgressionsImportInput = z.infer<typeof proposeProgressionsImportSchema>;
export type ApplyProgressionsImportInput = z.infer<typeof applyProgressionsImportSchema>;

