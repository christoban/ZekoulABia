import type { Request, Response, NextFunction } from 'express';
import type { AuthPayload } from '../middlewares/auth';
import type { PlanFraisACopier } from '@application/finance/CopierPlansFraisAnneePrecedenteUseCase';
import type { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import type { ModifierPlanFraisUseCase } from '@application/finance/ModifierPlanFraisUseCase';
import type { ChangerStatutPlanFraisUseCase } from '@application/finance/ChangerStatutPlanFraisUseCase';
import type { GenererFactureUseCase } from '@application/finance/GenererFactureUseCase';
import type { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import type { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import type { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';
import type { RembourserCautionUseCase } from '@application/finance/RembourserCautionUseCase';
import type { EnregistrerDepenseUseCase } from '@application/finance/EnregistrerDepenseUseCase';
import type { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import type { CopierPlansFraisAnneePrecedenteUseCase } from '@application/finance/CopierPlansFraisAnneePrecedenteUseCase';
import type { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import type { FeePlanStatus, PaymentMethod } from '@domain/types/enums';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { CarnetLiaisonRepository } from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { ReceiptPdfRendererPort } from '@domain/ports/services/ReceiptPdfRendererPort';
import { ReceiptPdfRenderer } from '@infrastructure/pdf/finance/ReceiptPdfRenderer';
import {
  canReadStudentFinanceRecord,
  dispatchCampaySuccessNotifications,
  dispatchCashSuccessHooks,
  handleFinanceControllerError,
  notifierCreationPlanFraisHelper,
  verifyCampayWebhookSignature,
} from './helpers/financeControllerHelpers';

export interface FinanceControllerExtras {
  receiptRenderer?: ReceiptPdfRendererPort;
  parentRepository?: ParentRepository;
  carnetRepository?: CarnetLiaisonRepository;
  creerEntreeCarnet?: CreerEntreeCarnetUseCase;
}

export class FinanceController {
  private readonly receiptRenderer: ReceiptPdfRendererPort;

  constructor(
    private readonly creerPlanFrais: CreerPlanFraisUseCase,
    private readonly modifierPlanFrais: ModifierPlanFraisUseCase,
    private readonly genererFacture: GenererFactureUseCase,
    private readonly genererFacturesEnMasse: GenererFacturesEnMasseUseCase,
    private readonly initierPaiement: InitierPaiementMobileMoneyUseCase,
    private readonly traiterWebhook: TraiterWebhookCampayUseCase,
    private readonly rembourserCaution: RembourserCautionUseCase,
    private readonly enregistrerDepense: EnregistrerDepenseUseCase,
    private readonly enregistrerPaiementCash: EnregistrerPaiementCashUseCase,
    private readonly copierPlansFraisAnneePrecedente: CopierPlansFraisAnneePrecedenteUseCase,
    private readonly changerStatutPlanFrais: ChangerStatutPlanFraisUseCase,
    private readonly paiementRepository: PaiementRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly userRepository: UserRepository,
    private readonly audit: AIActionAuditPort,
    private readonly notificationService: NotificationService,
    private readonly extras: FinanceControllerExtras = {},
  ) {
    this.receiptRenderer = extras.receiptRenderer ?? new ReceiptPdfRenderer();
  }

  private async checkFinancePermission(user: AuthPayload | undefined, res: Response, allowAdmin = false): Promise<boolean> {
    if (!user) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return false;
    }
    const perms: string[] = user.permissions ?? [];
    if (perms.includes('MANAGE_FINANCE') || perms.includes('VALIDATE_PAYMENTS')) return true;

    if (user.role === 'ADMIN') {
      if (allowAdmin) return true;
      res.status(403).json({
        success: false,
        message: 'La gestion financière directe est réservée à l\'Intendant / Économe. La Direction assure la supervision en lecture seule.',
      });
      return false;
    }

    res.status(403).json({ success: false, message: 'Permission MANAGE_FINANCE requise' });
    return false;
  }

  // GET /api/v2/finance/payments/:paymentId/receipt
  genererRecu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const paymentId = req.params.paymentId as string;
      const payment = await this.paiementRepository.findRecuData(paymentId);

      if (!payment) {
        res.status(404).json({ success: false, message: 'Paiement introuvable' });
        return;
      }

      const allowed = await canReadStudentFinanceRecord({
        user,
        recordSchoolId: payment.schoolId,
        studentId: payment.studentId,
        parentRepository: this.extras.parentRepository,
      });
      if (!allowed) {
        res.status(403).json({ success: false, message: 'Accès refusé à ce reçu' });
        return;
      }

      const isDuplicate = req.query.duplicate === 'true' || req.query.duplicate === '1';
      const pdfBuffer = await this.receiptRenderer.renderReceiptPdf({
        payment,
        isDuplicate,
        language: req.query.lang === 'en' ? 'en' : req.query.lang === 'fr' ? 'fr' : 'bilingual',
      });
      const shortId = payment.id.slice(-8).toUpperCase();
      const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
      const receiptNum = payment.receiptNumber ?? `REC-${year}-${shortId}`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="recu-${receiptNum}.pdf"`);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/finance/fee-plans
  creerPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res))) return;
      const resultat = await this.creerPlanFrais.execute({
        schoolId: user.schoolId, demandeurRole: user.role, ...req.body,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'creer_plan_frais', targetType: 'FeePlan', targetId: resultat.planId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });
      void notifierCreationPlanFraisHelper({
        schoolId: user.schoolId, createur: { userId: user.userId, role: user.role },
        resume: `créé le plan de frais « ${resultat.name} » (${resultat.amount} FCFA)`,
        userRepository: this.userRepository, schoolRepository: this.schoolRepository, notificationService: this.notificationService,
      });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_plan_frais', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/fee-plans/copy-from-previous-year
  copierPlansAnneePrecedente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res))) return;
      const { targetAcademicYearId, plans } = req.body as { targetAcademicYearId?: string; plans?: PlanFraisACopier[] };
      if (!targetAcademicYearId) { res.status(400).json({ success: false, message: 'targetAcademicYearId requis' }); return; }
      if (!Array.isArray(plans) || plans.length === 0) { res.status(400).json({ success: false, message: 'Aucun plan à reconduire — la liste "plans" est vide' }); return; }
      const resultat = await this.copierPlansFraisAnneePrecedente.execute({
        schoolId: user.schoolId, targetAcademicYearId,
        plans: plans.map((p) => ({
          name: p.name, amount: p.amount, feeType: p.feeType, level: p.level,
          sectionId: p.sectionId, isRefundable: p.isRefundable,
          dueDate: p.dueDate ? new Date(p.dueDate) : undefined, description: p.description,
        })),
      });
      res.status(201).json({ success: true, data: resultat });
      void notifierCreationPlanFraisHelper({
        schoolId: user.schoolId, createur: { userId: user.userId, role: user.role },
        resume: `reconduit ${resultat.crees} plan(s) de frais pour la nouvelle année scolaire`,
        userRepository: this.userRepository, schoolRepository: this.schoolRepository, notificationService: this.notificationService,
      });
    } catch (error) {
      handleFinanceControllerError(error, res, next);
    }
  };

  // PATCH /api/v2/finance/fee-plans/:id/status
  changerStatutPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res, true))) return;
      const { id } = req.params as { id: string };
      const { statutCible } = req.body as { statutCible?: FeePlanStatus };
      if (!statutCible) { res.status(400).json({ success: false, message: 'statutCible requis' }); return; }
      if (statutCible === 'PUBLISHED' && user.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: "Seul l'administrateur (Direction) peut valider et publier un plan de frais.",
        });
        return;
      }
      const resultat = await this.changerStatutPlanFrais.execute({
        schoolId: user.schoolId, feePlanId: id, statutCible,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'changer_statut_plan_frais', targetType: 'FeePlan', targetId: resultat.planId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { statutCible, nouveauStatut: resultat.status },
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'changer_statut_plan_frais', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: { id: req.params.id, ...req.body },
      });
      handleFinanceControllerError(error, res, next);
    }
  };

  // PATCH /api/v2/finance/fee-plans/:id
  modifierPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res, true))) return;
      const { id } = req.params as { id: string };
      const resultat = await this.modifierPlanFrais.execute({
        schoolId: user.schoolId, demandeurRole: user.role, feePlanId: id, ...req.body,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'modifier_plan_frais', targetType: 'FeePlan', targetId: resultat.planId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'modifier_plan_frais', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined,
        parametersSummary: { id: req.params.id, ...req.body },
      });
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/invoices
  creerFacture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res))) return;
      const { studentId, feePlanId, description } = req.body;
      if (!studentId || !feePlanId) {
        res.status(400).json({ success: false, message: 'studentId et feePlanId requis' });
        return;
      }
      const resultat = await this.genererFacture.execute({
        schoolId: user.schoolId, studentId, feePlanId, description,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/invoices/bulk
  creerFacturesEnMasse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res))) return;
      const { feePlanId, classId, studentIds } = req.body;
      if (!feePlanId) {
        res.status(400).json({ success: false, message: 'feePlanId requis' });
        return;
      }
      const resultat = await this.genererFacturesEnMasse.execute({
        schoolId: user.schoolId, feePlanId, classId, studentIds,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'generer_factures_masse', targetType: 'FeePlan', targetId: feePlanId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { feePlanId, classId, studentIds },
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'generer_factures_masse', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/mobile
  initierPaiementMobile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res, true))) return;
      const { factureId, studentId, phoneNumber, method, amount, operatorFee, baseUpdatedAt, versionLocale, versionClient } = req.body as {
        factureId?: string; studentId?: string; phoneNumber?: string; method?: string; amount?: number; operatorFee?: number;
        baseUpdatedAt?: string | Date | null; versionLocale?: string | Date | null; versionClient?: string | Date | null;
      };
      if (!factureId || !phoneNumber || !method) {
        res.status(400).json({ success: false, message: 'factureId, phoneNumber et method requis' });
        return;
      }
      const digits = phoneNumber.replace(/[\s+]/g, '');
      const numeroNormalise = digits.startsWith('237') ? digits : `237${digits}`;
      const versionRaw = versionLocale ?? baseUpdatedAt ?? versionClient ?? null;
      const versionDate = versionRaw ? new Date(versionRaw as string) : undefined;
      const versionOption = versionDate && !Number.isNaN(versionDate.getTime()) ? versionDate : undefined;

      const resultat = await this.initierPaiement.execute({
        schoolId: user.schoolId,
        factureId,
        studentId: studentId ?? '',
        paidById: user.userId,
        phoneNumber: numeroNormalise,
        method: method as PaymentMethod,
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(operatorFee !== undefined ? { operatorFee: Number(operatorFee) } : {}),
        ...(versionOption ? { versionLocale: versionOption } : {}),
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/webhook/campay
  webhookCampay = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!verifyCampayWebhookSignature(req)) {
        res.status(401).json({ success: false, message: 'Signature webhook Campay invalide' });
        return;
      }

      const { reference, status, amount, operator, phone_number } = req.body;
      if (!reference) {
        res.status(400).json({ success: false, message: 'reference manquante' });
        return;
      }

      try {
        await this.traiterWebhook.execute({
          campayRef: reference,
          statut: status === 'SUCCESSFUL' ? 'SUCCESS' : 'FAILED',
          montant: amount ?? 0,
          telephone: phone_number ?? '',
          operateurRef: operator,
          donneesRaw: req.body,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('introuvable') && status === 'SUCCESSFUL') {
          await this.paiementRepository.enregistrerPaiementNonRapproche({
            campayRef: reference,
            montant: Number(amount ?? 0),
            telephone: phone_number ?? '',
            operateurRef: operator,
            raw: req.body as Record<string, unknown>,
          });
          res.status(200).json({ success: true, unmatched: true });
          return;
        }
        throw err;
      }

      res.status(200).json({ success: true });

      if (status === 'SUCCESSFUL') {
        void dispatchCampaySuccessNotifications({
          reference,
          phoneNumber: phone_number,
          paiementRepository: this.paiementRepository,
          userRepository: this.userRepository,
          receiptRenderer: this.receiptRenderer,
          carnetRepository: this.extras.carnetRepository,
          creerEntreeCarnet: this.extras.creerEntreeCarnet,
        });
      }
    } catch (error) {
      console.error('[Webhook Campay]', error);
      res.status(200).json({ success: false });
    }
  };

  // POST /api/v2/finance/payments/caution/:id/rembourser
  rembourserCautionEleve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res, true))) return;
      const { action } = req.body;
      if (!action) {
        res.status(400).json({ success: false, message: 'action requise : REMBOURSER ou RETENIR_DEFINITIVEMENT' });
        return;
      }
      await this.rembourserCaution.execute({
        paiementId: req.params.id as string, rembourseurId: user.userId, schoolId: user.schoolId, action,
      });
      res.json({ success: true, message: `Caution : ${action}` });
    } catch (error) {
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/expenses
  creerDepense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res, true))) return;
      const { label, amount, category, date, ordonnateurId } = req.body;
      if (!label || !amount) {
        res.status(400).json({ success: false, message: 'label et amount requis' });
        return;
      }
      const resultat = await this.enregistrerDepense.execute({
        schoolId: user.schoolId, label, amount, category,
        date: date ? new Date(date) : undefined, createdById: user.userId, ordonnateurId,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      handleFinanceControllerError(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/cash
  creerPaiementCash = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res, true))) return;
      const {
        factureId, studentId, montant, paidById, installmentId, provisionalReceiptNumber,
        clientRecordedAt, allowOverpayment, baseUpdatedAt, versionLocale, versionClient,
      } = req.body as {
        factureId?: string; studentId?: string; montant?: number; paidById?: string; installmentId?: string;
        provisionalReceiptNumber?: string; clientRecordedAt?: string; allowOverpayment?: boolean;
        baseUpdatedAt?: string | Date | null; versionLocale?: string | Date | null; versionClient?: string | Date | null;
      };

      if (!factureId || !studentId || montant == null) {
        res.status(400).json({ success: false, message: 'factureId, studentId et montant requis' });
        return;
      }

      const versionRaw = versionLocale ?? baseUpdatedAt ?? versionClient ?? null;
      const versionDate = versionRaw ? new Date(versionRaw as string) : undefined;
      const versionOption = versionDate && !Number.isNaN(versionDate.getTime()) ? versionDate : undefined;

      const resultat = await this.enregistrerPaiementCash.execute({
        schoolId: user.schoolId,
        factureId,
        studentId,
        montant: Number(montant),
        enregistreurId: user.userId,
        paidById,
        installmentId,
        provisionalReceiptNumber,
        clientRecordedAt,
        allowOverpayment: allowOverpayment === true,
        ...(versionOption ? { versionLocale: versionOption, baseUpdatedAt: versionOption } : {}),
      });

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'enregistrer_paiement_cash', targetType: 'Payment', targetId: resultat.paiementId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { factureId, studentId, montant, receiptNumber: resultat.receiptNumber },
      });
      res.status(201).json({ success: true, data: resultat });

      dispatchCashSuccessHooks({
        schoolId: user.schoolId, studentId, actorId: user.userId, actorRole: user.role,
        paymentId: resultat.paiementId, amount: Number(montant), receiptNumber: resultat.receiptNumber,
        paiementRepository: this.paiementRepository, receiptRenderer: this.receiptRenderer,
        carnetRepository: this.extras.carnetRepository, creerEntreeCarnet: this.extras.creerEntreeCarnet,
      });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'enregistrer_paiement_cash', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      handleFinanceControllerError(error, res, next);
    }
  };
}
