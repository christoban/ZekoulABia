import type { Request, Response, NextFunction } from 'express';
import type { ListerTemplatesCatalogUseCase } from '@application/school/ListerTemplatesCatalogUseCase';
import type {
  ConfigurerEtablissementUseCase,
  OnboardingState,
} from '@application/school/ConfigurerEtablissementUseCase';
import type { OnboardingTimetableRepository } from '@domain/ports/repositories/OnboardingTimetableRepository';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';

export class OnboardingTimetableController {
  constructor(
    private readonly listerTemplatesCatalog: ListerTemplatesCatalogUseCase,
    private readonly configurerEtablissement: ConfigurerEtablissementUseCase,
    private readonly onboardingTimetableRepository: OnboardingTimetableRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  getTemplateCatalog = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = this.listerTemplatesCatalog.execute();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId; // schoolId forcé depuis la session (sécurité)
      const body = (req.body ?? {}) as Partial<OnboardingState>;
      const bodySchoolId = body.schoolId;
      // Garantie d'isolation multi-tenant : refuser explicitement si le body tente de cibler une autre école.
      if (bodySchoolId && bodySchoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const state: OnboardingState = { ...body, schoolId, adminUserId: req.user!.userId };
      const result = await this.configurerEtablissement.execute(state);
      const hasGrid = await this.onboardingTimetableRepository.hasTimetableGridConfig(schoolId);
      if (hasGrid) void this.eventPublisher.emit('timetable/grille.sauvee', { schoolId });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('introuvable')) {
          res.status(404).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('Template inconnu')) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('déjà') || error.message.includes('approuvé') || error.message.includes('requis')) {
          res.status(422).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  };
}
