/**
 * APPLICATION LAYER — ListerPublicationsUseCase
 */

import type { Publication } from '../../domain/entities/Publication';
import type { PublicationFiltres, PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import { peutVoir, type UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export interface PublicationItemDTO {
  publication: Publication;
  isRead: boolean;
}

export interface PublicationCountsDTO {
  tous: number;
  une: number;
  pourMoi: number;
  nonLus: number;
  archives: number;
}

export class ListerPublicationsUseCase {
  constructor(private readonly repo: PublicationRepository) {}

  async execute(
    user: UtilisateurContexte,
    filtres: PublicationFiltres = {}
  ): Promise<{ items: PublicationItemDTO[]; counts: PublicationCountsDTO; curseurSuivant?: string }> {
    const roleNormalise = user.role.toUpperCase();

    // 1. Récupération des publications actives (hors archives)
    const resultatActifs = await this.repo.lister(user.schoolId, {
      ...filtres,
      filtre: 'tous',
      limite: 100,
    });

    const visiblesActifs = resultatActifs.publications.filter((p) =>
      peutVoir(user, p, { inclureArchives: false })
    );

    // Récupération des lectures
    const idsActifs = visiblesActifs.map((p) => p.id);
    const setIdsLus = await this.repo.getIdsLusParUtilisateur(user.userId, idsActifs);

    const itemsActifs: PublicationItemDTO[] = visiblesActifs.map((p) => {
      const estAuteur = p.auteurId === user.userId;
      const isRead = estAuteur || setIdsLus.has(p.id);
      return { publication: p, isRead };
    });

    // 2. Récupération des archives pour un décompte exact
    const resultatArchives = await this.repo.lister(user.schoolId, {
      ...filtres,
      filtre: 'archives',
      limite: 100,
    });

    const visiblesArchives = resultatArchives.publications.filter((p) =>
      peutVoir(user, p, { inclureArchives: true })
    );

    const idsArchives = visiblesArchives.map((p) => p.id);
    const setIdsArchivesLus = await this.repo.getIdsLusParUtilisateur(user.userId, idsArchives);
    const itemsArchives: PublicationItemDTO[] = visiblesArchives.map((p) => {
      const estAuteur = p.auteurId === user.userId;
      const isRead = estAuteur || setIdsArchivesLus.has(p.id);
      return { publication: p, isRead };
    });

    // 3. Calculs des ensembles filtrés pour cohérence stricte 1:1 entre compteur et affichage
    const itemsUne = itemsActifs.filter((it) => it.publication.epinglee);
    const itemsNonLus = itemsActifs.filter((it) => !it.isRead);
    const itemsPourMoi = itemsActifs.filter((it) => {
      if (it.publication.auteurId === user.userId) return true;
      const targetRoles = (it.publication.audience.roles ?? []).map((r) => r.toUpperCase());
      const targetClasses = it.publication.audience.classeIds ?? [];
      if (targetClasses.length > 0) {
        const userClasses = user.classeIds ?? [];
        return userClasses.some((c) => targetClasses.includes(c));
      }
      return targetRoles.includes(roleNormalise);
    });

    const counts: PublicationCountsDTO = {
      tous: itemsActifs.length,
      une: itemsUne.length,
      pourMoi: itemsPourMoi.length,
      nonLus: itemsNonLus.length,
      archives: itemsArchives.length,
    };

    // 4. Sélection de la liste selon l'onglet demandé
    let itemsToReturn: PublicationItemDTO[] = itemsActifs;
    const tabDemandee = (filtres.filtre as string)?.toLowerCase();

    if (tabDemandee === 'une' || tabDemandee === 'pinned') {
      itemsToReturn = itemsUne;
    } else if (tabDemandee === 'nonlus' || tabDemandee === 'unread') {
      itemsToReturn = itemsNonLus;
    } else if (tabDemandee === 'pourmoi' || tabDemandee === 'for_me') {
      itemsToReturn = itemsPourMoi;
    } else if (tabDemandee === 'archives') {
      itemsToReturn = itemsArchives;
    } else {
      itemsToReturn = itemsActifs;
    }

    return {
      items: itemsToReturn,
      counts,
      curseurSuivant: undefined,
    };
  }
}
