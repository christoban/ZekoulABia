import { z } from 'zod';
import {
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveStudent,
  norm,
} from '../catalogShared';
import { resolvePlanFrais } from './adminHelpers';
import type { AdminActionDeps } from '../adminActionCatalog';

export function buildAdminFinanceAttendanceActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 35. Créer un plan de frais — NON destructif (réversible)
    defineAction({
      name: 'creer_plan_frais',
      domain: 'paiements',
      description:
        "Crée un plan de frais (ex. scolarité, examen, tenue) pour l'établissement. Vérifie le seuil légal " +
        "MINESEC (Art. 48) si le type est TUITION — bloque si le montant le dépasse.",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      inputSchema: z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        feeType: z
          .enum(['TUITION', 'APEE_PTA', 'EXAM', 'UNIFORM', 'CAUTION', 'WORKSHOP', 'INSCRIPTION', 'DEVELOPMENT_LEVY', 'SPORTS_LEVY'])
          .default('TUITION'),
        level: z.string().optional().describe('Niveau ciblé, ex. "4e" — laisser vide si applicable à tous les niveaux'),
        isRefundable: z.boolean().optional(),
        description: z.string().optional(),
      }),
      async execute(input, ctx) {
        const r = await deps.creerPlanFrais.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          amount: input.amount,
          feeType: input.feeType,
          level: input.level,
          isRefundable: input.isRefundable,
          description: input.description,
          demandeurRole: ctx.role,
        });
        return {
          resultLabel: `Plan de frais « ${r.name} » créé (${r.amount} FCFA)`,
          undoData: { planId: r.planId },
          section: 'finance',
          entity: 'feePlan',
        };
      },
      async undo(_params, undoData: { planId: string }, ctx) {
        await ctx.data.adminOps.deleteFeePlan(ctx.schoolId, String(undoData.planId));
      },
    }),

    // 36. Générer les factures d'une classe pour un plan de frais — NON annulable
    defineAction({
      name: 'generer_factures_masse',
      domain: 'paiements',
      description:
        "Génère les factures d'un plan de frais pour tous les élèves d'une classe (ignore les élèves déjà facturés pour ce plan).",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      inputSchema: z.object({ className: z.string().min(1), planName: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const plan = await resolvePlanFrais(ctx, input.planName);
        const studentIds = await ctx.data.adminOps.findActiveStudentUserIdsByClass(ctx.schoolId, classe.id);
        if (studentIds.length === 0) throw new Error(`Aucun élève inscrit dans ${classe.name}.`);
        const r = await deps.genererFacturesMasse.execute({
          schoolId: ctx.schoolId,
          feePlanId: plan.id,
          studentIds,
        });
        return {
          resultLabel:
            `${classe.name} — plan « ${plan.name} » : ${r.crees} facture(s) créée(s), ${r.ignores} déjà facturé(s)` +
            (r.erreurs.length > 0 ? `, ${r.erreurs.length} erreur(s)` : ''),
          section: 'finance',
          entity: 'invoice',
        };
      },
      async undo() {
        throw new Error("La génération de factures ne peut pas être annulée depuis le copilot — utilisez l'écran Finance.");
      },
    }),

    // 37. Enregistrer un paiement en espèces — NON annulable
    defineAction({
      name: 'enregistrer_paiement_cash',
      domain: 'paiements',
      description:
        "Enregistre un paiement en espèces (guichet) reçu d'un élève, contre une facture impayée ou partiellement payée.",
      destructive: false,
      requiredPermission: 'MANAGE_FINANCE',
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional(),
        montant: z.number().positive(),
        planName: z
          .string()
          .optional()
          .describe('Nom du plan de frais concerné, à préciser si plusieurs factures impayées existent'),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const factures = await ctx.data.adminOps.findUnpaidInvoicesForStudent(ctx.schoolId, student.id);
        let candidates = factures;
        if (input.planName) {
          const target = norm(input.planName);
          candidates = factures.filter((f) => f.feePlanName && norm(f.feePlanName).includes(target));
        }
        if (candidates.length === 0)
          throw new Error(
            `Aucune facture impayée trouvée pour ${student.name}${input.planName ? ` (plan « ${input.planName} »)` : ''}.`,
          );
        if (candidates.length > 1) {
          const list = candidates.map((f) => f.feePlanName ?? 'facture sans plan').join(', ');
          throw new Error(`Plusieurs factures impayées existent pour ${student.name} : ${list}. Précisez le plan de frais concerné.`);
        }
        const facture = candidates[0];
        const r = await deps.enregistrerPaiementCash.execute({
          schoolId: ctx.schoolId,
          factureId: facture.id,
          studentId: student.id,
          montant: input.montant,
          enregistreurId: ctx.userId,
        });
        return {
          resultLabel:
            `Paiement de ${input.montant} FCFA enregistré pour ${student.name} — ` +
            `statut facture : ${r.nouveauStatutFacture}, reste à régler : ${r.resteARegler} FCFA`,
          section: 'finance',
          entity: 'payment',
        };
      },
      async undo() {
        throw new Error(
          "Un paiement encaissé ne peut pas être annulé depuis le copilot — utilisez l'écran Finance pour un remboursement.",
        );
      },
    }),

    // 38. Élèves avec factures impayées — LECTURE SEULE
    defineAction({
      name: 'eleves_factures_impayees',
      domain: 'paiements',
      description:
        "Liste les factures impayées ou partiellement payées (toute une classe, ou tout l'établissement si aucune classe n'est précisée) et le total restant dû.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().optional() }),
      async execute(input, ctx) {
        let studentIds: string[] | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          studentIds = await ctx.data.adminOps.findActiveStudentUserIdsByClass(ctx.schoolId, classe.id);
          label = classe.name;
        }
        const factures = await ctx.data.adminOps.findUnpaidInvoicesWithPayments(ctx.schoolId, studentIds);
        const resteTotal = factures.reduce((somme, f) => somme + Math.max(0, f.amount - f.paidAmount), 0);
        const resultLabel =
          factures.length === 0
            ? `Aucune facture impayée pour ${label}.`
            : `${factures.length} facture(s) impayée(s) pour ${label} — total restant dû : ${resteTotal} FCFA`;
        return { resultLabel, section: 'finance', entity: 'invoice' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 44. Justifier une absence — NON destructif (réversible)
    defineAction({
      name: 'justifier_absence',
      domain: 'absences',
      description:
        "Marque comme justifiée la dernière absence enregistrée d'un élève (ou celle d'une date précise si fournie).",
      destructive: false,
      requiredPermission: 'MANAGE_ATTENDANCE',
      inputSchema: z.object({
        studentName: z.string().min(1),
        className: z.string().optional().describe('Précisez si plusieurs élèves portent ce nom'),
        date: z
          .string()
          .optional()
          .describe("Date de l'absence au format YYYY-MM-DD — sinon la plus récente absence non justifiée est utilisée"),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const record = await ctx.data.adminOps.findLatestUnjustifiedAbsence(
          ctx.schoolId,
          student.id,
          input.date ? new Date(input.date) : undefined,
        );
        if (!record)
          throw new Error(
            `Aucune absence non justifiée trouvée pour ${student.name}${input.date ? ` le ${input.date}` : ''}.`,
          );
        await ctx.data.adminOps.updateAttendanceStatus(ctx.schoolId, record.id, 'ABSENT_JUSTIFIED');
        return {
          resultLabel: `Absence du ${record.date.toLocaleDateString('fr-FR')} justifiée pour ${student.name}`,
          undoData: { attendanceId: record.id },
          section: 'attendance',
          entity: 'attendance',
        };
      },
      async undo(_params, undoData: { attendanceId: string }, ctx) {
        await ctx.data.adminOps.updateAttendanceStatus(ctx.schoolId, String(undoData.attendanceId), 'ABSENT');
      },
    }),

    // 45. Élèves avec absences non justifiées au-delà d'un seuil — LECTURE SEULE
    defineAction({
      name: 'eleves_absences_non_justifiees',
      domain: 'absences',
      description:
        "Liste les élèves ayant plus d'un certain nombre d'absences non justifiées depuis une date donnée (ce mois-ci par défaut).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().optional(),
        seuil: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Nombre minimum d'absences non justifiées à partir duquel un élève est listé — 3 par défaut"),
        depuis: z.string().optional().describe('Date de début au format YYYY-MM-DD — début du mois courant par défaut'),
      }),
      async execute(input, ctx) {
        const seuil = input.seuil ?? 3;
        const now = new Date();
        const depuis = input.depuis ? new Date(input.depuis) : new Date(now.getFullYear(), now.getMonth(), 1);
        let studentIds: string[] | undefined;
        let label = "l'établissement";
        if (input.className) {
          const classe = await resolveClass(ctx, input.className);
          studentIds = await ctx.data.adminOps.findActiveStudentUserIdsByClass(ctx.schoolId, classe.id);
          label = classe.name;
        }
        const absences = await ctx.data.adminOps.findUnjustifiedAbsencesSince(ctx.schoolId, depuis, studentIds);
        const parEleve = new Map<string, { nom: string; count: number }>();
        for (const a of absences) {
          const cur = parEleve.get(a.studentId) ?? {
            nom: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
            count: 0,
          };
          cur.count++;
          parEleve.set(a.studentId, cur);
        }
        const eleves = [...parEleve.values()].filter((e) => e.count >= seuil).sort((a, b) => b.count - a.count);
        const resultLabel =
          eleves.length === 0
            ? `Aucun élève avec ${seuil} absences non justifiées ou plus, pour ${label} depuis le ${depuis.toLocaleDateString('fr-FR')}.`
            : `${eleves.length} élève(s) avec ${seuil} absences non justifiées ou plus, pour ${label} depuis le ${depuis.toLocaleDateString('fr-FR')} : ` +
              eleves.map((e) => `${e.nom} (${e.count})`).join(', ');
        return { resultLabel, section: 'attendance', entity: 'attendance' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),
  ];
}
