import type { NextFunction, Request, Response } from 'express';
import type { GetPlatformSettingsUseCase } from '@application/masterAdmin/GetPlatformSettingsUseCase';
import type { UpdatePlatformSettingsUseCase } from '@application/masterAdmin/UpdatePlatformSettingsUseCase';
import type { ListerMessagesSupprimesUseCase } from '@application/masterAdmin/ListerMessagesSupprimesUseCase';

export class PlatformSettingsController {
  constructor(
    private readonly obtenir: GetPlatformSettingsUseCase,
    private readonly mettreAJour: UpdatePlatformSettingsUseCase,
    private readonly listerMessagesSupprimesUseCase: ListerMessagesSupprimesUseCase,
  ) {}

  get = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.obtenir.execute();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPublicStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.obtenir.execute();
      res.json({ outboundMessagingEnabled: data.outboundMessagingEnabled });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const value = req.body?.outboundMessagingEnabled;
      if (typeof value !== 'boolean') {
        res.status(400).json({ success: false, message: 'outboundMessagingEnabled doit être un booléen' });
        return;
      }

      const data = await this.mettreAJour.execute({
        outboundMessagingEnabled: value,
        masterUserId: req.masterUser!.id,
        ipAddress: req.ip,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listerMessagesSupprimes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limite = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      const data = await this.listerMessagesSupprimesUseCase.execute(limite);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
