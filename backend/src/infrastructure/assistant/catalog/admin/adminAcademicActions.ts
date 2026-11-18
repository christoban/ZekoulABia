import { z } from 'zod';
import { LIMITE_AP_HEURES } from '@domain/rules/CapaciteEmploiDuTemps';
import type { CopilotTimetableGridConfig } from '@domain/ports/repositories/copilot/CopilotAdminAcademicGateway';
import {
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveSubject,
  resolveTeacher,
  resolveCurrentAcademicYear,
  resolveCurrentPeriod,
} from '../catalogShared';
import type { AdminActionDeps } from '../adminActionCatalog';

const DAY_MAP: Record<string, number> = { LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5 };

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const formatMinutes = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

const isAnimateurPedagogique = (teacher: { staffProfile?: { permissions: { permission: string }[] } | null }): boolean =>
  teacher.staffProfile?.permissions.some((p) =>
    ['SUPERVISE_TEACHERS', 'SUPERVISE_DEPARTMENT_TEACHERS'].includes(p.permission),
  ) ?? false;

function buildGridSlots(grid: CopilotTimetableGridConfig): { dayOfWeek: number; startTime: string; endTime: string }[] {
  return grid.joursActifs.flatMap((jour) => {
    const day = DAY_MAP[jour];
    if (day === undefined) return [];
    const count = grid.periodesCoursParJour[jour] ?? grid.periodesAvantP1 + grid.periodesAvantP2 + grid.periodesApresP2;
    let cursor = toMinutes(grid.heureDebut);
    const periods: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
    const addPeriods = (n: number) => {
      for (let i = 0; i < n; i++) {
        const start = cursor;
        cursor += grid.dureePeriode;
        periods.push({ dayOfWeek: day, startTime: formatMinutes(start), endTime: formatMinutes(cursor) });
      }
    };
    addPeriods(grid.periodesAvantP1);
    cursor += grid.dureePetitePause;
    addPeriods(grid.periodesAvantP2);
    cursor += grid.dureeGrandePause;
    addPeriods(grid.periodesApresP2);
    return periods.slice(0, count);
  });
}

export function buildAdminAcademicActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    defineAction({
      name: 'vider_creneaux_classe',
      domain: 'classes',
      description:
        "Supprime en une seule action tous les créneaux de l'emploi du temps d'une classe sur l'année scolaire courante. " +
        "Uniquement pour un emploi du temps en brouillon.",
      destructive: true,
      requiredPermission: 'MANAGE_TIMETABLE',
      inputSchema: z.object({ className: z.string().min(1) }),
      async summarizeDestructive(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const annee = await resolveCurrentAcademicYear(ctx);
        const timetable = await ctx.data.adminAcademic.findClassTimetableSummary(ctx.schoolId, classe.id, annee.id);
        if (!timetable) throw new Error(`Aucun emploi du temps n'existe pour ${classe.name} sur l'année courante.`);
        if (timetable.status === 'PUBLISHED') throw new Error('Impossible de vider un emploi du temps publié.');
        return `Supprimer les ${timetable.slotsCount} créneaux de ${classe.name} ? Cette action est irréversible depuis l'assistant.`;
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const annee = await resolveCurrentAcademicYear(ctx);
        const timetable = await ctx.data.adminAcademic.findClassTimetableSummary(ctx.schoolId, classe.id, annee.id);
        if (!timetable) throw new Error(`Aucun emploi du temps n'existe pour ${classe.name} sur l'année courante.`);
        const nombreSupprimes = await deps.viderEDT.execute({
          timetableId: timetable.id,
          schoolId: ctx.schoolId,
          demandeurId: ctx.userId,
        });
        return {
          resultLabel: `${nombreSupprimes} créneau(x) vidé(s) pour ${classe.name}`,
          section: 'timetable',
          entity: 'timetable',
        };
      },
      async undo() {
        throw new Error("Le vidage des créneaux est irréversible depuis l'assistant.");
      },
    }),

    defineAction({
      name: 'reaffecter_enseignant_classe',
      domain: 'timetable',
      description: "Réaffecte une matière d'une classe à un autre enseignant qualifié après validation explicite.",
      destructive: true,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1), teacherName: z.string().min(1) }),
      async summarizeDestructive(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const matiere = await resolveSubject(ctx, input.subjectName);
        const teacher = await resolveTeacher(ctx, input.teacherName);
        const current = await ctx.data.adminAcademic.findTeachingAssignmentForClassSubject(ctx.schoolId, classe.id, matiere.id);
        return `Réaffecter ${matiere.name} de ${classe.name} à ${teacher.name} ? Actuellement : ${current?.teacher ? `${current.teacher.firstName} ${current.teacher.lastName}` : 'aucun enseignant'}.`;
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const matiere = await resolveSubject(ctx, input.subjectName);
        const teacher = await resolveTeacher(ctx, input.teacherName);
        const current = await ctx.data.adminAcademic.findTeachingAssignmentForClassSubject(ctx.schoolId, classe.id, matiere.id);
        if (!current) throw new Error(`Aucune affectation de ${matiere.name} pour ${classe.name}.`);
        const isQualified = await ctx.data.adminAcademic.isTeacherQualifiedForSubject(ctx.schoolId, teacher.id, matiere.id);
        if (!isQualified) throw new Error(`${teacher.name} n'est pas qualifié pour ${matiere.name}.`);
        await ctx.data.adminAcademic.reassignTeachingAssignmentTeacher(ctx.schoolId, current.id, teacher.id);
        return { resultLabel: `${matiere.name} de ${classe.name} réaffecté à ${teacher.name}.`, section: 'affectations', entity: 'teachingAssignment' };
      },
      async undo() {
        throw new Error("La réaffectation d'un enseignant n'est pas annulable depuis l'assistant.");
      },
    }),

    defineAction({
      name: 'annuler_affectations_classe',
      domain: 'affectations',
      description: "Annule toutes les affectations d'une classe après confirmation explicite.",
      destructive: true,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({ className: z.string().min(1) }),
      async summarizeDestructive(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const count = await ctx.data.adminAcademic.countTeachingAssignmentsByClass(ctx.schoolId, classe.id);
        return `Annuler les ${count} affectation(s) de ${classe.name} ? Cette action est irréversible.`;
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const deletedCount = await ctx.data.adminAcademic.deleteTeachingAssignmentsByClass(ctx.schoolId, classe.id);
        if (deletedCount === 0) throw new Error(`Aucune affectation à annuler pour ${classe.name}.`);
        return { resultLabel: `${deletedCount} affectation(s) annulée(s) pour ${classe.name}.`, section: 'affectations', entity: 'teachingAssignment' };
      },
      async undo() {
        throw new Error("L'annulation groupée des affectations n'est pas annulable depuis l'assistant.");
      },
    }),

    defineAction({
      name: 'annuler_toutes_affectations',
      domain: 'affectations',
      description:
        "Annule toutes les affectations de l'établissement pour l'année scolaire courante après confirmation explicite.",
      destructive: true,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({}),
      async summarizeDestructive(_input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx);
        const count = await ctx.data.adminAcademic.countTeachingAssignmentsByYear(ctx.schoolId, annee.id);
        return `Annuler les ${count} affectation(s) de l'établissement pour ${annee.name} ? Cette action est irréversible.`;
      },
      async execute(_input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx);
        const deletedCount = await ctx.data.adminAcademic.deleteTeachingAssignmentsByYear(ctx.schoolId, annee.id);
        if (deletedCount === 0) throw new Error('Aucune affectation à annuler pour cette année scolaire.');
        return { resultLabel: `${deletedCount} affectation(s) annulée(s) pour ${annee.name}.`, section: 'affectations', entity: 'teachingAssignment' };
      },
      async undo() {
        throw new Error("L'annulation groupée des affectations n'est pas annulable depuis l'assistant.");
      },
    }),

    defineAction({
      name: 'lister_issues_affectations',
      domain: 'affectations',
      description:
        "Liste les signalements persistants d'affectation non résolus, éventuellement filtrés par classe et statut, sans modifier les données.",
      destructive: false,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({ className: z.string().optional(), status: z.enum(['OPEN', 'RESOLVED']).optional() }),
      async execute(input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx);
        const classe = input.className ? await resolveClass(ctx, input.className) : null;
        const issues = await ctx.data.adminAcademic.findTeachingAssignmentIssues(ctx.schoolId, annee.id, {
          ...(classe ? { classId: classe.id } : {}),
          ...(input.status ? { status: input.status } : {}),
        });
        const classIds = [...new Set(issues.map((issue) => issue.classId))];
        const subjectIds = [...new Set(issues.map((issue) => issue.subjectId))];
        const [classes, subjects] = await Promise.all([
          ctx.data.adminAcademic.findClassNamesByIds(ctx.schoolId, classIds),
          ctx.data.adminAcademic.findSubjectNamesByIds(ctx.schoolId, subjectIds),
        ]);
        const classNames = new Map(classes.map((item) => [item.id, item.name]));
        const subjectNames = new Map(subjects.map((item) => [item.id, item.name]));
        const lines = issues.map(
          (issue) =>
            `${classNames.get(issue.classId) ?? 'Classe inconnue'} — ${subjectNames.get(issue.subjectId) ?? 'Matière inconnue'} : ${issue.reason} (${issue.status})`,
        );
        return {
          resultLabel: lines.length > 0 ? lines.join('\n') : 'Aucun signalement d’affectation correspondant.',
          section: 'affectations',
          entity: 'teachingAssignmentIssue',
        };
      },
      async undo() {
        throw new Error('La consultation des signalements ne modifie aucune donnée.');
      },
    }),

    defineAction({
      name: 'diagnostiquer_planification_classe',
      domain: 'timetable',
      description:
        "Analyse précisément la génération de l'emploi du temps d'une classe : heures demandées et réelles par enseignant, plafond de 14 heures des animateurs pédagogiques, créneaux déjà occupés dans les autres classes, indisponibilités déclarées et enseignants alternatifs qualifiés. Retourne des solutions concrètes, sans modifier les données.",
      destructive: false,
      requiredPermission: 'MANAGE_TIMETABLE',
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const annee = await resolveCurrentAcademicYear(ctx);
        const grid = await ctx.data.adminAcademic.findTimetableGridConfig(ctx.schoolId);
        if (!grid) throw new Error("La grille horaire n'est pas configurée.");
        const [affectations, indisponibilites, occupation, allOccupation, teachers] = await Promise.all([
          ctx.data.adminAcademic.findClassTeachingAssignments(ctx.schoolId, classe.id, annee.id),
          ctx.data.adminAcademic.findActiveTeacherUnavailabilities(ctx.schoolId),
          ctx.data.adminAcademic.findOtherClassTimetableSlots(ctx.schoolId, annee.id, classe.id),
          ctx.data.adminAcademic.findYearClassTimetableSlots(ctx.schoolId, annee.id),
          ctx.data.adminAcademic.findActiveTeachersWithSubjects(ctx.schoolId),
        ]);
        const heuresReellesParEnseignant = new Map<string, number>();
        for (const slot of allOccupation) {
          if (!slot.teacherId) continue;
          heuresReellesParEnseignant.set(
            slot.teacherId,
            (heuresReellesParEnseignant.get(slot.teacherId) ?? 0) +
              (toMinutes(slot.endTime) - toMinutes(slot.startTime)) / 60,
          );
        }
        const cases = buildGridSlots(grid);
        const load = new Map<string, { name: string; requested: number; actualHours: number; ap: boolean; free: number; occupied: string[] }>();
        for (const affectation of affectations) {
          const ap = isAnimateurPedagogique(affectation.teacher);
          const current = load.get(affectation.teacher.id) ?? {
            name: `${affectation.teacher.firstName} ${affectation.teacher.lastName}`,
            requested: 0,
            actualHours: heuresReellesParEnseignant.get(affectation.teacher.id) ?? 0,
            ap,
            free: cases.length,
            occupied: [],
          };
          current.requested += affectation.subject.hoursPerWeek;
          load.set(affectation.teacher.id, current);
        }
        for (const [teacherId, entry] of load.entries()) {
          const teacherBlocked = [
            ...occupation.filter((slot) => slot.teacherId === teacherId),
            ...indisponibilites.filter((slot) => slot.teacherId === teacherId),
          ];
          entry.free = cases.filter(
            (candidate) =>
              !teacherBlocked.some(
                (slot) =>
                  slot.dayOfWeek === candidate.dayOfWeek &&
                  toMinutes(slot.startTime) < toMinutes(candidate.endTime || '23:59') &&
                  toMinutes(slot.endTime || '24:00') > toMinutes(candidate.startTime || '00:00'),
              ),
          ).length;
          entry.occupied = occupation
            .filter((slot) => slot.teacherId === teacherId)
            .map((slot) => `${slot.timetable.class.name} ${slot.startTime}-${slot.endTime}`);
        }
        const alternatives = new Map<string, string[]>();
        for (const affectation of affectations) {
          const candidates = teachers.filter(
            (teacher) =>
              teacher.id !== affectation.teacher.id &&
              teacher.teacherProfile?.teacherSubjects.some((subject) => subject.subjectId === affectation.subject.id),
          );
          alternatives.set(
            affectation.subject.name,
            candidates.map((candidate) => {
              const heures = heuresReellesParEnseignant.get(candidate.id) ?? 0;
              const ap = isAnimateurPedagogique(candidate) ? ', AP' : '';
              return `${candidate.firstName} ${candidate.lastName} (${heures}h EDT${ap})`;
            }),
          );
        }
        const lines = affectations.map((affectation) => {
          const teacherName = `${affectation.teacher.firstName} ${affectation.teacher.lastName}`;
          const entry = load.get(affectation.teacher.id)!;
          const alternate = alternatives.get(affectation.subject.name)?.join(', ') || 'aucun enseignant qualifié disponible';
          const occupations =
            entry.free < entry.requested ? ` Occupée(s) dans : ${entry.occupied.slice(0, 6).join(', ')}.` : '';
          const cap = entry.ap
            ? ` Statut AP : ${entry.actualHours}h actuellement, maximum ${LIMITE_AP_HEURES}h${entry.actualHours > LIMITE_AP_HEURES ? ' — DÉPASSEMENT' : ''}.`
            : '';
          return `${affectation.subject.name} : ${affectation.subject.hoursPerWeek}h demandées à ${teacherName}; ${entry.free} créneaux libres; alternative(s) : ${alternate}.${cap}${occupations}`;
        });
        return { resultLabel: `Diagnostic ${classe.name} :\n${lines.join('\n')}`, section: 'timetable', entity: 'timetable' };
      },
      async undo() {
        throw new Error("Le diagnostic d'emploi du temps ne modifie aucune donnée.");
      },
    }),

    defineAction({
      name: 'publier_emploi_du_temps',
      domain: 'classes',
      description:
        "Publie l'emploi du temps d'une classe (le rend visible aux enseignants et élèves), pour l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const year = await resolveCurrentAcademicYear(ctx);
        const timetable = await ctx.data.adminAcademic.findClassTimetableStatus(ctx.schoolId, classe.id, year.id);
        if (!timetable) throw new Error(`Aucun emploi du temps n'existe pour ${classe.name} sur l'année courante.`);
        if (timetable.status === 'PUBLISHED') {
          return { resultLabel: `L'emploi du temps de ${classe.name} est déjà publié.`, section: 'timetable', entity: 'timetable' };
        }
        await deps.publierEDT.execute({ timetableId: timetable.id, schoolId: ctx.schoolId, demandeurId: ctx.userId, demandeurRole: ctx.role });
        return { resultLabel: `Emploi du temps de ${classe.name} publié`, undoData: { timetableId: timetable.id }, section: 'timetable', entity: 'timetable' };
      },
      async undo(_params, undoData, ctx) {
        await deps.rouvrirEDT.execute({ timetableId: String(undoData.timetableId), schoolId: ctx.schoolId, demandeurId: ctx.userId, demandeurRole: ctx.role });
      },
    }),

    // 31. Classes sans emploi du temps publié — LECTURE SEULE
    defineAction({
      name: 'classes_sans_edt_publie',
      domain: 'classes',
      description: "Liste les classes qui n'ont pas encore d'emploi du temps publié, pour l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const [classes, publishedClassIds] = await Promise.all([
          ctx.data.shared.findClassesBySchool(ctx.schoolId),
          ctx.data.adminAcademic.findPublishedTimetableClassIds(ctx.schoolId, year.id),
        ]);
        const publishedIds = new Set(publishedClassIds);
        const sansEdt = classes.filter((c) => !publishedIds.has(c.id));
        const resultLabel =
          sansEdt.length === 0
            ? 'Toutes les classes ont un emploi du temps publié.'
            : `${sansEdt.length} classe(s) sans emploi du temps publié : ${sansEdt.map((c) => c.name).join(', ')}`;
        return { resultLabel, section: 'timetable', entity: 'timetable' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 33. Définir la période académique courante — NON destructif (réversible)
    defineAction({
      name: 'definir_periode_courante',
      domain: 'periode_annee',
      description:
        "Change la période académique courante de l'établissement (ex. passer du Trimestre 1 au Trimestre 2). Affecte toute la saisie de notes en cours.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        periodName: z.string().min(1).describe('Nom de la période à activer, ex. "Trimestre 2"'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const previous = await resolveCurrentPeriod(ctx).catch(() => null);
        const period = await ctx.data.adminAcademic.findAcademicPeriodByName(ctx.schoolId, year.id, input.periodName);
        if (!period) throw new Error(`Aucune période nommée « ${input.periodName} » n'existe pour l'année courante.`);
        await deps.definirPeriodeCourante.definirPeriode(period.id, ctx.schoolId);
        return {
          resultLabel: `Période courante définie sur « ${period.name} »`,
          undoData: { previousPeriodId: previous?.id ?? null },
          section: 'academic-year',
          entity: 'academicPeriod',
        };
      },
      async undo(_params, undoData, ctx) {
        const previousId = typeof undoData.previousPeriodId === 'string' ? undoData.previousPeriodId : null;
        if (previousId) await deps.definirPeriodeCourante.definirPeriode(previousId, ctx.schoolId);
      },
    }),

    // 34. Vérifier si l'année scolaire peut être clôturée — LECTURE SEULE
    defineAction({
      name: 'verifier_cloture_annee',
      domain: 'periode_annee',
      description:
        "Vérifie si l'année scolaire courante peut être clôturée et liste les blocages éventuels. " +
        "N'exécute JAMAIS la clôture elle-même — action trop sensible (promotions, archivage) pour être " +
        "déclenchée depuis le copilot, à faire uniquement depuis l'écran Année scolaire.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const r = await deps.verifierPrerequisCloture.execute(year.id);
        const resultLabel = r.peutCloturer
          ? `L'année ${year.name} peut être clôturée — tous les prérequis sont remplis.`
          : `L'année ${year.name} ne peut pas encore être clôturée : ${r.bloqueurs.map((b) => b.message).join(' ; ')}`;
        return { resultLabel, section: 'academic-year', entity: 'academicYear' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),
  ];
}
