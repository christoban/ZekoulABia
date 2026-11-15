import type { Request, Response, NextFunction } from 'express';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { TraiterSmsPresenceUseCase } from '@application/attendance/TraiterSmsPresenceUseCase';

export class SMSController {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly traiterSmsPresence: TraiterSmsPresenceUseCase,
  ) {}

  incoming = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { from, text } = req.query as { from?: string; text?: string };
      if (!from || !text) { res.status(400).json({ message: 'Paramètres manquants' }); return; }

      const [school] = await this.schoolRepository.findByStatus('ACTIVE');
      if (!school) { res.status(404).json({ message: 'École introuvable' }); return; }

      const result = await this.traiterSmsPresence.execute(text, from, school.id);
      console.info(`SMS from ${from}: ${text} → ${result.message}`);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
