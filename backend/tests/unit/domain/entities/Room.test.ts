import { describe, it, expect } from 'bun:test';
import { Room } from '../../../../src/domain/entities/Room.ts';

describe('Room — logique domaine', () => {
  describe('create() — validation', () => {
    it('devrait créer une salle valide avec des défauts', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 12' });
      expect(room.id).toBeDefined();
      expect(room.name).toBe('Salle 12');
      expect(room.type).toBe('NORMAL');
      expect(room.status).toBe('ACTIVE');
      expect(room.capacity).toBe(30);
      expect(room.equipment).toEqual([]);
    });

    it('devrait rejeter un nom vide', () => {
      expect(() => Room.create({ schoolId: 'school-1', name: '  ' })).toThrow('nom de la salle');
    });

    it('devrait rejeter une capacité <= 0', () => {
      expect(() => Room.create({ schoolId: 'school-1', name: 'Labo', capacity: 0 })).toThrow('capacité');
    });

    it('devrait accepter un type et un équipement personnalisés', () => {
      const room = Room.create({
        schoolId: 'school-1', name: 'Labo Physique', type: 'LABORATORY',
        capacity: 24, equipment: ['paillasses', 'hotte'],
      });
      expect(room.type).toBe('LABORATORY');
      expect(room.equipment).toEqual(['paillasses', 'hotte']);
    });
  });

  describe('peutAccueillir()', () => {
    it('devrait accepter un effectif inférieur ou égal à la capacité', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1', capacity: 40 });
      expect(room.peutAccueillir(40)).toBe(true);
      expect(room.peutAccueillir(39)).toBe(true);
    });

    it('devrait refuser un effectif supérieur à la capacité', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1', capacity: 40 });
      expect(room.peutAccueillir(41)).toBe(false);
    });
  });

  describe('transitions de statut', () => {
    it('mettreEnMaintenance() devrait faire passer ACTIVE → MAINTENANCE', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
      room.mettreEnMaintenance();
      expect(room.status).toBe('MAINTENANCE');
      expect(room.estDisponible()).toBe(false);
    });

    it('mettreEnMaintenance() devrait refuser si déjà en maintenance', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
      room.mettreEnMaintenance();
      expect(() => room.mettreEnMaintenance()).toThrow('déjà en maintenance');
    });

    it('desactiver() devrait faire passer ACTIVE → INACTIVE', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
      room.desactiver();
      expect(room.status).toBe('INACTIVE');
    });

    it('desactiver() devrait refuser si déjà désactivée', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
      room.desactiver();
      expect(() => room.desactiver()).toThrow('déjà désactivée');
    });

    it('activer() devrait faire repasser MAINTENANCE → ACTIVE', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
      room.mettreEnMaintenance();
      room.activer();
      expect(room.status).toBe('ACTIVE');
      expect(room.estDisponible()).toBe(true);
    });

    it('activer() devrait refuser si déjà active', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
      expect(() => room.activer()).toThrow('déjà active');
    });
  });

  describe('toObject()/reconstituer()', () => {
    it('devrait produire un aller-retour fidèle', () => {
      const room = Room.create({ schoolId: 'school-1', name: 'Terrain', type: 'FIELD', capacity: 60 });
      const reconstitue = Room.reconstituer(room.toObject());
      expect(reconstitue.toObject()).toEqual(room.toObject());
    });
  });
});
