export interface SuiviRBACRepository {
  trouverProfileEleve(userId: string, schoolId: string): Promise<{
    id: string;
    classId: string | null;
  } | null>;

  verifierEnseignantClasse(teacherId: string, classId: string): Promise<boolean>;

  verifierProfPrincipal(classId: string, userId: string): Promise<boolean>;

  verifierDestinataireConseiller(userId: string, schoolId: string): Promise<boolean>;

  verifierCasEscalade(studentProfileId: string, userId: string): Promise<boolean>;

  verifierEnseignantMatiere(teacherId: string, classId: string, subjectId: string): Promise<boolean>;
}
