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

  getPublicStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.obtenir.execute();
      const disabledSchoolIds = data.disabledSchoolIds ?? [];
      const schoolId = typeof req.query.schoolId === 'string' && req.query.schoolId.trim().length > 0
        ? req.query.schoolId.trim()
        : null;

      const outboundMessagingEnabled = schoolId
        ? data.outboundMessagingEnabled && !disabledSchoolIds.includes(schoolId)
        : data.outboundMessagingEnabled;

      res.json({
        outboundMessagingEnabled,
        globalOutboundMessagingEnabled: data.outboundMessagingEnabled,
        disabledSchoolCount: disabledSchoolIds.length,
      });
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

      const schoolId = typeof req.body?.schoolId === 'string' && req.body.schoolId.trim().length > 0
        ? req.body.schoolId.trim()
        : null;

      const data = await this.mettreAJour.execute({
        outboundMessagingEnabled: value,
        schoolId,
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
      const schoolId = typeof req.query.schoolId === 'string' && req.query.schoolId.trim().length > 0
        ? req.query.schoolId.trim()
        : null;
      const data = await this.listerMessagesSupprimesUseCase.execute(limite, schoolId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
