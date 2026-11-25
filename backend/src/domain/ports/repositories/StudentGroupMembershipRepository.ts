/**
 * DOMAIN LAYER — Port Repository StudentGroupMembership
 * Jamais Student → Group direct — toujours via cette table. Un élève a au plus un Group par
 * GroupSet par année (contrainte imposée en base, voir schema.prisma).
 */
export interface MembreCompteParGroupe {
  groupId: string;
  count: number;
}

export interface StudentGroupMembershipRepository {
  /** Appartenance actuelle d'un élève dans un GroupSet donné pour une année (au plus 1). */
  findByStudentAndGroupSet(
    studentProfileId: string,
    groupSetId: string,
    academicYearId: string
  ): Promise<{ groupId: string } | null>;

  /** Élèves membres d'un Group donné pour une année — résolution de participants. */
  findStudentIdsByGroup(groupId: string, academicYearId: string): Promise<string[]>;

  /**
   * Effectifs de chaque Group d'un GroupSet, restreints aux élèves d'une classe donnée —
   * utilisé par la règle de split de salle (le Group le plus nombreux garde la salle habituelle).
   */
  countMembersByGroupForClass(
    groupSetId: string,
    classId: string,
    academicYearId: string
  ): Promise<MembreCompteParGroupe[]>;

  /**
   * Upsert respectant l'exclusivité : remplace toute appartenance existante de l'élève dans ce
   * GroupSet pour cette année (jamais un ajout en plus d'une appartenance existante).
   */
  upsert(
    studentProfileId: string,
    groupId: string,
    groupSetId: string,
    academicYearId: string
  ): Promise<void>;

  /** Retire l'appartenance à ce GroupSet pour cette année (ex. lv2SubjectId remis à null). */
  remove(studentProfileId: string, groupSetId: string, academicYearId: string): Promise<void>;
}
