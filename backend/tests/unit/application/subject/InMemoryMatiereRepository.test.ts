import { describe, it, expect, beforeEach } from 'bun:test';
import { InMemoryMatiereRepository } from '../../../helpers/repositories/InMemoryMatiereRepository.ts';

describe('InMemoryMatiereRepository — coefficients BAC', () => {
  let repo: InMemoryMatiereRepository;

  beforeEach(() => {
    repo = new InMemoryMatiereRepository();
  });

  it('devrait retourner les coefficients BAC de la série demandée', async () => {
    repo.ajouterBACCoefficient('C', 'Mathématiques', 6);
    repo.ajouterBACCoefficient('C', 'Physique', 5);
    repo.ajouterBACCoefficient('D', 'Mathématiques', 4);

    const coefficients = await repo.getCoefficientsBACParSerie('C');

    expect(coefficients).toEqual([
      { subjectName: 'Mathématiques', coefficient: 6 },
      { subjectName: 'Physique', coefficient: 5 },
    ]);
  });

  it('ne devrait pas retourner les coefficients des autres séries', async () => {
    repo.ajouterBACCoefficient('C', 'Mathématiques', 6);
    repo.ajouterBACCoefficient('D', 'Mathématiques', 4);

    const coefficients = await repo.getCoefficientsBACParSerie('C');

    expect(coefficients).toHaveLength(1);
    expect(coefficients[0].subjectName).toBe('Mathématiques');
    expect(coefficients[0].coefficient).toBe(6);
  });
});
