import type { Request, Response, NextFunction } from 'express';
import type { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import type { ModifierNoteUseCase } from '@application/grade/ModifierNoteUseCase';
import type { DraftEnMasseUseCase } from '@application/grade/DraftEnMasseUseCase';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import { validerSaisirNoteDto } from '@infrastructure/http/dto/grade.dto';
import { gererErreurGrade } from './gradeErrors';

export class GradeSaisieController {
  constructor(
    private readonly saisirNote: SaisirNoteUseCase,
    private readonly modifierNote: ModifierNoteUseCase,
    private readonly draftEnMasseUC: DraftEnMasseUseCase,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  // POST /api/v2/grades
  saisir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validerSaisirNoteDto(req.body);
      const user = req.user;

      const resultat = await this.saisirNote.execute({
        schoolId: user.schoolId,
        academicYearId: req.body.academicYearId,
        recordedById: user.userId,
        ...dto,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };

  // PUT /api/v2/grades/:id
  modifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;

      const resultat = await this.modifierNote.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role,
        gradeId: req.params.id as string,
        sequenceScore: req.body.sequenceScore !== undefined ? Number(req.body.sequenceScore) : undefined,
        classTestScore: req.body.classTestScore !== undefined ? Number(req.body.classTestScore) : undefined,
        terminalExamScore: req.body.terminalExamScore !== undefined ? Number(req.body.terminalExamScore) : undefined,
        theoreticalScore: req.body.theoreticalScore !== undefined ? Number(req.body.theoreticalScore) : undefined,
        practicalScore: req.body.practicalScore !== undefined ? Number(req.body.practicalScore) : undefined,
        professionalAttitude: req.body.professionalAttitude !== undefined ? Number(req.body.professionalAttitude) : undefined,
        oralScore: req.body.oralScore !== undefined ? Number(req.body.oralScore) : undefined,
        selfDevelopmentScore: req.body.selfDevelopmentScore !== undefined ? Number(req.body.selfDevelopmentScore) : undefined,
        maxValue: req.body.maxValue !== undefined ? Number(req.body.maxValue) : undefined,
        seq1Score: req.body.seq1Score !== undefined ? Number(req.body.seq1Score) : undefined,
        seq2Score: req.body.seq2Score !== undefined ? Number(req.body.seq2Score) : undefined,
        compositionScore: req.body.compositionScore !== undefined ? Number(req.body.compositionScore) : undefined,
      });

      res.json({ success: true, grade: { sequenceAverage: resultat.sequenceAverage } });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };

  // POST /api/v2/grades/draft — sauvegarde en masse (upsert)
  draftEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId, grades } = req.body;

      if (!classId || !subjectId || !sequenceId || !grades?.length) {
        res.status(400).json({ success: false, message: 'classId, subjectId, sequenceId et grades sont requis' });
        return;
      }

      // Résolution de l'année académique via la séquence
      const sequence = await this.anneeRepository.findSequenceById(sequenceId, user.schoolId);
      if (!sequence) {
        res.status(400).json({
          success: false,
          message: `Séquence introuvable (id: ${sequenceId}) — impossible de déterminer l'année académique`,
        });
        return;
      }
      const periode = await this.anneeRepository.findPeriodeById(sequence.academicPeriodId, user.schoolId);
      const academicYearId = periode?.academicYearId;

      if (!academicYearId) {
        res.status(400).json({
          success: false,
          message: `Séquence introuvable (id: ${sequenceId}) — impossible de déterminer l'année académique`,
        });
        return;
      }

      const resultat = await this.draftEnMasseUC.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role,
        classId,
        subjectId,
        sequenceId,
        academicYearId,
        grades: grades.map((g: { studentId: string; value: number; observation?: string }) => ({
          studentId: g.studentId,
          value: Number(g.value),
          observation: g.observation,
        })),
      });

      res.json({ success: true, data: resultat.results, count: resultat.results.length });
    } catch (error) {
      gererErreurGrade(error, res, next);
    }
  };
}
