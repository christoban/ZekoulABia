import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';

/**
 * Généralise l'ancienne logique inline de GET /timetable-slots/:id/students (LV2 uniquement) et
 * GetElevesLV2PourCreneauUseCase aux StudentGroup, pour tout créneau, quelle que soit la
 * dimension. Priorité de résolution (la plus spécifique d'abord) :
 * 1. Créneau électif A-Level (isElectiveSlot + subjectId) → élèves ayant cette matière dans leur
 *    sélection A-Level — mécanisme préexistant, inchangé.
 * 2. Le créneau porte un groupId (fan-out par StudentGroupSet, ex. LV2 généré via
 *    GenererSeancesGroupeUseCase) → membres de ce Group.
 * 3. Sinon, la matière cible un Group précis (subject.restrictedToGroupId, ex. English
 *    Literature → Bilingue) → membres de ce Group.
 * 4. Sinon, créneau LV2 legacy (isLV2Slot + subjectId, jamais migré vers groupId) →
 *    lv2SubjectId = subjectId — mécanisme préexistant, inchangé.
 * 5. Sinon → toute la classe.
 */
export interface EleveParticipant {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ResoudreParticipantsResultat {
  classId: string | null;
  subjectId: string | null;
  groupId: string | null;
  isLV2Slot: boolean;
  isElectiveSlot: boolean;
  label: string | null;
  eleves: EleveParticipant[];
  totalClasse: number;
}

export class ResoudreParticipantsSeanceUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly studentGroupMembershipRepository: StudentGroupMembershipRepository,
  ) {}

  async execute(timetableSlotId: string, schoolId: string): Promise<ResoudreParticipantsResultat> {
    const slot = await this.timetableRepository.findSlotAvecContexte(timetableSlotId);

    if (!slot) throw new Error('Créneau introuvable');
    if (slot.schoolId !== schoolId) throw new Error('Accès refusé');

    const classId = slot.classId;
    const academicYearId = slot.academicYearId;
    const isElective = slot.isElectiveSlot;
    const isLV2 = slot.isLV2Slot;

    const tousLesEleves = await this.timetableRepository.findElevesClasseAvecProfils(schoolId, classId);

    let eleves = tousLesEleves;
    let label: string | null = null;

    if (isElective && slot.subjectId) {
      eleves = tousLesEleves.filter(e =>
        e.alevelSubjectIds.some(subjectId => subjectId === slot.subjectId)
      );
      label = slot.subjectName
        ? `A-Level — ${slot.subjectName} (${eleves.length} élèves sur ${tousLesEleves.length})`
        : null;
    } else {
      const groupeCible = slot.groupId ?? slot.restrictedToGroupId ?? null;
      if (groupeCible) {
        const profilIdsMembres = new Set(
          await this.studentGroupMembershipRepository.findStudentIdsByGroup(groupeCible, academicYearId),
        );
        eleves = tousLesEleves.filter(e => e.studentProfileId && profilIdsMembres.has(e.studentProfileId));
      } else if (isLV2 && slot.subjectId) {
        eleves = tousLesEleves.filter(e => e.lv2SubjectId === slot.subjectId);
        label = slot.subjectName
          ? `Cours LV2 — ${slot.subjectName} (${eleves.length} élèves sur ${tousLesEleves.length})`
          : null;
      }
    }

    return {
      classId,
      subjectId: slot.subjectId,
      groupId: slot.groupId,
      isLV2Slot: isLV2,
      isElectiveSlot: isElective,
      label,
      eleves: eleves.map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName })),
      totalClasse: tousLesEleves.length,
    };
  }
}
