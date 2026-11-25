/**
 * DOMAIN LAYER — Port Repository ClassRoomAssignment
 * Salle habituelle d'une classe pour l'année — valeur par défaut simple et fixe, pas recalculée
 * à chaque génération d'emploi du temps. Pattern props-only.
 */
export interface ClassRoomAssignmentProps {
  id: string;
  schoolId: string;
  classId: string;
  roomId: string;
  academicYearId: string;
}

export interface ClassRoomAssignmentRepository {
  findByClasseAndAnnee(classId: string, academicYearId: string): Promise<ClassRoomAssignmentProps | null>;
  findBySchool(schoolId: string, academicYearId: string): Promise<ClassRoomAssignmentProps[]>;

  /** Upsert : une seule salle habituelle par classe par année (remplace l'existante si présente). */
  upsert(props: ClassRoomAssignmentProps): Promise<void>;

  delete(classId: string, academicYearId: string): Promise<void>;
}
