import { describe, it, expect, beforeEach } from 'bun:test';
import { MetricCache } from '../../../src/infrastructure/cache/MetricCache';

describe('MetricCache — in-memory', () => {
  let cache: MetricCache;

  beforeEach(() => {
    cache = new MetricCache();
  });

  it('miss puis hit', async () => {
    const dims = { schoolId: 's1', classId: 'c1', studentId: 'e1' };
    expect(await cache.get('taux_presence', dims)).toBeNull();
    await cache.set('taux_presence', dims, 75);
    const hit = await cache.get('taux_presence', dims);
    expect(hit).not.toBeNull();
    expect(hit!.value).toBe(75);
  });

  it('expiration TTL', async () => {
    const dims = { schoolId: 's1', classId: 'c1', studentId: 'e1' };
    await cache.set('moyenne_generale', dims, 14.5);
    // Force expiration en manipulant l'entrée interne
    const key = (cache as any).store.keys().next().value as string;
    const entry = (cache as any).store.get(key);
    entry.entry.expiresAt = new Date(Date.now() - 1000);
    expect(await cache.get('moyenne_generale', dims)).toBeNull();
  });

  it('invalidation par préfixe', async () => {
    await cache.set('taux_presence', { schoolId: 's1', classId: 'c1', studentId: 'e1' }, 80);
    await cache.set('taux_presence', { schoolId: 's1', classId: 'c1', studentId: 'e2' }, 90);
    await cache.set('taux_presence', { schoolId: 's1', classId: 'c2', studentId: 'e3' }, 70);
    await cache.set('moyenne_generale', { schoolId: 's1', classId: 'c1', studentId: 'e1' }, 12);

    const n = await cache.invalidate('taux_presence', { schoolId: 's1', classId: 'c1' });
    expect(n).toBe(2);
    expect(await cache.get('taux_presence', { schoolId: 's1', classId: 'c1', studentId: 'e1' })).toBeNull();
    expect(await cache.get('taux_presence', { schoolId: 's1', classId: 'c2', studentId: 'e3' })).not.toBeNull();
    expect(await cache.get('moyenne_generale', { schoolId: 's1', classId: 'c1', studentId: 'e1' })).not.toBeNull();
  });

  it('invalidation par école', async () => {
    await cache.set('taux_presence', { schoolId: 's1', classId: 'c1', studentId: 'e1' }, 80);
    await cache.set('taux_presence', { schoolId: 's2', classId: 'c1', studentId: 'e1' }, 90);
    await cache.set('moyenne_generale', { schoolId: 's1', classId: 'c1', studentId: 'e1' }, 12);
    const n = await cache.invalidateBySchool('s1');
    expect(n).toBe(2);
    expect(await cache.get('taux_presence', { schoolId: 's1', classId: 'c1', studentId: 'e1' })).toBeNull();
    expect(await cache.get('taux_presence', { schoolId: 's2', classId: 'c1', studentId: 'e1' })).not.toBeNull();
  });

  it('clé stable — ordre des dimensions indifférent', async () => {
    await cache.set('taux_presence', { schoolId: 's1', classId: 'c1', studentId: 'e1' }, 42);
    const hit = await cache.get('taux_presence', { studentId: 'e1', schoolId: 's1', classId: 'c1' } as any);
    expect(hit?.value).toBe(42);
  });
});
