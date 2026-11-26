/**
 * Parcours HTTP de bout en bout (E2E) — Matérialisation des programmes nationaux (Lots 1, 2 & 3).
 *
 * Exécution :
 *   cd backend && bun --env-file .env.test scripts/e2e-pedagogie-materialisation.ts
 *
 * Sécurité stricte :
 * - Refuse de démarrer si DATABASE_URL ne pointe pas sur localhost/127.0.0.1:5432/zekoulabia_test.
 * - Démarre un serveur backend réel sur un port local dédié (5519) avec le flag activé uniquement
 *   pour l'école de test (OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS).
 * - Neutralise les notifications (clés externes vidées + appel relances en dry-run /propose uniquement).
 * - Nettoie intégralement toutes les données créées dans zekoulabia_test en fin d'exécution.
 */
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL ?? '';
if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):5432\/zekoulabia_test(\?|$)/.test(dbUrl)) {
  throw new Error(`REFUS DE SÉCURITÉ : DATABASE_URL doit pointer sur localhost:5432/zekoulabia_test (reçu : ${dbUrl})`);
}

const PORT = 5519;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'e2e_local_test_jwt_secret_zekoulabia';

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

function signAccessToken(payload: {
  userId: string;
  schoolId: string;
  role: string;
  permissions: string[];
}): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, JWT_SECRET, { expiresIn: '30m' });
}

async function apiJson<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Cookie: `access_token=${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

async function apiText(
  path: string,
  token: string,
): Promise<{ status: number; contentType: string; hasUtf8Bom: boolean; text: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { Cookie: `access_token=${token}` },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    hasUtf8Bom,
    text: new TextDecoder('utf-8').decode(bytes),
  };
}

async function waitForServer(timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/v2/pedagogie/materialisation/status`);
      // 401 = serveur express démarré et middleware auth actif
      if (res.status === 401 || res.status === 200) return;
    } catch {
      // en attente du bind
    }
    await Bun.sleep(250);
  }
  throw new Error(`Le serveur backend E2E n'a pas répondu sur ${BASE_URL} en ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  const runTag = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const templateCode = `TPL_${runTag}`;
  const createdOfficialIds: string[] = [];
  let schoolId: string | null = null;
  let serverProc: ReturnType<typeof Bun.spawn> | null = null;

  try {
    console.log(`[E2E] 1. Préparation des données isolées dans zekoulabia_test (${runTag})...`);
    await prisma.schoolTemplate.create({
      data: {
        code: templateCode,
        name: `Template E2E ${runTag}`,
        subsystem: 'FRANCOPHONE',
        educationType: 'GENERAL',
        level: 'SECONDARY',
        config: {},
      },
    });

    const school = await prisma.school.create({
      data: {
        name: `Lycée Pilote E2E ${runTag}`,
        subdomain: `e2e-${runTag}`,
        templateCode,
      },
    });
    schoolId = school.id;

    const admin = await prisma.user.create({
      data: {
        schoolId,
        email: `admin-${runTag}@test.local`,
        role: 'ADMIN',
        firstName: 'Proviseur',
        lastName: 'Pilote',
        isActive: true,
        refreshTokenVersion: 0,
      },
    });

    const teacher = await prisma.user.create({
      data: {
        schoolId,
        email: `prof-${runTag}@test.local`,
        role: 'TEACHER',
        firstName: 'Jean',
        lastName: 'Enseignant',
        isActive: true,
        refreshTokenVersion: 0,
      },
    });

    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `2025-2026-${runTag}`,
        startDate: new Date(Date.now() - 80 * 86400000),
        endDate: new Date(Date.now() + 20 * 86400000),
        isCurrent: true,
        status: 'ACTIVE',
      },
    });

    const classe6e = await prisma.class.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        name: `6e A ${runTag}`,
        level: '6e',
        filiere: 'FR_GENERAL',
        status: 'ACTIVE',
      },
    });

    const deptMaths = await prisma.department.create({
      data: { schoolId, name: 'Mathématiques', color: '#2563eb' },
    });

    const [subMaths, subTm] = await Promise.all([
      prisma.subject.create({ data: { schoolId, name: 'Mathématiques', departmentId: deptMaths.id } }),
      prisma.subject.create({ data: { schoolId, name: 'Travail Manuel' } }),
    ]);

    await prisma.teachingAssignment.createMany({
      data: [
        { schoolId, academicYearId: academicYear.id, classId: classe6e.id, subjectId: subMaths.id, teacherId: teacher.id },
        { schoolId, academicYearId: academicYear.id, classId: classe6e.id, subjectId: subTm.id, teacherId: teacher.id },
      ],
    });

    const [offMaths, offTm] = await Promise.all([
      prisma.officialProgrammeProgression.create({
        data: {
          templateCode,
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Mathématiques',
          titre: 'Programme Officiel Mathématiques 6e',
          importChecksum: 'e2e_maths_v1',
          source: 'minesec-distance-learning',
          chapitres: [
            { ordre: 1, titre: 'Nombres entiers naturels', moduleOrdre: 1, moduleTitre: 'Nombres', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
            { ordre: 2, titre: 'Ancienne leçon retirée en v2', moduleOrdre: 1, moduleTitre: 'Nombres', positionDansModule: 2, numeroAffiche: 'Leçon 2' },
            { ordre: 3, titre: 'Droites du plan', moduleOrdre: 2, moduleTitre: 'Géométrie', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
          ],
        },
      }),
      prisma.officialProgrammeProgression.create({
        data: {
          templateCode,
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: 'Travail Manuel',
          titre: 'Programme Officiel Travail Manuel 6e',
          importChecksum: 'e2e_tm_v1',
          source: 'minesec-distance-learning',
          chapitres: [
            { ordre: 1, titre: 'Préparation du sol', moduleOrdre: 1, moduleTitre: 'Atelier Agriculture', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
            { ordre: 2, titre: 'Semis et entretien', moduleOrdre: 1, moduleTitre: 'Atelier Agriculture', positionDansModule: 2, numeroAffiche: 'Leçon 2' },
            { ordre: 3, titre: 'Poulailler familial', moduleOrdre: 2, moduleTitre: 'Atelier Élevage', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
            { ordre: 4, titre: 'Alimentation avicole', moduleOrdre: 2, moduleTitre: 'Atelier Élevage', positionDansModule: 2, numeroAffiche: 'Leçon 2' },
          ],
        },
      }),
    ]);
    createdOfficialIds.push(offMaths.id, offTm.id);

    console.log(`[E2E] 2. Démarrage du serveur backend réel sur ${BASE_URL} (flag actif uniquement pour ${schoolId})...`);
    serverProc = Bun.spawn(['bun', 'src/server.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(PORT),
        DATABASE_URL: dbUrl,
        JWT_SECRET,
        ENABLE_OFFICIAL_PROGRAMMES_MATERIALISATION: 'true',
        OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS: schoolId,
        // Neutralisation stricte des canaux de notification externes
        RESEND_API_KEY: '',
        SMTP_HOST: '',
        TWILIO_ACCOUNT_SID: '',
        TWILIO_AUTH_TOKEN: '',
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await waitForServer();

    const adminToken = signAccessToken({ userId: admin.id, schoolId, role: 'ADMIN', permissions: [] });
    const teacherToken = signAccessToken({ userId: teacher.id, schoolId, role: 'TEACHER', permissions: [] });
    const nonPilotToken = signAccessToken({ userId: admin.id, schoolId: 'other_non_pilot_school', role: 'ADMIN', permissions: [] });

    // Étape 3 : Vérification statut pilote vs hors pilote
    const stPilot = await apiJson<{ success: boolean; data: { enabled: boolean } }>(
      '/api/v2/pedagogie/materialisation/status',
      adminToken,
    );
    assert.equal(stPilot.status, 200);
    assert.equal(stPilot.body.data.enabled, true);

    const stOther = await apiJson<{ success: boolean; data: { enabled: boolean } }>(
      '/api/v2/pedagogie/materialisation/status',
      nonPilotToken,
    );
    assert.equal(stOther.status, 200);
    assert.equal(stOther.body.data.enabled, false);

    const blockedOther = await apiJson<{ success: boolean }>(
      `/api/v2/pedagogie/classes/${classe6e.id}/initialiser-programmes/propose`,
      nonPilotToken,
      { method: 'POST', body: {} },
    );
    assert.equal(blockedOther.status, 403);
    console.log('[E2E] 3. Feature flag par école pilote vérifié (pilote=200/enabled, hors pilote=enabled:false & 403).');

    // Étape 4 : Initialisation de la classe (propose puis apply)
    const propRes = await apiJson<{ success: boolean; data: { aCreer: Array<{ subjectNameNational: string }> } }>(
      `/api/v2/pedagogie/classes/${classe6e.id}/initialiser-programmes/propose`,
      adminToken,
      { method: 'POST', body: {} },
    );
    assert.equal(propRes.status, 200);
    assert.equal(propRes.body.data.aCreer.length, 2);

    const applyRes = await apiJson<{ success: boolean; data: { totalCrees: number; totalLeconsCreees: number } }>(
      `/api/v2/pedagogie/classes/${classe6e.id}/initialiser-programmes/apply`,
      adminToken,
      { method: 'POST', body: {} },
    );
    assert.equal(applyRes.status, 201);
    assert.equal(applyRes.body.data.totalCrees, 2);
    assert.equal(applyRes.body.data.totalLeconsCreees, 7);
    console.log(`[E2E] 4. Initialisation 6e OK (${applyRes.body.data.totalCrees} programmes, ${applyRes.body.data.totalLeconsCreees} leçons).`);

    // Étape 5 : Enseignant consulte la progression et coche des leçons (Maths L1 + L2, Travail Manuel L1)
    const progMaths1 = await apiJson<{
      success: boolean;
      data: { programme: { id: string }; chapitres: Array<{ id: string; ordre: number; titre: string }> };
    }>(`/api/v2/pedagogie/progression?classId=${classe6e.id}&subjectId=${subMaths.id}`, teacherToken);
    assert.equal(progMaths1.status, 200);
    const mathsProgId = progMaths1.body.data.programme.id;
    const mathsCh1 = progMaths1.body.data.chapitres.find((c) => c.ordre === 1)!;
    const mathsCh2 = progMaths1.body.data.chapitres.find((c) => c.ordre === 2)!;

    const progTm1 = await apiJson<{
      success: boolean;
      data: { programme: { id: string }; chapitres: Array<{ id: string; ordre: number }> };
    }>(`/api/v2/pedagogie/progression?classId=${classe6e.id}&subjectId=${subTm.id}`, teacherToken);
    assert.equal(progTm1.status, 200);
    const tmProgId = progTm1.body.data.programme.id;
    const tmCh1 = progTm1.body.data.chapitres.find((c) => c.ordre === 1)!;

    for (const chId of [mathsCh1.id, mathsCh2.id, tmCh1.id]) {
      const checkRes = await apiJson<{ success: boolean; data: { sourceRealisation: string } }>(
        `/api/v2/pedagogie/chapitres/${chId}/avancement`,
        teacherToken,
        { method: 'PUT', body: { classId: classe6e.id, fait: true } },
      );
      assert.equal(checkRes.status, 200);
      assert.equal(checkRes.body.data.sourceRealisation, 'COCHE');
    }
    console.log('[E2E] 5. Coches enseignant enregistrées (Maths L1, Maths L2, Travail Manuel L1).');

    // Étape 6 : Désactivation de l'atelier 2 (Élevage) en Travail Manuel
    const modRes = await apiJson<{ success: boolean; data: { actif: boolean } }>(
      `/api/v2/pedagogie/programmes/${tmProgId}/modules/2/statut`,
      teacherToken,
      { method: 'PUT', body: { actif: false } },
    );
    assert.equal(modRes.status, 200);
    assert.equal(modRes.body.data.actif, false);

    const progTm2 = await apiJson<{
      success: boolean;
      data: { leconsTotal: number; leconsRealisees: number; progressionPct: number; modulesDesactivesCount: number };
    }>(`/api/v2/pedagogie/progression?classId=${classe6e.id}&subjectId=${subTm.id}`, teacherToken);
    assert.equal(progTm2.status, 200);
    assert.equal(progTm2.body.data.modulesDesactivesCount, 1);
    assert.equal(progTm2.body.data.leconsTotal, 2);
    assert.equal(progTm2.body.data.leconsRealisees, 1);
    assert.equal(progTm2.body.data.progressionPct, 50);
    console.log('[E2E] 6. Désactivation atelier 2 Travail Manuel OK (1/2 = 50%, 1 module désactivé).');

    // Étape 7 : Modification d'un titre + retrait de L2 dans le référentiel national puis synchronisation
    await prisma.officialProgrammeProgression.update({
      where: { id: offMaths.id },
      data: {
        importChecksum: 'e2e_maths_v2',
        chapitres: [
          { ordre: 1, titre: 'Nombres entiers naturels (titre mis à jour)', moduleOrdre: 1, moduleTitre: 'Nombres', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
          { ordre: 2, titre: 'Droites du plan', moduleOrdre: 2, moduleTitre: 'Géométrie', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
        ],
      },
    });

    const derivesRes = await apiJson<{ success: boolean; data: { totalAvecDerive: number } }>(
      '/api/v2/pedagogie/programmes/derives',
      adminToken,
    );
    assert.equal(derivesRes.status, 200);
    assert.equal(derivesRes.body.data.totalAvecDerive, 1);

    const syncProp = await apiJson<{
      success: boolean;
      data: { diff: { modifies: unknown[]; retiresDuNational: unknown[] } };
    }>(`/api/v2/pedagogie/programmes/${mathsProgId}/synchroniser/propose`, adminToken, { method: 'POST', body: {} });
    assert.equal(syncProp.status, 200);
    assert.equal(syncProp.body.data.diff.modifies.length, 2); // L1 (titre) + Droites (ordre 3->2)
    assert.equal(syncProp.body.data.diff.retiresDuNational.length, 1);

    const syncApply = await apiJson<{
      success: boolean;
      data: { dejaAJour: boolean; nbModifies: number; nbMarquesRetires: number };
    }>(`/api/v2/pedagogie/programmes/${mathsProgId}/synchroniser/apply`, adminToken, { method: 'POST', body: {} });
    assert.equal(syncApply.status, 200);
    assert.equal(syncApply.body.data.dejaAJour, false);
    assert.equal(syncApply.body.data.nbMarquesRetires, 1);

    const progMaths2 = await apiJson<{
      success: boolean;
      data: {
        leconsTotal: number;
        leconsRealisees: number;
        leconsRetireesCount: number;
        progressionPct: number;
        chapitres: Array<{ id: string; titre: string; retireDuReferentiel: boolean; cocheDirecte: boolean }>;
      };
    }>(`/api/v2/pedagogie/progression?classId=${classe6e.id}&subjectId=${subMaths.id}`, teacherToken);
    assert.equal(progMaths2.status, 200);
    assert.equal(progMaths2.body.data.leconsTotal, 2);
    assert.equal(progMaths2.body.data.leconsRealisees, 1);
    assert.equal(progMaths2.body.data.leconsRetireesCount, 1);
    assert.equal(progMaths2.body.data.progressionPct, 50);
    assert.equal(
      progMaths2.body.data.chapitres.find((c) => c.id === mathsCh1.id)?.titre,
      'Nombres entiers naturels (titre mis à jour)',
    );
    const retiredDetail = progMaths2.body.data.chapitres.find((c) => c.id === mathsCh2.id)!;
    assert.equal(retiredDetail.retireDuReferentiel, true);
    assert.equal(retiredDetail.cocheDirecte, true);
    console.log('[E2E] 7. Synchronisation OK : titre mis à jour, L2 marquée retirée (coche conservée), dénominateur = 2 (50%).');

    // Étape 8 : Rapport consolidé JSON + export CSV
    const rapportRes = await apiJson<{
      success: boolean;
      data: {
        resumeGlobal: {
          totalProgrammes: number;
          leconsActivesTotal: number;
          leconsRealiseesTotal: number;
          totalModulesDesactives: number;
          totalLeconsRetirees: number;
        };
      };
    }>('/api/v2/pedagogie/rapports/avancement', adminToken);
    assert.equal(rapportRes.status, 200);
    assert.equal(rapportRes.body.data.resumeGlobal.totalProgrammes, 2);
    assert.equal(rapportRes.body.data.resumeGlobal.leconsActivesTotal, 4);
    assert.equal(rapportRes.body.data.resumeGlobal.leconsRealiseesTotal, 2);
    assert.equal(rapportRes.body.data.resumeGlobal.totalModulesDesactives, 1);
    assert.equal(rapportRes.body.data.resumeGlobal.totalLeconsRetirees, 1);

    const csvRes = await apiText('/api/v2/pedagogie/rapports/avancement?format=csv', adminToken);
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.contentType.includes('text/csv'));
    assert.equal(csvRes.hasUtf8Bom, true);
    assert.ok(csvRes.text.includes('Leçons retirées du référentiel'));
    assert.ok(csvRes.text.includes('Mathématiques'));
    assert.ok(csvRes.text.includes('Travail Manuel'));
    console.log(`[E2E] 8. Rapport JSON & Export CSV OK (${csvRes.text.trim().split('\n').length} lignes CSV).`);

    // Étape 9 : Relances en dry-run UNIQUEMENT (/propose, jamais /apply)
    const relanceProp = await apiJson<{
      success: boolean;
      data: { totalAlertes: number; totalDestinataires: number };
    }>('/api/v2/pedagogie/alertes-retard/notifier/propose', adminToken, {
      method: 'POST',
      body: { seuilPct: 15 },
    });
    assert.equal(relanceProp.status, 200);
    assert.equal(relanceProp.body.data.totalAlertes, 2);
    assert.ok(relanceProp.body.data.totalDestinataires >= 1);

    const notifCount = await prisma.notification.count({ where: { schoolId } });
    assert.equal(notifCount, 0);
    console.log(
      `[E2E] 9. Relances dry-run OK (${relanceProp.body.data.totalAlertes} alertes, ${relanceProp.body.data.totalDestinataires} destinataire(s), 0 notification persistée).`,
    );

    console.log('[E2E] SUCCÈS COMPLET — Tous les contrôles HTTP de bout en bout ont réussi.');
  } finally {
    if (serverProc) {
      serverProc.kill();
      await serverProc.exited;
    }
    if (schoolId) {
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
    }
    if (createdOfficialIds.length > 0) {
      await prisma.officialProgrammeProgression
        .deleteMany({ where: { id: { in: createdOfficialIds } } })
        .catch(() => {});
    }
    await prisma.schoolTemplate.deleteMany({ where: { code: templateCode } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[E2E] ÉCHEC :', err);
  process.exit(1);
});
