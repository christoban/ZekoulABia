import { describe, it, expect } from 'bun:test';
import { UserMfaPasswordController } from '@infrastructure/http/controllers/user/UserMfaPasswordController';
import type { OutboundMessagingPolicy } from '@domain/ports/services/OutboundMessagingPolicy';

describe('UserMfaPasswordController.forgotPassword — mode test', () => {
  it('répond neutre (200, success) sans créer de jeton quand le mode test est désactivé', async () => {
    const fakePolicy = { estActive: async () => false } as OutboundMessagingPolicy;
    const userRepository = {
      creerJetonReinitialisation: async () => {
        throw new Error('NE DOIT PAS');
      },
    };

    const controller = new UserMfaPasswordController(
      {} as never,
      userRepository as never,
      {} as never,
      fakePolicy,
    );

    const req = { body: { email: 'eleve@test.cm' } } as never;
    let statusCode = 0;
    let jsonPayload: unknown = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (payload: unknown) => {
        jsonPayload = payload;
      },
    } as never;
    const next = () => {};

    await controller.forgotPassword(req as never, res as never, next as never);

    expect((jsonPayload as { success: boolean }).success).toBe(true);
  });
});
