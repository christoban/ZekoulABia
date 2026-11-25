import type { Request, Response, NextFunction } from 'express';
import { ConsulterResultatPublicUseCase } from '@application/entranceExam/ConsulterResultatPublicUseCase';

export class EntranceExamPublicController {
  constructor(
    private readonly _consulterResultat: ConsulterResultatPublicUseCase
  ) {}

  // POST /api/v2/entrance-exams/public/resultats
  consulter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, candidateNumber, dateOfBirth } = req.body;
      if (!sessionId || !candidateNumber || !dateOfBirth) {
        res.status(400).json({
          success: false,
          message: 'sessionId, candidateNumber et dateOfBirth sont obligatoires',
        });
        return;
      }

      const parsedDob = new Date(dateOfBirth);
      if (isNaN(parsedDob.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Format de date de naissance invalide (AAAA-MM-JJ attendu)',
        });
        return;
      }

      const resultat = await this._consulterResultat.execute({
        sessionId: String(sessionId),
        candidateNumber: String(candidateNumber).trim(),
        dateOfBirth: parsedDob,
      });

      res.json({ success: true, data: resultat });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la consultation';
      res.status(404).json({ success: false, message });
    }
  };
}
