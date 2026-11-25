import type { Request, Response, NextFunction } from 'express';
import type { PublierVersionTemplateUseCase } from '@application/schoolSettings/PublierVersionTemplateUseCase';
import type { ProposerReapplicationToutesEcolesUseCase } from '@application/schoolSettings/ProposerReapplicationToutesEcolesUseCase';
import type { AppliquerReapplicationToutesEcolesUseCase } from '@application/schoolSettings/AppliquerReapplicationToutesEcolesUseCase';
import type { SchoolTemplateVersionRepository } from '@domain/ports/repositories/SchoolTemplateVersionRepository';

export class SchoolTemplateAdminController {
  constructor(
    private readonly publierVersionUC: PublierVersionTemplateUseCase,
    private readonly templateVersionRepo: SchoolTemplateVersionRepository,
    private readonly proposerToutes?: ProposerReapplicationToutesEcolesUseCase,
    private readonly appliquerToutes?: AppliquerReapplicationToutesEcolesUseCase,
  ) {}

  // GET /api/v2/master/school-templates/:code/versions
  listerVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = String(req.params.code ?? '');
      if (!code) {
        res.status(400).json({ success: false, message: 'Code template requis.' });
        return;
      }
      const versions = await this.templateVersionRepo.listerVersions(code);
      res.json({ success: true, data: versions });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/master/school-templates/:code/versions
  publierVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = String(req.params.code ?? '');
      const config = req.body?.config as Record<string, unknown> | undefined;
      const master = req.masterUser;

      if (!code) {
        res.status(400).json({ success: false, message: 'Code template requis.' });
        return;
      }
      if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
        res.status(400).json({ success: false, message: 'config est requis et ne peut pas être vide.' });
        return;
      }

      const version = await this.publierVersionUC.execute({
        templateCode: code,
        config,
        demandeurId: master?.id ?? 'unknown',
      });
      res.status(201).json({ success: true, data: version });
    } catch (error) {
      if (error instanceof Error && error.message.includes('hors liste blanche')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/master/school-templates/:code/reapply/propose — lecture seule
  proposerReapplyToutes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = String(req.params.code ?? '');
      if (!code) {
        res.status(400).json({ success: false, message: 'Code template requis.' });
        return;
      }
      if (!this.proposerToutes) {
        res.status(501).json({ success: false, message: 'Ré-application en masse non configurée.' });
        return;
      }
      const resultat = await this.proposerToutes.execute({ templateCode: code });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.erreurReapplication(error, res, next);
    }
  };

  // POST /api/v2/master/school-templates/:code/reapply/apply — écriture, exige confirm: true
  appliquerReapplyToutes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const code = String(req.params.code ?? '');
      const master = req.masterUser;

      if (!code) {
        res.status(400).json({ success: false, message: 'Code template requis.' });
        return;
      }
      if (!this.appliquerToutes) {
        res.status(501).json({ success: false, message: 'Ré-application en masse non configurée.' });
        return;
      }
      if (req.body?.confirm !== true) {
        res.status(400).json({
          success: false,
          message: 'Confirmation explicite requise : envoyer { "confirm": true }.',
        });
        return;
      }

      const resultat = await this.appliquerToutes.execute({
        templateCode: code,
        demandeurId: master?.id ?? 'unknown',
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.erreurReapplication(error, res, next);
    }
  };

  private erreurReapplication(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error && error.message.includes('Aucune version active')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}
