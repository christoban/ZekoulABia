import type { Application } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';
import { PrismaAIActionAuditLogQueryRepository } from '@infrastructure/persistence/prisma/PrismaAIActionAuditLogQueryRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaSubjectAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaSubjectAssignmentRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { ObtenirAnomaliesEtablissementUseCase } from '@application/school/ObtenirAnomaliesEtablissementUseCase';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { getStaffTitlesForTemplate } from '@domain/rules/StaffPermissionRules';
import { assignerMatieresPourClasse, CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS, parseSerie as syncParseSerie } from '@application/school/SubjectAssignmentHelper';
import { buildPayload, getLatestSchoolBackup } from '../../backup/SchoolBackupService';
import { registerAuthOnboardingRoutes } from './authOnboarding';

type Container = ReturnType<typeof creerContainer>;

export function registerSchoolRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  // ── Informations de l'école (utilisateurs authentifiés) ──────────────
  app.get('/api/v2/school/me', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await p.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true, subdomain: true, logoUrl: true, plan: true, city: true, region: true, phone: true, email: true, subsystem: true, status: true, educationType: true, ownership: true, onboardingConfig: true, hasPEBSFrancophone: true, hasPEBSAnglophone: true, minesecSchoolCode: true, templateCode: true },
      });
      if (!school) { res.status(404).json({ success: false, message: 'École introuvable' }); return; }
      // isPrimaire pilote l-affichage MINESEC (secondaire) vs MINEDUB (maternelle/primaire)
      // dans la sidebar admin — les deux menus etaient affiches sans distinction jusqu-ici.
      // templateCode absent (écoles créées avant l-introduction du champ, ou artefacts de
      // tests) : on ne devine pas "secondaire" par défaut, on renvoie null pour que le
      // frontend garde les deux menus visibles plutôt que d-en masquer un à tort. Même repli
      // pour COMPLEXE_SCOLAIRE : une école multi-cycles a des élèves des deux types, donc les
      // deux menus doivent rester visibles plutôt que d'en masquer un.
      const isPrimaire = school.templateCode && school.templateCode !== 'COMPLEXE_SCOLAIRE'
        ? getTemplateMeta(school.templateCode).isPrimaire
        : null;
      res.json({ success: true, data: { ...school, isPrimaire } });
    } catch (err) { next(err); }
  });

  // Assistant proactif (Section 6.3) — bannière ADMIN, anomalies d'établissement.
  const obtenirAnomaliesEtablissementUseCase = new ObtenirAnomaliesEtablissementUseCase(
    new PrismaAnneeAcademiqueRepository(p),
    new PrismaClasseRepository(p),
    new PrismaTimetableRepository(p),
    new PrismaClassCouncilRepository(p),
  );
  app.get('/api/v2/school/anomalies', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const anomalies = await obtenirAnomaliesEtablissementUseCase.execute({
        schoolId: req.user!.schoolId,
        userId: req.user!.userId,
      });
      res.json({ success: true, data: anomalies });
    } catch (err) { next(err); }
  });

  app.get('/api/v2/school/last-backup', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const settings = await p.schoolSettings.findUnique({
        where: { schoolId },
        select: { lastBackupAt: true, lastBackupFile: true },
      });
      const latest = await getLatestSchoolBackup(schoolId);
      res.json({
        success: true,
        data: {
          lastBackupAt: settings?.lastBackupAt ?? latest?.createdAt ?? null,
          lastBackupFile: settings?.lastBackupFile ?? latest?.filePath ?? null,
          latestFileExists: Boolean(settings?.lastBackupFile || latest),
        },
      });
    } catch (err) { next(err); }
  });

  app.get('/api/v2/school/export', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await p.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      });

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const payload = await buildPayload(p, schoolId);
      const exportedAt = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = school.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ecole';

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}-rgpd-${exportedAt}.json"`);
      res.send(JSON.stringify({
        success: true,
        data: {
          exportedAt: new Date().toISOString(),
          schoolId,
          schoolName: school.name,
          export: payload,
        },
      }, null, 2));
    } catch (err) { next(err); }
  });

  // ── Titres de staff disponibles selon le template de l'école ────────────
  // Retourne uniquement les titres appropriés (pas de rôles EN dans une école FR, etc.)
  app.get('/api/v2/school/staff-titles', requireAuth, async (req, res, next) => {
    try {
      const school = await p.school.findUnique({
        where: { id: req.user!.schoolId },
        select: { templateCode: true, onboardingConfig: true },
      });
      const onboardingConfig = school?.onboardingConfig as Record<string, unknown> | null | undefined;
      const templateCode = school?.templateCode
        ?? (onboardingConfig?.templateCode as string | undefined)
        ?? undefined;
      const meta = getTemplateMeta(templateCode);
      const titles = getStaffTitlesForTemplate(meta, templateCode);
      res.json({ success: true, data: titles });
    } catch (err) { next(err); }
  });

  // ── Mise à jour du logo (ADMIN uniquement) ────────────────────────────
  app.patch('/api/v2/school/logo', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { logoBase64 } = req.body as { logoBase64?: string };
      // Suppression si chaîne vide
      if (logoBase64 === '' || logoBase64 === null || logoBase64 === undefined) {
        const school = await p.school.update({ where: { id: schoolId }, data: { logoUrl: null }, select: { logoUrl: true } });
        res.json({ success: true, data: { logoUrl: school.logoUrl } });
        return;
      }
      if (!logoBase64.startsWith('data:image/')) {
        res.status(400).json({ success: false, message: 'Format de logo invalide. Envoyez une image en base64.' });
        return;
      }
      if (logoBase64.length > 2_000_000) {
        res.status(400).json({ success: false, message: 'Logo trop volumineux (max 1.5 MB).' });
        return;
      }
      const school = await p.school.update({
        where: { id: schoolId },
        data: { logoUrl: logoBase64 },
        select: { logoUrl: true },
      });
      res.json({ success: true, data: { logoUrl: school.logoUrl } });
    } catch (err) { next(err); }
  });

  // ── Prévisualisation des classes pour la page /admin/configuration ───────
  app.get('/api/v2/schools/:id/configuration/preview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.params.id as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }
      const school = await p.school.findUnique({ where: { id: schoolId }, select: { onboardingConfig: true } });
      if (!school) { res.status(404).json({ success: false, message: 'École introuvable' }); return; }

      const cfg = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const classes: { name: string; level: string }[] = [];

      const niveaux1erCycle = cfg.niveaux1erCycle as string[] | undefined;
      const classesParNiveau = cfg.classesParNiveau as Record<string, number> | undefined;
      if (niveaux1erCycle) {
        const conv = (cfg.conventionNommage as string | undefined) ?? 'LETTRES';
        for (const n of niveaux1erCycle) {
          const c = classesParNiveau?.[n] ?? 2;
          for (let i = 0; i < Math.min(c, 26); i++) {
            const s = conv === 'LETTRES' ? L[i] : conv === 'CHIFFRES' ? `${i + 1}` : `${L[i]}1`;
            classes.push({ name: `${n} ${s}`, level: n });
          }
        }
      }
      const niveaux2eCycle = cfg.niveaux2eCycle as string[] | undefined;
      const filieres = cfg.filieres as string[] | undefined;
      const classesParFiliere = cfg.classesParFiliere as string | undefined;
      const a4Languages = cfg.a4Languages as string[] | undefined;
      if (niveaux2eCycle && filieres) {
        const nb = classesParFiliere === '3+' ? 3 : parseInt(classesParFiliere ?? '1');
        for (const n of niveaux2eCycle) {
          for (const f of filieres) {
            if (n === '2nde' && (/^TI/.test(f) || /F\s*·\s*G\s*·\s*H/.test(f) || /technique/i.test(f))) continue;
            if (f.startsWith('A4') || f.includes('A4')) {
              for (const lang of (a4Languages?.length ? a4Languages : ['LV'])) {
                classes.push({ name: `${n} A4-${lang}`, level: n });
              }
            } else {
              const short = f.split('—')[0]?.trim() ?? f;
              for (let i = 0; i < nb; i++) classes.push({ name: `${n} ${short}${nb > 1 ? ` ${L[i]}` : ''}`, level: n });
            }
          }
        }
      }
      const niveauxPrimaire = cfg.niveauxPrimaire as string[] | undefined;
      const classesParNiveauPrimaire = cfg.classesParNiveauPrimaire as Record<string, number> | undefined;
      if (niveauxPrimaire) {
        for (const n of niveauxPrimaire) {
          const c = classesParNiveauPrimaire?.[n] ?? 1;
          for (let i = 0; i < Math.min(c, 26); i++) classes.push({ name: `${n} ${L[i]}`, level: n });
        }
      }

      res.json({ success: true, data: { classes, totalClasses: classes.length } });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/school/profile ─────────────────────────────────────────
  app.patch('/api/v2/school/profile', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, city, phone, email, minesecSchoolCode } = req.body as { name?: string; city?: string; phone?: string; email?: string; minesecSchoolCode?: string };
      const data: Record<string, string> = {};
      if (name)  data['name']  = name;
      if (city)  data['city']  = city;
      if (phone) data['phone'] = phone;
      if (email) data['email'] = email;
      if (minesecSchoolCode !== undefined) data['minesecSchoolCode'] = minesecSchoolCode.trim();
      const school = await p.school.update({ where: { id: schoolId }, data, select: { id: true, name: true, city: true, phone: true, email: true, minesecSchoolCode: true } });
      res.json({ success: true, data: school });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/check-subdomain ─────────────────────────────────
  app.get('/api/v2/schools/check-subdomain', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const value = (req.query['value'] as string | undefined)?.trim();
      if (!value) { res.status(400).json({ success: false, message: 'Valeur requise' }); return; }
      const existing = await p.school.findFirst({ where: { subdomain: value, id: { not: req.user!.schoolId } } });
      res.json({ success: true, available: !existing });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/subdomain ──────────────────────────────────
  app.patch('/api/v2/schools/:id/subdomain', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const { newSubdomain } = req.body as { newSubdomain?: string };
      if (!newSubdomain?.trim()) { res.status(400).json({ success: false, message: 'Sous-domaine requis' }); return; }
      const v = newSubdomain.trim();
      if (v.length < 3)  { res.status(400).json({ success: false, message: 'Minimum 3 caractères' }); return; }
      if (v.length > 30) { res.status(400).json({ success: false, message: 'Maximum 30 caractères' }); return; }
      if (!/^[a-z0-9-]+$/.test(v)) { res.status(400).json({ success: false, message: 'Format invalide : lettres, chiffres et tirets uniquement' }); return; }
      const taken = await p.school.findFirst({ where: { subdomain: v, id: { not: schoolId } } });
      if (taken) { res.status(400).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' }); return; }
      await p.school.update({ where: { id: schoolId }, data: { subdomain: v } });
      res.json({ success: true, newSubdomain: v });
    } catch (err) { next(err); }
  });

  // ── POST /api/v2/schools/:id/sync-subjects ────────────────────────────────
  // Crée rétroactivement les SubjectCoefficients pour les classes qui n'en ont pas
  app.post('/api/v2/schools/:id/sync-subjects', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const school = await p.school.findUnique({
        where: { id: schoolId },
        select: { onboardingConfig: true, templateCode: true },
      });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const config = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const templateCode = (config['templateCode'] as string | undefined) ?? school.templateCode ?? '';
      const isAnglophone = getTemplateMeta(templateCode).isAnglophone;

      const classes = await p.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, level: true, serie: true, filiere: true },
        orderBy: { name: 'asc' },
      });

      const schoolSubjects = await p.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
      const subjectByName  = new Map(schoolSubjects.map(s => [s.name, s.id]));
      const subjectCountRef = { value: 0 };

      let classesTraitees = 0;
      let classesSkippees = 0;
      let coefficientsCreated = 0;
      const detail: { className: string; action: string }[] = [];

      for (const cls of classes) {
        if (!cls.level) { classesSkippees++; continue; }

        // Déterminer la série pour ce niveau
        const seriePart = syncParseSerie(cls.name, cls.level);
        // Pour A4, utiliser le nom complet (ex: "A4-Arabe") comme serieCode
        // Pour 1er cycle, utiliser la filière (FR_PEBS / FR_GENERAL)
        const nameParts = cls.name.split(' ');
        const rawSerie = (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level) ? (nameParts[1] ?? '') : '';
        const dashIdx = rawSerie.indexOf('-');
        const effectiveSerieCode = seriePart === 'A4' && dashIdx >= 0
          ? rawSerie
          : seriePart ?? cls.filiere ?? null;

        // Vérifier si des SubjectCoefficients existent déjà pour ce niveau+serie
        const existing = await p.subjectCoefficient.count({
          where: {
            schoolId,
            classLevel: cls.level,
            serieCode: effectiveSerieCode ?? null,
          },
        });
        if (existing > 0) {
          classesSkippees++;
          detail.push({ className: cls.name, action: 'skipped (coefficients already exist)' });
          continue;
        }

        // Mettre à jour Class.serie si absent
        if (!cls.serie && seriePart && (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level)) {
          await p.class.update({ where: { id: cls.id }, data: { serie: effectiveSerieCode } });
        }

        const beforeCount = subjectCountRef.value;
        const beforeCoeffs = await p.subjectCoefficient.count({ where: { schoolId } });

        await assignerMatieresPourClasse(
          new PrismaSubjectAssignmentRepository(p), { name: cls.name, level: cls.level, filiere: cls.filiere ?? undefined }, schoolId,
          config, isAnglophone, subjectByName, subjectCountRef, templateCode,
        );

        const afterCoeffs = await p.subjectCoefficient.count({ where: { schoolId } });
        coefficientsCreated += afterCoeffs - beforeCoeffs;
        void beforeCount;
        classesTraitees++;
        detail.push({ className: cls.name, action: 'processed' });
      }

      // Déclencher la création des départements si aucun n'existe
      const deptCount = await p.department.count({ where: { schoolId } });
      if (deptCount === 0 && templateCode) {
        const FR_DEPT_TEMPLATES = ['LYCEE_FR', 'PRIVE_FR', 'CES_FR', 'LYCEE_BILINGUE'];
        const EN_DEPT_TEMPLATES = ['GHS_EN', 'GSS_EN', 'PRIVE_EN'];
        const allTemplates = [...FR_DEPT_TEMPLATES, ...EN_DEPT_TEMPLATES];
        if (allTemplates.includes(templateCode)) {
          const meta = getTemplateMeta(templateCode);
          if (!meta.isPrimaire) {
            const allSubjects = await p.subject.findMany({ where: { schoolId } });
            const subjectNamesLower = new Set(allSubjects.map(s => s.name.toLowerCase()));
            interface DeptDef { name: string; color: string; keywords: string[]; }
            let deptDefs: DeptDef[] = FR_DEPT_TEMPLATES.includes(templateCode) ? [
              { name: 'Lettres', color: '#3b82f6', keywords: ['français', 'littérature', 'philosophie', 'écriture', 'lecture', 'grammaire', 'francais', 'litterature'] },
              { name: 'Sciences Humaines', color: '#f59e0b', keywords: ['histoire', 'géographie', 'éducation civique', 'ecm', 'hgg', 'h-g', 'geographie'] },
              { name: 'Langues Vivantes', color: '#10b981', keywords: ['anglais', 'allemand', 'espagnol', 'langue vivante', 'lv1', 'lv2', 'lvent', 'lv', 'english'] },
              { name: 'Mathématiques et Sciences', color: '#ef4444', keywords: ['mathématiques', 'maths', 'math', 'physique', 'chimie', 'svt', 'science'] },
              { name: 'Arts et Culture', color: '#f97316', keywords: ['art', 'musique', 'danse', 'culture', 'éducation artistique', 'education artistique'] },
            ] : [
              { name: 'Languages', color: '#3b82f6', keywords: ['english', 'french', 'literature', 'language', 'linguistics'] },
              { name: 'Social Sciences', color: '#f59e0b', keywords: ['history', 'geography', 'social', 'civics', 'economics'] },
              { name: 'Sciences', color: '#ef4444', keywords: ['mathematics', 'math', 'physics', 'chemistry', 'biology', 'science'] },
              { name: 'Technical', color: '#8b5cf6', keywords: ['computer', 'ict', 'technology', 'technical', 'engineering', 'design'] },
              { name: 'PE & Arts', color: '#10b981', keywords: ['physical', 'pe', 'sport', 'art', 'music', 'drama', 'health'] },
            ];
            if (FR_DEPT_TEMPLATES.includes(templateCode) && subjectNamesLower.has('informatique')) {
              deptDefs.push({ name: 'Informatique', color: '#8b5cf6', keywords: ['informatique', 'tic', 'ntic', 'computer', 'technologie'] });
            }
            deptDefs.push({ name: FR_DEPT_TEMPLATES.includes(templateCode) ? 'Autres' : 'Others', color: '#9ca3af', keywords: [] });

            const matchedSubjectIds = new Set<string>();
            const createdIds: { id: string; name: string }[] = [];
            for (const def of deptDefs) {
              const d = await p.department.create({ data: { schoolId, name: def.name, color: def.color } });
              createdIds.push({ id: d.id, name: def.name });
              if (def.keywords.length > 0) {
                const matching = allSubjects.filter(s => !matchedSubjectIds.has(s.id) && def.keywords.some(kw => s.name.toLowerCase().includes(kw)));
                for (const subj of matching) {
                  matchedSubjectIds.add(subj.id);
                  await p.subject.update({ where: { id: subj.id }, data: { departmentId: d.id } });
                }
              }
            }
            const fallback = createdIds[createdIds.length - 1];
            for (const subj of allSubjects) {
              if (!matchedSubjectIds.has(subj.id)) {
                await p.subject.update({ where: { id: subj.id }, data: { departmentId: fallback.id } });
              }
            }
          }
        }
      }

      res.json({
        success: true,
        data: {
          classesTraitees,
          classesSkippees,
          subjectsCreated: subjectCountRef.value,
          coefficientsCreated,
          detail,
        },
      });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/structure ──────────────────────────────────
  // Met à jour le nombre de classes par niveau et crée les nouvelles classes manquantes.
  // Non-destructif : ne supprime jamais de classes existantes.
  // Les nouvelles classes héritent automatiquement des SubjectCoefficients du niveau
  // (qui sont partagés par niveau, pas par classe individuelle).
  app.patch('/api/v2/schools/:id/structure', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const school = await p.school.findUnique({
        where: { id: schoolId },
        select: { onboardingConfig: true, templateCode: true },
      });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const anneeCourante = await p.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!anneeCourante) {
        res.status(400).json({ success: false, message: 'Aucune année académique courante — impossible de créer une classe.' });
        return;
      }

      const currentConfig = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const body = req.body as {
        classesParNiveau?: Record<string, number>;
        classesParNiveauPrimaire?: Record<string, number>;
      };

      if (!body.classesParNiveau && !body.classesParNiveauPrimaire) {
        res.status(400).json({ success: false, message: 'Aucune mise à jour fournie' });
        return;
      }

      // Fusionner les nouvelles valeurs dans le config existant
      const newConfig: Record<string, unknown> = { ...currentConfig };
      if (body.classesParNiveau) {
        newConfig['classesParNiveau'] = {
          ...(currentConfig['classesParNiveau'] as Record<string, number> | undefined ?? {}),
          ...body.classesParNiveau,
        };
      }
      if (body.classesParNiveauPrimaire) {
        newConfig['classesParNiveauPrimaire'] = {
          ...(currentConfig['classesParNiveauPrimaire'] as Record<string, number> | undefined ?? {}),
          ...body.classesParNiveauPrimaire,
        };
      }

      await p.school.update({ where: { id: schoolId }, data: { onboardingConfig: newConfig as Prisma.InputJsonValue } });

      // Calculer la liste complète des classes attendues depuis la config mise à jour
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const conv = (newConfig['conventionNommage'] as string | undefined) ?? 'LETTRES';
      const expectedClasses: { name: string; level: string }[] = [];

      const niveaux1er = (newConfig['niveaux1erCycle'] as string[] | undefined) ?? [];
      const cpn = newConfig['classesParNiveau'] as Record<string, number> | undefined;
      for (const n of niveaux1er) {
        const c = cpn?.[n] ?? 2;
        for (let i = 0; i < Math.min(c, 26); i++) {
          const s = conv === 'LETTRES' ? L[i]! : conv === 'CHIFFRES' ? `${i + 1}` : `${L[i]!}1`;
          expectedClasses.push({ name: `${n} ${s}`, level: n });
        }
      }
      const niveauxPrimaire = (newConfig['niveauxPrimaire'] as string[] | undefined) ?? [];
      const cpnp = newConfig['classesParNiveauPrimaire'] as Record<string, number> | undefined;
      for (const n of niveauxPrimaire) {
        const c = cpnp?.[n] ?? 1;
        for (let i = 0; i < Math.min(c, 26); i++) {
          expectedClasses.push({ name: `${n} ${L[i]!}`, level: n });
        }
      }

      // Trouver les classes manquantes
      const existingClasses = await p.class.findMany({ where: { schoolId }, select: { name: true } });
      const existingNames = new Set(existingClasses.map(c => c.name));
      const toCreate = expectedClasses.filter(c => !existingNames.has(c.name));
      const created: string[] = [];

      if (toCreate.length > 0) {
        const templateCode = (newConfig['templateCode'] as string | undefined) ?? school.templateCode ?? '';
        const isAnglophone = getTemplateMeta(templateCode).isAnglophone;
        const schoolSubjects = await p.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
        const subjectByName = new Map(schoolSubjects.map(s => [s.name, s.id]));
        const subjectCountRef = { value: 0 };

        for (const cls of toCreate) {
          await p.class.create({ data: { schoolId, academicYearId: anneeCourante.id, name: cls.name, level: cls.level } });
          created.push(cls.name);

          // Si aucun SubjectCoefficient n'existe encore pour ce niveau, bootstrapper depuis le template.
          // Sinon, la nouvelle classe hérite automatiquement des coefficients existants du niveau.
          const existingCoeffs = await p.subjectCoefficient.count({ where: { schoolId, classLevel: cls.level } });
          if (existingCoeffs === 0) {
            await assignerMatieresPourClasse(
              new PrismaSubjectAssignmentRepository(p), { name: cls.name, level: cls.level, filiere: null },
              schoolId, newConfig, isAnglophone, subjectByName, subjectCountRef, templateCode,
            );
          }
        }
      }

      res.json({
        success: true,
        message: created.length > 0
          ? `${created.length} classe(s) créée(s) avec succès.`
          : 'Aucune nouvelle classe à créer.',
        data: { classesCreated: created, totalCreated: created.length },
      });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/notification-settings ───────────────────────
  app.get('/api/v2/schools/:id/notification-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const settings = await p.schoolNotificationSettings.upsert({
        where: { schoolId },
        create: { schoolId },
        update: {},
      });
      res.json({ success: true, data: settings });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/notification-settings ──────────────────────
  app.patch('/api/v2/schools/:id/notification-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const { smsAbsences, smsPayments, smsBulletins, emailDigestAdmin, smsLowBalance } = req.body;
      const data: Record<string, boolean> = {};
      if (smsAbsences      !== undefined) data['smsAbsences']      = Boolean(smsAbsences);
      if (smsPayments      !== undefined) data['smsPayments']      = Boolean(smsPayments);
      if (smsBulletins     !== undefined) data['smsBulletins']     = Boolean(smsBulletins);
      if (emailDigestAdmin !== undefined) data['emailDigestAdmin'] = Boolean(emailDigestAdmin);
      if (smsLowBalance    !== undefined) data['smsLowBalance']    = Boolean(smsLowBalance);
      const updated = await p.schoolNotificationSettings.upsert({
        where: { schoolId },
        create: { schoolId, ...data },
        update: data,
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/security-settings ───────────────────────────
  app.get('/api/v2/schools/:id/security-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const config = await p.schoolConfig.findUnique({ where: { schoolId } });
      res.json({ success: true, data: {
        passwordMinLength:    config?.passwordMinLength    ?? 8,
        passwordRequireUpper: config?.passwordRequireUpper ?? false,
        passwordRequireDigit: config?.passwordRequireDigit ?? true,
        sessionTimeoutMin:    config?.sessionTimeoutMin    ?? 60,
      }});
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/security-settings ──────────────────────────
  app.patch('/api/v2/schools/:id/security-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const { passwordMinLength, passwordRequireUpper, passwordRequireDigit, sessionTimeoutMin } = req.body;
      const data: Record<string, number | boolean> = {};
      if (passwordMinLength !== undefined) {
        const v = parseInt(String(passwordMinLength));
        if (isNaN(v) || v < 6 || v > 16) { res.status(400).json({ success: false, message: 'Longueur doit être entre 6 et 16' }); return; }
        data['passwordMinLength'] = v;
      }
      if (passwordRequireUpper !== undefined) data['passwordRequireUpper'] = Boolean(passwordRequireUpper);
      if (passwordRequireDigit !== undefined) data['passwordRequireDigit'] = Boolean(passwordRequireDigit);
      if (sessionTimeoutMin !== undefined) {
        const v = parseInt(String(sessionTimeoutMin));
        if (isNaN(v) || v < 15 || v > 480) { res.status(400).json({ success: false, message: 'Timeout doit être entre 15 et 480 minutes' }); return; }
        data['sessionTimeoutMin'] = v;
      }
      const updated = await p.schoolConfig.upsert({
        where: { schoolId },
        create: { schoolId, ...data },
        update: data,
      });
      res.json({ success: true, data: {
        passwordMinLength:    updated.passwordMinLength    ?? 8,
        passwordRequireUpper: updated.passwordRequireUpper ?? false,
        passwordRequireDigit: updated.passwordRequireDigit ?? true,
        sessionTimeoutMin:    updated.sessionTimeoutMin    ?? 60,
      }});
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/audit-logs ──────────────────────────────────
  app.get('/api/v2/schools/:id/audit-logs', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const page  = Math.max(1, parseInt(req.query['page']  as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query['limit'] as string) || 20));
      const skip  = (page - 1) * limit;
      const action   = (req.query['action']   as string | undefined)?.trim();
      const userId   = (req.query['userId']   as string | undefined)?.trim();
      const fromDate = (req.query['from']     as string | undefined)?.trim();
      const toDate   = (req.query['to']       as string | undefined)?.trim();

      const where: Prisma.ActivitiesLogWhereInput = { schoolId };
      if (userId) where.userId = userId;
      if (action) where.action = { contains: action, mode: 'insensitive' };
      if (fromDate || toDate) {
        where.createdAt = {
          ...(fromDate ? { gte: new Date(fromDate) } : {}),
          ...(toDate ? { lte: new Date(toDate + 'T23:59:59') } : {}),
        };
      }

      const [logs, total] = await Promise.all([
        p.activitiesLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        p.activitiesLog.count({ where }),
      ]);

      const userIds = [...new Set(logs.map(l => l.userId).filter((id): id is string => !!id))];
      const users   = userIds.length
        ? await p.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
        : [];
      const userMap = Object.fromEntries(users.map(u => [u.id, u]));

      res.json({
        success: true,
        logs: logs.map(l => ({ ...l, user: l.userId ? (userMap[l.userId] ?? null) : null })),
        total, page, pages: Math.ceil(total / limit),
      });
    } catch (err) { next(err); }
  });

  // ── Sécurité de l'assistant IA — Journal d'établissement ───────────────────
  const aiActionAuditController = new AIActionAuditController(new PrismaAIActionAuditLogQueryRepository(p));
  app.get('/api/v2/security/audit-log', requireAuth, requireRole('ADMIN'), aiActionAuditController.journalEtablissement);

  registerAuthOnboardingRoutes(app, p, c);
}
