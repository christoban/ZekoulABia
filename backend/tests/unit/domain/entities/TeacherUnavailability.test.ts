import { describe, it, expect } from 'bun:test';
import { TeacherUnavailability } from '../../../../src/domain/entities/TeacherUnavailability.ts';

describe('TeacherUnavailability — logique domaine (V2.4)', () => {
  describe('create() — validation', () => {
    it('crée une indisponibilité active avec un id généré', () => {
      const u = TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      });
      expect(u.id).toBeDefined();
      expect(u.active).toBe(true);
      expect(u.dayOfWeek).toBe(0);
      expect(u.reason).toBeNull();
    });

    it('rejette un format d\'heure invalide', () => {
      expect(() => TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '8:00', endTime: '09:00',
      })).toThrow('Format d\'heure invalide');
    });

    it('rejette un jour hors 0-5', () => {
      expect(() => TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 6, startTime: '08:00', endTime: '09:00',
      })).toThrow('Jour invalide');
    });

    it('rejette début >= fin', () => {
      expect(() => TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '09:00', endTime: '09:00',
      })).toThrow('doit être avant');
    });
  });

  describe('chevauche()', () => {
    const plage = TeacherUnavailability.create({
      schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 1, startTime: '08:00', endTime: '10:00',
    });

    it('détecte un chevauchement partiel même jour', () => {
      expect(plage.chevauche({ dayOfWeek: 1, startTime: '08:30', endTime: '09:30' })).toBe(true);
      expect(plage.chevauche({ dayOfWeek: 1, startTime: '09:00', endTime: '11:00' })).toBe(true);
    });

    it('ne détecte pas de chevauchement sur un jour différent', () => {
      expect(plage.chevauche({ dayOfWeek: 2, startTime: '08:00', endTime: '10:00' })).toBe(false);
    });

    it('ne détecte pas de chevauchement quand les plages sont adjacentes', () => {
      expect(plage.chevauche({ dayOfWeek: 1, startTime: '10:00', endTime: '11:00' })).toBe(false);
      expect(plage.chevauche({ dayOfWeek: 1, startTime: '07:00', endTime: '08:00' })).toBe(false);
    });
  });

  describe('activer()/desactiver() — idempotence', () => {
    it('désactive puis réactive', () => {
      const u = TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      });
      u.desactiver();
      expect(u.active).toBe(false);
      u.activer();
      expect(u.active).toBe(true);
    });

    it('rejette une désactivation déjà inactive (idempotence explicite)', () => {
      const u = TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      });
      u.desactiver();
      expect(() => u.desactiver()).toThrow('déjà inactive');
    });

    it('rejette une activation déjà active', () => {
      const u = TeacherUnavailability.create({
        schoolId: 'school-1', teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      });
      expect(() => u.activer()).toThrow('déjà active');
    });
  });
});