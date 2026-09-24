import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import { VolumeHoraireAPError } from '@domain/errors/VolumeHoraireAPError';
import type { SlotKind } from '@domain/types/enums';

export interface ModifierCreneauCommande {
  creneauId: string;
  timetableId: string;
  schoolId: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  roomId?: string;
  kind?: SlotKind;
  subGroupId?: string;
  groupId?: string;
  isLV2Slot?: boolean;
  isElectiveSlot?: boolean;
}

const LIMITE_AP_HEURES = 14;

export class ModifierCreneauUseCase {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  async execute(commande: ModifierCreneauCommande): Promise<void> {
    // 1. Charger le créneau existant
    const creneauExistant = await this.timetableRepository.findCreneauById(commande.creneauId);
    if (!creneauExistant) throw new Error(`Créneau introuvable : ${commande.creneauId}`);

    // 2. Vérifier l'EDT
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps || emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de modifier un créneau d'un EDT publié");
    }
    if (creneauExistant.timetableId !== commande.timetableId) {
      throw new Error('Accès refusé : le créneau n’appartient pas à cet EDT');
    }

    // 3. Construire le créneau modifié par patch partiel
    const ancienProps = creneauExistant.toObject();
    const creneauModifie = CreneauHoraire.reconstituer({
      ...ancienProps,
      ...(commande.subjectId !== undefined && { subjectId: commande.subjectId }),
      ...(commande.teacherId !== undefined && { teacherId: commande.teacherId }),
      ...(commande.dayOfWeek !== undefined && { dayOfWeek: commande.dayOfWeek }),
      ...(commande.startTime !== undefined && { startTime: commande.startTime }),
      ...(commande.endTime !== undefined && { endTime: commande.endTime }),
      ...(commande.roomId !== undefined && { roomId: commande.roomId }),
      ...(commande.kind !== undefined && { kind: commande.kind }),
      ...(commande.subGroupId !== undefined && { subGroupId: commande.subGroupId }),
      ...(commande.groupId !== undefined && { groupId: commande.groupId }),
      ...(commande.isLV2Slot !== undefined && { isLV2Slot: commande.isLV2Slot }),
      ...(commande.isElectiveSlot !== undefined && { isElectiveSlot: commande.isElectiveSlot }),
    });

    const teacherId = creneauModifie.teacherId;
    const roomId = creneauModifie.roomId;
    const kind = creneauModifie.kind;

    // 4. Vérifier conflit (avec excludeId pour exclure le créneau actuel)
    if (teacherId && kind === 'CLASS') {
      const creneauxEnseignant = await this.timetableRepository.findCreneauxEnseignantParJour(
        teacherId,
        creneauModifie.dayOfWeek,
        commande.schoolId,
        commande.creneauId
      );
      creneauModifie.verifierConflitEnseignant(creneauxEnseignant, commande.creneauId);
    }

    // 4b. Détection de conflit de salle (même principe — voir V2.3)
    if (roomId && kind === 'CLASS') {
      const creneauxSalle = await this.timetableRepository.findCreneauxSalleParJour(
        roomId,
        creneauModifie.dayOfWeek,
        commande.schoolId,
        commande.creneauId
      );
      creneauModifie.verifierConflitSalle(creneauxSalle, commande.creneauId);
    }

    // 5. Vérification volume AP (correction : maintenant aussi vérifié au updateSlot)
    if (teacherId && kind === 'CLASS') {
      const infos = await this.timetableRepository.getInfosEnseignant(teacherId);
      if (infos?.estAP) {
        const heuresActuelles = await this.timetableRepository.calculerVolumeHoraireHebdo(
          teacherId,
          commande.schoolId,
          commande.creneauId
        );
        const nouvellesHeures = creneauModifie.calculerDureeMinutes() / 60;

        if (heuresActuelles + nouvellesHeures > LIMITE_AP_HEURES) {
          throw new VolumeHoraireAPError(infos.nom, heuresActuelles);
        }
      }
    }

    await this.timetableRepository.updateCreneau(creneauModifie);
  }
}
