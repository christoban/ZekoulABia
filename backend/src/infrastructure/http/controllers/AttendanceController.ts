import type { Request, Response, NextFunction } from 'express';
import type { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import type { AttendancePeriod, AttendanceStatus } from '@domain/types/enums';
import type { PresenceRepository, FiltrePresences } from '@domain/ports/repositories/PresenceRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { CarnetLiaisonRepository } from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import { notifierParentsPushDabord } from '@infrastructure/services/notification/PushFirstNotifier';
import { parseSinceParam } from '@infrastructure/http/helpers/deltaSyncHelper';
import {
  buildAttendanceUserMaps,
  computeAttendanceStats,
  dispatchAbsenceNotifications,
  endOfDayUtc,
  normalizeAttendanceStatus,
  parseOptionalDate,
  startOfDayUtc,
} from './helpers/attendanceAbsenceNotifier';

export class AttendanceController {
  constructor(
    private readonly enregistrerPresence: EnregistrerPresenceUseCase,
    private readonly presenceRepository: PresenceRepository,
    private readonly userRepository: UserRepository,
    private readonly parentRepository: ParentRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly audit: AIActionAuditPort,
    private readonly rattachementRepository?: RattachementEnseignantRepository,
    private readonly schoolConfigRepository?: SchoolConfigRepository,
    private readonly carnetRepository?: CarnetLiaisonRepository,
    private readonly creerEntreeCarnet?: CreerEntreeCarnetUseCase,
  ) {}

  // POST /api/v2/attendance
  enregistrer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const {
      classId,
      academicPeriodId,
      subjectId,
      date,
      period,
      presences,
      isOfflineSync,
      allowUpdate,
      clientRecordedAt,
    } = req.body;

    if (!classId || !date || !period || !presences?.length) {
      res.status(400).json({ success: false, message: 'classId, date, period et presences sont requis' });
      return;
    }

    const parsedClientRecordedAt = parseOptionalDate(clientRecordedAt);

    let resultat: {
      enregistrees: number;
      absents: string[];
      retards: string[];
      createdOrUpdatedIds?: string[];
      clockSkewWarning?: boolean;
      maxClockSkewSeconds?: number;
    };
    try {
      resultat = await this.enregistrerPresence.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
        subjectId,
        teacherId: user.userId,
        recordedById: user.userId,
        date: new Date(date),
        period: period as AttendancePeriod,
        presences: presences.map((p: { studentId: string; statut?: string; status?: string; arrivedAt?: string; lateNote?: string }) => ({
          studentId: p.studentId,
          statut: normalizeAttendanceStatus(p.statut ?? p.status ?? 'PRESENT'),
          arrivedAt: parseOptionalDate(p.arrivedAt),
          lateNote: typeof p.lateNote === 'string' && p.lateNote.trim() ? p.lateNote.trim() : undefined,
        })),
        isOfflineSync: isOfflineSync ?? false,
        allowUpdate: allowUpdate ?? false,
        clientRecordedAt: parsedClientRecordedAt,
      });
    } catch (error) {
      this.audit.journaliser({
        // Route bulk (toute une classe en un appel) — pas un miroir exact de l'action copilot
        // `marquer_absence_eleve` (un seul élève), donc son propre actionName, pas partagé.
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'enregistrer_presences_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      if (error instanceof Error) {
        if (error.message.includes('déjà été enregistrées')) {
          res.status(409).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('future')) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
      return;
    }
    this.audit.journaliser({
      actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
      actionName: 'enregistrer_presences_classe', targetType: 'Class', targetId: classId,
      origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId, date, period, count: presences.length },
    });

    res.status(201).json({ success: true, data: resultat });

    // Fire-and-forget SMS + Carnet primaire — proprement hors du try/catch, réponse déjà envoyée
    if (resultat.absents.length > 0) {
      void dispatchAbsenceNotifications({
        schoolId: user.schoolId as string,
        classId,
        subjectId,
        dateObj: new Date(date),
        period: period as AttendancePeriod,
        absentIds: resultat.absents,
        authorId: user.userId,
        authorRole: user.role,
        clientRecordedAt: parsedClientRecordedAt,
        userRepository: this.userRepository,
        matiereRepository: this.matiereRepository,
        presenceRepository: this.presenceRepository,
        carnetRepository: this.carnetRepository,
        creerEntreeCarnet: this.creerEntreeCarnet,
      });
    }
  };

  // GET /api/v2/attendance
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const schoolId: string = user.schoolId;
      const role: string = (user.role as string).toUpperCase();
      const userId: string = user.userId;

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const classId = req.query.classId as string | undefined;
      const studentId = req.query.studentId as string | undefined;
      const date = req.query.date as string | undefined;
      const period = req.query.period as string | undefined;
      const subjectId = req.query.subjectId as string | undefined;
      const since = req.query.since as string | undefined;
      const sinceDate = parseSinceParam(since);

      const filtre: FiltrePresences = {};
      if (classId) filtre.classId = classId;
      if (period === 'MORNING' || period === 'AFTERNOON') filtre.period = period;
      if (subjectId) filtre.subjectId = subjectId;
      if (sinceDate) filtre.since = sinceDate;
      if (date) {
        filtre.dateDebut = startOfDayUtc(date);
        filtre.dateFin = endOfDayUtc(date);
      }

      if (role === 'STUDENT') {
        filtre.studentId = userId;
      } else if (role === 'PARENT') {
        const childIds = await this.parentRepository.findStudentIdsByParent(userId);
        if (childIds.length === 0) {
          res.json({ records: [], pagination: { total: 0, page, pages: 0, limit } });
          return;
        }
        filtre.studentId = studentId && childIds.includes(studentId) ? studentId : childIds;
      } else if (studentId) {
        filtre.studentId = studentId;
      }

      const [total, records] = await Promise.all([
        this.presenceRepository.countByFiltre(schoolId, filtre),
        this.presenceRepository.findAvecClasse({ schoolId, filtre, skip: (page - 1) * limit, take: limit }),
      ]);

      const studentIds = [...new Set(records.map((r) => r.studentId))];
      const recorderIds = [...new Set(records.map((r) => r.recordedById).filter((id): id is string => Boolean(id)))];
      const { studentMap, recorderMap } = await buildAttendanceUserMaps(this.userRepository, studentIds, recorderIds);

      res.json({
        success: true,
        serverTime: new Date().toISOString(),
        isDelta: Boolean(sinceDate),
        records: records.map((r) => ({
          ...r,
          student: studentMap.get(r.studentId) ?? null,
          markedBy: r.recordedById ? (recorderMap.get(r.recordedById) ?? null) : null,
        })),
        pagination: { total, page, pages: Math.ceil(total / limit), limit },
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v2/attendance/:id/justify
  justifierAbsence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      const schoolId: string = user.schoolId;
      const attendanceId = req.params.id as string;
      const { justification, approve } = req.body as { justification?: string; approve?: boolean };

      if (role !== 'ADMIN' && role !== 'STAFF') {
        res.status(403).json({ success: false, message: 'Seuls les administrateurs et le personnel peuvent justifier une absence' });
        return;
      }

      const record = await this.presenceRepository.findByIdDansEcole(schoolId, attendanceId);
      if (!record) {
        res.status(404).json({ success: false, message: 'Enregistrement introuvable' });
        return;
      }
      const isApprove = approve !== false;
      if (record.status !== 'ABSENT' && !(record.status === 'ABSENT_JUSTIFIED' && !isApprove)) {
        res.status(400).json({ success: false, message: 'Seules les absences peuvent être justifiées' });
        return;
      }

      const updated = await this.presenceRepository.justifierAbsence(schoolId, attendanceId, {
        justification,
        justifiedById: user.userId,
        justifiedAt: new Date(),
        approve: isApprove,
      });

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'justifier_absence', targetType: 'Attendance', targetId: attendanceId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { attendanceId, justification, approve: isApprove },
      });
      res.json({
        success: true,
        message: isApprove ? 'Absence justifiée' : 'Justificatif refusé',
        record: updated,
      });

      void notifierParentsPushDabord({
        schoolId,
        studentId: record.studentId,
        type: 'ABSENCE_ALERT',
        titre: isApprove ? "Justificatif d'absence accepté" : "Justificatif d'absence refusé",
        corps: isApprove
          ? `Le justificatif d'absence du ${record.date.toLocaleDateString('fr-FR')} a été validé.`
          : `Le justificatif d'absence du ${record.date.toLocaleDateString('fr-FR')} a été refusé par la vie scolaire.`,
      }).catch(() => {});
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'justifier_absence', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/attendance/daily-status
  statutJourClasses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      if (role !== 'ADMIN' && role !== 'STAFF') {
        res.status(403).json({ success: false, message: 'Accès réservé à la direction et à la vie scolaire' });
        return;
      }

      const dateParam = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const dateObj = startOfDayUtc(dateParam);
      const periodParam = req.query.period as string | undefined;
      const period: AttendancePeriod | undefined =
        periodParam === 'MORNING' || periodParam === 'AFTERNOON' ? periodParam : undefined;

      const classes = await this.presenceRepository.getDailyClassStatus(user.schoolId, dateObj, period);
      const summary = {
        totalClasses: classes.length,
        doneCount: classes.filter((c) => c.isDone).length,
        pendingCount: classes.filter((c) => !c.isDone).length,
      };
      res.json({ success: true, data: { date: dateParam, period: period ?? 'ALL', summary, classes } });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/attendance/repeated-absences
  absencesRepetees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      if (role !== 'ADMIN' && role !== 'STAFF') {
        res.status(403).json({ success: false, message: 'Accès réservé à la direction et à la vie scolaire' });
        return;
      }

      const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
      const sinceDate = new Date();
      sinceDate.setUTCDate(sinceDate.getUTCDate() - days);

      const config = this.schoolConfigRepository
        ? await this.schoolConfigRepository.findBySchoolId(user.schoolId)
        : null;
      const minAbsences = req.query.threshold
        ? Math.max(1, Number(req.query.threshold))
        : Math.max(1, config?.absenceAlertThreshold ?? 3);

      const students = await this.presenceRepository.getRepeatedAbsences(user.schoolId, minAbsences, sinceDate);
      res.json({ success: true, data: { threshold: minAbsences, days, students } });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v2/attendance/:id/correct
  corrigerStatut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      const schoolId: string = user.schoolId;
      const attendanceId = String(req.params.id);

      if (role !== 'ADMIN' && role !== 'STAFF' && role !== 'TEACHER') {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const record = await this.presenceRepository.findByIdDansEcole(schoolId, attendanceId);
      if (!record) {
        res.status(404).json({ success: false, message: 'Enregistrement de présence introuvable' });
        return;
      }

      if (role === 'TEACHER') {
        const rattache = this.rattachementRepository
          ? await this.rattachementRepository.estRattacheALaClasse(
              user.userId,
              record.classId,
              record.subjectId ?? undefined,
              { autoriserProfesseurPrincipal: true },
            )
          : record.teacherId === user.userId;
        if (!rattache) {
          res.status(403).json({ success: false, message: "Vous n'êtes pas rattaché à cette classe" });
          return;
        }
      }

      const { status: rawStatus, statut: rawStatut, arrivedAt, lateNote } = req.body as {
        status?: string;
        statut?: string;
        arrivedAt?: string | null;
        lateNote?: string | null;
      };
      const candidate = rawStatus ?? rawStatut;
      if (!candidate) {
        res.status(400).json({ success: false, message: 'Le nouveau statut est requis' });
        return;
      }
      const normalizedStatus = (candidate === 'EXCUSED' ? 'ABSENT_JUSTIFIED' : candidate) as AttendanceStatus;
      if (!['PRESENT', 'ABSENT', 'LATE', 'ABSENT_JUSTIFIED'].includes(normalizedStatus)) {
        res.status(400).json({ success: false, message: 'Statut de présence invalide' });
        return;
      }

      let arrivedAtDate: Date | null | undefined;
      if (arrivedAt === null) {
        arrivedAtDate = null;
      } else if (typeof arrivedAt === 'string' && arrivedAt.trim().length > 0) {
        const parsed = new Date(arrivedAt);
        arrivedAtDate = Number.isNaN(parsed.getTime()) ? undefined : parsed;
      }

      const updated = await this.presenceRepository.correctStatus(schoolId, attendanceId, {
        status: normalizedStatus,
        arrivedAt: arrivedAtDate,
        lateNote,
        updatedById: user.userId,
      });

      this.audit.journaliser({
        actorUserId: user.userId,
        actorRole: user.role,
        schoolId,
        actionName: 'corriger_presence',
        targetType: 'Attendance',
        targetId: attendanceId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { attendanceId, previousStatus: record.status, newStatus: normalizedStatus },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/attendance/:id/parent-justify
  soumettreJustificationParent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      if (role !== 'PARENT') {
        res.status(403).json({ success: false, message: 'Seuls les parents peuvent soumettre un justificatif sur cette route' });
        return;
      }

      const attendanceId = String(req.params.id);
      const record = await this.presenceRepository.findByIdDansEcole(user.schoolId, attendanceId);
      if (!record) {
        res.status(404).json({ success: false, message: 'Enregistrement introuvable' });
        return;
      }

      const allowed = await this.parentRepository.aAccesEleve(user.userId, record.studentId);
      if (!allowed) {
        res.status(403).json({ success: false, message: "Accès refusé pour cet élève" });
        return;
      }

      if (record.status !== 'ABSENT' && record.status !== 'LATE') {
        res.status(400).json({ success: false, message: 'Seule une absence ou un retard peut être justifié' });
        return;
      }

      const { justification, attachmentUrl } = req.body as { justification?: string; attachmentUrl?: string | null };
      if (!justification || justification.trim().length < 3) {
        res.status(400).json({ success: false, message: 'Veuillez saisir un motif de justification (min. 3 caractères)' });
        return;
      }

      const updated = await this.presenceRepository.submitParentJustification(user.schoolId, attendanceId, {
        parentUserId: user.userId,
        justification: justification.trim(),
        attachmentUrl: attachmentUrl ?? null,
      });

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'soumettre_justificatif_parent', targetType: 'Attendance', targetId: attendanceId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { attendanceId, studentId: record.studentId },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/attendance/stats
  statistiques = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const schoolId: string = user.schoolId;
      const role: string = (user.role as string).toUpperCase();
      const userId: string = user.userId;

      const classId = req.query.classId as string | undefined;
      const studentId = req.query.studentId as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const filtre: FiltrePresences = {};
      if (classId) filtre.classId = classId;
      if (studentId) filtre.studentId = studentId;
      if (from) filtre.dateDebut = startOfDayUtc(from);
      if (to) filtre.dateFin = endOfDayUtc(to);

      if (role === 'STUDENT') {
        filtre.studentId = userId;
      } else if (role === 'PARENT') {
        const childIds = await this.parentRepository.findStudentIdsByParent(userId);
        if (childIds.length === 0) {
          res.json({ stats: { total: 0, present: 0, absent: 0, late: 0, attendanceRate: '0%' } });
          return;
        }
        filtre.studentId = childIds;
      }

      const stats = await computeAttendanceStats(this.presenceRepository, schoolId, filtre);
      res.json({ stats });
    } catch (error) {
      next(error);
    }
  };
}
