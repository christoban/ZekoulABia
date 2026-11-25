/**
 * Tests unitaires — Pointage présence enseignants (V2.11)
 * QR valide/expiré/hors créneau, GPS dans/hors rayon calibré, GPS échec → A_VERIFIER non
 * bloquant, gate cahier de textes (bloque si mode fiable ignoré, jamais en A_VERIFIER),
 * isolation par rôle, isolation tenant.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { PointerPresenceEnseignantUseCase } from '@application/staffAttendance/PointerPresenceEnseignantUseCase';
import { VerifierPresenceAvantCahierDeTexte } from '@application/staffAttendance/VerifierPresenceAvantCahierDeTexte';
import { InMemoryStaffAttendanceRepository } from '../../../helpers/repositories/InMemoryStaffAttendanceRepository';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository';
import { User } from '@domain/entities/User';
import type { QrTokenService, QrTokenVerification } from '@domain/ports/services/QrTokenService';

const SCHOOL = 'school-1';
const OTHER_SCHOOL = 'school-2';
const TEACHER_ID = 'teacher-1';
const ROOM_ID = 'room-1';
const SLOT_ID = 'slot-1';

class FakeQrTokenService implements QrTokenService {
  verifier: (token: string) => QrTokenVerification = () => ({ ok: false, raison: 'SIGNATURE_INVALIDE' });
  genererTokenSalle(_roomId: string, _schoolId: string, _ttl: number): string { return 'token'; }
  verifierToken(token: string): QrTokenVerification { return this.verifier(token); }
}

function creerEnseignant(id = TEACHER_ID, schoolId = SCHOOL) {
  return User.reconstituer({ id, schoolId, role: 'TEACHER', email: `${id}@x.cm`, firstName: 'Prof', lastName: 'Test', isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date() });
}

function setup() {
  const staffRepo = new InMemoryStaffAttendanceRepository();
  const timetableRepo = new InMemoryTimetableRepository();
  const userRepo = new InMemoryUserRepository();
  const qr = new FakeQrTokenService();
  userRepo.save(creerEnseignant(TEACHER_ID, SCHOOL));
  const useCase = new PointerPresenceEnseignantUseCase(staffRepo, timetableRepo, userRepo, qr);
  const gate = new VerifierPresenceAvantCahierDeTexte(staffRepo, timetableRepo);
  return { staffRepo, timetableRepo, userRepo, qr, useCase, gate };
}

describe('PointerPresenceEnseignantUseCase', () => {
  describe('QR', () => {
    it('accepte un QR valide avec un créneau courant correspondant', async () => {
      const { staffRepo, timetableRepo, qr, useCase } = setup();
      qr.verifier = () => ({ ok: true, payload: { roomId: ROOM_ID, schoolId: SCHOOL, tokenType: 'ROOM_QR' } });
      staffRepo.qrEnabledByRoom.set(ROOM_ID, true);
      timetableRepo.slotActuel = () => ({ id: SLOT_ID, dayOfWeek: 1, startTime: '08:00', endTime: '09:00', subjectId: 's1', subjectName: 'Maths', classId: 'c1', className: '3e' });

      const result = await useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'QR', qrToken: 'valid', now: new Date('2026-09-01T08:30:00') });

      expect(result.attendance.statut).toBe('PRESENT');
      expect(result.attendance.mode).toBe('QR');
      expect(result.attendance.timetableSlotId).toBe(SLOT_ID);
      expect(result.aVerifier).toBe(false);
    });

    it('rejette un QR expiré', async () => {
      const { qr, useCase } = setup();
      qr.verifier = () => ({ ok: false, raison: 'EXPIRED' });
      await expect(useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'QR', qrToken: 'expired' })).rejects.toThrow('expiré');
    });

    it('rejette un QR valide mais sans créneau courant (hors créneau)', async () => {
      const { staffRepo, timetableRepo, qr, useCase } = setup();
      qr.verifier = () => ({ ok: true, payload: { roomId: ROOM_ID, schoolId: SCHOOL, tokenType: 'ROOM_QR' } });
      staffRepo.qrEnabledByRoom.set(ROOM_ID, true);
      timetableRepo.slotActuel = () => null; // pas de cours en ce moment

      await expect(useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'QR', qrToken: 'valid' })).rejects.toThrow('Aucun cours programmé');
    });

    it('rejette un QR d\'un autre établissement', async () => {
      const { qr, useCase } = setup();
      qr.verifier = () => ({ ok: true, payload: { roomId: ROOM_ID, schoolId: OTHER_SCHOOL, tokenType: 'ROOM_QR' } });
      await expect(useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'QR', qrToken: 'other' })).rejects.toThrow('autre établissement');
    });
  });

  describe('GPS', () => {
    it('accepte un GPS dans le rayon calibré', async () => {
      const { staffRepo, useCase } = setup();
      staffRepo.settings.set(SCHOOL, { schoolId: SCHOOL, gpsRadiusMeters: 100, qrTokenTtlSeconds: 120, schoolLatitude: 3.85, schoolLongitude: 11.5 });

      const result = await useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'GPS', latitude: 3.85, longitude: 11.5 });

      expect(result.attendance.statut).toBe('PRESENT');
      expect(result.aVerifier).toBe(false);
    });

    it('met A_VERIFIER si le GPS est hors rayon', async () => {
      const { staffRepo, useCase } = setup();
      staffRepo.settings.set(SCHOOL, { schoolId: SCHOOL, gpsRadiusMeters: 100, qrTokenTtlSeconds: 120, schoolLatitude: 3.85, schoolLongitude: 11.5 });

      const result = await useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'GPS', latitude: 4.5, longitude: 12.5 });

      expect(result.attendance.statut).toBe('A_VERIFIER');
      expect(result.aVerifier).toBe(true);
    });

    it('met A_VERIFIER (non bloquant) si le GPS échoue (pas de coordonnées)', async () => {
      const { useCase } = setup();
      const result = await useCase.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, mode: 'GPS', latitude: null, longitude: null });
      expect(result.attendance.statut).toBe('A_VERIFIER');
      expect(result.aVerifier).toBe(true);
    });
  });

  describe('Isolation rôle / tenant', () => {
    it('refuse un non-enseignant (STAFF)', async () => {
      const { userRepo, useCase } = setup();
      userRepo.save(User.reconstituer({ id: 'staff-1', schoolId: SCHOOL, role: 'STAFF', email: 's@x.cm', firstName: 'S', lastName: 'T', isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date() }));
      await expect(useCase.execute({ teacherId: 'staff-1', schoolId: SCHOOL, mode: 'GPS', latitude: 0, longitude: 0 })).rejects.toThrow('Seul un enseignant');
    });

    it('refuse un enseignant d\'une autre école', async () => {
      const { userRepo, useCase } = setup();
      userRepo.save(creerEnseignant('teacher-other', OTHER_SCHOOL));
      await expect(useCase.execute({ teacherId: 'teacher-other', schoolId: SCHOOL, mode: 'GPS', latitude: 0, longitude: 0 })).rejects.toThrow('introuvable dans cet établissement');
    });
  });
});

describe('VerifierPresenceAvantCahierDeTexte (gate)', () => {
  it('ne bloque pas si aucun créneau courant', async () => {
    const { timetableRepo, gate } = setup();
    timetableRepo.slotsEnseignantJour = [];
    await expect(gate.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, now: new Date('2026-09-01T08:30:00') })).resolves.toBeUndefined();
  });

  it('bloque si un créneau courant avec salle QR configurée existe mais non pointé', async () => {
    const { staffRepo, timetableRepo, gate } = setup();
    timetableRepo.slotsEnseignantJour = [{ id: SLOT_ID, startTime: '08:00', endTime: '09:00', subjectId: 's1', subjectName: 'Maths', classId: 'c1', className: '3e' }];
    timetableRepo.roomIdParSlot.set(SLOT_ID, ROOM_ID);
    staffRepo.qrEnabledByRoom.set(ROOM_ID, true);

    await expect(gate.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, now: new Date('2026-09-01T08:30:00') })).rejects.toThrow('poin');
  });

  it('ne bloque pas si présence PRESENT déjà pointée sur le créneau', async () => {
    const { staffRepo, timetableRepo, gate } = setup();
    timetableRepo.slotsEnseignantJour = [{ id: SLOT_ID, startTime: '08:00', endTime: '09:00', subjectId: 's1', subjectName: 'Maths', classId: 'c1', className: '3e' }];
    timetableRepo.roomIdParSlot.set(SLOT_ID, ROOM_ID);
    staffRepo.qrEnabledByRoom.set(ROOM_ID, true);
    const date = new Date('2026-09-01T00:00:00');
    await staffRepo.pointer({ userId: TEACHER_ID, schoolId: SCHOOL, date, statut: 'PRESENT', mode: 'QR', timetableSlotId: SLOT_ID, roomId: ROOM_ID });

    await expect(gate.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, now: new Date('2026-09-01T08:30:00') })).resolves.toBeUndefined();
  });

  it('ne bloque JAMAIS si le seul état possible est A_VERIFIER (pas de salle QR configurée)', async () => {
    const { staffRepo, timetableRepo, gate } = setup();
    timetableRepo.slotsEnseignantJour = [{ id: SLOT_ID, startTime: '08:00', endTime: '09:00', subjectId: 's1', subjectName: 'Maths', classId: 'c1', className: '3e' }];
    timetableRepo.roomIdParSlot.set(SLOT_ID, ROOM_ID);
    staffRepo.qrEnabledByRoom.set(ROOM_ID, false); // pas de QR → GPS seul → A_VERIFIER non bloquant

    await expect(gate.execute({ teacherId: TEACHER_ID, schoolId: SCHOOL, now: new Date('2026-09-01T08:30:00') })).resolves.toBeUndefined();
  });
});