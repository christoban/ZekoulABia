import type { Request, Response, NextFunction } from 'express';
import type { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import type { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import type { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import type { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import type { ElectifsQueryRepository } from '@domain/ports/repositories/ElectifsQueryRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { PebsFiliere } from '@domain/types/enums';

export class ElectifsLv2PebsController {
  constructor(
    private readonly affecterLV2EleveUseCase: AffecterLV2EleveUseCase,
    private readonly affecterLV2EnMasseUseCase: AffecterLV2EnMasseUseCase,
    private readonly affecterPEBSEleveUseCase: AffecterPEBSEleveUseCase,
    private readonly affecterPEBSEnMasseUseCase: AffecterPEBSEnMasseUseCase,
    private readonly electifsRepo: ElectifsQueryRepository,
    private readonly audit: AIActionAuditPort,
  ) {}

  private journaliserErreur(
    req: Request,
    actionName: string,
    parametersSummary: unknown,
    err: unknown,
    targetType?: string,
    targetId?: string,
  ): void {
    this.audit.journaliser({
      actorUserId: req.user?.userId ?? '',
      actorRole: req.user?.role ?? '',
      schoolId: req.user?.schoolId,
      actionName,
      targetType,
      targetId,
      origin: 'UI_DIRECT',
      outcome: 'ERREUR',
      refusalReason: err instanceof Error ? err.message : undefined,
      parametersSummary,
    });
  }

  // PATCH /api/v2/students/:id/lv2
  affecterLV2 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { lv2SubjectId } = req.body as { lv2SubjectId?: string | null };

      await this.affecterLV2EleveUseCase.execute({
        studentUserId,
        schoolId,
        lv2SubjectId: lv2SubjectId ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'affecter_lv2_eleve',
        targetType: 'User',
        targetId: studentUserId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { studentUserId, lv2SubjectId },
      });
      res.json({ success: true, message: 'LV2 affectée' });
    } catch (err) {
      this.journaliserErreur(req, 'affecter_lv2_eleve', req.body, err, 'User', req.params['id'] as string);
      next(err);
    }
  };

  // POST /api/v2/students/lv2/bulk
  affecterLV2EnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserIds, lv2SubjectId } = req.body as { studentUserIds?: string[]; lv2SubjectId?: string | null };

      if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
        res.status(400).json({ success: false, message: 'studentUserIds[] requis' });
        return;
      }

      const result = await this.affecterLV2EnMasseUseCase.execute({
        studentUserIds,
        schoolId,
        lv2SubjectId: lv2SubjectId ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'affecter_lv2_masse',
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { studentUserIds, lv2SubjectId, modifies: result.modifies },
      });
      res.json({ success: true, data: { modifies: result.modifies } });
    } catch (err) {
      this.journaliserErreur(req, 'affecter_lv2_masse', req.body, err);
      next(err);
    }
  };

  // GET /api/v2/classes/:id/lv2-overview
  getLv2Overview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await this.electifsRepo.findClassById(classId, schoolId);
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const students = await this.electifsRepo.listClassStudentsLV2(classId, schoolId);

      const groupes: Record<string, { subjectId: string; langue: string; eleves: { id: string; firstName: string; lastName: string }[] }> = {};
      const sansLV2: { id: string; firstName: string; lastName: string }[] = [];

      for (const s of students) {
        const lv2 = s.lv2SubjectId;
        const lv2Name = s.lv2SubjectName;
        if (!lv2 || !lv2Name) {
          sansLV2.push({ id: s.id, firstName: s.firstName, lastName: s.lastName });
        } else {
          if (!groupes[lv2]) groupes[lv2] = { subjectId: lv2, langue: lv2Name, eleves: [] };
          groupes[lv2].eleves.push({ id: s.id, firstName: s.firstName, lastName: s.lastName });
        }
      }

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'compter_eleves_par_lv2',
        targetType: 'Class',
        targetId: classId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { classId },
      });
      res.json({
        success: true,
        data: {
          className: classe.name,
          groupes: Object.values(groupes).map((g) => ({ ...g, nombreEleves: g.eleves.length })),
          sansLV2,
          total: students.length,
        },
      });
    } catch (err) {
      this.journaliserErreur(req, 'compter_eleves_par_lv2', { classId: req.params['id'] }, err, 'Class', req.params['id'] as string);
      next(err);
    }
  };

  // PATCH /api/v2/students/:id/pebs
  affecterPEBS = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { pebsFiliere } = req.body as { pebsFiliere?: PebsFiliere | null };

      await this.affecterPEBSEleveUseCase.execute({
        studentUserId,
        schoolId,
        pebsFiliere: pebsFiliere ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'affecter_pebs_eleve',
        targetType: 'User',
        targetId: studentUserId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { studentUserId, pebsFiliere },
      });
      res.json({ success: true, message: 'PEBS affecté' });
    } catch (err) {
      this.journaliserErreur(req, 'affecter_pebs_eleve', req.body, err, 'User', req.params['id'] as string);
      next(err);
    }
  };

  // POST /api/v2/students/pebs/bulk
  affecterPEBSEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserIds, pebsFiliere } = req.body as { studentUserIds?: string[]; pebsFiliere?: PebsFiliere | null };

      if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
        res.status(400).json({ success: false, message: 'studentUserIds[] requis' });
        return;
      }

      const result = await this.affecterPEBSEnMasseUseCase.execute({
        studentUserIds,
        schoolId,
        pebsFiliere: pebsFiliere ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'affecter_pebs_masse',
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { studentUserIds, pebsFiliere, modifies: result.modifies },
      });
      res.json({ success: true, data: { modifies: result.modifies } });
    } catch (err) {
      this.journaliserErreur(req, 'affecter_pebs_masse', req.body, err);
      next(err);
    }
  };

  // GET /api/v2/classes/:id/pebs-overview
  getPebsOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await this.electifsRepo.findClassById(classId, schoolId);
      if (!classe) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const eleves = await this.electifsRepo.listClassStudentsPEBS(classId, schoolId);

      const pebsCount = eleves.filter((e) => e.pebsFiliere !== null).length;
      const nonPEBSCount = eleves.filter((e) => e.pebsFiliere === null).length;

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'repartition_pebs_classe',
        targetType: 'Class',
        targetId: classId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { classId },
      });
      res.json({
        success: true,
        data: {
          className: classe.name,
          pebsCount,
          nonPEBSCount,
          total: eleves.length,
          eleves,
        },
      });
    } catch (err) {
      this.journaliserErreur(req, 'repartition_pebs_classe', { classId: req.params['id'] }, err, 'Class', req.params['id'] as string);
      next(err);
    }
  };
}
