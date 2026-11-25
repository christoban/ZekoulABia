import type { Request, Response, NextFunction } from 'express';
import type { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';

/**
 * Préfixe /api/v2/notifications — alimente la cloche IN_APP (voir SocketNotificationService,
 * qui persiste désormais dans la table Notification en plus de l'émission Socket.io live).
 */
export class NotificationController {
  constructor(private readonly notificationService: SocketNotificationService) {}

  // GET /api/v2/notifications?limit=30&page=1&type=ACADEMIC&readAt=true
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const limit = Math.min(Number(req.query['limit']) || 30, 100);
      const page = Math.max(1, Number(req.query['page']) || 1);
      const type = req.query['type'] as string | undefined;
      const readAtParam = req.query['readAt'] as string | undefined;

      const data = await this.notificationService.listerNotifications({
        userId,
        schoolId,
        limit,
        page,
        type,
        readAtParam,
      });

      res.json({ success: true, data });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/:id/read
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = String(req.params['id']);

      const ok = await this.notificationService.marquerLueSiProprietaire(id, userId);
      if (!ok) {
        res.status(404).json({ success: false, message: 'Notification introuvable' });
        return;
      }

      res.json({ success: true });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/read-all
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      await this.notificationService.marquerToutesLues(userId, schoolId);
      res.json({ success: true });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/:id/delivered
  markAsDelivered = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const id = String(req.params['id']);
      const ok = await this.notificationService.marquerDelivree({ notificationId: id, userId, schoolId });
      if (!ok) {
        res.status(404).json({ success: false, message: 'Notification introuvable' });
        return;
      }
      res.json({ success: true });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/:id/confirm
  markAsConfirmed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const id = String(req.params['id']);
      const ok = await this.notificationService.marquerConfirmee({ notificationId: id, userId, schoolId });
      if (!ok) {
        res.status(404).json({ success: false, message: 'Notification introuvable' });
        return;
      }
      res.json({ success: true });
    } catch (err) { next(err); }
  };
}
