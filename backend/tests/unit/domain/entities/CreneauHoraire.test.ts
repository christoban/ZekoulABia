import { describe, it, expect } from 'bun:test';
import { CreneauHoraire } from '../../../../src/domain/entities/CreneauHoraire.ts';
import { ConflitHoraireError } from '@domain/errors/ConflitHoraireError';
import { ConflitSalleError } from '@domain/errors/ConflitSalleError';

describe('CreneauHoraire — logique domaine', () => {

  describe('create() — validation', () => {
    it('devrait créer un créneau valide', () => {
      const c = CreneauHoraire.create({
        timetableId: 'timetable-1',
        dayOfWeek: 0,
        startTime: '08:00',
        endTime: '09:00',
        kind: 'CLASS',
      });
      expect(c.id).toBeDefined();
      expect(c.kind).toBe('CLASS');
    });

    it("devrait rejeter un format d'heure invalide", () => {
      expect(() =>
        CreneauHoraire.create({
          timetableId: 't1',
          dayOfWeek: 0,
          startTime: '8h00',
          endTime: '09:00',
        })
      ).toThrow("Format d'heure invalide");
    });

    it('devrait rejeter si début >= fin', () => {
      expect(() =>
        CreneauHoraire.create({
          timetableId: 't1',
          dayOfWeek: 0,
          startTime: '10:00',
          endTime: '09:00',
        })
      ).toThrow("avant l'heure de fin");
    });

    it('devrait rejeter un jour invalide (> 5)', () => {
      expect(() =>
        CreneauHoraire.create({
          timetableId: 't1',
          dayOfWeek: 7,
          startTime: '08:00',
          endTime: '09:00',
        })
      ).toThrow('Jour invalide');
    });

    it('devrait utiliser CLASS comme type par défaut', () => {
      const c = CreneauHoraire.create({
        timetableId: 't1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:00',
      });
      expect(c.kind).toBe('CLASS');
    });
  });

  describe('calculerDureeMinutes()', () => {
    it('devrait calculer 60 minutes pour 08:00-09:00', () => {
      const c = CreneauHoraire.create({
        timetableId: 't1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      });
      expect(c.calculerDureeMinutes()).toBe(60);
    });

    it('devrait calculer 90 minutes pour 10:00-11:30', () => {
      const c = CreneauHoraire.create({
        timetableId: 't1', dayOfWeek: 0, startTime: '10:00', endTime: '11:30',
      });
      expect(c.calculerDureeMinutes()).toBe(90);
    });
  });

  describe('verifierConflitEnseignant()', () => {
    const creneauBase = CreneauHoraire.create({
      timetableId: 't1',
      teacherId: 'teacher-1',
      teacherNom: 'M. Dupont',
      dayOfWeek: 0,
      startTime: '10:00',
      endTime: '11:00',
    });

    it('devrait passer si aucun créneau existant', () => {
      expect(() => creneauBase.verifierConflitEnseignant([])).not.toThrow();
    });

    it('devrait lancer ConflitHoraireError si chevauchement exact', () => {
      expect(() =>
        creneauBase.verifierConflitEnseignant([{
          id: 'slot-old',
          startTime: '10:00',
          endTime: '11:00',
          classeNom: '2nde C',
        }])
      ).toThrow(ConflitHoraireError);
    });

    it('devrait lancer ConflitHoraireError si chevauchement partiel', () => {
      expect(() =>
        creneauBase.verifierConflitEnseignant([{
          id: 'slot-old',
          startTime: '10:30',
          endTime: '11:30',
          classeNom: 'Tle D',
        }])
      ).toThrow(ConflitHoraireError);
    });

    it('devrait passer si créneaux adjacents (sans chevauchement)', () => {
      expect(() =>
        creneauBase.verifierConflitEnseignant([{
          id: 'slot-before',
          startTime: '09:00',
          endTime: '10:00',
          classeNom: '3e A',
        }])
      ).not.toThrow();
    });

    it("devrait ignorer l'excludeId", () => {
      expect(() =>
        creneauBase.verifierConflitEnseignant([{
          id: 'slot-to-exclude',
          startTime: '10:00',
          endTime: '11:00',
          classeNom: '2nde C',
        }], 'slot-to-exclude')
      ).not.toThrow();
    });

    it("ne devrait pas vérifier si pas d'enseignant", () => {
      const sansProfesseur = CreneauHoraire.create({
        timetableId: 't1', dayOfWeek: 0, startTime: '10:00', endTime: '11:00',
      });
      expect(() =>
        sansProfesseur.verifierConflitEnseignant([{
          id: 'slot-old', startTime: '10:00', endTime: '11:00', classeNom: 'Test',
        }])
      ).not.toThrow();
    });
  });

  describe('verifierConflitSalle()', () => {
    const creneauBase = CreneauHoraire.create({
      timetableId: 't1',
      roomId: 'salle-1',
      roomNom: 'Labo Physique',
      dayOfWeek: 0,
      startTime: '10:00',
      endTime: '11:00',
    });

    it('devrait passer si aucun créneau existant', () => {
      expect(() => creneauBase.verifierConflitSalle([])).not.toThrow();
    });

    it('devrait lancer ConflitSalleError si chevauchement exact', () => {
      expect(() =>
        creneauBase.verifierConflitSalle([{
          id: 'slot-old',
          startTime: '10:00',
          endTime: '11:00',
          classeNom: '2nde C',
        }])
      ).toThrow(ConflitSalleError);
    });

    it('devrait lancer ConflitSalleError si chevauchement partiel', () => {
      expect(() =>
        creneauBase.verifierConflitSalle([{
          id: 'slot-old',
          startTime: '10:30',
          endTime: '11:30',
          classeNom: 'Tle D',
        }])
      ).toThrow(ConflitSalleError);
    });

    it('devrait passer si créneaux adjacents (sans chevauchement)', () => {
      expect(() =>
        creneauBase.verifierConflitSalle([{
          id: 'slot-before',
          startTime: '09:00',
          endTime: '10:00',
          classeNom: '3e A',
        }])
      ).not.toThrow();
    });

    it("devrait ignorer l'excludeId", () => {
      expect(() =>
        creneauBase.verifierConflitSalle([{
          id: 'slot-to-exclude',
          startTime: '10:00',
          endTime: '11:00',
          classeNom: '2nde C',
        }], 'slot-to-exclude')
      ).not.toThrow();
    });

    it("ne devrait pas vérifier si pas de salle", () => {
      const sansSalle = CreneauHoraire.create({
        timetableId: 't1', dayOfWeek: 0, startTime: '10:00', endTime: '11:00',
      });
      expect(() =>
        sansSalle.verifierConflitSalle([{
          id: 'slot-old', startTime: '10:00', endTime: '11:00', classeNom: 'Test',
        }])
      ).not.toThrow();
    });
  });
});
