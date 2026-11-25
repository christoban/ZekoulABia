import { describe, it, expect } from 'bun:test';
import { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';

function creerRepoFake() {
  const appels: any[] = [];
  const repo = {
    listBySchool: async (input: any) => { appels.push(input); return { logs: [], total: 0 }; },
  } as any;
  return { repo, appels };
}

function creerReqRes(user: { schoolId: string; role: string }, query: Record<string, string>) {
  const req = { user, query } as any;
  let jsonPayload: any = null;
  const res = { json: (payload: any) => { jsonPayload = payload; } } as any;
  const next = (err: any) => { throw err; };
  return { req, res, next, getJson: () => jsonPayload };
}

describe('AIActionAuditController.journalEtablissement — cloisonnement établissement', () => {
  it('filtre toujours sur le schoolId de la session, jamais sur un schoolId fourni par le client', async () => {
    const { repo, appels } = creerRepoFake();
    const controller = new AIActionAuditController(repo);

    // Un admin de l'école "ecole-legitime" tente de forcer un autre schoolId via la query —
    // le contrôleur ne lit même pas ce champ, mais on vérifie ici le comportement réel bout en bout.
    const { req, res, next } = creerReqRes(
      { schoolId: 'ecole-legitime', role: 'ADMIN' },
      { schoolId: 'ecole-victime' } as any,
    );

    await controller.journalEtablissement(req, res, next);

    expect(appels).toHaveLength(1);
    expect(appels[0].schoolId).toBe('ecole-legitime');
  });

  it('applique les filtres optionnels (outcome, origin) sans jamais permettre de changer le schoolId', async () => {
    const { repo, appels } = creerRepoFake();
    const controller = new AIActionAuditController(repo);

    const { req, res, next } = creerReqRes(
      { schoolId: 'ecole-A', role: 'ADMIN' },
      { outcome: 'REFUSE', origin: 'AI_ASSISTANT' },
    );

    await controller.journalEtablissement(req, res, next);

    expect(appels[0].schoolId).toBe('ecole-A');
    expect(appels[0].outcome).toBe('REFUSE');
    expect(appels[0].origin).toBe('AI_ASSISTANT');
  });

  it('renvoie une réponse paginée même quand le journal est vide', async () => {
    const { repo } = creerRepoFake();
    const controller = new AIActionAuditController(repo);
    const { req, res, next, getJson } = creerReqRes({ schoolId: 'ecole-A', role: 'ADMIN' }, {});

    await controller.journalEtablissement(req, res, next);

    const payload = getJson();
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([]);
    expect(payload.pagination.total).toBe(0);
  });
});
