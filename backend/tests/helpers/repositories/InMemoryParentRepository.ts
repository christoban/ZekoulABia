import type { ParentRepository, EnfantAvecStats } from '@domain/ports/repositories/ParentRepository';

interface EnfantContexte {
  studentId: string;
  schoolId: string;
}

export class InMemoryParentRepository implements ParentRepository {
  private relations = new Map<string, EnfantContexte[]>();
  private statsEleves = new Map<string, EnfantAvecStats>();

  definirRelation(parentId: string, studentIds: string[], schoolId: string): void {
    this.relations.set(
      parentId,
      studentIds.map(studentId => ({ studentId, schoolId }))
    );
  }

  definirStats(studentId: string, stats: EnfantAvecStats): void {
    this.statsEleves.set(studentId, stats);
  }

  async verifierRelationEnfant(parentUserId: string, studentId: string): Promise<void> {
    const enfants = this.relations.get(parentUserId);
    if (!enfants?.some(e => e.studentId === studentId)) {
      throw new Error('Accès non autorisé : cet élève ne fait pas partie de vos enfants');
    }
  }

  async aAccesEleve(parentUserId: string, studentId: string): Promise<boolean> {
    return this.relations.get(parentUserId)?.some(e => e.studentId === studentId) ?? false;
  }

  async findEnfantsAvecStats(parentUserId: string, schoolId: string): Promise<EnfantAvecStats[]> {
    const enfants = this.relations.get(parentUserId) ?? [];

    return enfants
      .filter(enfant => enfant.schoolId === schoolId)
      .map(enfant => this.statsEleves.get(enfant.studentId))
      .filter((stats): stats is EnfantAvecStats => stats !== undefined);
  }

  async findStudentIdsByParent(parentUserId: string): Promise<string[]> {
    return this.relations.get(parentUserId)?.map(e => e.studentId) ?? [];
  }
}
