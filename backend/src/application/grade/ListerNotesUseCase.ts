import type { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteFilters, PaginatedResult } from '@domain/ports/repositories/NoteRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { UserRole, StaffPermissionType, GradeValidationStatus } from '@domain/types/enums';

export interface ListerNotesRequete {
  schoolId: string;
  userId: string;
  userRole: UserRole;
  userPermissions?: StaffPermissionType[];
  filters: {
    classId?: string;
    subjectId?: string;
    sequenceId?: string;
    studentId?: string;
    validationStatus?: GradeValidationStatus;
    since?: Date;
  };
  pagination: { page: number; limit: number };
}

export class ListerNotesUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly userRepository: UserRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly parentRepository: ParentRepository,
  ) {}

  async execute(requete: ListerNotesRequete): Promise<PaginatedResult<Note>> {
    const { schoolId, userId, userRole, filters, pagination } = requete;

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('Utilisateur introuvable');

    const noteFilters: NoteFilters = { schoolId, ...filters };

    if (userRole === 'STUDENT') {
      noteFilters.studentId = userId;
      noteFilters.validationStatus = 'LOCKED';
    } else if (userRole === 'TEACHER') {
      const matieres = await this.matiereRepository.findByEnseignant(userId);
      const subjectIds = matieres.map(m => m.id);
      if (subjectIds.length === 0) {
        return { items: [], total: 0, page: pagination.page, pages: 0, limit: pagination.limit };
      }
      if (filters.subjectId) {
        if (!subjectIds.includes(filters.subjectId)) {
          return { items: [], total: 0, page: pagination.page, pages: 0, limit: pagination.limit };
        }
      } else {
        noteFilters.subjectIds = subjectIds;
      }
    } else if (userRole === 'PARENT') {
      const childIds = await this.parentRepository.findStudentIdsByParent(userId);
      if (childIds.length === 0) {
        return { items: [], total: 0, page: pagination.page, pages: 0, limit: pagination.limit };
      }
      if (filters.studentId) {
        if (!childIds.includes(filters.studentId)) {
          return { items: [], total: 0, page: pagination.page, pages: 0, limit: pagination.limit };
        }
        noteFilters.studentId = filters.studentId;
      } else {
        noteFilters.studentIds = childIds;
      }
      noteFilters.validationStatus = 'LOCKED';
    }

    return this.noteRepository.find(noteFilters, pagination.page, pagination.limit);
  }
}
