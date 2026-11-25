import { describe, it, expect, beforeEach } from 'bun:test';
import { traiterLigneClasse } from '@application/user/handlers/ClasseImportHandler';
import { StubCreerClasseUseCase } from '../../../../helpers/stubs/StubCreerClasseUseCase';

const SCHOOL_ID = 'school-1';

describe('ClasseImportHandler', () => {
  let creerClasseUC: StubCreerClasseUseCase;

  beforeEach(() => {
    creerClasseUC = new StubCreerClasseUseCase();
  });

  it('appel correct de CreerClasseUseCase avec les bons paramètres', async () => {
    await traiterLigneClasse({ creerClasseUseCase: creerClasseUC }, SCHOOL_ID, {
      nom: '6e A', niveau: '6e', serie: 'C', filiere: 'GENERAL', capacite: '45', section: 'FRANCOPHONE',
    });

    expect(creerClasseUC.appels).toHaveLength(1);
    expect(creerClasseUC.appels[0]).toEqual({
      schoolId: SCHOOL_ID,
      name: '6e A',
      level: '6e',
      serie: 'C',
      filiere: 'GENERAL',
      capacity: 45,
    });
  });

  it('erreur si capacité invalide (hors 1-200)', async () => {
    await expect(traiterLigneClasse({ creerClasseUseCase: creerClasseUC }, SCHOOL_ID, { nom: '6e A', niveau: '6e', capacite: '300' }))
      .rejects.toThrow('Capacité invalide');
  });

  it('erreur si nom manquant', async () => {
    await expect(traiterLigneClasse({ creerClasseUseCase: creerClasseUC }, SCHOOL_ID, { nom: '', niveau: '6e' }))
      .rejects.toThrow('Nom de la classe obligatoire');
  });

  it('erreur si niveau manquant', async () => {
    await expect(traiterLigneClasse({ creerClasseUseCase: creerClasseUC }, SCHOOL_ID, { nom: '6e A', niveau: '' }))
      .rejects.toThrow('Niveau obligatoire');
  });

  it('capacité optionnelle : pas d\'erreur si absente', async () => {
    await traiterLigneClasse({ creerClasseUseCase: creerClasseUC }, SCHOOL_ID, { nom: '6e A', niveau: '6e' });

    expect(creerClasseUC.appels).toHaveLength(1);
    expect(creerClasseUC.appels[0].capacity).toBeUndefined();
  });
});
