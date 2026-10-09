import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { PrismaDisciplineRepository } from '@infrastructure/persistence/prisma/PrismaDisciplineRepository';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { creerContainer } from '@infrastructure/config/container';
import { DisciplineController } from '@infrastructure/http/controllers/DisciplineController';
import { SchoolOnboardingController as SchoolOnboardingControllerForMaster } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { creerDisciplineRoutes } from '@infrastructure/http/routes/discipline.routes';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { protectMaster, authorizeMaster } from '../../http/middlewares/authMultiTenant';
import { requireMasterSensitiveAuth } from '../../http/middlewares/masterSensitiveAuth';
import type { PaymentMethod } from '@domain/types/enums';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { registerElectifsRoutes } from './electifs';

type Container = ReturnType<typeof creerContainer>;

export function registerModulesRoutes(app: Application, p: typeof prisma = prisma, c: Container): void {
  // ── Discipline ───────────────────────────────────────────────────────────────
  // Extraits de bootstrap.ts vers DisciplineController (déviation architecturale corrigée)
  const disciplineController = new DisciplineController(new PrismaDisciplineRepository(p), new PrismaUserRepository(p), new AIActionAuditAdapter(p));
  app.use('/api/v2/discipline', creerDisciplineRoutes(disciplineController));

  // ── Bibliothèque ─────────────────────────────────────────────────────────────

  // GET /api/v2/library/books — catalogue
  app.get('/api/v2/library/books', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { search, category, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(category ? { category } : {}),
        ...(search ? { OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
        ]} : {}),
      };
      const [total, books] = await Promise.all([
        p.book.count({ where }),
        p.book.findMany({
          where,
          include: { _count: { select: { loans: { where: { status: 'ACTIVE' } } } } },
          orderBy: { title: 'asc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'livres_disponibles', targetType: 'Book', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { search, category },
      });
      res.json({ success: true, data: books, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'livres_disponibles', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  });

  // POST /api/v2/library/books — ajouter un ouvrage
  app.post('/api/v2/library/books', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { title, author, isbn, quantity, category } = req.body as Record<string, string>;
      if (!title) { res.status(400).json({ success: false, message: 'title requis' }); return; }
      const qty = Math.max(1, parseInt(quantity ?? '1') || 1);
      const book = await p.book.create({
        data: { schoolId, title, author: author ?? null, isbn: isbn ?? null, quantity: qty, available: qty, category: category ?? null },
      });
      res.status(201).json({ success: true, data: book });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/library/books/:id — modifier un ouvrage
  app.patch('/api/v2/library/books/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await p.book.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      const updated = await p.book.update({
        where: { id: book.id },
        data: { ...req.body },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // DELETE /api/v2/library/books/:id — supprimer un ouvrage
  app.delete('/api/v2/library/books/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await p.book.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      const activeCount = await p.bookLoan.count({
        where: { bookId: book.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (activeCount > 0) {
        res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${activeCount} exemplaire(s) actuellement emprunté(s)`,
        });
        return;
      }
      await p.book.delete({ where: { id: book.id } });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // GET /api/v2/library/loans — emprunts actifs
  app.get('/api/v2/library/loans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { status = 'ACTIVE', page = '1', limit = '30' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = { schoolId, ...(status ? { status } : {}) };
      const [total, loans] = await Promise.all([
        p.bookLoan.count({ where }),
        p.bookLoan.findMany({
          where,
          include: {
            book: { select: { id: true, title: true, author: true, isbn: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { borrowedAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: loans, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // POST /api/v2/library/loans — enregistrer un emprunt
  app.post('/api/v2/library/loans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { bookId, studentId, dueDate } = req.body as Record<string, string>;
      if (!bookId || !studentId) { res.status(400).json({ success: false, message: 'bookId et studentId requis' }); return; }
      const book = await p.book.findFirst({ where: { id: bookId, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      if (book.available <= 0) { res.status(409).json({ success: false, message: 'Aucun exemplaire disponible' }); return; }
      const student = await p.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } });
      if (!student) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
      const [loan] = await p.$transaction([
        p.bookLoan.create({
          data: {
            schoolId, bookId, studentId,
            dueDate: dueDate ? new Date(dueDate) : null,
          },
          include: {
            book: { select: { id: true, title: true, author: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        p.book.update({ where: { id: bookId }, data: { available: { decrement: 1 } } }),
      ]);
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'emprunter_livre', targetType: 'BookLoan', targetId: loan.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { bookId, studentId, dueDate },
      });
      res.status(201).json({ success: true, data: loan });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'emprunter_livre', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // PATCH /api/v2/library/loans/:id/return — retour d'un livre
  app.patch('/api/v2/library/loans/:id/return', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const loan = await p.bookLoan.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!loan) { res.status(404).json({ success: false, message: 'Emprunt introuvable' }); return; }
      if (loan.status === 'RETURNED') { res.status(409).json({ success: false, message: 'Livre déjà retourné' }); return; }
      const [updated] = await p.$transaction([
        p.bookLoan.update({
          where: { id: loan.id },
          data: { status: 'RETURNED', returnedAt: new Date() },
          include: { book: { select: { id: true, title: true } } },
        }),
        p.book.update({ where: { id: loan.bookId }, data: { available: { increment: 1 } } }),
      ]);
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'retourner_livre', targetType: 'BookLoan', targetId: loan.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { loanId: loan.id },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      journaliserActionIA(p, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'retourner_livre', targetType: 'BookLoan', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  });

  // PATCH /api/v2/library/loans/:id/renew — prolonger la date limite d'un emprunt actif
  app.patch('/api/v2/library/loans/:id/renew', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { dueDate } = req.body as Record<string, string>;
      if (!dueDate) { res.status(400).json({ success: false, message: 'dueDate requis' }); return; }
      const newDueDate = new Date(dueDate);
      if (Number.isNaN(newDueDate.getTime()) || newDueDate <= new Date()) {
        res.status(400).json({ success: false, message: 'dueDate doit être une date future valide' }); return;
      }
      const loan = await p.bookLoan.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!loan) { res.status(404).json({ success: false, message: 'Emprunt introuvable' }); return; }
      if (loan.status === 'RETURNED') { res.status(409).json({ success: false, message: 'Livre déjà retourné — impossible de renouveler' }); return; }
      const updated = await p.bookLoan.update({
        where: { id: loan.id },
        // Renouveler un emprunt en retard le remet ACTIVE — sinon le job markOverdueLoans le
        // re-marquerait OVERDUE dès le lendemain malgré la nouvelle date limite future.
        data: { dueDate: newDueDate, status: 'ACTIVE' },
        include: { book: { select: { id: true, title: true } } },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // GET /api/v2/library/my-loans — emprunts de l'élève connecté ou des enfants du parent
  app.get('/api/v2/library/my-loans', requireAuth, async (req, res, next) => {
    try {
      const { userId, role, schoolId } = req.user!;
      const { studentId } = req.query as Record<string, string>;

      if (role === 'STUDENT') {
        const loans = await p.bookLoan.findMany({
          where: { schoolId, studentId: userId },
          include: { book: { select: { id: true, title: true, author: true, category: true } } },
          orderBy: { borrowedAt: 'desc' },
          take: 50,
        });
        res.json({ success: true, data: loans });
        return;
      }

      if (role === 'PARENT') {
        const parentProfile = await p.parentProfile.findUnique({
          where: { userId },
          include: { children: { include: { studentProfile: { select: { userId: true } } } } },
        });
        const childUserIds = (parentProfile?.children ?? [])
          .map(c => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));

        if (studentId && !childUserIds.includes(studentId)) {
          res.status(403).json({ success: false, message: 'Accès refusé' });
          return;
        }

        const targetIds = studentId ? [studentId] : childUserIds;
        const loans = await p.bookLoan.findMany({
          where: { schoolId, studentId: { in: targetIds } },
          include: {
            book: { select: { id: true, title: true, author: true, category: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { borrowedAt: 'desc' },
          take: 100,
        });
        res.json({ success: true, data: loans });
        return;
      }

      res.status(403).json({ success: false, message: 'Accès refusé' });
    } catch (err) { next(err); }
  });

  // ── Factures parent (portail parent) ────────────────────────────────────────
  // GET /api/v2/parent/invoices?studentId= — factures d'un enfant du parent connecté
  app.get('/api/v2/parent/invoices', requireAuth, requireRole('PARENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { studentId, page = '1', limit = '30' } = req.query as Record<string, string>;

      const parentProfile = await p.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: { select: { userId: true } } } } },
      });
      const childUserIds = (parentProfile?.children ?? [])
        .map(c => c.studentProfile?.userId)
        .filter((id): id is string => Boolean(id));

      if (studentId && !childUserIds.includes(studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        studentId: studentId ? studentId : { in: childUserIds },
      };

      const [total, invoices] = await Promise.all([
        p.invoice.count({ where }),
        p.invoice.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            feePlan: { select: { id: true, name: true, feeType: true, amount: true } },
            payments: { select: { id: true, amount: true, status: true, paidAt: true, method: true, feeType: true, cautionStatus: true, refundedAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: invoices, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // POST /api/v2/parent/pay — initier un paiement Mobile Money (PARENT)
  app.post('/api/v2/parent/pay', requireAuth, requireRole('PARENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { invoiceId, method, phoneNumber, amount } = req.body as { invoiceId: string; method: string; phoneNumber: string; amount?: number };

      if (!invoiceId || !method || !phoneNumber) {
        res.status(400).json({ success: false, message: 'invoiceId, method et phoneNumber requis' }); return;
      }
      if (!['MTN_MOMO', 'ORANGE_MONEY'].includes(method)) {
        res.status(400).json({ success: false, message: 'method invalide. Valeurs : MTN_MOMO, ORANGE_MONEY' }); return;
      }

      // Vérifier que la facture appartient à un enfant du parent
      const invoice = await p.invoice.findFirst({ where: { id: invoiceId, schoolId } });
      if (!invoice) { res.status(404).json({ success: false, message: 'Facture introuvable' }); return; }

      const parentProfile = await p.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: { select: { userId: true } } } } },
      });
      const childUserIds = (parentProfile?.children ?? [])
        .map(c => c.studentProfile?.userId)
        .filter((id): id is string => Boolean(id));

      if (!childUserIds.includes(invoice.studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }

      const result = await c.finance.initierPaiement.execute({
        factureId: invoiceId,
        studentId: invoice.studentId,
        method: method as PaymentMethod,
        phoneNumber,
        schoolId,
        amount: typeof amount === 'number' && amount > 0 ? amount : undefined,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // POST /api/v2/parent/payments/verify — vérifier et synchroniser activement le statut d'un paiement Mobile Money
  app.post('/api/v2/parent/payments/verify', requireAuth, requireRole('PARENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { invoiceId, paymentId, campayRef } = req.body as { invoiceId?: string; paymentId?: string; campayRef?: string };

      if (!invoiceId && !paymentId && !campayRef) {
        res.status(400).json({ success: false, message: 'invoiceId, paymentId ou campayRef requis' });
        return;
      }

      // Si invoiceId fourni, vérifier que la facture appartient bien à un enfant du parent
      if (invoiceId) {
        const invoice = await p.invoice.findFirst({ where: { id: invoiceId, schoolId } });
        if (!invoice) {
          res.status(404).json({ success: false, message: 'Facture introuvable' });
          return;
        }

        const parentProfile = await p.parentProfile.findUnique({
          where: { userId },
          include: { children: { include: { studentProfile: { select: { userId: true } } } } },
        });
        const childUserIds = (parentProfile?.children ?? [])
          .map(c => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));

        if (!childUserIds.includes(invoice.studentId)) {
          res.status(403).json({ success: false, message: 'Accès refusé' });
          return;
        }
      }

      const result = await c.finance.verifierStatutPaiement.execute({
        schoolId,
        invoiceId,
        paymentId,
        campayRef,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // Master admin — approbation d'une école (hexagonale) — vérification identité requise
  // /api/master/ (v1) ne passe PAS par le router /api/v2/master, donc protectMaster est nécessaire
  const onboardingControllerForMaster2 = new SchoolOnboardingControllerForMaster(c.school.onboarder, c.school.approuver);
  app.post(
    '/api/master/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin']),
    requireMasterSensitiveAuth,
    onboardingControllerForMaster2.approuverEcole,
  );
  // /api/v2/master/ passe déjà par router.use(protectMaster) dans creerMasterAdminHexRoutes
  // → ne pas répéter protectMaster ici pour éviter la double requête MasterUser
  app.post(
    '/api/v2/master/schools/:id/approve',
    authorizeMaster(['super_admin', 'platform_admin']),
    requireMasterSensitiveAuth,
    onboardingControllerForMaster2.approuverEcole,
  );

  registerElectifsRoutes(app, p, c);
}
