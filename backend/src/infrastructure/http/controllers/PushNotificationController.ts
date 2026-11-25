import type { Request, Response, NextFunction } from 'express';
import type { SouscrirePushUseCase } from '@application/pushNotification/SouscrirePushUseCase';
import type { DesinscrirePushUseCase } from '@application/pushNotification/DesinscrirePushUseCase';
import { getVapidPublicKey } from '../../services/notification/WebPushClient.ts';

export class PushNotificationController {
  constructor(
    private readonly souscrire: SouscrirePushUseCase,
    private readonly desinscrire: DesinscrirePushUseCase,
  ) {}

  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { endpoint, p256dh, auth, userAgent } = req.body;
      if (!endpoint || !p256dh || !auth) {
        res.status(400).json({ success: false, message: 'endpoint, p256dh et auth sont requis' });
        return;
      }
      const resultat = await this.souscrire.execute({
        userId: req.user!.userId,
        endpoint,
        p256dh,
        auth,
        userAgent,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      next(error);
    }
  };

  unsubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        res.status(400).json({ success: false, message: 'endpoint est requis' });
        return;
      }
      await this.desinscrire.execute({ userId: req.user!.userId, endpoint });
      res.json({ success: true, message: 'Désabonnement réussi' });
    } catch (error) {
      next(error);
    }
  };

  vapidPublicKey = (_req: Request, res: Response): void => {
    res.json({ success: true, data: { publicKey: getVapidPublicKey() } });
  };
}
