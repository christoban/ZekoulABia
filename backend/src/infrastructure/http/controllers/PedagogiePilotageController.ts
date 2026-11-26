/**
 * INFRASTRUCTURE LAYER — Controller HTTP mince Lot 3 :
 * - Rapport consolidé d'avancement (JSON ou export CSV téléchargeable)
 * - Notifications ciblées des retards (propose / apply)
 */
import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import {
  formaterRapportAvancementCsv,
  type GenererRapportAvancementProgrammesUseCase,
} from '@application/pedagogie/GenererRapportAvancementProgrammesUseCase';
import type { RelancerRetardsProgrammesUseCase } from '@application/pedagogie/RelancerRetardsProgrammesUseCase';

export class PedagogiePilotageController {
  constructor(
    private readonly genererRapportAvancement: GenererRapportAvancementProgrammesUseCase,
    private readonly relancerRetards: RelancerRetardsProgrammesUseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  getRapportAvancement = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const { academicYearId, level, departmentId, classId, source, format, seuilPct } =
        req.query as Record<string, string | undefined>;
      const sourceNorm = source === 'national' || source === 'manuel' ? source : undefined;
      const seuil = seuilPct ? parseInt(seuilPct, 10) : undefined;

      const rapport = await this.genererRapportAvancement.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        role: user.role,
        permissions: user.permissions ?? [],
        academicYearId,
        level,
        departmentId,
        classId,
        source: sourceNorm,
        seuilRetardPct: Number.isFinite(seuil) ? seuil : undefined,
      });

      if (format === 'csv') {
        const csv = formaterRapportAvancementCsv(rapport);
        const dateTag = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="rapport-avancement-programmes-${dateTag}.csv"`,
        );
        res.status(200).send(csv);
        return;
      }

      res.json({ success: true, data: rapport });
    } catch (e) {
      next(e);
    }
  };

  proposerRelanceRetards = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const body = (req.body ?? {}) as {
        academicYearId?: string;
        seuilPct?: number;
        critiquesSeulement?: boolean;
      };
      const data = await this.relancerRetards.proposer({
        schoolId: user.schoolId,
        academicYearId: body.academicYearId,
        seuilPct: typeof body.seuilPct === 'number' ? body.seuilPct : undefined,
        critiquesSeulement: body.critiquesSeulement === true,
      });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  appliquerRelanceRetards = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const body = (req.body ?? {}) as {
        academicYearId?: string;
        seuilPct?: number;
        critiquesSeulement?: boolean;
      };
      const data = await this.relancerRetards.appliquer({
        schoolId: user.schoolId,
        academicYearId: body.academicYearId,
        seuilPct: typeof body.seuilPct === 'number' ? body.seuilPct : undefined,
        critiquesSeulement: body.critiquesSeulement === true,
      });
      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'relancer_retards_programmes_cibles',
        targetType: 'School',
        targetId: user.schoolId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: {
          totalAlertes: data.totalAlertes,
          notificationsEnvoyees: data.notificationsEnvoyees,
          echecsEnvoi: data.echecsEnvoi,
        },
      });
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };
}
