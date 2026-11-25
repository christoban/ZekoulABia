import type { Request, Response, NextFunction } from 'express';
import type { VerrouillerNoteUseCase } from '@application/grade/VerrouillerNoteUseCase';
import type { VerrouillerNotesEnMasseUseCase } from '@application/grade/VerrouillerNotesEnMasseUseCase';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import { logActivity } from '../../../services/audit/ActivityLogService';
import { gererErreurGrade } from './gradeErrors';

export class GradeValidationController {
  constructor(
    private readonly verrouillerNote: VerrouillerNoteUseCase,
    private readonly verrouillerNotesEnMasse: VerrouillerNotesEnMasseUseCase,
    private readonly eventPublisher: EventPublisher,
  ) {}

  // PATCH /api/v2/grades/:id/lock
  verrouiller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.verrouillerNote.execute({
        noteId: req.params.id as string,
        demandeurId: user.userId,
        schoolId: user.schoolId,
      });

      void this.eventPublisher.emit('grade/locked', {
        gradeId: resultat.noteId,
        studentId: resultat.studentId,
        subjectId: resultat.subjectId,
        schoolId: resultat.schoolId,
        sequenceId: resultat.sequenceId,
      }).catch((err) => console.error('[GradeValidationController] Échec envoi grade/locked:', (err as Error)?.message));

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Note verrouillée', details: `Note ${req.params.id} verrouillée` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };

  // POST /api/v2/grades/bulk-lock
  verrouillerEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { classId, sequenceId } = req.body;
      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId requis' });
        return;
      }
      const user = req.user;
      const resultat = await this.verrouillerNotesEnMasse.execute({
        classId,
        sequenceId,
        demandeurId: user.userId,
        schoolId: user.schoolId,
      });

      if (resultat.gradesVerrouilles.length > 0) {
        void this.eventPublisher.emit('grade/locked-batch', {
          schoolId: resultat.gradesVerrouilles[0]!.schoolId,
          grades: resultat.gradesVerrouilles.map((g) => ({ studentId: g.studentId, subjectId: g.subjectId, sequenceId: g.sequenceId })),
        }).catch((err) => console.error('[GradeValidationController] Échec envoi grade/locked-batch:', (err as Error)?.message));
      }

      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Notes verrouillées en masse', details: `Classe ${classId}, séquence ${sequenceId} : ${resultat.notesVerrouillees} notes` });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };
}
