import type { Request, Response, NextFunction } from 'express';
import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import { AjouterCandidatsPebsUseCase } from '@application/pebsExam/AjouterCandidatsPebsUseCase';
import { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import { AppliquerTransfertPebsUseCase } from '@application/pebsExam/AppliquerTransfertPebsUseCase';
import { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import { ScannerListeCandidatsPebsUseCase } from '@application/pebsExam/ScannerListeCandidatsPebsUseCase';
import { DetecterAnomaliesPebsUseCase } from '@application/pebsExam/DetecterAnomaliesPebsUseCase';
import { notifyPebsSelectionSms } from '@infrastructure/services/sms/SmsNotificationService';
import XLSX from 'xlsx';

export class PebsExamController {
  constructor(
    private readonly _creerSession: CreerSessionPebsUseCase,
    private readonly _ajouterCandidats: AjouterCandidatsPebsUseCase,
    private readonly _calculerSelection: CalculerSelectionPebsUseCase,
    private readonly _appliquerTransfert: AppliquerTransfertPebsUseCase,
    private readonly _resumeSession: ResumeSessionPebsUseCase,
    private readonly _scannerListe: ScannerListeCandidatsPebsUseCase,
    private readonly _detecterAnomalies: DetecterAnomaliesPebsUseCase,
    private readonly pebsExamRepository: PebsExamRepository,
    private readonly audit: AIActionAuditPort,
  ) {}

  // GET /api/v2/pebs-exams — liste des sessions de l'établissement, toutes années/niveaux/statuts
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessions = await this.pebsExamRepository.listerSessions(schoolId);
      res.json({ success: true, data: sessions });
    } catch (err) { next(err); }
  };

  creer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, examDate, level, academicYearId, selectionThreshold, availableSeats, targetClassId } = req.body;
      if (!name || !examDate || !level || !academicYearId || !targetClassId) {
        res.status(400).json({ success: false, message: 'name, examDate, level, academicYearId, targetClassId requis' });
        return;
      }
      const result = await this._creerSession.execute({
        schoolId, name, examDate: new Date(examDate), level, academicYearId,
        selectionThreshold: selectionThreshold ?? undefined,
        availableSeats: availableSeats ?? undefined,
        targetClassId,
      });
      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        // Bug indépendant : execute() retourne { sessionId }, jamais `id` — le cast non typé
        // masquait un ciblage d'audit toujours undefined pour cette action.
        actionName: 'creer_session_selection_pebs', targetType: 'PebsExamSession', targetId: result.sessionId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'creer_session_selection_pebs', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  };

  ajouterCandidats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { studentProfileIds } = req.body as { studentProfileIds: string[] };
      if (!studentProfileIds || !Array.isArray(studentProfileIds)) {
        res.status(400).json({ success: false, message: 'studentProfileIds (array) requis' });
        return;
      }
      const result = await this._ajouterCandidats.execute({ schoolId, sessionId, studentProfileIds });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  importCandidats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const file = req.file as Express.Multer.File;
      if (!file) { res.status(400).json({ success: false, message: 'Fichier requis' }); return; }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      // Extraire les studentProfileIds ou matricules du fichier
      const ids = rows.map(r => String(r.studentProfileId || r.profileId || r.matricule || r.id || '').trim()).filter(Boolean);

      const result = await this._ajouterCandidats.execute({ schoolId, sessionId, studentProfileIds: ids });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  calculer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._calculerSelection.execute({ schoolId, sessionId });
      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'calculer_selection_pebs', targetType: 'PebsExamSession', targetId: sessionId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { sessionId },
      });
      res.json({ success: true, data: result });
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'calculer_selection_pebs', targetType: 'PebsExamSession', targetId: String(req.params['id']),
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  };

  appliquerTransfert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { confirmed } = req.body as { confirmed?: boolean };
      const result = await this._appliquerTransfert.execute({ schoolId, sessionId, confirmed: confirmed === true });

      if (!result.confirmed) {
        // Retourner le résumé pour confirmation
        const summary = await this._resumeSession.execute(schoolId, sessionId);
        const toTransfer = summary.candidates.filter(c => c.selectionResult === 'SELECTIONNE');
        res.json({
          success: true,
          data: {
            needsConfirmation: true,
            toTransfer: toTransfer.map(c => ({ id: c.studentProfileId, name: `${c.lastName} ${c.firstName}`, fromClass: c.currentClassName })),
            targetClassId: summary.session.targetClassId,
          },
        });
        return;
      }

      res.json({ success: true, data: result });
      for (const c of result.selectionnes) {
        void notifyPebsSelectionSms({ schoolId, studentUserId: c.studentUserId, studentName: c.studentName, selected: true });
      }
      for (const c of result.nonSelectionnes) {
        void notifyPebsSelectionSms({ schoolId, studentUserId: c.studentUserId, studentName: c.studentName, selected: false });
      }
    } catch (err) { next(err); }
  };

  scanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType?: string };
      if (!imageBase64) { res.status(400).json({ success: false, message: 'imageBase64 requis' }); return; }
      const result = await this._scannerListe.execute(schoolId, sessionId, imageBase64, mimeType);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  detecterAnomalies = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._detecterAnomalies.execute(schoolId, sessionId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  resume = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const result = await this._resumeSession.execute(schoolId, sessionId);
      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'resume_session_pebs', targetType: 'PebsExamSession', targetId: sessionId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { sessionId },
      });
      res.json({ success: true, data: result });
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'resume_session_pebs', targetType: 'PebsExamSession', targetId: String(req.params['id']),
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  };
}
