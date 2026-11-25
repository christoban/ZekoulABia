/**
 * Tests unitaires — SoumettreBulletinsClasseUseCase
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { SoumettreBulletinsClasseUseCase } from '@application/reportCard/SoumettreBulletinsClasseUseCase';
import { InMemoryBulletinRepository } from '../../../helpers/repositories/InMemoryBulletinRepository';
import { InMemoryBulletinValidationRepository } from '../../../helpers/repositories/InMemoryBulletinValidationRepository';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository';
import { Bulletin } from '@domain/entities/Bulletin';

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-1';
const PERIOD_ID = 'period-1';
const ADMIN_ID = 'admin-1';
const PP_ID = 'pp-1';
const OTHER_ID = 'other-1';

let classeRepo: InMemoryClasseRepository;
let bulletinRepo: InMemoryBulletinRepository;
let validationRepo: InMemoryBulletinValidationRepository;
let useCase: SoumettreBulletinsClasseUseCase;

beforeEach(() => {
  classeRepo = new InMemoryClasseRepository();
  bulletinRepo = new InMemoryBulletinRepository();
  validationRepo = new InMemoryBulletinValidationRepository();
  useCase = new SoumettreBulletinsClasseUseCase(classeRepo, bulletinRepo, validationRepo);
});

function createBulletin(studentId: string, generated: boolean): Bulletin {
  const b = Bulletin.create({
    schoolId: SCHOOL_ID,
    studentId,
    academicYearId: 'year-1',
    academicPeriodId: PERIOD_ID,
    template: 'FR_SECONDARY',
  });
  if (generated) {
    b.definirLignesMatiere([{ id: '1', subjectId: 's1', subjectName: 'Maths', coefficient: 1, subjectAverage: 12 }]);
    b.definirResultats({ generalAverage: 12, rank: 1, totalStudents: 1, mention: 'Bien', absenceCount: 0 });
    b.marquerGenere('test.pdf');
  }
  return b;
}

describe('SoumettreBulletinsClasseUseCase', () => {
  it('autorise un ADMIN à soumettre', async () => {
    bulletinRepo.ajouter(createBulletin('student-1', true));
    bulletinRepo.definirClasseEleve('student-1', CLASS_ID);
    classeRepo.ajouter({ id: CLASS_ID, schoolId: SCHOOL_ID, name: '3ème', level: '3ème' } as any);

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      classId: CLASS_ID,
      academicPeriodId: PERIOD_ID,
      demandeurId: ADMIN_ID,
      demandeurRole: 'ADMIN',
    });

    expect(result.session.status).toBe('SUBMITTED');
    expect(result.bulletinsCount).toBe(1);
  });

  it('autorise le PP de la classe à soumettre', async () => {
    bulletinRepo.ajouter(createBulletin('student-1', true));
    bulletinRepo.definirClasseEleve('student-1', CLASS_ID);
    classeRepo.ajouter({ id: CLASS_ID, schoolId: SCHOOL_ID, name: '3ème', level: '3ème', professorPrincipalId: PP_ID } as any);

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      classId: CLASS_ID,
      academicPeriodId: PERIOD_ID,
      demandeurId: PP_ID,
      demandeurRole: 'TEACHER',
    });

    expect(result.session.status).toBe('SUBMITTED');
  });

  it('refuse un enseignant qui n\'est pas PP de la classe', async () => {
    bulletinRepo.ajouter(createBulletin('student-1', true));
    bulletinRepo.definirClasseEleve('student-1', CLASS_ID);
    classeRepo.ajouter({ id: CLASS_ID, schoolId: SCHOOL_ID, name: '3ème', level: '3ème', professorPrincipalId: PP_ID } as any);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        demandeurId: OTHER_ID,
        demandeurRole: 'TEACHER',
      })
    ).rejects.toThrow('Professeur Principal');
  });

  it('refuse si une session existe déjà', async () => {
    bulletinRepo.ajouter(createBulletin('student-1', true));
    bulletinRepo.definirClasseEleve('student-1', CLASS_ID);
    classeRepo.ajouter({ id: CLASS_ID, schoolId: SCHOOL_ID, name: '3ème', level: '3ème' } as any);
    await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        demandeurId: ADMIN_ID,
        demandeurRole: 'ADMIN',
      })
    ).rejects.toThrow('existe déjà');
  });

  it('refuse si un bulletin n\'est pas généré', async () => {
    bulletinRepo.ajouter(createBulletin('student-1', false));
    bulletinRepo.definirClasseEleve('student-1', CLASS_ID);
    classeRepo.ajouter({ id: CLASS_ID, schoolId: SCHOOL_ID, name: '3ème', level: '3ème' } as any);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        demandeurId: ADMIN_ID,
        demandeurRole: 'ADMIN',
      })
    ).rejects.toThrow('pas encore générés');
  });
});
