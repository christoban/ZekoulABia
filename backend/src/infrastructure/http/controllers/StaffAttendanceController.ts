/**
 * HTTP LAYER — Controller Pointage présence enseignants (V2.11)
 *
 * Routes :
 * - GET  /api/v2/staff-attendance/status — état de pointage de l'enseignant + modes disponibles
 * - POST /api/v2/staff-attendance/pointer — l'enseignant pointe (QR / GPS / manuel)
 * - GET  /api/v2/staff-attendance/scan-info — salle + cours courant (affiche le QR à scanner)
 * - GET  /api/v2/staff-attendance/settings — réglages de pointage de l'école (Admin/RH)
 * - PUT  /api/v2/staff-attendance/settings — mise à jour réglages GPS/QR (Admin)
 * - GET  /api/v2/staff-attendance/a-verifier — liste RH des entrées A_VERIFIER
 * - PATCH /api/v2/staff-attendance/:id/requalifier — RH requalifie un A_VERIFIER → PRESENT
 */
import type { Request, Response, NextFunction } from 'express';
import type { PointerPresenceEnseignantUseCase } from '@application/staffAttendance/PointerPresenceEnseignantUseCase';
import type { StaffAttendanceRepository } from '@domain/ports/repositories/StaffAttendanceRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

export class StaffAttendanceController {
  constructor(
    private readonly pointerUseCase: PointerPresenceEnseignantUseCase,
    private readonly staffAttendanceRepository: StaffAttendanceRepository,
    private readonly audit: AIActionAuditPort,
    private readonly prisma?: any,
  ) {}

  // GET /api/v2/staff-attendance/status — état du jour pour l'enseignant connecté
  monStatut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const teacherId = req.user!.userId;

      const now = new Date();
      const debut = new Date(now);
      debut.setHours(0, 0, 0, 0);
      const fin = new Date(debut);
      fin.setDate(fin.getDate() + 1);

      // Pointage du jour s'il existe
      const records = await this.staffAttendanceRepository.findBySchool(schoolId, {
        userId: teacherId,
        debut,
        fin,
      });
      const todayAttendance = records[0] ?? null;

      // Paramètres de l'école (GPS et TTL QR)
      const settings = await this.staffAttendanceRepository.getSettings(schoolId);
      const gpsConfigured = settings.schoolLatitude !== null && settings.schoolLongitude !== null;

      // Vérification des salles avec QR code dans l'école
      let qrConfigured = false;
      let rooms: { id: string; name: string; qrEnabled: boolean }[] = [];
      if (this.prisma) {
        try {
          rooms = await this.prisma.room.findMany({
            where: { schoolId },
            select: { id: true, name: true, qrEnabled: true },
            orderBy: { name: 'asc' },
          });
          qrConfigured = rooms.some(r => r.qrEnabled);
        } catch { /* ignore */ }
      }

      // Recherche d'un éventuel créneau de cours en ce moment pour l'enseignant
      let currentSlot: { id: string; subjectName: string | null; className: string | null; roomId: string | null; roomName: string | null; qrEnabled: boolean } | null = null;
      if (this.prisma) {
        try {
          const dayOfWeek = (now.getDay() + 6) % 7;
          const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const slot = await this.prisma.timetableSlot.findFirst({
            where: {
              teacherId,
              dayOfWeek,
              startTime: { lte: nowHHMM },
              endTime: { gt: nowHHMM },
              timetable: { schoolId, status: 'PUBLISHED' },
            },
            include: {
              subject: { select: { name: true } },
              class: { select: { name: true } },
              room: { select: { id: true, name: true, qrEnabled: true } },
            },
          });
          if (slot) {
            currentSlot = {
              id: slot.id,
              subjectName: slot.subject?.name ?? null,
              className: slot.class?.name ?? null,
              roomId: slot.room?.id ?? null,
              roomName: slot.room?.name ?? null,
              qrEnabled: slot.room?.qrEnabled ?? false,
            };
          }
        } catch { /* ignore */ }
      }

      // Recommandation du mode selon les disponibilités
      let recommendedMode: 'QR' | 'GPS' | 'MANUEL' = 'MANUEL';
      if (currentSlot?.qrEnabled) {
        recommendedMode = 'QR';
      } else if (qrConfigured) {
        recommendedMode = 'QR';
      } else if (gpsConfigured) {
        recommendedMode = 'GPS';
      }

      res.json({
        success: true,
        data: {
          hasCheckedIn: !!todayAttendance,
          attendance: todayAttendance,
          settings: {
            gpsConfigured,
            gpsRadiusMeters: settings.gpsRadiusMeters,
            schoolLatitude: settings.schoolLatitude,
            schoolLongitude: settings.schoolLongitude,
            qrConfigured,
          },
          rooms,
          currentSlot,
          recommendedMode,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/staff-attendance/pointer
  pointer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const body = req.body as {
        mode?: 'QR' | 'GPS' | 'MANUEL';
        qrToken?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        teacherId?: string;
      };

      // L'enseignant pointe pour lui-même ; un RH/Admin peut pointer pour un enseignant (mode MANUEL).
      const teacherId = req.user!.role === 'TEACHER' ? req.user!.userId : (body.teacherId ?? req.user!.userId);
      const mode = body.mode ?? 'MANUEL';

      const result = await this.pointerUseCase.execute({
        teacherId,
        schoolId,
        mode,
        qrToken: body.qrToken ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'pointer_presence_enseignant', targetType: 'StaffAttendance', targetId: result.attendance.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { mode, aVerifier: result.aVerifier, teacherId },
      });

      res.status(201).json({ success: true, data: { attendance: result.attendance, slot: result.slot, aVerifier: result.aVerifier } });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'pointer_presence_enseignant', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/staff-attendance/scan-info — salle + cours courant (l'enseignant affiche le QR de sa salle)
  scanInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { roomId } = req.query as { roomId?: string };
      if (!roomId) {
        res.status(400).json({ success: false, message: 'roomId requis' }); return;
      }
      const token = await this.pointerUseCase.genererTokenSalle(roomId, schoolId);
      res.json({ success: true, data: { qrToken: token } });
    } catch (error) {
      if (error instanceof Error && error.message.includes('QR non configuré')) {
        res.status(400).json({ success: false, message: error.message }); return;
      }
      next(error);
    }
  };

  // GET /api/v2/staff-attendance/settings — réglages de pointage pour l'admin
  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const settings = await this.staffAttendanceRepository.getSettings(schoolId);

      let rooms: { id: string; name: string; qrEnabled: boolean }[] = [];
      if (this.prisma) {
        rooms = await this.prisma.room.findMany({
          where: { schoolId },
          select: { id: true, name: true, qrEnabled: true },
          orderBy: { name: 'asc' },
        });
      }

      res.json({
        success: true,
        data: {
          settings,
          rooms,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v2/staff-attendance/settings — mise à jour réglages GPS / QR par l'admin
  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { gpsRadiusMeters, schoolLatitude, schoolLongitude, qrTokenTtlSeconds, roomsQrConfig } = req.body as {
        gpsRadiusMeters?: number;
        schoolLatitude?: number | null;
        schoolLongitude?: number | null;
        qrTokenTtlSeconds?: number;
        roomsQrConfig?: { roomId: string; qrEnabled: boolean }[];
      };

      if (this.prisma) {
        await this.prisma.staffAttendanceSettings.upsert({
          where: { schoolId },
          create: {
            schoolId,
            gpsRadiusMeters: gpsRadiusMeters ?? 75,
            qrTokenTtlSeconds: qrTokenTtlSeconds ?? 120,
            schoolLatitude: schoolLatitude ?? null,
            schoolLongitude: schoolLongitude ?? null,
          },
          update: {
            ...(gpsRadiusMeters !== undefined ? { gpsRadiusMeters } : {}),
            ...(qrTokenTtlSeconds !== undefined ? { qrTokenTtlSeconds } : {}),
            ...(schoolLatitude !== undefined ? { schoolLatitude } : {}),
            ...(schoolLongitude !== undefined ? { schoolLongitude } : {}),
          },
        });

        if (Array.isArray(roomsQrConfig)) {
          for (const item of roomsQrConfig) {
            await this.prisma.room.updateMany({
              where: { id: item.roomId, schoolId },
              data: { qrEnabled: item.qrEnabled },
            });
          }
        }
      }

      const updated = await this.staffAttendanceRepository.getSettings(schoolId);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/staff-attendance/a-verifier — liste RH des pointages à requalifier
  listerAVerifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const records = await this.staffAttendanceRepository.findBySchool(schoolId, { statut: 'A_VERIFIER' });
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v2/staff-attendance/:id/requalifier — RH requalifie un A_VERIFIER
  requalifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const id = req.params['id'] as string;
      const { statut } = req.body as { statut?: 'PRESENT' | 'ABSENT' | 'RETARD' };
      if (!statut || !['PRESENT', 'ABSENT', 'RETARD'].includes(statut)) {
        res.status(400).json({ success: false, message: 'statut requis (PRESENT, ABSENT ou RETARD)' }); return;
      }
      const updated = await this.staffAttendanceRepository.requalifier(id, schoolId, statut, req.user!.userId);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}