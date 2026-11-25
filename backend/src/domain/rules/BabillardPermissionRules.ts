/**
 * DOMAIN LAYER — Règles de permissions du Babillard Officiel
 * Centralise les vérifications RBAC par défaut et sur mesure.
 */

import type { UtilisateurContexte } from './BabillardVisibilityRules';

const TITRES_DIRECTION_PEDAGOGIQUE = [
  'censeur',
  'vice-principal',
  'directeur adjoint',
  'directeur des études',
  'deputy head teacher',
];

export function peutPublierBabillard(user: UtilisateurContexte): boolean {
  if (!user) return false;
  const role = user.role?.toUpperCase();
  if (role === 'ADMIN') return true;

  // Permissions explicites
  if (user.permissions?.includes('babillard:publish')) return true;

  // Censeur / Direction pédagogique
  if (role === 'STAFF' && user.titre) {
    const titreNormalise = user.titre.trim().toLowerCase();
    if (TITRES_DIRECTION_PEDAGOGIQUE.some((t) => titreNormalise.includes(t))) {
      return true;
    }
  }

  // Repli par permissions académiques staff existantes (ex: MANAGE_CLASSES + VALIDATE_GRADES)
  if (role === 'STAFF') {
    const perms = user.permissions ?? [];
    if (perms.includes('VALIDATE_GRADES') && perms.includes('MANAGE_CLASSES')) {
      return true;
    }
  }

  return false;
}

export function peutEpinglerBabillard(user: UtilisateurContexte): boolean {
  if (!user) return false;
  if (user.role?.toUpperCase() === 'ADMIN') return true;
  if (user.permissions?.includes('babillard:pin')) return true;
  return peutPublierBabillard(user);
}

export function peutGererToutesPublications(user: UtilisateurContexte): boolean {
  if (!user) return false;
  if (user.role?.toUpperCase() === 'ADMIN') return true;
  return !!user.permissions?.includes('babillard:manage_any');
}

export function peutCiblerTousRoles(user: UtilisateurContexte): boolean {
  if (!user) return false;
  if (user.role?.toUpperCase() === 'ADMIN') return true;
  if (user.permissions?.includes('babillard:target_all')) return true;
  return peutPublierBabillard(user);
}

export function peutModifierPublication(
  user: UtilisateurContexte,
  publicationAuteurId: string
): boolean {
  if (!user) return false;
  if (peutGererToutesPublications(user)) return true;
  return user.userId === publicationAuteurId && peutPublierBabillard(user);
}

export function peutSupprimerPublication(
  user: UtilisateurContexte,
  publicationAuteurId: string
): boolean {
  if (!user) return false;
  if (peutGererToutesPublications(user)) return true;
  return user.userId === publicationAuteurId && peutPublierBabillard(user);
}
