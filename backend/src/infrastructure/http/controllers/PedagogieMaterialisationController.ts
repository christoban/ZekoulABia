/**
 * INFRASTRUCTURE LAYER — Controller HTTP mince pour la matérialisation des programmes
 * nationaux (Lot 1) : statut feature flag, initialisation propose/apply, coche directe
 * des leçons et activation/désactivation de modules.
 */
import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { OptionClassique } from '@domain/rules/officialProgressionResolution';
import type { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import type { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import type { BasculerAvancementChapitreUseCase } from '@application/pedagogie/BasculerAvancementChapitreUseCase';
import type { BasculerModuleActifUseCase } from '@application/pedagogie/BasculerModuleActifUseCase';
import {
  PedagogieForbiddenError,
  PedagogieNotFoundError,
  PedagogieValidationError,
} from '@application/pedagogie/errors';
import { isOfficialProgrammesMaterialisationEnabled } from '@infrastructure/config/featureFlags';

function extraireOptionsClassiques(raw: unknown): Record<string, OptionClassique> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, OptionClassique> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val === 'Latin' || val === 'Grec') {
      result[key] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export class PedagogieMaterialisationController {
  constructor(
    private readonly proposerInit: ProposerInitialisationProgrammesClasseUseCase,
    private readonly appliquerInit: AppliquerInitialisationProgrammesClasseUseCase,
    private readonly basculerAvancement: BasculerAvancementChapitreUseCase,
    private readonly basculerModule: BasculerModuleActifUseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  getStatus = (req: Request, res: Response): void => {
    res.json({
      success: true,
      data: {
        enabled: isOfficialProgrammesMaterialisationEnabled(req.user?.schoolId),
      },
    });
  };

  proposerInitialisationClasse = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const classId = String(req.params.classId ?? '');
      const body = (req.body ?? {}) as {
        academicYearId?: string;
        optionsClassiques?: unknown;
      };
      const data = await this.proposerInit.execute({
        schoolId: user.schoolId,
        classId,
        academicYearId: body.academicYearId,
        optionsClassiques: extraireOptionsClassiques(body.optionsClassiques),
      });
      res.json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  appliquerInitialisationClasse = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const classId = String(req.params.classId ?? '');
      const body = (req.body ?? {}) as {
        academicYearId?: string;
        optionsClassiques?: unknown;
      };
      const data = await this.appliquerInit.execute({
        schoolId: user.schoolId,
        classId,
        academicYearId: body.academicYearId,
        optionsClassiques: extraireOptionsClassiques(body.optionsClassiques),
      });
      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'initialiser_programmes_classe',
        targetType: 'Class',
        targetId: classId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: {
          totalCrees: data.totalCrees,
          totalLeconsCreees: data.totalLeconsCreees,
          ignores: data.ignores.length,
        },
      });
      res.status(201).json({ success: true, data });
    } catch (e) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId,
        actorRole: user?.role,
        schoolId: user?.schoolId,
        actionName: 'initialiser_programmes_classe',
        targetType: 'Class',
        targetId: String(req.params.classId ?? ''),
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: e instanceof Error ? e.message : undefined,
      });
      this.gererErreur(e, res, next);
    }
  };

  basculerAvancementChapitre = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const chapitreId = String(req.params.chapitreId ?? '');
      const body = (req.body ?? {}) as { classId?: string; fait?: unknown };
      if (typeof body.fait !== 'boolean' || !body.classId) {
        res.status(400).json({
          success: false,
          message: 'classId (string) et fait (boolean) sont requis',
        });
        return;
      }

      const data = await this.basculerAvancement.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        role: user.role,
        chapitreId,
        classId: body.classId,
        fait: body.fait,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: body.fait ? 'cocher_lecon_programme' : 'decocher_lecon_programme',
        targetType: 'Chapitre',
        targetId: chapitreId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: {
          classId: body.classId,
          fait: body.fait,
          sourceRealisation: data.sourceRealisation,
        },
      });
      res.json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  basculerModuleActif = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const programmeId = String(req.params.programmeId ?? '');
      const moduleOrdre = Number(req.params.moduleOrdre);
      const body = (req.body ?? {}) as { actif?: unknown };
      if (typeof body.actif !== 'boolean' || !Number.isInteger(moduleOrdre)) {
        res.status(400).json({
          success: false,
          message: 'moduleOrdre entier et actif (boolean) sont requis',
        });
        return;
      }

      const data = await this.basculerModule.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        role: user.role,
        programmeId,
        moduleOrdre,
        actif: body.actif,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: body.actif ? 'activer_module_programme' : 'desactiver_module_programme',
        targetType: 'Programme',
        targetId: programmeId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { moduleOrdre, actif: body.actif },
      });
      res.json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  private gererErreur(e: unknown, res: Response, next: NextFunction): void {
    if (e instanceof PedagogieValidationError) {
      res.status(400).json({ success: false, message: e.message });
      return;
    }
    if (e instanceof PedagogieNotFoundError) {
      res.status(404).json({ success: false, message: e.message });
      return;
    }
    if (e instanceof PedagogieForbiddenError) {
      res.status(403).json({ success: false, message: e.message });
      return;
    }
    next(e);
  }
}

