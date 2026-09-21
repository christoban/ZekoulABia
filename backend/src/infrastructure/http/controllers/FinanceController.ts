import type { Request, Response, NextFunction } from 'express';
import type { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import type { ChangerStatutPlanFraisUseCase } from '@application/finance/ChangerStatutPlanFraisUseCase';
import type { GenererFactureUseCase } from '@application/finance/GenererFactureUseCase';
import type { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import type { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import type { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';
import type { RembourserCautionUseCase } from '@application/finance/RembourserCautionUseCase';
import type { EnregistrerDepenseUseCase } from '@application/finance/EnregistrerDepenseUseCase';
import type { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import type { CopierPlansFraisAnneePrecedenteUseCase } from '@application/finance/CopierPlansFraisAnneePrecedenteUseCase';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';
import { SeparationOrdonnateurError } from '@domain/errors/SeparationOrdonnateurError';
import { ConflitVersionPaiementError } from '@domain/errors/ConflitVersionPaiementError';
import { TransitionStatutPlanFraisError } from '@domain/errors/TransitionStatutPlanFraisError';
import type { FeePlanStatus, PaymentMethod } from '@domain/types/enums';
import { notifyPaymentSms } from '@infrastructure/services/sms/SmsNotificationService';
import PDFDocument from 'pdfkit';
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { NotificationService } from '@domain/ports/services/NotificationService';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  BANK_TRANSFER: 'Virement bancaire',
  EXPRESS_UNION: 'Express Union',
};

async function buildRecuPdf(payment: {
  id: string;
  amount: number;
  method: string;
  paidAt: Date | null;
  createdAt: Date;
  campayRef?: string | null;
  operatorRef?: string | null;
  school?: { name: string } | null;
  student?: {
    firstName: string;
    lastName: string;
    studentProfile?: {
      matricule?: string | null;
      enrollmentsYearScoped?: { class?: { name: string } | null }[];
    } | null;
  } | null;
  invoice?: {
    amount: number;
    description?: string | null;
    feePlan?: { name: string } | null;
    payments?: { amount: number }[];
  } | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' XAF';

    const schoolName = payment.school?.name ?? 'ZEKOULABIA';
    const studentName = `${payment.student?.firstName ?? ''} ${payment.student?.lastName ?? ''}`.trim();
    const matricule = payment.student?.studentProfile?.matricule ?? '-';
    const className = payment.student?.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name ?? '-';
    const invoiceLabel = payment.invoice?.feePlan?.name ?? payment.invoice?.description ?? 'Facture';
    const invoiceTotal = payment.invoice?.amount ?? payment.amount;
    const totalPaid = (payment.invoice?.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const soldeRestant = Math.max(0, invoiceTotal - totalPaid);
    const methodLabel = METHOD_LABELS[payment.method] ?? payment.method;

    const shortId = payment.id.slice(-8).toUpperCase();
    const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
    const receiptNum = `REC-${year}-${shortId}`;
    const dateStr = new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    doc.fontSize(9).font('Helvetica')
      .text('République du Cameroun  |  Republic of Cameroon', { align: 'center' })
      .text('Paix – Travail – Patrie  |  Peace – Work – Fatherland', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(14).font('Helvetica-Bold').text(schoolName.toUpperCase(), { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(16).text('REÇU DE PAIEMENT', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text(`N° ${receiptNum}`, { align: 'right' });
    doc.font('Helvetica').text(`Date : ${dateStr}`, { align: 'right' });
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.7);

    doc.fontSize(10).font('Helvetica-Bold').text('ÉLÈVE / STUDENT');
    doc.font('Helvetica')
      .text(`Nom et prénom : ${studentName}`)
      .text(`Matricule : ${matricule}`)
      .text(`Classe : ${className}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('OBJET / PURPOSE');
    doc.font('Helvetica')
      .text(`Facture : ${invoiceLabel}`)
      .text(`Mode de paiement : ${methodLabel}`);
    if (payment.campayRef) doc.text(`Réf. Campay : ${payment.campayRef}`);
    if (payment.operatorRef) doc.text(`Réf. Opérateur : ${payment.operatorRef}`);
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.7);

    doc.font('Helvetica-Bold').text('MONTANTS / AMOUNTS');
    doc.font('Helvetica').text(`Total facture :              ${fmt(invoiceTotal)}`);
    doc.font('Helvetica-Bold').text(`Montant payé ce jour :       ${fmt(payment.amount)}`);

    if (soldeRestant === 0) {
      doc.fillColor('green').text(`Solde restant :              ${fmt(0)}`);
      doc.moveDown(0.5);
      doc.fontSize(12).text('✓ PAYÉ INTÉGRALEMENT — FULLY PAID', { align: 'center' });
    } else {
      doc.fillColor('red').text(`Solde restant :              ${fmt(soldeRestant)}`);
    }
    doc.fillColor('black').font('Helvetica').fontSize(10);

    doc.moveDown(4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9)
      .text('Ce document tient lieu de reçu officiel de paiement.', { align: 'center' })
      .text('This document serves as an official payment receipt.', { align: 'center' });
    doc.moveDown(3);
    doc.fontSize(10).text('Le Responsable financier / Finance Officer', { align: 'right' });
    doc.moveDown(3);
    doc.text('___________________________', { align: 'right' });

    doc.end();
  });
}

async function envoyerRecuParEmail(paiementRepository: PaiementRepository, paymentId: string): Promise<void> {
  try {
    const payment = await paiementRepository.findRecuData(paymentId) as any;
    if (!payment || !payment.student?.email) return;

    const pdfBuffer = await buildRecuPdf(payment);
    const shortId = payment.id.slice(-8).toUpperCase();
    const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
    const receiptNum = `REC-${year}-${shortId}`;
    const amountStr = new Intl.NumberFormat('fr-FR').format(payment.amount);
    const schoolName = payment.school?.name ?? 'ZekoulABia';

    await sendTransactionalEmail({
      recipientEmail: payment.student.email,
      recipientUserId: payment.student.id,
      subject: `Reçu de paiement ${receiptNum} — ${schoolName}`,
      html: `<p>Bonjour ${payment.student.firstName},</p><p>Veuillez trouver ci-joint votre reçu de paiement de <b>${amountStr} XAF</b>.</p><p>Merci de votre confiance.</p><p><i>${schoolName}</i></p>`,
      text: `Reçu de paiement ${receiptNum} — ${amountStr} XAF`,
      template: 'payment_receipt',
      eventType: 'payment_receipt',
      attachments: [{ filename: `${receiptNum}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
      metadata: { schoolId: payment.schoolId },
    });
  } catch (err) {
    console.error('[Reçu PDF email]', err);
  }
}

export class FinanceController {
  constructor(
    private readonly creerPlanFrais: CreerPlanFraisUseCase,
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
  ) {}

  // STAFF doit avoir MANAGE_FINANCE.
  // ADMIN passe uniquement si adminGereFinances est activé sur l'établissement (délégation comptable/intendant par défaut).
  private async checkFinancePermission(user: any, res: Response): Promise<boolean> {
    const perms: string[] = user.permissions ?? [];
    if (perms.includes('MANAGE_FINANCE')) return true;

    if (user.role === 'ADMIN') {
      const school = await this.schoolRepository.findById(user.schoolId);
      if (school?.adminGereFinances) return true;
      res.status(403).json({
        success: false,
        message: 'La gestion financière est déléguée au comptable/intendant',
      });
      return false;
    }

    res.status(403).json({ success: false, message: 'Permission MANAGE_FINANCE requise' });
    return false;
  }

  // Notifie les Admin de l'établissement quand un plan de frais est créé par un non-Admin
  // (typiquement l'Intendant) — silencieux sinon, jamais bloquant pour la réponse HTTP.
  private async notifierCreationPlanFrais(
    schoolId: string,
    createur: { userId: string; role: string },
    resume: string,
  ): Promise<void> {
    if (createur.role === 'ADMIN') return;
    try {
      const auteur = await this.userRepository.findById(createur.userId);
      const nomAuteur = auteur ? `${auteur.firstName} ${auteur.lastName}`.trim() : 'Un membre du personnel';
      const titre = 'Nouveau plan de frais créé';
      const corps = `${nomAuteur} a ${resume} le ${new Date().toLocaleDateString('fr-FR')}.`;

      await this.notificationService.envoyerAuRole({
        schoolId,
        role: 'ADMIN',
        type: 'FEE_PLAN_CREATED',
        titre,
        corps,
        urgency: 'NORMAL',
      });

      const digest = await this.schoolRepository.isEmailDigestAdminEnabled(schoolId);
      if (digest) {
        const admins = await this.userRepository.findByRole(schoolId, 'ADMIN');
        for (const admin of admins) {
          if (!admin.email) continue;
          await sendTransactionalEmail({
            recipientEmail: admin.email,
            subject: titre,
            html: `<p>${corps}</p>`,
            text: corps,
            template: 'fee_plan_created',
            eventType: 'payment_reminder',
            metadata: { schoolId },
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Notification] Échec notification création plan de frais:', err);
    }
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
      if (payment.schoolId !== user.schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const pdfBuffer = await buildRecuPdf(payment);
      const shortId = payment.id.slice(-8).toUpperCase();
      const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
      const receiptNum = `REC-${year}-${shortId}`;

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
        schoolId: user.schoolId,
        demandeurRole: user.role,
        ...req.body,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        // Bug indépendant : CreerPlanFraisResultat expose `planId`, jamais `id` — le cast `as
        // any` masquait un ciblage d'audit toujours undefined pour cette action.
        actionName: 'creer_plan_frais', targetType: 'FeePlan', targetId: resultat.planId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: req.body,
      });
      res.status(201).json({ success: true, data: resultat });
      void this.notifierCreationPlanFrais(
        user.schoolId,
        { userId: user.userId, role: user.role },
        `créé le plan de frais « ${resultat.name} » (${resultat.amount} FCFA)`,
      );
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'creer_plan_frais', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/fee-plans/copy-from-previous-year
  copierPlansAnneePrecedente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res))) return;
      const { targetAcademicYearId, plans } = req.body as { targetAcademicYearId?: string; plans?: any[] };

      if (!targetAcademicYearId) {
        res.status(400).json({ success: false, message: 'targetAcademicYearId requis' });
        return;
      }
      if (!Array.isArray(plans) || plans.length === 0) {
        res.status(400).json({ success: false, message: 'Aucun plan à reconduire — la liste "plans" est vide' });
        return;
      }

      const resultat = await this.copierPlansFraisAnneePrecedente.execute({
        schoolId: user.schoolId,
        targetAcademicYearId,
        plans: plans.map((p) => ({
          name: p.name,
          amount: p.amount,
          feeType: p.feeType,
          level: p.level,
          sectionId: p.sectionId,
          isRefundable: p.isRefundable,
          dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
          description: p.description,
        })),
      });
      res.status(201).json({ success: true, data: resultat });
      void this.notifierCreationPlanFrais(
        user.schoolId,
        { userId: user.userId, role: user.role },
        `reconduit ${resultat.crees} plan(s) de frais pour la nouvelle année scolaire`,
      );
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // PATCH /api/v2/finance/fee-plans/:id/status — workflow de publication V1.11
  changerStatutPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!(await this.checkFinancePermission(user, res))) return;
      const { id } = req.params as { id: string };
      const { statutCible } = req.body as { statutCible?: FeePlanStatus };

      if (!statutCible) {
        res.status(400).json({ success: false, message: 'statutCible requis' });
        return;
      }

      const resultat = await this.changerStatutPlanFrais.execute({
        schoolId: user.schoolId,
        feePlanId: id,
        statutCible,
      });
      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'changer_statut_plan_frais', targetType: 'FeePlan', targetId: resultat.planId,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { statutCible, nouveauStatut: resultat.status },
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
      this.gererErreur(error, res, next);
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
        schoolId: user.schoolId,
        studentId,
        feePlanId,
        description,
      });
      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
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
        schoolId: user.schoolId,
        feePlanId,
        classId,
        studentIds,
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
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/mobile
  initierPaiementMobile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { factureId, studentId, phoneNumber, method, baseUpdatedAt, versionLocale, versionClient } = req.body as {
        factureId?: string; studentId?: string; phoneNumber?: string; method?: string;
        baseUpdatedAt?: string | Date | null; versionLocale?: string | Date | null; versionClient?: string | Date | null;
      };

      if (!factureId || !phoneNumber || !method) {
        res.status(400).json({
          success: false,
          message: 'factureId, phoneNumber et method requis',
        });
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
        studentId,
        phoneNumber: numeroNormalise,
        method: method as PaymentMethod,
        ...(versionOption ? { versionLocale: versionOption } : {}),
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/webhook/campay
  // Pas de middleware auth — appelée directement par Campay
  webhookCampay = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { reference, status, amount, operator, phone_number } = req.body;

      if (!reference) {
        res.status(400).json({ success: false, message: 'reference manquante' });
        return;
      }

      await this.traiterWebhook.execute({
        campayRef: reference,
        statut: status === 'SUCCESSFUL' ? 'SUCCESS' : 'FAILED',
        montant: amount ?? 0,
        telephone: phone_number ?? '',
        operateurRef: operator,
        donneesRaw: req.body,
      });

      // Campay attend un 200 pour ne pas retenter l'envoi
      res.status(200).json({ success: true });

      // Fire-and-forget SMS + reçu PDF — jamais bloquant
      if (status === 'SUCCESSFUL') {
        void (async () => {
          try {
            const paiement = await this.paiementRepository.findByCampayRef(reference);
            if (!paiement) return;
            const student = await this.userRepository.findById(paiement.studentId);
            await notifyPaymentSms({
              schoolId: paiement.schoolId,
              studentId: paiement.studentId,
              studentName: student ? `${student.firstName} ${student.lastName}`.trim() : '',
              amount: paiement.amount,
              parentPhone: phone_number ?? (paiement as any).phoneNumber ?? undefined,
            })
            void envoyerRecuParEmail(this.paiementRepository, paiement.id)
          } catch (err) {
            console.error('[SMS Payment fire-and-forget]', err)
          }
        })()
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
      const { action } = req.body;

      if (!action) {
        res.status(400).json({
          success: false,
          message: 'action requise : REMBOURSER ou RETENIR_DEFINITIVEMENT',
        });
        return;
      }

      await this.rembourserCaution.execute({
        paiementId: req.params.id as string,
        rembourseurId: user.userId,
        schoolId: user.schoolId,
        action,
      });

      res.json({ success: true, message: `Caution : ${action}` });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/expenses
  creerDepense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { label, amount, category, date, ordonnateurId } = req.body;

      if (!label || !amount) {
        res.status(400).json({ success: false, message: 'label et amount requis' });
        return;
      }

      const resultat = await this.enregistrerDepense.execute({
        schoolId: user.schoolId,
        label,
        amount,
        category,
        date: date ? new Date(date) : undefined,
        createdById: user.userId,
        ordonnateurId,
      });

      res.status(201).json({ success: true, data: resultat });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // POST /api/v2/finance/payments/cash
  creerPaiementCash = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { factureId, studentId, montant, baseUpdatedAt, versionLocale, versionClient } = req.body as {
        factureId?: string; studentId?: string; montant?: number; baseUpdatedAt?: string | Date | null;
        versionLocale?: string | Date | null; versionClient?: string | Date | null;
      };

      if (!factureId || !studentId || montant == null) {
        res.status(400).json({
          success: false,
          message: 'factureId, studentId et montant requis',
        });
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
        ...(versionOption ? { versionLocale: versionOption, baseUpdatedAt: versionOption } : {}),
      });

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'enregistrer_paiement_cash', targetType: 'Payment', targetId: resultat.paiementId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { factureId, studentId, montant },
      });
      res.status(201).json({ success: true, data: resultat });

      // Fire-and-forget : envoyer reçu PDF par email
      void envoyerRecuParEmail(this.paiementRepository, resultat.paiementId);
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'enregistrer_paiement_cash', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof SeuilLegalDepasseError) {
      res.status(422).json({
        success: false,
        code: 'SEUIL_LEGAL_DEPASSE',
        message: error.message,
      });
      return;
    }
    if (error instanceof ConflitVersionPaiementError) {
      res.status(409).json({
        success: false,
        code: 'CONFLIT_VERSION',
        message: error.message,
        data: {
          factureId: error.factureId,
          versionServeur: error.versionServeur,
          versionLocale: error.versionLocale,
          montantSaisi: error.montantSaisi,
          totalPaye: error.totalPaye,
          resteARegler: error.resteARegler,
        },
      });
      return;
    }
    if (error instanceof SeparationOrdonnateurError) {
      res.status(403).json({
        success: false,
        code: 'SEPARATION_ORDONNATEUR',
        message: error.message,
      });
      return;
    }
    if (error instanceof TransitionStatutPlanFraisError) {
      res.status(409).json({
        success: false,
        code: 'TRANSITION_STATUT_INVALIDE',
        message: error.message,
      });
      return;
    }
    if (error instanceof Error) {
      if (error.message.includes('déjà en cours')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('introuvable')) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('ne peut plus être payée')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('dépasse le solde restant')) {
        res.status(422).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes("n'est pas publié")) {
        res.status(422).json({ success: false, code: 'PLAN_NON_PUBLIE', message: error.message });
        return;
      }
      if (error.message.includes("n'appartient pas à votre établissement")) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes('Permission')) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
