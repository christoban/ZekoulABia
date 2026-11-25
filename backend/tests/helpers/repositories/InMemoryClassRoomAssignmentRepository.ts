import type {
  ClassRoomAssignmentRepository,
  ClassRoomAssignmentProps,
} from '@domain/ports/repositories/ClassRoomAssignmentRepository';

export class InMemoryClassRoomAssignmentRepository implements ClassRoomAssignmentRepository {
  private store = new Map<string, ClassRoomAssignmentProps>();
  private cle = (classId: string, academicYearId: string) => `${classId}:${academicYearId}`;

  ajouter(props: ClassRoomAssignmentProps): void {
    this.store.set(this.cle(props.classId, props.academicYearId), props);
  }

  async findByClasseAndAnnee(classId: string, academicYearId: string): Promise<ClassRoomAssignmentProps | null> {
    return this.store.get(this.cle(classId, academicYearId)) ?? null;
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<ClassRoomAssignmentProps[]> {
    return [...this.store.values()].filter(a => a.schoolId === schoolId && a.academicYearId === academicYearId);
  }

  async upsert(props: ClassRoomAssignmentProps): Promise<void> {
    this.store.set(this.cle(props.classId, props.academicYearId), props);
  }

  async delete(classId: string, academicYearId: string): Promise<void> {
    this.store.delete(this.cle(classId, academicYearId));
  }
}
