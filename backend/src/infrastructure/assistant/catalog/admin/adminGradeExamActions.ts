import { z } from 'zod';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';
import { getEffectiveSchoolSettings } from '@infrastructure/services/school-settings/SchoolSettingsService';
import {
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveSubject,
  resolveCurrentAcademicYear,
  resolveCurrentPeriod,
  resolveCurrentSequence,
  calculerMoyennesClasseSequence,
} from '../catalogShared';
import type { AdminActionDeps } from '../adminActionCatalog';

export function buildAdminGradeExamActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 22. Générer les bulletins d'une classe — NON destructif
    defineAction({
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
        const school = await ctx.data.adminAcademic.findSchoolInfo(ctx.schoolId);
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
    }),

    // 23. Envoyer les bulletins aux parents — NON destructif
    defineAction({
      name: 'envoyer_bulletins_parents',
      domain: 'notes_bulletins',
      description: "Envoie par email les bulletins déjà générés d'une classe aux parents, pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const school = await ctx.data.adminAcademic.findSchoolInfo(ctx.schoolId);
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
    }),

    // 24. Valider toutes les notes en attente d'une classe — NON destructif
    defineAction({
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
    }),

    // 25. Orienter vers l'import Excel de notes — LECTURE SEULE
    defineAction({
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
    }),

    // 26. Moyenne d'une classe dans une matière — LECTURE SEULE
    defineAction({
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
        const grades = await ctx.data.adminAcademic.findSubjectSequenceGrades(
          ctx.schoolId,
          classe.id,
          subject.id,
          sequence.id,
        );
        if (grades.length === 0) {
          return {
            resultLabel: `Aucune note de ${subject.name} enregistrée pour ${classe.name} (séquence ${sequence.name}).`,
            section: 'grades',
            entity: 'grade',
          };
        }
        const moyenne = calculateAverageScoreOn20(
          grades.map((g) => ({
            scoreOn20: g.sequenceAverage ?? 0,
            percentage: 0,
            coefficient: 1,
            isAbsentGrade: g.isAbsentGrade,
          })),
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
    }),

    // 27. Élèves sous la moyenne dans une classe — LECTURE SEULE
    defineAction({
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
    }),

    // 28. Le conseil de classe d'une classe a-t-il déjà eu lieu ? — LECTURE SEULE
    defineAction({
      name: 'conseil_classe_tenu',
      domain: 'conseil_classe',
      description: "Indique si le conseil de classe d'une classe a déjà été tenu (et verrouillé) pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const period = await resolveCurrentPeriod(ctx);
        const session = await ctx.data.adminAcademic.findClassCouncilSessionStatus(ctx.schoolId, classe.id, period.id);
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
    }),

    // 30. Ouvrir un conseil de classe — NON destructif
    defineAction({
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
    }),

    // 32. Classes sans conseil de classe verrouillé — LECTURE SEULE
    defineAction({
      name: 'classes_sans_conseil_tenu',
      domain: 'conseil_classe',
      description: "Liste les classes qui n'ont pas encore tenu (ni verrouillé) leur conseil de classe pour la période courante.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const period = await resolveCurrentPeriod(ctx);
        const [periodData, classes, lockedClassIds] = await Promise.all([
          ctx.data.adminAcademic.findAcademicPeriodEndDate(ctx.schoolId, period.id),
          ctx.data.shared.findClassesBySchool(ctx.schoolId),
          ctx.data.adminAcademic.findLockedCouncilClassIds(ctx.schoolId, period.id),
        ]);
        const lockedIds = new Set(lockedClassIds);
        const sansConseil = classes.filter((c) => !lockedIds.has(c.id));

        const now = Date.now();
        const finPeriode = periodData?.endDate ? new Date(periodData.endDate).getTime() : NaN;
        const estFinDePeriode = !isNaN(finPeriode) && now >= (finPeriode - 10 * 24 * 3600 * 1000);

        let resultLabel: string;
        if (!estFinDePeriode && periodData?.endDate) {
          resultLabel = `La période « ${period.name} » est actuellement en cours d’enseignement et d’évaluations séquentielles. Les délibérations de conseil de classe se tiendront en fin de trimestre (vers le ${new Date(periodData.endDate).toLocaleDateString('fr-FR')}).`;
        } else if (sansConseil.length === 0) {
          resultLabel = 'Toutes les classes ont tenu et verrouillé leur conseil de classe.';
        } else {
          resultLabel = `${sansConseil.length} classe(s) sans conseil de classe verrouillé : ${sansConseil.map((c) => c.name).join(', ')}`;
        }
        return { resultLabel, section: 'council', entity: 'classCouncilSession' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 46. Évolution de la moyenne générale — LECTURE SEULE
    defineAction({
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
        const grades = await ctx.data.adminAcademic.findLockedYearGradesBySequence(ctx.schoolId, year.id, classId);
        const parSequence = new Map<string, { name: string; orderIndex: number; valeurs: number[] }>();
        for (const g of grades) {
          if (g.sequenceAverage === null) continue;
          const cur = parSequence.get(g.sequence.id) ?? {
            name: g.sequence.name,
            orderIndex: g.sequence.orderIndex,
            valeurs: [],
          };
          cur.valeurs.push(g.sequenceAverage);
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
    }),

    // 47. Classement des classes par moyenne générale — LECTURE SEULE
    defineAction({
      name: 'classement_classes',
      domain: 'notes_bulletins',
      description:
        "Classe les classes de l'établissement par moyenne générale (notes validées, année scolaire courante), du meilleur au moins bon résultat.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ level: z.string().optional().describe('Limiter au niveau, ex. "4e"') }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const classes = await ctx.data.adminAcademic.findClassesByLevel(ctx.schoolId, input.level);
        if (classes.length === 0) {
          throw new Error(input.level ? `Aucune classe de niveau « ${input.level} ».` : 'Aucune classe dans cet établissement.');
        }
        const grades = await ctx.data.adminAcademic.findLockedClassGradesForYear(
          ctx.schoolId,
          year.id,
          classes.map((c) => c.id),
        );
        const parClasse = new Map<string, number[]>();
        for (const g of grades) {
          if (g.sequenceAverage === null) continue;
          const cur = parClasse.get(g.classId) ?? [];
          cur.push(g.sequenceAverage);
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
          .filter((c): c is { name: string; moyenne: number } => c.moyenne !== null)
          .sort((a, b) => b.moyenne - a.moyenne);
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
    }),
  ];
}
