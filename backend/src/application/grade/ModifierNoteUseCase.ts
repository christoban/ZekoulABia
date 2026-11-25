import { Note } from '@domain/entities/Note';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { SchoolSettingsRepository } from '@domain/ports/repositories/SchoolSettingsRepository';
import { calculerMoyenneSequence, type SequenceCalculationMode } from '@domain/rules/GradingEngine';

export interface ModifierNoteCommande {
  schoolId: string;
  userId: string;
  userRole: string;
  gradeId: string;

  sequenceScore?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;
  maxValue?: number;
  seq1Score?: number;
  seq2Score?: number;
  compositionScore?: number;
}

export interface ModifierNoteResultat {
  noteId: string;
  statut: string;
  message: string;
  sequenceAverage: number | null;
}

export class ModifierNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly schoolSettingsRepository: SchoolSettingsRepository,
  ) {}

  async execute(commande: ModifierNoteCommande): Promise<ModifierNoteResultat> {
    const note = await this.noteRepository.findById(commande.gradeId, commande.schoolId);
    if (!note) {
      throw new Error('Note introuvable');
    }

    if (!note.peutEtreModifiee()) {
      throw new Error(
        `Impossible de modifier une note en statut "${note.validationStatus}". ` +
        `Seules les notes DRAFT ou REJECTED peuvent être modifiées.`
      );
    }

    if (commande.userRole === 'TEACHER') {
      const estAssigne = await this.matiereRepository.estEnseignantAssigne(
        commande.userId,
        note.subjectId,
      );
      if (!estAssigne) {
        throw new Error('Vous n\'êtes pas assigné à cette matière');
      }
    }

    const settings = await this.schoolSettingsRepository.getParametresEffectifs(commande.schoolId);
    const sequenceCalculationMode: SequenceCalculationMode = settings.sequenceCalculationMode;

    const currentProps = note.toObject();

    const sequenceAverage = calculerMoyenneSequence(
      {
        sequenceScore: commande.sequenceScore ?? currentProps.sequenceScore,
        classTestScore: commande.classTestScore ?? currentProps.classTestScore,
        terminalExamScore: commande.terminalExamScore ?? currentProps.terminalExamScore,
        theoreticalScore: commande.theoreticalScore ?? currentProps.theoreticalScore,
        practicalScore: commande.practicalScore ?? currentProps.practicalScore,
        maxValue: commande.maxValue ?? currentProps.maxValue,
        seq1Score: commande.seq1Score,
        seq2Score: commande.seq2Score,
        compositionScore: commande.compositionScore,
      },
      sequenceCalculationMode,
    );

    const matiere = await this.matiereRepository.findById(note.subjectId);

    const updatedNote = Note.reconstituer({
      ...currentProps,
      sequenceScore: commande.sequenceScore ?? currentProps.sequenceScore,
      classTestScore: commande.classTestScore ?? currentProps.classTestScore,
      terminalExamScore: commande.terminalExamScore ?? currentProps.terminalExamScore,
      theoreticalScore: commande.theoreticalScore ?? currentProps.theoreticalScore,
      practicalScore: commande.practicalScore ?? currentProps.practicalScore,
      professionalAttitude: commande.professionalAttitude ?? currentProps.professionalAttitude,
      oralScore: commande.oralScore ?? currentProps.oralScore,
      selfDevelopmentScore: commande.selfDevelopmentScore ?? currentProps.selfDevelopmentScore,
      maxValue: commande.maxValue ?? currentProps.maxValue,
      coefficient: matiere?.coefficient ?? currentProps.coefficient,
      sequenceAverage,
    });

    updatedNote.definirMoyenne(sequenceAverage);

    await this.noteRepository.update(updatedNote);

    return {
      noteId: updatedNote.id,
      statut: updatedNote.validationStatus,
      message: 'Note modifiée avec succès',
      sequenceAverage,
    };
  }
}
