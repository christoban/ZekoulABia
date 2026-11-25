import { z } from 'zod';
import {
  type ActionDefinition,
  defineAction,
  resolveClass,
  resolveStudent,
} from '../catalogShared';
import type { AdminActionDeps } from '../adminActionCatalog';

export function buildAdminStudentUserActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 10. Lister candidats CEP en attente — LECTURE SEULE
    defineAction({
      name: 'lister_candidats_cep_en_attente',
      domain: 'concours',
      description:
        "Affiche la liste des candidats admis provisoirement au concours d'entrée, en attente de leur résultat CEP.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const candidats = await ctx.data.adminOps.findCepPendingCandidates(ctx.schoolId);
        const resultLabel =
          candidats.length === 0
            ? 'Aucun candidat en attente de résultat CEP actuellement.'
            : `${candidats.length} candidat(s) en attente de résultat CEP : ` +
              candidats.map((c) => `${c.firstName} ${c.lastName} (${c.sessionName})`).join(', ');
        return { resultLabel, section: 'entrance-exams', entity: 'entranceExamCandidate' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),

    // 11. Inscrire un élève — NON destructif
    defineAction({
      name: 'creer_eleve',
      domain: 'eleves',
      description: "Inscrit un nouvel élève dans une classe existante de l'établissement.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        firstName: z.string().min(1).describe("Prénom de l'élève"),
        lastName: z.string().min(1).describe("Nom de l'élève"),
        className: z.string().min(1).describe("Classe où inscrire l'élève"),
        gender: z.enum(['M', 'F']).optional(),
        dateOfBirth: z.string().optional().describe('Date de naissance au format YYYY-MM-DD, si connue'),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const bcrypt = await import('bcryptjs');
        const nodeCrypto = await import('crypto');
        const passwordHash = await bcrypt.hash(nodeCrypto.randomBytes(32).toString('hex'), 10);
        const r = await deps.inscrireEleve.execute({
          schoolId: ctx.schoolId,
          role: 'STUDENT',
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          classeId: classe.id,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        });
        return {
          resultLabel: `Élève ${r.nomComplet} inscrit en ${classe.name}`,
          undoData: { userId: r.userId },
          section: 'users',
          entity: 'user',
        };
      },
      async undo(_params, undoData: { userId: string }, ctx) {
        await deps.supprimerUtilisateur.execute({
          userId: String(undoData.userId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          demandeurId: ctx.userId,
        });
      },
    }),

    // 12. Modifier un élève — NON destructif
    defineAction({
      name: 'modifier_eleve',
      domain: 'eleves',
      description: "Modifie les informations d'un élève déjà inscrit (prénom, nom, téléphone).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1).describe("Nom complet de l'élève"),
        className: z.string().optional().describe("Classe actuelle de l'élève — précisez si plusieurs élèves portent ce nom"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
      }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const before = await ctx.data.adminOps.findUserBasicIdentity(ctx.schoolId, student.id);
        await deps.modifierUtilisateur.execute({
          cibleUserId: student.id,
          demandeurId: ctx.userId,
          demandeurRole: ctx.role,
          schoolId: ctx.schoolId,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        });
        return {
          resultLabel: `Élève ${student.name} modifié`,
          undoData: { userId: student.id, firstName: before?.firstName, lastName: before?.lastName, phone: before?.phone },
          section: 'users',
          entity: 'user',
        };
      },
      async undo(
        _params,
        undoData: { userId: string; firstName?: string | null; lastName?: string | null; phone?: string | null },
        ctx,
      ) {
        await deps.modifierUtilisateur.execute({
          cibleUserId: String(undoData.userId),
          demandeurId: ctx.userId,
          demandeurRole: ctx.role,
          schoolId: ctx.schoolId,
          firstName: undoData.firstName ?? undefined,
          lastName: undoData.lastName ?? undefined,
          phone: undoData.phone ?? undefined,
        });
      },
    }),

    // 13. Transférer un élève vers une autre classe — NON destructif (réversible)
    defineAction({
      name: 'transferer_eleve',
      domain: 'eleves',
      description: "Transfère un élève de sa classe actuelle vers une autre classe.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        studentName: z.string().min(1).describe("Nom complet de l'élève"),
        fromClassName: z.string().min(1).describe("Classe actuelle de l'élève"),
        toClassName: z.string().min(1).describe('Classe de destination'),
      }),
      async execute(input, ctx) {
        const fromClasse = await resolveClass(ctx, input.fromClassName);
        const toClasse = await resolveClass(ctx, input.toClassName);
        const student = await resolveStudent(ctx, input.studentName, input.fromClassName);
        await deps.transfererEleve.execute({
          studentId: student.id,
          fromClasseId: fromClasse.id,
          toClasseId: toClasse.id,
          schoolId: ctx.schoolId,
          demandeurId: ctx.userId,
        });
        return {
          resultLabel: `${student.name} transféré(e) de ${fromClasse.name} vers ${toClasse.name}`,
          undoData: { studentId: student.id, fromClasseId: toClasse.id, toClasseId: fromClasse.id },
          section: 'users',
          entity: 'user',
        };
      },
      async undo(_params, undoData: { studentId: string; fromClasseId: string; toClasseId: string }, ctx) {
        await deps.transfererEleve.execute({
          studentId: String(undoData.studentId),
          fromClasseId: String(undoData.fromClasseId),
          toClasseId: String(undoData.toClasseId),
          schoolId: ctx.schoolId,
          demandeurId: ctx.userId,
        });
      },
    }),

    // 43. Vérifier le matricule officiel d'un élève — LECTURE SEULE
    defineAction({
      name: 'verifier_matricule_eleve',
      domain: 'eleves',
      description:
        "Recherche le matricule officiel d'un élève sur cartescolaire.cm (MINESEC). N'associe JAMAIS le " +
        "résultat automatiquement au profil — l'admin doit confirmer manuellement depuis l'écran Matricules.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ studentName: z.string().min(1), className: z.string().optional() }),
      async execute(input, ctx) {
        const student = await resolveStudent(ctx, input.studentName, input.className);
        const profile = await ctx.data.adminOps.findStudentProfileIdByUserId(ctx.schoolId, student.id);
        if (!profile) throw new Error(`${student.name} n'a pas de profil élève associé.`);
        const r = await deps.verifierMatricule.execute(ctx.schoolId, profile.id);
        return { resultLabel: `${student.name} — ${r.message}`, section: 'matricules', entity: 'studentProfile' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    }),
  ];
}
