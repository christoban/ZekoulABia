import type { Request, Response, NextFunction } from 'express';
import type { ListerNotesUseCase } from '@application/grade/ListerNotesUseCase';
import type { ListerNotesEnAttenteUseCase } from '@application/grade/ListerNotesEnAttenteUseCase';
import type { StatutParClasseUseCase } from '@application/grade/StatutParClasseUseCase';
import type { CalculerMoyenneUseCase } from '@application/grade/CalculerMoyenneUseCase';
import type { UserRole, StaffPermissionType, GradeValidationStatus } from '@domain/types/enums';
import { parseSinceParam } from '@infrastructure/http/helpers/deltaSyncHelper';

export class GradeLectureController {
  constructor(
    private readonly listerNotes: ListerNotesUseCase,
    private readonly listerNotesEnAttente: ListerNotesEnAttenteUseCase,
    private readonly statutParClasseUC: StatutParClasseUseCase,
    private readonly calculerMoyenneUC: CalculerMoyenneUseCase,
  ) {}

  // GET /api/v2/grades
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId, studentId, validationStatus, since, page = '1', limit = '50' } =
        req.query as Record<string, string>;

      // Validation explicite du paramètre validationStatus
      if (validationStatus && validationStatus !== 'DRAFT' && validationStatus !== 'LOCKED') {
        res.status(400).json({
          success: false,
          message: `validationStatus invalide : '${validationStatus}'. Valeurs acceptées : 'DRAFT', 'LOCKED'`,
        });
        return;
      }

      const sinceDate = parseSinceParam(since);
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const result = await this.listerNotes.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role as UserRole,
        userPermissions: user.permissions as StaffPermissionType[],
        filters: {
          classId,
          subjectId,
          sequenceId,
          studentId,
          ...(validationStatus ? { validationStatus: validationStatus as GradeValidationStatus } : {}),
          ...(sinceDate ? { since: sinceDate } : {}),
        },
        pagination: { page: pageNum, limit: limitNum },
      });

      res.json({
        success: true,
        serverTime: new Date().toISOString(),
        isDelta: Boolean(sinceDate),
        grades: result.items,
        pagination: { total: result.total, page: result.page, pages: result.pages, limit: result.limit },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/pending
  listerEnAttente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const permissions: string[] = user.permissions ?? [];
      const { classId, subjectId, sequenceId } = req.query as Record<string, string>;

      const resultat = await this.listerNotesEnAttente.execute({
        schoolId: user.schoolId,
        userRole: user.role,
        userPermissions: permissions,
        filters: { classId, subjectId, sequenceId },
      });

      res.json({ grades: resultat.grades, grouped: resultat.grouped, total: resultat.total });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/status/:classId
  statutParClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId } = req.params as { classId: string };
      const { sequenceId } = req.query as { sequenceId?: string };

      const resultat = await this.statutParClasseUC.execute({
        schoolId: user.schoolId,
        classId,
        sequenceId,
      });

      res.json({
        classId: resultat.classId,
        stats: resultat.stats,
        bySubject: resultat.bySubject,
        canGenerateReportCard: resultat.canGenerateReportCard,
        grades: resultat.grades,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/grades/average/:studentId
  moyenneEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const studentId = req.params.studentId as string;
      const classId = req.query.classId as string | undefined;
      const sequenceId = req.query.sequenceId as string | undefined;

      if (!classId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId et sequenceId sont requis' });
        return;
      }

      const result = await this.calculerMoyenneUC.execute({
        schoolId: user.schoolId,
        studentId,
        classId,
        sequenceId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
