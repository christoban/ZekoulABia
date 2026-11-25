import { Presence, type PresenceProps } from '@domain/entities/Presence';
import type {
  PresenceRepository,
  StatistiquesPresence,
  PresenceSmsRecord,
  FiltrePresences,
  PresenceLue,
  PresenceJustifiee,
  DailyClassAttendanceStatus,
  RepeatedAbsenceStudent,
} from '@domain/ports/repositories/PresenceRepository';
import type { AttendancePeriod, AttendanceStatus } from '@domain/types/enums';

export class InMemoryPresenceRepository implements PresenceRepository {
  private store = new Map<string, Presence>();

  ajouter(p: Presence): void {
    this.store.set(p.id, p);
  }

  compter(): number {
    return this.store.size;
  }

  async findById(id: string): Promise<Presence | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]> {
    return [...this.store.values()].filter(
      p => p.studentId === studentId && p.toObject().academicPeriodId === academicPeriodId
    );
  }

  async findByClasse(
    classId: string,
    date: Date,
    period: AttendancePeriod
  ): Promise<Presence[]> {
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);

    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);

    return [...this.store.values()].filter(
      presence =>
        presence.classId === classId &&
        presence.period === period &&
        presence.date >= debut &&
        presence.date <= fin
    );
  }

  async findByClasseEtPeriode(
    classId: string,
    academicPeriodId: string
  ): Promise<Presence[]> {
    return [...this.store.values()].filter(
      presence =>
        presence.classId === classId &&
        presence.toObject().academicPeriodId === academicPeriodId
    );
  }

  async countAbsencesNonJustifiees(
    studentId: string,
    academicPeriodId: string
  ): Promise<number> {
    return [...this.store.values()].filter(
      presence =>
        presence.studentId === studentId &&
        presence.toObject().academicPeriodId === academicPeriodId &&
        presence.status === 'ABSENT'
    ).length;
  }

  async countAbsencesEtRetards(schoolId: string, studentId: string, academicPeriodId: string): Promise<number> {
    return [...this.store.values()].filter(p => p.schoolId === schoolId && p.studentId === studentId && p.toObject().academicPeriodId === academicPeriodId && (p.status === 'ABSENT' || p.status === 'ABSENT_JUSTIFIED')).length;
  }

  async compterPresencesDepuis(filtre: {
    schoolId: string;
    classId?: string;
    teacherId?: string;
    studentId?: string;
    depuis: Date;
  }): Promise<{ present: number; total: number }> {
    const rows = [...this.store.values()].filter(p => {
      if (p.schoolId !== filtre.schoolId) return false;
      if (filtre.classId && p.classId !== filtre.classId) return false;
      if (filtre.teacherId && p.toObject().teacherId !== filtre.teacherId) return false;
      if (filtre.studentId && p.studentId !== filtre.studentId) return false;
      if (p.date < filtre.depuis) return false;
      return true;
    });
    const total = rows.length;
    const present = rows.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    return { present, total };
  }

  async countAbsencesConsecutives(studentId: string): Promise<number> {
    const dernieres = [...this.store.values()]
      .filter(presence => presence.studentId === studentId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);

    let consecutives = 0;

    for (const presence of dernieres) {
      if (presence.status === 'ABSENT') {
        consecutives++;
      } else {
        break;
      }
    }

    return consecutives;
  }

  async getStatistiquesEleve(
    studentId: string,
    academicPeriodId: string
  ): Promise<StatistiquesPresence> {
    const presences = [...this.store.values()].filter(
      presence =>
        presence.studentId === studentId &&
        presence.toObject().academicPeriodId === academicPeriodId
    );

    const total = presences.length;
    const retards = presences.filter(p => p.status === 'LATE' || Boolean(p.toObject().arrivedAt)).length;
    const presents = presences.filter(p => p.status === 'PRESENT' && !p.toObject().arrivedAt).length;
    const absents = presences.filter(p => p.status === 'ABSENT' || p.status === 'ABSENT_JUSTIFIED').length;

    return {
      totalJours: total,
      joursPresent: presents,
      joursAbsent: absents,
      joursRetard: retards,
      tauxPresence: total > 0 ? Math.round(((presents + retards) / total) * 100) : 100,
    };
  }

  async existeDeja(studentId: string, date: Date, period: AttendancePeriod): Promise<boolean> {
    return [...this.store.values()].some(
      p =>
        p.studentId === studentId &&
        p.date.toDateString() === date.toDateString() &&
        p.period === period
    );
  }

  async save(p: Presence): Promise<void> {
    this.store.set(p.id, p);
  }

  async saveMany(presences: Presence[]): Promise<void> {
    for (const p of presences) {
      this.store.set(p.id, p);
    }
  }

  async upsertMany(presences: Presence[], updatedById: string): Promise<Presence[]> {
    const out: Presence[] = [];
    for (const p of presences) {
      const obj = p.toObject();
      const existing = [...this.store.values()].find(
        e =>
          e.schoolId === obj.schoolId &&
          e.studentId === obj.studentId &&
          e.period === obj.period &&
          e.date.toDateString() === obj.date.toDateString() &&
          (e.subjectId ?? null) === (obj.subjectId ?? null)
      );
      if (existing) {
        const prev = existing.toObject();
        const next = Presence.reconstituer({
          ...prev,
          status: obj.status,
          arrivedAt: obj.arrivedAt,
          lateNote: obj.lateNote,
          previousStatus: prev.status !== obj.status ? prev.status : prev.previousStatus,
          updatedById,
          updatedAt: new Date(),
          isOfflineSync: obj.isOfflineSync,
          syncedAt: obj.syncedAt ?? new Date(),
          clientRecordedAt: obj.clientRecordedAt ?? prev.clientRecordedAt,
          clockSkewSeconds: obj.clockSkewSeconds ?? prev.clockSkewSeconds,
        });
        this.store.set(existing.id, next);
        out.push(next);
      } else {
        this.store.set(p.id, p);
        out.push(p);
      }
    }
    return out;
  }

  async update(p: Presence): Promise<void> {
    this.store.set(p.id, p);
  }

  async correctStatus(
    schoolId: string,
    id: string,
    data: { status: AttendanceStatus; arrivedAt?: Date | null; lateNote?: string | null; updatedById: string },
  ): Promise<PresenceLue | null> {
    const p = this.store.get(id);
    if (!p || p.schoolId !== schoolId) return null;
    const prev = p.toObject();
    const updated = Presence.reconstituer({
      ...prev,
      status: data.status,
      arrivedAt: data.arrivedAt === null ? undefined : (data.arrivedAt ?? prev.arrivedAt),
      lateNote: data.lateNote === null ? undefined : (data.lateNote ?? prev.lateNote),
      previousStatus: prev.status,
      updatedById: data.updatedById,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return this.toPresenceLue(updated);
  }

  async submitParentJustification(
    schoolId: string,
    id: string,
    data: { parentUserId: string; justification: string; attachmentUrl?: string | null },
  ): Promise<PresenceJustifiee | null> {
    const p = this.store.get(id);
    if (!p || p.schoolId !== schoolId) return null;
    const prev = p.toObject();
    const updated = Presence.reconstituer({
      ...prev,
      justification: data.justification,
      justificationAttachmentUrl: data.attachmentUrl ?? undefined,
      submittedByParentId: data.parentUserId,
      justificationStatus: 'PENDING',
    });
    this.store.set(id, updated);
    return { ...this.toPresenceLue(updated), student: null };
  }

  async getDailyClassStatus(
    _schoolId: string,
    _date: Date,
    _period?: AttendancePeriod,
  ): Promise<DailyClassAttendanceStatus[]> {
    return [];
  }

  async getRepeatedAbsences(
    schoolId: string,
    minAbsences: number,
    sinceDate: Date,
  ): Promise<RepeatedAbsenceStudent[]> {
    const byStudent = new Map<string, RepeatedAbsenceStudent>();
    for (const p of this.store.values()) {
      if (p.schoolId !== schoolId || p.date < sinceDate) continue;
      if (p.status !== 'ABSENT' && p.status !== 'ABSENT_JUSTIFIED') continue;
      const cur = byStudent.get(p.studentId) ?? {
        studentId: p.studentId,
        firstName: '',
        lastName: '',
        classId: p.classId,
        className: '',
        unjustifiedCount: 0,
        justifiedCount: 0,
        totalAbsences: 0,
        lastAbsenceDate: null,
      };
      if (p.status === 'ABSENT') cur.unjustifiedCount += 1;
      else cur.justifiedCount += 1;
      cur.totalAbsences += 1;
      if (!cur.lastAbsenceDate || p.date > cur.lastAbsenceDate) {
        cur.lastAbsenceDate = p.date;
      }
      byStudent.set(p.studentId, cur);
    }
    return [...byStudent.values()].filter(s => s.unjustifiedCount >= minAbsences || s.totalAbsences >= minAbsences);
  }

  async findByClasseEtEleves(classId: string, studentIds: string[]): Promise<Array<{ studentId: string; status: string }>> {
    if (studentIds.length === 0) return [];
    return [...this.store.values()]
      .filter(p => p.classId === classId && studentIds.includes(p.studentId))
      .map(p => ({ studentId: p.studentId, status: p.status }));
  }

  async synchroniserPresencesSms(_records: PresenceSmsRecord[]): Promise<void> {}

  async findPresencesHorsLigneEnAttente(userId: string): Promise<Presence[]> {
    return [...this.store.values()].filter(
      presence =>
        presence.toObject().recordedById === userId &&
        presence.isOfflineSync
    );
  }

  async findAvecClasse(
    params: { schoolId: string; filtre: FiltrePresences; skip: number; take: number },
  ): Promise<PresenceLue[]> {
    return [...this.store.values()]
      .filter(p => this.matchesFiltre(p, params.schoolId, params.filtre))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(params.skip, params.skip + params.take)
      .map(this.toPresenceLue);
  }

  async countByFiltre(schoolId: string, filtre: FiltrePresences): Promise<number> {
    return [...this.store.values()].filter(p => this.matchesFiltre(p, schoolId, filtre)).length;
  }

  async findByIdDansEcole(schoolId: string, id: string): Promise<Presence | null> {
    const p = this.store.get(id);
    return p && p.schoolId === schoolId ? p : null;
  }

  async justifierAbsence(
    schoolId: string,
    id: string,
    data: { justification?: string; justifiedById: string; justifiedAt: Date; approve?: boolean },
  ): Promise<PresenceJustifiee | null> {
    const p = this.store.get(id);
    if (!p || p.schoolId !== schoolId) return null;
    const approve = data.approve !== false;
    const prev: PresenceProps = p.toObject();
    const updated = Presence.reconstituer({
      ...prev,
      status: approve ? 'ABSENT_JUSTIFIED' : 'ABSENT',
      justificationStatus: approve ? 'APPROVED' : 'REJECTED',
      justification: data.justification ?? prev.justification,
      justifiedById: data.justifiedById,
      justifiedAt: data.justifiedAt,
      previousStatus: prev.status,
      updatedById: data.justifiedById,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return {
      ...this.toPresenceLue(updated),
      student: null,
    };
  }

  private matchesFiltre(p: Presence, schoolId: string, filtre: FiltrePresences): boolean {
    if (p.schoolId !== schoolId) return false;
    if (filtre.classId && p.classId !== filtre.classId) return false;
    if (filtre.studentId) {
      const ids = Array.isArray(filtre.studentId) ? filtre.studentId : [filtre.studentId];
      if (!ids.includes(p.studentId)) return false;
    }
    if (filtre.dateDebut && p.date < filtre.dateDebut) return false;
    if (filtre.dateFin && p.date > filtre.dateFin) return false;
    if (filtre.status && p.status !== filtre.status) return false;
    if (filtre.period && p.period !== filtre.period) return false;
    if (filtre.subjectId && p.subjectId !== filtre.subjectId) return false;
    return true;
  }

  private toPresenceLue(p: Presence): PresenceLue {
    const obj = p.toObject();
    return {
      id: obj.id,
      schoolId: obj.schoolId,
      studentId: obj.studentId,
      classId: obj.classId,
      academicPeriodId: obj.academicPeriodId ?? null,
      subjectId: obj.subjectId ?? null,
      teacherId: obj.teacherId ?? null,
      recordedById: obj.recordedById ?? null,
      date: obj.date,
      status: obj.status,
      period: obj.period,
      arrivedAt: obj.arrivedAt ?? null,
      lateNote: obj.lateNote ?? null,
      justification: obj.justification ?? null,
      justificationStatus: obj.justificationStatus ?? null,
      justificationAttachmentUrl: obj.justificationAttachmentUrl ?? null,
      submittedByParentId: obj.submittedByParentId ?? null,
      previousStatus: obj.previousStatus ?? null,
      updatedById: obj.updatedById ?? null,
      updatedAt: obj.updatedAt ?? null,
      clientRecordedAt: obj.clientRecordedAt ?? null,
      clockSkewSeconds: obj.clockSkewSeconds ?? null,
      isOfflineSync: obj.isOfflineSync,
      createdAt: obj.createdAt,
      class: null,
    };
  }
}
