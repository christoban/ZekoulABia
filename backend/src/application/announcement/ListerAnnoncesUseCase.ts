import type { AnnouncementRepository } from '@domain/ports/repositories/AnnouncementRepository';

export interface ListerAnnoncesCommande {
  schoolId: string;
  role: string;
}

export class ListerAnnoncesUseCase {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(cmd: ListerAnnoncesCommande) {
    return this.announcementRepository.lister(cmd.schoolId, cmd.role.toUpperCase());
  }
}