/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle STUDENT.
 *
 * Périmètre du plan (Section 6.2) : « consultation uniquement, pas d'actions ». Toutes
 * les entrées ci-dessous sont des QUERY en lecture seule, strictement scopées aux
 * données du connecté (`ctx.userId` EST l'élève — jamais de recherche par nom parmi
 * d'autres élèves, contrairement aux catalogues Admin/Staff/Teacher). Aucune dépendance
 * externe n'est nécessaire (aucun use case n'est invoqué, uniquement des lectures Prisma
 * directes déjà scopées par construction), d'où l'absence de `Deps` en paramètre.
 */
import { z } from 'zod';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import {
  type ActionDefinition,
  defineAction,
  resolveCurrentSequence,
} from '@infrastructure/assistant/catalog/catalogShared';
import type { GetMetricUseCase } from '@application/reporting/GetMetricUseCase';

export function buildStudentActionCatalog(getMetric?: GetMetricUseCase): ActionDefinition[] {
  return [
    // 1. Mes notes récentes — LECTURE SEULE
    defineAction({
      name: 'mes_notes',
      description: 'Donne vos notes les plus récentes, toutes matières confondues.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({ subjectName: z.string().optional().describe('Limiter à une matière précise') }),
      async execute(input, ctx) {
        const grades = await ctx.data.portal.findRecentStudentGrades({
          schoolId: ctx.schoolId,
          studentId: ctx.userId,
          subjectNameContains: input.subjectName ?? undefined,
          take: 10,
        });
        const resultLabel = grades.length === 0
          ? "Aucune note disponible pour le moment."
          : `Vos notes récentes : ` + grades.map((g) => `${g.subjectName} (${g.sequenceName}) : ${g.sequenceAverage}/20`).join(', ');
        return { resultLabel, section: 'grades' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // 2. Ma moyenne de la séquence courante — LECTURE SEULE
    defineAction({
      name: 'ma_moyenne_sequence',
      description: 'Donne votre moyenne générale pour la séquence courante.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const sequence = await resolveCurrentSequence(ctx);
        const grades = await ctx.data.portal.findStudentSequenceGrades(ctx.schoolId, ctx.userId, sequence.id);
        if (grades.length === 0) {
          return { resultLabel: `Aucune note calculée pour la séquence ${sequence.name} pour le moment.`, section: 'grades' };
        }
        const moyenne =
          grades.length > 0
            ? calculateAverageScoreOn20(
                grades.map((g) => ({
                  scoreOn20: g.sequenceAverage,
                  percentage: g.sequenceAverage * 5,
                  coefficient: g.coefficient,
                  isAbsentGrade: g.isAbsentGrade,
                })),
                true,
                true,
              )
            : null;
        return {
          resultLabel: moyenne !== null
            ? `Votre moyenne pour la séquence ${sequence.name} : ${moyenne}/20 (${grades.length} matière(s) notée(s)).`
            : `Aucune moyenne calculable pour la séquence ${sequence.name} pour le moment.`,
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // 3. Ma présence — LECTURE SEULE
    defineAction({
      name: 'ma_presence',
      description: 'Donne votre taux de présence depuis une date donnée (ce mois-ci par défaut).',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({ depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut') }),
      async execute(input, ctx) {
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        // Si getMetric disponible (moteur v1), l'utiliser ; sinon fallback direct
        if (getMetric) {
          const count = await ctx.data.portal.countAttendancesSince({
            schoolId: ctx.schoolId,
            studentId: ctx.userId,
            since: depuis,
          });
          if (count === 0) {
            return { resultLabel: `Aucun enregistrement de présence depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
          }
          const res = await getMetric.execute({
            key: 'taux_presence',
            dimensions: { schoolId: ctx.schoolId, studentId: ctx.userId, dateRange: { from: depuis.toISOString(), to: now.toISOString() } },
          });
          const absences = await ctx.data.portal.countAttendancesSince({
            schoolId: ctx.schoolId,
            studentId: ctx.userId,
            since: depuis,
            statuses: ['ABSENT', 'ABSENT_JUSTIFIED'],
          });
          return {
            resultLabel: `Votre taux de présence depuis le ${depuis.toLocaleDateString('fr-FR')} : ${res.value}% (${absences} absence(s) sur ${count} enregistrement(s)).`,
            section: 'attendance',
          };
        }
        const records = await ctx.data.portal.findAttendanceStatusesSince({
          schoolId: ctx.schoolId,
          studentId: ctx.userId,
          since: depuis,
        });
        if (records.length === 0) {
          return { resultLabel: `Aucun enregistrement de présence depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
        }
        const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const absences = records.filter((r) => r.status === 'ABSENT' || r.status === 'ABSENT_JUSTIFIED').length;
        const taux = Math.round((present / records.length) * 10000) / 100;
        return {
          resultLabel: `Votre taux de présence depuis le ${depuis.toLocaleDateString('fr-FR')} : ${taux}% (${absences} absence(s) sur ${records.length} enregistrement(s)).`,
          section: 'attendance',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // 4. Mes livres empruntés — LECTURE SEULE
    defineAction({
      name: 'mes_livres_empruntes',
      description: 'Liste les livres que vous avez actuellement empruntés à la bibliothèque, avec leur date de retour.',
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['STUDENT'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const emprunts = await ctx.data.portal.findActiveStudentBookLoans({
          schoolId: ctx.schoolId,
          studentId: ctx.userId,
        });
        const resultLabel = emprunts.length === 0
          ? "Vous n'avez aucun livre emprunté actuellement."
          : `Vos emprunts : ` + emprunts.map((e) => `« ${e.bookTitle} »${e.dueDate ? ` (retour prévu le ${e.dueDate.toLocaleDateString('fr-FR')})` : ''}${e.status === 'OVERDUE' ? ' — EN RETARD' : ''}`).join(', ');
        return { resultLabel, section: 'library' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),
  ];
}
