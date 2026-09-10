import { Router } from 'express';
import type { CreerAssessmentScopeUseCase } from '@application/assessment/CreerAssessmentScopeUseCase';
import type { PlanifierAssessmentSessionUseCase } from '@application/assessment/PlanifierAssessmentSessionUseCase';
import type { EnregistrerParticipationUseCase } from '@application/assessment/EnregistrerParticipationUseCase';
import type { EnregistrerParticipationEnLotUseCase } from '@application/assessment/EnregistrerParticipationEnLotUseCase';
import type { GenererCodesAnonymatUseCase } from '@application/assessment/GenererCodesAnonymatUseCase';
import type { DesignerEquipeAnonymatUseCase } from '@application/assessment/DesignerEquipeAnonymatUseCase';
import type { AssignerCorrectionAnonymatUseCase } from '@application/assessment/AssignerCorrectionAnonymatUseCase';
import type { ObtenirFicheCorrectionAnonymeUseCase } from '@application/assessment/ObtenirFicheCorrectionAnonymeUseCase';
import type { SaisirNotesAnonymesUseCase } from '@application/assessment/SaisirNotesAnonymesUseCase';
import type { SoumettreCorrectionAnonymeUseCase } from '@application/assessment/SoumettreCorrectionAnonymeUseCase';
import type { ReconcilierNotesAnonymesUseCase } from '@application/assessment/ReconcilierNotesAnonymesUseCase';
import { AnonymatDomainError } from '@domain/errors/AnonymatErrors';
import { requireAuth } from '../middlewares/auth.ts';

export function creerAssessmentRoutes(
  creerScope: CreerAssessmentScopeUseCase,
  planifierSession: PlanifierAssessmentSessionUseCase,
  enregistrerParticipation: EnregistrerParticipationUseCase,
  enregistrerParticipationEnLot: EnregistrerParticipationEnLotUseCase,
  genererCodes: GenererCodesAnonymatUseCase,
  designerEquipe: DesignerEquipeAnonymatUseCase,
  assignerCorrection: AssignerCorrectionAnonymatUseCase,
  obtenirFicheCorrection: ObtenirFicheCorrectionAnonymeUseCase,
  saisirNotesAnonymes: SaisirNotesAnonymesUseCase,
  soumettreCorrection: SoumettreCorrectionAnonymeUseCase,
  reconcilierNotes: ReconcilierNotesAnonymesUseCase,
): Router {
  const router = Router();

  router.post('/scopes', requireAuth, async (req, res, next) => {
    try {
      const result = await creerScope.execute({
        schoolId: req.user!.schoolId,
        academicYearId: req.body.academicYearId,
        name: req.body.name,
        sequenceType: req.body.sequenceType,
        subjectIds: req.body.subjectIds,
        classIds: req.body.classIds,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions', requireAuth, async (req, res, next) => {
    try {
      const result = await planifierSession.execute({
        schoolId: req.user!.schoolId,
        assessmentScopeId: req.body.assessmentScopeId,
        subjectId: req.body.subjectId,
        classId: req.body.classId,
        academicSequenceId: req.body.academicSequenceId,
        scheduledDate: new Date(req.body.scheduledDate),
        durationMinutes: req.body.durationMinutes,
        isAnonymized: req.body.isAnonymized,
        correctionMode: req.body.correctionMode,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/participations', requireAuth, async (req, res, next) => {
    try {
      const result = await enregistrerParticipation.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.body.sessionId,
        studentId: req.body.studentId,
        status: req.body.status,
        recordedById: req.user!.userId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/participations/batch', requireAuth, async (req, res, next) => {
    try {
      const result = await enregistrerParticipationEnLot.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.body.sessionId,
        participations: req.body.participations,
        recordedById: req.user!.userId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:sessionId/anonymat/codes', async (req, res, next) => {
    try {
      const result = await genererCodes.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        actorStaffPermissions: req.user!.permissions,
        classIds: req.body.classIds,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/sessions/:sessionId/anonymat/team', async (req, res, next) => {
    try {
      const result = await designerEquipe.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        actorStaffPermissions: req.user!.permissions,
        members: req.body.members,
        classIds: req.body.classIds,
        schoolName: req.body.schoolName,
        tokenValidityHours: req.body.tokenValidityHours,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/sessions/:sessionId/anonymat/correction-assignments', requireAuth, async (req, res, next) => {
    try {
      const result = await assignerCorrection.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        actorStaffPermissions: req.user!.permissions,
        assignments: req.body.assignments,
        classIds: req.body.classIds,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get('/sessions/:sessionId/anonymat/correction-sheet', requireAuth, async (req, res, next) => {
    try {
      const result = await obtenirFicheCorrection.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        actorStaffPermissions: req.user!.permissions,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/sessions/:sessionId/anonymat/notes', requireAuth, async (req, res, next) => {
    try {
      const result = await saisirNotesAnonymes.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        correcteurId: req.user!.userId,
        actorRole: req.user!.role,
        entries: req.body.entries,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : error.code === 'NOTES_ALREADY_SUBMITTED' ? 409 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/sessions/:sessionId/anonymat/notes/submit', requireAuth, async (req, res, next) => {
    try {
      const result = await soumettreCorrection.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        correcteurId: req.user!.userId,
        actorRole: req.user!.role,
        actorStaffPermissions: req.user!.permissions,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.post('/sessions/:sessionId/anonymat/reconcile', requireAuth, async (req, res, next) => {
    try {
      const result = await reconcilierNotes.execute({
        schoolId: req.user!.schoolId,
        sessionId: req.params.sessionId,
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        actorStaffPermissions: req.user!.permissions,
        forceLock: req.body.forceLock,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof AnonymatDomainError) {
        const status = error.code === 'FORBIDDEN_MANAGE_ANONYMAT' ? 403 : error.code === 'SESSION_NOT_FOUND' ? 404 : error.code === 'SEQUENCE_REQUIRED' ? 400 : error.code === 'RECONCILE_FORBIDDEN' ? 403 : 400;
        res.status(status).json({ success: false, error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
