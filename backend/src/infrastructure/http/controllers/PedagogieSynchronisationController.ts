/**
 * INFRASTRUCTURE LAYER — Controller HTTP mince Lot 2 :
 * - Initialisation en lot d'une école (propose / apply)
 * - Détection des dérives nationales (GET /programmes/derives)
 * - Synchronisation différentielle non destructive d'un programme (propose / apply)
 */
import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { OptionClassique } from '@domain/rules/officialProgressionResolution';
import type { InitialiserProgrammesEcoleUseCase } from '@application/pedagogie/InitialiserProgrammesEcoleUseCase';
import type { ListerDerivesProgrammesEcoleUseCase } from '@application/pedagogie/ListerDerivesProgrammesEcoleUseCase';
import type { ProposerSynchronisationProgrammeUseCase } from '@application/pedagogie/ProposerSynchronisationProgrammeUseCase';
import type { AppliquerSynchronisationProgrammeUseCase } from '@application/pedagogie/AppliquerSynchronisationProgrammeUseCase';
import {
  PedagogieForbiddenError,
  PedagogieNotFoundError,
  PedagogieValidationError,
} from '@application/pedagogie/errors';

function extraireOptionsParClasse(
  raw: unknown,
): Record<string, Record<string, OptionClassique>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, Record<string, OptionClassique>> = {};
  for (const [classId, inner] of Object.entries(raw as Record<string, unknown>)) {
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) continue;
    const perSub: Record<string, OptionClassique> = {};
    for (const [subId, val] of Object.entries(inner as Record<string, unknown>)) {
      if (val === 'Latin' || val === 'Grec') perSub[subId] = val;
    }
    if (Object.keys(perSub).length > 0) out[classId] = perSub;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export class PedagogieSynchronisationController {
  constructor(
    private readonly initialiserEcole: InitialiserProgrammesEcoleUseCase,
    private readonly listerDerives: ListerDerivesProgrammesEcoleUseCase,
    private readonly proposerSync: ProposerSynchronisationProgrammeUseCase,
    private readonly appliquerSync: AppliquerSynchronisationProgrammeUseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  proposerInitialisationEcole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const body = (req.body ?? {}) as {
        academicYearId?: string;
        optionsClassiquesParClasse?: unknown;
      };
      const data = await this.initialiserEcole.proposer({
        schoolId: user.schoolId,
        academicYearId: body.academicYearId,
        optionsClassiquesParClasse: extraireOptionsParClasse(body.optionsClassiquesParClasse),
      });
      res.json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  appliquerInitialisationEcole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const body = (req.body ?? {}) as {
        academicYearId?: string;
        optionsClassiquesParClasse?: unknown;
      };
      const data = await this.initialiserEcole.appliquer({
        schoolId: user.schoolId,
        academicYearId: body.academicYearId,
        optionsClassiquesParClasse: extraireOptionsParClasse(body.optionsClassiquesParClasse),
      });
      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'initialiser_programmes_ecole',
        targetType: 'School',
        targetId: user.schoolId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: data.resume,
      });
      res.status(201).json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  listerDerivesEcole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const { academicYearId } = req.query as { academicYearId?: string };
      const data = await this.listerDerives.execute({
        schoolId: user.schoolId,
        academicYearId,
      });
      res.json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  proposerSynchronisationProgramme = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const programmeId = String(req.params.programmeId ?? '');
      const data = await this.proposerSync.execute({
        schoolId: user.schoolId,
        programmeId,
      });
      res.json({ success: true, data });
    } catch (e) {
      this.gererErreur(e, res, next);
    }
  };

  appliquerSynchronisationProgramme = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user!;
      const programmeId = String(req.params.programmeId ?? '');
      const data = await this.appliquerSync.execute({
        schoolId: user.schoolId,
        programmeId,
      });
      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'synchroniser_programme_national',
        targetType: 'Programme',
        targetId: programmeId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: {
          dejaAJour: data.dejaAJour,
          nbAjoutes: data.nbAjoutes,
          nbModifies: data.nbModifies,
          nbConservesRetiresDuNational: data.nbConservesRetiresDuNational,
        },
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
