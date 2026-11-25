import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import { SoumettreChoixLV2EleveUseCase } from '@application/lv2Choice/SoumettreChoixLV2EleveUseCase';
import { SaisirChoixLV2ManuelUseCase } from '@application/lv2Choice/SaisirChoixLV2ManuelUseCase';
import { AppliquerChoixLV2UseCase } from '@application/lv2Choice/AppliquerChoixLV2UseCase';
import { SuivreFenetreChoixLV2UseCase } from '@application/lv2Choice/SuivreFenetreChoixLV2UseCase';
import { notifyLv2WindowOpenSms } from '@infrastructure/services/sms/SmsNotificationService';

export class Lv2ChoiceController {
  constructor(
    private readonly lv2Repository: Lv2ChoiceRepository,
    private readonly ouvrirFenetre: OuvrirFenetreChoixLV2UseCase,
    private readonly soumettreChoix: SoumettreChoixLV2EleveUseCase,
    private readonly saisirManuel: SaisirChoixLV2ManuelUseCase,
    private readonly appliquerChoix: AppliquerChoixLV2UseCase,
    private readonly suivreFenetre: SuivreFenetreChoixLV2UseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  // POST /api/v2/lv2-choice-windows
  creerFenetre = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const { level, academicYearId, openDate, closeDate } = req.body as {
        level: string; academicYearId: string; openDate: string; closeDate: string;
      };
      if (!level || !academicYearId || !openDate || !closeDate) {
        res.status(400).json({ success: false, message: 'level, academicYearId, openDate, closeDate requis' });
        return;
      }
      const result = await this.ouvrirFenetre.execute({
        schoolId, level, academicYearId,
        openDate: new Date(openDate), closeDate: new Date(closeDate),
      });
      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'ouvrir_fenetre_choix_lv2', targetType: 'Lv2ChoiceWindow', targetId: result.windowId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: result });
      for (const e of result.eleves) {
        void notifyLv2WindowOpenSms({
          schoolId, studentUserId: e.studentUserId, studentName: e.studentName, level: result.level, closeDate: result.closeDate,
        });
      }
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'ouvrir_fenetre_choix_lv2', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  };

  // GET /api/v2/lv2-choice-windows/:id/tracking
  suivi = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const windowId = String(req.params['id']);
      const result = await this.suivreFenetre.execute({ schoolId, windowId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // POST /api/v2/lv2-choice-windows/:id/manual-submission
  saisieManuelle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const submittedByUserId = req.user!.userId;
      const windowId = String(req.params['id']);
      const { studentProfileId, chosenSubjectId } = req.body as {
        studentProfileId: string; chosenSubjectId: string;
      };
      if (!studentProfileId || !chosenSubjectId) {
        res.status(400).json({ success: false, message: 'studentProfileId et chosenSubjectId requis' });
        return;
      }
      await this.saisirManuel.execute({ schoolId, windowId, studentProfileId, chosenSubjectId, submittedByUserId });
      res.json({ success: true, message: 'Choix enregistré' });
    } catch (err) { next(err); }
  };

  // GET /api/v2/lv2-choice-windows — liste des fenêtres de l'établissement
  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const windows = await this.lv2Repository.listerFenetres(schoolId);
      res.json({ success: true, data: windows });
    } catch (err) { next(err); }
  };

  // POST /api/v2/lv2-choice-windows/:id/apply
  appliquer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const windowId = String(req.params['id']);
      const result = await this.appliquerChoix.execute({ schoolId, windowId });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  };

  // GET /api/v2/students/me/lv2-choice-window (élève)
  fenetreEleve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId = req.user!.userId;

      const profile = await this.lv2Repository.trouverProfilEleveAvecClasse(userId, schoolId);
      if (!profile) {
        res.status(404).json({ success: false, message: 'Profil élève introuvable' });
        return;
      }
      if (!profile.classId || !profile.level) {
        res.status(404).json({ success: false, message: 'Classe introuvable' });
        return;
      }

      const window = await this.lv2Repository.trouverFenetreOuverteParNiveauExacte(schoolId, profile.level);

      if (!window) {
        res.json({ success: true, data: null });
        return;
      }

      const submission = await this.lv2Repository.trouverSoumission(window.id, profile.id);
      const lv2Subjects = await this.lv2Repository.listerMatieresLV2(schoolId);

      res.json({
        success: true,
        data: {
          window: { id: window.id, level: window.level, openDate: window.openDate, closeDate: window.closeDate },
          currentChoice: submission ? { subjectId: submission.chosenSubjectId, subjectName: submission.chosenSubject?.name } : null,
          availableSubjects: lv2Subjects,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/students/me/lv2-choice (élève soumet)
  soumettreEleve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.user!.userId;
      const { chosenSubjectId } = req.body as { chosenSubjectId: string };
      if (!chosenSubjectId) {
        res.status(400).json({ success: false, message: 'chosenSubjectId requis' });
        return;
      }
      await this.soumettreChoix.execute({ schoolId, studentUserId, chosenSubjectId });
      res.json({ success: true, message: 'Choix enregistré' });
    } catch (err) { next(err); }
  };
}
