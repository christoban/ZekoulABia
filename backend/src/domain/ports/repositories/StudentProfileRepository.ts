/**
 * DOMAIN LAYER — Port Repository StudentProfile (lecture document scolaire)
 */
export interface StudentBulletinOptions {
  studentId: string;
  lv2SubjectId: string | null;
  alevelSubjectIds: string[];
}

/**
 * Données brutes nécessaires à la génération des documents scolaires (certificat, carte,
 * lettre de transfert) — relation user + classe courante + premier contact parent.
 */
export interface StudentDocumentProfile {
  id: string;
  userId: string;
  matricule: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  photoUrl: string | null;
  studentStatus: string;
  user: { firstName: string; lastName: string; phone: string | null };
  enrollmentsYearScoped: Array<{ class: { name: string; section: { code: string } | null } | null }>;
  parents: Array<{ parentProfile: { user: { firstName: string; lastName: string; phone: string | null } } }>;
}

export interface StudentProfileRepository {
  findBulletinOptionsByStudentIds(
    studentIds: string[],
  ): Promise<StudentBulletinOptions[]>;
  findForDocument(userId: string, schoolId: string): Promise<StudentDocumentProfile | null>;
  findByIdAndSchool(profileId: string, schoolId: string): Promise<{ id: string; userId: string } | null>;
}
