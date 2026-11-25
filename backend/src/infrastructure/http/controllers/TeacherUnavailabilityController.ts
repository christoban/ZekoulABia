import type { Request, Response, NextFunction } from 'express';
import type { CreerIndisponibiliteEnseignantUseCase } from '@application/timetable/CreerIndisponibiliteEnseignantUseCase';
import type { ModifierIndisponibiliteEnseignantUseCase } from '@application/timetable/ModifierIndisponibiliteEnseignantUseCase';
import type { SupprimerIndisponibiliteEnseignantUseCase } from '@application/timetable/SupprimerIndisponibiliteEnseignantUseCase';
import type { ListerIndisponibilitesEnseignantUseCase } from '@application/timetable/ListerIndisponibilitesEnseignantUseCase';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

export class TeacherUnavailabilityController {
  constructor(
    private readonly creer: CreerIndisponibiliteEnseignantUseCase,
    private readonly modifier: ModifierIndisponibiliteEnseignantUseCase,
    private readonly supprimer: SupprimerIndisponibiliteEnseignantUseCase,
    private readonly lister: ListerIndisponibilitesEnseignantUseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  listerIndisponibilites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.lister.execute({
        schoolId: user.schoolId,
        teacherId: (req.query.teacherId as string) || undefined,
        includeInactive: req.query.includeInactive === 'true',
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  creerIndisponibilite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        teacherId: req.body.teacherId as string,
        dayOfWeek: req.body.dayOfWeek as number,
        startTime: req.body.startTime as string,
        endTime: req.body.endTime as string,
        reason: req.body.reason as string | undefined,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'creer_indisponibilite_enseignant', targetType: 'TeacherUnavailability',
        targetId: resultat.id, origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_indisponibilite_enseignant', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  modifierIndisponibilite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifier.execute({
        id: req.params.id as string,
        schoolId: user.schoolId,
        dayOfWeek: req.body.dayOfWeek as number | undefined,
        startTime: req.body.startTime as string | undefined,
        endTime: req.body.endTime as string | undefined,
        reason: req.body.reason as string | null | undefined,
        active: req.body.active as boolean | undefined,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'modifier_indisponibilite_enseignant', targetType: 'TeacherUnavailability',
        targetId: req.params.id as string, origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Indisponibilité mise à jour' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'modifier_indisponibilite_enseignant', targetType: 'TeacherUnavailability',
        targetId: req.params.id as string, origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  supprimerIndisponibilite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        id: req.params.id as string,
        schoolId: user.schoolId,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'supprimer_indisponibilite_enseignant', targetType: 'TeacherUnavailability',
        targetId: req.params.id as string, origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Indisponibilité supprimée' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'supprimer_indisponibilite_enseignant', targetType: 'TeacherUnavailability',
        targetId: req.params.id as string, origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('chevauchement')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes("n'appartient pas") || error.message.includes("n'est pas un enseignant")) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Accès refusé') || error.message.includes('hors de votre')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('invalide') || error.message.includes('obligatoire') || error.message.includes('doit être avant')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('déjà inactive') || error.message.includes('déjà active')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}