import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { GradeController } from '@infrastructure/http/controllers/GradeController';
import { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { TimetableAutoController } from '@infrastructure/http/controllers/TimetableAutoController';
import { creerGradeRoutes } from '@infrastructure/http/routes/grade.routes';
import { creerAttendanceRoutes } from '@infrastructure/http/routes/attendance.routes';
import { creerTimetableRoutes } from '@infrastructure/http/routes/timetable.routes';
import { requireAuth, requirePermission, requireRole } from '../../http/middlewares/auth';

type Container = ReturnType<typeof creerContainer>;

export function registerGrade(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerGradeRoutes(app, _prisma, container);
}

export function registerGradeRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const gradeController = new GradeController(
    c.grade.saisirNote,
    c.grade.verrouillerNote,
    c.grade.verrouillerNotesEnMasse,
    c.grade.modifierNote,
    c.grade.draftEnMasse,
    c.grade.listerNotes,
    c.grade.listerNotesEnAttente,
    c.grade.statutParClasse,
    c.grade.calculerMoyenne,
    c.grade.importerNotesExcel,
    c.school.anneeRepository,
    c.school.classeRepository,
    c.school.matiereRepository,
    c.events.publisher,
  );

  const attendanceController = new AttendanceController(
    c.attendance.enregistrerPresence,
    c.attendance.presenceRepository,
    c.attendance.userRepository,
    c.attendance.parentRepository,
    c.school.matiereRepository,
    new AIActionAuditAdapter(p),
  );

  const timetableController = new TimetableController(
    c.timetable.creer,
     c.timetable.ajouterCreneau,
     c.timetable.modifierCreneau,
      c.timetable.supprimerCreneau,
      c.timetable.viderCreneaux,
      c.timetable.soumettre,

    c.timetable.publier,
    c.timetable.publierTous,
    c.timetable.rouvrir,
    c.timetable.demanderRattrapage,
    c.timetable.genererSeancesGroupe,
    c.timetable.proposerEmploiDuTemps,
    c.timetable.appliquerProposition,
    c.timetable.simulerEmploiDuTemps,
    c.events.publisher,
  );

  app.post('/api/v2/timetables/generate-skeleton', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId } = req.body as { classId?: string };
      if (!classId) { res.status(400).json({ success: false, message: 'classId requis' }); return; }
      const { timetableId } = await c.timetable.genererSquelette.execute({ schoolId, classId });
      const timetable = await p.timetable.findUnique({
        where: { id: timetableId },
        include: {
          class: { select: { id: true, name: true } },
          slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        },
      });
      res.status(201).json({ success: true, data: timetable });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('existe déjà')) {
        const annee = await p.academicYear.findFirst({ where: { schoolId: req.user!.schoolId, isCurrent: true }, select: { id: true } });
        const existing = annee
          ? await p.timetable.findFirst({
              where: { schoolId: req.user!.schoolId, classId: (req.body as { classId?: string }).classId, academicYearId: annee.id },
              select: { id: true },
            })
          : null;
        res.status(409).json({ success: false, message, data: { timetableId: existing?.id } });
        return;
      }
      if (message.includes('Classe introuvable')) { res.status(404).json({ success: false, message }); return; }
      if (message.includes('grille horaire') || message.includes('année scolaire')) {
        res.status(422).json({ success: false, message }); return;
      }
      next(err);
    }
  });

  app.get('/api/v2/timetables/check-conflict', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { teacherId, dayOfWeek, startTime, excludeSlotId } = req.query as Record<string, string>;
      if (!teacherId || !dayOfWeek || !startTime) {
        res.status(400).json({ success: false, message: 'teacherId, dayOfWeek et startTime requis' }); return;
      }
      const conflitSlot = await p.timetableSlot.findFirst({
        where: {
          teacherId,
          dayOfWeek: parseInt(dayOfWeek),
          startTime,
          ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
          timetable: { is: { schoolId } },
        },
        select: { timetableId: true },
      });
      if (conflitSlot) {
        const conflitTimetable = await p.timetable.findUnique({
          where: { id: conflitSlot.timetableId },
          include: { class: { select: { name: true } } },
        });
        res.json({ success: true, data: { hasConflict: true, conflictClass: conflitTimetable?.class.name ?? 'inconnue' } });
      } else {
        res.json({ success: true, data: { hasConflict: false } });
      }
    } catch (err) { next(err); }
  });

  app.patch('/api/v2/timetables/slots/:slotId', requireAuth, requirePermission('MANAGE_TIMETABLE'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const slotId = String(req.params['slotId']);
      const { subjectId, teacherId, isLV2Slot } = req.body as { subjectId?: string | null; teacherId?: string | null; isLV2Slot?: boolean };
      const slot = await p.timetableSlot.findFirst({
        where: { id: slotId },
        include: { timetable: { select: { schoolId: true, classId: true, status: true } } },
      });
      if (!slot || slot.timetable.schoolId !== schoolId) { res.status(404).json({ success: false, message: 'Créneau introuvable.' }); return; }
      if (slot.timetable.status === 'PUBLISHED') { res.status(422).json({ success: false, message: 'Impossible de modifier un créneau d’un EDT publié.' }); return; }
      if (teacherId && subjectId) {
        const assignment = await p.teachingAssignment.findUnique({
          where: { classId_subjectId: { classId: slot.timetable.classId, subjectId } },
        });
        if (!assignment || assignment.teacherId !== teacherId) {
          const msg = assignment
            ? 'Cette matière est assignée à un autre enseignant pour cette classe.'
            : 'Aucune affectation n\'existe pour cette matière dans cette classe. Assignez d\'abord l\'enseignant à la matière via la gestion des classes.';
          res.status(400).json({ success: false, code: 'ENSEIGNANT_NON_ASSIGNE', message: msg }); return;
        }
      }
      if (teacherId) {
        const conflitSlot = await p.timetableSlot.findFirst({
          where: {
            teacherId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            id: { not: slotId },
            timetable: { is: { schoolId } },
          },
          select: { timetableId: true },
        });
        if (conflitSlot) {
          const conflitTimetable = await p.timetable.findUnique({
            where: { id: conflitSlot.timetableId },
            include: { class: { select: { name: true } } },
          });
          res.status(409).json({ success: false, code: 'CONFLIT_HORAIRE', message: `Conflit : cet enseignant est déjà affecté à la classe ${conflitTimetable?.class.name ?? 'inconnue'} à ce créneau.` }); return;
        }
        const [teacherProfile, isHeadOfDept] = await Promise.all([
          p.teacherProfile.findFirst({ where: { userId: teacherId }, select: { supervisedSubjectIds: true } }),
          p.department.findFirst({ where: { headId: teacherId, schoolId }, select: { id: true } }),
        ]);
        const isAP = (teacherProfile && teacherProfile.supervisedSubjectIds.length > 0) || !!isHeadOfDept;
        if (isAP) {
          const slotsAP = await p.timetableSlot.count({
            where: { teacherId, id: { not: slotId }, timetable: { is: { schoolId } } },
          });
          const dureePeriode = (await p.timetableGridConfig.findUnique({ where: { schoolId }, select: { dureePeriode: true } }))?.dureePeriode ?? 55;
          const heuresTotal = (slotsAP + 1) * dureePeriode / 60;
          if (heuresTotal > 14) {
            res.status(409).json({ success: false, code: 'VOLUME_AP_DEPASSE', message: `Cet Animateur Pédagogique aurait ${heuresTotal.toFixed(1)}h/semaine, dépassant la limite légale de 14h.` }); return;
          }
        }
      }
      const updated = await p.timetableSlot.update({
        where: { id: slotId },
        data: {
           subjectId: subjectId ?? null,
           teacherId: teacherId ?? null,
           kind: subjectId ? 'CLASS' : 'FREE',
           ...(typeof isLV2Slot === 'boolean' ? { isLV2Slot } : {}),
        },
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  const timetableAutoController = new TimetableAutoController(
    c.timetable.timetableRepository,
    c.timetable.modifierCreneau,
  );
  app.post('/api/v2/timetables/:id/adjust', requireAuth, requireRole('STAFF'), requirePermission('MANAGE_TIMETABLE'), timetableAutoController.adjust);

  app.use('/api/v2/grades', creerGradeRoutes(gradeController));
  app.use('/api/v2/attendance', creerAttendanceRoutes(attendanceController));
  app.use('/api/v2/timetables', creerTimetableRoutes(timetableController));
}
