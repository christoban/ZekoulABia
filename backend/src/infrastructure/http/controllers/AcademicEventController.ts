import type { Request, Response, NextFunction } from 'express';
import type { CreerEvenementAcademiqueUseCase } from '@application/academicEvent/CreerEvenementAcademiqueUseCase';
import type { DeclencherEvenementUseCase } from '@application/academicEvent/DeclencherEvenementUseCase';
import type { AjusterFenetreEvenementUseCase } from '@application/academicEvent/AjusterFenetreEvenementUseCase';
import type { ListerEvenementsUseCase } from '@application/academicEvent/ListerEvenementsUseCase';
import type { ObtenirEvenementsActifsUseCase } from '@application/academicEvent/ObtenirEvenementsActifsUseCase';
import type { CloturerEvenementAcademiqueUseCase } from '@application/academicEvent/CloturerEvenementAcademiqueUseCase';

export class AcademicEventController {
  constructor(
    private readonly creerEvenement: CreerEvenementAcademiqueUseCase,
    private readonly declencherEvenement: DeclencherEvenementUseCase,
    private readonly ajusterFenetre: AjusterFenetreEvenementUseCase,
    private readonly listerEvenements: ListerEvenementsUseCase,
    private readonly obtenirEvenementsActifs: ObtenirEvenementsActifsUseCase,
    private readonly cloturerEvenement?: CloturerEvenementAcademiqueUseCase,
  ) {}

  // POST /api/v2/academic-events — ADMIN uniquement
  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { type, category, title, description, targetRoles, level, openDate, closeDate, concoursConfig } = req.body;
      if (!type || !category || !title || !Array.isArray(targetRoles)) {
        res.status(400).json({ success: false, message: 'type, category, title et targetRoles sont requis' });
        return;
      }
      const r = await this.creerEvenement.execute({
        schoolId: user.schoolId,
        createdById: user.userId,
        type, category, title,
        description,
        targetRoles,
        level,
        openDate: openDate ? new Date(openDate) : undefined,
        closeDate: closeDate ? new Date(closeDate) : undefined,
        concoursConfig: concoursConfig ? {
          ...concoursConfig,
          officialExamExpectedDate: concoursConfig.officialExamExpectedDate ? new Date(concoursConfig.officialExamExpectedDate) : undefined,
        } : undefined,
      });
      res.status(201).json({ success: true, data: r });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error?.message ?? 'Erreur' });
    }
  };

  // GET /api/v2/academic-events — vue de gestion Admin, tous statuts
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const evenements = await this.listerEvenements.execute(user.schoolId);
      res.json({ success: true, data: evenements });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/academic-events/active — centre d'événements, filtré par rôle de l'appelant
  actifs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const evenements = await this.obtenirEvenementsActifs.execute(user.schoolId, user.role.toUpperCase());
      res.json({ success: true, data: evenements });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/academic-events/:id/trigger — Type 2, déclenchement manuel
  declencher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { closeDate } = req.body as { closeDate?: string };
      const r = await this.declencherEvenement.execute({
        eventId: req.params.id as string,
        schoolId: user.schoolId,
        declencheParId: user.userId,
        closeDate: closeDate ? new Date(closeDate) : undefined,
      });
      res.json({ success: true, data: r });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error?.message ?? 'Erreur' });
    }
  };

  // PATCH /api/v2/academic-events/:id/window — Type 3, ajustement de la clôture
  ajusterCloture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { closeDate } = req.body;
      if (!closeDate) {
        res.status(400).json({ success: false, message: 'closeDate est requis' });
        return;
      }
      const r = await this.ajusterFenetre.execute({
        eventId: req.params.id as string,
        schoolId: user.schoolId,
        nouvelleCloture: new Date(closeDate),
      });
      res.json({ success: true, data: r });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error?.message ?? 'Erreur' });
    }
  };

  // POST /api/v2/academic-events/:id/close — ADMIN uniquement
  cloturer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      if (!this.cloturerEvenement) {
        res.status(500).json({ success: false, message: 'Service de clôture non configuré' });
        return;
      }
      const r = await this.cloturerEvenement.execute({
        eventId: req.params.id as string,
        schoolId: user.schoolId,
        clotureParId: user.userId,
      });
      res.json({ success: true, data: r });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error?.message ?? 'Erreur' });
    }
  };
}
