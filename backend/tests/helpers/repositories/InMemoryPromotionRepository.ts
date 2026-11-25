import type {
  PromotionRepository,
  ClassPromotionMapping,
  DecisionConseil,
  PromotionEleveParams,
} from '@domain/ports/repositories/PromotionRepository';

interface MappingStockee {
  mapping: ClassPromotionMapping;
  schoolId: string;
  academicYearId: string;
}

interface DecisionStockee {
  decision: DecisionConseil;
  schoolId: string;
  academicYearId: string;
}

interface OrientationStockee {
  schoolId: string;
  academicYearId: string;
  classId: string;
}

export class InMemoryPromotionRepository implements PromotionRepository {
  private mappings: MappingStockee[] = [];
  private decisions: DecisionStockee[] = [];
  promotionsEnregistrees: PromotionEleveParams[] = [];
  classesEleves = new Map<string, string>();
  classesCibleOrientation = new Map<string, OrientationStockee>();

  definirMappings(
    schoolId: string,
    academicYearId: string,
    m: ClassPromotionMapping[]
  ): void {
    this.mappings = m.map(mapping => ({ mapping, schoolId, academicYearId }));
  }

  definirDecisions(
    schoolId: string,
    academicYearId: string,
    d: DecisionConseil[]
  ): void {
    this.decisions = d.map(decision => ({ decision, schoolId, academicYearId }));
  }

  definirClasseCibleOrientation(
    studentId: string,
    schoolId: string,
    academicYearId: string,
    classId: string
  ): void {
    this.classesCibleOrientation.set(studentId, { schoolId, academicYearId, classId });
  }

  async findMappingsPromotion(schoolId: string, academicYearId: string) {
    return this.mappings
      .filter(e => e.schoolId === schoolId && e.academicYearId === academicYearId)
      .map(e => e.mapping);
  }

  async creerMappingsPromotion(
    mappings: (ClassPromotionMapping & { schoolId: string; academicYearId: string })[]
  ) {
    this.mappings.push(
      ...mappings.map(m => ({
        mapping: { fromClassId: m.fromClassId, toClassId: m.toClassId },
        schoolId: m.schoolId,
        academicYearId: m.academicYearId,
      }))
    );
  }

  async findDecisionsEleves(schoolId: string, academicYearId: string) {
    return this.decisions
      .filter(e => e.schoolId === schoolId && e.academicYearId === academicYearId)
      .map(e => e.decision);
  }

  async promouvoirEleve(params: PromotionEleveParams) {
    this.promotionsEnregistrees.push(params);
  }

  async mettreAJourClasseEleve(studentId: string, classId: string, _demandeurId: string) {
    this.classesEleves.set(studentId, classId);
  }

  async countPromotions(schoolId: string, academicYearId: string) {
    const filtered = this.promotionsEnregistrees.filter(
      p => p.schoolId === schoolId && p.academicYearId === academicYearId
    );
    const promus = filtered.filter(p => p.fromClassId !== p.toClassId).length;
    const redoublants = filtered.filter(p => p.fromClassId === p.toClassId).length;
    return { promus, redoublants };
  }

  async findClasseCibleOrientation(schoolId: string, studentId: string, academicYearId: string) {
    const orientation = this.classesCibleOrientation.get(studentId);
    if (
      !orientation ||
      orientation.schoolId !== schoolId ||
      orientation.academicYearId !== academicYearId
    ) {
      return null;
    }
    return orientation.classId;
  }
}
