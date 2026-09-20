import type { UserRole } from '@domain/types/enums';
import type { Request, Response, NextFunction } from 'express';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { CreerAnnonceUseCase } from '@application/announcement/CreerAnnonceUseCase';
import type { ListerAnnoncesUseCase } from '@application/announcement/ListerAnnoncesUseCase';
import type { ModifierAnnonceUseCase } from '@application/announcement/ModifierAnnonceUseCase';
import type { SupprimerAnnonceUseCase } from '@application/announcement/SupprimerAnnonceUseCase';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';

export class AnnouncementController {
  private readonly notificationService: SocketNotificationService;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly creerAnnonce: CreerAnnonceUseCase,
    private readonly listerAnnonces: ListerAnnoncesUseCase,
    private readonly modifierAnnonce: ModifierAnnonceUseCase,
    private readonly supprimerAnnonce: SupprimerAnnonceUseCase,
  ) {
    this.notificationService = new SocketNotificationService();
  }

  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { title, content, targetRoles, isPinned, expiresAt } = req.body as {
        title?: string;
        content?: string;
        targetRoles?: UserRole[];
        isPinned?: boolean;
        expiresAt?: string | null;
      };

      let staffTitle: string | null = null;
      if (user.role?.toUpperCase() === 'STAFF') {
        const employee = await this.userRepository.findEmployeeById(user.userId, user.schoolId);
        staffTitle = employee?.staffProfile?.title ?? null;
      }

      const annonce = await this.creerAnnonce.execute({
        schoolId: user.schoolId,
        authorId: user.userId,
        role: user.role,
        staffTitle,
        permissions: (user as any).permissions ?? [],
        title: title ?? '',
        content: content ?? '',
        targetRoles: Array.isArray(targetRoles) ? targetRoles : [],
        isPinned,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      const rolesCibles = Array.from(new Set((annonce.targetRoles ?? targetRoles ?? []) as UserRole[]));
      const destinataires = rolesCibles.length > 0
        ? await this.userRepository.findActiveByRoles(user.schoolId, rolesCibles)
        : [];

      await Promise.allSettled(
        destinataires.map((destinataire: { id: string }) =>
          this.notificationService.envoyer({
            schoolId: user.schoolId,
            userId: destinataire.id,
            type: 'COMMUNICATION',
            titre: annonce.title,
            corps: annonce.content,
            urgency: 'NORMAL',
            metadata: {
              announcementId: annonce.id,
              authorId: annonce.authorId,
              targetRoles: rolesCibles,
            },
          }),
        ),
      );

      res.status(201).json({ success: true, data: annonce });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const annonces = await this.listerAnnonces.execute({
        schoolId: user.schoolId,
        role: user.role,
      });

      res.json({ success: true, data: annonces });
    } catch (error) {
      next(error);
    }
  };

  modifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { title, content, targetRoles, isPinned, expiresAt } = req.body as {
        title?: string;
        content?: string;
        targetRoles?: UserRole[];
        isPinned?: boolean;
        expiresAt?: string | null;
      };

      const annonce = await this.modifierAnnonce.execute({
        schoolId: user.schoolId,
        announcementId: String(req.params['id']),
        userId: user.userId,
        role: user.role,
        title: title ?? '',
        content: content ?? '',
        targetRoles: Array.isArray(targetRoles) ? targetRoles : [],
        isPinned,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.json({ success: true, data: annonce });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  supprimer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const deleted = await this.supprimerAnnonce.execute({
        schoolId: user.schoolId,
        announcementId: String(req.params['id']),
        userId: user.userId,
        role: user.role,
      });

      res.json({ success: true, data: deleted });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };
}
