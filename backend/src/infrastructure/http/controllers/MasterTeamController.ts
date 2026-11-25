import type { NextFunction, Request, Response } from 'express';
import {
  CreerMembreEquipeMasterUseCase,
  ListerEquipeMasterUseCase,
  MasterTeamForbiddenError,
  ModifierMembreEquipeMasterUseCase,
  ReinitialiserMotDePasseMembreMasterUseCase,
  SupprimerMembreEquipeMasterUseCase,
} from '@application/masterAdmin/team/GererEquipeMasterUseCases';
import { MasterAdminNotFoundError, MasterAdminValidationError } from '@application/masterAdmin/errors';
import type { MasterRoleCode } from '@domain/ports/repositories/MasterTeamRepository';

export class MasterTeamController {
  constructor(
    private readonly listerUC: ListerEquipeMasterUseCase,
    private readonly creerUC: CreerMembreEquipeMasterUseCase,
    private readonly modifierUC: ModifierMembreEquipeMasterUseCase,
    private readonly reinitialiserMdpUC: ReinitialiserMotDePasseMembreMasterUseCase,
    private readonly supprimerUC: SupprimerMembreEquipeMasterUseCase,
  ) {}

  lister = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.listerUC.execute();
      res.json({ success: true, data });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser!;
      const { email, name, role, assignedSchoolIds } = req.body as {
        email?: string;
        name?: string;
        role?: MasterRoleCode;
        assignedSchoolIds?: string[];
      };

      const data = await this.creerUC.execute({
        actorId: master.id,
        actorIsOwner: Boolean(master.isOwner),
        ipAddress: req.ip,
        email: email ?? '',
        name: name ?? '',
        role: (role ?? 'PLATFORM_ADMIN') as MasterRoleCode,
        assignedSchoolIds: Array.isArray(assignedSchoolIds) ? assignedSchoolIds : [],
      });

      res.status(201).json({
        success: true,
        data: {
          member: data.member,
          temporaryPassword: data.motDePasseTemporaire,
          motDePasseTemporaire: data.motDePasseTemporaire,
          emailSent: data.emailSent,
        },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser!;
      const targetId = req.params.id as string;
      const { name, role, isActive, assignedSchoolIds } = req.body as {
        name?: string;
        role?: MasterRoleCode;
        isActive?: boolean;
        assignedSchoolIds?: string[];
      };

      const data = await this.modifierUC.execute({
        actorId: master.id,
        actorIsOwner: Boolean(master.isOwner),
        ipAddress: req.ip,
        targetId,
        name,
        role,
        isActive,
        assignedSchoolIds: Array.isArray(assignedSchoolIds) ? assignedSchoolIds : undefined,
      });

      res.json({ success: true, data });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  reinitialiserMotDePasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser!;
      const targetId = req.params.id as string;

      const data = await this.reinitialiserMdpUC.execute({
        actorId: master.id,
        actorIsOwner: Boolean(master.isOwner),
        targetId,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          member: data.member,
          temporaryPassword: data.motDePasseTemporaire,
          motDePasseTemporaire: data.motDePasseTemporaire,
          emailSent: data.emailSent,
        },
      });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = req.masterUser!;
      const targetId = req.params.id as string;

      await this.supprimerUC.execute({
        actorId: master.id,
        actorIsOwner: Boolean(master.isOwner),
        targetId,
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Compte Master supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof MasterTeamForbiddenError) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof MasterAdminValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof MasterAdminNotFoundError) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
}

