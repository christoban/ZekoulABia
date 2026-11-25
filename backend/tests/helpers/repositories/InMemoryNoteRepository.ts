import { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteNonValideeInfo, NoteFilters, PaginatedResult } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';

export class InMemoryNoteRepository implements NoteRepository {
  private store = new Map<string, Note>();
  private nonValidees: NoteNonValideeInfo[] = [];
  private nonValideesSet = false;
  private sequencePeriods = new Map<string, string>();

  ajouter(note: Note): void {
    this.store.set(note.id, note);
  }

  setNonValidees(notes: NoteNonValideeInfo[]): void {
    this.nonValidees = notes;
    this.nonValideesSet = true;
  }

  setSequenceAcademicPeriod(sequenceId: string, academicPeriodId: string): void {
    this.sequencePeriods.set(sequenceId, academicPeriodId);
  }

  async findById(id: string, schoolId: string): Promise<Note | null> {
    const note = this.store.get(id);
    return note && note.schoolId === schoolId ? note : null;
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().studentId === studentId && n.toObject().academicYearId === academicYearId
    );
  }

  async findByClasse(classId: string, sequenceId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().classId === classId && n.toObject().sequenceId === sequenceId
    );
  }

  async findByEnseignant(teacherId: string, sequenceId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().recordedById === teacherId && n.toObject().sequenceId === sequenceId
    );
  }

  async findByEleveEtMatiere(
    studentId: string,
    subjectId: string,
    sequenceId: string
  ): Promise<Note | null> {
    return (
      [...this.store.values()].find(
        n =>
          n.toObject().studentId === studentId &&
          n.toObject().subjectId === subjectId &&
          n.toObject().sequenceId === sequenceId
      ) ?? null
    );
  }

  async find(filters: NoteFilters, page: number, limit: number): Promise<PaginatedResult<Note>> {
    let items = [...this.store.values()].filter(n => n.schoolId === filters.schoolId);
    if (filters.classId) items = items.filter(n => n.toObject().classId === filters.classId);
    if (filters.subjectId) items = items.filter(n => n.toObject().subjectId === filters.subjectId);
    if (filters.subjectIds) items = items.filter(n => filters.subjectIds!.includes(n.toObject().subjectId));
    if (filters.sequenceId) items = items.filter(n => n.toObject().sequenceId === filters.sequenceId);
    if (filters.studentId) items = items.filter(n => n.toObject().studentId === filters.studentId);
    if (filters.studentIds) items = items.filter(n => filters.studentIds!.includes(n.toObject().studentId));
    if (filters.validationStatus) items = items.filter(n => n.validationStatus === filters.validationStatus);

    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return { items: paged, total, page, pages: Math.ceil(total / limit), limit };
  }

  async findByStatut(
    classId: string,
    sequenceId: string,
    statut: GradeValidationStatus
  ): Promise<Note[]> {
    return [...this.store.values()].filter(
      n =>
        n.toObject().classId === classId &&
        n.toObject().sequenceId === sequenceId &&
        n.validationStatus === statut
    );
  }

  async findByStatuts(
    classId: string,
    sequenceId: string,
    statuts: GradeValidationStatus[]
  ): Promise<Note[]> {
    return [...this.store.values()].filter(
      n =>
        n.toObject().classId === classId &&
        n.toObject().sequenceId === sequenceId &&
        statuts.includes(n.validationStatus)
    );
  }

  async findClassmatesAverages(
    classId: string,
    sequenceId: string,
    _schoolId: string
  ): Promise<{ studentId: string; average: number }[]> {
    const notes = [...this.store.values()].filter(
      n =>
        n.toObject().classId === classId &&
        n.toObject().sequenceId === sequenceId &&
        n.validationStatus === 'LOCKED'
    );

    const byStudent = new Map<string, number[]>();
    for (const n of notes) {
      const avg = n.sequenceAverage ?? 0;
      const existing = byStudent.get(n.studentId) ?? [];
      existing.push(avg);
      byStudent.set(n.studentId, existing);
    }

    return [...byStudent.entries()]
      .map(([studentId, avgs]) => ({
        studentId,
        average: avgs.reduce((s, a) => s + a, 0) / avgs.length,
      }))
      .sort((a, b) => b.average - a.average);
  }

  async findNotesNonValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<NoteNonValideeInfo[]> {
    if (this.nonValideesSet) {
      return this.nonValidees;
    }

    return [...this.store.values()]
      .filter(
        note =>
          note.toObject().classId === classId &&
          this.sequencePeriods.get(note.toObject().sequenceId) === academicPeriodId &&
          (note.validationStatus === 'DRAFT')
      )
      .map(note => ({
        matiereNom: note.toObject().subjectId,
        enseignantNom: note.toObject().recordedById ?? '',
        statut: note.validationStatus,
      }));
  }

  async toutesNotesValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<boolean> {
    if (this.nonValideesSet) {
      return this.nonValidees.length === 0;
    }

    const nonValidees = await this.findNotesNonValideesParClasse(classId, academicPeriodId);
    return nonValidees.length === 0;
  }

  async save(note: Note): Promise<void> {
    this.store.set(note.id, note);
  }

  async update(note: Note): Promise<void> {
    this.store.set(note.id, note);
  }

  async updateStatut(
    noteId: string,
    statut: GradeValidationStatus,
    validateurId?: string,
    _motif?: string
  ): Promise<void> {
    const note = this.store.get(noteId);
    if (!note) return;

    const props = note.toObject();
    this.store.set(
      noteId,
      Note.reconstituer({
        ...props,
        validationStatus: statut,
        validatedById: validateurId,
      })
    );
  }

  async findNotesEnAttenteDepuis(heures: number): Promise<Note[]> {
    const depuis = new Date(Date.now() - heures * 60 * 60 * 1000);

    return [...this.store.values()].filter(
      note =>
        note.validationStatus === 'DRAFT' && note.toObject().createdAt <= depuis
    );
  }

  async verrouillerNotesValidees(
    studentId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<void> {
    for (const note of this.store.values()) {
      const data = note.toObject();
      if (
        data.studentId === studentId &&
        data.classId === classId &&
        this.sequencePeriods.get(data.sequenceId) === academicPeriodId &&
        data.validationStatus === 'DRAFT'
      ) {
        note.verrouiller();
      }
    }
  }

  async findValideesParClasseEtEleves(schoolId: string, classId: string, studentIds: string[]): Promise<Array<{ studentId: string; sequenceAverage: number | null; coefficient: number; isAbsentGrade: boolean }>> {
    if (studentIds.length === 0) return [];
    return [...this.store.values()]
      .filter(n => {
        const d = n.toObject();
        return d.schoolId === schoolId && d.classId === classId && studentIds.includes(d.studentId) && n.validationStatus === 'LOCKED';
      })
      .map(n => ({ studentId: n.toObject().studentId, sequenceAverage: n.sequenceAverage ?? null, coefficient: n.toObject().coefficient ?? 1, isAbsentGrade: n.toObject().isAbsentGrade ?? false }));
  }

  async findForBulletin(params: { schoolId: string; studentId: string; academicYearId: string; classId: string; sequenceIds: string[] }): Promise<Note[]> {
    return [...this.store.values()].filter(n => {
      const d = n.toObject();
      return d.schoolId === params.schoolId && d.studentId === params.studentId && d.academicYearId === params.academicYearId && d.classId === params.classId && params.sequenceIds.includes(d.sequenceId);
    });
  }

  async groupMoyennesPourPeriode(params: { schoolId: string; classId: string; academicYearId: string; sequenceIds: string[] }): Promise<Array<{ studentId: string; average: number }>> {
    const notes = [...this.store.values()].filter(n => {
      const d = n.toObject();
      return d.schoolId === params.schoolId && d.classId === params.classId && d.academicYearId === params.academicYearId && params.sequenceIds.includes(d.sequenceId) && n.validationStatus === 'LOCKED';
    });
    const byStudent = new Map<string, number[]>();
    for (const n of notes) {
      const avg = n.sequenceAverage ?? 0;
      const arr = byStudent.get(n.studentId) ?? [];
      arr.push(avg);
      byStudent.set(n.studentId, arr);
    }
    return [...byStudent.entries()].map(([studentId, avgs]) => ({ studentId, average: avgs.reduce((s, a) => s + a, 0) / avgs.length })).sort((a, b) => b.average - a.average);
  }

  async getStatsValidationParClasse(classId: string, schoolId: string, sequenceIds: string[]): Promise<{ total: number; DRAFT: number; LOCKED: number }> {
    const filtered = [...this.store.values()].filter(n => {
      const d = n.toObject();
      if (d.schoolId !== schoolId || d.classId !== classId) return false;
      if (sequenceIds.length > 0 && !sequenceIds.includes(d.sequenceId)) return false;
      return true;
    });
    const stats: { total: number; DRAFT: number; LOCKED: number } = { total: filtered.length, DRAFT: 0, LOCKED: 0 };
    for (const n of filtered) {
      if (n.validationStatus === 'DRAFT') stats.DRAFT++;
      else if (n.validationStatus === 'LOCKED') stats.LOCKED++;
    }
    return stats;
  }

  compter(): number {
    return this.store.size;
  }
}
