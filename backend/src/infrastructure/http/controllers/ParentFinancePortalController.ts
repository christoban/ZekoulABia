import type { Request, Response, NextFunction } from 'express';
import type { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import type { VerifierStatutPaiementUseCase } from '@application/finance/VerifierStatutPaiementUseCase';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { ParentFinancePortalRepository } from '@domain/ports/repositories/ParentFinancePortalRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { PaymentMethod } from '@domain/types/enums';

/**
 * Préfixe /api/v2/parent — factures, paiements Mobile Money et promesses de paiement du portail parent.
 */
export class ParentFinancePortalController {
  constructor(
    private readonly portalRepository: ParentFinancePortalRepository,
    private readonly parentRepository: ParentRepository,
    private readonly factureRepository: FactureRepository,
    private readonly initierPaiement: InitierPaiementMobileMoneyUseCase,
    private readonly verifierStatutPaiement: VerifierStatutPaiementUseCase,
  ) {}

  // GET /api/v2/parent/invoices?studentId= — factures d'un enfant du parent connecté
  listInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { studentId, page = '1', limit = '30' } = req.query as Record<string, string>;

      const childUserIds = await this.parentRepository.findStudentIdsByParent(userId);

      if (studentId && !childUserIds.includes(studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

      const { total, invoices } = await this.portalRepository.listInvoicesForParent({
        schoolId,
        studentId,
        childUserIds,
        page: pageNum,
        limit: limitNum,
      });

      res.json({
        success: true,
        data: invoices,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/parent/pay — initier un paiement Mobile Money (PARENT)
  initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { invoiceId, method, phoneNumber, amount } = req.body as {
        invoiceId: string;
        method: string;
        phoneNumber: string;
        amount?: number;
      };

      if (!invoiceId || !method || !phoneNumber) {
        res.status(400).json({ success: false, message: 'invoiceId, method et phoneNumber requis' });
        return;
      }
      if (!['MTN_MOMO', 'ORANGE_MONEY'].includes(method)) {
        res.status(400).json({
          success: false,
          message: 'method invalide. Valeurs : MTN_MOMO, ORANGE_MONEY',
        });
        return;
      }

      // Vérifier que la facture appartient à un enfant du parent
      const invoice = await this.portalRepository.findInvoiceOwnership(invoiceId, schoolId);
      if (!invoice) {
        res.status(404).json({ success: false, message: 'Facture introuvable' });
        return;
      }

      const childUserIds = await this.parentRepository.findStudentIdsByParent(userId);
      if (!childUserIds.includes(invoice.studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const result = await this.initierPaiement.execute({
        factureId: invoiceId,
        studentId: invoice.studentId,
        method: method as PaymentMethod,
        phoneNumber,
        schoolId,
        amount: typeof amount === 'number' && amount > 0 ? amount : undefined,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/parent/payments/verify — vérifier et synchroniser activement le statut d'un paiement Mobile Money
  verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { invoiceId, paymentId, campayRef } = req.body as {
        invoiceId?: string;
        paymentId?: string;
        campayRef?: string;
      };

      if (!invoiceId && !paymentId && !campayRef) {
        res.status(400).json({ success: false, message: 'invoiceId, paymentId ou campayRef requis' });
        return;
      }

      const childUserIds = await this.parentRepository.findStudentIdsByParent(userId);

      // Vérifier l'ownership sur invoiceId ET/OU paymentId / campayRef
      if (invoiceId) {
        const invoice = await this.portalRepository.findInvoiceOwnership(invoiceId, schoolId);
        if (!invoice) {
          res.status(404).json({ success: false, message: 'Facture introuvable' });
          return;
        }
        if (!childUserIds.includes(invoice.studentId)) {
          res.status(403).json({ success: false, message: 'Accès refusé' });
          return;
        }
      }

      if (paymentId || campayRef) {
        const payment = await this.portalRepository.findPaymentOwnership({ paymentId, campayRef });
        if (!payment) {
          res.status(404).json({ success: false, message: 'Paiement introuvable' });
          return;
        }
        if (payment.schoolId !== schoolId || !childUserIds.includes(payment.studentId)) {
          res.status(403).json({ success: false, message: 'Accès refusé à ce paiement' });
          return;
        }
      }

      const result = await this.verifierStatutPaiement.execute({
        schoolId,
        invoiceId,
        paymentId,
        campayRef,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/parent/invoices/:id/promise — enregistrer une promesse de paiement par le parent
  recordPaymentPromise = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const invoiceId = req.params.id as string;
      const { promisedDate, note } = req.body as { promisedDate?: string; note?: string };

      if (!promisedDate) {
        res.status(400).json({ success: false, message: 'Date de promesse requise' });
        return;
      }
      const parsedDate = new Date(promisedDate);
      if (Number.isNaN(parsedDate.getTime())) {
        res.status(400).json({ success: false, message: 'Date de promesse invalide' });
        return;
      }

      const invoice = await this.portalRepository.findInvoiceOwnership(invoiceId, schoolId);
      if (!invoice) {
        res.status(404).json({ success: false, message: 'Facture introuvable' });
        return;
      }

      const childUserIds = await this.parentRepository.findStudentIdsByParent(userId);
      if (!childUserIds.includes(invoice.studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé à cette facture' });
        return;
      }

      const updated = await this.factureRepository.enregistrerPromessePaiement({
        schoolId,
        invoiceId: invoice.id,
        promisedDate: parsedDate,
        note: typeof note === 'string' ? note.trim() : undefined,
        promisedByUserId: userId,
      });

      res.status(200).json({ success: true, data: updated.toObject() });
    } catch (err) {
      next(err);
    }
  };
}
