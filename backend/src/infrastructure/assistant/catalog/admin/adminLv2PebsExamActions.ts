import { z } from 'zod';
import {
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveStudent,
  resolveSubject,
  resolveCurrentAcademicYear,
} from '../catalogShared';
import { resolveEntranceExamSession, resolvePebsSession } from './adminHelpers';
import type { AdminActionDeps } from '../adminActionCatalog';
import type { PebsFiliere } from '@domain/types/enums';

export function buildAdminLv2PebsExamActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 7. Créer une session de concours d'entrée — NON destructif
    defineAction({
      name: 'creer_session_concours_entree',
      domain: 'concours',
      description:
        "Crée une nouvelle session de concours d'entrée en 6e, pour l'année scolaire courante. " +
        "Ne calcule PAS l'admission — cela reste une action volontaire distincte de l'admin.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom de la session, ex. "Concours d\'entrée 6e 2026-2027"'),
        examDate: z.string().describe('Date du concours au format YYYY-MM-DD'),
        admissionThreshold: z.number().optional().describe('Seuil de notes pour être admis, si connu'),
        availableSeats: z.number().int().positive().optional().describe('Nombre de places disponibles, si connu'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const r = await deps.creerSessionConcours.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          examDate: new Date(input.examDate),
          academicYearId: year.id,
          admissionThreshold: input.admissionThreshold,
          availableSeats: input.availableSeats,
        });
        return {
          resultLabel: `Session de concours d'entrée « ${input.name} » créée`,
          undoData: { sessionId: r.sessionId },
          section: 'entrance-exams',
          entity: 'entranceExamSession',
        };
      },
      async undo(_params, undoData: { sessionId: string }, ctx) {
        await ctx.data.adminOps.deleteEntranceExamSession(ctx.schoolId, String(undoData.sessionId));
      },
    }),

    // 8. Créer une session de sélection PEBS — NON destructif
    defineAction({
      name: 'creer_session_selection_pebs',
      domain: 'lv2_pebs',
      description:
        "Crée une nouvelle session de sélection PEBS pour un niveau donné, avec la classe cible où " +
        "seront transférés les élèves sélectionnés. Ne calcule PAS la sélection ni le transfert.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom de la session, ex. "Sélection PEBS 6e 2026-2027"'),
        examDate: z.string().describe("Date de l'examen au format YYYY-MM-DD"),
        level: z.string().min(1).describe('Niveau concerné, ex. "6e"'),
        targetClassName: z.string().min(1).describe('Nom de la classe cible où seront transférés les élèves sélectionnés'),
        selectionThreshold: z.number().optional().describe('Seuil de notes pour être sélectionné, si connu'),
        availableSeats: z.number().int().positive().optional().describe('Nombre de places disponibles, si connu'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const targetClass = await resolveClass(ctx, input.targetClassName);
        const r = await deps.creerSessionPebs.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          examDate: new Date(input.examDate),
          level: input.level,
          academicYearId: year.id,
          selectionThreshold: input.selectionThreshold,
          availableSeats: input.availableSeats,
          targetClassId: targetClass.id,
        });
        return {
          resultLabel: `Session de sélection PEBS « ${input.name} » créée (classe cible : ${targetClass.name})`,
          undoData: { sessionId: r.sessionId },
          section: 'pebs-exams',
          entity: 'pebsExamSession',
        };
      },
      async undo(_params, undoData: { sessionId: string }, ctx) {
        await ctx.data.adminOps.deletePebsExamSession(ctx.schoolId, String(undoData.sessionId));
      },
    }),

    // 9. Ouvrir une fenêtre de choix LV2 — NON destructif
    defineAction({
      name: 'ouvrir_fenetre_choix_lv2',
      domain: 'lv2_pebs',
      description:
        "Ouvre une fenêtre de choix de LV2 pour un niveau, pendant laquelle les élèves peuvent choisir " +
        "leur langue depuis leur compte. Envoie automatiquement un SMS aux parents des élèves concernés.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        level: z.string().min(1).describe('Niveau concerné, ex. "5e"'),
        openDate: z.string().describe("Date d'ouverture au format YYYY-MM-DD"),
        closeDate: z.string().describe('Date de clôture au format YYYY-MM-DD'),
      }),
      async execute(input, ctx) {
        const year = await resolveCurrentAcademicYear(ctx);
        const r = await deps.ouvrirFenetreLV2.execute({
          schoolId: ctx.schoolId,
          level: input.level,
          academicYearId: year.id,
          openDate: new Date(input.openDate),
          closeDate: new Date(input.closeDate),
        });
        return {
          resultLabel: `Fenêtre de choix LV2 ouverte pour ${input.level} jusqu'au ${input.closeDate} (${r.eleves.length} élève(s) notifié(s) par SMS)`,
          undoData: { windowId: r.windowId },
          section: 'lv2-choice',
          entity: 'lv2ChoiceWindow',
        };
      },
      async undo(_params, undoData: { windowId: string }, ctx) {
        await ctx.data.adminOps.closeLv2ChoiceWindow(ctx.schoolId, String(undoData.windowId));
      },
    }),

    // 15. Affecter la LV2 d'un élève — NON destructif (réversible)
    defineAction({
      name: 'affecter_lv2_eleve',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si subjectName omis) la LV2 (deuxième langue vivante) d'UN élève précis.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        subjectName: z.string().optional().describe('Nom de la LV2 à affecter — omettre pour retirer la LV2 actuelle'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : null;
        const before = await ctx.data.adminOps.findStudentLv2SubjectId(ctx.schoolId, student.id);
        await deps.affecterLV2Eleve.execute({
          studentUserId: student.id,
          schoolId: ctx.schoolId,
          lv2SubjectId: subject?.id ?? null,
        });
        return {
          resultLabel: subject ? `LV2 ${subject.name} affectée à ${student.name}` : `LV2 retirée à ${student.name}`,
          undoData: { studentUserId: student.id, previousLv2SubjectId: before?.lv2SubjectId ?? null },
          section: 'lv2-choice',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData: { studentUserId: string; previousLv2SubjectId: string | null }, ctx) {
        await deps.affecterLV2Eleve.execute({
          studentUserId: String(undoData.studentUserId),
          schoolId: ctx.schoolId,
          lv2SubjectId: undoData.previousLv2SubjectId ?? null,
        });
      },
    }),

    // 16. Affecter la LV2 en masse à toute une classe — NON destructif (réversible)
    defineAction({
      name: 'affecter_lv2_masse',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si subjectName omis) la même LV2 à TOUS les élèves d'une classe en une fois.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1),
        subjectName: z.string().optional().describe('Nom de la LV2 à affecter — omettre pour retirer la LV2 de toute la classe'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const subject = input.subjectName ? await resolveSubject(ctx, input.subjectName) : null;
        const profiles = await ctx.data.adminOps.findClassStudentsLv2(ctx.schoolId, classe.id);
        const r = await deps.affecterLV2Masse.execute({
          studentUserIds: profiles.map((p) => p.userId),
          schoolId: ctx.schoolId,
          lv2SubjectId: subject?.id ?? null,
        });
        return {
          resultLabel: `LV2 ${subject ? subject.name : '(retirée)'} affectée à ${r.modifies} élève(s) de ${classe.name}`,
          undoData: { previous: profiles.map((p) => ({ userId: p.userId, lv2SubjectId: p.lv2SubjectId })) },
          section: 'lv2-choice',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData: { previous: { userId: string; lv2SubjectId: string | null }[] }, ctx) {
        for (const p of undoData.previous) {
          await deps.affecterLV2Eleve.execute({
            studentUserId: p.userId,
            schoolId: ctx.schoolId,
            lv2SubjectId: p.lv2SubjectId,
          });
        }
      },
    }),

    // 17. Affecter la filière PEBS d'un élève — NON destructif (réversible)
    defineAction({
      name: 'affecter_pebs_eleve',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si filiere omis) la filière PEBS (Programme Spécial Bilingue) d'UN élève précis.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        filiere: z.enum(['FR_PEBS', 'EN_PEBS']).optional().describe('Filière PEBS à affecter — omettre pour retirer'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const before = await ctx.data.adminOps.findStudentPebsFiliere(ctx.schoolId, student.id);
        await deps.affecterPEBSEleve.execute({
          studentUserId: student.id,
          schoolId: ctx.schoolId,
          pebsFiliere: input.filiere ?? null,
        });
        return {
          resultLabel: input.filiere
            ? `Filière ${input.filiere} affectée à ${student.name}`
            : `Filière PEBS retirée à ${student.name}`,
          undoData: { studentUserId: student.id, previousPebsFiliere: before?.pebsFiliere ?? null },
          section: 'pebs-exams',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData: { studentUserId: string; previousPebsFiliere: PebsFiliere | null }, ctx) {
        await deps.affecterPEBSEleve.execute({
          studentUserId: String(undoData.studentUserId),
          schoolId: ctx.schoolId,
          pebsFiliere: undoData.previousPebsFiliere ?? null,
        });
      },
    }),

    // 18. Affecter la filière PEBS en masse à toute une classe — NON destructif (réversible)
    defineAction({
      name: 'affecter_pebs_masse',
      domain: 'lv2_pebs',
      description: "Affecte (ou retire, si filiere omis) la même filière PEBS à TOUS les élèves d'une classe en une fois.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1),
        filiere: z.enum(['FR_PEBS', 'EN_PEBS']).optional().describe('Filière PEBS à affecter — omettre pour retirer de toute la classe'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.data.adminOps.findClassStudentsPebs(ctx.schoolId, classe.id);
        const r = await deps.affecterPEBSMasse.execute({
          studentUserIds: profiles.map((p) => p.userId),
          schoolId: ctx.schoolId,
          pebsFiliere: input.filiere ?? null,
        });
        return {
          resultLabel: `Filière ${input.filiere ?? '(retirée)'} affectée à ${r.modifies} élève(s) de ${classe.name}`,
          undoData: { previous: profiles.map((p) => ({ userId: p.userId, pebsFiliere: p.pebsFiliere })) },
          section: 'pebs-exams',
          entity: 'studentProfile',
        };
      },
      async undo(_params, undoData: { previous: { userId: string; pebsFiliere: PebsFiliere | null }[] }, ctx) {
        for (const p of undoData.previous) {
          await deps.affecterPEBSEleve.execute({ studentUserId: p.userId, schoolId: ctx.schoolId, pebsFiliere: p.pebsFiliere });
        }
      },
    }),

    // 19. Compter les élèves d'une classe par LV2 — LECTURE SEULE
    defineAction({
      name: 'compter_eleves_par_lv2',
      domain: 'lv2_pebs',
      description: "Compte combien d'élèves d'une classe ont chaque LV2 affectée, et combien n'en ont aucune.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.data.adminOps.findClassStudentLv2Names(ctx.schoolId, classe.id);
        const counts = new Map<string, number>();
        for (const p of profiles) {
          const key = p.lv2SubjectName ?? 'Aucune LV2';
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const resultLabel =
          `${classe.name} (${profiles.length} élève(s)) : ` +
          [...counts.entries()].map(([k, v]) => `${k} : ${v}`).join(', ');
        return { resultLabel, section: 'lv2-choice', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 20. Lister les élèves sans LV2 dans une classe — LECTURE SEULE
    defineAction({
      name: 'lister_eleves_sans_lv2',
      domain: 'lv2_pebs',
      description: "Liste les élèves d'une classe qui n'ont pas encore de LV2 affectée.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.data.adminOps.findClassStudentsWithoutLv2(ctx.schoolId, classe.id);
        const resultLabel =
          profiles.length === 0
            ? `Tous les élèves de ${classe.name} ont une LV2 affectée.`
            : `${profiles.length} élève(s) de ${classe.name} sans LV2 : ` +
              profiles.map((p) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()).join(', ');
        return { resultLabel, section: 'lv2-choice', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 21. Répartition PEBS d'une classe — LECTURE SEULE
    defineAction({
      name: 'repartition_pebs_classe',
      domain: 'lv2_pebs',
      description: "Donne la répartition des élèves d'une classe entre filière PEBS francophone, anglophone, et non-PEBS.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const profiles = await ctx.data.adminOps.findClassStudentsPebs(ctx.schoolId, classe.id);
        const frPebs = profiles.filter((p) => p.pebsFiliere === 'FR_PEBS').length;
        const enPebs = profiles.filter((p) => p.pebsFiliere === 'EN_PEBS').length;
        const nonPebs = profiles.length - frPebs - enPebs;
        return {
          resultLabel: `${classe.name} (${profiles.length} élève(s)) : PEBS francophone ${frPebs}, PEBS anglophone ${enPebs}, non-PEBS ${nonPebs}`,
          section: 'pebs-exams',
          entity: 'studentProfile',
        };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 39. Résumé d'une session de concours — LECTURE SEULE
    defineAction({
      name: 'resume_session_concours',
      domain: 'concours',
      description:
        "Affiche le résumé d'une session de concours d'entrée en 6e : nombre de candidats, admis provisoires, confirmés, en attente de CEP.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolveEntranceExamSession(ctx, input.sessionName);
        const r = await deps.resumeSessionConcours.execute(ctx.schoolId, session.id);
        const resultLabel =
          `Session « ${r.session.name} » : ${r.total} candidat(s) — ${r.pending} en attente, ` +
          `${r.admisProvisoire} admis provisoire(s), ${r.confirms} confirmé(s), ${r.annules} annulé(s), ` +
          `${r.cepPending} en attente de résultat CEP.`;
        return { resultLabel, section: 'entrance-exams', entity: 'entranceExamSession' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 40. Calculer l'admission d'une session de concours
    defineAction({
      name: 'calculer_admission_concours',
      domain: 'concours',
      description:
        "Calcule l'admission des candidats d'une session de concours d'entrée, selon le seuil de notes et " +
        "le nombre de places disponibles configurés sur la session. Met à jour le statut de chaque candidat.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolveEntranceExamSession(ctx, input.sessionName);
        const r = await deps.calculerAdmissionConcours.execute({ schoolId: ctx.schoolId, sessionId: session.id });
        return {
          resultLabel: `Session « ${session.name} » : ${r.admis} candidat(s) admis provisoire(s), ${r.nonAdmis} non admis.`,
          section: 'entrance-exams',
          entity: 'entranceExamCandidate',
        };
      },
      async undo() {
        throw new Error(
          "Le calcul d'admission ne peut pas être annulé depuis le copilot — utilisez l'écran Concours pour ajuster manuellement.",
        );
      },
    }),

    // 41. Résumé d'une session PEBS — LECTURE SEULE
    defineAction({
      name: 'resume_session_pebs',
      domain: 'lv2_pebs',
      description:
        "Affiche le résumé d'une session de sélection PEBS : nombre de candidats, en attente, sélectionnés, non sélectionnés.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolvePebsSession(ctx, input.sessionName);
        const r = await deps.resumeSessionPebs.execute(ctx.schoolId, session.id);
        const resultLabel =
          `Session « ${r.session.name} » (${r.session.level}) : ${r.total} candidat(s) — ${r.pending} en attente, ` +
          `${r.selectionnes} sélectionné(s), ${r.nonSelectionnes} non sélectionné(s).`;
        return { resultLabel, section: 'pebs-exams', entity: 'pebsExamSession' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 42. Calculer la sélection d'une session PEBS
    defineAction({
      name: 'calculer_selection_pebs',
      domain: 'lv2_pebs',
      description:
        "Calcule la sélection des candidats d'une session PEBS, selon le seuil de notes et le nombre de places " +
        "disponibles configurés sur la session. Ne transfère PAS encore les élèves sélectionnés vers la classe cible.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ sessionName: z.string().min(1) }),
      async execute(input, ctx) {
        const session = await resolvePebsSession(ctx, input.sessionName);
        const r = await deps.calculerSelectionPebs.execute({ schoolId: ctx.schoolId, sessionId: session.id });
        return {
          resultLabel: `Session « ${session.name} » : ${r.selectionnes} candidat(s) sélectionné(s), ${r.nonSelectionnes} non sélectionné(s). Le transfert vers la classe cible reste à faire depuis l'écran PEBS.`,
          section: 'pebs-exams',
          entity: 'pebsExamCandidate',
        };
      },
      async undo() {
        throw new Error(
          "Le calcul de sélection ne peut pas être annulé depuis le copilot — utilisez l'écran PEBS pour ajuster manuellement.",
        );
      },
    }),
  ];
}
