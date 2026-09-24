import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  TimetableRepository,
  CreneauConflitInfo,
  SlotEnseignantJour,
  ContexteAdjustIA,
} from '@domain/ports/repositories/TimetableRepository';
import type { CreneauALoter } from '@domain/ports/repositories/TimetableRepository';
import type { GridConfig } from '@domain/ports/repositories/TimetableRepository';
import type { CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';

export class InMemoryTimetableRepository implements TimetableRepository {
  private edts = new Map<string, EmploiDuTemps>();
  private creneaux = new Map<string, CreneauHoraire>();
  private creneauxGeres = new Set<string>();

  private enseignantsInfos = new Map<string, { nom: string; estAP: boolean }>();
  private sallesInfos = new Map<string, { nom: string }>();
  private sousGroupesValides = new Set<string>(); // "subGroupId:classId"

  slotsEnseignantJour: SlotEnseignantJour[] = [];
  slotActuel: ((roomId: string, teacherId: string, now: Date) => { id: string; dayOfWeek: number; startTime: string; endTime: string; subjectId: string | null; subjectName: string | null; classId: string; className: string | null } | null) | null = null;
  roomIdParSlot = new Map<string, string>();

  ajouterEDT(edt: EmploiDuTemps): void { this.edts.set(edt.id, edt); }
  ajouterCreneau(c: CreneauHoraire): void { this.creneaux.set(c.id, c); }
  definirEnseignant(id: string, nom: string, estAP: boolean): void {
    this.enseignantsInfos.set(id, { nom, estAP });
  }
  definirSalle(id: string, nom: string): void {
    this.sallesInfos.set(id, { nom });
  }
  ajouterSousGroupeValide(subGroupId: string, classId: string): void {
    this.sousGroupesValides.add(`${subGroupId}:${classId}`);
  }

  async findById(id: string): Promise<EmploiDuTemps | null> {
    return this.edts.get(id) ?? null;
  }

  async findByClasse(classId: string, academicYearId: string): Promise<EmploiDuTemps | null> {
    return (
      [...this.edts.values()].find(
        e => e.classId === classId && e.academicYearId === academicYearId
      ) ?? null
    );
  }

  async findSubmittedBySchool(schoolId: string): Promise<EmploiDuTemps[]> {
    return [...this.edts.values()].filter(edt => edt.schoolId === schoolId && edt.estSoumis());
  }

  async save(edt: EmploiDuTemps): Promise<void> { this.edts.set(edt.id, edt); }
  async update(edt: EmploiDuTemps): Promise<void> { this.edts.set(edt.id, edt); }

  async publishSubmittedBySchool(schoolId: string): Promise<EmploiDuTemps[]> {
    const aPublier = await this.findSubmittedBySchool(schoolId);
    for (const edt of aPublier) {
      this.edts.set(edt.id, EmploiDuTemps.reconstituer({ ...edt.toObject(), status: 'PUBLISHED' }));
    }
    return aPublier;
  }

  async countCreneaux(timetableId: string): Promise<number> {
    return [...this.creneaux.values()].filter(c => c.timetableId === timetableId).length;
  }

  async findCreneauById(id: string): Promise<CreneauHoraire | null> {
    return this.creneaux.get(id) ?? null;
  }

  async findCreneauxByTimetable(timetableId: string): Promise<CreneauHoraire[]> {
    return [...this.creneaux.values()].filter(c => c.timetableId === timetableId);
  }

  async saveCreneaux(c: CreneauHoraire): Promise<void> { this.creneaux.set(c.id, c); }
  async updateCreneau(c: CreneauHoraire): Promise<void> { this.creneaux.set(c.id, c); }
  async deleteCreneau(id: string, _timetableId: string): Promise<void> {
    this.creneaux.delete(id);
  }

  async deleteCreneauxTimetable(timetableId: string): Promise<number> {
    const ids = [...this.creneaux.values()].filter(c => c.timetableId === timetableId).map(c => c.id);
    for (const id of ids) this.creneaux.delete(id);
    return ids.length;
  }

  async findCreneauxEnseignantParJour(
    teacherId: string,
    dayOfWeek: number,
    _schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]> {
    return [...this.creneaux.values()]
      .filter(
        c =>
          c.teacherId === teacherId &&
          c.dayOfWeek === dayOfWeek &&
          c.kind === 'CLASS' &&
          c.id !== excludeId
      )
      .map(c => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
        classeNom: 'Classe Test',
      }));
  }

  async calculerVolumeHoraireHebdo(
    teacherId: string,
    _schoolId: string,
    excludeId?: string
  ): Promise<number> {
    const slots = [...this.creneaux.values()].filter(
      c => c.teacherId === teacherId && c.kind === 'CLASS' && c.id !== excludeId
    );
    const totalMinutes = slots.reduce((sum, c) => sum + c.calculerDureeMinutes(), 0);
    return totalMinutes / 60;
  }

  async getInfosEnseignant(id: string): Promise<{ nom: string; estAP: boolean } | null> {
    return this.enseignantsInfos.get(id) ?? null;
  }

  async getInfosSalle(id: string): Promise<{ nom: string } | null> {
    return this.sallesInfos.get(id) ?? null;
  }

  async findCreneauxSalleParJour(
    roomId: string,
    dayOfWeek: number,
    _schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]> {
    return [...this.creneaux.values()]
      .filter(
        c =>
          c.roomId === roomId &&
          c.dayOfWeek === dayOfWeek &&
          c.kind === 'CLASS' &&
          c.id !== excludeId
      )
      .map(c => ({
        id: c.id,
        startTime: c.startTime,
        endTime: c.endTime,
        classeNom: 'Classe Test',
      }));
  }

  async sousGroupeAppartientAClasse(subGroupId: string, classId: string): Promise<boolean> {
    return this.sousGroupesValides.has(`${subGroupId}:${classId}`);
  }

  /** Occupation simulée d'AUTRES classes — alimentée par les tests via definirOccupationEcole(). */
  private occupationEcole: CreneauOccupe[] = [];
  definirOccupationEcole(occupation: CreneauOccupe[]): void { this.occupationEcole = occupation; }

  async findOccupationEcole(
    _schoolId: string, _academicYearId: string, _excludeTimetableId?: string
  ): Promise<CreneauOccupe[]> {
    return this.occupationEcole;
  }

  /**
   * Double en mémoire : applique les conflits enseignant/salle avec les mêmes méthodes domaine
   * que l'implémentation Prisma, et n'écrit rien si l'une échoue (tout ou rien simulé — on
   * construit tout dans une liste locale avant de la committer dans le store).
   */
  async creerCreneauxEnLot(
    timetableId: string, _schoolId: string, creneaux: CreneauALoter[],
    options?: { verifierConflits?: boolean; remplacerLignesGerees?: boolean }
  ): Promise<{ creneauxCrees: number }> {
    const verifierConflits = options?.verifierConflits ?? true;
    const aInserer: CreneauHoraire[] = [];
    const positions = new Set(creneaux.map(c => `${c.dayOfWeek}|${c.startTime}|${c.endTime}`));
    const aRemplacer = options?.remplacerLignesGerees
      ? [...this.creneaux.values()].filter(c =>
           c.timetableId === timetableId && c.kind === 'CLASS' && !c.subGroupId &&
           (this.creneauxGeres.has(c.id) || c.groupId !== undefined || (!c.subjectId && !c.teacherId && positions.has(`${c.dayOfWeek}|${c.startTime}|${c.endTime}`)))
        )
      : [];
    const idsARemplacer = new Set(aRemplacer.map(c => c.id));
    const conserve = [...this.creneaux.values()].filter(c => !idsARemplacer.has(c.id));

    for (const seance of creneaux) {
      const creneau = CreneauHoraire.create({
        timetableId,
        subjectId: seance.subjectId,
        teacherId: seance.teacherId,
        teacherNom: seance.teacherId ? this.enseignantsInfos.get(seance.teacherId)?.nom : undefined,
        dayOfWeek: seance.dayOfWeek,
        startTime: seance.startTime,
        endTime: seance.endTime,
        roomId: seance.roomId,
         roomNom: seance.roomId ? this.sallesInfos.get(seance.roomId)?.nom : undefined,
         groupId: seance.groupId,
         isLV2Slot: seance.isLV2Slot,
         kind: seance.kind ?? 'CLASS',
      });

      if (!verifierConflits) {
        aInserer.push(creneau);
        continue;
      }

      const dejaVus = [...conserve, ...aInserer];
      const conflitsEnseignant = dejaVus
        .filter(c => c.teacherId === seance.teacherId && c.dayOfWeek === seance.dayOfWeek && c.kind === 'CLASS')
        .map(c => ({ id: c.id, startTime: c.startTime, endTime: c.endTime, classeNom: 'Classe Test' }));
      creneau.verifierConflitEnseignant(conflitsEnseignant);

      const conflitsSalle = dejaVus
        .filter(c => c.roomId === seance.roomId && c.dayOfWeek === seance.dayOfWeek && c.kind === 'CLASS')
        .map(c => ({ id: c.id, startTime: c.startTime, endTime: c.endTime, classeNom: 'Classe Test' }));
      creneau.verifierConflitSalle(conflitsSalle);

      aInserer.push(creneau);
    }

    for (const id of idsARemplacer) {
      this.creneaux.delete(id);
      this.creneauxGeres.delete(id);
    }
    for (const creneau of aInserer) {
      this.creneaux.set(creneau.id, creneau);
      if (options?.remplacerLignesGerees) this.creneauxGeres.add(creneau.id);
    }
    return { creneauxCrees: aInserer.length };
  }

  // --- Lectures solveur (no-op par défaut — les tests concernés stubent ce qu'ils exercent) ---

  async getGridConfig(_schoolId: string) { return null; }
  async saveGridConfig(_schoolId: string, data: GridConfig): Promise<GridConfig> { return data; }
  async countTimetablesBySchool(_schoolId: string): Promise<number> { return 0; }
  async classeAppartientAEcole(_classId: string, _schoolId: string): Promise<boolean> { return true; }
  async findSlotAvecContexte(_slotId: string) { return null; }
  async findElevesClasseAvecProfils(_schoolId: string, _classId: string) { return []; }
  async findAffectationsSolver(_classId: string, _schoolId: string) { return []; }
  async findNomsEnseignants(_teacherIds: string[]) { return []; }
  async compterEnseignants(_ids: string[], _schoolId: string): Promise<number> { return 0; }
  async compterSalles(_ids: string[], _schoolId: string): Promise<number> { return 0; }
  async compterMatieres(_ids: string[], _schoolId: string): Promise<number> { return 0; }
  async findClassIdsAvecEdtPublie(_schoolId: string, _academicYearId: string): Promise<string[]> { return []; }
  async findSlotsEnseignantJour(_teacherId: string, _dayOfWeek: number, _schoolId: string, _academicYearId?: string): Promise<SlotEnseignantJour[]> { return this.slotsEnseignantJour ?? []; }
  async findContexteAdjustIA(_timetableId: string, _schoolId: string): Promise<ContexteAdjustIA | null> { return null; }
  async findSlotActuelParSalleEtEnseignant(roomId: string, teacherId: string, _schoolId: string, now: Date) {
    if (!this.slotActuel) return null;
    return this.slotActuel(roomId, teacherId, now);
  }
  async findRoomIdDeSlot(slotId: string): Promise<string | null> {
    return this.roomIdParSlot?.get(slotId) ?? null;
  }
}
