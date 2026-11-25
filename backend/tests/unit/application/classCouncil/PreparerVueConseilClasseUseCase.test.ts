import { describe, it, expect } from 'bun:test';
import { PreparerVueConseilClasseUseCase } from '../../../../src/application/classCouncil/PreparerVueConseilClasseUseCase.ts';
import type {
  ClassCouncilPreviewQueryPort,
  DonneesVueConseil,
  DonneesVueConseilParEleve,
} from '@domain/ports/repositories/ClassCouncilPreviewQueryPort';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

class StubRepo implements Pick<ClassCouncilRepository, 'classeExiste'> {
  async classeExiste() { return { id: 'c', name: 'Classe' }; }
}

function eleve(overrides: Partial<DonneesVueConseilParEleve> & { studentId: string }): DonneesVueConseilParEleve {
  return {
    firstName: 'Nom',
    lastName: 'Prénom',
    template: 'FR',
    moyenneGenerale: null,
    rang: null,
    moyenneGeneralePeriodePrecedente: null,
    moyennesMatieres: [],
    alertLevel: null,
    casDisciplinaire: false,
    orientationNonValidee: false,
    ...overrides,
  };
}

function vue(eleves: DonneesVueConseilParEleve[]): DonneesVueConseil {
  return { effectif: eleves.length, eleves };
}

class StubPreviewQuery implements ClassCouncilPreviewQueryPort {
  constructor(private readonly donnees: DonneesVueConseil) {}
  async chargerDonneesVue() { return this.donnees; }
}

const stubRepo = new StubRepo();
const useCase = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([])), stubRepo);

describe('PreparerVueConseilClasseUseCase — V1.12', () => {
  it('promu d\'office : moyenne ≥ 10 ET aucune matière < 5', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a', moyenneGenerale: 12, moyennesMatieres: [14, 11, 9] }),
      eleve({ studentId: 'b', moyenneGenerale: 14, moyennesMatieres: [15, 16, 3] }),
      eleve({ studentId: 'c', moyenneGenerale: 9.5, moyennesMatieres: [12, 10, 11] }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.compteurs.promusOffice).toBe(1);
    expect(resultat.eleves.find(e => e.studentId === 'a')!.promuOffice).toBe(true);
    expect(resultat.eleves.find(e => e.studentId === 'b')!.promuOffice).toBe(false);
    expect(resultat.eleves.find(e => e.studentId === 'c')!.promuOffice).toBe(false);
  });

  it('promu d\'office anglophone : moyenne ≥ 40 ET aucune matière < 25', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a', template: 'EN', moyenneGenerale: 55, moyennesMatieres: [60, 50, 45] }),
      eleve({ studentId: 'b', template: 'EN', moyenneGenerale: 55, moyennesMatieres: [60, 20, 45] }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.compteurs.promusOffice).toBe(1);
    expect(resultat.eleves.find(e => e.studentId === 'a')!.promuOffice).toBe(true);
    expect(resultat.eleves.find(e => e.studentId === 'b')!.promuOffice).toBe(false);
  });

  it('sans bulletin (moyenne null), jamais promu d\'office', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a' }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.eleves[0].promuOffice).toBe(false);
  });

  it('à surveiller : alertLevel non nul (warning et critical)', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a', alertLevel: 'critical' }),
      eleve({ studentId: 'b', alertLevel: 'warning' }),
      eleve({ studentId: 'c' }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.compteurs.aSurveiller).toBe(2);
  });

  it('cas disciplinaires et décisions d\'orientation comptabilisés', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a', casDisciplinaire: true }),
      eleve({ studentId: 'b', orientationNonValidee: true }),
      eleve({ studentId: 'c' }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.compteurs.casDisciplinaires).toBe(1);
    expect(resultat.compteurs.decisionsOrientation).toBe(1);
  });

  it('forte baisse : baisse de moyenne ≥ 3 pts entre périodes, points exposés', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a', moyenneGenerale: 8, moyenneGeneralePeriodePrecedente: 12.5 }),
      eleve({ studentId: 'b', moyenneGenerale: 10, moyenneGeneralePeriodePrecedente: 13 }),
      eleve({ studentId: 'c', moyenneGenerale: 10, moyenneGeneralePeriodePrecedente: 12.4 }),
      eleve({ studentId: 'd', moyenneGenerale: 11, moyenneGeneralePeriodePrecedente: 10 }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.compteurs.enForteBaisse).toBe(2);
    const a = resultat.eleves.find(e => e.studentId === 'a')!;
    expect(a.enForteBaisse).toBe(true);
    expect(a.baissePoints).toBe(4.5);
    expect(resultat.eleves.find(e => e.studentId === 'd')!.enForteBaisse).toBe(false);
  });

  it('sans période précédente ni bulletin courant, pas de baisse', async () => {
    const uc = new PreparerVueConseilClasseUseCase(new StubPreviewQuery(vue([
      eleve({ studentId: 'a', moyenneGenerale: 8 }),
      eleve({ studentId: 'b', moyenneGenerale: null, moyenneGeneralePeriodePrecedente: 14 }),
    ])), stubRepo);
    const resultat = await uc.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.compteurs.enForteBaisse).toBe(0);
  });

  it('effectif renvoyé depuis la source', async () => {
    const resultat = await useCase.execute({ schoolId: 's', classId: 'c', academicPeriodId: 'p' });
    expect(resultat.effectif).toBe(0);
    expect(resultat.compteurs).toEqual({
      promusOffice: 0, aSurveiller: 0, casDisciplinaires: 0, enForteBaisse: 0, decisionsOrientation: 0,
    });
  });
});
