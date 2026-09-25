import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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
import type { SimulationEmploiDuTemps } from '@application/timetable/SimulerEmploiDuTempsUseCase';
import type { SeanceGroupeProposee, SeanceProposee, ContraintesDoucesOptions } from '@domain/ports/services/SchedulingSolverPort';
import { ConflitHoraireError } from '@domain/errors/ConflitHoraireError';
import { ConflitSalleError } from '@domain/errors/ConflitSalleError';
import { VolumeHoraireAPError } from '@domain/errors/VolumeHoraireAPError';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { inngest } from '@infrastructure/inngest/client/index.ts';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { logActivity } from '../../services/audit/ActivityLogService';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import type { ProposerEmploisDuTempsGlobalUseCase } from '@application/timetable/ProposerEmploisDuTempsGlobalUseCase';
import type { TimetableGenerationRunRepository } from '@domain/ports/repositories/TimetableGenerationRunRepository';

/** Schéma Zod des contraintes douces V2.5 — .strict() : toute clé inconnue → 400. */
const contraintesSchema = z.object({
  trouEnseignant: z.boolean().optional(),
  troisCoursConsecutifs: z.boolean().optional(),
  equilibrageSemaine: z.boolean().optional(),
  volumeMaxEnseignantParJour: z.number().int().positive().max(720).optional(),
  blocsDeuxHeures: z.boolean().optional(),
  poids: z.object({
    trou: z.number().positive().optional(),
    troisConsecutifs: z.number().positive().optional(),
    desequilibre: z.number().positive().optional(),
    volumeJour: z.number().positive().optional(),
  }).strict().optional(),
}).strict();

/** Schéma Zod des simulations « what if » V2.5 — .strict() : clé inconnue → 400. */
const simulationsSchema = z.object({
  indisponibilitesSupplementaires: z.array(z.object({
    teacherId: z.string(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
  })).optional(),
  sallesHorsService: z.array(z.string()).optional(),
  retraitHeures: z.array(z.object({
    subjectId: z.string(),
    heures: z.number().positive(),
  })).optional(),
}).strict();

export class TimetableController {
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
    private readonly proposerEmploiDuTemps: ProposerEmploiDuTempsUseCase,
    private readonly appliquerProposition: AppliquerPropositionEmploiDuTempsUseCase,
    private readonly simulerEmploiDuTemps: SimulerEmploiDuTempsUseCase,
      private readonly eventPublisher?: EventPublisher,
      private readonly appliquerLot?: AppliquerLotEmploiDuTempsUseCase,
      private readonly globalGeneration?: ProposerEmploisDuTempsGlobalUseCase,
     private readonly generationRuns?: TimetableGenerationRunRepository,
   ) {}

  proposeAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.globalGeneration) {
        res.status(503).json({ success: false, message: 'Génération globale indisponible' });
        return;
      }
      const { academicYearId, classIds } = req.body as { academicYearId?: string; classIds?: string[] };
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId requis' });
        return;
      }
      const run = await this.globalGeneration.lancer(req.user!.schoolId, academicYearId, req.user!.userId, classIds);
      void inngest.send({ name: 'timetable/generation.requested', data: { schoolId: req.user!.schoolId, runId: run.runId } }).catch(() => {});
      res.status(202).json({ success: true, data: run });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  getGenerationRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.generationRuns) {
        res.status(503).json({ success: false, message: 'Suivi de génération indisponible' });
        return;
      }
      await this.generationRuns.failStale(req.user!.schoolId, new Date(Date.now() - 5 * 60 * 1000));
      const run = await this.generationRuns.findById(req.params['runId'] as string, req.user!.schoolId);
      if (!run) {
        res.status(404).json({ success: false, message: 'Run de génération introuvable' });
        return;
      }
      res.json({ success: true, data: run });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  cancelGenerationRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.generationRuns) {
        res.status(503).json({ success: false, message: 'Annulation indisponible' });
        return;
      }
      await this.generationRuns.markCancelled(req.params['runId'] as string, req.user!.schoolId);
      res.json({ success: true, message: 'Annulation demandée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

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
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'publier_emploi_du_temps', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { timetableId: req.params['id'] },
      });
      res.json({ success: true, message: 'Emploi du temps publié' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
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
      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'generer_seances_groupe', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { groupSetId: req.body?.groupSetId, nbSeances: resultat.creneauxCrees.length },
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'generer_seances_groupe', targetType: 'Timetable', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // POST /timetables/:id/propose-schedule — calcule une proposition, n'écrit RIEN.
  proposerEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;

      // Contraintes douces V2.5 — optionnelles, validées strictement (aucune clé inconnue).
      let contraintes: ContraintesDoucesOptions | undefined;
      if (req.body?.contraintes !== undefined) {
        const parsed = contraintesSchema.safeParse(req.body.contraintes);
        if (!parsed.success) {
          res.status(400).json({ success: false, message: 'contraintes invalides', details: parsed.error.issues });
          return;
        }
        contraintes = parsed.data;
      }

      const proposition = await this.proposerEmploiDuTemps.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        contraintes,
      });

      // INFAISABLE n'est pas une erreur technique : c'est un résultat métier exploitable
      // (la raison dit quoi corriger). 422 plutôt qu'une exception opaque.
      if (proposition.statut === 'INFAISABLE') {
        res.status(422).json({
          success: false,
          code: 'PLANIFICATION_INFAISABLE',
          message: proposition.raisonInfaisabilite,
          data: proposition,
        });
        return;
      }

      res.json({ success: true, data: proposition });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /timetables/:id/apply-schedule — écrit la proposition confirmée, en TOUT OU RIEN.
  appliquerPropositionEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
       const { seances, seancesGroupes } = req.body as { seances?: SeanceProposee[]; seancesGroupes?: SeanceGroupeProposee[] };

       if (!Array.isArray(seances) || (seancesGroupes !== undefined && !Array.isArray(seancesGroupes))) {
         res.status(400).json({ success: false, message: 'seances[] requis et seancesGroupes[] doit être un tableau' });
         return;
       }

       const resultat = await this.appliquerProposition.execute({
         timetableId: req.params['id'] as string,
         schoolId: user.schoolId,
         seances,
         seancesGroupes,
       });

      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'appliquer_proposition_emploi_du_temps', targetType: 'Timetable',
        targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { creneauxCrees: resultat.creneauxCrees },
      });
      void logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Proposition EDT appliquée', details: `EDT ${req.params['id']} : ${resultat.creneauxCrees} créneaux` });

      // V2.5 — événement APRÈS la transaction (jamais dedans) : les séances sont écrites, on
      // notifie l'écosystème (AssessmentScheduled si une matière d'examen à venir est concernée).
      void this.eventPublisher?.emit('timetable/seances.appliquees', {
        schoolId: user.schoolId,
        timetableId: req.params['id'] as string,
         nbSeances: seances.length + (seancesGroupes?.length ?? 0),
         seances,
         seancesGroupes,
      } as unknown as Record<string, unknown>)?.catch((err) => console.error('[TimetableController] Échec envoi timetable/seances.appliquees:', (err as Error)?.message));

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'appliquer_proposition_emploi_du_temps', targetType: 'Timetable',
        targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: { nbSeances: (req.body as { seances?: unknown[] })?.seances?.length },
      });
      this.gererErreur(error, res, next);
    }
  };

  appliquerLotEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.appliquerLot) {
        res.status(503).json({ success: false, message: 'Application globale indisponible' });
        return;
      }
      const { propositions } = req.body as { propositions?: Array<{ timetableId: string; seances: SeanceProposee[]; seancesGroupes?: SeanceGroupeProposee[] }> };
      if (!Array.isArray(propositions) || propositions.length === 0) {
        res.status(400).json({ success: false, message: 'propositions[] requis' });
        return;
      }
      const resultat = await this.appliquerLot.execute({ schoolId: req.user.schoolId, propositions });
      journaliserActionIA(prisma, {
        actorUserId: req.user.userId,
        actorRole: req.user.role,
        schoolId: req.user.schoolId,
        actionName: 'appliquer_lot_emploi_du_temps',
        targetType: 'TimetableBatch',
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { timetableIds: propositions.map(item => item.timetableId), creneauxCrees: resultat.creneauxCrees },
      });
      for (const proposition of propositions) {
        void this.eventPublisher?.emit('timetable/seances.appliquees', {
          schoolId: req.user.schoolId,
          timetableId: proposition.timetableId,
          nbSeances: proposition.seances.length + (proposition.seancesGroupes?.length ?? 0),
          seances: proposition.seances,
          seancesGroupes: proposition.seancesGroupes,
        } as unknown as Record<string, unknown>)?.catch((error) => console.error('[TimetableController] Échec envoi timetable/seances.appliquees:', (error as Error).message));
      }
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId,
        actorRole: req.user?.role,
        schoolId: req.user?.schoolId,
        actionName: 'appliquer_lot_emploi_du_temps',
        targetType: 'TimetableBatch',
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
      });
      this.gererErreur(error, res, next);
    }
  };

  // POST /timetables/:id/what-if — simule une modification SANS rien écrire.
  simulerEDT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const parsed = simulationsSchema.safeParse(req.body?.simulations);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: 'simulations invalides', details: parsed.error.issues });
        return;
      }
      const resultat = await this.simulerEmploiDuTemps.execute({
        timetableId: req.params['id'] as string,
        schoolId: user.schoolId,
        simulations: parsed.data as SimulationEmploiDuTemps,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
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

      const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { subsystem: true } })
      const lang = resolveLanguage(school?.subsystem)
      await this.demanderRattrapage.execute({
        schoolId: user.schoolId,
        classId,
        subjectId,
        teacherId: user.userId,
        proposedDate: new Date(proposedDate),
        proposedStartTime,
        proposedEndTime,
        reason,
        lang,
      });

      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'demander_rattrapage', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, statut: 'pending' });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'demander_rattrapage', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof ConflitHoraireError) {
      res.status(409).json({ success: false, code: 'CONFLIT_HORAIRE', message: error.message });
      return;
    }
    if (error instanceof ConflitSalleError) {
      res.status(409).json({ success: false, code: 'CONFLIT_SALLE', message: error.message });
      return;
    }
    if (error instanceof VolumeHoraireAPError) {
      res.status(409).json({ success: false, code: 'VOLUME_AP_DEPASSE', message: error.message });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('Génération globale déjà en cours')) {
        res.status(409).json({ success: false, code: 'RUN_ACTIF', message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('existent déjà') ||
        error.message.includes('déjà publié') ||
        error.message.includes('déjà soumis') ||
        error.message.startsWith('Aucun EDT en attente')
      ) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Impossible') ||
        error.message.includes('doit être soumis') ||
        error.message.includes('peut être rouvert') ||
        error.message.includes('Proposition vide') ||
        error.message.startsWith('Proposition invalide') ||
        error.message.startsWith('Règle pédagogique bloquante') ||
        error.message.startsWith('Aucun')
      ) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Accès refusé') ||
        error.message.includes("n'appartient pas")
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
