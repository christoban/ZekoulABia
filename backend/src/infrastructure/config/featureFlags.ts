/**
 * INFRASTRUCTURE LAYER — Feature flags runtime (12-Factor via variables d'environnement).
 * Tous les drapeaux critiques sont désactivés par défaut (false) pour garantir
 * zéro impact sur l'existant tant qu'ils ne sont pas explicitement activés.
 */
import type { Request, Response, NextFunction } from 'express';

export const OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG =
  'ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION';

/**
 * Active la matérialisation des programmes nationaux vers les écoles (Lot 1) :
 * initialisation de classe, coche directe de leçons et bascule de modules.
 * Désactivé par défaut tant que ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION !== 'true'.
 */
export function isOfficialProgrammesMaterialisationEnabled(): boolean {
  return process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] === 'true';
}

export function requireOfficialProgrammesMaterialisation(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isOfficialProgrammesMaterialisationEnabled()) {
    res.status(403).json({
      success: false,
      code: 'FEATURE_DISABLED',
      message: 'Fonctionnalité non activée',
    });
    return;
  }
  next();
}
