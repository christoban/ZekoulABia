/**
 * DOMAIN LAYER — Port Repository Department (département pédagogique + AP)
 * Regroupe le CRUD department + l'assignation de chef (AP) + le rattachement de matières.
 */
export interface DepartmentProps {
  id: string;
  schoolId: string;
  name: string;
  color: string;
  headId: string | null;
  subjects?: { id: string; name: string }[];
}

export interface DepartmentWithHead {
  id: string;
  name: string;
  color: string;
  headId: string | null;
  head?: { id: string; firstName: string; lastName: string } | null;
  subjects?: { id: string; name: string }[];
}

export interface DepartmentWithSubjects {
  id: string;
  schoolId: string;
  headId: string | null;
  name: string;
  subjects?: { id: string }[];
}

export interface DepartmentRepository {
  findById(id: string): Promise<DepartmentProps | null>;
  findByIdAndSchool(id: string, schoolId: string): Promise<DepartmentProps | null>;
  findBySchool(schoolId: string): Promise<DepartmentWithHead[]>;
  create(data: { schoolId: string; name: string; color?: string; headId?: string | null }): Promise<DepartmentProps>;
  updateWithHead(id: string, data: { name?: string; color?: string; headId?: string | null }): Promise<DepartmentWithHead>;
  delete(id: string): Promise<void>;

  // Performance — lectures pour DepartmentController.performance
  findAssignmentsForSubjectIds(schoolId: string, subjectIds: string[]): Promise<Array<{ teacherId: string; subjectId: string; classId: string; teacher: { firstName: string; lastName: string }; subject: { name: string }; class: { name: string } }>>;
  findGradesForSubjectIds(schoolId: string, subjectIds: string[]): Promise<Array<{ subjectId: string; classId: string; sequenceAverage: number | null }>>;

  // Assignation chef (AP) — logique d'affectation/désaffectation
  findByName(schoolId: string, name: string): Promise<DepartmentProps | null>;
  findHeadIdAndSubjects(id: string): Promise<{ id: string; headId: string | null; subjects: { id: string }[] } | null>;
  findDepartmentHeadingByHead(headId: string, excludeId?: string): Promise<DepartmentProps | null>;
  associerChef(departmentId: string, headId: string | null): Promise<void>;
  rattacherMatieres(departmentId: string, subjectIds: string[]): Promise<void>;
  detacherMatieres(departmentId: string): Promise<void>;
}
