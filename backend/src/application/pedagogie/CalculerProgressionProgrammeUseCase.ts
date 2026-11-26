import type { ProgrammeRepository, ProgrammeChapitreProps } from '@domain/ports/repositories/ProgrammeRepository';
import type { CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type {
  ChapitreAvancementProps,
  ChapitreAvancementRepository,
  ProgrammeModuleEtatProps,
} from '@domain/ports/repositories/ChapitreAvancementRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { SourceRealisationLecon } from './BasculerAvancementChapitreUseCase';
import { PedagogieForbiddenError } from './errors';
import {
  exigerDroitLectureProgrammeClasseMatiere,
  resoudreScopePedagogie,
  type PedagogieActor,
} from './PedagogieAccessGuard';
import {
  estLeconComptabilisee,
  estLeconRetireeDuReferentiel,
} from '@domain/rules/programmeLeconsComptabilisees';
import type {
  AlerteRetardProgramme,
  CalculerProgressionInput,
  ProgressionAvecProgramme,
  ProgressionChapitreDetail,
  ProgressionModuleDetail,
} from './progressionTypes';

export type {
  AlerteRetardProgramme,
  CalculerProgressionInput,
  ProgressionAvecProgramme,
  ProgressionChapitreDetail,
  ProgressionModuleDetail,
} from './progressionTypes';

export class CalculerProgressionProgrammeUseCase {
  constructor(
    private readonly programmeRepository: ProgrammeRepository,
    private readonly cahierDeTexteRepository: CahierDeTexteRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly avancementRepository?: ChapitreAvancementRepository,
    private readonly departmentRepository?: DepartmentRepository,
    private readonly rattachementRepository?: RattachementEnseignantRepository,
  ) {}

  async calculerProgression(input: CalculerProgressionInput): Promise<ProgressionAvecProgramme> {
    if (input.actor && this.departmentRepository) {
      await exigerDroitLectureProgrammeClasseMatiere(
        this.departmentRepository,
        this.rattachementRepository,
        input.schoolId,
        input.subjectId,
        input.classId,
        input.actor,
      );
    }

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

    const chapitres = [...(programme.chapitres ?? [])].sort((a, b) => a.ordre - b.ordre);
    const [entries, avancements, moduleEtats] = await Promise.all([
      this.cahierDeTexteRepository.findByFilters(input.schoolId, {
        classId: input.classId,
        subjectId: input.subjectId,
        academicYearId: anneeId,
        orderDate: 'asc',
      }),
      this.avancementRepository
        ? this.avancementRepository.findAvancementsByClassAndChapitres(
            input.schoolId,
            input.classId,
            chapitres.map((c) => c.id),
          )
        : Promise.resolve<ChapitreAvancementProps[]>([]),
      this.avancementRepository
        ? this.avancementRepository.findModuleEtatsByProgramme(input.schoolId, programme.id)
        : Promise.resolve<ProgrammeModuleEtatProps[]>([]),
    ]);

    const moduleEtatMap = new Map(moduleEtats.map((m) => [m.moduleOrdre, m]));
    const avancementMap = new Map(avancements.map((a) => [a.chapitreId, a]));

    const seancesParChapitre = new Map<string, number>();
    for (const e of entries) {
      if (e.chapitreId !== null) {
        seancesParChapitre.set(e.chapitreId, (seancesParChapitre.get(e.chapitreId) ?? 0) + 1);
      }
    }

    const chapitresDetails: ProgressionChapitreDetail[] = chapitres.map((c) => {
      const moduleOrdre = c.moduleOrdre ?? null;
      const etatModule = moduleOrdre !== null ? moduleEtatMap.get(moduleOrdre) : undefined;
      const moduleActif = etatModule ? etatModule.actif : true;
      const avancement = avancementMap.get(c.id);
      const cocheDirecte = avancement !== undefined;
      const nbSeancesCahier = seancesParChapitre.get(c.id) ?? 0;
      const realise = cocheDirecte || nbSeancesCahier > 0;
      const sourceRealisation: SourceRealisationLecon =
        cocheDirecte && nbSeancesCahier > 0
          ? 'LES_DEUX'
          : cocheDirecte
            ? 'COCHE'
            : nbSeancesCahier > 0
              ? 'CAHIER'
              : null;

      return {
        id: c.id,
        ordre: c.ordre,
        titre: c.titre,
        volumeHeuresPrevu: c.volumeHeuresPrevu,
        sequenceCibleFin: c.sequenceCibleFin,
        moduleOrdre,
        moduleTitre: c.moduleTitre ?? null,
        positionDansModule: c.positionDansModule ?? null,
        numeroAffiche: c.numeroAffiche ?? null,
        sourceUrl: c.sourceUrl ?? null,
        moduleActif,
        retireDuReferentiel: estLeconRetireeDuReferentiel(c),
        retireDuReferentielLe: c.retireDuReferentielLe ?? null,
        realise,
        cocheDirecte,
        nbSeancesCahier,
        sourceRealisation,
        cocheLe: avancement?.cocheLe ?? null,
      };
    });

    // Dénominateur : modules actifs, hors leçons retirées du référentiel national
    const chapitresActifs = chapitresDetails.filter((c) => c.moduleActif && !c.retireDuReferentiel);
    const leconsRetireesCount = chapitresDetails.filter((c) => c.retireDuReferentiel).length;
    const chapitresTotal = chapitresActifs.length;
    const chapitresRealises = chapitresActifs.filter((c) => c.realise).length;

    const hasHeuresPrevu = chapitresActifs.some(
      (c) => c.volumeHeuresPrevu !== null && c.volumeHeuresPrevu !== undefined,
    );
    const totalHeuresPrevu = hasHeuresPrevu
      ? chapitresActifs.reduce((s, c) => s + (c.volumeHeuresPrevu ?? 0), 0)
      : null;
    const heuresRealisees = hasHeuresPrevu
      ? chapitresActifs
          .filter((c) => c.realise)
          .reduce((s, c) => s + (c.volumeHeuresPrevu ?? 0), 0)
      : null;
    const progressionPct =
      chapitresTotal > 0 ? Math.round((chapitresRealises / chapitresTotal) * 100) : null;

    const modulesMap = new Map<number, { titre: string; total: number; realisees: number }>();
    for (const ch of chapitresDetails) {
      if (ch.moduleOrdre === null) continue;
      const current = modulesMap.get(ch.moduleOrdre) ?? {
        titre: ch.moduleTitre ?? `Module ${ch.moduleOrdre}`,
        total: 0,
        realisees: 0,
      };
      if (!ch.retireDuReferentiel) {
        current.total += 1;
        if (ch.realise) current.realisees += 1;
      }
      modulesMap.set(ch.moduleOrdre, current);
    }

    const modules: ProgressionModuleDetail[] = [...modulesMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([moduleOrdre, stats]) => {
        const etat = moduleEtatMap.get(moduleOrdre);
        const actif = etat ? etat.actif : true;
        return {
          moduleOrdre,
          moduleTitre: stats.titre,
          actif,
          leconsTotal: stats.total,
          leconsRealisees: stats.realisees,
          progressionPct: stats.total > 0 ? Math.round((stats.realisees / stats.total) * 100) : null,
          modifieLe: etat?.modifieLe ?? null,
          modifieParId: etat?.modifieParId ?? null,
        };
      });

    const modulesDesactivesCount = modules.filter((m) => !m.actif).length;

    const annee = await this.anneeRepository.findById(anneeId);
    const attenduPct = this.datePourcentage(annee?.startDate, annee?.endDate);

    return {
      programme: {
        id: programme.id,
        titre: programme.titre,
        source: programme.source,
        officialProgressionId: programme.officialProgressionId ?? null,
        filiere: programme.filiere ?? null,
      },
      chapitresTotal,
      chapitresRealises,
      leconsTotal: chapitresTotal,
      leconsRealisees: chapitresRealises,
      modulesDesactivesCount,
      leconsRetireesCount,
      totalHeuresPrevu,
      heuresRealisees,
      hasHeuresPrevu,
      progressionPct,
      attenduPct,
      retardPct: attenduPct !== null && progressionPct !== null ? attenduPct - progressionPct : null,
      modules,
      chapitres: chapitresDetails,
      entries: entries.map((e) => ({ chapitreId: e.chapitreId, date: e.date })),
    };
  }

  async calculerAlertesRetardProgramme(
    schoolId: string,
    academicYearId?: string,
    seuilPct = 15,
    actor?: PedagogieActor,
  ): Promise<AlerteRetardProgramme[]> {
    let allowedSubjectIds: Set<string> | null = null;
    if (actor && this.departmentRepository) {
      const scope = await resoudreScopePedagogie(this.departmentRepository, schoolId, actor);
      if (scope.kind === 'NONE') {
        throw new PedagogieForbiddenError(
          "Accès refusé : vous n'êtes pas autorisé à consulter les alertes de retard de l'établissement.",
        );
      }
      if (scope.kind === 'DEPARTMENT_SCOPED') {
        allowedSubjectIds = scope.subjectIds;
      }
    }

    const anneeId = academicYearId ?? (await this.anneeRepository.findCourante(schoolId))?.id;
    if (!anneeId) return [];

    const annee = await this.anneeRepository.findById(anneeId);
    const attenduPct = this.datePourcentage(annee?.startDate, annee?.endDate);
    if (attenduPct === null) return [];

    const tousProgrammes = await this.programmeRepository.findByFilters(schoolId, { academicYearId: anneeId });
    const programmes =
      allowedSubjectIds !== null
        ? tousProgrammes.filter((p) => allowedSubjectIds!.has(p.subjectId))
        : tousProgrammes;
    const allModuleEtats =
      this.avancementRepository && programmes.length > 0
        ? await this.avancementRepository.findModuleEtatsByProgrammes(
            schoolId,
            programmes.map((p) => p.id),
          )
        : [];
    const etatsParProgramme = new Map<string, Set<number>>();
    for (const etat of allModuleEtats) {
      if (!etat.actif) {
        const set = etatsParProgramme.get(etat.programmeId) ?? new Set<number>();
        set.add(etat.moduleOrdre);
        etatsParProgramme.set(etat.programmeId, set);
      }
    }

    const alertes: AlerteRetardProgramme[] = [];

    for (const prog of programmes) {
      const tousChapitres = prog.chapitres ?? [];
      const modulesDesactives = etatsParProgramme.get(prog.id) ?? new Set<number>();
      const chapitres = tousChapitres.filter((c) => estLeconComptabilisee(c, modulesDesactives));
      const chapitresTotal = chapitres.length;
      if (chapitresTotal === 0) continue;

      const modulesDistincts = new Set(
        tousChapitres
          .map((c) => c.moduleOrdre)
          .filter((m): m is number => m !== null && m !== undefined),
      );
      const modulesDesactivesCount = [...modulesDesactives].filter((m) => modulesDistincts.has(m)).length;

      const classIds = prog.classId
        ? [prog.classId]
        : (prog.level
            ? await this.classeRepository.findByLevel(schoolId, prog.level)
            : await this.classeRepository.findBySchool(schoolId)
          ).map((c) => c.id);

      for (const cid of classIds) {
        const [entries, avancements] = await Promise.all([
          this.cahierDeTexteRepository.findByFilters(schoolId, {
            classId: cid,
            subjectId: prog.subjectId,
            academicYearId: anneeId,
          }),
          this.avancementRepository
            ? this.avancementRepository.findAvancementsByClassAndChapitres(
                schoolId,
                cid,
                chapitres.map((c) => c.id),
              )
            : Promise.resolve<ChapitreAvancementProps[]>([]),
        ]);

        const chapitresAbordees = new Set<string>(
          entries.map((e) => e.chapitreId).filter((x): x is string => x !== null),
        );
        for (const av of avancements) {
          chapitresAbordees.add(av.chapitreId);
        }

        const chapitresRealises = chapitres.filter((c) => chapitresAbordees.has(c.id)).length;
        const progressionPct = Math.round((chapitresRealises / chapitresTotal) * 100);
        const retardPct = attenduPct - progressionPct;

        if (retardPct > seuilPct) {
          const classe = prog.class ?? (await this.classeRepository.findById(cid));
          alertes.push({
            programmeId: prog.id,
            programmeTitre: prog.titre,
            subjectId: prog.subjectId,
            subjectName: prog.subject?.name ?? '',
            className: classe?.name ?? cid,
            classId: cid,
            chapitresTotal,
            chapitresRealises,
            modulesDesactivesCount,
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
    actor?: PedagogieActor,
  ): Promise<{ hasProgramme: boolean; chapitres: ProgrammeChapitreProps[] }> {
    if (actor && this.departmentRepository) {
      await exigerDroitLectureProgrammeClasseMatiere(
        this.departmentRepository,
        this.rattachementRepository,
        schoolId,
        subjectId,
        classId,
        actor,
      );
    }

    const anneeId = academicYearId ?? (await this.anneeRepository.findCourante(schoolId))?.id;
    let programme = null;

    if (classId) {
      const classe = await this.classeRepository.findById(classId);
      if (!classe || classe.schoolId !== schoolId) return { hasProgramme: false, chapitres: [] };
      programme = await this.programmeRepository.findByClassSubject(
        schoolId,
        subjectId,
        anneeId ?? '',
        classId,
        classe.level ?? null,
      );
    } else if (anneeId) {
      programme = await this.programmeRepository.findBySubject(schoolId, subjectId, anneeId);
    }

    const allChapitres = programme?.chapitres ?? [];
    if (!programme || allChapitres.length === 0) {
      return { hasProgramme: false, chapitres: [] };
    }

    if (!this.avancementRepository) {
      return {
        hasProgramme: true,
        chapitres: allChapitres.filter((c) => !estLeconRetireeDuReferentiel(c)),
      };
    }

    const moduleEtats = await this.avancementRepository.findModuleEtatsByProgramme(schoolId, programme.id);
    const modulesDesactives = new Set(moduleEtats.filter((m) => !m.actif).map((m) => m.moduleOrdre));
    const chapitresActifs = allChapitres.filter((c) => estLeconComptabilisee(c, modulesDesactives));
    return { hasProgramme: true, chapitres: chapitresActifs };
  }

  private vide(): ProgressionAvecProgramme {
    return {
      programme: null,
      chapitresTotal: 0,
      chapitresRealises: 0,
      leconsTotal: 0,
      leconsRealisees: 0,
      modulesDesactivesCount: 0,
      leconsRetireesCount: 0,
      totalHeuresPrevu: null,
      heuresRealisees: null,
      hasHeuresPrevu: false,
      progressionPct: null,
      attenduPct: null,
      retardPct: null,
      modules: [],
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
