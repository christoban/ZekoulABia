import { Note } from '@domain/entities/Note';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';

export interface DraftGradeInput {
  studentId: string;
  value: number;
  observation?: string;
}

export interface DraftEnMasseCommande {
  schoolId: string;
  userId: string;
  userRole: string;
  classId: string;
  subjectId: string;
  sequenceId: string;
  academicYearId: string;
  grades: DraftGradeInput[];
}

export interface DraftGradeResultat {
  studentId: string;
  noteId: string;
  action: 'created' | 'updated';
}

export interface DraftEnMasseResultat {
  results: DraftGradeResultat[];
}

export class DraftEnMasseUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly sessionRepository?: HarmonizedAssessmentSessionRepository,
  ) {}

  async execute(commande: DraftEnMasseCommande): Promise<DraftEnMasseResultat> {
    if (commande.userRole === 'TEACHER') {
      const estAssigne = await this.matiereRepository.estEnseignantAssigne(
        commande.userId,
        commande.subjectId,
      );
      if (!estAssigne) {
        throw new Error(
          `L'enseignant n'est pas assigné à cette matière`,
        );
      }
    }

    // Check for anonymized session that blocks nominative grading
    if (this.sessionRepository) {
      const sessions = await this.sessionRepository.findBySubjectClassAndYear(
        commande.schoolId,
        commande.subjectId,
        commande.classId,
        commande.academicYearId,
      );
      const blocked = sessions.some(
        (s) =>
          s.isAnonymized &&
          s.anonymatStatus !== 'RECONCILIE' &&
          s.academicSequenceId === commande.sequenceId,
      );
      if (blocked) {
        throw new Error(
          'Cette évaluation est anonymisée : la saisie nominative en masse est interdite. Utilisez la fiche de correction par codes.'
        );
      }
    }

    const matiere = await this.matiereRepository.findById(commande.subjectId);
    if (!matiere) throw new Error(`Matière introuvable : ${commande.subjectId}`);
    const coefficient = matiere.coefficient;

    const results: DraftGradeResultat[] = [];

    for (const grade of commande.grades) {
      const noteExistante = await this.noteRepository.findByEleveEtMatiere(
        grade.studentId,
        commande.subjectId,
        commande.sequenceId,
      );

      if (noteExistante) {
        if (!noteExistante.peutEtreModifiee()) {
          throw new Error(
            `La note de l'élève ${grade.studentId} ne peut pas être modifiée (statut : ${noteExistante.validationStatus})`,
          );
        }
        noteExistante.definirScore(grade.value);
        await this.noteRepository.update(noteExistante);
        results.push({
          studentId: grade.studentId,
          noteId: noteExistante.id,
          action: 'updated',
        });
      } else {
        const note = Note.create({
          schoolId: commande.schoolId,
          studentId: grade.studentId,
          subjectId: commande.subjectId,
          classId: commande.classId,
          academicYearId: commande.academicYearId,
          sequenceId: commande.sequenceId,
          recordedById: commande.userId,
          sequenceScore: grade.value,
          coefficient,
        });
        await this.noteRepository.save(note);
        results.push({
          studentId: grade.studentId,
          noteId: note.id,
          action: 'created',
        });
      }
    }

    return { results };
  }
}
