import type { Request, Response, NextFunction } from 'express';
import type { CreerActionSuiviEleveUseCase } from '@application/suivi/CreerActionSuiviEleveUseCase';
import type { FollowUpActionType, InterviewMode, StudentFollowUpRepository } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { ClorreActionSuiviUseCase } from '@application/suivi/ClorreActionSuiviUseCase';
import type { ListerActionsEnCoursUseCase } from '@application/suivi/ListerActionsEnCoursUseCase';
import type { AssignerActionSuiviUseCase } from '@application/suivi/AssignerActionSuiviUseCase';
import type { ListerHistoriqueSuiviEleveUseCase } from '@application/suivi/ListerHistoriqueSuiviEleveUseCase';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { notifierUtilisateurPush } from '@infrastructure/services/notification/PushNotificationService';
import { notifierParentsPushDabord } from '@infrastructure/services/notification/PushFirstNotifier';
import { messageErreur } from '@application/shared/messageErreur';

const TITRES: Record<string, string> = {
  ENTRETIEN_PARENT: 'Entretien parent à programmer',
  SIGNALEMENT_CONSEILLER: 'Élève signalé pour suivi',
  OBSERVATION: 'Observation consignée',
  CONVOCATION_ELEVE: 'Convocation élève programmée',
};

export class StudentFollowUpController {
  constructor(
    private readonly creerActionSuivi: CreerActionSuiviEleveUseCase,
    private readonly clorreActionSuivi: ClorreActionSuiviUseCase,
    private readonly listerActionsEnCours: ListerActionsEnCoursUseCase,
    private readonly assignerActionSuivi: AssignerActionSuiviUseCase,
    private readonly listerHistoriqueEleve: ListerHistoriqueSuiviEleveUseCase,
    private readonly repo: StudentFollowUpRepository,
  ) {}

  // Liste des destinataires possibles pour "Signaler au conseiller" — MANAGE_ORIENTATION
  // (Conseiller d'Orientation / Guidance Counsellor, secondaire uniquement) OU
  // MANAGE_PEDAGOGICAL_BRIEF (Animateur/Conseiller Pédagogique, HOD — présent aussi au primaire),
  // les deux permissions qui donnent l'autorité pleine dans CreerActionSuiviEleveUseCase. Pas
  // d'annuaire staff générique dans le codebase, ajout minimal scopé au seul besoin de ce
  // formulaire. Peut renvoyer une liste vide pour le template EN_PRIMARY (aucun titre de ce
  // template ne porte l'une ou l'autre permission — gap pré-existant de StaffPermissionRules.ts,
  // pas de ce chantier).
  conseillersDisponibles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const conseillers = await this.repo.listConseillersDisponibles(schoolId);
      res.json({
        success: true,
        data: conseillers,
      });
    } catch (error) {
      next(error);
    }
  };

  // Même composition que notifierPersonnelDirect (inngest/functions.ts) — IN_APP persisté +
  // émis en direct, puis push séparé. Pas un nouveau canal, réutilisation du mécanisme existant
  // (B.6).
  private async notifier(userId: string, schoolId: string, titre: string, corps: string): Promise<void> {
    const socketService = new SocketNotificationService();
    await socketService
      .envoyer({ schoolId, userId, type: 'STUDENT_RISK_ALERT', titre, corps, urgency: 'NORMAL' })
      .catch((err) => console.error('[Suivi] notif IN_APP:', messageErreur(err)));
    await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
  }

  creer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { studentId, type, triggeringRecommendationId, subjectId, assignedToId, targetDate, interviewMode, note } = req.body as {
        studentId?: string; type?: string; triggeringRecommendationId?: string; subjectId?: string;
        assignedToId?: string; targetDate?: string; interviewMode?: string; note?: string;
      };
      if (!studentId || !type) { res.status(400).json({ success: false, message: 'studentId et type requis' }); return; }
      // Le switch interne de CreerActionSuiviEleveUseCase n'a pas de `default` — un type hors
      // énumération n'y déclenche aucune vérification d'autorisation (donc rien d'exécuté),
      // mais échouait ensuite silencieusement en erreur Prisma peu claire (500) à la
      // persistance. Le cast cast non typé masquait cette absence de validation en amont.
      const TYPES_VALIDES: FollowUpActionType[] = ['ENTRETIEN_PARENT', 'SIGNALEMENT_CONSEILLER', 'OBSERVATION', 'CONVOCATION_ELEVE'];
      if (!TYPES_VALIDES.includes(type as FollowUpActionType)) {
        res.status(400).json({ success: false, message: `type doit être : ${TYPES_VALIDES.join(', ')}` });
        return;
      }
      const MODES_VALIDES: InterviewMode[] = ['DATE_PROPOSEE', 'DEMANDE_DISPONIBILITE'];
      if (interviewMode !== undefined && !MODES_VALIDES.includes(interviewMode as InterviewMode)) {
        res.status(400).json({ success: false, message: `interviewMode doit être : ${MODES_VALIDES.join(', ')}` });
        return;
      }

      const action = await this.creerActionSuivi.execute({
        appelant: { userId: user.userId, schoolId: user.schoolId, role: user.role, permissions: user.permissions },
        studentId,
        type: type as FollowUpActionType,
        triggeringRecommendationId,
        subjectId,
        assignedToId,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        interviewMode: interviewMode as InterviewMode | undefined,
        note,
      });

      // Notifier la personne assignée si ce n'est pas elle-même qui vient de créer l'action.
      if (action.assignedToId && action.assignedToId !== user.userId) {
        const titre = TITRES[action.type] ?? 'Nouvelle action de suivi';
        const corps = `${action.studentName} (${action.className ?? 'N/A'}) — ${titre.toLowerCase()}, assigné(e) par ${action.createdByName}.`;
        void this.notifier(action.assignedToId, user.schoolId, titre, corps);
      }

      // Un enseignant de matière (subjectId renseigné = autorité "observation seulement", voir
      // CreerActionSuiviEleveUseCase) ne doit jamais laisser son signal se perdre — le professeur
      // principal de la classe est notifié systématiquement, même s'il n'est ni créateur ni
      // assigné (nuance de rôle demandée en relecture, pas dans le B.6 d'origine).
      if (action.subjectId && action.classProfessorPrincipalId && action.classProfessorPrincipalId !== user.userId) {
        const corps = `${action.studentName} (${action.className ?? 'N/A'}) — observation de ${action.createdByName} en ${action.subjectName ?? 'une matière'} : "${action.note ?? ''}"`;
        void this.notifier(action.classProfessorPrincipalId, user.schoolId, 'Observation d\'un enseignant sur votre classe', corps);
      }

      // Suivi réel vers le parent (points 4-6 de la relecture) — deux modes choisis à la
      // création : date déjà proposée à confirmer, ou demande de disponibilité en amont (la date
      // sera fixée ensuite par le professeur principal). Réutilise le canal push-d'abord déjà en
      // place pour les alertes santé (PushFirstNotifier) — aucun nouveau canal.
      if (action.type === 'ENTRETIEN_PARENT') {
        const dateStr = action.targetDate
          ? new Date(action.targetDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          : null;
        const corps = action.interviewMode === 'DEMANDE_DISPONIBILITE'
          ? `L'établissement souhaite s'entretenir avec vous au sujet de ${action.studentName}. Merci d'indiquer vos disponibilités.`
          : `L'établissement souhaite vous rencontrer le ${dateStr} à propos de ${action.studentName}. Merci de confirmer.`;
        void notifierParentsPushDabord({
          schoolId: user.schoolId,
          studentId: action.studentId,
          type: 'STUDENT_RISK_ALERT',
          titre: 'Entretien avec l\'établissement',
          corps,
        }).catch((err) => console.error('[Suivi] notif parent entretien:', messageErreur(err)));
      }

      // Convocation élève — surfacée dans son propre espace (StudentRecommendation, même
      // mécanisme que le conseil santé côté élève), jamais un push urgent : formulation neutre et
      // constructive, jamais anxiogène (même principe déjà établi pour les messages élève).
      if (action.type === 'CONVOCATION_ELEVE' && action.targetDate) {
        const dateStr = new Date(action.targetDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const corps = `${action.createdByName} souhaite te voir le ${dateStr}. Passe le voir dès que possible pour convenir d'un moment.`;
        void this.repo.createConvocation({ schoolId: user.schoolId, studentId: action.studentId, content: corps })
          .catch((err) => console.error('[Suivi] notif élève convocation:', messageErreur(err)));
      }

      res.json({ success: true, data: action });
    } catch (error) {
      const msg = messageErreur(error);
      if (msg) { res.status(400).json({ success: false, message: msg }); return; }
      next(error);
    }
  };

  clore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { closingNote } = req.body as { closingNote?: string };
      const action = await this.clorreActionSuivi.execute({
        appelant: { userId: user.userId, schoolId: user.schoolId, role: user.role, permissions: user.permissions },
        actionId: req.params.actionId as string,
        closingNote: closingNote ?? '',
      });
      res.json({ success: true, data: action });
    } catch (error) {
      const msg = messageErreur(error);
      if (msg) { res.status(400).json({ success: false, message: msg }); return; }
      next(error);
    }
  };

  mesActionsEnCours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const actions = await this.listerActionsEnCours.execute({
        userId: user.userId, schoolId: user.schoolId, role: user.role, permissions: user.permissions,
      });
      res.json({ success: true, data: actions });
    } catch (error) {
      const msg = messageErreur(error);
      if (msg) { res.status(403).json({ success: false, message: msg }); return; }
      next(error);
    }
  };

  reassigner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { nouvelAssigneId } = req.body as { nouvelAssigneId?: string };
      if (!nouvelAssigneId) { res.status(400).json({ success: false, message: 'nouvelAssigneId requis' }); return; }

      const action = await this.assignerActionSuivi.execute({
        appelant: { userId: user.userId, schoolId: user.schoolId, role: user.role, permissions: user.permissions },
        actionId: req.params.actionId as string,
        nouvelAssigneId,
      });

      if (action.assignedToId && action.assignedToId !== user.userId) {
        const titre = TITRES[action.type] ?? 'Action de suivi réassignée';
        const corps = `${action.studentName} (${action.className ?? 'N/A'}) — action réassignée à vous par ${user.userId === action.createdById ? action.createdByName : 'le censeur'}.`;
        void this.notifier(action.assignedToId, user.schoolId, titre, corps);
      }

      res.json({ success: true, data: action });
    } catch (error) {
      const msg = messageErreur(error);
      if (msg) { res.status(400).json({ success: false, message: msg }); return; }
      next(error);
    }
  };

  historiqueEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const actions = await this.listerHistoriqueEleve.execute(
        { userId: user.userId, schoolId: user.schoolId, role: user.role, permissions: user.permissions },
        req.params.studentId as string,
      );
      res.json({ success: true, data: actions });
    } catch (error) {
      const msg = messageErreur(error);
      if (msg) { res.status(403).json({ success: false, message: msg }); return; }
      next(error);
    }
  };
}
