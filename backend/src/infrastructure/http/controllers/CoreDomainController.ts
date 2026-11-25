import type { Request, Response, NextFunction } from 'express';
import type { PeriodType } from '@domain/types/enums';
import type { CoreDomainQueryRepository } from '@domain/ports/repositories/CoreDomainQueryRepository';
import { DEFAULT_SUBSYSTEMS, ensureDefaultSubSystems } from '../../../domain/subsystems/SubsystemDefaults';
import { logActivity } from '../../services/audit/ActivityLogService';

export class CoreDomainController {
  constructor(private readonly coreDomainRepo: CoreDomainQueryRepository) {}

  getSubSystems = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ subsystems: [...DEFAULT_SUBSYSTEMS], total: DEFAULT_SUBSYSTEMS.length });
    } catch (error) {
      next(error);
    }
  };

  upsertDefaults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureDefaultSubSystems();
      await logActivity({ userId: req.user!.userId, schoolId: req.user!.schoolId, action: 'Upserted default SubSystems' });
      res.json({ message: 'Sous-systèmes synchronisés', total: DEFAULT_SUBSYSTEMS.length });
    } catch (error) {
      next(error);
    }
  };

  createPeriod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId, name, type, startDate, endDate, isCurrent } = req.body;

      if (!academicYearId) { res.status(400).json({ message: 'academicYearId requis' }); return; }

      const year = await this.coreDomainRepo.findAcademicYear(academicYearId, schoolId);
      if (!year) { res.status(404).json({ message: 'Année académique introuvable' }); return; }

      // orderIndex requis par le schéma, sans défaut — jamais fourni par ce endpoint jusqu'ici
      // (masqué par un cast non typé, échouait avec une violation NOT NULL à chaque appel réel).
      // Repris du nombre de périodes déjà existantes pour cette année : place la nouvelle période
      // à la suite des autres.
      const periodesExistantes = await this.coreDomainRepo.countPeriods(academicYearId);

      const period = await this.coreDomainRepo.createPeriod({
        academicYearId,
        name: String(name || '').trim(),
        type: (type as PeriodType) || 'TRIMESTER',
        orderIndex: periodesExistantes + 1,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: Boolean(isCurrent),
      });

      await logActivity({ userId: req.user!.userId, schoolId, action: `Période créée : ${period.name}` });
      res.status(201).json(period);
    } catch (error) {
      next(error);
    }
  };

  getPeriods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId, type } = req.query as { academicYearId?: string; type?: string };

      const periods = await this.coreDomainRepo.findPeriods({
        ...(academicYearId ? { academicYearId } : {}),
        ...(type ? { type: type as PeriodType } : {}),
        schoolId,
      });

      res.json({ periods, total: periods.length });
    } catch (error) {
      next(error);
    }
  };

  updatePeriod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const period = await this.coreDomainRepo.findPeriodById(req.params.id as string, schoolId);
      if (!period) { res.status(404).json({ message: 'Période introuvable' }); return; }

      const updated = await this.coreDomainRepo.updatePeriod(period.id, {
        ...req.body,
        ...(req.body.startDate ? { startDate: new Date(req.body.startDate) } : {}),
        ...(req.body.endDate ? { endDate: new Date(req.body.endDate) } : {}),
      });

      await logActivity({ userId: req.user!.userId, schoolId, action: `Période mise à jour : ${updated.name}` });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };
}
