import type { ProgrammeRepository, ProgrammeChapitreProps } from '@domain/ports/repositories/ProgrammeRepository';
import type { CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';

export interface ProgressionAvecProgramme {
  programme: { id: string; titre: string } | null;
  chapitresTotal: number;
  chapitresRealises: number;
  totalHeuresPrevu: number;
  heuresRealisees: number;
  progressionPct: number | null;
  attenduPct: number | null;
  retardPct: number | null;
  chapitres: { id: string; ordre: number; titre: string; volumeHeuresPrevu: number; sequenceCibleFin: number | null; realise: boolean }[];
  entries: { chapitreId: string | null; date: Date }[];
}

export interface CalculerProgressionInput {
  schoolId: string;
  classId: string;
  subjectId: string;
  academicYearId?: string;
}

export interface AlerteRetardProgramme {
  programmeId: string;
  programmeTitre: string;
  subjectName: string;
  className: string;
  classId: string;
  chapitresTotal: number;
  chapitresRealises: number;
  progressionPct: number;
  attenduPct: number;
  retardPct: number;
  niveau: 'CRITIQUE' | 'MODERE';
}

export class CalculerProgressionProgrammeUseCase {
  constructor(
    private readonly programmeRepository: ProgrammeRepository,
    private readonly cahierDeTexteRepository: CahierDeTexteRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
  ) {}

  async calculerProgression(input: CalculerProgressionInput): Promise<ProgressionAvecProgramme> {
    const anneeId = input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id;
    if (!anneeId) {
      return this.vide();
    }

    const classe = await this.classeRepository.findById(input.classId);
    if (!classe || classe.schoolId !== input.schoolId) {
      throw new Error('Classe introuvable');
    }

    const programme = await this.programmeRepository.findByClassSubject(
      input.schoolId,
      input.subjectId,
      anneeId,
      input.classId,
      classe.level ?? null,
    );

    if (!programme) {
      return { ...this.vide(), entries: [] };
    }

    const chapitres = programme.chapitres ?? [];
    const entries = await this.cahierDeTexteRepository.findByFilters(input.schoolId, {
      classId: input.classId,
      subjectId: input.subjectId,
      academicYearId: anneeId,
      orderDate: 'asc',
    });

    const chapitresAbordees = new Set<string>(entries.map(e => e.chapitreId).filter((x): x is string => x !== null));
    const chapitresTotal = chapitres.length;
    const chapitresRealises = chapitres.filter(c => chapitresAbordees.has(c.id)).length;
    const totalHeuresPrevu = chapitres.reduce((s, c) => s + c.volumeHeuresPrevu, 0);
    const heuresRealisees = chapitres
      .filter(c => chapitresAbordees.has(c.id))
      .reduce((s, c) => s + c.volumeHeuresPrevu, 0);
    const progressionPct = chapitresTotal > 0 ? Math.round((chapitresRealises / chapitresTotal) * 100) : null;

    const annee = await this.anneeRepository.findById(anneeId);
    const attenduPct = this.datePourcentage(annee?.startDate, annee?.endDate);

    return {
      programme: { id: programme.id, titre: programme.titre },
      chapitresTotal,
      chapitresRealises,
      totalHeuresPrevu,
      heuresRealisees,
      progressionPct,
      attenduPct,
      retardPct: attenduPct !== null && progressionPct !== null ? attenduPct - progressionPct : null,
      chapitres: chapitres.map(c => ({
        id: c.id,
        ordre: c.ordre,
        titre: c.titre,
        volumeHeuresPrevu: c.volumeHeuresPrevu,
        sequenceCibleFin: c.sequenceCibleFin,
        realise: chapitresAbordees.has(c.id),
      })),
      entries: entries.map(e => ({ chapitreId: e.chapitreId, date: e.date })),
    };
  }

  async calculerAlertesRetardProgramme(
    schoolId: string,
    academicYearId?: string,
    seuilPct = 15,
  ): Promise<AlerteRetardProgramme[]> {
    const anneeId = academicYearId ?? (await this.anneeRepository.findCourante(schoolId))?.id;
    if (!anneeId) return [];

    const annee = await this.anneeRepository.findById(anneeId);
    const attenduPct = this.datePourcentage(annee?.startDate, annee?.endDate);

    const programmes = await this.programmeRepository.findByFilters(schoolId, { academicYearId: anneeId });

    const alertes: AlerteRetardProgramme[] = [];

    for (const prog of programmes) {
      const chapitres = prog.chapitres ?? [];
      const chapitresTotal = chapitres.length;
      if (chapitresTotal === 0) continue;

      const classIds = prog.classId
        ? [prog.classId]
        : (prog.level
          ? await this.classeRepository.findByLevel(schoolId, prog.level)
          : await this.classeRepository.findBySchool(schoolId)
        ).map(c => c.id);

      for (const cid of classIds) {
        const entries = await this.cahierDeTexteRepository.findByFilters(schoolId, {
          classId: cid,
          subjectId: prog.subjectId,
          academicYearId: anneeId,
        });

        const chapitresAbordees = new Set(entries.map(e => e.chapitreId).filter((x): x is string => x !== null));
        const chapitresRealises = chapitres.filter(c => chapitresAbordees.has(c.id)).length;
        const progressionPct = Math.round((chapitresRealises / chapitresTotal) * 100);
        const retardPct = attenduPct - progressionPct;

        if (retardPct > seuilPct) {
          const classe = prog.class ?? await this.classeRepository.findById(cid);
          alertes.push({
            programmeId: prog.id,
            programmeTitre: prog.titre,
            subjectName: prog.subject?.name ?? '',
            className: classe?.name ?? cid,
            classId: cid,
            chapitresTotal,
            chapitresRealises,
            progressionPct,
            attenduPct,
            retardPct,
            niveau: retardPct > 30 ? 'CRITIQUE' : 'MODERE',
          });
        }
      }
    }

    alertes.sort((a, b) => b.retardPct - a.retardPct);
    return alertes;
  }

  async verifierProgrammeMatiere(
    schoolId: string,
    subjectId: string,
    classId?: string,
    academicYearId?: string,
  ): Promise<{ hasProgramme: boolean; chapitres: ProgrammeChapitreProps[] }> {
    const anneeId = academicYearId ?? (await this.anneeRepository.findCourante(schoolId))?.id;
    let programme = null;

    if (classId) {
      const classe = await this.classeRepository.findById(classId);
      if (!classe || classe.schoolId !== schoolId) return { hasProgramme: false, chapitres: [] };
      programme = await this.programmeRepository.findByClassSubject(schoolId, subjectId, anneeId ?? '', classId, classe.level ?? null);
    } else if (anneeId) {
      programme = await this.programmeRepository.findBySubject(schoolId, subjectId, anneeId);
    }

    const chapitres = programme?.chapitres ?? [];
    return { hasProgramme: chapitres.length > 0, chapitres };
  }

  private vide(): ProgressionAvecProgramme {
    return {
      programme: null,
      chapitresTotal: 0,
      chapitresRealises: 0,
      totalHeuresPrevu: 0,
      heuresRealisees: 0,
      progressionPct: null,
      attenduPct: null,
      retardPct: null,
      chapitres: [],
      entries: [],
    };
  }

  private datePourcentage(start?: Date, end?: Date): number | null {
    if (!start || !end) return null;
    const today = new Date();
    const totalJours = (end.getTime() - start.getTime()) / 86400000;
    const ecoulees = (today.getTime() - start.getTime()) / 86400000;
    return totalJours > 0 ? Math.min(100, Math.round((ecoulees / totalJours) * 100)) : null;
  }
}
