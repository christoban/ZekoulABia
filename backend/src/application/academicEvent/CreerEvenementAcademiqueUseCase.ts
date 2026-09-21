/**
 * APPLICATION LAYER — Créer un événement académique.
 * Validation spécifique par catégorie :
 *  - FIXED_DATE : openDate ET closeDate obligatoires (dates connues à l'avance).
 *  - MANUAL_TRIGGER : aucune date à la création — l'admin déclenchera lui-même
 *    (DeclencherEvenementUseCase) le jour où le fait externe se produit.
 *  - SLIDING_WINDOW : openDate obligatoire (fenêtre par défaut), closeDate optionnelle
 *    (ajustable ensuite via AjusterFenetreEvenementUseCase).
 */
import type { AcademicEventRepository } from '@domain/ports/repositories/AcademicEventRepository';
import type { Lv2ChoiceRepository } from '@domain/ports/repositories/Lv2ChoiceRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import { activerRessourceLieeSiApplicable } from './activerRessourceLiee';
import type { NotifierEvenementFn } from './DeclencherEvenementUseCase';

export interface CreerEvenementCommande {
  schoolId: string;
  createdById: string;
  type: string;
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW';
  title: string;
  description?: string;
  targetRoles: string[];
  level?: string;
  openDate?: Date;
  closeDate?: Date;
  concoursConfig?: {
    admissionThreshold?: number;
    availableSeats?: number;
    requireCepForAdmission?: boolean;
    officialExamExpectedDate?: Date;
    targetClassId?: string;
    subjects?: { name: string; coefficient: number; maxScore?: number; eliminatoryScore?: number | null }[];
  };
}

export class CreerEvenementAcademiqueUseCase {
  constructor(
    private readonly academicEventRepository: AcademicEventRepository,
    private readonly lv2ChoiceRepository: Lv2ChoiceRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly smsNotification: SmsNotificationPort,
    private readonly entranceExamRepository?: EntranceExamRepository,
    private readonly notifier?: NotifierEvenementFn,
  ) {}

  async execute(cmd: CreerEvenementCommande): Promise<{ id: string; entranceExamSessionId?: string }> {
    if (cmd.category === 'FIXED_DATE' && (!cmd.openDate || !cmd.closeDate)) {
      throw new Error('Un événement à date fixe requiert une date d\'ouverture et une date de clôture.');
    }
    if (cmd.category === 'SLIDING_WINDOW' && !cmd.openDate) {
      throw new Error('Un événement à fenêtre glissante requiert une date d\'ouverture par défaut.');
    }
    if (cmd.targetRoles.length === 0) {
      throw new Error('Au moins un rôle cible est requis.');
    }
    if (cmd.type === 'CHOIX_LV2' && !cmd.level) {
      throw new Error('Un événement de type CHOIX_LV2 requiert un niveau (level).');
    }

    // FIXED_DATE et SLIDING_WINDOW s'ouvrent tous deux automatiquement à leur openDate — seul
    // MANUAL_TRIGGER n'a jamais d'ouverture automatique (voir DeclencherEvenementUseCase).
    const status = cmd.category !== 'MANUAL_TRIGGER' && cmd.openDate && cmd.openDate <= new Date() ? 'ACTIVE' : 'UPCOMING';

    // Ouvre la ressource réelle AVANT de persister l'événement — si ça échoue (ex. fenêtre déjà
    // ouverte pour ce niveau), aucun AcademicEvent orphelin n'est créé : jamais un événement
    // "actif" sans que la fonctionnalité qu'il représente ne le soit vraiment.
    let linkedResourceId: string | null = null;
    let entranceExamSessionId: string | null = null;

    if (cmd.type === 'CONCOURS_ENTREE') {
      if (!this.entranceExamRepository) {
        throw new Error('EntranceExamRepository requis pour créer une session de concours d\'entrée.');
      }
      const anneeCourante = await this.anneeRepository.findCourante(cmd.schoolId);
      if (!anneeCourante) {
        throw new Error('Aucune année scolaire courante configurée — impossible de créer le concours d\'entrée.');
      }

      const sessionStatus = status === 'ACTIVE' ? 'REGISTRATION_OPEN' : 'DRAFT';
      const session = await this.entranceExamRepository.creerSession({
        schoolId: cmd.schoolId,
        name: cmd.title,
        examDate: cmd.closeDate ?? cmd.openDate ?? new Date(),
        academicYearId: anneeCourante.id,
        admissionThreshold: cmd.concoursConfig?.admissionThreshold ?? 10,
        availableSeats: cmd.concoursConfig?.availableSeats ?? null,
        registrationDeadline: cmd.closeDate ?? null,
        requireCepForAdmission: cmd.concoursConfig?.requireCepForAdmission ?? false,
        officialExamExpectedDate: cmd.concoursConfig?.officialExamExpectedDate ?? null,
        targetClassId: cmd.concoursConfig?.targetClassId ?? null,
      });

      // Mettre à jour le statut initial si actif
      if (sessionStatus !== 'DRAFT') {
        await this.entranceExamRepository.mettreAJourStatutSession(session.id, sessionStatus);
      }

      // Matières par défaut ou configurées
      const matieres = (cmd.concoursConfig?.subjects && cmd.concoursConfig.subjects.length > 0)
        ? cmd.concoursConfig.subjects
        : [
            { name: 'Français', coefficient: 2, maxScore: 20 },
            { name: 'Mathématiques', coefficient: 2, maxScore: 20 },
            { name: 'Culture Générale', coefficient: 1, maxScore: 20 },
          ];

      if (this.entranceExamRepository.configurerMatieres) {
        await this.entranceExamRepository.configurerMatieres(session.id, matieres);
      }

      linkedResourceId = session.id;
      entranceExamSessionId = session.id;
      if (!cmd.level) {
        cmd.level = '6e';
      }
    } else if (status === 'ACTIVE') {
      linkedResourceId = await activerRessourceLieeSiApplicable(this.lv2ChoiceRepository, this.anneeRepository, {
        id: '', schoolId: cmd.schoolId, type: cmd.type,
        level: cmd.level ?? null, openDate: cmd.openDate ?? null, closeDate: cmd.closeDate ?? null,
      }, this.smsNotification);
    }

    const evenement = await this.academicEventRepository.creer({
      schoolId: cmd.schoolId,
      createdById: cmd.createdById,
      type: cmd.type,
      category: cmd.category,
      title: cmd.title,
      description: cmd.description,
      targetRoles: cmd.targetRoles,
      level: cmd.level,
      openDate: cmd.category === 'MANUAL_TRIGGER' ? undefined : cmd.openDate,
      closeDate: cmd.closeDate,
      status,
      linkedResourceId,
      entranceExamSessionId,
    });

    if (status === 'ACTIVE' && this.notifier) {
      await this.notifier(
        cmd.schoolId,
        cmd.targetRoles,
        cmd.title,
        cmd.description ?? `« ${cmd.title} » est désormais ouvert.`,
      ).catch((err: unknown) => {
        console.error('[AcademicEvent] Erreur notification création événement actif:', err);
      });
    }

    return { id: evenement.id, entranceExamSessionId: entranceExamSessionId ?? undefined };
  }
}
