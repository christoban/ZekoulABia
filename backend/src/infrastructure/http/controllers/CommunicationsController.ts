import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import {
  BroadcastService,
  type BroadcastTarget,
  type BroadcastChannel,
} from '@infrastructure/services/communication/BroadcastService';

// ─── Compat re-exports (core.ts:991 imports from this file) ──────────────────
export {
  executerBroadcast,
  resolveRecipients,
  type BroadcastTarget,
  type BroadcastChannel,
  type BroadcastResultat,
  type Recipient,
} from '@infrastructure/services/communication/BroadcastService';

// ─── Controller ───────────────────────────────────────────────────────────────

export class CommunicationsController {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly audit: AIActionAuditPort,
  ) {}

  // GET /api/v2/communications/broadcasts/preview?role=&classId=&level=&paymentStatus=
  preview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { role, classId, level, paymentStatus } = req.query as {
        role?: string; classId?: string; level?: string; paymentStatus?: string;
      };

      const target: BroadcastTarget = {
        role: role as BroadcastTarget['role'],
        classId,
        level,
        paymentStatus: paymentStatus as BroadcastTarget['paymentStatus'],
      };

      const recipients = await this.broadcastService.resolveRecipients(schoolId, target);
      const withPhone = recipients.filter((r) => r.phone).length;
      const withEmail = recipients.filter((r) => r.email).length;

      res.json({ success: true, data: { total: recipients.length, withPhone, withEmail } });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/communications/broadcast
  broadcast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const createdById = req.user!.userId;
      const { target, channel, message } = req.body as {
        target: BroadcastTarget;
        channel: BroadcastChannel;
        message: string;
      };

      if (!message?.trim()) {
        res.status(400).json({ success: false, error: 'Le message est requis.' });
        return;
      }
      if (!channel || !['SMS', 'EMAIL', 'BOTH'].includes(channel)) {
        res.status(400).json({ success: false, error: 'Canal invalide. Utilisez SMS, EMAIL ou BOTH.' });
        return;
      }
      if (!target || (!target.role && !target.classId && !target.level && !target.paymentStatus)) {
        res.status(400).json({ success: false, error: 'Aucun filtre de ciblage fourni.' });
        return;
      }

      const resultat = await this.broadcastService.executer(schoolId, createdById, target, channel, message);
      this.audit.journaliser({
        actorUserId: createdById!, actorRole: req.user?.role, schoolId,
        actionName: 'diffuser_message', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { target, channel },
      });
      if (resultat.total === 0) {
        res.json({ success: true, data: { ...resultat, message: 'Aucun destinataire trouvé.' } });
        return;
      }

      res.json({ success: true, data: resultat });
    } catch (err) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'diffuser_message', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  };

  // GET /api/v2/communications/broadcasts?page=1&limit=20
  history = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const page = Math.max(1, parseInt(String(req.query['page'] ?? 1)));
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? 20))));

      const { logs, total } = await this.broadcastService.listHistory(schoolId, page, limit);

      res.json({ success: true, data: { logs, total, page, limit } });
    } catch (err) {
      next(err);
    }
  };
}
