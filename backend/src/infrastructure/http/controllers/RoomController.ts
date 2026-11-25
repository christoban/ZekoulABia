import type { Request, Response, NextFunction } from 'express';
import type { CreerSalleUseCase } from '@application/room/CreerSalleUseCase';
import type { ModifierSalleUseCase } from '@application/room/ModifierSalleUseCase';
import type { SupprimerSalleUseCase } from '@application/room/SupprimerSalleUseCase';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

export class RoomController {
  constructor(
    private readonly creer: CreerSalleUseCase,
    private readonly modifier: ModifierSalleUseCase,
    private readonly supprimer: SupprimerSalleUseCase,
    private readonly audit: AIActionAuditPort,
  ) {}

  creerSalle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        ...req.body,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'creer_salle', targetType: 'Room', targetId: resultat.roomId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_salle', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  modifierSalle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifier.execute({
        roomId: req.params.id as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'modifier_salle', targetType: 'Room', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Salle mise à jour' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'modifier_salle', targetType: 'Room', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  supprimerSalle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        roomId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'supprimer_salle', targetType: 'Room', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Salle mise à la corbeille' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'supprimer_salle', targetType: 'Room', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà') || error.message.includes('déjà en maintenance') || error.message.includes('déjà désactivée') || error.message.includes('déjà active')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('refusé')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
