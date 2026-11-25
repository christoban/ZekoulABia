import { describe, it, expect, beforeEach } from 'bun:test';
import { VerifierPrerequisClotureUseCase } from '../../../../src/application/academicYear/VerifierPrerequisClotureUseCase.ts';
import { InMemoryAnneeAcademiqueRepository } from '../../../helpers/repositories/InMemoryAnneeAcademiqueRepository.ts';

describe('VerifierPrerequisClotureUseCase', () => {
  let repo: InMemoryAnneeAcademiqueRepository;
  let useCase: VerifierPrerequisClotureUseCase;

  beforeEach(() => {
    repo = new InMemoryAnneeAcademiqueRepository();
    useCase = new VerifierPrerequisClotureUseCase(repo);
    repo.notesNonValidees = 0;
    repo.classesSansBulletins = [];
    repo.classesSansConseil = [];
  });

  it('devrait retourner peutCloturer=true si tout est bon', async () => {
    const { peutCloturer, bloqueurs } = await useCase.execute('annee-1');
    expect(peutCloturer).toBe(true);
    expect(bloqueurs).toHaveLength(0);
  });

  it('devrait bloquer si des notes ne sont pas validées', async () => {
    repo.notesNonValidees = 5;

    const { peutCloturer, bloqueurs } = await useCase.execute('annee-1');
    expect(peutCloturer).toBe(false);
    expect(bloqueurs).toHaveLength(1);
    expect(bloqueurs[0].type).toBe('UNVALIDATED_GRADES');
    expect(bloqueurs[0].message).toContain('5');
  });

  it('devrait bloquer si des bulletins manquent', async () => {
    repo.classesSansBulletins = [
      { classeId: 'c1', classeNom: '2nde C', periodeNom: 'Trimestre 3' }
    ];

    const { peutCloturer, bloqueurs } = await useCase.execute('annee-1');
    expect(peutCloturer).toBe(false);
    expect(bloqueurs[0].type).toBe('MISSING_REPORT_CARDS');
    expect(bloqueurs[0].details).toHaveLength(1);
  });

  it('devrait bloquer si des conseils ne sont pas verrouillés', async () => {
    repo.classesSansConseil = [{ classeId: 'c2', classeNom: 'Tle D' }];

    const { peutCloturer, bloqueurs } = await useCase.execute('annee-1');
    expect(peutCloturer).toBe(false);
    expect(bloqueurs[0].type).toBe('MISSING_COUNCIL_SESSIONS');
  });

  it('devrait accumuler plusieurs bloqueurs', async () => {
    repo.notesNonValidees = 3;
    repo.classesSansBulletins = [{ classeId: 'c1', classeNom: '3e A', periodeNom: 'T3' }];
    repo.classesSansConseil = [{ classeId: 'c2', classeNom: 'Tle C' }];

    const { peutCloturer, bloqueurs } = await useCase.execute('annee-1');
    expect(peutCloturer).toBe(false);
    expect(bloqueurs).toHaveLength(3);
  });
});
