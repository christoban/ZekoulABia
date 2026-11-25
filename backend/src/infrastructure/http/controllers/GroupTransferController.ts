import type { Request, Response, NextFunction } from 'express';
import { messageErreur } from '@application/shared/messageErreur';
import { CreerDemandeTransfertGroupeUseCase } from '../../../application/schoolGroup/CreerDemandeTransfertGroupeUseCase';
import { ListerDemandesTransfertGroupeUseCase } from '../../../application/schoolGroup/ListerDemandesTransfertGroupeUseCase';
import { RechercherPersonneEcoleGroupeUseCase } from '../../../application/schoolGroup/RechercherPersonneEcoleGroupeUseCase';

export class GroupTransferController {
  constructor(
    private readonly creerDemandeUseCase: CreerDemandeTransfertGroupeUseCase,
    private readonly listerUseCase: ListerDemandesTransfertGroupeUseCase,
    private readonly rechercherUseCase: RechercherPersonneEcoleGroupeUseCase,
  ) {}

  creerDemande = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { id: ownerId, groupId } = req.groupOwner!;
      if (!groupId) {
        res.status(400).json({ success: false, message: "Vous n'êtes rattaché à aucun groupe" });
        return;
      }
      const { type, sourceSchoolId, targetSchoolId, sourceUserId } = req.body;
      if (!type || !sourceSchoolId || !targetSchoolId || !sourceUserId) {
        res.status(400).json({ success: false, message: 'Champs requis manquants' });
        return;
      }
      const demande = await this.creerDemandeUseCase.execute({
        groupId, requestedByOwnerId: ownerId, type, sourceSchoolId, targetSchoolId, sourceUserId,
      });
      res.status(201).json({ success: true, data: demande });
    } catch (error) {
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  lister = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { groupId } = req.groupOwner!;
      if (!groupId) {
        res.json({ success: true, data: [] });
        return;
      }
      const data = await this.listerUseCase.execute(groupId);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  rechercherPersonne = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { groupId } = req.groupOwner!;
      if (!groupId) {
        res.json({ success: true, data: [] });
        return;
      }
      const schoolId = String(req.query.schoolId || '');
      const role = String(req.query.role || '');
      const recherche = String(req.query.q || '');
      if (role !== 'STUDENT' && role !== 'TEACHER') {
        res.status(400).json({ success: false, message: 'role doit être STUDENT ou TEACHER' });
        return;
      }
      const data = await this.rechercherUseCase.execute({ groupId, schoolId, role, recherche });
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };
}
