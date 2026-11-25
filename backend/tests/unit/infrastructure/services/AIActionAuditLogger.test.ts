import { describe, it, expect } from 'bun:test';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';

function creerPrismaFake() {
  const appels: any[] = [];
  const prisma = {
    aIActionAuditLog: {
      create: async (args: any) => { appels.push(args); return { id: 'log-1' }; },
    },
  } as any;
  return { prisma, appels };
}

// journaliserActionIA est fire-and-forget (ne s'awaite pas dans l'appelant) — on laisse la
// microtask du .create() se résoudre avant d'inspecter les appels.
async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('journaliserActionIA', () => {
  it('écrit une entrée REFUSE avec origin/actionName corrects', async () => {
    const { prisma, appels } = creerPrismaFake();
    journaliserActionIA(prisma, {
      actorUserId: 'user-1', actorRole: 'TEACHER', schoolId: 'school-1',
      actionName: 'saisir_note', origin: 'AI_ASSISTANT', outcome: 'REFUSE',
      refusalReason: 'action_hors_catalogue_autorise',
    });
    await tick();

    expect(appels).toHaveLength(1);
    expect(appels[0].data.origin).toBe('AI_ASSISTANT');
    expect(appels[0].data.outcome).toBe('REFUSE');
    expect(appels[0].data.actionName).toBe('saisir_note');
    expect(appels[0].data.refusalReason).toBe('action_hors_catalogue_autorise');
  });

  it('rédige les clés sensibles dans parametersSummary, ne les laisse jamais en clair', async () => {
    const { prisma, appels } = creerPrismaFake();
    journaliserActionIA(prisma, {
      actorUserId: 'user-1', actorRole: 'ADMIN', schoolId: 'school-1',
      actionName: 'creer_eleve', origin: 'UI_DIRECT', outcome: 'SUCCES',
      parametersSummary: { studentName: 'Awa Fouda', password: 'hunter2', motDePasse: 'azert123', otpCode: '482913' },
    });
    await tick();

    const params = appels[0].data.parametersSummary;
    expect(params.studentName).toBe('Awa Fouda'); // donnée non sensible : intacte
    expect(params.password).toBe('[rédigé]');
    expect(params.motDePasse).toBe('[rédigé]');
    expect(params.otpCode).toBe('[rédigé]');
  });

  it('ne plante pas l\'appelant si le journal échoue à écrire (fire-and-forget)', () => {
    const prisma = {
      aIActionAuditLog: { create: async () => { throw new Error('DB indisponible'); } },
    } as any;
    expect(() => journaliserActionIA(prisma, {
      actorUserId: 'user-1', actorRole: 'TEACHER', origin: 'AI_ASSISTANT', outcome: 'ERREUR',
      actionName: 'saisir_note',
    })).not.toThrow();
  });
});
