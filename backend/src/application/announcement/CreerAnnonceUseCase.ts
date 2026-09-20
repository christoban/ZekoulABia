import type { UserRole } from '@domain/types/enums';
import type { AnnouncementRepository } from '@domain/ports/repositories/AnnouncementRepository';
import { peutPublierBabillard } from '@domain/rules/BabillardPermissionRules';

export interface CreerAnnonceCommande {
  schoolId: string;
  authorId: string;
  role: string;
  staffTitle?: string | null;
  permissions?: string[];
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export class CreerAnnonceUseCase {
  constructor(private readonly announcementRepository: AnnouncementRepository) {}

  async execute(cmd: CreerAnnonceCommande) {
    const userContexte = {
      userId: cmd.authorId,
      schoolId: cmd.schoolId,
      role: cmd.role,
      titre: cmd.staffTitle ?? null,
      permissions: cmd.permissions ?? [],
      classeIds: [],
    };

    if (!peutPublierBabillard(userContexte)) {
      throw new Error('Seuls la Direction et le Censeur peuvent publier sur le babillard.');
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

    return this.announcementRepository.creer({
      schoolId: cmd.schoolId,
      authorId: cmd.authorId,
      title,
      content,
      targetRoles: cmd.targetRoles,
      isPinned: cmd.isPinned ?? false,
      expiresAt: cmd.expiresAt ?? null,
    });
  }
}