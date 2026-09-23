import { describe, it, expect, beforeEach } from 'bun:test';
import { ConnecterUtilisateurUseCase } from '../../../../src/application/user/ConnecterUtilisateurUseCase.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository.ts';
import { FakeTokenService } from '../../../helpers/services/FakeTokenService.ts';
import { User } from '@domain/entities/User';
import { School } from '@domain/entities/School';

describe('ConnecterUtilisateurUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let schoolRepo: InMemorySchoolRepository;
  let tokenService: FakeTokenService;
  let useCase: ConnecterUtilisateurUseCase;

  const ecoleActive = School.reconstituer({
    id: 'school-1',
    name: 'Lycée Test',
    subdomain: 'lycee-test',
    status: 'ACTIVE',
    plan: 'STANDARD',
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    ownership: 'PRIVATE_SECULAR',
    saturdaySchedule: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const enseignant = User.reconstituer({
    id: 'user-1',
    schoolId: 'school-1',
    role: 'TEACHER',
    email: 'prof@test.cm',
    firstName: 'Jean',
    lastName: 'Dupont',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    staffPermissions: [],
  });

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    schoolRepo = new InMemorySchoolRepository();
    tokenService = new FakeTokenService();
    useCase = new ConnecterUtilisateurUseCase(userRepo, schoolRepo, tokenService);

    schoolRepo.ajouter(ecoleActive);
    userRepo.ajouter(enseignant);
  });

  it('devrait connecter un utilisateur valide et retourner les tokens', async () => {
    const resultat = await useCase.execute({
      email: 'prof@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-1',
    });

    expect(resultat.userId).toBe('user-1');
    expect(resultat.role).toBe('TEACHER');
    expect(resultat.accessToken).toContain('user-1');
    expect(resultat.refreshToken).toContain('user-1');
  });

  it("devrait rejeter si l'école est suspendue", async () => {
    const ecoleSuspendue = School.reconstituer({
      ...ecoleActive.toObject(),
      id: 'school-2',
      status: 'SUSPENDED',
    });
    schoolRepo.ajouter(ecoleSuspendue);
    // Les credentials sont vérifiés AVANT le statut de l'école (voir ConnecterUtilisateurUseCase) —
    // il faut un utilisateur réellement rattaché à school-2, sinon on échoue plus tôt sur
    // "Email ou mot de passe incorrect" et le test ne teste jamais ce qu'il prétend tester.
    userRepo.ajouter(User.reconstituer({ ...enseignant.toObject(), id: 'user-2', schoolId: 'school-2' }));

    await expect(useCase.execute({
      email: 'prof@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-2',
    })).rejects.toThrow('SCHOOL_SUSPENDED');
  });

  it("devrait rejeter si l'école n'est ni ACTIVE ni APPROVED", async () => {
    const ecolePending = School.reconstituer({
      ...ecoleActive.toObject(),
      id: 'school-3',
      status: 'PENDING',
    });
    schoolRepo.ajouter(ecolePending);
    userRepo.ajouter(User.reconstituer({ ...enseignant.toObject(), id: 'user-3', schoolId: 'school-3' }));

    await expect(useCase.execute({
      email: 'prof@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-3',
    })).rejects.toThrow('actif');
  });

  it("devrait rejeter si l'utilisateur est introuvable", async () => {
    await expect(useCase.execute({
      email: 'inconnu@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-1',
    })).rejects.toThrow('incorrect');
  });

  it("devrait rejeter si l'utilisateur est inactif", async () => {
    const inactif = User.reconstituer({
      ...enseignant.toObject(),
      id: 'user-inactif',
      email: 'inactif@test.cm',
      isActive: false,
    });
    userRepo.ajouter(inactif);

    await expect(useCase.execute({
      email: 'inactif@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-1',
    })).rejects.toThrow('incorrect');
  });

  it('ne doit PAS activer une école APPROVED au login Admin (redirection vers configuration uniquement)', async () => {
    const ecoleApproved = School.reconstituer({
      ...ecoleActive.toObject(),
      id: 'school-approved',
      status: 'APPROVED',
    });
    schoolRepo.ajouter(ecoleApproved);

    const admin = User.reconstituer({
      ...enseignant.toObject(),
      id: 'admin-1',
      email: 'admin@test.cm',
      role: 'ADMIN',
      schoolId: 'school-approved',
    });
    userRepo.ajouter(admin);

    const resultat = await useCase.execute({
      email: 'admin@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-approved',
    });

    const ecoleApresLogin = await schoolRepo.findById('school-approved');
    expect(ecoleApresLogin?.status).toBe('APPROVED');
    expect(resultat.redirectTo).toBe('/admin/configuration');
  });

  it('devrait connecter un Admin sur une école ACTIVE sans changer le statut', async () => {
    const admin = User.reconstituer({
      ...enseignant.toObject(),
      id: 'admin-active',
      email: 'admin.active@test.cm',
      role: 'ADMIN',
      schoolId: 'school-1',
    });
    userRepo.ajouter(admin);

    const resultat = await useCase.execute({
      email: 'admin.active@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-1',
    });

    const ecoleApresLogin = await schoolRepo.findById('school-1');
    expect(ecoleApresLogin?.status).toBe('ACTIVE');
    expect(resultat.userId).toBe('admin-active');
    expect(resultat.redirectTo).toBeUndefined();
  });

  it('devrait enregistrer le lastLogin', async () => {
    await useCase.execute({
      email: 'prof@test.cm',
      plainPassword: 'motdepasse',
      schoolId: 'school-1',
    });

    const userApres = await userRepo.findById('user-1');
    expect(userApres?.toObject().lastLogin).toBeDefined();
  });

  it('devrait refuser la connexion pour un utilisateur en mode SMS_ONLY ou NO_LOGIN', async () => {
    const parentSms = User.reconstituer({
      ...enseignant.toObject(),
      id: 'parent-sms-1',
      email: 'parent.sms@test.cm',
      role: 'PARENT',
      accessMode: 'SMS_ONLY',
    });
    userRepo.ajouter(parentSms);

    expect(
      useCase.execute({
        email: 'parent.sms@test.cm',
        plainPassword: 'motdepasse',
        schoolId: 'school-1',
      }),
    ).rejects.toThrow("Ce compte ne dispose pas d'un accès de connexion direct.");

    const parentNoLogin = User.reconstituer({
      ...enseignant.toObject(),
      id: 'parent-no-login-1',
      email: 'parent.nologin@test.cm',
      role: 'PARENT',
      accessMode: 'NO_LOGIN',
    });
    userRepo.ajouter(parentNoLogin);

    expect(
      useCase.execute({
        email: 'parent.nologin@test.cm',
        plainPassword: 'motdepasse',
        schoolId: 'school-1',
      }),
    ).rejects.toThrow("Ce compte ne dispose pas d'un accès de connexion direct.");
  });
});
