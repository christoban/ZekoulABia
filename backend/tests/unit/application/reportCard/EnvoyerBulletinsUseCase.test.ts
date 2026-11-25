/**
 * Tests unitaires — EnvoyerBulletinsUseCase
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { InMemoryBulletinRepository } from '../../../helpers/repositories/InMemoryBulletinRepository';
import { InMemoryBulletinValidationRepository } from '../../../helpers/repositories/InMemoryBulletinValidationRepository';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryEmailService } from '../../../helpers/services/InMemoryEmailService';
import { Bulletin } from '@domain/entities/Bulletin';
import { User } from '@domain/entities/User';

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-1';
const PERIOD_ID = 'period-1';
const STUDENT_ID = 'student-1';

let bulletinRepo: InMemoryBulletinRepository;
let validationRepo: InMemoryBulletinValidationRepository;
let userRepo: InMemoryUserRepository;
let emailService: InMemoryEmailService;
let useCase: EnvoyerBulletinsUseCase;

function creerEleve(id = STUDENT_ID) {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'STUDENT',
    email: `${id}@parent.cm`,
    firstName: 'Junior',
    lastName: 'Kamga',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerParent(parentId = 'parent-1', email = 'parent1@test.cm') {
  return User.reconstituer({
    id: parentId,
    schoolId: SCHOOL_ID,
    role: 'PARENT',
    email,
    firstName: 'Papa',
    lastName: 'Kamga',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

beforeEach(() => {
  bulletinRepo = new InMemoryBulletinRepository();
  validationRepo = new InMemoryBulletinValidationRepository();
  userRepo = new InMemoryUserRepository();
  emailService = new InMemoryEmailService();
  useCase = new EnvoyerBulletinsUseCase(bulletinRepo, userRepo, emailService, validationRepo);
});

function createGeneratedBulletin(studentId = STUDENT_ID): Bulletin {
  const b = Bulletin.create({
    schoolId: SCHOOL_ID,
    studentId,
    academicYearId: 'year-1',
    academicPeriodId: PERIOD_ID,
    template: 'FR_SECONDARY',
  });
  b.definirLignesMatiere([{ id: '1', subjectId: 's1', subjectName: 'Maths', coefficient: 1, subjectAverage: 12 }]);
  b.definirResultats({ generalAverage: 12, rank: 1, totalStudents: 1, mention: 'Bien', absenceCount: 0 });
  b.marquerGenere('test.pdf');
  return b;
}

describe('EnvoyerBulletinsUseCase', () => {
  describe('Gates — validation session', () => {
    it('refuse si aucune session PUBLISHED n\'existe', async () => {
      bulletinRepo.ajouter(createGeneratedBulletin());

      await expect(
        useCase.execute({
          schoolId: SCHOOL_ID,
          classId: CLASS_ID,
          academicPeriodId: PERIOD_ID,
          nomEtablissement: 'École Test',
          nomPeriode: 'Trimestre 1',
        })
      ).rejects.toThrow('Publication non autorisée');
    });

    it('refuse si la session n\'est pas PUBLISHED', async () => {
      await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: 'admin-1' });
      bulletinRepo.ajouter(createGeneratedBulletin());

      await expect(
        useCase.execute({
          schoolId: SCHOOL_ID,
          classId: CLASS_ID,
          academicPeriodId: PERIOD_ID,
          nomEtablissement: 'École Test',
          nomPeriode: 'Trimestre 1',
        })
      ).rejects.toThrow('Publication non autorisée');
    });
  });

  describe('Cas nominal', () => {
    it('envoie les bulletins aux parents et retourne le compteur', async () => {
      const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: 'admin-1' });
      await validationRepo.publierSession(session.id);

      userRepo.ajouter(creerEleve());
      userRepo.ajouter(creerParent('parent-1', 'papa@test.cm'));
      bulletinRepo.definirClasseEleve(STUDENT_ID, CLASS_ID);
      userRepo.definirParentsEleve(STUDENT_ID, ['parent-1']);

      bulletinRepo.ajouter(createGeneratedBulletin());

      const resultat = await useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      });

      expect(resultat.envoyes).toBe(1);
      expect(resultat.echoues).toBe(0);
      expect(emailService.appels).toHaveLength(1);
      expect(emailService.appels[0].destinataire).toBe('papa@test.cm');
      expect(emailService.appels[0].eventType).toBe('report_card_available');
    });

    it('fallback email élève si aucun parent avec email', async () => {
      const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: 'admin-1' });
      await validationRepo.publierSession(session.id);

      userRepo.ajouter(creerEleve());
      bulletinRepo.definirClasseEleve(STUDENT_ID, CLASS_ID);

      bulletinRepo.ajouter(createGeneratedBulletin());

      const resultat = await useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      });

      expect(resultat.envoyes).toBe(1);
      expect(emailService.appels).toHaveLength(1);
      expect(emailService.appels[0].destinataire).toBe(`${STUDENT_ID}@parent.cm`);
    });

    it('ignore les bulletins non générés ou déjà envoyés', async () => {
      const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: 'admin-1' });
      await validationRepo.publierSession(session.id);

      const bulletinDraft = Bulletin.create({
        schoolId: SCHOOL_ID,
        studentId: STUDENT_ID,
        academicYearId: 'year-1',
        academicPeriodId: PERIOD_ID,
        template: 'FR_SECONDARY',
      });

      bulletinRepo.definirClasseEleve(STUDENT_ID, CLASS_ID);
      bulletinRepo.ajouter(bulletinDraft);

      const resultat = await useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
      });

      expect(resultat.envoyes).toBe(0);
      expect(emailService.appels).toHaveLength(0);
    });

    it('utilise le sujet en anglais si langue = en', async () => {
      const session = await validationRepo.creerSession({ schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, submittedById: 'admin-1' });
      await validationRepo.publierSession(session.id);

      userRepo.ajouter(creerEleve());
      userRepo.ajouter(creerParent('parent-1', 'papa@test.cm'));
      bulletinRepo.definirClasseEleve(STUDENT_ID, CLASS_ID);
      userRepo.definirParentsEleve(STUDENT_ID, ['parent-1']);
      bulletinRepo.ajouter(createGeneratedBulletin());

      await useCase.execute({
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        academicPeriodId: PERIOD_ID,
        nomEtablissement: 'École Test',
        nomPeriode: 'Trimestre 1',
        langue: 'en',
      });

      expect(emailService.appels[0].sujet).toContain('Report card');
    });
  });
});
