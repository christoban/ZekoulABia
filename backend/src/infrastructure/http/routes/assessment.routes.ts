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
import type { ListerSessionsCorrectionAnonymeUseCase } from '@application/assessment/ListerSessionsCorrectionAnonymeUseCase';
import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
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
  listerSessionsCorrection: ListerSessionsCorrectionAnonymeUseCase,
  sessionRepository: HarmonizedAssessmentSessionRepository,
  anonymatRepository: AnonymatRepository,
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

  router.post('/sessions/:sessionId/anonymat/codes', requireAuth, async (req, res, next) => {
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

  router.post('/sessions/:sessionId/anonymat/team', requireAuth, async (req, res, next) => {
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

  // GET /api/v2/assessments/sessions?classId=&subjectId=
  router.get('/sessions', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
      const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;

      const sessions = await sessionRepository.findBySchoolWithLabels(schoolId, { classId, subjectId });
      res.json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v2/assessments/anonymat/my-correction-sessions
  router.get('/anonymat/my-correction-sessions', requireAuth, async (req, res, next) => {
    try {
      const result = await listerSessionsCorrection.execute({
        schoolId: req.user!.schoolId,
        correcteurUserId: req.user!.userId,
      });
      // Enrich with subject/class names
      const enriched = await Promise.all(result.map(async (item) => {
        const session = await sessionRepository.findByIdWithLabels(item.sessionId, req.user!.schoolId);
        return {
          ...item,
          subjectName: session?.subjectName || '',
          classNames: item.classIds.map(cid => session?.className || cid),
        };
      }));
      res.json({ success: true, data: enriched });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v2/assessments/sessions/:sessionId/anonymat/team-progress
  router.get('/sessions/:sessionId/anonymat/team-progress', requireAuth, async (req, res, next) => {
    try {
      const progress = await anonymatRepository.countTeamMembersByStatus(req.params.sessionId);
      res.json({ success: true, data: progress });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
