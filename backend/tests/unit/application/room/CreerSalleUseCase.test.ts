import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerSalleUseCase } from '../../../../src/application/room/CreerSalleUseCase.ts';
import { InMemoryRoomRepository } from '../../../helpers/repositories/InMemoryRoomRepository.ts';
import { Room } from '@domain/entities/Room';

describe('CreerSalleUseCase', () => {
  let repo: InMemoryRoomRepository;
  let useCase: CreerSalleUseCase;

  beforeEach(() => {
    repo = new InMemoryRoomRepository();
    useCase = new CreerSalleUseCase(repo);
  });

  it('devrait créer une salle valide', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      name: 'Labo Physique',
      type: 'LABORATORY',
      capacity: 24,
      equipment: ['paillasses'],
    });

    expect(resultat.roomId).toBeDefined();
    expect(resultat.name).toBe('Labo Physique');

    const room = await repo.findById(resultat.roomId);
    expect(room?.type).toBe('LABORATORY');
    expect(room?.capacity).toBe(24);
  });

  it('devrait rejeter un doublon de nom dans la même école', async () => {
    const existante = Room.create({ schoolId: 'school-1', name: 'Salle 12' });
    repo.ajouter(existante);

    await expect(
      useCase.execute({ schoolId: 'school-1', name: 'Salle 12' })
    ).rejects.toThrow('existe déjà');
  });

  it('devrait autoriser le même nom dans une autre école', async () => {
    const existante = Room.create({ schoolId: 'school-1', name: 'Salle 12' });
    repo.ajouter(existante);

    const resultat = await useCase.execute({ schoolId: 'school-2', name: 'Salle 12' });
    expect(resultat.roomId).toBeDefined();
  });
});
