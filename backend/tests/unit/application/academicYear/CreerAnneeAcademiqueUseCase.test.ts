import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerAnneeAcademiqueUseCase } from '../../../../src/application/academicYear/CreerAnneeAcademiqueUseCase.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';

describe('CreerAnneeAcademiqueUseCase', () => {
  let repo: InMemoryAnneeAcademiqueRepository;
  let useCase: CreerAnneeAcademiqueUseCase;

  beforeEach(() => {
    repo = new InMemoryAnneeAcademiqueRepository();
    useCase = new CreerAnneeAcademiqueUseCase(repo);
  });

  const commande = {
    schoolId: 'school-1',
    name: '2025-2026',
    startDate: new Date('2025-09-01'),
    endDate: new Date('2026-07-31'),
  };

  it('devrait créer une année avec 3 trimestres et 6 séquences', async () => {
    const resultat = await useCase.execute(commande);

    expect(resultat.anneeId).toBeDefined();
    expect(resultat.periodesCreees).toBe(3);
    expect(resultat.sequencesCreees).toBe(6);
  });

  it('devrait marquer la nouvelle année comme courante par défaut', async () => {
    const resultat = await useCase.execute(commande);
    const annee = await repo.findById(resultat.anneeId);
    expect(annee?.isCurrent).toBe(true);
  });

  it('devrait désactiver les autres années (invariant)', async () => {
    repo.ajouterAnnee({
      id: 'annee-old',
      schoolId: 'school-1',
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-07-31'),
      isCurrent: true,
      status: 'ACTIVE',
    });

    await useCase.execute(commande);

    const ancienne = await repo.findById('annee-old');
    expect(ancienne?.isCurrent).toBe(false);
  });

  it('devrait rejeter un doublon de nom', async () => {
    await useCase.execute(commande);
    await expect(useCase.execute(commande)).rejects.toThrow('existe déjà');
  });

  it('devrait créer Séquence 1 comme courante', async () => {
    await useCase.execute(commande);

    const sequences = [...(repo as any).sequences.values()];
    const sequencesCourantes = sequences.filter((s: any) => s.isCurrent);
    expect(sequencesCourantes).toHaveLength(1);
    expect(sequencesCourantes[0].name).toBe('Séquence 1');
  });

  it('devrait créer Trimestre 1 comme courant', async () => {
    await useCase.execute(commande);

    const periodes = [...(repo as any).periodes.values()];
    const periodesCourantes = periodes.filter((p: any) => p.isCurrent);
    expect(periodesCourantes).toHaveLength(1);
    expect(periodesCourantes[0].name).toBe('Trimestre 1');
  });
});
