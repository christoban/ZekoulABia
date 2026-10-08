import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import type { StatisticalCampaignRepository } from '@domain/ports/repositories/StatisticalCampaignRepository';
import { VerifierCompletudeSupplementUseCase } from '@application/statisticalCampaign/VerifierCompletudeSupplementUseCase';
import { GenererDeclarationStatistiqueMinesecUseCase } from '@application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase';
import { LibreOfficeUnavailableError, LibreOfficeConversionError } from '@application/statisticalCampaign/xlsEngine';
import { SPECIALITES_TECHNIQUES_MINESEC } from '@application/statisticalCampaign/minesecTechnicalCatalog';
import { getEstpAnneesEtude } from '@application/statisticalCampaign/minesecEstpGridMap';
import { INFRA_ROWS, COMMODITES_ROWS, SUBSYSTEM_LABELS, getRelevantSubsystems, INFRA_BREAKDOWN_KEYS } from '@application/statisticalCampaign/minesecFixedFieldMap';

/**
 * Préfixe /api/v2/statistical-campaign. Génération du questionnaire statistique officiel
 * MINESEC (voir GenererDeclarationStatistiqueMinesecUseCase pour le détail du pipeline).
 */
export class StatisticalCampaignController {
  constructor(
    private readonly _verifierCompletude: VerifierCompletudeSupplementUseCase,
    private readonly _genererDeclaration: GenererDeclarationStatistiqueMinesecUseCase,
    private readonly _repo: StatisticalCampaignRepository,
  ) {}

  // GET /api/v2/statistical-campaign/supplement
  getSupplement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const supplement = await this._repo.trouverSupplement(schoolId);
      res.json({ success: true, data: supplement });
    } catch (err) { next(err); }
  };

  // PUT /api/v2/statistical-campaign/supplement
  updateSupplement = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;
      const body = req.body as Record<string, unknown>;
      const allowedKeys = [
        'hasTitreFoncier', 'siteProvisoire', 'distanceEtablissementProchePublic', 'superficieTerrainM2',
        'superficieExtensionM2', 'natureVoiesAcces', 'nombreCycles', 'hasInternat', 'placesInternatFilles', 'placesInternatGarcons',
        'historiqueTransformations', 'ecolesPrimairesProximite', 'posteComptable', 'infrastructuresDetail',
        'historiqueBip', 'effectifsTechniquesDetail', 'ateliersDetail',
      ];
      const data: Record<string, unknown> = {};
      for (const key of allowedKeys) {
        if (key in body) data[key] = body[key];
      }

      const supplement = await this._repo.sauvegarderSupplement(schoolId, data, userId);
      res.json({ success: true, data: supplement });
    } catch (err) { next(err); }
  };

  // GET /api/v2/statistical-campaign/completude
  getCompletude = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const result = await this._verifierCompletude.execute({ schoolId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/statistical-campaign/specialites-techniques
  getSpecialitesTechniques = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: SPECIALITES_TECHNIQUES_MINESEC });
    } catch (err) { next(err); }
  };

  // GET /api/v2/statistical-campaign/meta — référentiels nécessaires au formulaire complémentaire
  getMeta = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await this._repo.trouverEcoleMeta(schoolId);
      const subsystems = school ? getRelevantSubsystems(school) : ['GEN_FR'];
      res.json({
        success: true,
        data: {
          infraRows: INFRA_ROWS,
          infraBreakdownKeys: INFRA_BREAKDOWN_KEYS,
          commoditesRows: COMMODITES_ROWS,
          subsystems: subsystems.map((s) => ({ code: s, label: SUBSYSTEM_LABELS[s] })),
          specialitesTechniques: SPECIALITES_TECHNIQUES_MINESEC,
          anneesEtudeEstp: getEstpAnneesEtude(),
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/statistical-campaign/generer
  genererDeclaration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const generatedByUserId = req.user!.userId;
      const result = await this._genererDeclaration.execute({ schoolId, generatedByUserId });
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err instanceof LibreOfficeUnavailableError || err instanceof LibreOfficeConversionError) {
        res.status(503).json({
          success: false,
          message: 'Le service de génération est temporairement indisponible, réessayez ou contactez le support.',
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: err?.message || 'Erreur lors de la génération de la déclaration statistique',
      });
    }
  };

  // GET /api/v2/statistical-campaign/submissions/:id/download
  downloadSubmission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const id = String(req.params['id']);
      const submission = await this._repo.trouverSubmissionParId(id);
      if (!submission || submission.schoolId !== schoolId || !submission.filePath) {
        res.status(404).json({ success: false, message: 'Déclaration introuvable' });
        return;
      }
      if (!fs.existsSync(submission.filePath)) {
        res.status(404).json({ success: false, message: 'Fichier généré introuvable — régénérez la déclaration' });
        return;
      }
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(submission.filePath)}"`);
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      fs.createReadStream(submission.filePath).pipe(res);
    } catch (err) { next(err); }
  };

  // GET /api/v2/statistical-campaign/submissions
  listSubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const submissions = await this._repo.listerDernieresSubmissions(schoolId);
      res.json({ success: true, data: submissions });
    } catch (err) { next(err); }
  };
}
