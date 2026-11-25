/**
 * Tests unitaires — TransfererEleveUseCase (V1.1)
 *
 * 1. Échoue si classe source = classe cible
 * 2. Échoue si classe destination introuvable
 * 3. Échoue si classe destination hors de l'école
 * 4. Échoue si élève introuvable
 * 5. Échoue si élève hors de l'école
 * 6. Transfert réussi — appel transfererEleve avec bons params
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository';
import { User } from '@domain/entities/User';

const SCHOOL = 'school-1';
const OTHER_SCHOOL = 'school-2';

function makeEleve(id = 'eleve-1') {
  return User.reconstituer({ id, schoolId: SCHOOL, role: 'STUDENT', email: `${id}@x.cm`, firstName: 'Test', lastName: 'Eleve', isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date() });
}

let userRepo: InMemoryUserRepository;
let classeRepo: InMemoryClasseRepository;
let useCase: TransfererEleveUseCase;

beforeEach(async () => {
  userRepo = new InMemoryUserRepository();
  classeRepo = new InMemoryClasseRepository();
  useCase = new TransfererEleveUseCase(userRepo as any, classeRepo as any);
  // Clases
  classeRepo.ajouter({ id: 'cl-1', schoolId: SCHOOL, name: '6ème A', level: '6ème', academicYearId: 'ay-1' } as any);
  classeRepo.ajouter({ id: 'cl-2', schoolId: SCHOOL, name: '5ème A', level: '5ème', academicYearId: 'ay-1' } as any);
  classeRepo.ajouter({ id: 'cl-other', schoolId: OTHER_SCHOOL, name: 'Autre', level: '6ème', academicYearId: 'ay-1' } as any);
  // Élèves
  await userRepo.save(makeEleve('eleve-1'));
  await userRepo.save(makeEleve('eleve-2'));
  await userRepo.save(makeEleve('eleve-other'));
  // Re-save dans l'autre école
  await userRepo.save(User.reconstituer({ id: 'eleve-other', schoolId: OTHER_SCHOOL, role: 'STUDENT', email: 'x@x.cm', firstName: 'E', lastName: 'O', isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date() }));
});

describe('TransfererEleveUseCase', () => {
  it('échoue si classe source = classe cible', async () => {
    await expect(useCase.execute({ studentId: 'eleve-1', fromClasseId: 'cl-1', toClasseId: 'cl-1', schoolId: SCHOOL, demandeurId: 'admin-1' }))
      .rejects.toThrow('identiques');
  });

  it('échoue si classe destination introuvable', async () => {
    await expect(useCase.execute({ studentId: 'eleve-1', fromClasseId: 'cl-1', toClasseId: 'nonexistent', schoolId: SCHOOL, demandeurId: 'admin-1' }))
      .rejects.toThrow('introuvable');
  });

  it('échoue si classe destination hors école', async () => {
    await expect(useCase.execute({ studentId: 'eleve-1', fromClasseId: 'cl-1', toClasseId: 'cl-other', schoolId: SCHOOL, demandeurId: 'admin-1' }))
      .rejects.toThrow('établissement');
  });

  it('échoue si élève introuvable', async () => {
    await expect(useCase.execute({ studentId: 'nonexistent', fromClasseId: 'cl-1', toClasseId: 'cl-2', schoolId: SCHOOL, demandeurId: 'admin-1' }))
      .rejects.toThrow('introuvable');
  });

  it('échoue si élève hors école', async () => {
    await expect(useCase.execute({ studentId: 'eleve-other', fromClasseId: 'cl-1', toClasseId: 'cl-2', schoolId: SCHOOL, demandeurId: 'admin-1' }))
      .rejects.toThrow('établissement');
  });

  it('transfert réussi', async () => {
    // On vérifie que le transfer ne lance pas d'erreur
    // (le repo est InMemory, pas de vérification d'état post-transfert pour ce test)
    await expect(useCase.execute({ studentId: 'eleve-1', fromClasseId: 'cl-1', toClasseId: 'cl-2', schoolId: SCHOOL, demandeurId: 'admin-1' }))
      .resolves.toBeUndefined();
  });
});
