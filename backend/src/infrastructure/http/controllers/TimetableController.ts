import type { Request, Response, NextFunction } from 'express';
import type { CreerEmploiDuTempsUseCase } from '@application/timetable/CreerEmploiDuTempsUseCase';
import type { AjouterCreneauUseCase } from '@application/timetable/AjouterCreneauUseCase';
import type { ModifierCreneauUseCase } from '@application/timetable/ModifierCreneauUseCase';
import type { SupprimerCreneauUseCase } from '@application/timetable/SupprimerCreneauUseCase';
import type { ViderCreneauxClasseUseCase } from '@application/timetable/ViderCreneauxClasseUseCase';
import type { SoumettreEmploiDuTempsUseCase } from '@application/timetable/SoumettreEmploiDuTempsUseCase';
import type { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import type { PublierTousEmploisDuTempsUseCase } from '@application/timetable/PublierTousEmploisDuTempsUseCase';
import type { RouvrirEmploiDuTempsUseCase } from '@application/timetable/RouvrirEmploiDuTempsUseCase';
import type { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import type { GenererSeancesGroupeUseCase } from '@application/timetable/GenererSeancesGroupeUseCase';
import type { ProposerEmploiDuTempsUseCase } from '@application/timetable/ProposerEmploiDuTempsUseCase';
import type { AppliquerPropositionEmploiDuTempsUseCase } from '@application/timetable/AppliquerPropositionEmploiDuTempsUseCase';
import type { AppliquerLotEmploiDuTempsUseCase } from '@application/timetable/AppliquerLotEmploiDuTempsUseCase';
import type { SimulerEmploiDuTempsUseCase } from '@application/timetable/SimulerEmploiDuTempsUseCase';
import type { ProposerEmploisDuTempsGlobalUseCase } from '@application/timetable/ProposerEmploisDuTempsGlobalUseCase';
import type { TimetableGenerationRunRepository } from '@domain/ports/repositories/TimetableGenerationRunRepository';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { TimetableSolverDelegate, gererTimetableErreur } from './helpers/TimetableSolverDelegate';

export class TimetableController {
  private readonly solverDelegate: TimetableSolverDelegate;

  constructor(
    private readonly creer: CreerEmploiDuTempsUseCase,
    private readonly ajouterCreneau: AjouterCreneauUseCase,
    private readonly modifierCreneau: ModifierCreneauUseCase,
    private readonly supprimerCreneau: SupprimerCreneauUseCase,
    private readonly viderCreneaux: ViderCreneauxClasseUseCase,
    private readonly soumettre: SoumettreEmploiDuTempsUseCase,
    private readonly publier: PublierEmploiDuTempsUseCase,
    private readonly publierTous: PublierTousEmploisDuTempsUseCase,
    private readonly rouvrir: RouvrirEmploiDuTempsUseCase,
    private readonly demanderRattrapage: DemanderRattrapageUseCase,
    private readonly genererSeances: GenererSeancesGroupeUseCase,
    proposerEmploiDuTemps: ProposerEmploiDuTempsUseCase,
    appliquerProposition: AppliquerPropositionEmploiDuTempsUseCase,
    simulerEmploiDuTemps: SimulerEmploiDuTempsUseCase,
    eventPublisher?: EventPublisher,
    appliquerLot?: AppliquerLotEmploiDuTempsUseCase,
    globalGeneration?: ProposerEmploisDuTempsGlobalUseCase,
    generationRuns?: TimetableGenerationRunRepository,
  ) {
    this.solverDelegate = new TimetableSolverDelegate(
      proposerEmploiDuTemps,
      appliquerProposition,
      simulerEmploiDuTemps,
      eventPublisher,
      appliquerLot,
      globalGeneration,
      generationRuns,
    );
  }

  proposeAll = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.proposeAll(req, res, next);

  getGenerationRun = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.getGenerationRun(req, res, next);

  getActiveGenerationRun = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.getActiveGenerationRun(req, res, next);

  cancelGenerationRun = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.cancelGenerationRun(req, res, next);

  proposerEDT = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.proposerEDT(req, res, next);

  proposerEDTAsync = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.proposerEDTAsync(req, res, next);

  appliquerPropositionEDT = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.appliquerPropositionEDT(req, res, next);

  appliquerLotEDT = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.appliquerLotEDT(req, res, next);

  simulerEDT = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.solverDelegate.simulerEDT(req, res, next);

  creerManuel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, academicYearId } = req.body;

      if (!classId || !academicYearId) {
        res.status(400).json({ success: false, message: 'classId et academicYearId requis' });
        return;
      }

      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        classId,
        academicYearId,
      });
      res.status(resultat.estNouveauCree ? 201 : 200).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  ajouterSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.ajouterCreneau.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  modifierSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.modifierCreneau.execute({
        creneauId: req.params['slotId'] as string,
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      res.json({ success: true, message: 'Créneau mis à jour', data: resultat.toObject() });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimerCreneau.execute({
        creneauId: req.params['slotId'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });
      res.json({ success: true, message: 'Créneau supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  viderCreneauxEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const nombreSupprimes = await this.viderCreneaux.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });
      res.json({ success: true, message: `${nombreSupprimes} créneau(x) vidé(s)`, data: { nombreSupprimes } });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  soumettreEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.soumettre.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
        demandeurRole: user.role,
        demandeurPermissions: user.permissions ?? [],
      });
      res.json({ success: true, message: 'Emploi du temps soumis' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  publierEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.publier.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
        demandeurRole: user.role,
      });
      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'publier_emploi_du_temps', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { timetableId: req.params['id'] },
      });
      res.json({ success: true, message: 'Emploi du temps publié' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'publier_emploi_du_temps', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  publierTousEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.publierTous.execute({
        schoolId: user.schoolId,
        demandeurId: user.userId,
        demandeurRole: user.role,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  rouvrirEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.rouvrir.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
        demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Emploi du temps rouvert' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  genererSeancesGroupe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.genererSeances.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'generer_seances_groupe', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { groupSetId: req.body?.groupSetId, nbSeances: resultat.creneauxCrees.length },
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'generer_seances_groupe', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  demanderCours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, proposedDate, proposedStartTime, proposedEndTime, reason } = req.body;

      if (!classId || !proposedDate) {
        res.status(400).json({ success: false, message: 'classId et proposedDate requis' });
        return;
      }

      await this.demanderRattrapage.execute({
        schoolId: user.schoolId,
        classId,
        subjectId,
        teacherId: user.userId,
        proposedDate: new Date(proposedDate),
        proposedStartTime,
        proposedEndTime,
        reason,
      });

      journaliserActionIA({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'demander_rattrapage', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, statut: 'pending' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'demander_rattrapage', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    gererTimetableErreur(error, res, next);
  }
}
