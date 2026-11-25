import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import type { MinedubReportRepository } from '@domain/ports/repositories/MinedubReportRepository';
import { GenererRapportSyntheseMinedubUseCase } from '@application/statisticalCampaignMinedub/GenererRapportSyntheseMinedubUseCase';

/**
 * Préfixe /api/v2/statistical-campaign-minedub. Rapport PDF de synthèse MINEDUB (préscolaire/
 * primaire) — voir spec-minedub-interoperabilite.md. Non officiel, pas de blocage strict.
 */
export class StatisticalCampaignMinedubController {
  constructor(
    private readonly _genererRapport: GenererRapportSyntheseMinedubUseCase,
    private readonly minedubReportRepository: MinedubReportRepository,
  ) {}

  // GET /api/v2/statistical-campaign-minedub/supplement
  getSupplement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const supplement = await this.minedubReportRepository.trouverSupplementComplet(schoolId);
      res.json({ success: true, data: supplement });
    } catch (err) { next(err); }
  };

  // PUT /api/v2/statistical-campaign-minedub/supplement
  updateSupplement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const body = req.body as Record<string, unknown>;
      const allowedKeys = ['zoneImplantation', 'ordreEnseignement', 'elevesVulnerablesDetail', 'infrastructuresDetail', 'commoditesDetail', 'manuelsDetail'];
      const data: Record<string, unknown> = {};
      for (const key of allowedKeys) if (key in body) data[key] = body[key];

      const supplement = await this.minedubReportRepository.sauvegarderSupplement(schoolId, data, userId);
      res.json({ success: true, data: supplement });
    } catch (err) { next(err); }
  };

  // POST /api/v2/statistical-campaign-minedub/generer
  genererRapport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const generatedByUserId = req.user!.userId;
      const result = await this._genererRapport.execute({ schoolId, generatedByUserId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/statistical-campaign-minedub/reports
  listReports = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const reports = await this.minedubReportRepository.listerRapports(schoolId);
      res.json({ success: true, data: reports });
    } catch (err) { next(err); }
  };

  // GET /api/v2/statistical-campaign-minedub/reports/:id/download
  downloadReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const id = String(req.params['id']);
      const report = await this.minedubReportRepository.trouverRapportParId(id);
      if (!report || report.schoolId !== schoolId) {
        res.status(404).json({ success: false, message: 'Rapport introuvable' });
        return;
      }
      if (!fs.existsSync(report.filePath)) {
        res.status(404).json({ success: false, message: 'Fichier introuvable — régénérez le rapport' });
        return;
      }
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(report.filePath)}"`);
      res.setHeader('Content-Type', 'application/pdf');
      fs.createReadStream(report.filePath).pipe(res);
    } catch (err) { next(err); }
  };
}
