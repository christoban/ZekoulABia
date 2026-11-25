import { describe, it, expect } from 'bun:test';
import express, { type RequestHandler } from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ImporterProgressionsOfficiellesUseCase,
  SOURCE_IMPORT_OFFICIEL,
} from '@application/masterAdmin/progressions';
import type { MasterReferentielsRepository } from '@domain/ports/repositories/MasterReferentielsRepository';
import { MasterReferentielsController } from '@infrastructure/http/controllers/MasterReferentielsController';
import { MasterProgressionsImportController } from '@infrastructure/http/controllers/MasterProgressionsImportController';
import { creerMasterReferentielsRoutes } from '@infrastructure/http/routes/masterReferentiels.routes';
import { InMemoryOfficialProgressionImportRepository } from '../../application/masterAdmin/helpers/InMemoryOfficialProgressionImportRepository';

function buildPayload600Ko(): { body: string; byteLength: number; totalLecons: number } {
  const matieres = [
    'Mathématiques',
    'Français',
    'Anglais',
    'Histoire',
    'Géographie',
    'Sciences',
    'Informatique',
    'EPS',
    'Cultures Nationales',
    'Langues Nationales',
    'Travail Manuel',
  ];
  const leconsParMatiere = 105; // 11 * 105 = 1 155 leçons (~600+ Ko)
  const items = matieres.map((subjectName) => ({
    templateCode: '__ALL__',
    level: '6e',
    filiere: 'FR_GENERAL',
    subjectName,
    subjectNameSource: `${subjectName} 6e MINESEC`,
    titre: `Programme Officiel ${subjectName} 6e (MINESEC Distance Learning)`,
    chapitres: Array.from({ length: leconsParMatiere }, (_, idx) => {
      const moduleOrdre = Math.floor(idx / 15) + 1;
      const positionDansModule = (idx % 15) + 1;
      return {
        ordre: idx + 1,
        titre: `Leçon ${positionDansModule} — Compétence opérationnelle et situation problème détaillée en ${subjectName} (activité ${idx + 1}, application guidée et consolidation des savoirs fondamentaux)`,
        moduleOrdre,
        moduleTitre: `Module ${moduleOrdre} : Famille de situations et thématique officielle MINESEC pour la classe de Sixième`,
        leconNumero: positionDansModule % 12 === 0 ? null : positionDansModule,
        numeroAffiche: positionDansModule % 12 === 0 ? 'TD / Intégration' : `Leçon ${positionDansModule}`,
        positionDansModule,
        positionSource: idx + 1,
        sourceUrl: `https://minesec-distancelearning.cm/enseignement-general/francophone/6e/${encodeURIComponent(subjectName.toLowerCase())}/module-${moduleOrdre}/lecon-${positionDansModule}`,
        exclure: false,
      };
    }),
  }));

  const body = JSON.stringify({
    source: SOURCE_IMPORT_OFFICIEL,
    level: '6e',
    items,
  });

  return {
    body,
    byteLength: Buffer.byteLength(body, 'utf8'),
    totalLecons: matieres.length * leconsParMatiere,
  };
}

async function startServer(app: express.Application): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function buildTestRouter(repo: InMemoryOfficialProgressionImportRepository) {
  const dummyReferentielsRepo = {} as unknown as MasterReferentielsRepository;
  const masterRefCtrl = new MasterReferentielsController(dummyReferentielsRepo);
  const useCase = new ImporterProgressionsOfficiellesUseCase(repo);
  const noopAudit = async () => {};
  const importCtrl = new MasterProgressionsImportController(useCase, noopAudit);

  const stubProtect: RequestHandler = (req, _res, next) => {
    req.masterUser = {
      id: 'master_test_1',
      email: 'master@zekoulabia.test',
      role: 'super_admin',
    };
    next();
  };
  const stubAuthorize: RequestHandler = (_req, _res, next) => next();

  return creerMasterReferentielsRoutes(masterRefCtrl, importCtrl, {
    protect: stubProtect,
    authorize: stubAuthorize,
  });
}

describe('Point 1 — Limite réelle express.json (~600 Ko, ~1 155 leçons) selon l\'ordre des middlewares', () => {
  it('accepte un corps JSON > 600 Ko sur /import/propose et /import/apply dans le montage réel (server.ts / app.ts : express.json 5mb avant les routes)', async () => {
    const repo = new InMemoryOfficialProgressionImportRepository();
    repo.seedSubjects(
      { templateCode: '__ALL__', level: '6e', filiere: 'FR_GENERAL' },
      [
        'Mathématiques',
        'Français',
        'Anglais',
        'Histoire',
        'Géographie',
        'Sciences',
        'Informatique',
        'EPS',
        'Cultures Nationales',
        'Langues Nationales',
        'Travail Manuel',
      ],
    );

    const payload = buildPayload600Ko();
    expect(payload.byteLength).toBeGreaterThan(600_000);
    expect(payload.totalLecons).toBe(1155);

    // Montage identique à server.ts:78 et app.ts:10 (express.json({ limit: '5mb' }) avant bootstrapHexagonal)
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/v2/master/referentiels', buildTestRouter(repo));

    const { server, baseUrl } = await startServer(app);
    try {
      const resPropose = await fetch(`${baseUrl}/api/v2/master/referentiels/progressions/import/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload.body,
      });
      expect(resPropose.status).toBe(200);
      const jsonPropose = (await resPropose.json()) as {
        success: boolean;
        data: { resume: { aCreer: number; leconsRetenues: number; rejetes: number }; source: string };
      };
      expect(jsonPropose.success).toBe(true);
      expect(jsonPropose.data.resume.aCreer).toBe(11);
      expect(jsonPropose.data.resume.leconsRetenues).toBe(1155);
      expect(jsonPropose.data.resume.rejetes).toBe(0);
      expect(jsonPropose.data.source).toBe('minesec-distance-learning');

      const resApply = await fetch(`${baseUrl}/api/v2/master/referentiels/progressions/import/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload.body,
      });
      expect(resApply.status).toBe(200);
      const jsonApply = (await resApply.json()) as {
        success: boolean;
        data: { createdCount: number; totalAffected: number; source: string };
      };
      expect(jsonApply.success).toBe(true);
      expect(jsonApply.data.createdCount).toBe(11);
      expect(jsonApply.data.totalAffected).toBe(11);
      expect(jsonApply.data.source).toBe('minesec-distance-learning');
      expect(repo.rows.size).toBe(11);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('prouve qu\'un express.json() global par défaut (100 Ko) monté avant la route rejette le même corps de ~600 Ko en 413', async () => {
    const repo = new InMemoryOfficialProgressionImportRepository();
    const payload = buildPayload600Ko();
    expect(payload.byteLength).toBeGreaterThan(600_000);

    // Ancien comportement d'app.ts:10 (express.json() sans limite = 100 Ko AVANT les routes)
    const appLegacy100Ko = express();
    appLegacy100Ko.use(express.json());
    appLegacy100Ko.use('/api/v2/master/referentiels', buildTestRouter(repo));

    const { server, baseUrl } = await startServer(appLegacy100Ko);
    try {
      const res = await fetch(`${baseUrl}/api/v2/master/referentiels/progressions/import/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload.body,
      });
      expect(res.status).toBe(413);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

