import type { Request, Response, NextFunction } from 'express';
import type { ConfigurerEcheancierFactureUseCase } from '@application/finance/ConfigurerEcheancierFactureUseCase';
import type { AppliquerRemiseEleveUseCase } from '@application/finance/AppliquerRemiseEleveUseCase';
import type { AnnulerPaiementUseCase } from '@application/finance/AnnulerPaiementUseCase';
import type { CloturerCaisseUseCase } from '@application/finance/CloturerCaisseUseCase';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import type { DiscountReasonType } from '@domain/types/enums';
import type { AuthPayload } from '../middlewares/auth';
import { canReadStudentFinanceRecord } from './helpers/financeControllerHelpers';

export class FinanceOperationsController {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly paiementRepository: PaiementRepository,
    private readonly configurerEcheancier: ConfigurerEcheancierFactureUseCase,
    private readonly appliquerRemise: AppliquerRemiseEleveUseCase,
    private readonly annulerPaiementUseCase: AnnulerPaiementUseCase,
    private readonly cloturerCaisseUseCase: CloturerCaisseUseCase,
    private readonly userRepository: UserRepository,
    private readonly parentRepository: ParentRepository,
    private readonly audit: AIActionAuditPort,
    private readonly notificationService: NotificationService,
    private readonly smsNotification?: SmsNotificationPort,
  ) {}

  private hasWriteAccess(user: AuthPayload | undefined, res: Response): boolean {
    if (!user) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return false;
    }
    const role = String(user.role).toUpperCase();
    if (role === 'ADMIN') return true;
    const perms = user.permissions ?? [];
    if (role === 'STAFF' && (perms.includes('MANAGE_FINANCE') || perms.includes('VALIDATE_PAYMENTS'))) {
      return true;
    }
    res.status(403).json({ success: false, message: 'Permission MANAGE_FINANCE requise' });
    return false;
  }

  obtenirDetailsFacture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const invoiceId = req.params.invoiceId as string;
      const facture = await this.factureRepository.findById(invoiceId);
      if (!facture) {
        res.status(404).json({ success: false, message: 'Facture introuvable' });
        return;
      }

      const allowed = await canReadStudentFinanceRecord({
        user,
        recordSchoolId: facture.schoolId,
        studentId: facture.studentId,
        parentRepository: this.parentRepository,
      });
      if (!allowed) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const [installments, discounts, payments, totalPaid, creditBalance] = await Promise.all([
        this.factureRepository.getInstallments(invoiceId),
        this.factureRepository.getDiscounts(invoiceId),
        this.paiementRepository.findByFacture(invoiceId),
        this.factureRepository.calculerTotalPayeAvecSucces(invoiceId),
        this.factureRepository.calculerAvoirDisponible(facture.schoolId, facture.studentId),
      ]);

      res.json({
        success: true,
        data: {
          invoice: facture.toObject(),
          installments,
          discounts,
          payments: payments.map((p) => p.toObject()),
          totalPaid,
          remainingBalance: Math.max(0, facture.amount - totalPaid),
          studentCreditBalance: creditBalance,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  configurerEcheancierHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const invoiceId = req.params.invoiceId as string;
      const { tranches } = req.body as { tranches?: { label: string; amount: number; dueDate: string }[] };
      if (!Array.isArray(tranches) || tranches.length === 0) {
        res.status(400).json({ success: false, message: 'tranches requis (tableau non vide)' });
        return;
      }

      const result = await this.configurerEcheancier.execute({
        schoolId: user!.schoolId,
        invoiceId,
        tranches,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('introuvable') || error.message.includes('somme des tranches'))) {
        res.status(error.message.includes('introuvable') ? 404 : 400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  accorderRemiseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const invoiceId = req.params.invoiceId as string;
      const { reasonType, amount, percentage, justification } = req.body as {
        reasonType?: DiscountReasonType;
        amount?: number;
        percentage?: number;
        justification?: string;
      };
      if (!reasonType || !justification) {
        res.status(400).json({ success: false, message: 'reasonType et justification requis' });
        return;
      }

      const result = await this.appliquerRemise.execute({
        schoolId: user!.schoolId,
        invoiceId,
        reasonType,
        amount: amount !== undefined ? Number(amount) : undefined,
        percentage: percentage !== undefined ? Number(percentage) : undefined,
        justification,
        grantedById: user!.userId,
      });

      this.audit.journaliser({
        actorUserId: user!.userId,
        actorRole: user!.role,
        schoolId: user!.schoolId,
        actionName: 'accorder_remise_eleve',
        targetType: 'Invoice',
        targetId: invoiceId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { reasonType, amount: result.discount.amount, justification },
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('obligatoire') || error.message.includes('introuvable') || error.message.includes('supérieur à 0'))) {
        res.status(error.message.includes('introuvable') ? 404 : 400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  enregistrerPromesseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const invoiceId = req.params.invoiceId as string;
      const { promisedDate, note } = req.body as { promisedDate?: string; note?: string };
      if (!promisedDate) {
        res.status(400).json({ success: false, message: 'promisedDate requis' });
        return;
      }
      const parsed = new Date(promisedDate);
      if (Number.isNaN(parsed.getTime())) {
        res.status(400).json({ success: false, message: 'promisedDate invalide' });
        return;
      }

      const updated = await this.factureRepository.enregistrerPromessePaiement({
        schoolId: user!.schoolId,
        invoiceId,
        promisedDate: parsed,
        note: note?.trim(),
        promisedByUserId: user!.userId,
      });
      res.json({ success: true, data: updated.toObject() });
    } catch (error) {
      if (error instanceof Error && error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  relancerFactureHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const invoiceId = req.params.invoiceId as string;
      const facture = await this.factureRepository.findById(invoiceId);
      if (!facture || facture.schoolId !== user!.schoolId) {
        res.status(404).json({ success: false, message: 'Facture introuvable' });
        return;
      }

      const [totalPaid, student] = await Promise.all([
        this.factureRepository.calculerTotalPayeAvecSucces(invoiceId),
        this.userRepository.findById(facture.studentId),
      ]);
      const balance = Math.max(0, facture.amount - totalPaid);
      const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Élève';
      const label = facture.description ?? 'Frais de scolarité';

      if (this.notificationService.notifierParents) {
        await this.notificationService.notifierParents({
          schoolId: user!.schoolId,
          studentId: facture.studentId,
          type: 'PAYMENT_REMINDER',
          titre: 'Relance paiement scolarité',
          corps: `Solde restant de ${balance} XAF pour ${studentName} (${label}).`,
        });
      }

      if (this.smsNotification) {
        void this.smsNotification.notifyOverdueInvoiceSms({
          schoolId: user!.schoolId,
          studentId: facture.studentId,
          studentName,
          amount: balance,
          daysOverdue: 0,
          invoiceLabel: label,
        });
      }

      res.json({ success: true, message: 'Relance envoyée aux parents (Push + SMS)' });
    } catch (error) {
      next(error);
    }
  };

  annulerPaiementHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const paymentId = req.params.paymentId as string;
      const { reason } = req.body as { reason?: string };

      const result = await this.annulerPaiementUseCase.execute({
        schoolId: user!.schoolId,
        paymentId,
        cancelledById: user!.userId,
        reason: reason ?? '',
      });

      this.audit.journaliser({
        actorUserId: user!.userId,
        actorRole: user!.role,
        schoolId: user!.schoolId,
        actionName: 'annuler_paiement',
        targetType: 'Payment',
        targetId: paymentId,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { reason, receiptNumber: result.receiptNumber },
      });

      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('introuvable')) { res.status(404).json({ success: false, message: msg }); return; }
        if (msg.includes('déjà été annulé') || msg.includes('clôturée')) { res.status(409).json({ success: false, message: msg }); return; }
        if (msg.includes('obligatoire') || msg.includes('validés')) { res.status(400).json({ success: false, message: msg }); return; }
      }
      next(error);
    }
  };

  listerPaiementsNonRapprochesHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const items = await this.paiementRepository.listerPaiementsNonRapproches(user!.schoolId);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  };

  rapprocherPaiementHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const paymentId = req.params.paymentId as string;
      const { invoiceId } = req.body as { invoiceId?: string };
      if (!invoiceId) {
        res.status(400).json({ success: false, message: 'invoiceId requis' });
        return;
      }
      const result = await this.paiementRepository.rapprocherPaiementMobile({
        schoolId: user!.schoolId,
        paymentId,
        invoiceId,
        reconciledById: user!.userId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  listerCloturesCaisseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const closures = await this.paiementRepository.listerCloturesCaisse(user!.schoolId);
      res.json({ success: true, data: closures });
    } catch (error) {
      next(error);
    }
  };

  cloturerCaisseHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!this.hasWriteAccess(user, res)) return;
      const { closureDate, declaredCash, notes } = req.body as {
        closureDate?: string;
        declaredCash?: number | null;
        notes?: string;
      };
      const result = await this.cloturerCaisseUseCase.execute({
        schoolId: user!.schoolId,
        closureDate: closureDate ?? new Date().toISOString().slice(0, 10),
        closedById: user!.userId,
        declaredCash: declaredCash !== undefined && declaredCash !== null ? Number(declaredCash) : null,
        notes: notes ?? null,
      });

      this.audit.journaliser({
        actorUserId: user!.userId,
        actorRole: user!.role,
        schoolId: user!.schoolId,
        actionName: 'cloturer_caisse',
        targetType: 'CashClosure',
        targetId: result.id,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { closureDate: result.closureDate, totalCash: result.totalCash, variance: result.variance },
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };
}

