import { describe, it, expect, beforeEach } from 'bun:test';
import { VerrouillerNoteUseCase } from '@application/grade/VerrouillerNoteUseCase';
import { Note } from '@domain/entities/Note';
import { InMemoryNoteRepository } from '../../../helpers/repositories/InMemoryNoteRepository.ts';
import { InMemoryMatiereRepository } from '../../../helpers/repositories/InMemoryMatiereRepository.ts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL_ID = 'school-1';
const NOTE_ID_FIXE = 'note-uuid-fixe';
const TEACHER_ID = 'teacher-1';
const SUBJECT_ID = 'maths-1';

function creerNoteAvecIdFixe(): Note {
  return Note.reconstituer({
    id: NOTE_ID_FIXE,
    schoolId: SCHOOL_ID,
    studentId: 'eleve-1',
    subjectId: SUBJECT_ID,
    classId: 'class-3e',
    academicYearId: 'year-2026',
    sequenceId: 'seq-1',
    recordedById: TEACHER_ID,
    sequenceScore: 14,
    coefficient: 4,
    maxValue: 20,
    validationStatus: 'DRAFT',
    isAbsentGrade: false,
    isOfflineSync: false,
    createdAt: new Date(),
  });
}

function creerNoteEnDraft(): Note {
  return Note.create({
    schoolId: SCHOOL_ID,
    studentId: 'eleve-1',
    subjectId: SUBJECT_ID,
    classId: 'class-3e',
    academicYearId: 'year-2026',
    sequenceId: 'seq-1',
    recordedById: TEACHER_ID,
    sequenceScore: 14,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VerrouillerNoteUseCase', () => {
  let noteRepo: InMemoryNoteRepository;
  let matiereRepo: InMemoryMatiereRepository;
  let useCase: VerrouillerNoteUseCase;

  beforeEach(() => {
    noteRepo = new InMemoryNoteRepository();
    matiereRepo = new InMemoryMatiereRepository();
    useCase = new VerrouillerNoteUseCase(noteRepo, matiereRepo);
  });

  describe('Cas nominal — enseignant assigné', () => {
    it('passe la note de DRAFT à LOCKED', async () => {
      await matiereRepo.assignerEnseignant(TEACHER_ID, SUBJECT_ID);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      const resultat = await useCase.execute({
        noteId: NOTE_ID_FIXE,
        demandeurId: TEACHER_ID,
        schoolId: SCHOOL_ID,
      });

      expect(resultat.statut).toBe('LOCKED');
      expect(resultat.noteId).toBe(NOTE_ID_FIXE);
    });

    it('persiste le nouveau statut dans le dépôt', async () => {
      await matiereRepo.assignerEnseignant(TEACHER_ID, SUBJECT_ID);
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      await useCase.execute({ noteId: NOTE_ID_FIXE, demandeurId: TEACHER_ID, schoolId: SCHOOL_ID });

      const noteApres = await noteRepo.findById(NOTE_ID_FIXE, SCHOOL_ID);
      expect(noteApres?.validationStatus).toBe('LOCKED');
    });
  });

  describe('Erreurs — autorisation (même logique que ModifierNoteUseCase)', () => {
    it('rejette si l\'enseignant n\'est pas assigné à la matière', async () => {
      // Pas d'assignation → matiereRepo.return false par défaut
      const note = creerNoteAvecIdFixe();
      await noteRepo.save(note);

      await expect(
        useCase.execute({ noteId: NOTE_ID_FIXE, demandeurId: 'teacher-inconnu', schoolId: SCHOOL_ID })
      ).rejects.toThrow('pas assigné');
    });
  });

  describe('Erreurs — note', () => {
    it('rejette si la note n\'existe pas', async () => {
      await matiereRepo.assignerEnseignant(TEACHER_ID, SUBJECT_ID);

      await expect(
        useCase.execute({ noteId: 'note-inexistante', demandeurId: TEACHER_ID, schoolId: SCHOOL_ID })
      ).rejects.toThrow('introuvable');
    });

    it('rejette si la note est déjà LOCKED (idempotence)', async () => {
      await matiereRepo.assignerEnseignant(TEACHER_ID, SUBJECT_ID);

      const noteDejaVerrouillee = Note.reconstituer({
        id: 'note-deja-lockee',
        schoolId: SCHOOL_ID,
        studentId: 'eleve-1',
        subjectId: SUBJECT_ID,
        classId: 'class-3e',
        academicYearId: 'year-2026',
        sequenceId: 'seq-1',
        recordedById: TEACHER_ID,
        sequenceScore: 14,
        coefficient: 4,
        maxValue: 20,
        validationStatus: 'LOCKED',
        isAbsentGrade: false,
        isOfflineSync: false,
        createdAt: new Date(),
      });
      await noteRepo.save(noteDejaVerrouillee);

      await expect(
        useCase.execute({ noteId: 'note-deja-lockee', demandeurId: TEACHER_ID, schoolId: SCHOOL_ID })
      ).rejects.toThrow('Impossible de verrouiller');
    });
  });

  describe('Isolation multi-tenant', () => {
    it('rejette le verrouillage d\'une note appartenant à une autre école', async () => {
      await matiereRepo.assignerEnseignant(TEACHER_ID, SUBJECT_ID);

      const noteAutreEcole = Note.reconstituer({
        id: 'note-autre-ecole',
        schoolId: 'school-2',
        studentId: 'eleve-9',
        subjectId: SUBJECT_ID,
        classId: 'class-3e',
        academicYearId: 'year-2026',
        sequenceId: 'seq-1',
        recordedById: TEACHER_ID,
        sequenceScore: 14,
        coefficient: 4,
        maxValue: 20,
        validationStatus: 'DRAFT',
        isAbsentGrade: false,
        isOfflineSync: false,
        createdAt: new Date(),
      });
      await noteRepo.save(noteAutreEcole);

      await expect(
        useCase.execute({ noteId: 'note-autre-ecole', demandeurId: TEACHER_ID, schoolId: SCHOOL_ID })
      ).rejects.toThrow('introuvable');

      const intacte = await noteRepo.findById('note-autre-ecole', 'school-2');
      expect(intacte?.validationStatus).toBe('DRAFT');
    });
  });
});
