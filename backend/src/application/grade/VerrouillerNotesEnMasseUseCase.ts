/**
 * APPLICATION LAYER — Use Case : Verrouiller en masse toutes les notes DRAFT
 * d'une classe/séquence pour l'enseignant appelant.
 * DRAFT → LOCKED pour chaque note DRAFT de l'enseignant dans la classe/séquence.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { MetricCachePort } from '@domain/ports/cache/MetricCachePort';

export interface VerrouillerNotesEnMasseCommande {
  classId: string;
  sequenceId: string;
  demandeurId: string;
  /** École de l'utilisateur, issue du token. */
  schoolId: string;
}

export interface VerrouillerNotesEnMasseResultat {
  notesVerrouillees: number;
  notesIgnorees: number;
  message: string;
  gradesVerrouilles: Array<{ id: string; studentId: string; subjectId: string; schoolId: string; sequenceId: string }>;
}

export class VerrouillerNotesEnMasseUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly metricCache?: MetricCachePort,
  ) {}

  async execute(commande: VerrouillerNotesEnMasseCommande): Promise<VerrouillerNotesEnMasseResultat> {
    // 1. Récupérer toutes les notes DRAFT de la classe/séquence
    const notesADraft = await this.noteRepository.findByStatut(
      commande.classId,
      commande.sequenceId,
      'DRAFT',
    );

    if (notesADraft.length === 0) {
      return {
        notesVerrouillees: 0,
        notesIgnorees: 0,
        message: 'Aucune note DRAFT à verrouiller pour cette classe',
        gradesVerrouilles: [],
      };
    }

    // 2. Filtrer celles où l'enseignant est assigné à la matière
    const notesAVerrouiller: typeof notesADraft = [];
    for (const note of notesADraft) {
      const estAssigne = await this.matiereRepository.estEnseignantAssigne(
        commande.demandeurId,
        note.subjectId,
      );
      if (estAssigne) {
        notesAVerrouiller.push(note);
      }
    }

    if (notesAVerrouiller.length === 0) {
      return {
        notesVerrouillees: 0,
        notesIgnorees: notesADraft.length,
        message: 'Aucune note DRAFT assignée à cet enseignant pour cette classe/séquence',
        gradesVerrouilles: [],
      };
    }

    // 3. Verrouiller chaque note
    let verrouillees = 0;
    const gradesVerrouilles: VerrouillerNotesEnMasseResultat['gradesVerrouilles'] = [];
    for (const note of notesAVerrouiller) {
      note.verrouiller();
      await this.noteRepository.update(note);
      verrouillees++;
      gradesVerrouilles.push({
        id: note.id, studentId: note.studentId, subjectId: note.subjectId,
        schoolId: note.schoolId, sequenceId: note.sequenceId,
      });
    }

    // 3bis. Invalidation MetricCache v1 — moyenne_generale
    if (this.metricCache && verrouillees > 0) {
      await this.metricCache.invalidate('moyenne_generale', { schoolId: commande.schoolId, classId: commande.classId });
    }

    return {
      notesVerrouillees: verrouillees,
      notesIgnorees: notesADraft.length - verrouillees,
      message: `${verrouillees} note(s) verrouillée(s) avec succès`,
      gradesVerrouilles,
    };
  }
}
