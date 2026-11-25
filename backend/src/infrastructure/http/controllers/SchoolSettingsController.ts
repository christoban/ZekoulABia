import type { Request, Response, NextFunction } from 'express';
import type { ObtenirParametresEcoleUseCase } from '@application/schoolSettings/ObtenirParametresEcoleUseCase';
import type { MettreAJourParametresEcoleUseCase } from '@application/schoolSettings/MettreAJourParametresEcoleUseCase';
import type { ProposerReapplicationTemplateUseCase } from '@application/schoolSettings/ProposerReapplicationTemplateUseCase';
import type { AppliquerReapplicationTemplateUseCase } from '@application/schoolSettings/AppliquerReapplicationTemplateUseCase';

export class SchoolSettingsController {
  constructor(
    private readonly obtenir: ObtenirParametresEcoleUseCase,
    private readonly mettreAJour: MettreAJourParametresEcoleUseCase,
    private readonly proposerReapplication?: ProposerReapplicationTemplateUseCase,
    private readonly appliquerReapplication?: AppliquerReapplicationTemplateUseCase,
  ) {}

  // GET /api/v2/school-settings
  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const settings = await this.obtenir.execute(user.schoolId);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/school-settings
  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.mettreAJour.execute({
        schoolId: user.schoolId,
        demandeurId: user.userId,
        demandeurRole: user.role,
        ...req.body,
      });
      res.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Admin')) {
          res.status(403).json({ success: false, message: error.message });
          return;
        }
        if (
          error.message.includes('invalide') ||
          error.message.includes('entre 0') ||
          error.message.includes('vide') ||
          error.message.includes('uniquement')
        ) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  };

  // POST /api/v2/school-settings/reapply-template/propose — lecture seule, rien ne persiste
  proposeReapply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const templateCode = req.body?.templateCode;
      if (!templateCode) {
        res.status(400).json({ success: false, message: 'templateCode est requis.' });
        return;
      }
      const result = await this.proposerReapplication!.execute({
        schoolId: user.schoolId,
        templateCode,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Aucune version active')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/school-settings/reapply-template/apply — écriture atomique + audit
  applyReapply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const templateCode = req.body?.templateCode;
      if (!templateCode) {
        res.status(400).json({ success: false, message: 'templateCode est requis.' });
        return;
      }
      const result = await this.appliquerReapplication!.execute({
        schoolId: user.schoolId,
        templateCode,
        demandeurId: user.userId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Aucune version active')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };
}
