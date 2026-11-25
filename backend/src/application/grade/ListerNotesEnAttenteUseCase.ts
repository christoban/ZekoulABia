import type { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteFilters } from '@domain/ports/repositories/NoteRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ListerNotesEnAttenteRequete {
  schoolId: string;
  userRole: string;
  userPermissions: string[];
  filters: {
    classId?: string;
    subjectId?: string;
    sequenceId?: string;
  };
}

export interface NotesEnAttenteResultat {
  grades: Note[];
  grouped: Record<string, Record<string, Note[]>>;
  total: number;
}

export class ListerNotesEnAttenteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(requete: ListerNotesEnAttenteRequete): Promise<NotesEnAttenteResultat> {
    const { schoolId, userRole, userPermissions, filters } = requete;

    if (userRole !== 'ADMIN' && !userPermissions.includes('VALIDATE_GRADES')) {
      throw new Error('Permission VALIDATE_GRADES requise');
    }

    const noteFilters: NoteFilters = {
      schoolId,
      validationStatus: 'DRAFT',
      ...filters,
    };

    const result = await this.noteRepository.find(noteFilters, 1, 10000);

    const grouped: Record<string, Record<string, Note[]>> = {};
    for (const grade of result.items) {
      const data = grade.toObject();
      if (!grouped[data.classId]) grouped[data.classId] = {};
      if (!grouped[data.classId][data.subjectId]) grouped[data.classId][data.subjectId] = [];
      grouped[data.classId][data.subjectId].push(grade);
    }

    return { grades: result.items, grouped, total: result.total };
  }
}
