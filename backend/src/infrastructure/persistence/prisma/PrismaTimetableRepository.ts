// ponytail: 553l → ~500l via helpers, single adapter <800l ceiling, split when 2nd impl or >800l
import type { PrismaClient } from '@prisma/client';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  TimetableRepository,
  CreneauConflitInfo,
  CreneauALoter,
  ContexteAdjustIA,
  GridConfig,
  SlotContexte,
  EleveClasseAvecProfil,
  AffectationSolver,
  NomEnseignant,
  SlotEnseignantJour,
} from '@domain/ports/repositories/TimetableRepository';
import type { CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';
import type { TimetableStatus, SlotKind } from '@domain/types/enums';

type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export class PrismaTimetableRepository implements TimetableRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // --- helpers: deduplicate repeated Prisma patterns ---
  private readonly conflitInclude = { timetable: { include: { class: { select: { name: true } } } } } as const;
  private readonly occupationSelect = { teacherId: true, roomId: true, dayOfWeek: true, startTime: true, endTime: true } as const;
  private readonly slotContexteInclude = { timetable: { select: { schoolId: true, classId: true, academicYearId: true } }, subject: { select: { name: true, restrictedToGroupId: true } } } as const;
  private readonly eleveSelect: any = { id: true, firstName: true, lastName: true, studentProfile: { select: { id: true, lv2SubjectId: true, alevelSubjects: { select: { subjectId: true } } } } };
  private readonly eleveOrder: any = [{ lastName: 'asc' }, { firstName: 'asc' }];
  private readonly affectationSelect: any = { teacherId: true, subjectId: true, subject: { select: { subjectType: true, hoursPerWeek: true, name: true, blocDureeCases: true } } };

  private toEmploiDuTemps(data: any): EmploiDuTemps {
    return EmploiDuTemps.reconstituer({ id: data.id, schoolId: data.schoolId, classId: data.classId, academicYearId: data.academicYearId, status: data.status as TimetableStatus, generatedByAI: data.generatedByAI, createdAt: data.createdAt });
  }
  private toConflitInfo(slots: any): CreneauConflitInfo[] {
    return slots.map((s: any) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, classeNom: s.timetable.class.name }));
  }
  private creneauToDomain(data: any): CreneauHoraire {
    return CreneauHoraire.reconstituer({ id: data.id, timetableId: data.timetableId, subjectId: data.subjectId ?? undefined, teacherId: data.teacherId ?? undefined, dayOfWeek: data.dayOfWeek, startTime: data.startTime, endTime: data.endTime, roomId: data.roomId ?? undefined, kind: data.kind as SlotKind, subGroupId: data.subGroupId ?? undefined, groupId: data.groupId ?? undefined, isLV2Slot: data.isLV2Slot ?? false, isElectiveSlot: data.isElectiveSlot ?? false });
  }
  private timetableWhere(schoolId: string) { return { schoolId }; }
  private conflitWhereEnseignant(teacherId: string, dayOfWeek: number, schoolId: string, excludeId?: string) {
    return { teacherId, dayOfWeek, kind: 'CLASS' as const, timetable: this.timetableWhere(schoolId), ...(excludeId && { id: { not: excludeId } }) };
  }
  private conflitWhereSalle(roomId: string, dayOfWeek: number, schoolId: string, excludeId?: string) {
    return { roomId, dayOfWeek, kind: 'CLASS' as const, timetable: this.timetableWhere(schoolId), ...(excludeId && { id: { not: excludeId } }) };
  }
  private async queryConflits(client: { timetableSlot: { findMany: (args: any) => Promise<any[]> } }, where: any): Promise<CreneauConflitInfo[]> {
    const slots = await client.timetableSlot.findMany({ where, include: this.conflitInclude });
    return this.toConflitInfo(slots);
  }
  private slotCreateData(d: ReturnType<CreneauHoraire['toObject']>) {
    return { id: d.id, timetableId: d.timetableId, subjectId: d.subjectId ?? null, teacherId: d.teacherId ?? null, dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, roomId: d.roomId ?? null, kind: d.kind, subGroupId: d.subGroupId ?? null, groupId: d.groupId ?? null, isLV2Slot: d.isLV2Slot ?? false, isElectiveSlot: d.isElectiveSlot ?? false };
  }
  private slotUpdateData(d: ReturnType<CreneauHoraire['toObject']>) {
    return { subjectId: d.subjectId ?? null, teacherId: d.teacherId ?? null, dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, roomId: d.roomId ?? null, kind: d.kind, subGroupId: d.subGroupId ?? null, groupId: d.groupId ?? null, isLV2Slot: d.isLV2Slot ?? false, isElectiveSlot: d.isElectiveSlot ?? false };
  }
  private slotLotData(d: ReturnType<CreneauHoraire['toObject']>) {
    return { id: d.id, timetableId: d.timetableId, subjectId: d.subjectId ?? null, teacherId: d.teacherId ?? null, dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, roomId: d.roomId ?? null, kind: d.kind };
  }
  private async compterDansEcole(delegate: { count: (args: any) => Promise<number> }, ids: string[], schoolId: string): Promise<number> {
    return delegate.count({ where: { id: { in: ids }, schoolId } });
  }

  // --- EmploiDuTemps ---

  async findById(id: string): Promise<EmploiDuTemps | null> {
    const data = await this.prisma.timetable.findUnique({ where: { id } });
    if (!data) return null;
    return this.toEmploiDuTemps(data);
  }

  async findByClasse(classId: string, academicYearId: string): Promise<EmploiDuTemps | null> {
    const data = await this.prisma.timetable.findFirst({ where: { classId, academicYearId } });
    if (!data) return null;
    return this.toEmploiDuTemps(data);
  }

  async save(emploiDuTemps: EmploiDuTemps): Promise<void> {
    const data = emploiDuTemps.toObject();
    await this.prisma.timetable.create({ data: { id: data.id, schoolId: data.schoolId, classId: data.classId, academicYearId: data.academicYearId, status: data.status, generatedByAI: data.generatedByAI, createdAt: data.createdAt } });
  }

  async update(emploiDuTemps: EmploiDuTemps): Promise<void> {
    await this.prisma.timetable.update({ where: { id: emploiDuTemps.id }, data: { status: emploiDuTemps.status } });
  }

  async countCreneaux(timetableId: string): Promise<number> {
    return this.prisma.timetableSlot.count({ where: { timetableId } });
  }

  // --- Créneaux ---

  async findCreneauById(id: string): Promise<CreneauHoraire | null> {
    const data = await this.prisma.timetableSlot.findUnique({ where: { id } });
    if (!data) return null;
    return this.creneauToDomain(data);
  }

  async findCreneauxByTimetable(timetableId: string): Promise<CreneauHoraire[]> {
    const data = await this.prisma.timetableSlot.findMany({ where: { timetableId }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    return data.map(d => this.creneauToDomain(d));
  }

  async saveCreneaux(creneau: CreneauHoraire): Promise<void> {
    await this.prisma.timetableSlot.create({ data: this.slotCreateData(creneau.toObject()) });
  }

  async updateCreneau(creneau: CreneauHoraire): Promise<void> {
    const data = creneau.toObject();
    await this.prisma.timetableSlot.update({ where: { id: data.id }, data: this.slotUpdateData(data) });
  }

  async deleteCreneau(id: string, timetableId: string): Promise<void> {
    await this.prisma.timetableSlot.deleteMany({ where: { id, timetableId } });
  }

  // --- Détection de conflits (filtre schoolId — correction bug) ---

  async findCreneauxEnseignantParJour(teacherId: string, dayOfWeek: number, schoolId: string, excludeId?: string): Promise<CreneauConflitInfo[]> {
    return this.queryConflits(this.prisma, this.conflitWhereEnseignant(teacherId, dayOfWeek, schoolId, excludeId));
  }

  async findCreneauxSalleParJour(roomId: string, dayOfWeek: number, schoolId: string, excludeId?: string): Promise<CreneauConflitInfo[]> {
    return this.queryConflits(this.prisma, this.conflitWhereSalle(roomId, dayOfWeek, schoolId, excludeId));
  }

  // --- Volume horaire AP ---

  async calculerVolumeHoraireHebdo(teacherId: string, schoolId: string, excludeId?: string): Promise<number> {
    const slots = await this.prisma.timetableSlot.findMany({ where: { teacherId, kind: 'CLASS', timetable: this.timetableWhere(schoolId), ...(excludeId && { id: { not: excludeId } }) }, select: { startTime: true, endTime: true } });
    const totalMinutes = slots.reduce((sum, slot) => sum + (CreneauHoraire.heureEnMinutes(slot.endTime) - CreneauHoraire.heureEnMinutes(slot.startTime)), 0);
    return totalMinutes / 60;
  }

  // --- Infos enseignant ---

  async getInfosEnseignant(teacherId: string): Promise<{ nom: string; estAP: boolean } | null> {
    const user = await this.prisma.user.findUnique({ where: { id: teacherId }, include: { staffProfile: { include: { permissions: true } } } });
    if (!user) return null;
    const nom = `${user.firstName} ${user.lastName}`;
    const permissions = user.staffProfile?.permissions.map(p => p.permission) ?? [];
    const estAP = permissions.includes('SUPERVISE_TEACHERS') || permissions.includes('SUPERVISE_DEPARTMENT_TEACHERS');
    return { nom, estAP };
  }

  // --- Infos salle ---

  async getInfosSalle(roomId: string): Promise<{ nom: string } | null> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    if (!room) return null;
    return { nom: room.name };
  }

  // --- Validation sous-groupe ---

  async sousGroupeAppartientAClasse(subGroupId: string, classId: string): Promise<boolean> {
    const count = await this.prisma.classSubGroup.count({ where: { id: subGroupId, classId } });
    return count > 0;
  }

  // --- Scheduling Engine (V2.5) ---

  async findOccupationEcole(schoolId: string, academicYearId: string, excludeTimetableId?: string): Promise<CreneauOccupe[]> {
    const slots = await this.prisma.timetableSlot.findMany({ where: { kind: 'CLASS', timetable: { schoolId, academicYearId, ...(excludeTimetableId && { id: { not: excludeTimetableId } }) } }, select: this.occupationSelect });
    return slots.map(s => ({ teacherId: s.teacherId ?? undefined, roomId: s.roomId ?? undefined, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }));
  }

  async creerCreneauxEnLot(timetableId: string, schoolId: string, creneaux: CreneauALoter[], options?: { verifierConflits?: boolean }): Promise<{ creneauxCrees: number }> {
    const verifierConflits = options?.verifierConflits ?? true;
    return this.prisma.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({
        where: {
          timetableId,
          kind: 'CLASS',
          subjectId: null,
          teacherId: null,
          roomId: null,
        },
      });
      for (const seance of creneaux) {
        const creneau = CreneauHoraire.create({ timetableId, subjectId: seance.subjectId, teacherId: seance.teacherId, teacherNom: verifierConflits && seance.teacherId ? await this.nomEnseignant(tx, seance.teacherId) : undefined, dayOfWeek: seance.dayOfWeek, startTime: seance.startTime, endTime: seance.endTime, roomId: seance.roomId, roomNom: verifierConflits && seance.roomId ? await this.nomSalle(tx, seance.roomId) : undefined, kind: 'CLASS' });
        if (verifierConflits) {
          if (seance.teacherId) creneau.verifierConflitEnseignant(await this.conflitsEnseignant(tx, seance.teacherId, seance.dayOfWeek, schoolId));
          if (seance.roomId) creneau.verifierConflitSalle(await this.conflitsSalle(tx, seance.roomId, seance.dayOfWeek, schoolId));
        }
        await tx.timetableSlot.create({ data: this.slotLotData(creneau.toObject()) });
      }
      return { creneauxCrees: creneaux.length };
    });
  }

  private async conflitsEnseignant(tx: TxClient, teacherId: string, dayOfWeek: number, schoolId: string): Promise<CreneauConflitInfo[]> {
    return this.queryConflits(tx as any, this.conflitWhereEnseignant(teacherId, dayOfWeek, schoolId));
  }

  private async conflitsSalle(tx: TxClient, roomId: string, dayOfWeek: number, schoolId: string): Promise<CreneauConflitInfo[]> {
    return this.queryConflits(tx as any, this.conflitWhereSalle(roomId, dayOfWeek, schoolId));
  }

  private async nomEnseignant(tx: TxClient, teacherId: string): Promise<string | undefined> {
    const user = await tx.user.findUnique({ where: { id: teacherId }, select: { firstName: true, lastName: true } });
    return user ? `${user.firstName} ${user.lastName}` : undefined;
  }

  private async nomSalle(tx: TxClient, roomId: string): Promise<string | undefined> {
    const room = await tx.room.findUnique({ where: { id: roomId }, select: { name: true } });
    return room?.name;
  }
  // --- Scheduling Engine (V2.5) — lectures solveur ---

  async getGridConfig(schoolId: string): Promise<GridConfig | null> {
    const config = await this.prisma.timetableGridConfig.findUnique({ where: { schoolId } });
    return config;
  }

  async saveGridConfig(schoolId: string, data: GridConfig): Promise<GridConfig> {
    return this.prisma.timetableGridConfig.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
  }

  async countTimetablesBySchool(schoolId: string): Promise<number> {
    return this.prisma.timetable.count({ where: { schoolId } });
  }

  async classeAppartientAEcole(classId: string, schoolId: string): Promise<boolean> {
    const classe = await this.prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
    return !!classe;
  }

  async findSlotAvecContexte(slotId: string): Promise<SlotContexte | null> {
    const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId }, include: this.slotContexteInclude });
    if (!slot) return null;
    return { schoolId: slot.timetable.schoolId, classId: slot.timetable.classId, academicYearId: slot.timetable.academicYearId, subjectId: slot.subjectId, groupId: slot.groupId, isLV2Slot: slot.isLV2Slot, isElectiveSlot: slot.isElectiveSlot, subjectName: slot.subject?.name ?? null, restrictedToGroupId: slot.subject?.restrictedToGroupId ?? null };
  }

  async findSlotActuelParSalleEtEnseignant(
    roomId: string,
    teacherId: string,
    schoolId: string,
    now: Date,
  ): Promise<{ id: string; dayOfWeek: number; startTime: string; endTime: string; subjectId: string | null; subjectName: string | null; classId: string; className: string | null } | null> {
    const dayOfWeek = (now.getDay() + 6) % 7; // lundi=0 … dimanche=6
    const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const slot = await this.prisma.timetableSlot.findFirst({
      where: {
        roomId,
        teacherId,
        dayOfWeek,
        kind: 'CLASS',
        timetable: { schoolId },
        startTime: { lte: nowHHMM },
        endTime: { gt: nowHHMM },
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        subjectId: true,
        subject: { select: { name: true } },
        timetable: { select: { classId: true, class: { select: { name: true } } } },
      },
    });
    if (!slot) return null;
    return {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectId: slot.subjectId,
      subjectName: slot.subject?.name ?? null,
      classId: slot.timetable?.classId ?? '',
      className: slot.timetable?.class?.name ?? null,
    };
  }

    async findRoomIdDeSlot(slotId: string): Promise<string | null> {
    const slot = await this.prisma.timetableSlot.findUnique({ where: { id: slotId }, select: { roomId: true } });
    return slot?.roomId ?? null;
  }

  async findElevesClasseAvecProfils(schoolId: string, classId: string): Promise<EleveClasseAvecProfil[]> {
    const eleves = await (this.prisma.user.findMany as any)({ where: { schoolId, role: 'STUDENT', isActive: true, studentProfile: { enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } } } }, select: this.eleveSelect, orderBy: this.eleveOrder });
    return eleves.map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, studentProfileId: e.studentProfile?.id ?? null, lv2SubjectId: e.studentProfile?.lv2SubjectId ?? null, alevelSubjectIds: e.studentProfile?.alevelSubjects.map(a => a.subjectId) ?? [] }));
  }

  async findAffectationsSolver(classId: string, schoolId: string): Promise<AffectationSolver[]> {
    const affectations = await (this.prisma.teachingAssignment.findMany as any)({ where: { classId, schoolId, subject: { restrictedToGroupId: null, studentGroups: { none: {} } } }, select: this.affectationSelect });
    return affectations.map(a => ({ teacherId: a.teacherId, subjectId: a.subjectId, subjectType: a.subject.subjectType, hoursPerWeek: a.subject.hoursPerWeek, name: a.subject.name, blocDureeCases: a.subject.blocDureeCases }));
  }

  async findNomsEnseignants(teacherIds: string[]): Promise<NomEnseignant[]> {
    const enseignants = await this.prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } });
    return enseignants.map(u => ({ id: u.id, nomComplet: `${u.firstName} ${u.lastName}` }));
  }

  async compterEnseignants(ids: string[], schoolId: string): Promise<number> {
    return this.compterDansEcole(this.prisma.user, ids, schoolId);
  }

  async compterSalles(ids: string[], schoolId: string): Promise<number> {
    return this.compterDansEcole(this.prisma.room, ids, schoolId);
  }

  async compterMatieres(ids: string[], schoolId: string): Promise<number> {
    return this.compterDansEcole(this.prisma.subject, ids, schoolId);
  }

  async findClassIdsAvecEdtPublie(schoolId: string, academicYearId: string): Promise<string[]> {
    const timetables = await this.prisma.timetable.findMany({ where: { schoolId, academicYearId, status: 'PUBLISHED' }, select: { classId: true } });
    return timetables.map((t) => t.classId);
  }

  async findSlotsEnseignantJour(
    teacherId: string,
    dayOfWeek: number,
    schoolId: string,
    academicYearId?: string
  ): Promise<SlotEnseignantJour[]> {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        teacherId,
        dayOfWeek,
        kind: 'CLASS',
        timetable: {
          schoolId,
          ...(academicYearId ? { academicYearId } : {}),
        },
      },
      include: {
        subject: { select: { id: true, name: true } },
        timetable: { select: { classId: true, class: { select: { name: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });
    return slots.map((s: any) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      subjectId: s.subjectId,
      subjectName: s.subject?.name ?? null,
      classId: s.timetable.classId,
      className: s.timetable.class?.name ?? null,
    }));
  }

  async findContexteAdjustIA(timetableId: string, schoolId: string): Promise<ContexteAdjustIA | null> {
    const data = await this.prisma.timetable.findFirst({
      where: { id: timetableId, schoolId },
      select: {
        id: true,
        status: true,
        class: { select: { name: true } },
        slots: {
          where: { kind: 'CLASS', subjectId: { not: null } },
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });
    if (!data) return null;
    return data as unknown as ContexteAdjustIA;
  }
}
