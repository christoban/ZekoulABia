import { describe, it, expect, beforeEach } from 'bun:test';
import { ObtenirProfilAcademiqueUseCase } from '../../../../src/application/student/ObtenirProfilAcademiqueUseCase.ts';
import { InMemoryAcademicProfileQueryRepository } from '../../../helpers/repositories/InMemoryAcademicProfileQueryRepository.ts';
import { InMemorySchoolSettingsRepository } from '../../../helpers/repositories/InMemorySchoolSettingsRepository.ts';

const SCHOOL_ID = 'school-1';
const STUDENT_ID = 'eleve-1';
const ACADEMIC_YEAR_ID = 'year-2026';

function repoWithProfile() {
  return new InMemoryAcademicProfileQueryRepository([
    {
      studentFirstName: 'Lionel',
      studentLastName: 'Mamba',
      bulletins: [
        {
          academicPeriodId: 'period-t1',
          academicPeriodName: 'Trimestre 1',
          generalAverage: 15,
          lignes: [
            {
              subjectId: 'maths-1',
              subjectName: 'Mathématiques',
              coefficient: 4,
              subjectAverage: 16,
            },
            {
              subjectId: 'francais-1',
              subjectName: 'Français',
              coefficient: 3,
              subjectAverage: 16,
            },
          ],
        },
        {
          academicPeriodId: 'period-t2',
          academicPeriodName: 'Trimestre 2',
          generalAverage: 14,
          lignes: [
            {
              subjectId: 'maths-1',
              subjectName: 'Mathématiques',
              coefficient: 4,
              subjectAverage: 14,
            },
            {
              subjectId: 'francais-1',
              subjectName: 'Français',
              coefficient: 3,
              subjectAverage: 14,
            },
          ],
        },
      ],
    },
  ]);
}

function makeSettings(passMark: number = 10) {
  const repo = new InMemorySchoolSettingsRepository();
  repo.definir(SCHOOL_ID, {
    schoolLanguageMode: 'francophone',
    passMark,
    councilPassMark: 10,
    maxAbsences: 10,
    attendanceLateAsAbsence: false,
    legalMaxContributionFirstCycle: 7500,
    legalMaxContributionSecondCycle: 10000,
    bulletinBlockOnUnpaidFees: false,
    smsEnabled: false,
    offlineModeEnabled: true,
    aiAlertsEnabled: true,
    messageModeration: false,
    gradesPerTerm: 2,
    sequenceCalculationMode: 'single',
    termsPerYear: 3,
    academicCalendarType: 'trimester',
    cycles: ['secondaire_1', 'secondaire_2'],
    hasMultipleCycles: true,
    preferredLanguage: 'fr',
    timezone: 'Africa/Douala',
    locale: 'fr',
    currency: 'XAF',
    logRetentionDays: 90,
    schoolName: 'Lycée de Test',
    schoolMotto: 'Apprendre pour servir',
    schoolLogoUrl: null,
  });
  return repo;
}

describe('ObtenirProfilAcademiqueUseCase (V1.1)', () => {
  it('retourne le profil pour un élève valide', async () => {
    const repo = repoWithProfile();
    const settings = makeSettings();
    const useCase = new ObtenirProfilAcademiqueUseCase(repo, settings);

    const resultat = await useCase.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    });

    expect(resultat.studentFirstName).toBe('Lionel');
    expect(resultat.studentLastName).toBe('Mamba');
    expect(resultat.moyenneGeneraleAnnuelle).toBe(14.5);
    expect(resultat.matieres).toHaveLength(2);
    expect(resultat.matieres.find(m => m.subjectId === 'maths-1')?.classification).toBe('FORCE');
    expect(resultat.matieres.find(m => m.subjectId === 'francais-1')?.classification).toBe('FORCE');
  });

  it('retourne un profil vide si aucun bulletin', async () => {
    const repo = new InMemoryAcademicProfileQueryRepository([]);
    const settings = makeSettings();
    const useCase = new ObtenirProfilAcademiqueUseCase(repo, settings);

    const resultat = await useCase.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    });

    expect(resultat.studentFirstName).toBe('');
    expect(resultat.studentLastName).toBe('');
    expect(resultat.moyenneGeneraleAnnuelle).toBeNull();
    expect(resultat.matieres).toHaveLength(0);
  });

  it('applique le seuil de passMark par défaut FR (10)', async () => {
    const repo = repoWithProfile();
    const settings = makeSettings(10);
    const useCase = new ObtenirProfilAcademiqueUseCase(repo, settings);

    const resultat = await useCase.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    });

    expect(resultat.matieres.some(m => m.classification === 'FORCE')).toBe(true);
  });

  it('applique le seuil de passMark EN (50) pour la moyenne /100', async () => {
    const repo = new InMemoryAcademicProfileQueryRepository([
      {
        studentFirstName: 'John',
        studentLastName: 'Doe',
        bulletins: [
          {
            academicPeriodId: 'p1',
            academicPeriodName: 'Term 1',
            generalAverage: 65,
            lignes: [{ subjectId: 'maths-1', subjectName: 'Maths', coefficient: 5, subjectAverage: 65 }],
          },
        ],
      },
    ]);
    const settings = makeSettings(50);
    const useCase = new ObtenirProfilAcademiqueUseCase(repo, settings);

    const resultat = await useCase.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    });

    expect(resultat.matieres.some(m => m.classification === 'FORCE')).toBe(false);
    expect(resultat.matieres.some(m => m.classification === 'ACQUIS')).toBe(true);
  });

  it('identifie les forces et faiblesses correctement', async () => {
    const repo = repoWithProfile();
    const settings = makeSettings();
    const useCase = new ObtenirProfilAcademiqueUseCase(repo, settings);

    const resultat = await useCase.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    });

    expect(resultat.forces).toContain('Mathématiques');
  });

  it('retourne des tendances HAUSSE/BAISSE/STABLE pour chaque matière', async () => {
    const repo = repoWithProfile();
    const settings = makeSettings();
    const useCase = new ObtenirProfilAcademiqueUseCase(repo, settings);

    const resultat = await useCase.execute({
      studentId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    });

    const maths = resultat.matieres.find(m => m.subjectId === 'maths-1');
    expect(maths).toBeDefined();
    expect(maths?.tendance).toBe('BAISSE'); // 14 -> 12 = baisse de 2 points
  });
});
