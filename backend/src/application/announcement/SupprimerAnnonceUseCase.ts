import type { AnnouncementRepository } from '@domain/ports/repositories/AnnouncementRepository';

export interface SupprimerAnnonceCommande {
  schoolId: string;
  announcementId: string;
  userId: string;
  role: string;
}

export class SupprimerAnnonceUseCase {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(cmd: SupprimerAnnonceCommande) {
    const annonce = await this.announcementRepository.trouverParId(
      cmd.announcementId,
      cmd.schoolId,
    );

    if (!annonce) {
      throw new Error('Annonce introuvable.');
    }

    const estAuteur = annonce.authorId === cmd.userId;
    const estAdmin = cmd.role.toUpperCase() === 'ADMIN';

    if (!estAuteur && !estAdmin) {
      throw new Error('Seul l\'auteur ou l\'Admin peut supprimer une annonce.');
    }

    return this.announcementRepository.supprimer(annonce.id);
  }
}