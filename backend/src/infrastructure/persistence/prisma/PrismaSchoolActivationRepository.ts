import type { PrismaClient, Prisma, PeriodType, SequenceType, SubjectType, FeeType, BulletinTemplate } from '@prisma/client';
import type {
  SchoolActivationRepository,
  SchoolActivationData,
  SchoolActivationTx,
  SubjectRecord,
} from '@domain/ports/repositories/SchoolActivationRepository';
import type { SubjectAssignmentRepository } from '@domain/ports/repositories/SubjectAssignmentRepository';
import { PrismaSubjectAssignmentRepository } from './PrismaSubjectAssignmentRepository';

type Tx = Prisma.TransactionClient;

class PrismaSchoolActivationTx implements SchoolActivationTx {
  private readonly subjectAssignmentRepo: SubjectAssignmentRepository;

  constructor(private readonly tx: Tx, private readonly schoolId: string) {
    this.subjectAssignmentRepo = new PrismaSubjectAssignmentRepository(tx);
  }

  subjectAssignment(): SubjectAssignmentRepository {
    return this.subjectAssignmentRepo;
  }

  async creerAnnee(data: { name: string; startDate: Date; endDate: Date }): Promise<{ id: string }> {
    const created = await this.tx.academicYear.create({
      data: { schoolId: this.schoolId, name: data.name, startDate: data.startDate, endDate: data.endDate, isCurrent: true, status: 'ACTIVE' },
    });
    return { id: created.id };
  }

  async creerPeriode(data: { academicYearId: string; name: string; type: string; orderIndex: number; startDate: Date; endDate: Date; isCurrent: boolean }): Promise<{ id: string }> {
    const created = await this.tx.academicPeriod.create({
      data: {
        academicYearId: data.academicYearId,
        name: data.name,
        type: data.type as PeriodType,
        orderIndex: data.orderIndex,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent,
      },
    });
    return { id: created.id };
  }

  async creerSequence(data: { academicPeriodId: string; name: string; type: string; orderIndex: number; isCurrent: boolean }): Promise<void> {
    await this.tx.academicSequence.create({
      data: {
        academicPeriodId: data.academicPeriodId,
        schoolId: this.schoolId,
        name: data.name,
        type: data.type as SequenceType,
        orderIndex: data.orderIndex,
        startDate: null,
        endDate: null,
        isCurrent: data.isCurrent,
      },
    });
  }

  async findBacCombos(): Promise<{ serie: string; niveau: string }[]> {
    return this.tx.bacCoefficient.findMany({
      select: { serie: true, niveau: true },
      distinct: ['serie', 'niveau'],
    });
  }

  async findSchoolTemplate(code: string): Promise<{ config: unknown } | null> {
    const tpl = await this.tx.schoolTemplate.findUnique({ where: { code } });
    return tpl ? { config: tpl.config } : null;
  }

  async findAnglophoneStreamCombinations(filieres: string[]): Promise<{ filiere: string; coreSubjects: unknown; electiveGroup: unknown }[]> {
    return this.tx.anglophoneStreamCombination.findMany({ where: { filiere: { in: filieres } } });
  }

  async findAnglophoneSubjectLoads(templateCode: string, classLevel: string, filiere: string): Promise<{ subjectName: string; coefficient: number; weeklyPeriods: number | null }[]> {
    return this.tx.anglophoneSubjectLoad.findMany({
      where: { templateCode, classLevel, filiere },
      select: { subjectName: true, coefficient: true, weeklyPeriods: true },
    });
  }

  async creerClasse(data: { name: string; level: string; academicYearId: string; serie: string | null; filiere: string | null; pebsMixte: boolean }): Promise<void> {
    await this.tx.class.create({
      data: {
        name: data.name,
        level: data.level,
        schoolId: this.schoolId,
        academicYearId: data.academicYearId,
        serie: data.serie,
        filiere: data.filiere,
        pebsMixte: data.pebsMixte,
      },
    });
  }

  async findClasses(levels?: string[]): Promise<{ id: string; name: string; level: string; serie: string | null }[]> {
    return this.tx.class.findMany({
      where: { schoolId: this.schoolId, ...(levels ? { level: { in: levels } } : {}) },
      select: { id: true, name: true, level: true, serie: true },
    });
  }

  async creerMatiere(data: { name: string; code: string; coefficient: number; hoursPerWeek: number; subjectType?: string; departmentId?: string | null; isLV2?: boolean }): Promise<{ id: string }> {
    const created = await this.tx.subject.create({
      data: {
        schoolId: this.schoolId,
        name: data.name,
        code: data.code,
        coefficient: data.coefficient,
        hoursPerWeek: data.hoursPerWeek,
        subjectType: (data.subjectType ?? 'THEORETICAL') as SubjectType,
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
        ...(data.isLV2 !== undefined ? { isLV2: data.isLV2 } : {}),
      },
    });
    return { id: created.id };
  }

  async findMatieres(options?: { excludeIds?: string[]; onlyLV2?: boolean }): Promise<SubjectRecord[]> {
    const matieres = await this.tx.subject.findMany({
      where: {
        schoolId: this.schoolId,
        ...(options?.excludeIds?.length ? { id: { notIn: options.excludeIds } } : {}),
        ...(options?.onlyLV2 ? { isLV2: true } : {}),
      },
    });
    return matieres.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      coefficient: m.coefficient,
      hoursPerWeek: m.hoursPerWeek,
      isLV2: m.isLV2,
    }));
  }

  async findMatiereParNom(name: string, isLV2?: boolean): Promise<SubjectRecord | null> {
    const m = await this.tx.subject.findFirst({
      where: { schoolId: this.schoolId, name, ...(isLV2 !== undefined ? { isLV2 } : {}) },
    });
    if (!m) return null;
    return { id: m.id, name: m.name, code: m.code, coefficient: m.coefficient, hoursPerWeek: m.hoursPerWeek, isLV2: m.isLV2 };
  }

  async mettreAJourMatiere(id: string, data: { departmentId?: string | null; isLV2?: boolean }): Promise<void> {
    await this.tx.subject.update({ where: { id }, data });
  }

  async supprimerMatiere(id: string): Promise<void> {
    await this.tx.subject.delete({ where: { id } });
  }

  async findCoefficient(subjectId: string, classLevel: string, serieCode: string | null): Promise<{ id: string } | null> {
    return this.tx.subjectCoefficient.findFirst({
      where: { schoolId: this.schoolId, subjectId, classLevel, serieCode },
      select: { id: true },
    });
  }

  async creerCoefficient(data: { subjectId: string; classLevel: string; serieCode: string | null; coefficient: number }): Promise<void> {
    await this.tx.subjectCoefficient.create({
      data: { schoolId: this.schoolId, subjectId: data.subjectId, classLevel: data.classLevel, serieCode: data.serieCode, coefficient: data.coefficient },
    });
  }

  async findSubjectsCoefficient(classLevel: string, serieCode: string): Promise<{ subjectId: string }[]> {
    return this.tx.subjectCoefficient.findMany({
      where: { schoolId: this.schoolId, classLevel, serieCode },
      select: { subjectId: true },
    });
  }

  async findCoefficientsMatiere(subjectId: string, classLevels: string[]): Promise<{ classLevel: string; serieCode: string | null; coefficient: number }[]> {
    return this.tx.subjectCoefficient.findMany({
      where: { schoolId: this.schoolId, subjectId, classLevel: { in: classLevels } },
      select: { classLevel: true, serieCode: true, coefficient: true },
    });
  }

  async supprimerCoefficientsMatiere(subjectId: string, classLevels: string[]): Promise<void> {
    await this.tx.subjectCoefficient.deleteMany({
      where: { schoolId: this.schoolId, subjectId, classLevel: { in: classLevels } },
    });
  }

  async compterCoefficientsMatiere(subjectId: string): Promise<number> {
    return this.tx.subjectCoefficient.count({ where: { schoolId: this.schoolId, subjectId } });
  }

  async creerDepartement(data: { name: string; color: string }): Promise<{ id: string }> {
    const created = await this.tx.department.create({ data: { schoolId: this.schoolId, name: data.name, color: data.color } });
    return { id: created.id };
  }

  async findDepartementParNom(names: string[]): Promise<{ id: string } | null> {
    const dept = await this.tx.department.findFirst({
      where: { schoolId: this.schoolId, name: { in: names } },
      select: { id: true },
    });
    return dept ? { id: dept.id } : null;
  }

  async findClassSubjectOverride(classId: string, subjectId: string): Promise<{ id: string } | null> {
    const o = await this.tx.classSubjectOverride.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      select: { id: true },
    });
    return o ? { id: o.id } : null;
  }

  async creerClassSubjectOverride(data: { classId: string; subjectId: string; coefficient: number }): Promise<void> {
    await this.tx.classSubjectOverride.create({
      data: { schoolId: this.schoolId, classId: data.classId, subjectId: data.subjectId, coefficient: data.coefficient },
    });
  }

  async findGradeFormula(id: string): Promise<{ label: string; evaluations: unknown } | null> {
    const formula = await this.tx.gradeFormula.findUnique({ where: { id } });
    return formula ? { label: formula.label, evaluations: formula.evaluations } : null;
  }

  async creerGradeFormula(data: { label: string; evaluations: unknown }): Promise<void> {
    await this.tx.gradeFormula.create({
      data: { schoolId: this.schoolId, label: data.label, evaluations: data.evaluations as Prisma.InputJsonValue, isDefault: true },
    });
  }

  async findMentionRule(id: string): Promise<{ rules: unknown } | null> {
    const rule = await this.tx.mentionRule.findUnique({ where: { id } });
    return rule ? { rules: rule.rules } : null;
  }

  async creerMentionRule(data: { rules: unknown }): Promise<void> {
    await this.tx.mentionRule.create({
      data: { schoolId: this.schoolId, rules: data.rules as Prisma.InputJsonValue, isDefault: true },
    });
  }

  async creerSchoolConfig(data: {
    passMark: number; councilPassMark: number; termsPerYear: number; maxAbsences: number;
    gradesPerTerm: number; attendanceLateAsAbsence: boolean; schoolLanguageMode: string; bulletinTemplate: string;
  }): Promise<void> {
    await this.tx.schoolConfig.create({
      data: {
        schoolId: this.schoolId,
        passMark: data.passMark,
        councilPassMark: data.councilPassMark,
        termsPerYear: data.termsPerYear,
        maxAbsences: data.maxAbsences,
        gradesPerTerm: data.gradesPerTerm,
        attendanceLateAsAbsence: data.attendanceLateAsAbsence,
        schoolLanguageMode: data.schoolLanguageMode,
        bulletinTemplate: data.bulletinTemplate as BulletinTemplate,
      },
    });
  }

  async creerSchoolSettings(data: { timezone: string; locale: string; currency: string }): Promise<void> {
    await this.tx.schoolSettings.create({
      data: { schoolId: this.schoolId, timezone: data.timezone, locale: data.locale, currency: data.currency },
    });
  }

  async findFeePlan(feeType: string): Promise<{ id: string } | null> {
    const plan = await this.tx.feePlan.findFirst({
      where: { schoolId: this.schoolId, feeType: feeType as FeeType },
      select: { id: true },
    });
    return plan ? { id: plan.id } : null;
  }

  async creerFeePlan(data: { name: string; amount: number; feeType: string; isRefundable: boolean; description: string }): Promise<void> {
    await this.tx.feePlan.create({
      data: {
        schoolId: this.schoolId,
        name: data.name,
        amount: data.amount,
        feeType: data.feeType as FeeType,
        isRefundable: data.isRefundable,
        description: data.description,
      },
    });
  }

  async mettreAJourEcole(data: { status: string; hasPEBSFrancophone: boolean; hasPEBSAnglophone: boolean; features?: unknown }): Promise<void> {
    await this.tx.school.update({
      where: { id: this.schoolId },
      data: {
        status: data.status as Prisma.SchoolUpdateInput['status'],
        hasPEBSFrancophone: data.hasPEBSFrancophone,
        hasPEBSAnglophone: data.hasPEBSAnglophone,
        ...(data.features !== undefined ? { features: data.features as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async marquerFormulaireComplet(): Promise<void> {
    await this.tx.schoolConfigurationForm.update({
      where: { schoolId: this.schoolId },
      data: { completedAt: new Date() },
    });
  }
}

export class PrismaSchoolActivationRepository implements SchoolActivationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSchoolForActivation(schoolId: string): Promise<SchoolActivationData | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { template: true, configurationForm: true },
    });
    if (!school) return null;
    return {
      id: school.id,
      name: school.name,
      status: school.status,
      onboardingConfig: school.onboardingConfig,
      templateCode: school.templateCode,
      template: school.template ? { config: school.template.config } : null,
      configurationForm: school.configurationForm ? { schoolId: school.configurationForm.schoolId } : null,
      features: school.features,
    };
  }

  async mettreAJourOnboardingConfig(schoolId: string, data: { onboardingConfig: unknown; templateCode?: string }): Promise<void> {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        onboardingConfig: data.onboardingConfig as Prisma.InputJsonValue,
        ...(data.templateCode ? { templateCode: data.templateCode } : {}),
      },
    });
  }

  async activerEtablissement<T>(schoolId: string, operation: (tx: SchoolActivationTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (prismaTx) => {
      return operation(new PrismaSchoolActivationTx(prismaTx, schoolId));
    });
  }
}
