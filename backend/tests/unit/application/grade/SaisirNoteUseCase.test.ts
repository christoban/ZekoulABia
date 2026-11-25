import { describe, it, expect, beforeEach } from 'bun:test';
import { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import { User } from '@domain/entities/User';
import { InMemoryNoteRepository } from '../../../helpers/repositories/InMemoryNoteRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { InMemoryMatiereRepository } from '../../../helpers/repositories/InMemoryMatiereRepository.ts';
import { InMemoryRattachementEnseignantRepository } from '../../../helpers/repositories/InMemoryRattachementEnseignantRepository.ts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const SUBJECT_ID = 'maths-1';
const CLASS_ID = 'class-3e';
const YEAR_ID = 'year-2026';
const SEQ_ID = 'seq-1';
const STUDENT_ID = 'eleve-1';

function creerEnseignantActif(id = 'teacher-1') {
  return User.reconstituer({
    id,
    schoolId: SCHOOL_ID,
    role: 'TEACHER',
    email: `${id}@ecole.cm`,
    firstName: 'Jean',
    lastName: 'Dupont',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

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

function commandeBase(recordedById = 'teacher-1') {
  return {
    schoolId: SCHOOL_ID,
    studentId: STUDENT_ID,
    subjectId: SUBJECT_ID,
    classId: CLASS_ID,
    academicYearId: YEAR_ID,
    sequenceId: SEQ_ID,
    recordedById,
    sequenceScore: 14,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Fausse assignation classe+matière (TeachingAssignment) — le use case vérifie désormais que
// l'enseignant est assigné à CETTE classe précise, pas seulement à la matière en général.

describe('SaisirNoteUseCase', () => {
  let noteRepo: InMemoryNoteRepository;
  let userRepo: InMemoryUserRepository;
  let matiereRepo: InMemoryMatiereRepository;
  let rattachementRepo: InMemoryRattachementEnseignantRepository;
  let useCase: SaisirNoteUseCase;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    userRepo = new InMemoryUserRepository();
    matiereRepo = new InMemoryMatiereRepository();
    rattachementRepo = new InMemoryRattachementEnseignantRepository();
    useCase = new SaisirNoteUseCase(noteRepo, matiereRepo, userRepo, rattachementRepo);

    // Matière disponible dans l'établissement
    matiereRepo.ajouter({
      id: SUBJECT_ID,
      schoolId: SCHOOL_ID,
      name: 'Mathématiques',
      coefficient: 4,
      hoursPerWeek: 5,
      subjectType: 'THEORETICAL',
    });
  });

  /** Enregistre à la fois l'assignation matière (legacy) ET l'assignation classe+matière (TeachingAssignment). */
  async function assignerEnseignantALaClasse(teacherId = 'teacher-1', classId = CLASS_ID, subjectId = SUBJECT_ID) {
    await matiereRepo.assignerEnseignant(teacherId, subjectId);
    rattachementRepo.ajouterAssignation(teacherId, classId, subjectId);
  }

  describe('Cas nominal', () => {
    it('crée une note en statut DRAFT quand l\'enseignant est assigné à la matière', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      const resultat = await useCase.execute(commandeBase());

      expect(resultat.statut).toBe('DRAFT');
      expect(resultat.noteId).toBeDefined();
      expect(resultat.message).toContain('DRAFT');
      expect(noteRepo.compter()).toBe(1);
    });

    it('retourne un noteId unique à chaque appel', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      const r1 = await useCase.execute(commandeBase());
      // Deuxième note pour un autre élève
      const r2 = await useCase.execute({ ...commandeBase(), studentId: 'eleve-2' });

      expect(r1.noteId).not.toBe(r2.noteId);
      expect(noteRepo.compter()).toBe(2);
    });

    it('accepte n\'importe quel score entre 0 et 20', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      const resultat = await useCase.execute({ ...commandeBase(), sequenceScore: 0 });
      expect(resultat.statut).toBe('DRAFT');
    });

    it('stampe automatiquement le coefficient de la matière sur la note (scénario B)', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();
      // Fixture : matière SUBJECT_ID a coefficient: 4 (voir beforeEach)

      await useCase.execute(commandeBase());
      const note = await noteRepo.findByEleveEtMatiere(STUDENT_ID, SUBJECT_ID, SEQ_ID);

      expect(note?.coefficient).toBe(4);
    });

    it('un coefficient explicite dans la commande reste prioritaire sur celui de la matière', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      await useCase.execute({ ...commandeBase(), coefficient: 2 });
      const note = await noteRepo.findByEleveEtMatiere(STUDENT_ID, SUBJECT_ID, SEQ_ID);

      expect(note?.coefficient).toBe(2);
    });
  });

  describe('Admin — bypass assignation', () => {
    it('permet à un admin de saisir même s\'il n\'est pas assigné à la matière', async () => {
      const admin = creerAdmin();
      userRepo.ajouter(admin);
      // Aucune assignation enregistrée pour admin-1

      const resultat = await useCase.execute(commandeBase('admin-1'));

      expect(resultat.statut).toBe('DRAFT');
    });
  });

  describe('Erreurs — enseignant', () => {
    it('rejette si l\'enseignant n\'existe pas dans le dépôt', async () => {
      // userRepo vide — teacher-1 n'existe pas
      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'Enseignant introuvable ou inactif'
      );
    });

    it('rejette si l\'enseignant est désactivé', async () => {
      const inactif = User.reconstituer({
        ...creerEnseignantActif().toObject(),
        isActive: false,
      });
      userRepo.ajouter(inactif);

      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'Enseignant introuvable ou inactif'
      );
    });

    it('rejette si l\'enseignant TEACHER n\'est pas assigné à la matière', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      // Pas d'assignation → estEnseignantAssigne retourne false

      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'n\'est pas assigné à cette matière'
      );
    });

    it('rejette si l\'enseignant est assigné à la matière mais PAS à cette classe (régression)', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      // Assigné à la matière en général (TeacherSubject), mais dans une AUTRE classe que CLASS_ID
      await assignerEnseignantALaClasse('teacher-1', 'autre-classe', SUBJECT_ID);

      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'n\'est pas assigné à l\'enseignement de cette matière pour cette classe'
      );
    });
  });

  describe('Erreurs — doublon', () => {
    it('rejette si une note existe déjà pour le même élève / matière / séquence', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      // Première saisie
      await useCase.execute(commandeBase());

      // Deuxième saisie identique → doublon
      await expect(useCase.execute(commandeBase())).rejects.toThrow(
        'Une note existe déjà'
      );
    });

    it('autorise deux notes si les séquences sont différentes', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      await useCase.execute(commandeBase());
      const r2 = await useCase.execute({ ...commandeBase(), sequenceId: 'seq-2' });

      expect(r2.statut).toBe('DRAFT');
      expect(noteRepo.compter()).toBe(2);
    });
  });

  describe('Erreurs — score invalide', () => {
    it('rejette un score supérieur à maxValue (défaut 20)', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      await expect(
        useCase.execute({ ...commandeBase(), sequenceScore: 25 })
      ).rejects.toThrow('Score invalide');
    });

    it('rejette un score négatif', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      await expect(
        useCase.execute({ ...commandeBase(), sequenceScore: -1 })
      ).rejects.toThrow('Score invalide');
    });

    it('accepte un score de 100 quand maxValue est 100', async () => {
      const teacher = creerEnseignantActif();
      userRepo.ajouter(teacher);
      await assignerEnseignantALaClasse();

      const r = await useCase.execute({
        ...commandeBase(),
        maxValue: 100,
        sequenceScore: 100,
      });
      expect(r.statut).toBe('DRAFT');
    });
  });
});
