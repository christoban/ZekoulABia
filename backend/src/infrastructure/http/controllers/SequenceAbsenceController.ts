import type { Request, Response, NextFunction } from 'express';
import {
  ForbiddenAttendanceConsolidationError,
  type SaisirHeuresAbsenceSequenceUseCase,
} from '@application/attendance/SaisirHeuresAbsenceSequenceUseCase';
import type { SequenceAbsenceSummaryRepository } from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';
import { canConsolidateAttendanceHours } from '@application/attendance/SaisirHeuresAbsenceSequenceUseCase';

export class SequenceAbsenceController {
  constructor(
    private readonly saisirUseCase: SaisirHeuresAbsenceSequenceUseCase,
    private readonly sequenceAbsenceRepository: SequenceAbsenceSummaryRepository,
  ) {}

  // POST /api/v2/attendance/sequence-hours
  upsertSequenceHours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { classId, academicPeriodId, sequenceId, entries } = req.body as {
        classId?: string;
        academicPeriodId?: string;
        sequenceId?: string;
        entries?: Array<{
          studentId: string;
          justifiedHours: number;
          unjustifiedHours: number;
          consignesCount?: number;
        }>;
      };

      if (!classId || !academicPeriodId || !sequenceId || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({
          success: false,
          message: 'classId, academicPeriodId, sequenceId et entries (tableau non vide) sont requis',
        });
        return;
      }

      const result = await this.saisirUseCase.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
        sequenceId,
        actorUserId: user.userId,
        actorRole: user.role,
        actorPermissions: user.permissions,
        entries,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ForbiddenAttendanceConsolidationError) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof Error && (error.message.includes('invalide') || error.message.includes('introuvable') || error.message.includes('n\'appartient'))) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // GET /api/v2/attendance/sequence-hours?classId=...&periodId=...
  listSequenceHours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      if (!canConsolidateAttendanceHours(user.role, user.permissions)) {
        res.status(403).json({ success: false, message: 'Accès réservé à l’administration ou au surveillant général' });
        return;
      }
      const classId = req.query.classId as string | undefined;
      const periodId = req.query.periodId as string | undefined;
      if (!classId || !periodId) {
        res.status(400).json({ success: false, message: 'classId et periodId requis' });
        return;
      }
      const records = await this.sequenceAbsenceRepository.findByClassAndPeriods(user.schoolId, classId, [periodId]);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  };
}

