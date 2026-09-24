import { z } from 'zod';
import {
  type ActionDefinition,
  resolveClass,
  resolveTeacher,
  resolveSubject,
} from '../catalogShared';
import type { AdminActionDeps } from '../adminActionCatalog';

export function buildAdminClassSubjectActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    // 1. Créer une classe — NON destructif
    {
      name: 'creer_classe',
      domain: 'classes',
      description:
        "Crée une nouvelle classe dans l'établissement. Utilise le nom complet tel que dit par l'utilisateur (ex. « 4e D », « Terminale C »).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom complet de la classe, ex. "4e D", "Terminale C"'),
        level: z.string().optional().describe('Niveau, ex. "4e", "Terminale"'),
        serie: z.string().optional().describe('Série le cas échéant, ex. "C", "A4"'),
        capacity: z.number().int().positive().optional().describe('Effectif maximum'),
      }),
      async execute(input, ctx) {
        const anneeCourante = await ctx.prisma.academicYear.findFirst({
          where: { schoolId: ctx.schoolId, isCurrent: true },
          select: { id: true },
        });
        if (!anneeCourante) throw new Error('Aucune année académique courante — impossible de créer une classe.');
        const r = await deps.creerClasse.execute({
          schoolId: ctx.schoolId,
          academicYearId: anneeCourante.id,
          name: input.name,
          level: input.level,
          serie: input.serie,
          capacity: input.capacity,
        });
        return {
          resultLabel: `Classe « ${r.name} » créée`,
          undoData: { classeId: r.classeId },
          section: 'classes',
          entity: 'class',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.supprimerClasse.execute({
          classeId: String(undoData.classeId),
          schoolId: ctx.schoolId,
          demandeurId: ctx.userId,
        });
      },
    },

    // 2. Créer une matière — NON destructif
    {
      name: 'creer_matiere',
      domain: 'matieres',
      description: "Crée une nouvelle matière dans l'établissement.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        name: z.string().min(1).describe('Nom de la matière, ex. "Physique", "Espagnol"'),
        coefficient: z.number().positive().optional().describe('Coefficient (défaut 1)'),
        hoursPerWeek: z.number().positive().optional().describe('Heures par semaine (défaut 2)'),
      }),
      async execute(input, ctx) {
        const r = await deps.creerMatiere.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          coefficient: input.coefficient,
          hoursPerWeek: input.hoursPerWeek,
          demandeurRole: ctx.role,
        });
        return {
          resultLabel: `Matière « ${r.name} » créée`,
          undoData: { matiereId: r.matiereId },
          section: 'subjects',
          entity: 'subject',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.supprimerMatiere.execute({
          matiereId: String(undoData.matiereId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          demandeurId: ctx.userId,
        });
      },
    },

    // 3. Assigner un enseignant à une matière — NON destructif
    {
      name: 'assigner_enseignant_matiere',
      domain: 'matieres',
      description: "Assigne un enseignant à une matière (l'enseignant pourra y saisir des notes).",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        teacherName: z.string().min(1).describe("Nom de l'enseignant"),
        subjectName: z.string().min(1).describe('Nom de la matière'),
      }),
      async execute(input, ctx) {
        const teacher = await resolveTeacher(ctx, input.teacherName);
        const subject = await resolveSubject(ctx, input.subjectName);
        await deps.assignerEnseignant.execute({
          teacherUserId: teacher.id,
          matiereId: subject.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          action: 'ASSIGNER',
        });
        return {
          resultLabel: `${teacher.name} assigné(e) à ${subject.name}`,
          undoData: { teacherUserId: teacher.id, matiereId: subject.id },
          section: 'subjects',
          entity: 'subject',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.assignerEnseignant.execute({
          teacherUserId: String(undoData.teacherUserId),
          matiereId: String(undoData.matiereId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          action: 'RETIRER',
        });
      },
    },

    // 4. Nommer un professeur principal — NON destructif (réversible)
    {
      name: 'assigner_professeur_principal',
      domain: 'classes',
      description: "Nomme un enseignant professeur principal d'une classe.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1).describe('Nom de la classe'),
        teacherName: z.string().min(1).describe("Nom de l'enseignant à nommer professeur principal"),
      }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const teacher = await resolveTeacher(ctx, input.teacherName);
        const before = await ctx.prisma.class.findUnique({
          where: { id: classe.id },
          select: { professorPrincipalId: true },
        });
        await deps.assignerProfesseur.execute({
          classeId: classe.id,
          teacherUserId: teacher.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
        });
        return {
          resultLabel: `${teacher.name} nommé(e) professeur principal de ${classe.name}`,
          undoData: { classeId: classe.id, previousTeacherUserId: before?.professorPrincipalId ?? null },
          section: 'classes',
          entity: 'class',
        };
      },
      async undo(_params, undoData, ctx) {
        const classeId = String(undoData.classeId);
        const previous = undoData.previousTeacherUserId as string | null;
        if (previous) {
          await deps.assignerProfesseur.execute({
            classeId,
            teacherUserId: previous,
            schoolId: ctx.schoolId,
            demandeurRole: ctx.role,
          });
        } else {
          await ctx.prisma.class.update({ where: { id: classeId }, data: { professorPrincipalId: null } });
        }
      },
    },

    // 5. Supprimer une classe — DESTRUCTIF
    {
      name: 'supprimer_classe',
      domain: 'classes',
      description: 'Met une classe à la corbeille (récupérable pendant 30 jours).',
      destructive: true,
      requiredPermission: null,
      inputSchema: z.object({
        className: z.string().min(1).describe('Nom de la classe à supprimer'),
      }),
      async summarizeDestructive(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const [students, grades] = await Promise.all([
          ctx.prisma.enrollment.count({
            where: { classId: classe.id, status: 'ACTIVE', academicYear: { isCurrent: true } },
          }),
          ctx.prisma.grade.count({ where: { classId: classe.id } }),
        ]);
        const parts = [`${students} élève(s)`];
        if (grades > 0) parts.push(`${grades} note(s)`);
        parts.push('leur historique de présence et de paiement');
        return (
          `Cette action va mettre à la corbeille la classe « ${classe.name} » — restent rattachés : ` +
          `${parts.join(', ')}. Récupérable depuis la Corbeille pendant 30 jours, purgée définitivement ensuite.`
        );
      },
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        await deps.supprimerClasse.execute({ classeId: classe.id, schoolId: ctx.schoolId, demandeurId: ctx.userId });
        return { resultLabel: `Classe « ${classe.name} » mise à la corbeille`, section: 'classes', entity: 'class' };
      },
      async undo() {
        throw new Error("Restaurez cette classe depuis l'écran Corbeille plutôt que depuis cette conversation.");
      },
    },

    // 6. Supprimer une matière — DESTRUCTIF
    {
      name: 'supprimer_matiere',
      domain: 'matieres',
      description: 'Met une matière à la corbeille (récupérable pendant 30 jours).',
      destructive: true,
      requiredPermission: null,
      inputSchema: z.object({
        subjectName: z.string().min(1).describe('Nom de la matière à supprimer'),
      }),
      async summarizeDestructive(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        const grades = await ctx.prisma.grade.count({ where: { subjectId: subject.id } });
        const suffix = grades > 0 ? ` — ${grades} note(s) rattachée(s) restent intactes` : '';
        return (
          `Cette action va mettre à la corbeille la matière « ${subject.name} »${suffix}. ` +
          `Récupérable depuis la Corbeille pendant 30 jours, purgée définitivement ensuite.`
        );
      },
      async execute(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        await deps.supprimerMatiere.execute({
          matiereId: subject.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          demandeurId: ctx.userId,
        });
        return { resultLabel: `Matière « ${subject.name} » mise à la corbeille`, section: 'subjects', entity: 'subject' };
      },
      async undo() {
        throw new Error("Restaurez cette matière depuis l'écran Corbeille plutôt que depuis cette conversation.");
      },
    },

    // 14. Modifier une matière — NON destructif
    {
      name: 'modifier_matiere',
      domain: 'matieres',
      description: 'Modifie une matière existante (nom, coefficient, heures par semaine).',
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({
        subjectName: z.string().min(1),
        newName: z.string().optional(),
        coefficient: z.number().positive().optional(),
        hoursPerWeek: z.number().positive().optional(),
      }),
      async execute(input, ctx) {
        const subject = await resolveSubject(ctx, input.subjectName);
        const before = await ctx.prisma.subject.findUnique({
          where: { id: subject.id },
          select: { name: true, coefficient: true, hoursPerWeek: true },
        });
        await deps.modifierMatiere.execute({
          matiereId: subject.id,
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          name: input.newName,
          coefficient: input.coefficient,
          hoursPerWeek: input.hoursPerWeek,
        });
        return {
          resultLabel: `Matière « ${subject.name} » modifiée`,
          undoData: {
            matiereId: subject.id,
            name: before?.name,
            coefficient: before?.coefficient,
            hoursPerWeek: before?.hoursPerWeek,
          },
          section: 'subjects',
          entity: 'subject',
        };
      },
      async undo(_params, undoData, ctx) {
        await deps.modifierMatiere.execute({
          matiereId: String(undoData.matiereId),
          schoolId: ctx.schoolId,
          demandeurRole: ctx.role,
          name: undoData.name as string | undefined,
          coefficient: undoData.coefficient as number | undefined,
          hoursPerWeek: undoData.hoursPerWeek as number | undefined,
        });
      },
    },

    {
      name: 'creer_salle',
      domain: 'salles',
      description: "Crée une salle physique dans l'établissement.",
      destructive: false,
      requiredPermission: 'MANAGE_CLASSES',
      inputSchema: z.object({
        name: z.string().trim().min(1).describe('Nom de la salle'),
        type: z.enum(['NORMAL', 'LABORATORY', 'WORKSHOP', 'COMPUTER_LAB', 'FIELD']).optional().describe('Type de salle'),
        capacity: z.number().int().positive().optional().describe('Capacité de la salle'),
        equipment: z.array(z.string().trim().min(1)).optional().describe('Équipements de la salle'),
      }),
      async execute(input, ctx) {
        const room = await deps.creerSalle.execute({
          schoolId: ctx.schoolId,
          name: input.name,
          type: input.type ?? undefined,
          capacity: input.capacity ?? undefined,
          equipment: input.equipment ?? undefined,
        });
        return {
          resultLabel: `Salle « ${room.name} » créée`,
          undoData: { roomId: room.roomId },
          section: 'configuration',
          entity: 'room',
        };
      },
      async undo(_params, undoData, ctx) {
        const result = await ctx.prisma.room.updateMany({
          where: { id: String(undoData.roomId), schoolId: ctx.schoolId, deletedAt: null },
          data: { deletedAt: new Date(), deletedById: ctx.userId },
        });
        if (result.count === 0) throw new Error('La salle à annuler est introuvable ou déjà supprimée.');
      },
    },

    {
      name: 'modifier_salle',
      domain: 'salles',
      description: 'Modifie une salle physique existante.',
      destructive: false,
      requiredPermission: 'MANAGE_CLASSES',
      inputSchema: z.object({
        roomName: z.string().trim().min(1).describe('Nom actuel de la salle'),
        newName: z.string().trim().min(1).optional().describe('Nouveau nom de la salle'),
        type: z.enum(['NORMAL', 'LABORATORY', 'WORKSHOP', 'COMPUTER_LAB', 'FIELD']).optional().describe('Nouveau type'),
        capacity: z.number().int().positive().optional().describe('Nouvelle capacité'),
        equipment: z.array(z.string().trim().min(1)).optional().describe('Nouveaux équipements'),
        status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional().describe('Nouveau statut'),
      }),
      async execute(input, ctx) {
        const room = await ctx.prisma.room.findFirst({
          where: { schoolId: ctx.schoolId, name: input.roomName, deletedAt: null },
          select: { id: true, name: true, type: true, capacity: true, equipment: true, status: true },
        });
        if (!room) throw new Error(`Aucune salle nommée « ${input.roomName} » n'existe dans votre établissement.`);
        const hasChange = input.newName !== undefined || input.type !== undefined || input.capacity !== undefined || input.equipment !== undefined || input.status !== undefined;
        if (!hasChange) throw new Error('Précise au moins un champ à modifier pour la salle.');

        await deps.modifierSalle.execute({
          roomId: room.id,
          schoolId: ctx.schoolId,
          name: input.newName ?? undefined,
          type: input.type ?? undefined,
          capacity: input.capacity ?? undefined,
          equipment: input.equipment ?? undefined,
          status: input.status ?? undefined,
        });
        return {
          resultLabel: `Salle « ${room.name} » modifiée`,
          undoData: {
            roomId: room.id,
            name: room.name,
            type: room.type,
            capacity: room.capacity,
            equipment: room.equipment,
            status: room.status,
          },
          section: 'configuration',
          entity: 'room',
        };
      },
      async undo(_params, undoData, ctx) {
        const result = await ctx.prisma.room.updateMany({
          where: { id: String(undoData.roomId), schoolId: ctx.schoolId, deletedAt: null },
          data: {
            name: undoData.name as string,
            type: undoData.type as 'NORMAL' | 'LABORATORY' | 'WORKSHOP' | 'COMPUTER_LAB' | 'FIELD',
            capacity: undoData.capacity as number,
            equipment: undoData.equipment as string[],
            status: undoData.status as 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE',
          },
        });
        if (result.count === 0) throw new Error('La salle à restaurer est introuvable.');
      },
    },

    // 50. Professeur principal d'une classe — LECTURE SEULE
    {
      name: 'professeur_principal_classe',
      domain: 'classes',
      description: "Indique qui est le professeur principal d'une classe donnée.",
      destructive: false,
      requiredPermission: null,
      inputSchema: z.object({ className: z.string().min(1) }),
      async execute(input, ctx) {
        const classe = await resolveClass(ctx, input.className);
        const c = await ctx.prisma.class.findUnique({
          where: { id: classe.id },
          select: { professorPrincipal: { select: { firstName: true, lastName: true } } },
        });
        const resultLabel = c?.professorPrincipal
          ? `Le professeur principal de ${classe.name} est ${c.professorPrincipal.firstName ?? ''} ${c.professorPrincipal.lastName ?? ''}`.trim()
          : `${classe.name} n'a pas encore de professeur principal assigné.`;
        return { resultLabel, section: 'classes', entity: 'class' };
      },
      async undo() {
        throw new Error("Cette action est une simple consultation, il n'y a rien à annuler.");
      },
    },
  ];
}
