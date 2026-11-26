import { describe, it, expect } from 'bun:test';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { PrismaMasterReferentielsRepository } from '@infrastructure/persistence/prisma/PrismaMasterReferentielsRepository';
import { MasterReferentielsController } from '@infrastructure/http/controllers/MasterReferentielsController';
import type { OfficialProgressionRecord } from '@domain/ports/repositories/MasterReferentielsRepository';

function makeRecord(index: number): OfficialProgressionRecord {
  const now = new Date('2026-11-26T00:00:00Z');
  const isFr = index <= 140;
  const level = isFr ? (index <= 70 ? '6e' : '4e') : 'Form1';
  const filiere = isFr ? (index % 2 === 0 ? 'FR_GENERAL' : 'FR_PEBS') : 'EN_GENERAL';
  return {
    id: `prog-${index}`,
    templateCode: '__ALL__',
    level,
    filiere,
    subjectName: index % 10 === 0 ? `Mathématiques ${index}` : `Matière ${String(index).padStart(3, '0')}`,
    titre: `Programme officiel ${level} ${index}`,
    chapitres: [],
    source: 'minesec-distance-learning',
    manuallyEdited: false,
    importChecksum: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

function filterRows(
  rows: OfficialProgressionRecord[],
  where?: Record<string, unknown>,
): OfficialProgressionRecord[] {
  if (!where) return rows;
  return rows.filter((r) => {
    if (typeof where.templateCode === 'string' && r.templateCode !== where.templateCode) return false;
    if (typeof where.level === 'string' && r.level !== where.level) return false;
    if (typeof where.filiere === 'string' && r.filiere !== where.filiere) return false;
    if (Array.isArray(where.OR)) {
      const matched = where.OR.some((clause) => {
        const c = clause as Record<string, { contains?: string }>;
        const needle = (
          c.subjectName?.contains ?? c.titre?.contains ?? c.level?.contains ?? c.filiere?.contains ?? ''
        ).toLowerCase();
        if (!needle) return false;
        return (
          r.subjectName.toLowerCase().includes(needle)
          || r.titre.toLowerCase().includes(needle)
          || r.level.toLowerCase().includes(needle)
          || r.filiere.toLowerCase().includes(needle)
        );
      });
      if (!matched) return false;
    }
    return true;
  });
}

function createFakePrisma(allItems: OfficialProgressionRecord[]) {
  const calls: Array<{ skip?: number; take?: number; where?: unknown }> = [];
  const fakePrisma = {
    officialProgrammeProgression: {
      async findMany(args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
        distinct?: string[];
      }) {
        const filtered = filterRows(allItems, args.where);
        if (args.distinct?.includes('level')) {
          const uniq = Array.from(new Set(filtered.map((r) => r.level))).sort();
          return uniq.map((level) => ({ level }));
        }
        if (args.distinct?.includes('filiere')) {
          const uniq = Array.from(new Set(filtered.map((r) => r.filiere))).sort();
          return uniq.map((filiere) => ({ filiere }));
        }
        calls.push({ skip: args.skip, take: args.take, where: args.where });
        const start = args.skip ?? 0;
        const end = args.take !== undefined ? start + args.take : filtered.length;
        return filtered.slice(start, end);
      },
      async count(args: { where?: Record<string, unknown> }) {
        return filterRows(allItems, args.where).length;
      },
    },
  };
  return { prisma: fakePrisma as unknown as PrismaClient, calls };
}

describe('MasterReferentiels — pagination & filtres des progressions officielles (> 200 lignes)', () => {
  const dataset308 = Array.from({ length: 308 }, (_, idx) => makeRecord(idx + 1));

  it('ne tronque plus à 200 lignes, renvoie les facettes et parcourt les 308 progressions', async () => {
    const { prisma, calls } = createFakePrisma(dataset308);
    const repo = new PrismaMasterReferentielsRepository(prisma);

    const page1 = await repo.listProgressions({});
    expect(page1.total).toBe(308);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(50);
    expect(page1.pages).toBe(7);
    expect(page1.items).toHaveLength(50);
    expect(page1.facets.levels).toEqual(['4e', '6e', 'Form1']);
    expect(page1.facets.filieres).toEqual(['EN_GENERAL', 'FR_GENERAL', 'FR_PEBS']);

    const page7 = await repo.listProgressions({ page: 7, limit: 50 });
    expect(page7.items).toHaveLength(8);
    expect(page7.items[0]?.id).toBe('prog-301');
    expect(page7.items[7]?.id).toBe('prog-308');
    expect(calls[1]?.skip).toBe(300);
    expect(calls[1]?.take).toBe(50);
  });

  it('filtre par niveau, filière et recherche matière via MasterReferentielsController avec total filtré exact', async () => {
    const { prisma } = createFakePrisma(dataset308);
    const repo = new PrismaMasterReferentielsRepository(prisma);
    const controller = new MasterReferentielsController(repo);

    let capturedBody: Record<string, unknown> | null = null;
    const req = {
      query: { level: '6e', filiere: 'FR_GENERAL', search: 'Mathématiques', page: '1', limit: '50' },
    } as unknown as Request;
    const res = {
      json(body: Record<string, unknown>) {
        capturedBody = body;
        return this;
      },
    } as unknown as Response;
    const next: NextFunction = (err?: unknown) => {
      if (err) throw err;
    };

    await controller.getProgressions(req, res, next);

    const payload = capturedBody as unknown as {
      success: boolean;
      data: OfficialProgressionRecord[];
      pagination: { page: number; limit: number; total: number; pages: number };
      facets: { levels: string[]; filieres: string[] };
    };
    expect(payload.success).toBe(true);
    // indices 10, 20, 30, 40, 50, 60, 70 -> tous pairs (FR_GENERAL) et <= 70 (6e) => 7 résultats
    expect(payload.pagination).toEqual({ page: 1, limit: 50, total: 7, pages: 1 });
    expect(payload.data).toHaveLength(7);
    expect(payload.facets.levels).toContain('6e');
    expect(payload.facets.filieres).toContain('FR_GENERAL');
  });
});
