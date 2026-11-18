/**
 * Tests unitaires — PublierBulletinsClasseUseCase
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { PublierBulletinsClasseUseCase } from '@application/reportCard/PublierBulletinsClasseUseCase';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { Bulletin } from '@domain/entities/Bulletin';
import { InMemoryBulletinRepository } from '../../../helpers/repositories/InMemoryBulletinRepository';
import { InMemoryBulletinValidationRepository } from '../../../helpers/repositories/InMemoryBulletinValidationRepository';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../helpers/services/InMemoryEmailService';

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-1';
const PERIOD_ID = 'period-1';
const ADMIN_ID = 'admin-1';

function createGeneratedBulletin(studentId = 'student-1'): Bulletin {
  const b = Bulletin.create({
    schoolId: SCHOOL_ID,
    studentId,
    academicYearId: 'year-1',
    academicPeriodId: PERIOD_ID,
    template: 'FR_SECONDARY',
  });
  b.definirLignesMatiere([{ id: 'line-1', subjectId: 's1', subjectName: 'Maths', coefficient: 2, subjectAverage: 13, weightedScore: 26 }]);
  b.definirResultats({ generalAverage: 13, rank: 1, totalStudents: 1, mention: 'Assez Bien', absenceCount: 0 });
  b.marquerGenere('bulletins/test.pdf');
  return b;
}

let bulletinRepo: InMemoryBulletinRepository;
let validationRepo: InMemoryBulletinValidationRepository;
let envoyerBulletins: EnvoyerBulletinsUseCase;
let useCase: PublierBulletinsClasseUseCase;

beforeEach(() => {
  bulletinRepo = new InMemoryBulletinRepository();
  validationRepo = new InMemoryBulletinValidationRepository();
  envoyerBulletins = new EnvoyerBulletinsUseCase(bulletinRepo, new InMemoryUserRepository(), new InMemoryEmailService(), validationRepo);
  useCase = new PublierBulletinsClasseUseCase(validationRepo, bulletinRepo, envoyerBulletins);
});

describe('PublierBulletinsClasseUseCase', () => {
  it('autorise un ADMIN à publier', async () => {
    bulletinRepo.ajouter(createGeneratedBulletin('student-1'));
    bulletinRepo.definirClasseEleve('student-1', CLASS_ID);
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });
    await validationRepo.validerSession(session.id, ADMIN_ID);

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      sessionId: session.id,
      demandeurId: ADMIN_ID,
      demandeurRole: 'ADMIN',
      nomEtablissement: 'École Test',
      nomPeriode: 'Trimestre 1',
    });

    expect(result.session.status).toBe('PUBLISHED');
  });

  it('refuse de publier si aucun bulletin généré n\'existe pour la classe', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });
    await validationRepo.validerSession(session.id, ADMIN_ID);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        sessionId: session.id,
        demandeurId: ADMIN_ID,
        demandeurRole: 'ADMIN',
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      })
    ).rejects.toThrow('Aucun bulletin trouvé');
  });

  it('refuse un enseignant sans permission', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });
    await validationRepo.validerSession(session.id, ADMIN_ID);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        sessionId: session.id,
        demandeurId: 'teacher-1',
        demandeurRole: 'TEACHER',
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      })
    ).rejects.toThrow('Permission VALIDATE_GRADES');
  });

  it('refuse si la session n\'existe pas', async () => {
    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        sessionId: 'nonexistent',
        demandeurId: ADMIN_ID,
        demandeurRole: 'ADMIN',
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      })
    ).rejects.toThrow('introuvable');
  });

  it('refuse si le statut n\'est pas VALIDATED', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        sessionId: session.id,
        demandeurId: ADMIN_ID,
        demandeurRole: 'ADMIN',
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      })
    ).rejects.toThrow('Impossible de publier');
  });
});
