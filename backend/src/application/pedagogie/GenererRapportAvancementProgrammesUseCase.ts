/**
 * APPLICATION LAYER — Use Case Lot 3 : Rapport consolidé d'avancement des programmes
 * par niveau, département pédagogique, classe × matière et module, avec export CSV.
 *
 * Source unique de vérité :
 * - Union ChapitreAvancement ∪ CahierDeTexte ;
 * - Exclusion des modules désactivés (ProgrammeModuleEtat.actif = false) ;
 * - RBAC strict : Admin / Censeur voit tout l'établissement, Animateur Pédagogique est
 *   automatiquement scopé à son/ses département(s).
 */
import type { ProgrammeRepository } from '@domain/ports/repositories/ProgrammeRepository';
import type { CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ChapitreAvancementRepository } from '@domain/ports/repositories/ChapitreAvancementRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import { PedagogieForbiddenError } from './errors';
import { resoudreScopePedagogie } from './PedagogieAccessGuard';

export interface GenererRapportAvancementInput {
  schoolId: string;
  userId: string;
  role: string;
  permissions: string[];
  academicYearId?: string;
  level?: string;
  departmentId?: string;
  classId?: string;
  source?: 'national' | 'manuel';
  seuilRetardPct?: number;
}

export interface RapportAvancementModuleItem {
  moduleOrdre: number;
  moduleTitre: string;
  actif: boolean;
  leconsTotal: number;
  leconsRealisees: number;
  progressionPct: number | null;
}

export interface RapportAvancementLigne {
  programmeId: string;
  programmeTitre: string;
  source: string;
  classId: string;
  className: string;
  level: string;
  filiere: string | null;
  subjectId: string;
  subjectName: string;
  departmentId: string | null;
  departmentName: string;
  leconsTotal: number;
  leconsRealisees: number;
  modulesActifsCount: number;
  modulesDesactivesCount: number;
  progressionPct: number | null;
  attenduPct: number | null;
  retardPct: number | null;
  statut: 'A_JOUR' | 'MODERE' | 'CRITIQUE';
  modules: RapportAvancementModuleItem[];
}

export interface RapportAvancementAgrege {
  cle: string;
  libelle: string;
  programmesCount: number;
  leconsTotal: number;
  leconsRealisees: number;
  progressionPct: number | null;
  modulesDesactivesCount: number;
  enRetardCount: number;
}

export interface RapportAvancementProgrammesResultat {
  genereLe: string;
  academicYearId: string | null;
  attenduPct: number | null;
  resumeGlobal: {
    totalProgrammes: number;
    programmesNationaux: number;
    programmesManuels: number;
    leconsActivesTotal: number;
    leconsRealiseesTotal: number;
    progressionMoyennePct: number | null;
    totalModulesDesactives: number;
    programmesEnRetard: number;
  };
  parNiveau: RapportAvancementAgrege[];
  parDepartement: RapportAvancementAgrege[];
  lignes: RapportAvancementLigne[];
}

function echapperCelluleCsv(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return '';
  let s = String(valeur).replace(/\r?\n/g, ' ');
  // Protection anti-injection de formule Excel (=, +, -, @)
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`;
  }
  if (/[;"\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Formate le rapport consolidé en CSV UTF-8 (BOM + séparateur ';' compatible Excel/LibreOffice). */
export function formaterRapportAvancementCsv(
  rapport: RapportAvancementProgrammesResultat,
): string {
  const entetes = [
    'Niveau',
    'Classe',
    'Filière',
    'Département',
    'Matière',
    'Programme',
    'Source',
    'Leçons réalisées',
    'Leçons actives',
    'Progression (%)',
    'Attendu (%)',
    'Retard (%)',
    'Modules actifs',
    'Modules désactivés',
    'Statut',
  ];

  const lignes = rapport.lignes.map((l) =>
    [
      l.level,
      l.className,
      l.filiere ?? '',
      l.departmentName,
      l.subjectName,
      l.programmeTitre,
      l.source,
      l.leconsRealisees,
      l.leconsTotal,
      l.progressionPct ?? '',
      l.attenduPct ?? '',
      l.retardPct ?? '',
      l.modulesActifsCount,
      l.modulesDesactivesCount,
      l.statut,
    ]
      .map(echapperCelluleCsv)
      .join(';'),
  );

  return `\uFEFF${[entetes.map(echapperCelluleCsv).join(';'), ...lignes].join('\n')}\n`;
}

export class GenererRapportAvancementProgrammesUseCase {
  constructor(
    private readonly programmeRepository: ProgrammeRepository,
    private readonly cahierDeTexteRepository: CahierDeTexteRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly avancementRepository: ChapitreAvancementRepository,
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  async execute(
    input: GenererRapportAvancementInput,
  ): Promise<RapportAvancementProgrammesResultat> {
    const seuilRetard = input.seuilRetardPct ?? 15;
    const anneeId =
      input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id ?? null;

    if (!anneeId) {
      return this.vide(null);
    }

    const [annee, departments, classes, programmes] = await Promise.all([
      this.anneeRepository.findById(anneeId),
      this.departmentRepository.findBySchool(input.schoolId),
      this.classeRepository.findBySchoolAndYear(input.schoolId, anneeId),
      this.programmeRepository.findByFilters(input.schoolId, {
        academicYearId: anneeId,
        classId: input.classId,
        level: input.level,
      }),
    ]);

    const attenduPct = this.datePourcentage(annee?.startDate, annee?.endDate);

    // Mapping subjectId → department
    const deptBySubject = new Map<string, { id: string; name: string; headId: string | null }>();
    for (const d of departments) {
      for (const s of d.subjects ?? []) {
        deptBySubject.set(s.id, { id: d.id, name: d.name, headId: d.headId });
      }
    }

    // RBAC strict : Admin / Censeur (MANAGE_CLASSES) → toute l'école ; AP → ses départements ; autre → 403
    const scope = await resoudreScopePedagogie(this.departmentRepository, input.schoolId, {
      userId: input.userId,
      role: input.role,
      permissions: input.permissions,
    });
    if (scope.kind === 'NONE') {
      throw new PedagogieForbiddenError(
        "Accès refusé : seuls l'administration, le censeur ou l'Animateur Pédagogique d'un département peuvent consulter le rapport consolidé.",
      );
    }
    const allowedDepartmentIds: Set<string> | null =
      scope.kind === 'DEPARTMENT_SCOPED' ? scope.departmentIds : null;
    if (allowedDepartmentIds !== null && input.departmentId && !allowedDepartmentIds.has(input.departmentId)) {
      throw new PedagogieForbiddenError(
        "Accès refusé : un Animateur Pédagogique ne peut consulter que les rapports de son propre département.",
      );
    }

    const classesMap = new Map(classes.map((c) => [c.id, c]));
    const filteredProgrammes = programmes.filter((p) => {
      if (input.source && (p.source ?? 'manuel') !== input.source) return false;
      const dept = deptBySubject.get(p.subjectId);
      if (input.departmentId && dept?.id !== input.departmentId) return false;
      if (allowedDepartmentIds !== null) {
        if (!dept || !allowedDepartmentIds.has(dept.id)) return false;
      }
      return true;
    });

    const allModuleEtats =
      filteredProgrammes.length > 0
        ? await this.avancementRepository.findModuleEtatsByProgrammes(
            input.schoolId,
            filteredProgrammes.map((p) => p.id),
          )
        : [];
    const moduleEtatsByProg = new Map<string, Map<number, boolean>>();
    for (const etat of allModuleEtats) {
      const inner = moduleEtatsByProg.get(etat.programmeId) ?? new Map<number, boolean>();
      inner.set(etat.moduleOrdre, etat.actif);
      moduleEtatsByProg.set(etat.programmeId, inner);
    }

    const lignes: RapportAvancementLigne[] = [];

    for (const prog of filteredProgrammes) {
      const chapitres = [...(prog.chapitres ?? [])].sort((a, b) => a.ordre - b.ordre);
      if (chapitres.length === 0) continue;

      const targetClasses = prog.classId
        ? [classesMap.get(prog.classId)].filter((c): c is NonNullable<typeof c> => Boolean(c))
        : classes.filter((c) => !prog.level || c.level === prog.level);

      const progModulesEtat = moduleEtatsByProg.get(prog.id) ?? new Map<number, boolean>();
      const dept = deptBySubject.get(prog.subjectId);

      for (const cls of targetClasses) {
        if (input.classId && cls.id !== input.classId) continue;

        const [entries, avancements] = await Promise.all([
          this.cahierDeTexteRepository.findByFilters(input.schoolId, {
            classId: cls.id,
            subjectId: prog.subjectId,
            academicYearId: anneeId,
          }),
          this.avancementRepository.findAvancementsByClassAndChapitres(
            input.schoolId,
            cls.id,
            chapitres.map((c) => c.id),
          ),
        ]);

        const realisesSet = new Set<string>(
          entries.map((e) => e.chapitreId).filter((x): x is string => x !== null),
        );
        for (const av of avancements) {
          realisesSet.add(av.chapitreId);
        }

        // Groupement par module
        const modStats = new Map<number, { titre: string; total: number; realisees: number }>();
        let leconsTotal = 0;
        let leconsRealisees = 0;

        for (const ch of chapitres) {
          const modOrdre = ch.moduleOrdre ?? null;
          const actif = modOrdre === null ? true : (progModulesEtat.get(modOrdre) ?? true);
          const fait = realisesSet.has(ch.id);

          if (modOrdre !== null) {
            const st = modStats.get(modOrdre) ?? {
              titre: ch.moduleTitre ?? `Module ${modOrdre}`,
              total: 0,
              realisees: 0,
            };
            st.total += 1;
            if (fait) st.realisees += 1;
            modStats.set(modOrdre, st);
          }

          if (actif) {
            leconsTotal += 1;
            if (fait) leconsRealisees += 1;
          }
        }

        const modules: RapportAvancementModuleItem[] = [...modStats.entries()]
          .sort(([a], [b]) => a - b)
          .map(([moduleOrdre, st]) => {
            const actif = progModulesEtat.get(moduleOrdre) ?? true;
            return {
              moduleOrdre,
              moduleTitre: st.titre,
              actif,
              leconsTotal: st.total,
              leconsRealisees: st.realisees,
              progressionPct: st.total > 0 ? Math.round((st.realisees / st.total) * 100) : null,
            };
          });

        const modulesDesactivesCount = modules.filter((m) => !m.actif).length;
        const modulesActifsCount = modules.length - modulesDesactivesCount;
        const progressionPct =
          leconsTotal > 0 ? Math.round((leconsRealisees / leconsTotal) * 100) : null;
        const retardPct =
          attenduPct !== null && progressionPct !== null ? attenduPct - progressionPct : null;
        const statut: 'A_JOUR' | 'MODERE' | 'CRITIQUE' =
          retardPct !== null && retardPct > 30
            ? 'CRITIQUE'
            : retardPct !== null && retardPct > seuilRetard
              ? 'MODERE'
              : 'A_JOUR';

        lignes.push({
          programmeId: prog.id,
          programmeTitre: prog.titre,
          source: prog.source ?? 'manuel',
          classId: cls.id,
          className: cls.name,
          level: cls.level ?? prog.level ?? 'Non défini',
          filiere: prog.filiere ?? cls.filiere ?? null,
          subjectId: prog.subjectId,
          subjectName: prog.subject?.name ?? '',
          departmentId: dept?.id ?? null,
          departmentName: dept?.name ?? 'Hors département',
          leconsTotal,
          leconsRealisees,
          modulesActifsCount,
          modulesDesactivesCount,
          progressionPct,
          attenduPct,
          retardPct,
          statut,
          modules,
        });
      }
    }

    lignes.sort((a, b) => (b.retardPct ?? -999) - (a.retardPct ?? -999));

    const parNiveau = this.agreger(lignes, (l) => ({ cle: l.level, libelle: l.level }));
    const parDepartement = this.agreger(lignes, (l) => ({
      cle: l.departmentId ?? '__none__',
      libelle: l.departmentName,
    }));

    const leconsActivesTotal = lignes.reduce((s, l) => s + l.leconsTotal, 0);
    const leconsRealiseesTotal = lignes.reduce((s, l) => s + l.leconsRealisees, 0);
    const progressionMoyennePct =
      leconsActivesTotal > 0 ? Math.round((leconsRealiseesTotal / leconsActivesTotal) * 100) : null;

    return {
      genereLe: new Date().toISOString(),
      academicYearId: anneeId,
      attenduPct,
      resumeGlobal: {
        totalProgrammes: lignes.length,
        programmesNationaux: lignes.filter((l) => l.source === 'national').length,
        programmesManuels: lignes.filter((l) => l.source !== 'national').length,
        leconsActivesTotal,
        leconsRealiseesTotal,
        progressionMoyennePct,
        totalModulesDesactives: lignes.reduce((s, l) => s + l.modulesDesactivesCount, 0),
        programmesEnRetard: lignes.filter((l) => l.statut !== 'A_JOUR').length,
      },
      parNiveau,
      parDepartement,
      lignes,
    };
  }

  private agreger(
    lignes: readonly RapportAvancementLigne[],
    getKey: (l: RapportAvancementLigne) => { cle: string; libelle: string },
  ): RapportAvancementAgrege[] {
    const map = new Map<string, RapportAvancementAgrege>();
    for (const l of lignes) {
      const { cle, libelle } = getKey(l);
      const cur = map.get(cle) ?? {
        cle,
        libelle,
        programmesCount: 0,
        leconsTotal: 0,
        leconsRealisees: 0,
        progressionPct: null,
        modulesDesactivesCount: 0,
        enRetardCount: 0,
      };
      cur.programmesCount += 1;
      cur.leconsTotal += l.leconsTotal;
      cur.leconsRealisees += l.leconsRealisees;
      cur.modulesDesactivesCount += l.modulesDesactivesCount;
      if (l.statut !== 'A_JOUR') cur.enRetardCount += 1;
      map.set(cle, cur);
    }

    return [...map.values()]
      .map((a) => ({
        ...a,
        progressionPct:
          a.leconsTotal > 0 ? Math.round((a.leconsRealisees / a.leconsTotal) * 100) : null,
      }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }));
  }

  private vide(academicYearId: string | null): RapportAvancementProgrammesResultat {
    return {
      genereLe: new Date().toISOString(),
      academicYearId,
      attenduPct: null,
      resumeGlobal: {
        totalProgrammes: 0,
        programmesNationaux: 0,
        programmesManuels: 0,
        leconsActivesTotal: 0,
        leconsRealiseesTotal: 0,
        progressionMoyennePct: null,
        totalModulesDesactives: 0,
        programmesEnRetard: 0,
      },
      parNiveau: [],
      parDepartement: [],
      lignes: [],
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

