import { describe, it, expect, beforeEach } from 'bun:test';
import { GenererRapportsScolariteUseCase } from './GenererRapportsScolariteUseCase';
import type {
  RapportsScolariteRepository,
  EffectifClasseRow,
  DossierIncompletRow,
  StatConcoursRow,
} from '@domain/ports/repositories/RapportsScolariteRepository';

describe('GenererRapportsScolariteUseCase', () => {
  let useCase: GenererRapportsScolariteUseCase;
  let mockEffectifs: EffectifClasseRow[];
  let mockDossiers: DossierIncompletRow[];
  let mockConcours: StatConcoursRow[];

  const mockRepo: RapportsScolariteRepository = {
    getEffectifsParClasse: async () => mockEffectifs,
    getDossiersIncomplets: async () => mockDossiers,
    getStatistiquesConcours: async () => mockConcours,
  };

  beforeEach(() => {
    mockEffectifs = [
      {
        classId: 'c1',
        className: '6e A',
        level: '6e',
        serie: null,
        filiere: null,
        capacity: 50,
        totalInscrits: 40,
        garcons: 25,
        filles: 15,
      },
      {
        classId: 'c2',
        className: 'Tle C',
        level: 'Tle',
        serie: 'C',
        filiere: null,
        capacity: 40,
        totalInscrits: 35,
        garcons: 20,
        filles: 15,
      },
    ];

    mockDossiers = [
      {
        id: 'd1',
        nomProvisoire: 'Mbappe Kylian',
        className: '6e A',
        contactTelephone: '+237699000000',
        completenessScore: 60,
        validableSousReserve: false,
        status: 'SUBMITTED',
        createdAt: new Date(),
        piecesManquantes: ['Acte de naissance'],
      },
    ];

    mockConcours = [
      {
        sessionId: 's1',
        sessionName: 'Concours Entrée 6e Session 1',
        examDate: new Date('2026-08-15'),
        capacity: 60,
        totalCandidats: 100,
        admis: 50,
        listeAttente: 10,
        refuses: 40,
        tauxReussitePercent: 50,
        moyenneGenerale: 11.8,
      },
    ];

    useCase = new GenererRapportsScolariteUseCase(mockRepo);
  });

  it('calcule correctement les totaux, cycles et taux d’occupation', async () => {
    const res = await useCase.getEffectifs('school-1');

    expect(res.totalInscrits).toBe(75);
    expect(res.totalCapacite).toBe(90);
    expect(res.totalGarcons).toBe(45);
    expect(res.totalFilles).toBe(30);
    expect(res.tauxOccupationGlobal).toBe(83); // 75/90 = 83%

    // 6e est dans premierCycle
    expect(res.parCycle.premierCycle.inscrits).toBe(40);
    expect(res.parCycle.premierCycle.capacite).toBe(50);

    // Tle est dans secondCycle
    expect(res.parCycle.secondCycle.inscrits).toBe(35);
    expect(res.parCycle.secondCycle.capacite).toBe(40);
  });

  it('génère un Buffer Excel contenant les données multi-onglets', async () => {
    const buffer = await useCase.genererExportExcel('school-1');

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });
});
