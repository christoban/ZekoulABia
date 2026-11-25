import type { Request, Response, NextFunction } from 'express';
import type {
  AnglophoneStreamCombinationRecord,
  OnboardingStreamRepository,
} from '@domain/ports/repositories/OnboardingStreamRepository';

export class OnboardingStreamController {
  constructor(private readonly repo: OnboardingStreamRepository) {}

  private toEntry(combo: AnglophoneStreamCombinationRecord) {
    const core = Array.isArray(combo.coreSubjects) ? (combo.coreSubjects as string[]) : [];
    const electives = Array.isArray(combo.electiveGroup)
      ? (combo.electiveGroup as string[][]).flat().filter((x): x is string => typeof x === 'string')
      : [];
    const subjects = [...new Set([...core, ...electives])];
    return {
      code: combo.filiere,
      type: combo.type,
      label: combo.description ?? core.join(', '),
      coreSubjects: core,
      subjects,
    };
  }

  listAnglophoneStreams = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const combos = await this.repo.listAnglophoneStreamCombinations();
      res.json({
        success: true,
        data: {
          arts: combos.filter((ct) => ct.type === 'ARTS').map((ct) => this.toEntry(ct)),
          science: combos.filter((ct) => ct.type === 'SCIENCES').map((ct) => this.toEntry(ct)),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
