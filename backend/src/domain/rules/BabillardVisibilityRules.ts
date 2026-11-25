/**
 * DOMAIN LAYER — Règle de vue unique pour le Babillard Officiel
 * Source unique de vérité pour la visibilité d'une publication.
 * Utilisée partout : listes, détail, compteurs, notifications, téléchargement PJ.
 */

import type { Publication } from '../entities/Publication';

export interface UtilisateurContexte {
  userId: string;
  role: string;               // 'ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'
  schoolId: string;
  permissions?: string[];
  titre?: string | null;      // 'Censeur', 'Surveillant Général', etc.
  classeIds?: string[];       // Classes de l'élève ou classes des enfants du parent
  niveauIds?: string[];       // Niveaux correspondants
  enseigneDansClasseIds?: string[]; // Classes où l'enseignant intervient
}

export interface OptionsVisibilite {
  inclureArchives?: boolean;
  maintenant?: Date;
}

/**
 * Fonction unique déterminant si un utilisateur a le droit de voir une publication.
 */
export function peutVoir(
  user: UtilisateurContexte,
  publication: Publication,
  options: OptionsVisibilite = {}
): boolean {
  const maintenant = options.maintenant ?? new Date();

  // 1. Même tenant (isolation multi-tenant obligatoire)
  if (user.schoolId !== publication.tenantId) {
    return false;
  }

  // Si supprimé logiquement, invisible pour tous sauf audit/admin système
  if (publication.deletedAt) {
    return false;
  }

  const estAuteur = user.userId === publication.auteurId;
  const aManageAny = user.role.toUpperCase() === 'ADMIN' || (user.permissions ?? []).includes('babillard:manage_any');

  // L'auteur et l'administrateur ont toujours pleine visibilité sur leurs brouillons / programmations
  if (estAuteur || aManageAny) {
    return true;
  }

  // 2. Statut
  if (publication.statut === 'BROUILLON' || publication.statut === 'EN_ATTENTE') {
    return false;
  }

  // Publication programmée : visible uniquement si la date programmée est arrivée
  if (publication.statut === 'PROGRAMMEE') {
    if (!publication.programmeeLe || maintenant < publication.programmeeLe) {
      return false;
    }
  }

  const estExpiree = publication.estExpiree(maintenant);
  const estArchivee = publication.statut === 'ARCHIVEE' || estExpiree;

  // Si archivée ou expirée, visible uniquement si l'appelant demande les archives
  if (estArchivee && !options.inclureArchives) {
    return false;
  }

  // 3. Ciblage par rôles
  const roleNormalise = user.role.toUpperCase();
  const audienceRoles = (publication.audience.roles ?? []).map((r) => r.toUpperCase());
  if (!audienceRoles.includes(roleNormalise)) {
    return false;
  }

  // 4. Ciblage par classes
  const classesCiblees = publication.audience.classeIds ?? [];
  if (classesCiblees.length > 0) {
    if (roleNormalise === 'STUDENT') {
      const classesEleve = user.classeIds ?? [];
      const matchClasse = classesEleve.some((c) => classesCiblees.includes(c));
      if (!matchClasse) return false;
    } else if (roleNormalise === 'PARENT') {
      const classesEnfants = user.classeIds ?? [];
      const matchClasse = classesEnfants.some((c) => classesCiblees.includes(c));
      if (!matchClasse) return false;
    } else if (roleNormalise === 'TEACHER') {
      // Si on dispose des classes où le prof enseigne, filtrer, sinon laisser visible
      if (user.enseigneDansClasseIds && user.enseigneDansClasseIds.length > 0) {
        const matchProf = user.enseigneDansClasseIds.some((c) => classesCiblees.includes(c));
        if (!matchProf) return false;
      }
    }
    // ADMIN et STAFF voient sans restriction de classe
  }

  // 5. Ciblage par niveaux (optionnel)
  const niveauxCibles = publication.audience.niveauIds ?? [];
  if (niveauxCibles.length > 0) {
    if (roleNormalise === 'STUDENT' || roleNormalise === 'PARENT') {
      const niveauxUser = user.niveauIds ?? [];
      const matchNiveau = niveauxUser.some((n) => niveauxCibles.includes(n));
      if (!matchNiveau) return false;
    }
  }

  return true;
}
