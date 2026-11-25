import { describe, it, expect } from 'bun:test';
import { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';

class FakeEventPublisher implements EventPublisher {
  emitted: Array<{ eventName: string; data: Record<string, unknown> }> = [];
  async emit(eventName: string, data: Record<string, unknown>): Promise<void> {
    this.emitted.push({ eventName, data });
  }
}

describe('MasterAdminHexController.declencherSauvegarde — émission eventPublisher', () => {
  it('émet backup/school.requested avec le bon payload', async () => {
    const fakePublisher = new FakeEventPublisher();
    const controller = new MasterAdminHexController(
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      {} as unknown as never,
      fakePublisher,
    );

    const req = {
      masterUser: { id: 'master-1' },
      body: { schoolId: 'school-123' },
      headers: {},
      ip: '127.0.0.1',
    } as unknown as never;

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
    } as unknown as never;
    const next = () => {};

    await controller.declencherSauvegarde(req as never, res as never, next as never);

    expect(fakePublisher.emitted).toHaveLength(1);
    expect(fakePublisher.emitted[0]?.eventName).toBe('backup/school.requested');
    expect(fakePublisher.emitted[0]?.data).toMatchObject({
      schoolId: 'school-123',
      requestedByMasterId: 'master-1',
      source: 'manual',
    });
    expect(statusCode).toBe(202);
    expect((jsonPayload as { success: boolean }).success).toBe(true);
  });
});
