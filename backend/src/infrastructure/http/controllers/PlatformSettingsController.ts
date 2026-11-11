import type { NextFunction, Request, Response } from 'express';
import type { GetPlatformSettingsUseCase } from '@application/masterAdmin/GetPlatformSettingsUseCase';
import type { UpdatePlatformSettingsUseCase } from '@application/masterAdmin/UpdatePlatformSettingsUseCase';
import type { ListerMessagesSupprimesUseCase } from '@application/masterAdmin/ListerMessagesSupprimesUseCase';
import {
  estSuperAdminMaster,
  verifierAccesGestionEcoleMaster,
} from '@application/masterAdmin/masterSchoolAccess';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';

export class PlatformSettingsController {
  constructor(
    private readonly obtenir: GetPlatformSettingsUseCase,
    private readonly mettreAJour: UpdatePlatformSettingsUseCase,
    private readonly listerMessagesSupprimesUseCase: ListerMessagesSupprimesUseCase,
    private readonly queryRepo?: MasterAdminQueryRepository,
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

      const master = req.masterUser;

      // 1. Le Mode Test Global Plateforme est la prérogative exclusive du super_admin (Fondateur)
      if (!schoolId && !estSuperAdminMaster(master)) {
        res.status(403).json({
          success: false,
          message: 'Seul le super administrateur fondateur peut modifier le mode test global de la plateforme',
        });
        return;
      }

      // 2. Le Mode Test par établissement est autorisé aux autres rôles Master UNIQUEMENT sur leurs propres écoles
      if (schoolId && !estSuperAdminMaster(master)) {
        if (!this.queryRepo) {
          res.status(403).json({ success: false, message: 'Vérification de propriété établissement indisponible' });
          return;
        }
        const check = await verifierAccesGestionEcoleMaster(this.queryRepo, master, schoolId);
        if (check.introuvable) {
          res.status(404).json({ success: false, message: 'École introuvable' });
          return;
        }
        if (!check.autorise) {
          res.status(403).json({
            success: false,
            message: 'Vous ne pouvez activer ou désactiver le mode test que sur les établissements que vous avez créés ou qui vous sont assignés',
          });
          return;
        }
      }

      const data = await this.mettreAJour.execute({
        outboundMessagingEnabled: value,
        schoolId,
        masterUserId: master!.id,
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

      const master = req.masterUser;
      if (!estSuperAdminMaster(master)) {
        if (!schoolId || !this.queryRepo) {
          res.json({ success: true, data: [] });
          return;
        }
        const check = await verifierAccesGestionEcoleMaster(this.queryRepo, master, schoolId);
        if (!check.autorise) {
          res.status(403).json({
            success: false,
            message: 'Vous ne pouvez consulter les messages supprimés que pour vos propres établissements',
          });
          return;
        }
      }

      const data = await this.listerMessagesSupprimesUseCase.execute(limite, schoolId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
