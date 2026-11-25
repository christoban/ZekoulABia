import { describe, it, expect, beforeEach } from 'bun:test';
import { SupprimerSalleUseCase } from '../../../../src/application/room/SupprimerSalleUseCase.ts';
import { InMemoryRoomRepository } from '../../../helpers/repositories/InMemoryRoomRepository.ts';
import { Room } from '@domain/entities/Room';

describe('SupprimerSalleUseCase', () => {
  let repo: InMemoryRoomRepository;
  let useCase: SupprimerSalleUseCase;
  let roomId: string;

  beforeEach(() => {
    repo = new InMemoryRoomRepository();
    useCase = new SupprimerSalleUseCase(repo);
    const room = Room.create({ schoolId: 'school-1', name: 'Salle 1' });
    roomId = room.id;
    repo.ajouter(room);
  });

  it('devrait supprimer une salle existante', async () => {
    await useCase.execute({ roomId, schoolId: 'school-1', demandeurId: 'admin-1' });
    const room = await repo.findById(roomId);
    expect(room).toBeNull();
  });

  it('devrait rejeter un accès inter-établissement', async () => {
    await expect(
      useCase.execute({ roomId, schoolId: 'autre-ecole' })
    ).rejects.toThrow('Accès refusé');
  });

  it('devrait rejeter une salle inexistante', async () => {
    await expect(
      useCase.execute({ roomId: 'inexistante', schoolId: 'school-1' })
    ).rejects.toThrow('introuvable');
  });
});
