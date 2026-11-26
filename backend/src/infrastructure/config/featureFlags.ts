/**
 * INFRASTRUCTURE LAYER — Feature flags runtime (12-Factor via variables d'environnement).
 * Tous les drapeaux critiques sont désactivés par défaut (false) pour garantir
 * zéro impact sur l'existant tant qu'ils ne sont pas explicitement activés.
 */
import type { Request, Response, NextFunction } from 'express';

export const OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG =
  'ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION';

export const OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV =
  'OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS';

/**
 * Retourne l'ensemble des schoolId pilotes si OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS est renseignée,
 * ou null si la variable est absente/vide (= toutes les écoles autorisées quand le flag global est ON).
 */
export function getOfficialProgrammesPilotSchoolIds(): Set<string> | null {
  const raw = process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV];
  if (!raw) return null;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

/**
 * Active la matérialisation des programmes nationaux vers les écoles (Lots 1–3) :
 * - Désactivé par défaut tant que ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION !== 'true'.
 * - Si OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS est renseignée (liste séparée par virgules),
 *   seules ces écoles ont accès ; les autres se comportent comme flag éteint.
 * - Si OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS est vide/absente, toutes les écoles sont autorisées.
 */
export function isOfficialProgrammesMaterialisationEnabled(schoolId?: string): boolean {
  if (process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] !== 'true') {
    return false;
  }
  const pilotIds = getOfficialProgrammesPilotSchoolIds();
  if (pilotIds === null) {
    return true;
  }
  if (!schoolId || !schoolId.trim()) {
    return false;
  }
  return pilotIds.has(schoolId.trim());
}

export function requireOfficialProgrammesMaterialisation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isOfficialProgrammesMaterialisationEnabled(req.user?.schoolId)) {
    res.status(403).json({
      success: false,
      code: 'FEATURE_DISABLED',
      message: 'Fonctionnalité non activée',
    });
    return;
  }
  next();
}
