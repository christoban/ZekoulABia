import type { PrismaClient, Prisma, TypeFraisMinesec as PrismaTypeFraisMinesec } from '@prisma/client';
import type { TypeFraisMinesec } from '@domain/types/enums';
import type {
  MasterReferentielsRepository,
  MasterReferentielsSummaryCounts,
  OfficialCalendarRecord,
  BacCoefficientRecord,
  TemplateSubjectLoadRecord,
  OfficialProgressionRecord,
  TarifMinesecRecord,
} from '@domain/ports/repositories/MasterReferentielsRepository';

export class PrismaMasterReferentielsRepository implements MasterReferentielsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getSummaryCounts(): Promise<MasterReferentielsSummaryCounts> {
    const [
      calendarCount,
      calendars,
      bacCoefficientsCount,
      cycleCoefficientsCount,
      anglophoneLoadsCount,
      progressionsCount,
      tarifsCount,
      templatesCount,
    ] = await Promise.all([
      this.prisma.officialAcademicCalendar.count(),
      this.prisma.officialAcademicCalendar.findMany({ select: { academicYear: true, active: true } }),
      this.prisma.bacCoefficient.count(),
      this.prisma.cycleCoefficient.count(),
      this.prisma.anglophoneSubjectLoad.count(),
      this.prisma.officialProgrammeProgression.count(),
      this.prisma.tarifMinesecReference.count(),
      this.prisma.schoolTemplate.count(),
    ]);

    return {
      calendarCount,
      calendars,
      bacCoefficientsCount,
      cycleCoefficientsCount,
      anglophoneLoadsCount,
      progressionsCount,
      tarifsCount,
      templatesCount,
    };
  }

  async listCalendars(): Promise<OfficialCalendarRecord[]> {
    return this.prisma.officialAcademicCalendar.findMany({
      orderBy: [{ academicYear: 'desc' }, { establishmentType: 'asc' }],
    });
  }

  async findCalendarById(id: string): Promise<OfficialCalendarRecord | null> {
    return this.prisma.officialAcademicCalendar.findUnique({ where: { id } });
  }

  async saveCalendar(input: {
    id?: string;
    academicYear: string;
    establishmentType: string;
    arreteReference?: string | null;
    dateRentreeOfficielle: Date;
    dateClotureOfficielle: Date;
    trimestres: unknown;
    periodesVacances: unknown;
    active: boolean;
  }): Promise<OfficialCalendarRecord> {
    const trimestresJson = input.trimestres as Prisma.InputJsonValue;
    const vacancesJson = input.periodesVacances as Prisma.InputJsonValue;

    if (input.id) {
      return this.prisma.officialAcademicCalendar.update({
        where: { id: input.id },
        data: {
          academicYear: input.academicYear,
          establishmentType: input.establishmentType,
          arreteReference: input.arreteReference,
          dateRentreeOfficielle: input.dateRentreeOfficielle,
          dateClotureOfficielle: input.dateClotureOfficielle,
          trimestres: trimestresJson,
          periodesVacances: vacancesJson,
          active: input.active,
        },
      });
    }
    return this.prisma.officialAcademicCalendar.upsert({
      where: {
        academicYear_establishmentType: {
          academicYear: input.academicYear,
          establishmentType: input.establishmentType,
        },
      },
      update: {
        arreteReference: input.arreteReference,
        dateRentreeOfficielle: input.dateRentreeOfficielle,
        dateClotureOfficielle: input.dateClotureOfficielle,
        trimestres: trimestresJson,
        periodesVacances: vacancesJson,
        active: input.active,
      },
      create: {
        academicYear: input.academicYear,
        establishmentType: input.establishmentType,
        arreteReference: input.arreteReference,
        dateRentreeOfficielle: input.dateRentreeOfficielle,
        dateClotureOfficielle: input.dateClotureOfficielle,
        trimestres: trimestresJson,
        periodesVacances: vacancesJson,
        active: input.active,
      },
    });
  }

  async updateCalendarActive(id: string, active: boolean): Promise<OfficialCalendarRecord> {
    return this.prisma.officialAcademicCalendar.update({ where: { id }, data: { active } });
  }

  async listBacCoefficients(filter: {
    serie?: string;
    niveau?: string;
    templateCode?: string;
    search?: string;
  }): Promise<BacCoefficientRecord[]> {
    const where: Prisma.BacCoefficientWhereInput = {};
    if (filter.serie) where.serie = filter.serie;
    if (filter.niveau) where.niveau = filter.niveau;
    if (filter.templateCode) where.templateCode = filter.templateCode;
    if (filter.search) where.subjectName = { contains: filter.search, mode: 'insensitive' };
    return this.prisma.bacCoefficient.findMany({
      where,
      orderBy: [{ serie: 'asc' }, { niveau: 'asc' }, { groupe: 'asc' }, { subjectName: 'asc' }],
      take: 300,
    });
  }

  async findBacCoefficientById(id: string): Promise<BacCoefficientRecord | null> {
    return this.prisma.bacCoefficient.findUnique({ where: { id } });
  }

  async saveBacCoefficient(input: {
    id?: string;
    subjectName: string;
    serie: string;
    niveau: string;
    coefficient: number;
    groupe: number;
    templateCode: string;
    source: string;
    isOfficialMinesec: boolean;
  }): Promise<BacCoefficientRecord> {
    if (input.id) {
      return this.prisma.bacCoefficient.update({
        where: { id: input.id },
        data: {
          subjectName: input.subjectName,
          serie: input.serie,
          niveau: input.niveau,
          coefficient: input.coefficient,
          groupe: input.groupe,
          templateCode: input.templateCode,
          source: input.source,
          isOfficialMinesec: input.isOfficialMinesec,
        },
      });
    }
    return this.prisma.bacCoefficient.upsert({
      where: {
        subjectName_serie_niveau_templateCode: {
          subjectName: input.subjectName,
          serie: input.serie,
          niveau: input.niveau,
          templateCode: input.templateCode,
        },
      },
      update: {
        coefficient: input.coefficient,
        groupe: input.groupe,
        source: input.source,
        isOfficialMinesec: input.isOfficialMinesec,
      },
      create: {
        subjectName: input.subjectName,
        serie: input.serie,
        niveau: input.niveau,
        coefficient: input.coefficient,
        groupe: input.groupe,
        templateCode: input.templateCode,
        source: input.source,
        isOfficialMinesec: input.isOfficialMinesec,
      },
    });
  }

  async deleteBacCoefficient(id: string): Promise<void> {
    await this.prisma.bacCoefficient.delete({ where: { id } });
  }

  async listAnglophoneSubjectLoads(filter: {
    templateCode?: string;
    classLevel?: string;
    filiere?: string;
    search?: string;
  }): Promise<TemplateSubjectLoadRecord[]> {
    const where: Prisma.AnglophoneSubjectLoadWhereInput = {};
    if (filter.templateCode) where.templateCode = filter.templateCode;
    if (filter.classLevel) where.classLevel = filter.classLevel;
    if (filter.filiere) where.filiere = filter.filiere;
    if (filter.search) where.subjectName = { contains: filter.search, mode: 'insensitive' };
    return this.prisma.anglophoneSubjectLoad.findMany({
      where,
      orderBy: [{ templateCode: 'asc' }, { classLevel: 'asc' }, { subjectName: 'asc' }],
      take: 300,
    });
  }

  async listCycleCoefficients(filter: {
    templateCode?: string;
    classLevel?: string;
    filiere?: string;
    search?: string;
  }): Promise<TemplateSubjectLoadRecord[]> {
    const where: Prisma.CycleCoefficientWhereInput = {};
    if (filter.templateCode) where.templateCode = filter.templateCode;
    if (filter.classLevel) where.classLevel = filter.classLevel;
    if (filter.filiere) where.filiere = filter.filiere;
    if (filter.search) where.subjectName = { contains: filter.search, mode: 'insensitive' };
    return this.prisma.cycleCoefficient.findMany({
      where,
      orderBy: [{ templateCode: 'asc' }, { classLevel: 'asc' }, { subjectName: 'asc' }],
      take: 300,
    });
  }

  async findAnglophoneSubjectLoadById(id: string): Promise<TemplateSubjectLoadRecord | null> {
    return this.prisma.anglophoneSubjectLoad.findUnique({ where: { id } });
  }

  async findCycleCoefficientById(id: string): Promise<TemplateSubjectLoadRecord | null> {
    return this.prisma.cycleCoefficient.findUnique({ where: { id } });
  }

  async saveAnglophoneSubjectLoad(input: {
    id?: string;
    templateCode: string;
    classLevel: string;
    subjectName: string;
    coefficient: number;
    weeklyPeriods: number | null;
    filiere: string;
  }): Promise<TemplateSubjectLoadRecord> {
    if (input.id) {
      return this.prisma.anglophoneSubjectLoad.update({
        where: { id: input.id },
        data: {
          templateCode: input.templateCode,
          classLevel: input.classLevel,
          subjectName: input.subjectName,
          coefficient: Math.round(input.coefficient),
          weeklyPeriods: input.weeklyPeriods,
          filiere: input.filiere,
        },
      });
    }
    return this.prisma.anglophoneSubjectLoad.upsert({
      where: {
        templateCode_classLevel_subjectName_filiere: {
          templateCode: input.templateCode,
          classLevel: input.classLevel,
          subjectName: input.subjectName,
          filiere: input.filiere,
        },
      },
      update: { coefficient: Math.round(input.coefficient), weeklyPeriods: input.weeklyPeriods },
      create: {
        templateCode: input.templateCode,
        classLevel: input.classLevel,
        subjectName: input.subjectName,
        coefficient: Math.round(input.coefficient),
        weeklyPeriods: input.weeklyPeriods,
        filiere: input.filiere,
      },
    });
  }

  async saveCycleCoefficient(input: {
    id?: string;
    templateCode: string;
    classLevel: string;
    subjectName: string;
    coefficient: number;
    weeklyPeriods: number | null;
    filiere: string;
  }): Promise<TemplateSubjectLoadRecord> {
    if (input.id) {
      return this.prisma.cycleCoefficient.update({
        where: { id: input.id },
        data: {
          templateCode: input.templateCode,
          classLevel: input.classLevel,
          subjectName: input.subjectName,
          coefficient: input.coefficient,
          weeklyPeriods: input.weeklyPeriods,
          filiere: input.filiere,
        },
      });
    }
    return this.prisma.cycleCoefficient.upsert({
      where: {
        templateCode_classLevel_subjectName_filiere: {
          templateCode: input.templateCode,
          classLevel: input.classLevel,
          subjectName: input.subjectName,
          filiere: input.filiere,
        },
      },
      update: { coefficient: input.coefficient, weeklyPeriods: input.weeklyPeriods },
      create: {
        templateCode: input.templateCode,
        classLevel: input.classLevel,
        subjectName: input.subjectName,
        coefficient: input.coefficient,
        weeklyPeriods: input.weeklyPeriods,
        filiere: input.filiere,
      },
    });
  }

  async deleteAnglophoneSubjectLoad(id: string): Promise<void> {
    await this.prisma.anglophoneSubjectLoad.delete({ where: { id } });
  }

  async deleteCycleCoefficient(id: string): Promise<void> {
    await this.prisma.cycleCoefficient.delete({ where: { id } });
  }

  async listProgressions(filter: {
    templateCode?: string;
    level?: string;
    search?: string;
  }): Promise<OfficialProgressionRecord[]> {
    const where: Prisma.OfficialProgrammeProgressionWhereInput = {};
    if (filter.templateCode) where.templateCode = filter.templateCode;
    if (filter.level) where.level = filter.level;
    if (filter.search) {
      where.OR = [
        { subjectName: { contains: filter.search, mode: 'insensitive' } },
        { titre: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.officialProgrammeProgression.findMany({
      where,
      orderBy: [{ templateCode: 'asc' }, { level: 'asc' }, { subjectName: 'asc' }],
      take: 200,
    });
  }

  async findProgressionById(id: string): Promise<OfficialProgressionRecord | null> {
    return this.prisma.officialProgrammeProgression.findUnique({ where: { id } });
  }

  async saveProgression(input: {
    id?: string;
    templateCode: string;
    level: string;
    filiere: string | null;
    subjectName: string;
    titre: string;
    chapitres: unknown;
    active: boolean;
  }): Promise<OfficialProgressionRecord> {
    const chapitresJson = input.chapitres as Prisma.InputJsonValue;
    if (input.id) {
      return this.prisma.officialProgrammeProgression.update({
        where: { id: input.id },
        data: {
          templateCode: input.templateCode,
          level: input.level,
          filiere: input.filiere,
          subjectName: input.subjectName,
          titre: input.titre,
          chapitres: chapitresJson,
          active: input.active,
        },
      });
    }
    return this.prisma.officialProgrammeProgression.upsert({
      where: {
        templateCode_level_subjectName: {
          templateCode: input.templateCode,
          level: input.level,
          subjectName: input.subjectName,
        },
      },
      update: { filiere: input.filiere, titre: input.titre, chapitres: chapitresJson, active: input.active },
      create: {
        templateCode: input.templateCode,
        level: input.level,
        filiere: input.filiere,
        subjectName: input.subjectName,
        titre: input.titre,
        chapitres: chapitresJson,
        active: input.active,
      },
    });
  }

  async deleteProgression(id: string): Promise<void> {
    await this.prisma.officialProgrammeProgression.delete({ where: { id } });
  }

  async listTarifsMinesec(filter: {
    anneeScolaire?: string;
    typeFrais?: TypeFraisMinesec;
  }): Promise<TarifMinesecRecord[]> {
    const where: Prisma.TarifMinesecReferenceWhereInput = {};
    if (filter.anneeScolaire) where.anneeScolaire = filter.anneeScolaire;
    if (filter.typeFrais) where.typeFrais = filter.typeFrais as unknown as PrismaTypeFraisMinesec;
    const rows = await this.prisma.tarifMinesecReference.findMany({
      where,
      orderBy: [{ anneeScolaire: 'desc' }, { typeFrais: 'asc' }],
    });
    return rows as unknown as TarifMinesecRecord[];
  }

  async findTarifMinesecById(id: string): Promise<TarifMinesecRecord | null> {
    const row = await this.prisma.tarifMinesecReference.findUnique({ where: { id } });
    return row as unknown as TarifMinesecRecord | null;
  }

  async saveTarifMinesec(input: {
    id?: string;
    typeFrais: TypeFraisMinesec;
    anneeScolaire: string;
    niveau: string | null;
    montantFCFA: number;
    description: string | null;
    actif: boolean;
  }): Promise<TarifMinesecRecord> {
    const typePrisma = input.typeFrais as unknown as PrismaTypeFraisMinesec;
    if (input.id) {
      const updated = await this.prisma.tarifMinesecReference.update({
        where: { id: input.id },
        data: {
          typeFrais: typePrisma,
          anneeScolaire: input.anneeScolaire,
          niveau: input.niveau,
          montantFCFA: input.montantFCFA,
          description: input.description,
          actif: input.actif,
        },
      });
      return updated as unknown as TarifMinesecRecord;
    }

    const existing = await this.prisma.tarifMinesecReference.findFirst({
      where: { typeFrais: typePrisma, anneeScolaire: input.anneeScolaire, niveau: input.niveau },
    });
    if (existing) {
      const updated = await this.prisma.tarifMinesecReference.update({
        where: { id: existing.id },
        data: { montantFCFA: input.montantFCFA, description: input.description, actif: input.actif },
      });
      return updated as unknown as TarifMinesecRecord;
    }

    const created = await this.prisma.tarifMinesecReference.create({
      data: {
        typeFrais: typePrisma,
        anneeScolaire: input.anneeScolaire,
        niveau: input.niveau,
        montantFCFA: input.montantFCFA,
        description: input.description,
        actif: input.actif,
      },
    });
    return created as unknown as TarifMinesecRecord;
  }

  async updateTarifActive(id: string, actif: boolean): Promise<TarifMinesecRecord> {
    const updated = await this.prisma.tarifMinesecReference.update({ where: { id }, data: { actif } });
    return updated as unknown as TarifMinesecRecord;
  }
}

