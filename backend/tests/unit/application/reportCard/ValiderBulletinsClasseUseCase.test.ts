/**
 * Tests unitaires — ValiderBulletinsClasseUseCase
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { ValiderBulletinsClasseUseCase } from '@application/reportCard/ValiderBulletinsClasseUseCase';
import { InMemoryBulletinRepository } from '../../../helpers/repositories/InMemoryBulletinRepository';
import { InMemoryBulletinValidationRepository } from '../../../helpers/repositories/InMemoryBulletinValidationRepository';

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-1';
const PERIOD_ID = 'period-1';
const ADMIN_ID = 'admin-1';
const CENSEUR_ID = 'censeur-1';

let bulletinRepo: InMemoryBulletinRepository;
let validationRepo: InMemoryBulletinValidationRepository;
let useCase: ValiderBulletinsClasseUseCase;

beforeEach(() => {
  bulletinRepo = new InMemoryBulletinRepository();
  validationRepo = new InMemoryBulletinValidationRepository();
  useCase = new ValiderBulletinsClasseUseCase(validationRepo, bulletinRepo);
});

describe('ValiderBulletinsClasseUseCase', () => {
  it('autorise un ADMIN à valider', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      sessionId: session.id,
      demandeurId: ADMIN_ID,
      demandeurRole: 'ADMIN',
    });

    expect(result.session.status).toBe('VALIDATED');
  });

  it('autorise un staff avec VALIDATE_GRADES', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });

    const result = await useCase.execute({
      schoolId: SCHOOL_ID,
      sessionId: session.id,
      demandeurId: CENSEUR_ID,
      demandeurRole: 'STAFF',
      demandeurPermissions: ['VALIDATE_GRADES'],
    });

    expect(result.session.status).toBe('VALIDATED');
  });

  it('refuse un enseignant sans permission', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        sessionId: session.id,
        demandeurId: 'teacher-1',
        demandeurRole: 'TEACHER',
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
      })
    ).rejects.toThrow('introuvable');
  });

  it('refuse si le statut n\'est pas SUBMITTED', async () => {
    const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: ADMIN_ID });
    await validationRepo.validerSession(session.id, ADMIN_ID);

    await expect(
      useCase.execute({
        schoolId: SCHOOL_ID,
        sessionId: session.id,
        demandeurId: ADMIN_ID,
        demandeurRole: 'ADMIN',
      })
    ).rejects.toThrow('Impossible de valider');
  });
});
