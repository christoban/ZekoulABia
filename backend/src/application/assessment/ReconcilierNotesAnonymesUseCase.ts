import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import type { AnonymatRepository } from '@domain/ports/repositories/AnonymatRepository';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { AssessmentScopeRepository } from '@domain/ports/repositories/AssessmentScopeRepository';
import { Note } from '@domain/entities/Note';
import { AssessmentScope } from '@domain/entities/AssessmentScope';
import { canManageAnonymat } from '@domain/rules/AnonymatRules';
import {
  ForbiddenAnonymatError,
  SessionNotFoundError,
  SequenceRequiredError,
  ReconcileForbiddenError,
} from '@domain/errors/AnonymatErrors';

export interface ReconcilierNotesAnonymesCommande {
  schoolId: string;
  sessionId: string;
  actorUserId: string;
  actorRole: string;
  actorStaffPermissions?: readonly string[];
  forceLock?: boolean;
}

export class ReconcilierNotesAnonymesUseCase {
  constructor(
    private readonly sessionRepo: HarmonizedAssessmentSessionRepository,
    private readonly anonymatRepo: AnonymatRepository,
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly assessmentScopeRepo: AssessmentScopeRepository,
  ) {}

  async execute(cmd: ReconcilierNotesAnonymesCommande): Promise<{ reconciled: number; skippedIllegible: number; locked: boolean }> {
    if (!canManageAnonymat({ role: cmd.actorRole, staffPermissions: cmd.actorStaffPermissions })) {
      throw new ForbiddenAnonymatError();
    }

    const session = await this.sessionRepo.findById(cmd.sessionId, cmd.schoolId);
    if (!session) throw new SessionNotFoundError();
    if (!session.isAnonymized) throw new ForbiddenAnonymatError();
    if (!session.academicSequenceId) throw new SequenceRequiredError();

    const notesAnonymes = await this.anonymatRepo.findNotesAnonymesBySession(cmd.sessionId);
    const submittedNotes = notesAnonymes.filter((n) => n.status === 'SUBMITTED');

    const codesWithUserIds = await this.anonymatRepo.findCodesWithUserIds(cmd.sessionId);
    const codeToUserMap = new Map(codesWithUserIds.map((c) => [c.code, c]));

    const scope = await this.assessmentScopeRepo.findById(session.assessmentScopeId, cmd.schoolId);
    if (!scope) throw new ReconcileForbiddenError();

    const shouldLock =
      cmd.forceLock ??
      (scope.sequenceType === 'COMPOSITION' || scope.sequenceType === 'TERMINAL_EXAM');
    
    let reconciled = 0;
    let skippedIllegible = 0;

    for (const note of submittedNotes) {
      const user = codeToUserMap.get(note.code);
      if (!user) {
        skippedIllegible++;
        continue;
      }

      if (note.isIllegible) {
        skippedIllegible++;
        continue;
      }

      if (!user) {
        skippedIllegible++;
        continue;
      }

      if (note.isAbsent) {
        const existing = await this.noteRepository.findByEleveEtMatiere(
          user.userId,
          session.subjectId,
          session.academicSequenceId,
        );

        const matiere = await this.matiereRepository.findById(session.subjectId);
        const sequence = await this.anneeRepository.findSequenceById(session.academicSequenceId, cmd.schoolId);
        const periode = sequence ? await this.anneeRepository.findPeriodeById(sequence.academicPeriodId, cmd.schoolId) : null;
        const academicYearId = periode?.academicYearId ?? '';

        if (existing) {
          existing.definirScore(0);
          if (shouldLock) { existing.verrouiller(); }
          await this.noteRepository.update(existing);
        } else {
          const noteEntity = Note.create({
            schoolId: cmd.schoolId,
            studentId: user.userId,
            subjectId: session.subjectId,
            classId: user.classId,
            academicYearId,
            sequenceId: session.academicSequenceId,
            recordedById: cmd.actorUserId,
            sequenceScore: 0,
            harmonizedAssessmentSessionId: cmd.sessionId,
            isAbsentGrade: true,
            coefficient: matiere?.coefficient ?? 1,
            maxValue: note.maxValue,
          });
          if (shouldLock) { noteEntity.verrouiller(); }
          await this.noteRepository.save(noteEntity);
        }
        reconciled++;
      } else if (note.score !== null && note.score !== undefined) {
        const existing = await this.noteRepository.findByEleveEtMatiere(
          user.userId,
          session.subjectId,
          session.academicSequenceId,
        );

        const matiere = await this.matiereRepository.findById(session.subjectId);
        const sequence = await this.anneeRepository.findSequenceById(session.academicSequenceId, cmd.schoolId);
        const periode = sequence ? await this.anneeRepository.findPeriodeById(sequence.academicPeriodId, cmd.schoolId) : null;
        const academicYearId = periode?.academicYearId ?? '';

        if (existing) {
          existing.definirScore(note.score);
          if (shouldLock) { existing.verrouiller(); }
          await this.noteRepository.update(existing);
        } else {
          const noteEntity = Note.create({
            schoolId: cmd.schoolId,
            studentId: user.userId,
            subjectId: session.subjectId,
            classId: user.classId,
            academicYearId,
            sequenceId: session.academicSequenceId,
            recordedById: cmd.actorUserId,
            sequenceScore: note.score,
            harmonizedAssessmentSessionId: cmd.sessionId,
            isAbsentGrade: false,
            coefficient: matiere?.coefficient ?? 1,
            maxValue: note.maxValue,
          });
          if (shouldLock) { noteEntity.verrouiller(); }
          await this.noteRepository.save(noteEntity);
        }
      }

      reconciled++;
    }

    session.marquerReconcilie(cmd.actorUserId);
    await this.sessionRepo.update(session);

    return { reconciled, skippedIllegible, locked: shouldLock };
  }
}
