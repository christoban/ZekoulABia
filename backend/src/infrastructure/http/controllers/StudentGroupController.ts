import type { Request, Response, NextFunction } from 'express';
import type { CreerStudentGroupSetUseCase } from '@application/studentGroup/CreerStudentGroupSetUseCase';
import type { ModifierStudentGroupSetUseCase } from '@application/studentGroup/ModifierStudentGroupSetUseCase';
import type { SupprimerStudentGroupSetUseCase } from '@application/studentGroup/SupprimerStudentGroupSetUseCase';
import type { CreerStudentGroupUseCase } from '@application/studentGroup/CreerStudentGroupUseCase';
import type { ModifierStudentGroupUseCase } from '@application/studentGroup/ModifierStudentGroupUseCase';
import type { SupprimerStudentGroupUseCase } from '@application/studentGroup/SupprimerStudentGroupUseCase';

export class StudentGroupController {
  constructor(
    private readonly creerGroupSet: CreerStudentGroupSetUseCase,
    private readonly modifierGroupSet: ModifierStudentGroupSetUseCase,
    private readonly supprimerGroupSet: SupprimerStudentGroupSetUseCase,
    private readonly creerGroup: CreerStudentGroupUseCase,
    private readonly modifierGroup: ModifierStudentGroupUseCase,
    private readonly supprimerGroup: SupprimerStudentGroupUseCase,
  ) {}

  creerStudentGroupSet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.creerGroupSet.execute({
        schoolId: user.schoolId, demandeurRole: user.role, ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifierStudentGroupSet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifierGroupSet.execute({
        groupSetId: req.params.id as string, schoolId: user.schoolId, demandeurRole: user.role, ...req.body,
      });
      res.json({ success: true, message: 'GroupSet mis à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerStudentGroupSet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimerGroupSet.execute({
        groupSetId: req.params.id as string, schoolId: user.schoolId, demandeurRole: user.role,
      });
      res.json({ success: true, message: 'GroupSet supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  creerStudentGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.creerGroup.execute({
        groupSetId: req.params.groupSetId as string, schoolId: user.schoolId, demandeurRole: user.role, ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifierStudentGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifierGroup.execute({
        groupId: req.params.id as string, schoolId: user.schoolId, demandeurRole: user.role, ...req.body,
      });
      res.json({ success: true, message: 'Group mis à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerStudentGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimerGroup.execute({
        groupId: req.params.id as string, schoolId: user.schoolId, demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Group supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Seul') || error.message.includes('refusé')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
