import type { Request, Response, NextFunction } from 'express';
import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { ModifierClasseUseCase } from '@application/class/ModifierClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerSousGroupeTPUseCase } from '@application/class/CreerSousGroupeTPUseCase';
import type { AssignerElevesAuSousGroupeUseCase } from '@application/class/AssignerElevesAuSousGroupeUseCase';
import type { AssignerSalleClasseUseCase } from '@application/studentGroup/AssignerSalleClasseUseCase';
import type { RetirerAssignationSalleUseCase } from '@application/studentGroup/RetirerAssignationSalleUseCase';
import type { ListerElevesClasseUseCase } from '@application/classe/ListerElevesClasseUseCase';
import type { GererMatiereClasseUseCase } from '@application/classe/GererMatiereClasseUseCase';
import type { GenererTableauHonneurUseCase } from '@application/classe/GenererTableauHonneurUseCase';
import type { GenererTableauHonneurAnnuelUseCase } from '@application/classe/GenererTableauHonneurAnnuelUseCase';
import { CYCLE2_LEVELS, parseSerie } from '@application/school/SubjectAssignmentHelper';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export class ClasseController {
  constructor(
    private readonly creer: CreerClasseUseCase,
    private readonly modifier: ModifierClasseUseCase,
    private readonly supprimer: SupprimerClasseUseCase,
    private readonly assignerProfesseur: AssignerProfesseurPrincipalUseCase,
    private readonly creerSousGroupe: CreerSousGroupeTPUseCase,
    private readonly assignerEleves: AssignerElevesAuSousGroupeUseCase,
    private readonly assignerSalle: AssignerSalleClasseUseCase,
    private readonly retirerAssignationSalle: RetirerAssignationSalleUseCase,
    private readonly audit: AIActionAuditPort,
    private readonly listerEleves: ListerElevesClasseUseCase,
    private readonly gererMatiere?: GererMatiereClasseUseCase,
    private readonly genererTableauHonneur?: GenererTableauHonneurUseCase,
    private readonly genererTableauHonneurAnnuel?: GenererTableauHonneurAnnuelUseCase,
    private readonly activityLog?: ActivityLogPort,
  ) {}

  creerClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const resultat = await this.creer.execute({
        schoolId: user.schoolId,
        ...req.body,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        // Bug indépendant : CreerClasseResultat expose `classeId`, jamais `id` — le cast `as
        // any` masquait un ciblage d'audit toujours undefined pour cette action.
        actionName: 'creer_classe', targetType: 'Class', targetId: resultat.classeId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      void this.activityLog?.log({
        userId: user.userId, schoolId: user.schoolId,
        action: 'PEDAGOGY_CLASS_CREATE',
        details: `Création de la classe ${req.body.name || ''} (ID: ${resultat.classeId})`,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  modifierClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.modifier.execute({
        classeId: req.params.id as string,
        schoolId: user.schoolId,
        ...req.body,
      });
      void this.activityLog?.log({
        userId: user.userId, schoolId: user.schoolId,
        action: 'PEDAGOGY_CLASS_UPDATE',
        details: `Modification de la classe ${req.params.id}`,
      });
      res.json({ success: true, message: 'Classe mise à jour' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  supprimerClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      await this.supprimer.execute({
        classeId: req.params.id as string,
        schoolId: user.schoolId,
        demandeurId: user.userId,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'supprimer_classe', targetType: 'Class', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      void this.activityLog?.log({
        userId: user.userId, schoolId: user.schoolId,
        action: 'PEDAGOGY_CLASS_DELETE',
        details: `Suppression de la classe ${req.params.id}`,
      });
      res.json({ success: true, message: 'Classe mise à la corbeille' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'supprimer_classe', targetType: 'Class', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  assignerProfesseurPrincipal = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const { teacherUserId } = req.body;
      const classeId = req.params.id as string;

      if (!teacherUserId) {
        res.status(400).json({ success: false, message: 'teacherUserId requis' });
        return;
      }

      await this.assignerProfesseur.execute({
        classeId,
        teacherUserId,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'assigner_professeur_principal', targetType: 'Class', targetId: classeId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classeId, teacherUserId },
      });
      void this.activityLog?.log({
        userId: user.userId, schoolId: user.schoolId,
        action: 'PEDAGOGY_PP_ASSIGN',
        details: `Affectation Professeur Principal ${teacherUserId} à la classe ${classeId}`,
      });
      res.json({ success: true, message: 'Professeur Principal assigné' });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'assigner_professeur_principal', targetType: 'Class', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  creerSousGroupeTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ success: false, message: 'name requis (ex: "Groupe A")' });
        return;
      }

      const resultat = await this.creerSousGroupe.execute({
        classeId: req.params.id as string,
        name,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  assignerElevesAuSousGroupe = async (
    req: Request, res: Response, next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const { studentProfileIds } = req.body;

      const resultat = await this.assignerEleves.execute({
        subGroupId: req.params.subGroupId as string,
        studentProfileIds,
        schoolId: user.schoolId,
        demandeurRole: user.role,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /:classId/subjects — Ajouter ou modifier une matière dans une classe
  // body: { subjectId, coefficient, classOnly?: boolean }
  // classOnly=true  → ClassSubjectOverride (uniquement cette classe)
  // classOnly=false → SubjectCoefficient   (toutes les classes du même niveau)
  ajouterMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = (req.params.classId ?? req.params.id) as string;
      const { subjectId, coefficient, classOnly } = req.body as { subjectId?: string; coefficient?: number; classOnly?: boolean };

      if (!subjectId || coefficient == null) {
        res.status(400).json({ success: false, message: 'subjectId et coefficient requis' });
        return;
      }

      if (!this.gererMatiere) {
        res.status(500).json({ success: false, message: 'Use case non configuré' });
        return;
      }

      const data = await this.gererMatiere.ajouter({ classId, subjectId, coefficient, classOnly, schoolId });
      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'ajouter_matiere_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { subjectId, coefficient, classOnly },
      });
      res.json({ success: true, data });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'ajouter_matiere_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /:classId/subjects/:subjectId — Retirer une matière d'une classe
  supprimerMatiereClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = (req.params.classId ?? req.params.id) as string;
      const subjectId = req.params.subjectId as string;

      if (!this.gererMatiere) {
        res.status(500).json({ success: false, message: 'Use case non configuré' });
        return;
      }

      const result = await this.gererMatiere.supprimer({ classId, subjectId, schoolId });
      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'supprimer_matiere_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { subjectId },
      });
      res.json({ success: true, message: result.message });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'supprimer_matiere_classe', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      this.gererErreur(error, res, next);
    }
  };

  // GET /:id/students — liste des élèves de la classe avec moyennes et taux de présence
  getStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const eleves = await this.listerEleves.execute({ classId: req.params.id as string, schoolId: user.schoolId });
      res.json({ success: true, data: eleves });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PUT /classes/:id/room-assignment — assigne/change la salle habituelle de la classe pour l'année
  assignerSalleClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { roomId, academicYearId } = req.body as { roomId?: string; academicYearId?: string };
      if (!roomId || !academicYearId) {
        res.status(400).json({ success: false, message: 'roomId et academicYearId requis' });
        return;
      }
      await this.assignerSalle.execute({
        classId: req.params.id as string, roomId, academicYearId,
        schoolId: user.schoolId, demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Salle habituelle assignée' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // DELETE /classes/:id/room-assignment?academicYearId= — retire la salle habituelle de la classe
  retirerAssignationSalleClasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const academicYearId = req.query['academicYearId'] as string | undefined;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId requis' });
        return;
      }
      await this.retirerAssignationSalle.execute({
        classId: req.params.id as string, academicYearId,
        schoolId: user.schoolId, demandeurRole: user.role,
      });
      res.json({ success: true, message: 'Assignation de salle retirée' });
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
      if (error.message.includes('introuvable') || error.message.includes('Aucun bulletin')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes('Seul') ||
        error.message.includes('refusé') ||
        error.message.includes('pas un enseignant')
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes("n'existe pas") ||
        error.message.includes('Aucune année académique') ||
        error.message.includes("n'enseigne aucune matière") ||
        error.message.includes('conseil') ||
        error.message.includes('periodId est requis')
      ) {
        res.status(400).json({ success: false, message: error.message, ...(error.message.includes("n'enseigne") ? { code: 'PP_SANS_MATIERE' } : {}) });
        return;
      }
    }
    next(error);
  }

  // GET /api/v2/classes/:id/tableau-honneur?periodId=&top=10
  tableauHonneur = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.genererTableauHonneur) {
        res.status(500).json({ success: false, message: 'Use case non configuré' });
        return;
      }
      const user = req.user;
      const classId = req.params.id as string;
      const academicPeriodId = (req.query.periodId ?? req.query.academicPeriodId) as string | undefined;
      const top = Math.min(20, Math.max(1, parseInt((req.query.top as string) || '10')));
      if (!academicPeriodId) {
        res.status(400).json({ success: false, message: 'periodId est requis' });
        return;
      }
      const pdf = await this.genererTableauHonneur.execute({ classId, schoolId: user.schoolId, academicPeriodId, top });
      // Filename derived from classId (className resolved inside use case); keep deterministic for controller
      const filename = `tableau-honneur-${classId}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /api/v2/classes/:id/tableau-honneur-annuel?top=10
  tableauHonneurAnnuel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.genererTableauHonneurAnnuel) {
        res.status(500).json({ success: false, message: 'Use case non configuré' });
        return;
      }
      const user = req.user;
      const classId = req.params.id as string;
      const top = Math.min(20, Math.max(1, parseInt((req.query.top as string) || '10')));
      const pdf = await this.genererTableauHonneurAnnuel.execute({ classId, schoolId: user.schoolId, top });
      const filename = `tableau-honneur-annuel-${classId}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };
}
