import type { Request, Response, NextFunction } from 'express';
import type { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import type { ListerCarnetEleveUseCase } from '@application/carnetLiaison/ListerCarnetEleveUseCase';
import type { MarquerEntreeCarnetLueUseCase } from '@application/carnetLiaison/MarquerEntreeCarnetLueUseCase';
import type { RepondreEntreeCarnetUseCase } from '@application/carnetLiaison/RepondreEntreeCarnetUseCase';
import type { RelancerParentsNonLusCarnetUseCase } from '@application/carnetLiaison/RelancerParentsNonLusCarnetUseCase';
import type { LiaisonCategory } from '@domain/types/enums';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

const CARNET_TEMPLATES = [
  { id: 'absence_notice', category: 'ABSENCE', titleFr: "Absence constatée en classe", titleEn: 'Classroom absence notice', requiresConfirmation: false },
  { id: 'positive_behavior', category: 'BEHAVIOR', titleFr: 'Félicitations / Bon comportement', titleEn: 'Good behavior commendation', requiresConfirmation: false },
  { id: 'behavior_warning', category: 'BEHAVIOR', titleFr: 'Observation sur le comportement', titleEn: 'Behavior notice', requiresConfirmation: true },
  { id: 'homework_missing', category: 'HOMEWORK', titleFr: 'Devoir non fait / Matériel manquant', titleEn: 'Missing homework / supplies', requiresConfirmation: false },
  { id: 'outing_authorization', category: 'AUTHORIZATION', titleFr: 'Autorisation de sortie scolaire', titleEn: 'Field trip authorization', requiresConfirmation: true },
  { id: 'parent_convocation', category: 'CONVOCATION', titleFr: 'Invitation / Rencontre parent-enseignant', titleEn: 'Parent-teacher meeting request', requiresConfirmation: true },
  { id: 'health_note', category: 'HEALTH', titleFr: 'Information santé / infirmerie', titleEn: 'Health / infirmary note', requiresConfirmation: false },
  { id: 'parent_justified_note', category: 'PARENT_NOTE', titleFr: 'Mot du parent (retard, absence, rendez-vous)', titleEn: 'Parent note (lateness, absence, appointment)', requiresConfirmation: false },
];

export class CarnetLiaisonController {
  constructor(
    private readonly creerEntree: CreerEntreeCarnetUseCase,
    private readonly listerCarnet: ListerCarnetEleveUseCase,
    private readonly marquerLue: MarquerEntreeCarnetLueUseCase,
    private readonly repondreEntree: RepondreEntreeCarnetUseCase,
    private readonly relancerParents: RelancerParentsNonLusCarnetUseCase,
    private readonly audit?: AIActionAuditPort,
  ) {}

  templates = (_req: Request, res: Response): void => {
    res.json({ success: true, data: CARNET_TEMPLATES });
  };

  parentInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { academicYearId, studentId } = req.query as { academicYearId?: string; studentId?: string };
      const data = await this.listerCarnet.listerBoiteUnifieeParent({
        parentUserId: user.userId,
        schoolId: user.schoolId,
        academicYearId,
        studentId,
      });
      res.json({ success: true, data });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  listerParEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const studentId = req.params.studentId as string;
      const { academicYearId, category } = req.query as { academicYearId?: string; category?: string };
      const entries = await this.listerCarnet.listerPourEleve({
        studentId,
        schoolId: user.schoolId,
        userId: user.userId,
        role: user.role,
        filtres: {
          academicYearId,
          category: category as LiaisonCategory | undefined,
        },
      });
      res.json({ success: true, data: entries });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  listerParClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const classId = req.params.classId as string;
      const { academicYearId, category } = req.query as { academicYearId?: string; category?: string };
      const entries = await this.listerCarnet.listerPourClasse({
        classId,
        schoolId: user.schoolId,
        role: user.role,
        filtres: {
          academicYearId,
          category: category as LiaisonCategory | undefined,
        },
      });
      res.json({ success: true, data: entries });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const body = req.body as {
        studentId?: string;
        studentIds?: string[];
        classId?: string;
        academicYearId?: string;
        category?: LiaisonCategory;
        title: string;
        content: string;
        requiresConfirmation?: boolean;
        confirmationPrompt?: string;
        isUrgent?: boolean;
        clientRecordedAt?: string;
      };

      const role = (user.role as string).toUpperCase();
      if (role === 'STUDENT') {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const result = await this.creerEntree.execute({
        schoolId: user.schoolId,
        authorId: user.userId,
        authorRole: role,
        studentId: body.studentId,
        studentIds: body.studentIds,
        classId: body.classId,
        academicYearId: body.academicYearId,
        category: body.category ?? 'INFO',
        title: body.title,
        content: body.content,
        requiresConfirmation: body.requiresConfirmation,
        confirmationPrompt: body.confirmationPrompt,
        isUrgent: body.isUrgent,
        clientRecordedAt: body.clientRecordedAt,
      });

      this.audit?.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId: user.schoolId,
        actionName: 'creer_entree_carnet',
        targetType: 'LiaisonEntry',
        targetId: result.entries[0]?.id,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { count: result.entries.length, category: body.category ?? 'INFO' },
      });

      res.status(201).json({
        success: true,
        data: result.entries.length === 1 ? result.entries[0] : result.entries,
        entries: result.entries,
        clockSkewWarning: result.clockSkewWarning,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  marquerLu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      await this.marquerLue.execute({
        entryId: req.params.id as string,
        schoolId: user.schoolId,
        userId: user.userId,
        role: user.role,
      });
      res.json({ success: true, message: 'Accusé de lecture enregistré' });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  repondre = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { confirmed, replyText, clientRecordedAt } = req.body as {
        confirmed?: boolean;
        replyText?: string;
        clientRecordedAt?: string;
      };
      const result = await this.repondreEntree.execute({
        entryId: req.params.id as string,
        schoolId: user.schoolId,
        authorId: user.userId,
        authorRole: user.role,
        confirmed,
        replyText,
        clientRecordedAt,
      });
      res.status(201).json({
        success: true,
        data: result.response,
        clockSkewWarning: result.clockSkewWarning,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  relancer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const result = await this.relancerParents.execute({
        entryId: req.params.id as string,
        schoolId: user.schoolId,
        role: user.role,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  private handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.startsWith('FORBIDDEN_')) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      if (error.message.startsWith('NOT_FOUND_')) {
        res.status(404).json({ success: false, message: 'Entrée du carnet introuvable' });
        return;
      }
      if (error.message.includes('requis') || error.message.includes('Aucun élève') || error.message.includes('un enfant')) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}

