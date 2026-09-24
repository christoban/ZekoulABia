import { z } from 'zod';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import {
  type ActionDefinition,
  resolveClass,
  resolveSubject,
  resolveTeacher,
  resolveCurrentAcademicYear,
  resolveCurrentPeriod,
  resolveCurrentSequence,
  calculerMoyennesClasseSequence,
} from '../catalogShared';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { getEffectiveSchoolSettings } from '@infrastructure/services/school-settings/SchoolSettingsService';
import type { AdminActionDeps } from '../adminActionCatalog';

export function buildAdminAcademicGradeActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 22. Générer les bulletins d'une classe — NON destructif
    {
      name: 'generer_bulletins_classe',
      domain: 'notes_bulletins',
      description:
        "Déclenche la génération des bulletins pour une classe, sur la période académique courante. " +
        "Échoue si les notes ne sont pas toutes validées ou si le conseil de classe n'est pas verrouillé — " +
        "dans ce cas, oriente l'utilisateur vers l'écran Bulletins pour voir le détail des blocages.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const year = await resolveCurrentAcademicYear(ctx);
        const settings = await getEffectiveSchoolSettings(ctx.schoolId);
        const school = await ctx.prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true } });
        const r = await deps.genererBulletins.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: period.id,
          academicYearId: year.id,
          template: settings.bulletinTemplate ?? 'FR_SECONDARY',
          nomEtablissement: school?.name ?? 'Établissement',
          demandeurId: ctx.userId,
        });
        return {
          resultLabel: `Bulletins générés pour ${classe.name} (${r.bulletinsGeneres} bulletin(s)), période ${period.name}`,
          section: 'bulletins',
          entity: 'reportCard',
        };
      },
      async undo() {
        throw new Error("La génération de bulletins ne peut pas être annulée depuis le copilot — utilisez l'écran Bulletins.");
      },
    },

    // 23. Envoyer les bulletins aux parents — NON destructif
    {
      name: 'envoyer_bulletins_parents',
      domain: 'notes_bulletins',
      description: "Envoie par email les bulletins déjà générés d'une classe aux parents, pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const school = await ctx.prisma.school.findUnique({
          where: { id: ctx.schoolId },
          select: { name: true, subsystem: true },
        });
        const langue = resolveLanguage(school?.subsystem);
        await deps.envoyerBulletins.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: period.id,
          nomEtablissement: school?.name ?? 'Établissement',
          nomPeriode: period.name,
          langue,
        });
        return {
          resultLabel: `Bulletins de ${classe.name} envoyés aux parents (période ${period.name})`,
          section: 'bulletins',
          entity: 'reportCard',
        };
      },
      async undo() {
        throw new Error("L'envoi de bulletins ne peut pas être annulé — les emails sont déjà partis.");
      },
    },

    // 24. Valider toutes les notes en attente d'une classe — NON destructif
    {
      name: 'valider_notes_en_masse',
      domain: 'notes_bulletins',
      description:
        "Valide en une fois toutes les notes au statut « Soumis » d'une classe, pour la séquence courante " +
        "(ou la matière si précisée). Équivalent au bouton « Valider tout » de l'écran Notes.",
      destructive: false,
      requiredPermission: 'VALIDATE_GRADES',
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const sequence = await resolveCurrentSequence(ctx);
        const r = await deps.verrouillerNotesEnMasse.execute({
          classId: classe.id,
          sequenceId: sequence.id,
          demandeurId: ctx.userId,
          schoolId: ctx.schoolId,
        });
        return {
          resultLabel: `${classe.name} (séquence ${sequence.name}) : ${r.message}`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error('La validation en masse de notes ne peut pas être annulée depuis le copilot.');
      },
    },

    // 25. Orienter vers l'import Excel de notes — LECTURE SEULE
    {
      name: 'guider_import_excel_notes',
      domain: 'notes_bulletins',
      description:
        "L'utilisateur veut importer des notes depuis un fichier Excel. Le copilot n'exécute PAS l'import " +
        "à l'aveugle (aucun fichier n'est fourni dans la conversation) — cette action navigue simplement " +
        "vers l'écran Notes où se trouve le bouton d'import.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute() {
        return {
          resultLabel: "Rendez-vous sur l'écran Notes — le bouton d'import Excel s'y trouve, un fichier est nécessaire.",
          section: 'grades',
        };
      },
      async undo() {
        throw new Error("Cette action est une simple navigation, il n'y a rien à annuler.");
      },
    },

    // 26. Moyenne d'une classe dans une matière — LECTURE SEULE
    {
      name: 'moyenne_classe_matiere',
      domain: 'notes_bulletins',
      description: "Donne la moyenne d'une classe dans une matière donnée, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const sequence = await resolveCurrentSequence(ctx);
        const grades = await ctx.prisma.grade.findMany({
          where: { classId: classe.id, subjectId: subject.id, sequenceId: sequence.id, sequenceAverage: { not: null } },
          select: { sequenceAverage: true, isAbsentGrade: true },
        });
        if (grades.length === 0) {
          return {
            resultLabel: `Aucune note de ${subject.name} enregistrée pour ${classe.name} (séquence ${sequence.name}).`,
            section: 'grades',
            entity: 'grade',
          };
        }
        const moyenne = calculateAverageScoreOn20(
          grades.map((g) => ({ scoreOn20: g.sequenceAverage ?? 0, percentage: 0, coefficient: 1, isAbsentGrade: g.isAbsentGrade })),
          false,
          true,
        );
        return {
          resultLabel: `Moyenne de ${classe.name} en ${subject.name} (séquence ${sequence.name}) : ${moyenne.toFixed(2)}/20 (${grades.length} note(s))`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    // 27. Élèves sous la moyenne dans une classe — LECTURE SEULE
    {
      name: 'compter_eleves_sous_moyenne',
      domain: 'notes_bulletins',
      description:
        "Compte combien d'élèves d'une classe ont une moyenne générale inférieure à 10/20, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const sequence = await resolveCurrentSequence(ctx);
        const moyennes = await calculerMoyennesClasseSequence(ctx, classe.id, sequence.id);
        const sousLaMoyenne = [...moyennes.values()].filter((m) => m < 10).length;
        return {
          resultLabel: `${classe.name} (séquence ${sequence.name}) : ${sousLaMoyenne}/${moyennes.size} élève(s) sous la moyenne générale (10/20)`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    // 28. Le conseil de classe d'une classe a-t-il déjà eu lieu ? — LECTURE SEULE
    {
      name: 'conseil_classe_tenu',
      domain: 'conseil_classe',
      description: "Indique si le conseil de classe d'une classe a déjà été tenu (et verrouillé) pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const session = await ctx.prisma.classCouncilSession.findFirst({
          where: { classId: classe.id, academicPeriodId: period.id },
          select: { status: true },
        });
        const resultLabel = !session
          ? `Aucun conseil de classe n'a été créé pour ${classe.name} (période ${period.name}).`
          : session.status === 'LOCKED'
            ? `Le conseil de classe de ${classe.name} a été tenu et verrouillé (période ${period.name}).`
            : `Un conseil de classe existe pour ${classe.name} mais n'est pas encore verrouillé (statut : ${session.status}).`;
        return { resultLabel, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    {
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
        const timetable = await ctx.prisma.timetable.findFirst({
          where: { classId: classe.id, academicYearId: annee.id, schoolId: ctx.schoolId },
          select: { id: true, status: true, _count: { select: { slots: true } } },
        });
        if (!timetable) throw new Error(`Aucun emploi du temps n'existe pour ${classe.name} sur l'année courante.`);
        if (timetable.status === 'PUBLISHED') throw new Error("Impossible de vider un emploi du temps publié.");
        return `Supprimer les ${timetable._count.slots} créneaux de ${classe.name} ? Cette action est irréversible depuis l'assistant.`;
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const annee = await resolveCurrentAcademicYear(ctx);
        const timetable = await ctx.prisma.timetable.findFirst({
          where: { classId: classe.id, academicYearId: annee.id, schoolId: ctx.schoolId },
          select: { id: true },
        });
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
    },

    {
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
        const current = await ctx.prisma.teachingAssignment.findFirst({ where: { classId: classe.id, subjectId: matiere.id, schoolId: ctx.schoolId }, select: { teacher: { select: { firstName: true, lastName: true } } } });
        return `Réaffecter ${matiere.name} de ${classe.name} à ${teacher.name} ? Actuellement : ${current?.teacher ? `${current.teacher.firstName} ${current.teacher.lastName}` : 'aucun enseignant'}.`;
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const matiere = await resolveSubject(ctx, input.subjectName);
        const teacher = await resolveTeacher(ctx, input.teacherName);
        const current = await ctx.prisma.teachingAssignment.findFirst({ where: { classId: classe.id, subjectId: matiere.id, schoolId: ctx.schoolId }, select: { id: true, teacher: { select: { firstName: true, lastName: true } } } });
        if (!current) throw new Error(`Aucune affectation de ${matiere.name} pour ${classe.name}.`);
        const teacherProfile = await ctx.prisma.teacherProfile.findFirst({ where: { userId: teacher.id, user: { schoolId: ctx.schoolId, role: 'TEACHER', isActive: true }, teacherSubjects: { some: { subjectId: matiere.id } } }, select: { id: true } });
        if (!teacherProfile) throw new Error(`${teacher.name} n'est pas qualifié pour ${matiere.name}.`);
        await ctx.prisma.teachingAssignment.update({ where: { id: current.id }, data: { teacherId: teacher.id } });
        return { resultLabel: `${matiere.name} de ${classe.name} réaffecté à ${teacher.name}.`, section: 'affectations', entity: 'teachingAssignment' };
      },
      async undo() {
        throw new Error("La réaffectation d'un enseignant n'est pas annulable depuis l'assistant.");
      },
    },

    {
      name: 'annuler_affectations_classe',
      domain: 'affectations',
      description: "Annule toutes les affectations d'une classe après confirmation explicite.",
      destructive: true,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({ className: z.string().min(1) }),
      async summarizeDestructive(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const count = await ctx.prisma.teachingAssignment.count({ where: { classId: classe.id, schoolId: ctx.schoolId } });
        return `Annuler les ${count} affectation(s) de ${classe.name} ? Cette action est irréversible.`;
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const result = await ctx.prisma.teachingAssignment.deleteMany({ where: { classId: classe.id, schoolId: ctx.schoolId } });
        if (result.count === 0) throw new Error(`Aucune affectation à annuler pour ${classe.name}.`);
        return { resultLabel: `${result.count} affectation(s) annulée(s) pour ${classe.name}.`, section: 'affectations', entity: 'teachingAssignment' };
      },
      async undo() {
        throw new Error("L'annulation groupée des affectations n'est pas annulable depuis l'assistant.");
      },
    },

    {
      name: 'annuler_toutes_affectations',
      domain: 'affectations',
      description: "Annule toutes les affectations de l'établissement pour l'année scolaire courante après confirmation explicite.",
      destructive: true,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({}),
      async summarizeDestructive(_input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx);
        const count = await ctx.prisma.teachingAssignment.count({ where: { schoolId: ctx.schoolId, academicYearId: annee.id } });
        return `Annuler les ${count} affectation(s) de l'établissement pour ${annee.name} ? Cette action est irréversible.`;
      },
      async execute(_input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx);
        const result = await ctx.prisma.teachingAssignment.deleteMany({ where: { schoolId: ctx.schoolId, academicYearId: annee.id } });
        if (result.count === 0) throw new Error('Aucune affectation à annuler pour cette année scolaire.');
        return { resultLabel: `${result.count} affectation(s) annulée(s) pour ${annee.name}.`, section: 'affectations', entity: 'teachingAssignment' };
      },
      async undo() {
        throw new Error("L'annulation groupée des affectations n'est pas annulable depuis l'assistant.");
      },
    },

    {
      name: 'lister_issues_affectations',
      domain: 'affectations',
      description: "Liste les signalements persistants d'affectation non résolus, éventuellement filtrés par classe et statut, sans modifier les données.",
      destructive: false,
      requiredPermission: 'MANAGE_TEACHING_ASSIGNMENTS',
      inputSchema: z.object({ className: z.string().optional(), status: z.enum(['OPEN', 'RESOLVED']).optional() }),
      async execute(input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx);
        const classe = input.className ? await resolveClass(ctx, input.className) : null;
        const issues = await ctx.prisma.teachingAssignmentIssue.findMany({
          where: {
            schoolId: ctx.schoolId,
            academicYearId: annee.id,
            ...(classe && { classId: classe.id }),
            ...(input.status && { status: input.status }),
          },
          orderBy: { detectedAt: 'desc' },
          select: { classId: true, subjectId: true, reason: true, status: true, detectedAt: true },
        });
        const classIds = [...new Set(issues.map(issue => issue.classId))];
        const subjectIds = [...new Set(issues.map(issue => issue.subjectId))];
        const [classes, subjects] = await Promise.all([
          ctx.prisma.class.findMany({ where: { id: { in: classIds }, schoolId: ctx.schoolId }, select: { id: true, name: true } }),
          ctx.prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId: ctx.schoolId }, select: { id: true, name: true } }),
        ]);
        const classNames = new Map(classes.map(item => [item.id, item.name]));
        const subjectNames = new Map(subjects.map(item => [item.id, item.name]));
        const lines = issues.map(issue => `${classNames.get(issue.classId) ?? 'Classe inconnue'} — ${subjectNames.get(issue.subjectId) ?? 'Matière inconnue'} : ${issue.reason} (${issue.status})`);
        return { resultLabel: lines.length > 0 ? lines.join('\n') : 'Aucun signalement d’affectation correspondant.', section: 'affectations', entity: 'teachingAssignmentIssue' };
      },
      async undo() {
        throw new Error('La consultation des signalements ne modifie aucune donnée.');
      },
    },

    {
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
        const grid = await ctx.prisma.timetableGridConfig.findUnique({ where: { schoolId: ctx.schoolId } });
        if (!grid) throw new Error("La grille horaire n'est pas configurée.");
        const [affectations, indisponibilites, occupation, allOccupation, teachers] = await Promise.all([
          ctx.prisma.teachingAssignment.findMany({ where: { classId: classe.id, schoolId: ctx.schoolId, academicYearId: annee.id }, select: { subject: { select: { id: true, name: true, hoursPerWeek: true } }, teacher: { select: { id: true, firstName: true, lastName: true, staffProfile: { select: { permissions: { select: { permission: true } } } } } } } }),
          ctx.prisma.teacherUnavailability.findMany({ where: { schoolId: ctx.schoolId, active: true }, select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true } }),
          ctx.prisma.timetableSlot.findMany({ where: { kind: 'CLASS', timetable: { schoolId: ctx.schoolId, academicYearId: annee.id, NOT: { classId: classe.id } } }, select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true, timetable: { select: { class: { select: { name: true } } } } } }),
          ctx.prisma.timetableSlot.findMany({ where: { kind: 'CLASS', timetable: { schoolId: ctx.schoolId, academicYearId: annee.id } }, select: { teacherId: true, startTime: true, endTime: true } }),
          ctx.prisma.user.findMany({ where: { schoolId: ctx.schoolId, role: 'TEACHER', isActive: true }, select: { id: true, firstName: true, lastName: true, staffProfile: { select: { permissions: { select: { permission: true } } } }, teacherProfile: { select: { teacherSubjects: { select: { subjectId: true } } } } } }),
        ]);
        const dayMap: Record<string, number> = { LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5 };
        const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
        const heuresReellesParEnseignant = new Map<string, number>();
        for (const slot of allOccupation) {
          if (!slot.teacherId) continue;
          heuresReellesParEnseignant.set(
            slot.teacherId,
            (heuresReellesParEnseignant.get(slot.teacherId) ?? 0) + (minutes(slot.endTime) - minutes(slot.startTime)) / 60,
          );
        }
        const isAP = (teacher: { staffProfile?: { permissions: { permission: string }[] } | null }) =>
          teacher.staffProfile?.permissions.some(permission => ['SUPERVISE_TEACHERS', 'SUPERVISE_DEPARTMENT_TEACHERS'].includes(permission.permission)) ?? false;
        const cases = grid.joursActifs.flatMap(jour => {
          const day = dayMap[jour];
          if (day === undefined) return [];
          const count = grid.periodesCoursParJour?.[jour] ?? grid.periodesAvantP1 + grid.periodesAvantP2 + grid.periodesApresP2;
          let cursor = minutes(grid.heureDebut);
          const periods: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
          const addPeriods = (numberOfPeriods: number) => {
            for (let index = 0; index < numberOfPeriods; index++) {
              const start = cursor;
              cursor += grid.dureePeriode;
              periods.push({ dayOfWeek: day, startTime: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`, endTime: `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}` });
            }
          };
          addPeriods(grid.periodesAvantP1);
          cursor += grid.dureePetitePause;
          addPeriods(grid.periodesAvantP2);
          cursor += grid.dureeGrandePause;
          addPeriods(grid.periodesApresP2);
          return periods.slice(0, count);
        });
        const load = new Map<string, { name: string; requested: number; actualHours: number; ap: boolean; free: number; occupied: string[] }>();
        for (const affectation of affectations) {
          const ap = isAP(affectation.teacher);
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
        for (const entry of load.values()) {
          const teacherId = affectations.find(a => `${a.teacher.firstName} ${a.teacher.lastName}` === entry.name)?.teacher.id;
          if (!teacherId) continue;
          entry.free = cases.filter(candidate => ![...occupation.filter(slot => slot.teacherId === teacherId), ...indisponibilites.filter(slot => slot.teacherId === teacherId)].some(slot => slot.dayOfWeek === candidate.dayOfWeek && minutes(slot.startTime) < minutes(candidate.endTime || '23:59') && minutes(slot.endTime || '24:00') > minutes(candidate.startTime || '00:00'))).length;
          entry.occupied = occupation.filter(slot => slot.teacherId === teacherId).map(slot => `${slot.timetable.class.name} ${slot.startTime}-${slot.endTime}`);
        }
        const alternatives = new Map<string, string[]>();
        for (const affectation of affectations) {
          const candidates = teachers.filter(teacher => teacher.id !== affectation.teacher.id && teacher.teacherProfile?.teacherSubjects.some(subject => subject.subjectId === affectation.subject.id));
          alternatives.set(affectation.subject.name, candidates.map(candidate => {
            const heures = heuresReellesParEnseignant.get(candidate.id) ?? 0;
            const ap = isAP(candidate) ? ', AP' : '';
            return `${candidate.firstName} ${candidate.lastName} (${heures}h EDT${ap})`;
          }));
        }
        const lines = affectations.map(affectation => {
          const teacherName = `${affectation.teacher.firstName} ${affectation.teacher.lastName}`;
          const entry = load.get(affectation.teacher.id)!;
          const alternate = alternatives.get(affectation.subject.name)?.join(', ') || 'aucun enseignant qualifié disponible';
          const occupations = entry.free < entry.requested ? ` Occupée(s) dans : ${entry.occupied.slice(0, 6).join(', ')}.` : '';
          const cap = entry.ap ? ` Statut AP : ${entry.actualHours}h actuellement, maximum 14h${entry.actualHours > 14 ? ' — DÉPASSEMENT' : ''}.` : '';
          return `${affectation.subject.name} : ${affectation.subject.hoursPerWeek}h demandées à ${teacherName}; ${entry.free} créneaux libres; alternative(s) : ${alternate}.${cap}${occupations}`;
        });
        return { resultLabel: `Diagnostic ${classe.name} :\n${lines.join('\n')}`, section: 'timetable', entity: 'timetable' };
      },
      async undo() {
        throw new Error("Le diagnostic d'emploi du temps ne modifie aucune donnée.");
      },
    },

    {
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
        const timetable = await ctx.prisma.timetable.findFirst({
          where: { classId: classe.id, academicYearId: year.id, schoolId: ctx.schoolId },
          select: { id: true, status: true },
        });
        if (!timetable) throw new Error(`Aucun emploi du temps n'existe pour ${classe.name} sur l'année courante.`);
        if (timetable.status === 'PUBLISHED') {
          return { resultLabel: `L'emploi du temps de ${classe.name} est déjà publié.`, section: 'timetable', entity: 'timetable' };
        }
        await deps.publierEDT.execute({ timetableId: timetable.id, schoolId: ctx.schoolId, demandeurId: ctx.userId, demandeurRole: ctx.role });
        return {
          resultLabel: `Emploi du temps de ${classe.name} publié`,
          undoData: { timetableId: timetable.id },
          section: 'timetable',
          entity: 'timetable',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.rouvrirEDT.execute({ timetableId: String(undoData.timetableId), schoolId: ctx.schoolId, demandeurId: ctx.userId, demandeurRole: ctx.role });
      },
    },

    // 30. Ouvrir un conseil de classe — NON destructif
    {
      name: 'ouvrir_conseil_classe',
      domain: 'conseil_classe',
      description:
        "Ouvre une session de Conseil de Classe pour une classe, sur la période courante. Bloque si des notes " +
        "ne sont pas encore validées (Loi MINESEC). N'ajoute PAS les décisions individuelles ni ne verrouille " +
        "la session — cela reste à faire depuis l'écran Conseil de Classe.",
      destructive: false,
      requiredPermission: 'VALIDATE_GRADES',
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const r = await deps.ouvrirConseilClasse.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: period.id,
          presidedById: ctx.userId,
        });
        return { resultLabel: r.message, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error(
          "L'ouverture d'un conseil de classe ne peut pas être annulée depuis le copilot — utilisez l'écran Conseil de Classe.",
        );
      },
    },

    // 31. Classes sans emploi du temps publié — LECTURE SEULE
    {
      name: 'classes_sans_edt_publie',
      domain: 'classes',
      description: "Liste les classes qui n'ont pas encore d'emploi du temps publié, pour l'année scolaire courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const classes = await ctx.prisma.class.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true, name: true } });
        const timetables = await ctx.prisma.timetable.findMany({
          where: { schoolId: ctx.schoolId, academicYearId: year.id, status: 'PUBLISHED' },
          select: { classId: true },
        });
        const publishedIds = new Set(timetables.map((t) => t.classId));
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
    },

    // 32. Classes sans conseil de classe verrouillé — LECTURE SEULE
    {
      name: 'classes_sans_conseil_tenu',
      domain: 'conseil_classe',
      description: "Liste les classes qui n'ont pas encore tenu (ni verrouillé) leur conseil de classe pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const period = await resolveCurrentPeriod(ctx);
        const classes = await ctx.prisma.class.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true, name: true } });
        const sessions = await ctx.prisma.classCouncilSession.findMany({
          where: { schoolId: ctx.schoolId, academicPeriodId: period.id, status: 'LOCKED' },
          select: { classId: true },
        });
        const lockedIds = new Set(sessions.map((s: any) => s.classId));
        const sansConseil = classes.filter((c) => !lockedIds.has(c.id));
        const resultLabel =
          sansConseil.length === 0
            ? 'Toutes les classes ont tenu et verrouillé leur conseil de classe.'
            : `${sansConseil.length} classe(s) sans conseil de classe verrouillé : ${sansConseil.map((c) => c.name).join(', ')}`;
        return { resultLabel, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    // 33. Définir la période académique courante — NON destructif (réversible)
    {
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
        const period = await ctx.prisma.academicPeriod.findFirst({
          where: { academicYearId: year.id, name: { equals: input.periodName, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
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
        const previousId = undoData.previousPeriodId as string | null;
        if (previousId) await deps.definirPeriodeCourante.definirPeriode(previousId, ctx.schoolId);
      },
    },

    // 34. Vérifier si l'année scolaire peut être clôturée — LECTURE SEULE
    {
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
    },

    // 46. Évolution de la moyenne générale — LECTURE SEULE
    {
      name: 'evolution_moyenne_generale',
      domain: 'notes_bulletins',
      description:
        "Affiche l'évolution de la moyenne générale sur les séquences déjà passées de l'année scolaire courante, pour toute l'école ou une classe précise.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().optional() }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        let classId: string | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          classId = classe.id;
          label = classe.name;
        }
        const grades = await ctx.prisma.grade.findMany({
          where: {
            schoolId: ctx.schoolId,
            academicYearId: year.id,
            validationStatus: { in: ['LOCKED'] },
            sequenceAverage: { not: null },
            ...(classId ? { classId } : {}),
          },
          select: {
            sequenceAverage: true,
            sequence: { select: { id: true, name: true, orderIndex: true } },
          },
        });
        const parSequence = new Map<string, { name: string; orderIndex: number; valeurs: number[] }>();
        for (const g of grades) {
          const cur = parSequence.get(g.sequence.id) ?? {
            name: g.sequence.name,
            orderIndex: g.sequence.orderIndex,
            valeurs: [],
          };
          cur.valeurs.push(g.sequenceAverage as number);
          parSequence.set(g.sequence.id, cur);
        }
        const sequences = [...parSequence.values()].sort((a, b) => a.orderIndex - b.orderIndex);
        if (sequences.length === 0) {
          return {
            resultLabel: `Aucune note validée pour ${label} sur l'année ${year.name}.`,
            section: 'statistics',
            entity: 'grade',
          };
        }
        const resultLabel =
          `Évolution de la moyenne générale pour ${label} (${year.name}) : ` +
          sequences
            .map((s) => `${s.name} : ${Math.round((s.valeurs.reduce((a, b) => a + b, 0) / s.valeurs.length) * 100) / 100}/20`)
            .join(', ');
        return { resultLabel, section: 'statistics', entity: 'grade' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },

    // 47. Classement des classes par moyenne générale — LECTURE SEULE
    {
      name: 'classement_classes',
      domain: 'notes_bulletins',
      description:
        "Classe les classes de l'établissement par moyenne générale (notes validées, année scolaire courante), du meilleur au moins bon résultat.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ level: z.string().optional().describe('Limiter au niveau, ex. "4e"') }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const classes = await ctx.prisma.class.findMany({
          where: { schoolId: ctx.schoolId, ...(input.level ? { level: input.level } : {}) },
          select: { id: true, name: true },
        });
        if (classes.length === 0)
          throw new Error(input.level ? `Aucune classe de niveau « ${input.level} ».` : 'Aucune classe dans cet établissement.');
        const grades = await ctx.prisma.grade.findMany({
          where: {
            schoolId: ctx.schoolId,
            academicYearId: year.id,
            classId: { in: classes.map((c) => c.id) },
            validationStatus: { in: ['LOCKED'] },
            sequenceAverage: { not: null },
          },
          select: { classId: true, sequenceAverage: true },
        });
        const parClasse = new Map<string, number[]>();
        for (const g of grades) {
          const cur = parClasse.get(g.classId) ?? [];
          cur.push(g.sequenceAverage as number);
          parClasse.set(g.classId, cur);
        }
        const classement = classes
          .map((c) => {
            const valeurs = parClasse.get(c.id) ?? [];
            const moyenne =
              valeurs.length > 0
                ? Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 100) / 100
                : null;
            return { name: c.name, moyenne };
          })
          .filter((c) => c.moyenne !== null)
          .sort((a, b) => (b.moyenne as number) - (a.moyenne as number));
        if (classement.length === 0) {
          return {
            resultLabel: 'Aucune note validée disponible pour établir un classement.',
            section: 'statistics',
            entity: 'grade',
          };
        }
        const resultLabel =
          `Classement par moyenne générale : ` +
          classement.map((c, i) => `${i + 1}. ${c.name} (${c.moyenne}/20)`).join(', ');
        return { resultLabel, section: 'statistics', entity: 'grade' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },
  ];
}
