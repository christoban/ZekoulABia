import { describe, it, expect, beforeEach } from 'bun:test';
import { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';
import type { SequenceAcademiqueProps } from '@domain/ports/repositories/AnneeAcademiqueRepository';

const ECOLE_A = 'school-a';
const ECOLE_B = 'school-b';

function creerSequence(over: Partial<SequenceAcademiqueProps> = {}): SequenceAcademiqueProps {
  return {
    id: 'seq-1',
    academicPeriodId: 'periode-1',
    schoolId: ECOLE_A,
    name: 'Séquence 1',
    type: 'DS',
    orderIndex: 1,
    isCurrent: false,
    ...over,
  };
}

describe('DefinirPeriodeCouranteUseCase', () => {
  let repo: InMemoryAnneeAcademiqueRepository;
  let useCase: DefinirPeriodeCouranteUseCase;

  beforeEach(() => {
    repo = new InMemoryAnneeAcademiqueRepository();
    useCase = new DefinirPeriodeCouranteUseCase(repo);
  });

  it('active la séquence de sa propre école', async () => {
    repo.ajouterSequence(creerSequence());

    await useCase.definirSequence('seq-1', ECOLE_A);

    const apres = await repo.findSequenceById('seq-1', ECOLE_A);
    expect(apres?.isCurrent).toBe(true);
  });

  describe('Isolation multi-tenant', () => {
    it("rejette l'activation d'une séquence appartenant à une autre école", async () => {
      // Séquence de l'école B ; l'appelant est un admin légitime de l'école A.
      repo.ajouterSequence(creerSequence({ id: 'seq-ecole-b', schoolId: ECOLE_B }));

      // « Séquence introuvable » et non « appartient à une autre école » : le message ne doit
      // pas révéler l'existence de la séquence.
      await expect(useCase.definirSequence('seq-ecole-b', ECOLE_A)).rejects.toThrow(
        'Séquence introuvable'
      );

      const intacte = await repo.findSequenceById('seq-ecole-b', ECOLE_B);
      expect(intacte?.isCurrent).toBe(false);
    });

    it("ne désactive pas les séquences de l'autre école", async () => {
      // Deux séquences de la même période, mais d'écoles différentes : la désactivation en masse
      // déclenchée par l'école A ne doit jamais atteindre celle de l'école B.
      repo.ajouterSequence(creerSequence({ id: 'seq-a', schoolId: ECOLE_A }));
      repo.ajouterSequence(creerSequence({ id: 'seq-b', schoolId: ECOLE_B, isCurrent: true }));

      await expect(useCase.definirSequence('seq-b', ECOLE_A)).rejects.toThrow(
        'Séquence introuvable'
      );

      const seqB = await repo.findSequenceById('seq-b', ECOLE_B);
      expect(seqB?.isCurrent).toBe(true);
    });
  });
});
