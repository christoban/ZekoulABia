import type { UserRole } from '@domain/types/enums';
import type { AnnouncementRepository } from '@domain/ports/repositories/AnnouncementRepository';

export interface ModifierAnnonceCommande {
  schoolId: string;
  announcementId: string;
  userId: string;
  role: string;
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export class ModifierAnnonceUseCase {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(cmd: ModifierAnnonceCommande) {
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
      throw new Error('Seul l\'auteur ou l\'Admin peut modifier une annonce.');
    }

    const title = cmd.title.trim();
    const content = cmd.content.trim();

    if (!title) {
      throw new Error('Le titre de l\'annonce est requis.');
    }
    if (!content) {
      throw new Error('Le contenu de l\'annonce est requis.');
    }
    if (!cmd.targetRoles?.length) {
      throw new Error('Sélectionnez au moins un rôle ciblé.');
    }
    if (cmd.expiresAt && cmd.expiresAt.getTime() <= Date.now()) {
      throw new Error('La date d\'expiration doit être future ou absente.');
    }

    return this.announcementRepository.modifier(annonce.id, {
      title,
      content,
      targetRoles: cmd.targetRoles,
      isPinned: cmd.isPinned ?? false,
      expiresAt: cmd.expiresAt ?? null,
    });
  }
}