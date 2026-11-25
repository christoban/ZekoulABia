/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle TEACHER.
 *
 * Même principe que `adminActionCatalog.ts` (voir ce fichier pour le contexte complet du
 * chantier) : chaque entrée mappe UNE intention en langage naturel vers UN use case déjà
 * existant, jamais de réimplémentation de logique métier. Périmètre resserré à ce qu'un
 * enseignant fait au quotidien (Section 6.2 du plan) : Notes, Présences, Cahier de texte,
 * demande de rattrapage — pas de gestion de programme/bulletins/emploi du temps (formulaires
 * structurés, hors chat, même logique que le catalogue Admin).
 *
 * Chaque action porte `allowedRoles: ['TEACHER']` — visible UNIQUEMENT à ce rôle, y compris
 * pas à l'ADMIN (ces actions sont scopées à « mes classes / mes notes », sans sens hors du
 * contexte personnel d'un enseignant connecté — voir catalogShared.ts pour le mécanisme).
 */
import { z } from 'zod';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import type { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import type { VerrouillerNotesEnMasseUseCase } from '@application/grade/VerrouillerNotesEnMasseUseCase';
import type { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import type { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import {
  type ActionContext,
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveSubject,
  resolveStudent,
  resolveCurrentAcademicYear,
  resolveCurrentPeriod,
  resolveCurrentSequence,
} from '@infrastructure/assistant/catalog/catalogShared';

import type { GetMetricUseCase } from '@application/reporting/GetMetricUseCase';

export interface TeacherActionDeps {
  saisirNote: SaisirNoteUseCase;
  verrouillerNotesEnMasse: VerrouillerNotesEnMasseUseCase;
  enregistrerPresence: EnregistrerPresenceUseCase;
  demanderRattrapage: DemanderRattrapageUseCase;
  getMetric?: GetMetricUseCase;
}

async function verifierAssignation(ctx: ActionContext, classId: string, subjectId: string, classeName: string, subjectName: string): Promise<void> {
  const assigned = await ctx.data.portal.hasTeacherAssignment({
    schoolId: ctx.schoolId,
    teacherId: ctx.userId,
    classId,
    subjectId,
  });
  if (!assigned) throw new Error(`Vous n'êtes pas assigné à l'enseignement de ${subjectName} pour ${classeName}.`);
}

export function buildTeacherActionCatalog(deps: TeacherActionDeps): ActionDefinition[] {
  return [
    // ═══ Notes ═══

    // 1. Saisir la note d'un élève — NON destructif (réversible tant que la note reste en brouillon)
    defineAction({
      name: 'saisir_note',
      description: "Saisit la note d'un élève dans une matière que vous enseignez, pour la séquence courante. La note est enregistrée en brouillon — elle doit ensuite être soumise pour validation.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().min(1).describe("Classe de l'élève"),
        subjectName: z.string().min(1),
        score: z.number().min(0).describe('Note obtenue'),
        maxValue: z.number().optional().describe('Note maximale — 20 par défaut'),
        coefficient: z.number().optional(),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const year = await resolveCurrentAcademicYear(ctx);
        const sequence = await resolveCurrentSequence(ctx);
        const r = await deps.saisirNote.execute({
          schoolId: ctx.schoolId,
          studentId: student.id,
          subjectId: subject.id,
          classId: classe.id,
          academicYearId: year.id,
          sequenceId: sequence.id,
          recordedById: ctx.userId,
          sequenceScore: input.score,
          maxValue: input.maxValue,
          coefficient: input.coefficient,
        });
        return {
          resultLabel: `Note de ${input.score}${input.maxValue ? `/${input.maxValue}` : ''} saisie pour ${student.name} en ${subject.name} (${sequence.name})`,
          undoData: { noteId: r.noteId },
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.data.portal.deleteGradeById(ctx.schoolId, String(undoData.noteId));
      },
    }),

    // 2. Verrouiller mes notes d'une classe/matière — NON annulable
    defineAction({
      name: 'verrouiller_mes_notes_classe',
      description: "Verrouille toutes vos notes en brouillon d'une classe et d'une matière que vous enseignez, pour la séquence courante. Cette action est irréversible.",
      destructive: true,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const sequence = await resolveCurrentSequence(ctx);
        const r = await deps.verrouillerNotesEnMasse.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          sequenceId: sequence.id,
          demandeurId: ctx.userId,
        });
        return {
          resultLabel: `${r.notesVerrouillees} note(s) verrouillée(s) — ${classe.name}, ${subject.name} (${sequence.name})`,
          section: 'grades',
          entity: 'grade',
        };
      },
      async undo() {
        throw new Error('Le verrouillage de notes ne peut pas être annulé depuis le copilot — utilisez l\'écran Notes.');
      },
    }),

    // 3. Mes notes en attente — LECTURE SEULE
    defineAction({
      name: 'mes_notes_en_attente',
      description: "Indique où vous en êtes dans la saisie des notes d'une classe et d'une matière que vous enseignez, pour la séquence courante (combien saisies, combien encore en brouillon).",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        const sequence = await resolveCurrentSequence(ctx);
        const { totalStudents, draftCount, recordedCount } = await ctx.data.portal.getTeacherGradeEntryProgress({
          schoolId: ctx.schoolId,
          teacherId: ctx.userId,
          classId: classe.id,
          subjectId: subject.id,
          sequenceId: sequence.id,
        });
        return {
          resultLabel: `${classe.name}, ${subject.name} (${sequence.name}) : ${recordedCount}/${totalStudents} élève(s) noté(s), dont ${draftCount} en brouillon (non soumis).`,
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // 4. Moyenne de ma classe dans ma matière — LECTURE SEULE
    defineAction({
      name: 'moyenne_ma_classe_matiere',
      description: "Donne la moyenne de classe dans une matière que vous enseignez, pour la séquence courante.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1), subjectName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        await verifierAssignation(ctx, classe.id, subject.id, classe.name, subject.name);
        const sequence = await resolveCurrentSequence(ctx);
        const grades = await ctx.data.portal.findClassSubjectSequenceGrades({
          schoolId: ctx.schoolId,
          classId: classe.id,
          subjectId: subject.id,
          sequenceId: sequence.id,
        });
        if (grades.length === 0) {
          return { resultLabel: `Aucune note calculée pour ${subject.name} en ${classe.name} (séquence ${sequence.name}).`, section: 'grades' };
        }
        const moyenne = calculateAverageScoreOn20(
          grades.map((g) => ({ scoreOn20: g.sequenceAverage ?? 0, percentage: 0, coefficient: 1, isAbsentGrade: g.isAbsentGrade })),
          false,
          true,
        );
        return {
          resultLabel: `Moyenne de ${classe.name} en ${subject.name} (séquence ${sequence.name}) : ${moyenne}/20 (${grades.length} note(s)).`,
          section: 'grades',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // ═══ Présences ═══

    // 5. Marquer la présence d'un élève — NON destructif (réversible)
    defineAction({
      name: 'marquer_absence_eleve',
      description: "Enregistre le statut de présence (présent, absent, ou en retard) d'UN élève pour votre cours, à la date du jour ou une date précisée.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().min(1),
        subjectName: z.string().optional(),
        statut: z.enum(['PRESENT', 'ABSENT', 'LATE']),
        period: z.enum(['MORNING', 'AFTERNOON']).optional().describe('Créneau — matin par défaut'),
        date: z.string().optional().describe('Date au format YYYY-MM-DD — aujourd\'hui par défaut'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : undefined;
        const academicPeriod = await resolveCurrentPeriod(ctx);
        const date = input.date ? new Date(input.date) : new Date();
        const attendancePeriod = input.period ?? 'MORNING';

        await deps.enregistrerPresence.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          academicPeriodId: academicPeriod.id,
          subjectId: subject?.id,
          teacherId: ctx.userId,
          recordedById: ctx.userId,
          date,
          period: attendancePeriod,
          presences: [{ studentId: student.id, statut: input.statut }],
        });
        const attendanceId = await ctx.data.portal.findLatestAttendanceId({
          schoolId: ctx.schoolId,
          studentId: student.id,
          classId: classe.id,
          date,
          period: attendancePeriod,
        });
        const labelStatut = input.statut === 'PRESENT' ? 'présent' : input.statut === 'ABSENT' ? 'absent' : 'en retard';
        return {
          resultLabel: `${student.name} marqué ${labelStatut} le ${date.toLocaleDateString('fr-FR')} (${classe.name}).`,
          undoData: attendanceId ? { attendanceId } : undefined,
          section: 'attendance',
          entity: 'attendance',
        };
      },
      async undo(_params, undoData, ctx) {
        if (!undoData.attendanceId) throw new Error('Annulation impossible — enregistrement introuvable.');
        await ctx.data.portal.deleteAttendanceById(ctx.schoolId, String(undoData.attendanceId));
      },
    }),

    // 6. Taux de présence d'une classe — LECTURE SEULE
    defineAction({
      name: 'mes_stats_presence_classe',
      description: "Donne le taux de présence d'une classe que vous encadrez, depuis une date donnée (ce mois-ci par défaut).",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        className: z.string().min(1),
        depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        if (deps.getMetric) {
          const count = await ctx.data.portal.countAttendancesSince({
            schoolId: ctx.schoolId,
            classId: classe.id,
            teacherId: ctx.userId,
            since: depuis,
          });
          if (count === 0) {
            return { resultLabel: `Aucun enregistrement de présence pour ${classe.name} depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
          }
          const res = await deps.getMetric.execute({
            key: 'taux_presence',
            dimensions: { schoolId: ctx.schoolId, classId: classe.id, teacherId: ctx.userId, dateRange: { from: depuis.toISOString(), to: now.toISOString() } },
          });
          return {
            resultLabel: `${classe.name} : taux de présence de ${res.value}% depuis le ${depuis.toLocaleDateString('fr-FR')} (${count} enregistrement(s)).`,
            section: 'attendance',
          };
        }
        const records = await ctx.data.portal.findAttendanceStatusesSince({
          schoolId: ctx.schoolId,
          classId: classe.id,
          teacherId: ctx.userId,
          since: depuis,
        });
        if (records.length === 0) {
          return { resultLabel: `Aucun enregistrement de présence pour ${classe.name} depuis le ${depuis.toLocaleDateString('fr-FR')}.`, section: 'attendance' };
        }
        const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const taux = Math.round((present / records.length) * 10000) / 100;
        return {
          resultLabel: `${classe.name} : taux de présence de ${taux}% depuis le ${depuis.toLocaleDateString('fr-FR')} (${records.length} enregistrement(s)).`,
          section: 'attendance',
        };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // ═══ Cahier de texte ═══

    // 7. Ajouter une entrée au cahier de texte — NON destructif (réversible)
    defineAction({
      name: 'ajouter_cahier_texte',
      description: "Ajoute une entrée au cahier de texte pour une classe et une matière que vous enseignez : ce qui a été fait en cours, et les devoirs donnés le cas échéant.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        className: z.string().min(1),
        subjectName: z.string().min(1),
        contenu: z.string().min(1).describe('Ce qui a été enseigné pendant le cours'),
        devoirs: z.string().optional().describe('Devoirs donnés aux élèves, si applicable'),
        date: z.string().optional().describe('Date au format YYYY-MM-DD — aujourd\'hui par défaut'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = await resolveSubject(ctx, input.subjectName);
        await verifierAssignation(ctx, classe.id, subject.id, classe.name, subject.name);
        const year = await resolveCurrentAcademicYear(ctx);
        const entry = await ctx.data.portal.createCahierDeTexteEntry({
          schoolId: ctx.schoolId,
          teacherId: ctx.userId,
          classId: classe.id,
          subjectId: subject.id,
          academicYearId: year.id,
          date: input.date ? new Date(input.date) : new Date(),
          contenuLibre: input.contenu,
          devoirsDonnes: input.devoirs,
        });
        return {
          resultLabel: `Entrée ajoutée au cahier de texte — ${classe.name}, ${subject.name}`,
          undoData: { entryId: entry.id },
          section: 'cahier-de-texte',
          entity: 'cahierDeTexte',
        };
      },
      async undo(_params, undoData, ctx) {
        await ctx.data.portal.deleteCahierDeTexteEntry(ctx.schoolId, String(undoData.entryId));
      },
    }),

    // ═══ Emploi du temps ═══

    // 8. Demander un rattrapage — NON annulable (notification déjà envoyée aux censeurs)
    defineAction({
      name: 'demander_rattrapage',
      description: "Demande une session de rattrapage pour un cours manqué, envoyée pour validation aux censeurs/surveillants généraux de l'établissement.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({
        className: z.string().min(1),
        subjectName: z.string().optional(),
        proposedDate: z.string().describe('Date proposée au format YYYY-MM-DD'),
        proposedStartTime: z.string().optional().describe('Heure de début, ex. "14:00"'),
        proposedEndTime: z.string().optional(),
        reason: z.string().optional(),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : undefined;
        await deps.demanderRattrapage.execute({
          schoolId: ctx.schoolId,
          classId: classe.id,
          subjectId: subject?.id,
          teacherId: ctx.userId,
          proposedDate: new Date(input.proposedDate),
          proposedStartTime: input.proposedStartTime,
          proposedEndTime: input.proposedEndTime,
          reason: input.reason,
        });
        return {
          resultLabel: `Demande de rattrapage envoyée pour ${classe.name} le ${input.proposedDate}`,
          section: 'timetable',
          entity: 'catchupRequest',
        };
      },
      async undo() {
        throw new Error('Une demande de rattrapage déjà envoyée ne peut pas être annulée depuis le copilot.');
      },
    }),

    // ═══ Mes classes ═══

    // 9. Mes classes et matières — LECTURE SEULE
    defineAction({
      name: 'mes_classes',
      description: "Liste les classes et matières que vous enseignez.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const assignments = await ctx.data.portal.findTeacherAssignments(ctx.schoolId, ctx.userId);
        const resultLabel = assignments.length === 0
          ? "Vous n'avez aucune classe assignée actuellement."
          : `Vos classes : ${assignments.map((a) => `${a.subjectName} en ${a.className}`).join(', ')}.`;
        return { resultLabel, section: 'classes' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),

    // 10. Élèves d'une de mes classes — LECTURE SEULE
    defineAction({
      name: 'mes_eleves_classe',
      description: "Liste les élèves d'une classe que vous enseignez.",
      destructive: false,
      requiredPermission: null,
      allowedRoles: ['TEACHER'],
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const assigned = await ctx.data.portal.hasTeacherAssignment({
          schoolId: ctx.schoolId,
          teacherId: ctx.userId,
          classId: classe.id,
        });
        if (!assigned) throw new Error(`Vous n'enseignez pas dans ${classe.name}.`);
        const eleves = await ctx.data.portal.findStudentsInClass(ctx.schoolId, classe.id);
        const resultLabel = eleves.length === 0
          ? `Aucun élève inscrit dans ${classe.name}.`
          : `${classe.name} (${eleves.length} élève(s)) : ${eleves.map((e) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()).join(', ')}`;
        return { resultLabel, section: 'classes' };
      },
      async undo() {
        throw new Error('Cette action est une simple consultation, il n\'y a rien à annuler.');
      },
    }),
  ];
}
