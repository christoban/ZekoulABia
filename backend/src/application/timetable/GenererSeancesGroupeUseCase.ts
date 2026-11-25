import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';

export interface GenererSeancesGroupeCommande {
  timetableId: string;
  schoolId: string;
  groupSetId: string;
  academicYearId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enseignantParGroupe: { groupId: string; teacherId: string }[];
}

export interface SeanceGeneree {
  groupId: string;
  groupName: string;
  creneauId: string;
  roomId: string;
  participantsCount: number;
}

export interface GenererSeancesGroupeResultat {
  creneauxCrees: SeanceGeneree[];
}

/**
 * Fan-out d'une matière liée à un StudentGroupSet (ex. LV2) : crée un TimetableSlot par Group
 * ayant au moins un membre dans la classe de cet EDT, en appliquant la règle de split de salle
 * (V2.4, point 5) : le Group le plus nombreux garde la ClassRoomAssignment (salle habituelle),
 * les autres vont dans la plus petite salle flottante libre et de capacité suffisante.
 *
 * Idempotence : un 2e appel pour le même (timetableId, groupSetId, dayOfWeek, startTime) est
 * rejeté explicitement — jamais un upsert silencieux ni un doublon de TimetableSlot.
 */
export class GenererSeancesGroupeUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly studentGroupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
    private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository,
    private readonly roomRepository: RoomRepository,
  ) {}

  async execute(commande: GenererSeancesGroupeCommande): Promise<GenererSeancesGroupeResultat> {
    // 1. Vérifier l'EDT
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de générer des séances sur un EDT déjà publié");
    }

    // 2. Groups du GroupSet
    const groupes = await this.studentGroupRepository.findByGroupSet(commande.groupSetId);
    if (groupes.length === 0) {
      throw new Error(`Aucun Group dans le GroupSet ${commande.groupSetId}`);
    }

    // 3. Idempotence — jamais de doublon ni d'upsert silencieux sur un 2e appel
    const creneauxExistants = await this.timetableRepository.findCreneauxByTimetable(commande.timetableId);
    const groupIds = new Set(groupes.map(g => g.id));
    const dejaGenere = creneauxExistants.some(c =>
      c.dayOfWeek === commande.dayOfWeek &&
      c.startTime === commande.startTime &&
      c.groupId && groupIds.has(c.groupId)
    );
    if (dejaGenere) {
      throw new Error(
        "Des séances existent déjà pour ce groupe à ce créneau — modifiez-les via les endpoints créneaux existants avant d'en régénérer."
      );
    }

    // 4. Effectifs par Group pour cette classe — seuls les Groups avec au moins 1 membre comptent
    const effectifs = await this.membershipRepository.countMembersByGroupForClass(
      commande.groupSetId, emploiDuTemps.classId, commande.academicYearId
    );
    const effectifParGroupe = new Map(effectifs.map(e => [e.groupId, e.count]));

    const groupesActifs = groupes
      .map(g => ({ ...g, effectif: effectifParGroupe.get(g.id) ?? 0 }))
      .filter(g => g.effectif > 0)
       .sort((a, b) => b.effectif - a.effectif || a.name.localeCompare(b.name, 'fr'));

    if (groupesActifs.length === 0) {
      throw new Error("Aucun élève de cette classe n'appartient à un Group de ce GroupSet");
    }

    for (const groupe of groupesActifs) {
      const aUnEnseignant = commande.enseignantParGroupe.some(e => e.groupId === groupe.id);
      if (!aUnEnseignant) {
        throw new Error(`Aucun enseignant fourni pour le Group "${groupe.name}"`);
      }
    }

    // 5. Salle habituelle de la classe — pour le Group le plus nombreux
    const salleHabituelle = await this.classRoomAssignmentRepository.findByClasseAndAnnee(
      emploiDuTemps.classId, commande.academicYearId
    );
    if (!salleHabituelle) {
      throw new Error(
        "Aucune salle habituelle assignée à cette classe — assignez-en une (AssignerSalleClasseUseCase) avant de générer des séances."
      );
    }

    // 6. Salles flottantes disponibles (NORMAL, ACTIVE, non "habituelles" d'une classe), triées
    // par capacité croissante — la plus petite qui convient est choisie en premier.
    const toutesLesSalles = await this.roomRepository.findBySchool(commande.schoolId);
    const assignationsExistantes = await this.classRoomAssignmentRepository.findBySchool(
      commande.schoolId, commande.academicYearId
    );
    const roomIdsHabituelles = new Set(assignationsExistantes.map(a => a.roomId));
    const sallesFlottantes = toutesLesSalles
      .filter(r => r.type === 'NORMAL' && r.status === 'ACTIVE' && !roomIdsHabituelles.has(r.id))
      .sort((a, b) => a.capacity - b.capacity);

    // 7. Allocation salle + création des créneaux, dans l'ordre décroissant d'effectif
    const resultats: SeanceGeneree[] = [];
    const sallesUtiliseesCeTour = new Set<string>();

    for (let i = 0; i < groupesActifs.length; i++) {
      const groupe = groupesActifs[i]!;
      const enseignant = commande.enseignantParGroupe.find(e => e.groupId === groupe.id)!;

      let roomId: string;
      if (i === 0) {
        roomId = salleHabituelle.roomId;
      } else {
        const salleChoisie = sallesFlottantes.find(
          r => r.capacity >= groupe.effectif && !sallesUtiliseesCeTour.has(r.id)
        );
        if (!salleChoisie) {
          throw new Error(
            `Aucune salle flottante disponible avec une capacité suffisante (${groupe.effectif} élèves) pour le Group "${groupe.name}"`
          );
        }
        roomId = salleChoisie.id;
        sallesUtiliseesCeTour.add(salleChoisie.id);
      }

      const infosEnseignant = await this.timetableRepository.getInfosEnseignant(enseignant.teacherId);
      if (!infosEnseignant) throw new Error(`Enseignant introuvable : ${enseignant.teacherId}`);
      const infosSalle = await this.timetableRepository.getInfosSalle(roomId);
      if (!infosSalle) throw new Error(`Salle introuvable : ${roomId}`);

      const creneau = CreneauHoraire.create({
        timetableId: commande.timetableId,
        subjectId: groupe.subjectId,
        teacherId: enseignant.teacherId,
        teacherNom: infosEnseignant.nom,
        dayOfWeek: commande.dayOfWeek,
        startTime: commande.startTime,
        endTime: commande.endTime,
        roomId,
        roomNom: infosSalle.nom,
         kind: 'CLASS',
         groupId: groupe.id,
         isLV2Slot: true,
      });

      // Mêmes détections de conflit que la saisie manuelle (AjouterCreneauUseCase) — pas de
      // logique dupliquée, réutilisation directe des requêtes du chantier V2.3.
      const creneauxEnseignant = await this.timetableRepository.findCreneauxEnseignantParJour(
        enseignant.teacherId, commande.dayOfWeek, commande.schoolId
      );
      creneau.verifierConflitEnseignant(creneauxEnseignant);

      const creneauxSalle = await this.timetableRepository.findCreneauxSalleParJour(
        roomId, commande.dayOfWeek, commande.schoolId
      );
      creneau.verifierConflitSalle(creneauxSalle);

      await this.timetableRepository.saveCreneaux(creneau);

      resultats.push({
        groupId: groupe.id,
        groupName: groupe.name,
        creneauId: creneau.id,
        roomId,
        participantsCount: groupe.effectif,
      });
    }

    return { creneauxCrees: resultats };
  }
}
