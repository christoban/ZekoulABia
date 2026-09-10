/**
 * APPLICATION LAYER — Use Case : Saisir une note
 * Un enseignant saisit une note pour un élève. Statut initial : DRAFT.
 * Vérifie que l'enseignant est bien assigné à la matière ET à la classe.
 */
import { Note } from '@domain/entities/Note';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { AssessmentParticipationRepository } from '@domain/ports/repositories/AssessmentParticipationRepository';
import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';

export interface SaisirNoteCommande {
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  sequenceId: string;
  recordedById: string; // enseignant qui saisit

  // Scores — selon le type d'établissement
  sequenceScore?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;

  coefficient?: number;
  maxValue?: number;
  harmonizedAssessmentSessionId?: string;
}

export interface SaisirNoteResultat {
  noteId: string;
  statut: string;
  message: string;
}

export class SaisirNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly userRepository: UserRepository,
    private readonly rattachementRepository: RattachementEnseignantRepository,
    private readonly participationRepository?: AssessmentParticipationRepository,
    private readonly sessionRepository?: HarmonizedAssessmentSessionRepository,
  ) {}

  async execute(commande: SaisirNoteCommande): Promise<SaisirNoteResultat> {
    // 1. Vérifier que l'enseignant existe et est actif
    const enseignant = await this.userRepository.findById(commande.recordedById);
    if (!enseignant || !enseignant.isActive) {
      throw new Error('Enseignant introuvable ou inactif');
    }

    // 2. Vérifier que l'enseignant est assigné à cette matière
    const estAssigne = await this.matiereRepository.estEnseignantAssigne(
      commande.recordedById,
      commande.subjectId
    );
    if (!estAssigne && !enseignant.estAdmin()) {
      throw new Error(
        `L'enseignant "${enseignant.nomComplet}" n'est pas assigné à cette matière`
      );
    }

    // 2bis. estEnseignantAssigne ci-dessus ne porte que sur la matière (TeacherSubject),
    // jamais sur la classe — un enseignant assigné à cette matière dans UNE classe pourrait
    // sinon saisir des notes pour n'importe QUELLE AUTRE classe de l'école sur cette même
    // matière. Vérifie donc en plus l'assignation classe+matière réelle (TeachingAssignment).
    // Pas de bypass "professeur principal" ici : une note est toujours liée à UNE matière
    // précise, être PP de la classe ne rend pas légitime d'y noter une matière non enseignée.
    if (!enseignant.estAdmin()) {
      const rattache = await this.rattachementRepository.estRattacheALaClasse(
        commande.recordedById, commande.classId, commande.subjectId,
        { autoriserProfesseurPrincipal: false },
      );
      if (!rattache) {
        throw new Error(
          `L'enseignant "${enseignant.nomComplet}" n'est pas assigné à l'enseignement de cette matière pour cette classe`
        );
      }
    }

    // 3. Vérifier qu'une note n'existe pas déjà pour cet élève/matière/séquence
    const noteExistante = await this.noteRepository.findByEleveEtMatiere(
      commande.studentId,
      commande.subjectId,
      commande.sequenceId
    );
    if (noteExistante) {
      throw new Error(
        'Une note existe déjà pour cet élève sur cette matière et cette séquence. ' +
        'Utilisez la modification à la place.'
      );
    }

    // 4. Croisement Grade/Attendance : si un harmonizedAssessmentSessionId est fourni,
    // vérifier le statut de participation de l'élève. Si ABSENT (non justifié), marquer
    // la note comme isAbsentGrade pour qu'elle soit exclue du calcul de moyenne.
    let isAbsentGrade = false;
    let harmonizedAssessmentSessionId: string | undefined;
    if (commande.harmonizedAssessmentSessionId && this.participationRepository) {
      harmonizedAssessmentSessionId = commande.harmonizedAssessmentSessionId;
      const participation = await this.participationRepository.findBySessionAndStudent(
        commande.schoolId,
        commande.harmonizedAssessmentSessionId,
        commande.studentId,
      );
      if (participation && participation.status === 'ABSENT') {
        isAbsentGrade = true;
      }
    }

    // 4bis. Bloquer la saisie nominative si la session est anonymisée et non réconciliée
    if (commande.harmonizedAssessmentSessionId && this.sessionRepository) {
      const session = await this.sessionRepository.findById(commande.harmonizedAssessmentSessionId, commande.schoolId);
      if (session?.isAnonymized && session.anonymatStatus !== 'RECONCILIE') {
        throw new Error(
          'Cette évaluation est anonymisée : la saisie nominative est interdite. Utilisez la fiche de correction par codes.'
        );
      }
    }

    // 5. Coefficient : reflète la valeur en vigueur au moment de la saisie — ne sera plus jamais
    // recalculé une fois la note LOCKED (Loi 6, verrouillage total). Un override
    // explicite (ex. saisi via l'assistant IA) reste prioritaire sur celui de la matière.
    const matiere = await this.matiereRepository.findById(commande.subjectId);
    const coefficient = commande.coefficient ?? matiere?.coefficient ?? 1;

    // 6. Créer la note (la validation des bornes est dans l'entité)
    const note = Note.create({
      schoolId: commande.schoolId,
      studentId: commande.studentId,
      subjectId: commande.subjectId,
      classId: commande.classId,
      academicYearId: commande.academicYearId,
      sequenceId: commande.sequenceId,
      recordedById: commande.recordedById,
      sequenceScore: commande.sequenceScore,
      classTestScore: commande.classTestScore,
      terminalExamScore: commande.terminalExamScore,
      theoreticalScore: commande.theoreticalScore,
      practicalScore: commande.practicalScore,
      professionalAttitude: commande.professionalAttitude,
      oralScore: commande.oralScore,
      selfDevelopmentScore: commande.selfDevelopmentScore,
      coefficient,
      maxValue: commande.maxValue,
      harmonizedAssessmentSessionId,
      isAbsentGrade,
    });

    // 7. Sauvegarder
    await this.noteRepository.save(note);

    return {
      noteId: note.id,
      statut: note.validationStatus,
      message: 'Note saisie avec succès — statut : DRAFT',
    };
  }
}