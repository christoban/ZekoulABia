import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { SocketNotificationService } from '../../../../../src/infrastructure/services/notification/SocketNotificationService.ts';
import { prisma } from '../../../../../src/infrastructure/persistence/prisma/prisma.client.ts';

type NotifRow = { id: string; userId: string; schoolId: string; deliveredAt: Date | null; confirmedAt: Date | null; readAt: Date | null };

describe('notification lifecycle (deliveredAt / confirmedAt)', () => {
  let store: Map<string, NotifRow>;
  let service: SocketNotificationService;

  beforeEach(() => {
    store = new Map<string, NotifRow>();
    // seed one notif
    store.set('n1', { id: 'n1', userId: 'u1', schoolId: 's1', deliveredAt: null, confirmedAt: null, readAt: null });
    store.set('n2', { id: 'n2', userId: 'u1', schoolId: 's1', deliveredAt: new Date('2026-01-01'), confirmedAt: null, readAt: null });

    // mock prisma.notification
    (prisma as any).notification = {
      findFirst: mock(async ({ where }: any) => {
        const row = store.get(where.id);
        if (!row) return null;
        if (where.userId && row.userId !== where.userId) return null;
        if (where.schoolId && row.schoolId !== where.schoolId) return null;
        return row;
      }),
      update: mock(async ({ where, data }: any) => {
        const row = store.get(where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      create: mock(async ({ data }: any) => {
        const id = `n_${Math.random().toString(36).slice(2)}`;
        const row = { id, userId: data.userId, schoolId: data.schoolId, deliveredAt: null, confirmedAt: null, readAt: null } as any;
        store.set(id, row);
        return { id };
      }),
      findMany: mock(async () => []),
      createMany: mock(async () => {}),
      updateMany: mock(async () => {}),
    };
    (prisma as any).user = { findMany: mock(async () => []) };
    (prisma as any).notificationPreference = { findUnique: mock(async () => null) };

    service = new SocketNotificationService();
  });

  it('marquerDelivree pose deliveredAt si null', async () => {
    const ok = await service.marquerDelivree({ notificationId: 'n1', userId: 'u1', schoolId: 's1' });
    expect(ok).toBe(true);
    expect(store.get('n1')!.deliveredAt).not.toBeNull();
  });

  it('marquerDelivree idempotent ne change pas la date', async () => {
    const first = new Date('2026-01-01');
    store.get('n2')!.deliveredAt = first;
    const ok = await service.marquerDelivree({ notificationId: 'n2', userId: 'u1', schoolId: 's1' });
    expect(ok).toBe(true);
    expect(store.get('n2')!.deliveredAt!.getTime()).toBe(first.getTime());
  });

  it('marquerDelivree mauvais userId → false / 404', async () => {
    const ok = await service.marquerDelivree({ notificationId: 'n1', userId: 'u2', schoolId: 's1' });
    expect(ok).toBe(false);
    expect(store.get('n1')!.deliveredAt).toBeNull();
  });

  it('marquerDelivree mauvais schoolId → false', async () => {
    const ok = await service.marquerDelivree({ notificationId: 'n1', userId: 'u1', schoolId: 's2' });
    expect(ok).toBe(false);
  });

  it('marquerDelivree introuvable → false', async () => {
    const ok = await service.marquerDelivree({ notificationId: 'nx', userId: 'u1', schoolId: 's1' });
    expect(ok).toBe(false);
  });

  it('marquerConfirmee pose confirmedAt si null', async () => {
    const ok = await service.marquerConfirmee({ notificationId: 'n1', userId: 'u1', schoolId: 's1' });
    expect(ok).toBe(true);
    expect(store.get('n1')!.confirmedAt).not.toBeNull();
  });

  it('marquerConfirmee idempotent', async () => {
    store.get('n1')!.confirmedAt = new Date('2026-02-01');
    const d = store.get('n1')!.confirmedAt!.getTime();
    const ok = await service.marquerConfirmee({ notificationId: 'n1', userId: 'u1', schoolId: 's1' });
    expect(ok).toBe(true);
    expect(store.get('n1')!.confirmedAt!.getTime()).toBe(d);
  });

  it('marquerConfirmee mauvais propriétaire → false', async () => {
    const ok = await service.marquerConfirmee({ notificationId: 'n1', userId: 'u2', schoolId: 's1' });
    expect(ok).toBe(false);
  });

  it('marquerLue avec ownership pose readAt', async () => {
    const okBefore = store.get('n1')!.readAt;
    expect(okBefore).toBeNull();
    await service.marquerLue('n1', 'u1', 's1');
    expect(store.get('n1')!.readAt).not.toBeNull();
  });

  it('envoyerAuRole boucle via envoyer (passe par urgency)', async () => {
    // add 2 users for role ADMIN
    (prisma as any).user.findMany = mock(async () => [{ id: 'uA' }, { id: 'uB' }]);
    // spy envoyer
    const spy = mock(async () => {});
    const svc = new SocketNotificationService();
    (svc as any).envoyer = spy;
    await svc.envoyerAuRole({ schoolId: 's1', role: 'ADMIN', type: 'SYSTEM', titre: 't', corps: 'c', urgency: 'NORMAL' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect((spy.mock.calls[0] as any)[0].userId).toBe('uA');
    expect((spy.mock.calls[1] as any)[0].urgency).toBe('NORMAL');
  });
});
