import { describe, it, expect, beforeEach } from 'bun:test';
import { ModifierSalleUseCase } from '../../../../src/application/room/ModifierSalleUseCase.ts';
import { InMemoryRoomRepository } from '../../../helpers/repositories/InMemoryRoomRepository.ts';
import { Room } from '@domain/entities/Room';

describe('ModifierSalleUseCase', () => {
  let repo: InMemoryRoomRepository;
  let useCase: ModifierSalleUseCase;
  let roomId: string;

  beforeEach(() => {
    repo = new InMemoryRoomRepository();
    useCase = new ModifierSalleUseCase(repo);
    const room = Room.create({ schoolId: 'school-1', name: 'Salle 1', capacity: 30 });
    roomId = room.id;
    repo.ajouter(room);
  });

  it('devrait modifier le nom et la capacité', async () => {
    await useCase.execute({ roomId, schoolId: 'school-1', name: 'Salle A', capacity: 35 });

    const room = await repo.findById(roomId);
    expect(room?.name).toBe('Salle A');
    expect(room?.capacity).toBe(35);
  });

  it('devrait rejeter un renommage vers un nom déjà pris', async () => {
    const autre = Room.create({ schoolId: 'school-1', name: 'Salle 2' });
    repo.ajouter(autre);

    await expect(
      useCase.execute({ roomId, schoolId: 'school-1', name: 'Salle 2' })
    ).rejects.toThrow('existe déjà');
  });

  it('devrait basculer le statut via mettreEnMaintenance()', async () => {
    await useCase.execute({ roomId, schoolId: 'school-1', status: 'MAINTENANCE' });

    const room = await repo.findById(roomId);
    expect(room?.status).toBe('MAINTENANCE');
  });

  it('devrait rejeter une transition vers un statut déjà actif', async () => {
    await expect(
      useCase.execute({ roomId, schoolId: 'school-1', status: 'ACTIVE' })
    ).rejects.toThrow('déjà active');
  });

  it('devrait rejeter un accès inter-établissement', async () => {
    await expect(
      useCase.execute({ roomId, schoolId: 'autre-ecole', name: 'X' })
    ).rejects.toThrow('Accès refusé');
  });

  it('devrait rejeter une salle inexistante', async () => {
    await expect(
      useCase.execute({ roomId: 'inexistante', schoolId: 'school-1', name: 'X' })
    ).rejects.toThrow('introuvable');
  });
});
