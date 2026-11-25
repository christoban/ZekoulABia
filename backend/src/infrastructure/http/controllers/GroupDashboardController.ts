import type { Request, Response, NextFunction } from 'express';
import { messageErreur } from '@application/shared/messageErreur';
import { ObtenirKpisGroupeUseCase } from '../../../application/schoolGroup/ObtenirKpisGroupeUseCase';
import { ListerEcolesGroupeUseCase } from '../../../application/schoolGroup/ListerEcolesGroupeUseCase';
import { ObtenirDetailEcoleGroupeUseCase } from '../../../application/schoolGroup/ObtenirDetailEcoleGroupeUseCase';

export class GroupDashboardController {
  constructor(
    private readonly obtenirKpisUseCase: ObtenirKpisGroupeUseCase,
    private readonly listerEcolesUseCase: ListerEcolesGroupeUseCase,
    private readonly obtenirDetailEcoleUseCase: ObtenirDetailEcoleGroupeUseCase,
  ) {}

  obtenirKpis = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { groupId } = req.groupOwner!;
      if (!groupId) {
        res.json({ success: true, data: { parEcole: [], totaux: { effectifsTotal: 0, tauxReussiteGlobal: 0, revenusCumules: 0, tauxAbsenteismeGlobal: 0 } } });
        return;
      }
      const data = await this.obtenirKpisUseCase.execute(groupId);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  listerEcoles = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { groupId } = req.groupOwner!;
      if (!groupId) {
        res.json({ success: true, data: [] });
        return;
      }
      const data = await this.listerEcolesUseCase.execute(groupId);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };

  // Vérification d'appartenance systématique — schoolId dérivé du token (req.groupOwner.schoolIds),
  // jamais fait confiance au paramètre d'URL seul (Section 4 du plan).
  obtenirDetailEcole = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { schoolIds } = req.groupOwner!;
      const schoolId = String(req.params.schoolId);
      if (!schoolIds.includes(schoolId)) {
        res.status(403).json({ success: false, message: 'Cette école ne fait pas partie de votre groupe' });
        return;
      }
      const data = await this.obtenirDetailEcoleUseCase.execute(schoolId);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: messageErreur(error) || 'Erreur' });
    }
  };
}
