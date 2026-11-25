import { describe, it, expect } from 'bun:test';
import { PrismaStudentFollowUpRepository } from '@infrastructure/persistence/prisma/PrismaStudentFollowUpRepository';

// Fausse table Prisma minimale — vérifie que close()/reassign() écrivent de façon atomique
// (condition status <> CLOS DANS la clause WHERE de l'écriture elle-même, pas seulement lue à
// l'avance côté use case) et rejettent proprement si la course est perdue (count === 0),
// plutôt que d'écraser silencieusement une clôture concurrente.
function creerPrismaFake(actionInitiale: { id: string; status: string }) {
  let statutActuel = actionInitiale.status;
  const appelsUpdateMany: any[] = [];
  const prisma = {
    studentFollowUpAction: {
      updateMany: async ({ where, data }: any) => {
        appelsUpdateMany.push({ where, data });
        const correspond =
          where.id === actionInitiale.id &&
          (where.status === undefined || (where.status.not && statutActuel !== where.status.not));
        if (!correspond) return { count: 0 };
        statutActuel = data.status ?? statutActuel;
        return { count: 1 };
      },
      findUniqueOrThrow: async ({ where }: any) => {
        if (where.id !== actionInitiale.id) throw new Error('introuvable');
        return {
          id: actionInitiale.id, schoolId: 's1', studentProfileId: 'sp1',
          triggeringRecommendationId: null, subjectId: null, type: 'OBSERVATION',
          status: statutActuel, createdById: 'u1', assignedToId: 'u2',
          targetDate: null, interviewMode: null, note: null, createdAt: new Date(),
          closedAt: null, closedById: null, closingNote: null,
          studentProfile: {
            userId: 'stu1', user: { firstName: 'A', lastName: 'B' },
            enrollmentsYearScoped: [{ classId: 'c1', class: { name: '3eA', professorPrincipalId: null } }],
          },
          subject: null, createdBy: { firstName: 'X', lastName: 'Y' }, assignedTo: null, closedBy: null,
        };
      },
    },
  } as any;
  return { prisma, appelsUpdateMany, getStatut: () => statutActuel };
}

describe('PrismaStudentFollowUpRepository — atomicité clôture/réassignation', () => {
  it('close() inclut status <> CLOS dans le WHERE de l\'écriture, pas seulement une lecture préalable', async () => {
    const { prisma, appelsUpdateMany } = creerPrismaFake({ id: 'a1', status: 'OUVERT' });
    const repo = new PrismaStudentFollowUpRepository(prisma);

    await repo.close('a1', 'u1', 'note de clôture');

    expect(appelsUpdateMany).toHaveLength(1);
    expect(appelsUpdateMany[0].where).toEqual({ id: 'a1', status: { not: 'CLOS' } });
  });

  it('close() rejette proprement si l\'action est déjà CLOS au moment de l\'écriture (course perdue)', async () => {
    const { prisma } = creerPrismaFake({ id: 'a1', status: 'CLOS' });
    const repo = new PrismaStudentFollowUpRepository(prisma);

    await expect(repo.close('a1', 'u1', 'note')).rejects.toThrow('déjà clôturée');
  });

  it('deux clôtures concurrentes : la seconde échoue au lieu d\'écraser silencieusement la première', async () => {
    const { prisma } = creerPrismaFake({ id: 'a1', status: 'OUVERT' });
    const repo = new PrismaStudentFollowUpRepository(prisma);

    const premiere = await repo.close('a1', 'createur', 'note du créateur');
    expect(premiere.status).toBe('CLOS');

    await expect(repo.close('a1', 'assigne', 'note de l\'assigné')).rejects.toThrow('déjà clôturée');
  });

  it('reassign() inclut aussi status <> CLOS dans le WHERE et rejette si déjà clôturée', async () => {
    const { prisma: prismaOuvert, appelsUpdateMany } = creerPrismaFake({ id: 'a1', status: 'OUVERT' });
    const repoOuvert = new PrismaStudentFollowUpRepository(prismaOuvert);
    await repoOuvert.reassign('a1', 'nouveau-conseiller');
    expect(appelsUpdateMany[0].where).toEqual({ id: 'a1', status: { not: 'CLOS' } });

    const { prisma: prismaClos } = creerPrismaFake({ id: 'a1', status: 'CLOS' });
    const repoClos = new PrismaStudentFollowUpRepository(prismaClos);
    await expect(repoClos.reassign('a1', 'nouveau-conseiller')).rejects.toThrow('déjà clôturée');
  });
});
