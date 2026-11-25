import type { AnnouncementRepository } from '@domain/ports/repositories/AnnouncementRepository';

const DELAI_GRACE_JOURS = 7;

export class PurgerAnnoncesExpireesUseCase {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(): Promise<{ count: number }> {
    const seuil = new Date(Date.now() - DELAI_GRACE_JOURS * 24 * 60 * 60 * 1000);

    return this.announcementRepository.purgerExpirees(seuil);
  }
}