import type { NextFunction, Request, Response } from 'express';
import {
  ImportProgressionsConflictError,
  ImportProgressionsValidationError,
  SOURCE_IMPORT_OFFICIEL,
  type AppliquerImportProgressionsCommande,
  type ImporterProgressionsOfficiellesUseCase,
  type ProposerImportProgressionsCommande,
} from '@application/masterAdmin/progressions';
import {
  applyProgressionsImportSchema,
  proposeProgressionsImportSchema,
  type ProposeProgressionsImportInput,
} from '../validation/officialProgressionImport.schema';
import { logMasterAction } from '../../services/audit/MasterAuthAuditService.ts';

function toProposerCommande(data: ProposeProgressionsImportInput): ProposerImportProgressionsCommande {
  return {
    source: SOURCE_IMPORT_OFFICIEL,
    level: data.level,
    items: (data.items ?? []).map((item) => ({
      templateCode: item.templateCode ?? '__ALL__',
      level: item.level ?? '',
      filiere: item.filiere ?? '',
      subjectName: item.subjectName ?? '',
      subjectNameSource: item.subjectNameSource ?? null,
      titre: item.titre ?? '',
      source: SOURCE_IMPORT_OFFICIEL,
      active: item.active ?? true,
      chapitres: (item.chapitres ?? []).map((ch) => ({
        ordre: ch.ordre,
        titre: ch.titre ?? '',
        volumeHeuresPrevu: ch.volumeHeuresPrevu,
        sequenceCibleFin: ch.sequenceCibleFin,
        moduleOrdre: ch.moduleOrdre,
        moduleTitre: ch.moduleTitre,
        titreModuleParasite: ch.titreModuleParasite,
        leconNumero: ch.leconNumero,
        numeroAffiche: ch.numeroAffiche,
        positionDansModule: ch.positionDansModule,
        positionSource: ch.positionSource,
        sourceUrl: ch.sourceUrl,
        exclure: ch.exclure ?? false,
      })),
    })),
  };
}

export class MasterProgressionsImportController {
  constructor(
    private readonly importUseCase: ImporterProgressionsOfficiellesUseCase,
    private readonly auditLogger: typeof logMasterAction = logMasterAction,
  ) {}

  proposeImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = proposeProgressionsImportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Payload d\'import JSON invalide.',
          errors: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }

      const master = req.masterUser;
      const result = await this.importUseCase.proposer(toProposerCommande(parsed.data));

      void this.auditLogger({
        req,
        masterUserId: master?.id,
        action: 'referentiel_progressions_import_propose',
        targetId: result.level ?? undefined,
        description: `Dry-run import progressions (${result.level ?? 'inconnu'}, source=${result.source}) : ${result.resume.aCreer} création(s), ${result.resume.aMettreAJour} MAJ, ${result.resume.conflitsManuels} conflit(s) manuel(s), ${result.resume.rejetes} rejet(s)`,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ImportProgressionsValidationError) {
        res.status(400).json({
          success: false,
          message: error.message,
          rejets: error.rejets,
        });
        return;
      }
      next(error);
    }
  };

  applyImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = applyProgressionsImportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Payload d\'application d\'import JSON invalide.',
          errors: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }

      const master = req.masterUser;
      const commande: AppliquerImportProgressionsCommande = {
        ...toProposerCommande(parsed.data),
        confirmOverwriteManualIds: parsed.data.confirmOverwriteManualIds ?? [],
        skipManuallyEdited: parsed.data.skipManuallyEdited ?? false,
      };
      const result = await this.importUseCase.appliquer(commande);

      void this.auditLogger({
        req,
        masterUserId: master?.id,
        action: 'referentiel_progressions_import_apply',
        targetId: result.level,
        description: `Import progressions appliqué (${result.level}, source=${result.source}) : ${result.createdCount} créée(s), ${result.updatedCount} MAJ, ${result.overwrittenManualCount} manuelle(s) écrasée(s), ${result.unchangedCount} inchangée(s), ${result.skippedManualCount} ignorée(s)`,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ImportProgressionsValidationError) {
        res.status(400).json({
          success: false,
          message: error.message,
          rejets: error.rejets,
        });
        return;
      }
      if (error instanceof ImportProgressionsConflictError) {
        res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          conflitsManuels: error.conflitsManuels,
        });
        return;
      }
      next(error);
    }
  };
}

