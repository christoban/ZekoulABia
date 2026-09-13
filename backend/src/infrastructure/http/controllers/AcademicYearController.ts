import type { Request, Response, NextFunction } from 'express';
import type { CreerAnneeAcademiqueUseCase } from '@application/academicYear/CreerAnneeAcademiqueUseCase';
import type { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import type { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import type { CloturerAnneeUseCase } from '@application/academicYear/CloturerAnneeUseCase';
import type { MettreAJourCalendrierUseCase } from '@application/academicYear/MettreAJourCalendrierUseCase';
import type { ProposerStructureAnneeSuivanteUseCase } from '@application/academicYear/ProposerStructureAnneeSuivanteUseCase';
import type { ValiderStructureAnneeSuivanteUseCase } from '@application/academicYear/ValiderStructureAnneeSuivanteUseCase';
import type { AnnulerStructureProposeeUseCase } from '@application/academicYear/AnnulerStructureProposeeUseCase';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export class AcademicYearController {
  constructor(
    private readonly creer: CreerAnneeAcademiqueUseCase,
    private readonly definirPeriode: DefinirPeriodeCouranteUseCase,
    private readonly verifierPrerequis: VerifierPrerequisClotureUseCase,
    private readonly cloturer: CloturerAnneeUseCase,
    private readonly mettreAJourCalendrier: MettreAJourCalendrierUseCase,
    private readonly proposerStructure: ProposerStructureAnneeSuivanteUseCase,
    private readonly validerStructure: ValiderStructureAnneeSuivanteUseCase,
    private readonly annulerStructure: AnnulerStructureProposeeUseCase,
    private readonly activityLog?: ActivityLogPort,
  ) {}

  creerAnnee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { name, startDate, endDate, isCurrent, creerPeriodesAutomatiquement } = req.body;

      if (!name || !startDate || !endDate) {
        res.status(400).json({ success: false, message: 'name, startDate et endDate requis' });
        return;
      }

      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent,
        creerPeriodesAutomatiquement,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  definirPeriodeCourante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.definirPeriode.definirPeriode(req.params['id'] as string, req.user!.schoolId);
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'definir_periode_courante', targetType: 'AcademicPeriod', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { academicPeriodId: req.params['id'] },
      });
      res.json({ success: true, message: 'Période courante définie' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'definir_periode_courante', targetType: 'AcademicPeriod', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      this.gererErreur(error, res, next);
    }
  };

  definirSequenceCourante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.definirPeriode.definirSequence(req.params['id'] as string, req.user!.schoolId);
      res.json({ success: true, message: 'Séquence courante définie' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  verifierAvantCloture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.verifierPrerequis.execute(req.params['id'] as string);
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'verifier_cloture_annee', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { academicYearId: req.params['id'] },
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'verifier_cloture_annee', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      next(error);
    }
  };

  cloturerAnnee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { force } = req.body;

      const resultat = await this.cloturer.execute({
        academicYearId: req.params['id'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
        force: force === true,
      });
      void this.activityLog?.log({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'PEDAGOGY_YEAR_CLOSE',
        details: `Clôture de l'année académique (ID: ${req.params['id']})`,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/academic-years/:id/propose-next-structure
  // :id = année en cours de clôture ; body.anneeSuivanteId = année cible (déjà créée séparément).
  proposerStructureAnneeSuivante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { anneeSuivanteId } = req.body as { anneeSuivanteId?: string };
      if (!anneeSuivanteId) {
        res.status(400).json({ success: false, message: 'anneeSuivanteId requis' });
        return;
      }

      const resultat = await this.proposerStructure.execute({
        schoolId: user.schoolId,
        anneeActuelleId: req.params['id'] as string,
        anneeSuivanteId,
      });
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'proposer_structure_annee_suivante', targetType: 'AcademicYear', targetId: anneeSuivanteId,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { anneeActuelleId: req.params['id'], anneeSuivanteId, nbClasses: resultat.classesProposees.length },
      });
      void this.activityLog?.log({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'PEDAGOGY_STRUCTURE_PROPOSE',
        details: `Proposition de la structure N+1 (${resultat.classesProposees.length} classes DRAFT pour l'année ID: ${anneeSuivanteId})`,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'proposer_structure_annee_suivante', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/academic-years/:id/validate-structure — :id = année suivante (celle avec les classes DRAFT)
  validerStructureAnneeSuivante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.validerStructure.execute({
        schoolId: user.schoolId,
        anneeSuivanteId: req.params['id'] as string,
      });
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'valider_structure_annee_suivante', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classesActivees: resultat.classesActivees },
      });
      void this.activityLog?.log({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'PEDAGOGY_STRUCTURE_VALIDATE',
        details: `Validation de la structure N+1 (${resultat.classesActivees} classes activées pour l'année ID: ${req.params['id']})`,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'valider_structure_annee_suivante', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/academic-years/:id/cancel-proposed-structure — :id = année suivante (celle avec les classes DRAFT)
  annulerStructureAnneeSuivante = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.annulerStructure.execute({
        schoolId: user.schoolId,
        anneeSuivanteId: req.params['id'] as string,
      });
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'annuler_structure_annee_suivante', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classesSupprimees: resultat.classesSupprimees },
      });
      void this.activityLog?.log({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'PEDAGOGY_STRUCTURE_CANCEL',
        details: `Annulation de la structure N+1 (${resultat.classesSupprimees} classes DRAFT supprimées pour l'année ID: ${req.params['id']})`,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'annuler_structure_annee_suivante', targetType: 'AcademicYear', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      this.gererErreur(error, res, next);
    }
  };

  mettreAJourCalendrierScolaire = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const { periodes } = req.body;

      if (!Array.isArray(periodes)) {
        res.status(400).json({ success: false, message: 'periodes[] requis' });
        return;
      }

      await this.mettreAJourCalendrier.execute({
        academicYearId: req.params['id'] as string,
        schoolId: user.schoolId,
        periodes,
      });
      res.json({ success: true, message: 'Calendrier mis à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('impossible') || error.message.includes('Clôture')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('existe déjà') || error.message.includes('déjà proposée') || error.message.includes('déjà été validée')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Accès refusé') || error.message.includes('archivée')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
