import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { AffecterMatieresALevelEleveUseCase } from '@application/student/AffecterMatieresALevelEleveUseCase';
import { PreremplirDepuisCombinaisonUseCase } from '@application/student/PreremplirDepuisCombinaisonUseCase';
import { GetElevesParMatiereALevelUseCase } from '@application/student/GetElevesParMatiereALevelUseCase';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import type { PebsFiliere } from '@domain/types/enums';

type Container = ReturnType<typeof creerContainer>;

export function registerElectifsRoutes(app: Application, p: typeof prisma = prisma, c: Container): void {
  // ── Module LV2 — gestion langue vivante 2 par élève ──────────────────────

  // PATCH /api/v2/students/:id/lv2 — affecter une LV2 à un élève (via use case pour sync StudentGroupMembership)
  app.patch('/api/v2/students/:id/lv2', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { lv2SubjectId } = req.body as { lv2SubjectId?: string | null };

      await c.lv2pebs.affecterLV2Eleve.execute({
        studentUserId,
        schoolId,
        lv2SubjectId: lv2SubjectId ?? null,
      });

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_lv2_eleve', targetType: 'User', targetId: studentUserId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentUserId, lv2SubjectId },
      });
      res.json({ success: true, message: 'LV2 affectée' });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_lv2_eleve', targetType: 'User', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // POST /api/v2/students/lv2/bulk — affecter la même LV2 à une liste d'élèves (via use case)
  app.post('/api/v2/students/lv2/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserIds, lv2SubjectId } = req.body as { studentUserIds?: string[]; lv2SubjectId?: string | null };

      if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
        res.status(400).json({ success: false, message: 'studentUserIds[] requis' }); return;
      }

      const result = await c.lv2pebs.affecterLV2EnMasse.execute({
        studentUserIds,
        schoolId,
        lv2SubjectId: lv2SubjectId ?? null,
      });

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_lv2_masse', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { studentUserIds, lv2SubjectId, modifies: result.modifies },
      });
      res.json({ success: true, data: { modifies: result.modifies } });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_lv2_masse', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // GET /api/v2/classes/:id/lv2-overview — répartition LV2 d'une classe
  app.get('/api/v2/classes/:id/lv2-overview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await p.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { lv2SubjectId: true, lv2Subject: { select: { id: true, name: true } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const groupes: Record<string, { subjectId: string; langue: string; eleves: { id: string; firstName: string; lastName: string }[] }> = {};
      const sansLV2: { id: string; firstName: string; lastName: string }[] = [];

      for (const s of students) {
        const lv2 = s.studentProfile?.lv2SubjectId;
        const lv2Name = s.studentProfile?.lv2Subject?.name ?? null;
        if (!lv2 || !lv2Name) {
          sansLV2.push({ id: s.id, firstName: s.firstName, lastName: s.lastName });
        } else {
          if (!groupes[lv2]) groupes[lv2] = { subjectId: lv2, langue: lv2Name, eleves: [] };
          groupes[lv2].eleves.push({ id: s.id, firstName: s.firstName, lastName: s.lastName });
        }
      }

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'compter_eleves_par_lv2', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId },
      });
      res.json({
        success: true,
        data: {
          className: classe.name,
          groupes: Object.values(groupes).map(g => ({ ...g, nombreEleves: g.eleves.length })),
          sansLV2,
          total: students.length,
        },
      });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'compter_eleves_par_lv2', targetType: 'Class', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: { classId: req.params['id'] },
      });
      next(err);
    }
  });

  // ── Module PEBS — gestion Programme d'Éducation Bilingue Spécial par élève ──

  // PATCH /api/v2/students/:id/pebs — affecter PEBS à un élève (via use case pour sync StudentGroupMembership)
  app.patch('/api/v2/students/:id/pebs', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { pebsFiliere } = req.body as { pebsFiliere?: PebsFiliere | null };

      await c.lv2pebs.affecterPEBSEleve.execute({
        studentUserId,
        schoolId,
        pebsFiliere: pebsFiliere ?? null,
      });

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_pebs_eleve', targetType: 'User', targetId: studentUserId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentUserId, pebsFiliere },
      });
      res.json({ success: true, message: 'PEBS affecté' });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_pebs_eleve', targetType: 'User', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // POST /api/v2/students/pebs/bulk — affecter PEBS en masse (via use case)
  app.post('/api/v2/students/pebs/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserIds, pebsFiliere } = req.body as { studentUserIds?: string[]; pebsFiliere?: PebsFiliere | null };

      if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
        res.status(400).json({ success: false, message: 'studentUserIds[] requis' }); return;
      }

      const result = await c.lv2pebs.affecterPEBSEnMasse.execute({
        studentUserIds,
        schoolId,
        pebsFiliere: pebsFiliere ?? null,
      });

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_pebs_masse', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { studentUserIds, pebsFiliere, modifies: result.modifies },
      });
      res.json({ success: true, data: { modifies: result.modifies } });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_pebs_masse', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // GET /api/v2/classes/:id/pebs-overview — répartition PEBS d'une classe
  app.get('/api/v2/classes/:id/pebs-overview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await p.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { pebsFiliere: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const eleves = students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        pebsFiliere: s.studentProfile?.pebsFiliere ?? null,
      }));

      const pebsCount = eleves.filter((e) => e.pebsFiliere !== null).length;
      const nonPEBSCount = eleves.filter((e) => e.pebsFiliere === null).length;

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'repartition_pebs_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId },
      });
      res.json({
        success: true,
        data: {
          className: classe.name,
          pebsCount,
          nonPEBSCount,
          total: students.length,
          eleves,
        },
      });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'repartition_pebs_classe', targetType: 'Class', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: { classId: req.params['id'] },
      });
      next(err);
    }
  });

  // GET /api/v2/timetable-slots/:id/students — participants d'un créneau, résolus
  // automatiquement (électif A-Level > StudentGroup > LV2 legacy > toute la classe).
  const resoudreParticipantsSeanceUseCase = c.timetable.resoudreParticipantsSeance;
  app.get('/api/v2/timetable-slots/:id/students', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const slotId = req.params['id'] as string;
      const resultat = await resoudreParticipantsSeanceUseCase.execute(slotId, schoolId);
      res.json({ success: true, data: resultat });
    } catch (err) {
      if (err instanceof Error && err.message === 'Créneau introuvable') {
        res.status(404).json({ success: false, message: err.message }); return;
      }
      if (err instanceof Error && err.message === 'Accès refusé') {
        res.status(403).json({ success: false, message: err.message }); return;
      }
      next(err);
    }
  });

  // ── Module A-Level — choix individuel des matières par élève (max 5) ──────
  const studentAffectationRepositoryForALevel = new PrismaStudentAffectationRepository(p);
  const affecterALevelUseCase   = new AffecterMatieresALevelEleveUseCase(studentAffectationRepositoryForALevel);
  const preremplirALevelUseCase = new PreremplirDepuisCombinaisonUseCase(studentAffectationRepositoryForALevel);
  const getElevesALevelUseCase  = new GetElevesParMatiereALevelUseCase(studentAffectationRepositoryForALevel);

  // PUT /api/v2/students/:id/alevel-subjects — remplacer la sélection A-Level (3 à 5 matières)
  app.put('/api/v2/students/:id/alevel-subjects', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const { subjectIds } = req.body as { subjectIds?: string[] };
      const result = await affecterALevelUseCase.execute({
        studentUserId: req.params['id'] as string,
        schoolId: req.user!.schoolId,
        subjectIds: Array.isArray(subjectIds) ? subjectIds : [],
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/au moins|plus de|introuvable|non A-Level/.test(msg)) { res.status(400).json({ success: false, message: msg }); return; }
      next(err);
    }
  });

  // POST /api/v2/students/:id/alevel-subjects/from-combination — préremplir depuis une combinaison
  app.post('/api/v2/students/:id/alevel-subjects/from-combination', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const { combinationCode } = req.body as { combinationCode?: string };
      if (!combinationCode) { res.status(400).json({ success: false, message: 'combinationCode requis' }); return; }
      const result = await preremplirALevelUseCase.execute({
        studentUserId: req.params['id'] as string,
        schoolId: req.user!.schoolId,
        combinationCode,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/introuvable/.test(msg)) { res.status(404).json({ success: false, message: msg }); return; }
      next(err);
    }
  });

  // GET /api/v2/students/:id/alevel-subjects — matières A-Level actuelles de l'élève
  app.get('/api/v2/students/:id/alevel-subjects', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const profile = await p.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      const links = await p.studentALevelSubject.findMany({
        where: { studentId: profile.id },
        select: { subject: { select: { id: true, name: true } } },
        orderBy: { subject: { name: 'asc' } },
      });
      const subjects = links.map((l) => ({ id: l.subject.id, name: l.subject.name }));
      res.json({ success: true, data: { subjects, count: subjects.length } });
    } catch (err) { next(err); }
  });

  // GET /api/v2/classes/:id/alevel-overview — vue d'ensemble des sélections A-Level d'une classe
  app.get('/api/v2/classes/:id/alevel-overview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      // Matières A-Level disponibles de l'établissement (matières de l'école dont le nom est un sujet A-Level officiel)
      const officialALevel = await p.aLevelSubject.findMany({ select: { subjectName: true } });
      const officialNames: string[] = officialALevel.map((a) => a.subjectName);
      const availableSubjects = await p.subject.findMany({
        where: { schoolId, name: { in: officialNames } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const students = await p.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { alevelSubjects: { select: { subject: { select: { id: true, name: true } } } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      res.json({
        success: true,
        data: {
          className: classe.name,
          availableSubjects,
          students: students.map((s) => {
            const subjects = (s.studentProfile?.alevelSubjects ?? []).map((a) => a.subject);
            return { id: s.id, firstName: s.firstName, lastName: s.lastName, subjects, count: subjects.length };
          }),
        },
      });
    } catch (err) { next(err); }
  });

  // GET /api/v2/subjects/:id/alevel-students?classId= — élèves ayant cette matière A-Level
  app.get('/api/v2/subjects/:id/alevel-students', requireAuth, async (req, res, next) => {
    try {
      const classId = typeof req.query['classId'] === 'string' ? (req.query['classId'] as string) : undefined;
      const result = await getElevesALevelUseCase.execute(req.params['id'] as string, req.user!.schoolId, classId);
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/introuvable/.test(msg)) { res.status(404).json({ success: false, message: msg }); return; }
      next(err);
    }
  });

  // POST /api/v2/classes/:id/alevel-subjects/bulk-from-combination — préréglage pour toute la classe
  app.post('/api/v2/classes/:id/alevel-subjects/bulk-from-combination', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;
      const { combinationCode } = req.body as { combinationCode?: string };
      if (!combinationCode) { res.status(400).json({ success: false, message: 'combinationCode requis' }); return; }

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await p.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: { id: true },
      });

      let modifies = 0;
      for (const s of students) {
        try {
          await preremplirALevelUseCase.execute({ studentUserId: s.id, schoolId, combinationCode });
          modifies++;
        } catch { /* élève ignoré si erreur individuelle */ }
      }
      res.json({ success: true, data: { modifies, total: students.length } });
    } catch (err) { next(err); }
  });

  // GET /api/v2/teacher/roster?classId=&subjectId= — liste d'élèves d'un cours, filtrée
  // si la matière est élective (LV2 ou A-Level). Source unique pour la saisie présences/notes.
  app.get('/api/v2/teacher/roster', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.query['classId'] as string | undefined;
      const subjectId = req.query['subjectId'] as string | undefined;
      if (!classId) { res.status(400).json({ success: false, message: 'classId requis' }); return; }

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const allStudents = await p.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { lv2SubjectId: true, alevelSubjects: { select: { subjectId: true } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const total = allStudents.length;
      let mode: 'FULL' | 'LV2' | 'ALEVEL' = 'FULL';
      let filtered = allStudents;
      let lv2Fallback = false; // matière LV2 uniforme sans affectation individuelle → toute la classe

      if (subjectId) {
        const subject = await p.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, name: true, isLV2: true } });
        if (subject) {
          if (subject.isLV2) {
            mode = 'LV2';
            const assigned = allStudents.filter(s => s.studentProfile?.lv2SubjectId === subjectId);
            const anyLv2InClass = allStudents.some(s => s.studentProfile?.lv2SubjectId);
            // Repli (Situation 1) : la classe n'a AUCUNE affectation LV2 individuelle → toute la
            // classe est présumée faire cette langue (ex. « toute la 4eA fait Allemand »).
            // Dès qu'une répartition individuelle existe, on la respecte strictement.
            if (assigned.length === 0 && !anyLv2InClass) {
              filtered = allStudents;
              lv2Fallback = true;
            } else {
              filtered = assigned;
            }
          } else {
            const isOfficialALevel = await p.aLevelSubject.findUnique({ where: { subjectName: subject.name }, select: { subjectName: true } });
            if (isOfficialALevel) {
              mode = 'ALEVEL';
              filtered = allStudents.filter(s => (s.studentProfile?.alevelSubjects ?? []).some((a) => a.subjectId === subjectId));
            }
          }
        }
      }

      const subjectName = subjectId
        ? (await p.subject.findFirst({ where: { id: subjectId, schoolId }, select: { name: true } }))?.name ?? ''
        : '';
      const label = mode === 'LV2'
        ? (lv2Fallback
            ? `Cours LV2 — ${subjectName} — ${classe.name} (toute la classe — ${total} élèves, LV2 non répartie)`
            : `Cours LV2 — ${subjectName} — ${classe.name} (${filtered.length} élèves sur ${total})`)
        : mode === 'ALEVEL'
          ? `A-Level — ${subjectName} — ${classe.name} (${filtered.length} élèves sur ${total})`
          : null;

      res.json({
        success: true,
        data: {
          mode,
          filtered: mode !== 'FULL',
          lv2Fallback,
          label,
          total,
          className: classe.name,
          students: filtered.map(s => ({
            id: s.id, firstName: s.firstName, lastName: s.lastName,
            name: `${s.firstName} ${s.lastName}`.trim(),
            className: classe.name,
          })),
        },
      });
    } catch (err) { next(err); }
  });
}
