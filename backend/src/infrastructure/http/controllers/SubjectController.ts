import type { Request, Response, NextFunction } from 'express';
import type { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import type { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import type { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import type { DefinirCoefficientUseCase } from '@application/subject/DefinirCoefficientUseCase';
import type { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';

export class SubjectController {
  constructor(
    private readonly creer: CreerMatiereUseCase,
    private readonly modifier: ModifierMatiereUseCase,
    private readonly assignerEnseignant: AssignerEnseignantMatiereUseCase,
    private readonly definirCoefficient: DefinirCoefficientUseCase,
    private readonly supprimer: SupprimerMatiereUseCase,
  ) {}

  creerMatiere = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        // Bug indépendant : CreerMatiereResultat expose `matiereId`, jamais `id` — le cast
        // masquait un ciblage d'audit toujours undefined pour cette action.
        actionName: 'creer_matiere', targetType: 'Subject', targetId: resultat.matiereId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_matiere', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  modifierMatiere = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifier.execute({
        matiereId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'modifier_matiere', targetType: 'Subject', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Matière mise à jour' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'modifier_matiere', targetType: 'Subject', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  assignerOuRetirer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { subjectId, action } = req.body;

      if (!subjectId || !action) {
        res.status(400).json({ success: false, message: 'subjectId et action requis' });
        return;
      }

      await this.assignerEnseignant.execute({
        teacherUserId: req.params.teacherId as string,
        matiereId: subjectId,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        action,
      });

      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'assigner_enseignant_matiere', targetType: 'Subject', targetId: subjectId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { teacherUserId: req.params.teacherId, subjectId, action },
      });
      res.json({
        success: true,
        message: `Enseignant ${action === 'ASSIGNER' ? 'assigné' : 'retiré'}`,
      });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'assigner_enseignant_matiere', targetType: 'Subject', targetId: req.body?.subjectId,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: { teacherUserId: req.params.teacherId, ...req.body },
      });
      this.gererErreur(error, res, next);
    }
  };

  definirCoefficients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { coefficients } = req.body;

      if (!Array.isArray(coefficients) || coefficients.length === 0) {
        res.status(400).json({ success: false, message: 'coefficients[] requis' });
        return;
      }

      const resultat = await this.definirCoefficient.execute({
        schoolId: user.schoolId,
        subjectId: req.params.id as string,
        demandeurRole: user.role,
        coefficients,
      });

      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerMatiere = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        matiereId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurRole: user.role,
        demandeurId: user.userId,
      });
      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'supprimer_matiere', targetType: 'Subject', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, message: 'Matière mise à la corbeille' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'supprimer_matiere', targetType: 'Subject', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà') || error.message.includes('déjà assigné')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Seul') ||
        error.message.includes('refusé') ||
        error.message.includes('Permission')
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
