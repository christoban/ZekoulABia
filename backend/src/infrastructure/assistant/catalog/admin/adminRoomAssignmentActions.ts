import { z } from 'zod'
import { norm, resolveCurrentAcademicYear, type ActionDefinition } from '../catalogShared'
import type { AdminActionDeps } from '../adminActionCatalog'

export function buildAdminRoomAssignmentActions(deps: AdminActionDeps): ActionDefinition[] {
  return [
    {
      name: 'affecter_salles_naturelles',
      domain: 'salle_affectation',
      description: 'Affecte automatiquement à chaque classe la salle active portant exactement le même nom. Ignore les classes qui ont déjà une salle habituelle.',
      destructive: false,
      requiredPermission: 'MANAGE_CLASSES',
      inputSchema: z.object({}),
      async execute(_input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx)
        const classes = await ctx.prisma.class.findMany({
          where: { schoolId: ctx.schoolId, academicYearId: annee.id, status: 'ACTIVE', deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
        const rooms = await ctx.prisma.room.findMany({
          where: { schoolId: ctx.schoolId, status: 'ACTIVE', deletedAt: null },
          select: { id: true, name: true },
        })
        const roomByName = new Map(rooms.map(room => [norm(room.name), room]))
        const previous = await ctx.prisma.classRoomAssignment.findMany({
          where: { schoolId: ctx.schoolId, academicYearId: annee.id, classId: { in: classes.map(classe => classe.id) } },
          select: { classId: true, roomId: true },
        })
        const assignedClasses = new Set(previous.map(assignment => assignment.classId))
        const previousByClass = new Map(previous.map(assignment => [assignment.classId, assignment.roomId]))
        const affected: { classId: string; className: string; roomId: string; previousRoomId: string | null }[] = []
        const missingRooms: string[] = []
        const erreurs: string[] = []

        for (const classe of classes) {
          if (assignedClasses.has(classe.id)) continue
          const room = roomByName.get(norm(classe.name))
          if (!room) {
            missingRooms.push(classe.name)
            continue
          }
          try {
            await deps.assignerSalleClasse.execute({
              classId: classe.id,
              roomId: room.id,
              academicYearId: annee.id,
              schoolId: ctx.schoolId,
              demandeurRole: ctx.role,
            })
            affected.push({ classId: classe.id, className: classe.name, roomId: room.id, previousRoomId: previousByClass.get(classe.id) ?? null })
            assignedClasses.add(classe.id)
          } catch (error) {
            erreurs.push(`${classe.name} : ${error instanceof Error ? error.message : 'affectation impossible'}`)
          }
        }

        const skipped = classes.length - affected.length - missingRooms.length - erreurs.length
        const details = [
          `${affected.length} classe(s) affectée(s)`,
          `${skipped} déjà affectée(s)`,
          missingRooms.length > 0 ? `${missingRooms.length} sans salle du même nom` : null,
          erreurs.length > 0 ? `${erreurs.length} en erreur` : null,
        ].filter(Boolean).join(', ')
        return {
          resultLabel: `${details}.${missingRooms.length > 0 ? ` Salles manquantes : ${missingRooms.join(', ')}.` : ''}${erreurs.length > 0 ? ` Erreurs : ${erreurs.join(' | ')}.` : ''}`,
          undoData: { academicYearId: annee.id, previous: affected },
          section: 'configuration',
          entity: 'room',
        }
      },
      async undo(_params, undoData, ctx) {
        const academicYearId = String(undoData.academicYearId)
        const previous = Array.isArray(undoData.previous) ? undoData.previous : []
        for (const item of previous) {
          if (item.previousRoomId) {
            await deps.assignerSalleClasse.execute({
              classId: String(item.classId),
              roomId: String(item.previousRoomId),
              academicYearId,
              schoolId: ctx.schoolId,
              demandeurRole: ctx.role,
            })
          } else {
            await deps.retirerAssignationSalle.execute({
              classId: String(item.classId),
              academicYearId,
              schoolId: ctx.schoolId,
              demandeurRole: ctx.role,
            })
          }
        }
      },
    },
    {
      name: 'affecter_salle_classes',
      domain: 'salle_affectation',
      description: 'Affecte une salle habituelle à une ou plusieurs classes de l’année courante.',
      destructive: false,
      requiredPermission: 'MANAGE_CLASSES',
      inputSchema: z.object({
        roomName: z.string().trim().min(1).describe('Nom de la salle à affecter'),
        classNames: z.array(z.string().trim().min(1)).min(1).max(50).describe('Classes qui utiliseront cette salle'),
      }),
      async execute(input, ctx) {
        const annee = await resolveCurrentAcademicYear(ctx)
        const room = await ctx.prisma.room.findFirst({
          where: { schoolId: ctx.schoolId, name: input.roomName, status: 'ACTIVE', deletedAt: null },
          select: { id: true, name: true },
        })
        if (!room) throw new Error(`Aucune salle active nommée « ${input.roomName} » n'existe dans votre établissement.`)

        const requestedNames: string[] = [...new Set<string>(input.classNames.map((name: string) => norm(name)))]
        if (requestedNames.length !== input.classNames.length) throw new Error('La liste contient plusieurs fois la même classe.')

        const classes = await ctx.prisma.class.findMany({
          where: { schoolId: ctx.schoolId, academicYearId: annee.id, status: 'ACTIVE', deletedAt: null },
          select: { id: true, name: true },
        })
        const selectedClasses = requestedNames.map(requestedName => {
          const exact = classes.filter(classe => norm(classe.name) === requestedName)
          const matches = exact.length > 0 ? exact : classes.filter(classe => norm(classe.name).replace(/\s+/g, '') === requestedName.replace(/\s+/g, ''))
          if (matches.length === 0) throw new Error(`Aucune classe active nommée « ${requestedName} » n'existe pour l'année courante.`)
          if (matches.length > 1) throw new Error(`Plusieurs classes correspondent à « ${requestedName} ». Précisez le nom exact.`)
          return matches[0]
        })

        const previous = await ctx.prisma.classRoomAssignment.findMany({
          where: { schoolId: ctx.schoolId, academicYearId: annee.id, classId: { in: selectedClasses.map(classe => classe.id) } },
          select: { classId: true, roomId: true },
        })
        const previousByClass = new Map(previous.map(assignment => [assignment.classId, assignment.roomId]))
        const erreurs: string[] = []
        for (const classe of selectedClasses) {
          try {
            await deps.assignerSalleClasse.execute({
              classId: classe.id,
              roomId: room.id,
              academicYearId: annee.id,
              schoolId: ctx.schoolId,
              demandeurRole: ctx.role,
            })
          } catch (error) {
            erreurs.push(`${classe.name} : ${error instanceof Error ? error.message : 'affectation impossible'}`)
          }
        }
        if (erreurs.length === selectedClasses.length) throw new Error(erreurs.join(' | '))

        const resultLabel = erreurs.length > 0
          ? `Salle « ${room.name} » affectée à ${selectedClasses.length - erreurs.length} classe(s), ${erreurs.length} en échec : ${erreurs.join(' | ')}`
          : `Salle « ${room.name} » affectée à ${selectedClasses.length} classe(s)`
        return {
          resultLabel,
          undoData: {
            roomId: room.id,
            academicYearId: annee.id,
            previous: selectedClasses.map(classe => ({ classId: classe.id, previousRoomId: previousByClass.get(classe.id) ?? null })),
          },
          section: 'configuration',
          entity: 'room',
        }
      },
      async undo(_params, undoData, ctx) {
        const academicYearId = String(undoData.academicYearId)
        const previous = Array.isArray(undoData.previous) ? undoData.previous : []
        for (const item of previous) {
          if (item.previousRoomId) {
            await deps.assignerSalleClasse.execute({
              classId: String(item.classId),
              roomId: String(item.previousRoomId),
              academicYearId,
              schoolId: ctx.schoolId,
              demandeurRole: ctx.role,
            })
          } else {
            await deps.retirerAssignationSalle.execute({
              classId: String(item.classId),
              academicYearId,
              schoolId: ctx.schoolId,
              demandeurRole: ctx.role,
            })
          }
        }
      },
    },
  ]
}
