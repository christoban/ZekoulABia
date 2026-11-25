/**
 * APPLICATION LAYER — Use Case : Enregistrer les présences d'une classe
 * Enregistre la présence de tous les élèves d'une classe en une opération.
 * Déclenche les alertes si le seuil d'absences est dépassé.
 */
import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { MetricCachePort } from '@domain/ports/cache/MetricCachePort';
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

export interface PresenceEleve {
  studentId: string;
  statut: AttendanceStatus;
  arrivedAt?: Date;
  lateNote?: string;
}

export interface EnregistrerPresenceCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  subjectId?: string;
  teacherId: string;
  recordedById: string;
  date: Date;
  period: AttendancePeriod;
  presences: PresenceEleve[];
  isOfflineSync?: boolean;
  clientRecordedAt?: Date;
  allowUpdate?: boolean;
}

export interface EnregistrerPresenceResultat {
  enregistrees: number;
  absents: string[];   // studentIds
  retards: string[];   // studentIds
  createdOrUpdatedIds?: string[];
  clockSkewWarning?: boolean;
  maxClockSkewSeconds?: number;
}

export class EnregistrerPresenceUseCase {
  constructor(
    private readonly presenceRepository: PresenceRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly rattachementRepository: RattachementEnseignantRepository,
    private readonly metricCache?: MetricCachePort,
  ) {}

  async execute(commande: EnregistrerPresenceCommande): Promise<EnregistrerPresenceResultat> {
    // 1. Vérifier que l'enseignant existe
    const enseignant = await this.userRepository.findById(commande.teacherId);
    if (!enseignant || !enseignant.isActive) {
      throw new Error('Enseignant introuvable ou inactif');
    }

    // 1bis. Vérifier que l'enseignant est réellement rattaché à cette classe — soit comme
    // professeur principal (habilité à prendre les présences quelle que soit la matière), soit
    // via une assignation classe+matière (TeachingAssignment) pour la matière précisée. Sans ce
    // contrôle, n'importe quel enseignant de l'école pouvait marquer présent/absent/en retard
    // n'importe quel élève d'une classe qu'il n'enseigne pas.
    if (!enseignant.estAdmin()) {
      const rattache = await this.rattachementRepository.estRattacheALaClasse(
        commande.teacherId, commande.classId, commande.subjectId,
        { autoriserProfesseurPrincipal: true },
      );
      if (!rattache) {
        throw new Error(
          `L'enseignant "${enseignant.nomComplet}" n'est pas rattaché à cette classe`
        );
      }
    }

    // 2. Vérifier qu'une présence n'existe pas déjà pour ce créneau
    //    (ignoré pour la synchronisation hors-ligne ou une mise à jour explicite)
    const shouldUpsert = Boolean(commande.isOfflineSync || commande.allowUpdate);
    if (!shouldUpsert) {
      const dejaEnregistree = await this.presenceRepository.existeDeja(
        commande.presences[0]?.studentId ?? '',
        commande.date,
        commande.period
      );
      if (dejaEnregistree) {
        throw new Error(
          `Les présences du ${commande.date.toLocaleDateString('fr-FR')} ` +
          `(${commande.period}) ont déjà été enregistrées pour cette classe`
        );
      }
    }

    // 3. Créer les entités Presence
    const presencesACreer: Presence[] = commande.presences.map(p =>
      Presence.create({
        schoolId: commande.schoolId,
        studentId: p.studentId,
        classId: commande.classId,
        academicPeriodId: commande.academicPeriodId,
        subjectId: commande.subjectId,
        teacherId: commande.teacherId,
        recordedById: commande.recordedById,
        date: commande.date,
        status: p.statut,
        period: commande.period,
        arrivedAt: p.arrivedAt,
        lateNote: p.lateNote,
        isOfflineSync: commande.isOfflineSync ?? false,
        clientRecordedAt: commande.clientRecordedAt,
      })
    );

    // 4. Sauvegarder ou mettre à jour en bloc (sans doublon)
    let savedPresences = presencesACreer;
    if (shouldUpsert) {
      savedPresences = await this.presenceRepository.upsertMany(presencesACreer, commande.recordedById);
    } else {
      await this.presenceRepository.saveMany(presencesACreer);
    }

    // 4bis. Invalidation MetricCache v1 (pilote) — taux_presence
    if (this.metricCache) {
      await this.metricCache.invalidate('taux_presence', { schoolId: commande.schoolId, classId: commande.classId });
    }

    // 5. Identifier absents et retardataires (inclut PRESENT avec arrivedAt)
    const absents = commande.presences
      .filter(p => p.statut === 'ABSENT')
      .map(p => p.studentId);

    const retards = commande.presences
      .filter(p => p.statut === 'LATE' || (p.statut === 'PRESENT' && Boolean(p.arrivedAt)))
      .map(p => p.studentId);

    // 6. Notifier les parents des absents (si pas hors ligne ; lors d'une synchro offline, le controller gère la file serveur)
    if (!commande.isOfflineSync) {
      for (const studentId of absents) {
        await this.notificationService.envoyer({
          schoolId: commande.schoolId,
          userId: studentId,
          type: 'ABSENCE_ALERT',
          titre: 'Absence enregistrée',
          corps: `Votre enfant a été marqué absent le ${commande.date.toLocaleDateString('fr-FR')}`,
          canal: 'SMS',
          urgency: 'HIGH',
        });
      }
    }

    const skews = presencesACreer
      .map((p) => p.clockSkewSeconds)
      .filter((s): s is number => typeof s === 'number');
    const maxClockSkewSeconds = skews.length > 0
      ? skews.reduce((acc, s) => (Math.abs(s) > Math.abs(acc) ? s : acc), 0)
      : undefined;

    return {
      enregistrees: savedPresences.length,
      absents,
      retards,
      createdOrUpdatedIds: savedPresences.map((p) => p.id),
      clockSkewWarning: maxClockSkewSeconds !== undefined ? Math.abs(maxClockSkewSeconds) > 900 : false,
      maxClockSkewSeconds,
    };
  }
}
