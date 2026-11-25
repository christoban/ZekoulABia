import type { Request, Response, NextFunction } from 'express';
import {
  aVueGlobaleEcolesMaster,
  estSuperAdminMaster,
  peutVoirEcoleMaster,
} from '@application/masterAdmin/masterSchoolAccess';
import type { MasterAdminQueryRepository } from '@domain/ports/repositories/MasterAdminQueryRepository';
import { listSchoolBackups } from '../../../backup/SchoolBackupService';
import { gererErreurMasterAdmin } from './masterAdminSchoolHelper';

export async function listerEcolesAction(
  queryRepo: MasterAdminQueryRepository,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    const master = req.masterUser;

    const andConditions: Record<string, unknown>[] = [
      { subdomain: { not: 'system' } },
      { NOT: { subdomain: { startsWith: 'fixture-' } } },
    ];
    if (status) andConditions.push({ status });
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { subdomain: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      });
    }

    // Isolation par créateur / assignation pour les rôles sans vue globale (SCHOOL_MANAGER, SUPPORT ciblé)
    if (master && !aVueGlobaleEcolesMaster(master)) {
      const assigned = master.assignedSchoolIds ?? [];
      if (master.role === 'support') {
        if (assigned.length > 0) {
          andConditions.push({ id: { in: assigned } });
        }
      } else {
        andConditions.push({
          OR: [
            { createdByMasterId: master.id },
            ...(assigned.length > 0 ? [{ id: { in: assigned } }] : []),
          ],
        });
      }
    }

    const where: Record<string, unknown> =
      andConditions.length === 0
        ? {}
        : andConditions.length === 1
          ? andConditions[0]
          : { AND: andConditions };

    const [schools, total] = await Promise.all([
      queryRepo.listSchools(where, skip, take),
      queryRepo.countSchools(where),
    ]);

    res.json({
      success: true,
      data: schools,
      pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export async function detailEcoleAction(
  queryRepo: MasterAdminQueryRepository,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params.id as string;
    const basic = await queryRepo.findSchoolBasic(id);
    if (!basic) {
      res.status(404).json({ success: false, message: 'École introuvable' });
      return;
    }

    if (!peutVoirEcoleMaster(req.masterUser, basic.id, basic.createdByMasterId)) {
      res.status(403).json({ success: false, message: "Accès non autorisé à cet établissement" });
      return;
    }

    const school = await queryRepo.findSchoolWithDetail(id);

    if (!school) {
      res.status(404).json({ success: false, message: 'École introuvable' });
      return;
    }

    res.json({ success: true, data: school });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export async function listerLogsAction(
  queryRepo: MasterAdminQueryRepository,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { action, page = '1', limit = '50', type = 'all' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: Record<string, unknown> = {};
    if (action) {
      where.action = action;
    } else if (type === 'auth') {
      where.NOT = { action: { startsWith: 'action:' } };
    } else if (type === 'actions') {
      where.action = { startsWith: 'action:' };
    }

    if (req.masterUser && !estSuperAdminMaster(req.masterUser)) {
      where.masterUserId = req.masterUser.id;
    }

    const [logs, total] = await Promise.all([
      queryRepo.listMasterAuthAudit(where, skip, take),
      queryRepo.countMasterAuthAudit(where),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export async function listerEmailLogsAction(
  queryRepo: MasterAdminQueryRepository,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '', schoolId } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: Record<string, unknown> = {};
    if (schoolId) where.schoolId = schoolId;
    if (search) {
      where.OR = [
        { to: { contains: search as string, mode: 'insensitive' } },
        { subject: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [emailLogs, total] = await Promise.all([
      queryRepo.listEmailLogs(where, skip, take),
      queryRepo.countEmailLogs(where),
    ]);

    res.json({
      success: true,
      data: emailLogs,
      pagination: { page: parseInt(page as string), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

export async function listerSauvegardesAction(
  queryRepo: MasterAdminQueryRepository,
  fileStorage: import('@domain/ports/services/FileStoragePort').FileStoragePort | undefined,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!fileStorage) {
      res.json({ success: true, data: [] });
      return;
    }
    const schoolId = typeof req.query.schoolId === 'string' && req.query.schoolId.trim() ? req.query.schoolId.trim() : undefined;
    if (schoolId) {
      const backups = await listSchoolBackups(fileStorage, { schoolId });
      res.json({ success: true, data: backups });
      return;
    }
    const schools = await queryRepo.listSchools({}, 0, 500);
    const schoolIds = schools
      .map((s) => (s && typeof s === 'object' && 'id' in s ? String((s as { id: unknown }).id) : ''))
      .filter((id) => id.length > 0);
    const backups = await listSchoolBackups(fileStorage, { schoolIds });
    res.json({ success: true, data: backups });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}

// Vue "Sécurité plateforme" (chantier Sécurité de l'assistant IA). Transversale à tous les
// établissements, mais concentrée par défaut sur les refus (outcome=REFUSE) — la redevabilité
// métier détaillée de chaque école reste la vue "Journal d'établissement" côté admin d'école.
export async function listerJournalSecuriteIAAction(
  queryRepo: MasterAdminQueryRepository,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { schoolId, outcome, actorRole, origin, actionName, page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: Record<string, unknown> = {};
    if (schoolId) where.schoolId = schoolId;
    if (outcome) where.outcome = outcome;
    if (actorRole) where.actorRole = actorRole;
    if (origin) where.origin = origin;
    if (actionName) where.actionName = actionName;

    const [entries, total] = await Promise.all([
      queryRepo.listAiActionAudit(where, skip, take),
      queryRepo.countAiActionAudit(where),
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: { page: parseInt(page, 10), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    gererErreurMasterAdmin(error, res, next);
  }
}
