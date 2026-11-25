import type {
  StudentGroupMembershipRepository,
  MembreCompteParGroupe,
} from '@domain/ports/repositories/StudentGroupMembershipRepository';

interface Membership {
  studentProfileId: string;
  groupId: string;
  groupSetId: string;
  academicYearId: string;
}

export class InMemoryStudentGroupMembershipRepository implements StudentGroupMembershipRepository {
  private memberships: Membership[] = [];
  private classeParEleve = new Map<string, string>();

  ajouterMembre(
    studentProfileId: string,
    groupId: string,
    groupSetId: string,
    academicYearId: string,
    classId: string
  ): void {
    this.memberships.push({ studentProfileId, groupId, groupSetId, academicYearId });
    this.classeParEleve.set(studentProfileId, classId);
  }

  definirClasseEleve(studentProfileId: string, classId: string): void {
    this.classeParEleve.set(studentProfileId, classId);
  }

  async findByStudentAndGroupSet(
    studentProfileId: string,
    groupSetId: string,
    academicYearId: string
  ) {
    const m = this.memberships.find(
      x =>
        x.studentProfileId === studentProfileId &&
        x.groupSetId === groupSetId &&
        x.academicYearId === academicYearId
    );
    return m ? { groupId: m.groupId } : null;
  }

  async findStudentIdsByGroup(groupId: string, academicYearId: string): Promise<string[]> {
    return this.memberships
      .filter(m => m.groupId === groupId && m.academicYearId === academicYearId)
      .map(m => m.studentProfileId);
  }

  async countMembersByGroupForClass(
    groupSetId: string,
    classId: string,
    academicYearId: string
  ): Promise<MembreCompteParGroupe[]> {
    const compte = new Map<string, number>();
    for (const m of this.memberships) {
      if (m.groupSetId !== groupSetId || m.academicYearId !== academicYearId) continue;
      if (this.classeParEleve.get(m.studentProfileId) !== classId) continue;
      compte.set(m.groupId, (compte.get(m.groupId) ?? 0) + 1);
    }
    return [...compte.entries()].map(([groupId, count]) => ({ groupId, count }));
  }

  async upsert(
    studentProfileId: string,
    groupId: string,
    groupSetId: string,
    academicYearId: string
  ): Promise<void> {
    const existant = this.memberships.find(
      m =>
        m.studentProfileId === studentProfileId &&
        m.groupSetId === groupSetId &&
        m.academicYearId === academicYearId
    );
    if (existant) {
      existant.groupId = groupId;
    } else {
      this.memberships.push({ studentProfileId, groupId, groupSetId, academicYearId });
    }
  }

  async remove(
    studentProfileId: string,
    groupSetId: string,
    academicYearId: string
  ): Promise<void> {
    this.memberships = this.memberships.filter(
      m =>
        !(
          m.studentProfileId === studentProfileId &&
          m.groupSetId === groupSetId &&
          m.academicYearId === academicYearId
        )
    );
  }
}
