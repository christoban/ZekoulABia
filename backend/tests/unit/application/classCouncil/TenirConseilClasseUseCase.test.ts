import { describe, it, expect, beforeEach } from 'bun:test';
import { TenirConseilClasseUseCase } from '@application/classCouncil/TenirConseilClasseUseCase';
import { User } from '@domain/entities/User';
import { Classe } from '@domain/entities/Classe';
import { ConseilBloqueError } from '@domain/errors/ConseilBloqueError';
import { InMemoryNoteRepository } from '../../../helpers/repositories/InMemoryNoteRepository.ts';
import { InMemoryClasseRepository } from '../../../helpers/repositories/InMemoryClasseRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const CLASS_ID = 'class-3e-c';
const PERIOD_ID = 'period-1';

function creerAdmin(id = 'admin-1') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'ADMIN',
    email: `${id}@ecole.cm`,
    firstName: 'Directeur',
    lastName: 'Mballa',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerCenseur(id = 'censeur-1') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'STAFF',
    email: `${id}@ecole.cm`,
    firstName: 'Paul',
    lastName: 'Censeur',
    isActive: true,
    staffPermissions: ['VALIDATE_GRADES'],
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerStaffSansPermission(id = 'staff-2') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'STAFF',
    email: `${id}@ecole.cm`,
    firstName: 'Autre',
    lastName: 'Staff',
    isActive: true,
    staffPermissions: ['MANAGE_TIMETABLE'],
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function creerClasse() {
  return Classe.reconstituer({
    id: CLASS_ID,
    schoolId: SCHOOL_ID,
    academicYearId: 'annee-1',
    name: '3e',
    serie: 'C',
    capacity: 40,
    status: 'ACTIVE',
    createdAt: new Date(),
  });
}

function commandeBase(presidedById = 'admin-1') {
  return { schoolId: SCHOOL_ID, classId: CLASS_ID, academicPeriodId: PERIOD_ID, presidedById };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TenirConseilClasseUseCase', () => {
  let noteRepo: InMemoryNoteRepository;
  let classeRepo: InMemoryClasseRepository;
  let userRepo: InMemoryUserRepository;
  let useCase: TenirConseilClasseUseCase;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    classeRepo = new InMemoryClasseRepository();
    userRepo = new InMemoryUserRepository();
    useCase = new TenirConseilClasseUseCase(noteRepo, classeRepo, userRepo);
    classeRepo.ajouter(creerClasse());
    noteRepo.setNonValidees([]); // par défaut : toutes validées
  });

  describe('Cas nominal', () => {
    it('Admin peut présider le conseil (toutes notes validées)', async () => {
      userRepo.ajouter(creerAdmin());

      const resultat = await useCase.execute(commandeBase('admin-1'));

      expect(resultat.sessionId).toBeDefined();
      expect(resultat.classeNom).toBe('3e C');
      expect(resultat.message).toContain('Conseil de Classe ouvert');
    });

    it('STAFF avec VALIDATE_GRADES peut présider', async () => {
      userRepo.ajouter(creerCenseur());

      const resultat = await useCase.execute(commandeBase('censeur-1'));

      expect(resultat.sessionId).toBeDefined();
      expect(resultat.classeNom).toBe('3e C');
    });
  });

  describe('Loi 5 — notes non validées', () => {
    it('lance ConseilBloqueError si au moins une note n\'est pas validée', async () => {
      userRepo.ajouter(creerAdmin());
      noteRepo.setNonValidees([
        { matiereNom: 'Mathématiques', enseignantNom: 'Dupont', statut: 'DRAFT' },
      ]);

      await expect(useCase.execute(commandeBase())).rejects.toThrow(ConseilBloqueError);
    });

    it('le message d\'erreur cite les matières bloquantes', async () => {
      userRepo.ajouter(creerAdmin());
      noteRepo.setNonValidees([
        { matiereNom: 'Français', enseignantNom: 'Martin', statut: 'DRAFT' },
        { matiereNom: 'Physique', enseignantNom: 'Ngo', statut: 'DRAFT' },
      ]);

      await expect(useCase.execute(commandeBase())).rejects.toThrow('Français');
    });
  });

  describe('Erreurs — président', () => {
    it('rejette si le président est introuvable', async () => {
      await expect(useCase.execute(commandeBase('inconnu'))).rejects.toThrow('introuvable');
    });

    it('rejette si STAFF sans permission VALIDATE_GRADES', async () => {
      userRepo.ajouter(creerStaffSansPermission());

      await expect(useCase.execute(commandeBase('staff-2'))).rejects.toThrow(
        'Seul un Admin ou Censeur'
      );
    });
  });

  describe('Erreurs — classe', () => {
    it('rejette si la classe est introuvable', async () => {
      userRepo.ajouter(creerAdmin());

      await expect(
        useCase.execute({ ...commandeBase(), classId: 'classe-inexistante' })
      ).rejects.toThrow('Classe introuvable');
    });
  });
});
