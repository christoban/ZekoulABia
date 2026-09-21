/**
 * Tests d'intégration — PrismaEleveOnboardingRepository
 * Vérifie :
 * 1. La création atomique de l'élève, de l'inscription et du log d'activité.
 * 2. Le verrou pessimiste et la vérification de capacité de classe (avec/sans dérogation).
 * 3. Le rollback complet si une étape de transaction échoue.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { PrismaEleveOnboardingRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaEleveOnboardingRepository.ts';

const repo = new PrismaEleveOnboardingRepository(prismaTest);

let schoolId: string;
let adminUserId: string;
let academicYearId: string;
let classId: string;
let fullClassId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'onboarding-test');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'adm-onb' });
  adminUserId = admin.id;

  const academicYear = await prismaTest.academicYear.create({
    data: {
      name: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      schoolId,
    },
  });
  academicYearId = academicYear.id;

  const standardClass = await prismaTest.class.create({
    data: {
      name: '6ème A',
      capacity: 30,
      schoolId,
      academicYearId,
    },
  });
  classId = standardClass.id;

  const smallClass = await prismaTest.class.create({
    data: {
      name: 'Terminale C',
      capacity: 1,
      schoolId,
      academicYearId,
    },
  });
  fullClassId = smallClass.id;
});

afterAll(async () => {
  await prismaTest.activitiesLog.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.parentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.studentOnboarding.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaEleveOnboardingRepository — Intégration', () => {
  it('valide et active une inscription dans une transaction unique avec ActivitiesLog', async () => {
    const onboarding = await prismaTest.studentOnboarding.create({
      data: {
        schoolId,
        nomProvisoire: 'Mbida Alain',
        recipientType: 'ELEVE',
        token: `tok-integ-${Date.now()}`,
        tokenExpiresAt: new Date(Date.now() + 86400000),
        status: 'SUBMITTED',
      },
    });

    const res = await repo.validerOnboarding({
      schoolId,
      onboardingId: onboarding.id,
      validatedById: adminUserId,
      classId,
      nom: 'Mbida',
      prenom: 'Alain',
      dateOfBirth: new Date('2014-05-12'),
      gender: 'M',
      eleveContactEmail: 'alain.mbida@test.cm',
      eleveContactTelephone: null,
      parentContactEmail: null,
      parentContactTelephone: null,
      parentRecoitContact: false,
      eleveAccessMode: 'FULL_ACCESS',
      parentAccessMode: 'FULL_ACCESS',
      derogationCapacite: false,
      roleActeur: 'ADMIN',
    });

    expect(res.studentProfileId).toBeTruthy();

    const studentProfile = await prismaTest.studentProfile.findUnique({
      where: { id: res.studentProfileId },
      include: { user: true, enrollmentsYearScoped: true },
    });
    expect(studentProfile).not.toBeNull();
    expect(studentProfile!.user.firstName).toBe('Alain');
    expect(studentProfile!.user.lastName).toBe('Mbida');
    expect(studentProfile!.enrollmentsYearScoped.length).toBe(1);
    expect(studentProfile!.enrollmentsYearScoped[0].classId).toBe(classId);

    const updatedOnboarding = await prismaTest.studentOnboarding.findUnique({
      where: { id: onboarding.id },
    });
    expect(updatedOnboarding?.status).toBe('ACTIVATED');

    const activity = await prismaTest.activitiesLog.findFirst({
      where: {
        schoolId,
        action: 'ONBOARDING_ACTIVATED',
        userId: adminUserId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity).not.toBeNull();
    const meta = activity!.metadata as Record<string, any>;
    expect(meta.onboardingId).toBe(onboarding.id);
    expect(meta.studentProfileId).toBe(res.studentProfileId);
    expect(meta.classId).toBe(classId);
    expect(meta.roleActeur).toBe('ADMIN');
  });

  it('bloque l inscription si la capacité de la classe est atteinte sans dérogation', async () => {
    // Remplir la classe à capacité 1
    const dummyEleve = await prismaTest.user.create({
      data: {
        schoolId,
        role: 'STUDENT',
        firstName: 'Premier',
        lastName: 'Inscrit',
        isActive: true,
      },
    });
    const dummyProfile = await prismaTest.studentProfile.create({
      data: {
        userId: dummyEleve.id,
        studentStatus: 'ACTIVE',
      },
    });
    await prismaTest.enrollment.create({
      data: {
        schoolId,
        studentId: dummyProfile.id,
        classId: fullClassId,
        academicYearId,
        enrolledById: adminUserId,
        status: 'ACTIVE',
      },
    });

    const onboarding2 = await prismaTest.studentOnboarding.create({
      data: {
        schoolId,
        nomProvisoire: 'Second Candidat',
        recipientType: 'ELEVE',
        token: `tok-full-${Date.now()}`,
        tokenExpiresAt: new Date(Date.now() + 86400000),
        status: 'SUBMITTED',
      },
    });

    await expect(
      repo.validerOnboarding({
        schoolId,
        onboardingId: onboarding2.id,
        validatedById: adminUserId,
        classId: fullClassId,
        nom: 'Second',
        prenom: 'Candidat',
        dateOfBirth: new Date('2013-01-01'),
        gender: 'F',
        eleveContactEmail: 'second@test.cm',
        eleveContactTelephone: null,
        parentContactEmail: null,
        parentContactTelephone: null,
        parentRecoitContact: false,
        eleveAccessMode: 'FULL_ACCESS',
        parentAccessMode: 'FULL_ACCESS',
        derogationCapacite: false,
        roleActeur: 'STAFF',
      })
    ).rejects.toThrow('capacité maximale');

    // Avec dérogation accordée par ADMIN, l inscription réussit
    const resDerogation = await repo.validerOnboarding({
      schoolId,
      onboardingId: onboarding2.id,
      validatedById: adminUserId,
      classId: fullClassId,
      nom: 'Second',
      prenom: 'Candidat',
      dateOfBirth: new Date('2013-01-01'),
      gender: 'F',
      eleveContactEmail: 'second@test.cm',
      eleveContactTelephone: null,
      parentContactEmail: null,
      parentContactTelephone: null,
      parentRecoitContact: false,
      eleveAccessMode: 'FULL_ACCESS',
      parentAccessMode: 'FULL_ACCESS',
      derogationCapacite: true,
      motifDerogation: 'Dérogation accordée par le chef d établissement',
      roleActeur: 'ADMIN',
    });

    expect(resDerogation.studentProfileId).toBeTruthy();

    const logDerogation = await prismaTest.activitiesLog.findFirst({
      where: {
        schoolId,
        action: 'ONBOARDING_ACTIVATED',
      },
      orderBy: { createdAt: 'desc' },
    });
    const metaDerog = logDerogation!.metadata as Record<string, any>;
    expect(metaDerog.derogationCapacite).toBe(true);
    expect(metaDerog.motifDerogation).toBe('Dérogation accordée par le chef d établissement');
  });

  it('effectue un rollback complet si la transaction échoue', async () => {
    const onboardingRollback = await prismaTest.studentOnboarding.create({
      data: {
        schoolId,
        nomProvisoire: 'Rollback Test',
        recipientType: 'ELEVE',
        token: `tok-rb-${Date.now()}`,
        tokenExpiresAt: new Date(Date.now() + 86400000),
        status: 'SUBMITTED',
      },
    });

    const userCountAvant = await prismaTest.user.count({ where: { schoolId } });
    const profileCountAvant = await prismaTest.studentProfile.count({ where: { user: { schoolId } } });
    const enrollmentCountAvant = await prismaTest.enrollment.count({ where: { schoolId } });

    // Forcer un échec en fournissant une classe inexistante
    await expect(
      repo.validerOnboarding({
        schoolId,
        onboardingId: onboardingRollback.id,
        validatedById: adminUserId,
        classId: 'classe-inexistante-pour-provoquer-echec',
        nom: 'Rollback',
        prenom: 'Test',
        dateOfBirth: null,
        gender: null,
        eleveContactEmail: null,
        eleveContactTelephone: null,
        parentContactEmail: null,
        parentContactTelephone: null,
        parentRecoitContact: false,
        eleveAccessMode: 'FULL_ACCESS',
        parentAccessMode: 'FULL_ACCESS',
        derogationCapacite: false,
        roleActeur: 'ADMIN',
      })
    ).rejects.toThrow();

    const userCountApres = await prismaTest.user.count({ where: { schoolId } });
    const profileCountApres = await prismaTest.studentProfile.count({ where: { user: { schoolId } } });
    const enrollmentCountApres = await prismaTest.enrollment.count({ where: { schoolId } });

    expect(userCountApres).toBe(userCountAvant);
    expect(profileCountApres).toBe(profileCountAvant);
    expect(enrollmentCountApres).toBe(enrollmentCountAvant);

    const onboardingApres = await prismaTest.studentOnboarding.findUnique({
      where: { id: onboardingRollback.id },
    });
    expect(onboardingApres?.status).toBe('SUBMITTED');
  });
});
