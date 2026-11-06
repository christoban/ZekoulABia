import type {
  StaffAttendanceRepository,
  StaffAttendanceData,
  CreerStaffAttendanceInput,
  StaffAttendanceSettingsData,
  StaffAttendanceRoomConfig,
  StaffAttendanceSlotCourant,
  MiseAJourStaffAttendanceSettings,
  StaffAttendanceStatut,
} from '@domain/ports/repositories/StaffAttendanceRepository';

export class InMemoryStaffAttendanceRepository implements StaffAttendanceRepository {
  store = new Map<string, StaffAttendanceData>();
  settings = new Map<string, StaffAttendanceSettingsData>();
  qrEnabledByRoom = new Map<string, boolean>();

  key(userId: string, date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return `${userId}:${d.toISOString()}`;
  }

  async upsert(data: { userId: string; schoolId: string; date: Date; statut: string; note?: string }): Promise<StaffAttendanceData> {
    const k = this.key(data.userId, data.date);
    const existing = this.store.get(k);
    if (existing) {
      const updated = { ...existing, statut: data.statut as StaffAttendanceStatut, note: data.note ?? null };
      this.store.set(k, updated);
      return updated;
    }
    const rec: StaffAttendanceData = {
      id: `sa-${this.store.size + 1}`,
      userId: data.userId,
      schoolId: data.schoolId,
      date: data.date,
      statut: data.statut as StaffAttendanceStatut,
      note: data.note ?? null,
      mode: null,
      roomId: null,
      timetableSlotId: null,
      qrToken: null,
      latitude: null,
      longitude: null,
      verifiedById: null,
      verifiedAt: null,
      createdAt: new Date(),
    };
    this.store.set(k, rec);
    return rec;
  }

  async pointer(data: CreerStaffAttendanceInput): Promise<StaffAttendanceData> {
    const k = this.key(data.userId, data.date);
    const existing = this.store.get(k);
    const rec: StaffAttendanceData = {
      id: existing?.id ?? `sa-${this.store.size + 1}`,
      userId: data.userId,
      schoolId: data.schoolId,
      date: data.date,
      statut: data.statut,
      note: data.note ?? null,
      mode: data.mode ?? null,
      roomId: data.roomId ?? null,
      timetableSlotId: data.timetableSlotId ?? null,
      qrToken: data.qrToken ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      verifiedById: null,
      verifiedAt: null,
      createdAt: existing?.createdAt ?? new Date(),
    };
    this.store.set(k, rec);
    return rec;
  }

  async findBySchool(schoolId: string, filters?: { userId?: string; debut?: Date; fin?: Date; statut?: StaffAttendanceStatut }): Promise<StaffAttendanceData[]> {
    return [...this.store.values()]
      .filter(r => r.schoolId === schoolId)
      .filter(r => !filters?.userId || r.userId === filters.userId)
      .filter(r => !filters?.statut || r.statut === filters.statut)
      .filter(r => !filters?.debut || r.date >= filters.debut)
      .filter(r => !filters?.fin || r.date <= filters.fin)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async trouverPresencePourCreneau(userId: string, schoolId: string, date: Date, timetableSlotId: string): Promise<StaffAttendanceData | null> {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return [...this.store.values()].find(r =>
      r.userId === userId && r.schoolId === schoolId &&
      r.timetableSlotId === timetableSlotId && r.date.toDateString() === d.toDateString(),
    ) ?? null;
  }

  async requalifier(id: string, schoolId: string, statut: StaffAttendanceStatut, verifiedById: string): Promise<StaffAttendanceData> {
    const rec = [...this.store.values()].find(r => r.id === id && r.schoolId === schoolId);
    if (!rec) throw new Error('Pointage introuvable');
    const updated = { ...rec, statut, verifiedById, verifiedAt: new Date() };
    this.store.set(this.key(rec.userId, rec.date), updated);
    return updated;
  }

  async getSettings(schoolId: string): Promise<StaffAttendanceSettingsData> {
    return this.settings.get(schoolId) ?? { schoolId, gpsRadiusMeters: 75, qrTokenTtlSeconds: 120, schoolLatitude: null, schoolLongitude: null };
  }

  async salleQrEnabled(roomId: string, schoolId: string): Promise<boolean> {
    return this.qrEnabledByRoom.get(roomId) ?? false;
  }

  async listerSalles(_schoolId: string): Promise<StaffAttendanceRoomConfig[]> {
    return [];
  }

  async trouverCreneauCourant(_teacherId: string, _schoolId: string, _maintenant: Date): Promise<StaffAttendanceSlotCourant | null> {
    return null;
  }

  async mettreAJourSettings(schoolId: string, data: MiseAJourStaffAttendanceSettings): Promise<void> {
    const current = await this.getSettings(schoolId);
    this.settings.set(schoolId, {
      ...current,
      ...(data.gpsRadiusMeters !== undefined ? { gpsRadiusMeters: data.gpsRadiusMeters } : {}),
      ...(data.qrTokenTtlSeconds !== undefined ? { qrTokenTtlSeconds: data.qrTokenTtlSeconds } : {}),
      ...(data.schoolLatitude !== undefined ? { schoolLatitude: data.schoolLatitude } : {}),
      ...(data.schoolLongitude !== undefined ? { schoolLongitude: data.schoolLongitude } : {}),
    });
    for (const item of data.roomsQrConfig ?? []) this.qrEnabledByRoom.set(item.roomId, item.qrEnabled);
  }
}