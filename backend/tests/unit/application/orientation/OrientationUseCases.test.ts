import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerFicheOrientationUseCase } from '../../../../src/application/orientation/CreerFicheOrientationUseCase.ts';
import { ValiderRecommandationConseillerUseCase } from '../../../../src/application/orientation/ValiderRecommandationConseillerUseCase.ts';
import type { IOrientationRepository, RecommandationDetail } from '../../../../src/domain/ports/repositories/IOrientationRepository.ts';
import type { FicheOrientation } from '../../../../src/domain/entities/FicheOrientation.ts';

const SCHOOL_ID = 'school-1';
const STUDENT_ID = 'student-1';
const YEAR_ID = 'year-1';
const CONSEILLER_ID = 'conseiller-1';

function makeFiche(overrides?: Partial<FicheOrientation>): FicheOrientation {
  return {
    id: 'fiche-1',
    studentId: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicYearId: YEAR_ID,
    conseillerId: CONSEILLER_ID,
    status: 'OUVERTE',
    riskLevel: 'FAIBLE',
    mainConcern: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as unknown as FicheOrientation;
}

function makeReco(status: string = 'CALCULEE'): RecommandationDetail {
  return {
    id: 'reco-1',
    ficheOrientationId: 'fiche-1',
    studentId: STUDENT_ID,
    serieActuelle: 'D',
    serieRecommandee: 'C',
    justification: 'Test',
    parentNotified: false,
    adminValidated: false,
    status: status as RecommandationDetail['status'],
    createdAt: new Date('2026-01-01'),
    checkpointType: null,
    suggestedTracks: null,
    confidenceLevel: null,
    dataDepthMonths: null,
    responseDeadline: null,
    remindersSentAt: null,
    studentChosenTrack: null,
    finalizedAt: null,
    finalTrack: null,
  };
}

function makeOrientationRepo(overrides?: {
  existingFiche?: FicheOrientation | null;
  existingReco?: RecommandationDetail | null;
}) {
  const existingFiche = overrides?.existingFiche ?? null;
  const existingReco = overrides?.existingReco ?? null;

  return {
    async findFicheByStudentAndYear(studentId: string, academicYearId: string) {
      if (studentId === STUDENT_ID && academicYearId === YEAR_ID) return existingFiche;
      return null;
    },
    async findFicheById() { return existingFiche; },
    async findFicheDetailById() { return null; },
    async findFiches() { return { fiches: [], total: 0 }; },
    async createFiche(data: Parameters<IOrientationRepository['createFiche']>[0]) {
      return makeFiche({ studentId: data.studentId, schoolId: data.schoolId, academicYearId: data.academicYearId, conseillerId: data.conseillerId, mainConcern: data.mainConcern });
    },
    async updateFicheRiskLevel() {},
    async createEntretien() { return {} as never; },
    async updateEntretien() { return {} as never; },
    async createTest() { return {} as never; },
    async findTestByFicheAndCheckpoint() { return null; },
    async createOrUpdateRecommandation() { return {} as never; },
    async validerRecommandation() { return {} as never; },
    async findRecommandationById(recommandationId: string, schoolId: string) {
      if (schoolId !== SCHOOL_ID) return null;
      if (recommandationId === 'reco-1') return existingReco;
      return null;
    },
    async createOrUpdateRecommandationCheckpoint() { return {} as never; },
    async validerRecommandationConseiller(recommandationId: string, _serieRecommandee: string) {
      return makeReco('VALIDEE_CONSEILLER');
    },
    async proposerRecommandationEleve() { return {} as never; },
    async choisirPisteEleve() { return {} as never; },
    async finaliserParDefaut() { return {} as never; },
    async ajouterRappelEnvoye() {},
    async findRecommandationsParStatut() { return []; },
    async findCheckpointConfig() { return null; },
    async findCheckpointConfigsActives() { return []; },
    async upsertCheckpointConfig() { return {} as never; },
    async findAspiration() { return null; },
    async createOrUpdateAspiration() { return {} as never; },
    async createSuivi() { return {} as never; },
    async getStats() { return { fichesOuvertes: 0, elevesArisqueEleve: 0, elevesArisqueCritique: 0, entretiensThisMois: 0, recommandationsEnAttente: 0, repartitionRisque: {} }; },
    async findSerieActuelle() { return null; },
    async listElevesAOrienter() { return []; },
  } as unknown as IOrientationRepository;
}

describe('CreerFicheOrientationUseCase (V2.9)', () => {
  it('crée une fiche quand aucune fiche existante', async () => {
    const repo = makeOrientationRepo({ existingFiche: null });
    const uc = new CreerFicheOrientationUseCase(repo);

    const result = await uc.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: YEAR_ID,
      conseillerId: CONSEILLER_ID,
      mainConcern: 'SCOLAIRE',
    });

    expect(result.studentId).toBe(STUDENT_ID);
    expect(result.schoolId).toBe(SCHOOL_ID);
  });

  it('lève une erreur si fiche existante déjà présente', async () => {
    const repo = makeOrientationRepo({ existingFiche: makeFiche() });
    const uc = new CreerFicheOrientationUseCase(repo);

    await expect(
      uc.execute({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, academicYearId: YEAR_ID, conseillerId: CONSEILLER_ID })
    ).rejects.toThrow("Une fiche d'orientation existe déjà pour cet élève cette année scolaire");
  });
});

describe('ValiderRecommandationConseillerUseCase (V2.9)', () => {
  it('valide une recommandation au statut CALCULEE', async () => {
    const repo = makeOrientationRepo({ existingReco: makeReco('CALCULEE') });
    const uc = new ValiderRecommandationConseillerUseCase(repo);

    const result = await uc.execute({
      recommandationId: 'reco-1',
      schoolId: SCHOOL_ID,
      serieRecommandee: 'C',
    });

    expect(result.status).toBe('VALIDEE_CONSEILLER');
  });

  it('lève une erreur si recommandation introuvable', async () => {
    const repo = makeOrientationRepo({ existingReco: null });
    const uc = new ValiderRecommandationConseillerUseCase(repo);

    await expect(
      uc.execute({ recommandationId: 'unknown', schoolId: SCHOOL_ID, serieRecommandee: 'C' })
    ).rejects.toThrow('Recommandation introuvable');
  });

  it('lève une erreur si statut non CALCULEE', async () => {
    const repo = makeOrientationRepo({ existingReco: makeReco('VALIDEE_CONSEILLER') });
    const uc = new ValiderRecommandationConseillerUseCase(repo);

    await expect(
      uc.execute({ recommandationId: 'reco-1', schoolId: SCHOOL_ID, serieRecommandee: 'C' })
    ).rejects.toThrow('ne peut pas être validée depuis son statut actuel');
  });

  it('refuse si schoolId ne correspond pas', async () => {
    const repo = makeOrientationRepo({ existingReco: makeReco('CALCULEE') });
    const uc = new ValiderRecommandationConseillerUseCase(repo);

    await expect(
      uc.execute({ recommandationId: 'reco-1', schoolId: 'wrong-school', serieRecommandee: 'C' })
    ).rejects.toThrow('Recommandation introuvable');
  });
});
