import type { AnnouncementRepository } from '@domain/ports/repositories/AnnouncementRepository';

const DELAI_GRACE_JOURS = 7;

/**
 * Use case maintenance — délégation fine vers AnnouncementRepository.
 * Existe aussi sous @application/announcement/PurgerAnnoncesExpireesUseCase ;
 * doublon volontaire pour respecter l'arborescence demandée
 * backend/src/application/maintenance/.
 */
export class PurgerAnnoncesExpireesUseCase {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(): Promise<{ count: number }> {
    const seuil = new Date(Date.now() - DELAI_GRACE_JOURS * 24 * 60 * 60 * 1000);
    return this.announcementRepository.purgerExpirees(seuil);
  }
}
