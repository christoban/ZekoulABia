import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';
import { SeparationOrdonnateurError } from '@domain/errors/SeparationOrdonnateurError';
import { ConflitVersionPaiementError } from '@domain/errors/ConflitVersionPaiementError';
import { TransitionStatutPlanFraisError } from '@domain/errors/TransitionStatutPlanFraisError';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { CarnetLiaisonRepository } from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import type { ReceiptPdfRendererPort } from '@domain/ports/services/ReceiptPdfRendererPort';
import type { AuthPayload } from '../../middlewares/auth';
import type { VerifierStatutPaiementUseCase } from '@application/finance/VerifierStatutPaiementUseCase';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import { sendTransactionalEmail } from '@infrastructure/services/email/EmailService';

export function verifyCampayWebhookSignature(req: Request): boolean {
  const secret = process.env.CAMPAY_WEBHOOK_SECRET;
  if (!secret || secret.trim() === '') return true;

  const sigHeader =
    (req.headers['x-campay-signature'] as string | undefined) ??
    (req.headers['x-webhook-signature'] as string | undefined) ??
    (typeof req.query?.signature === 'string' ? req.query.signature : undefined);

  if (!sigHeader) return false;
  const provided = sigHeader.trim();

  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body ?? {}))
    .digest('hex');

  const safeCompare = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  return safeCompare(provided, expectedHmac) || safeCompare(provided, secret);
}

export async function canReadStudentFinanceRecord(params: {
  user: AuthPayload | undefined;
  recordSchoolId: string;
  studentId: string;
  parentRepository?: ParentRepository;
}): Promise<boolean> {
  const { user, recordSchoolId, studentId, parentRepository } = params;
  if (!user || user.schoolId !== recordSchoolId) return false;
  const role = String(user.role).toUpperCase();

  if (role === 'ADMIN') return true;
  if (role === 'STAFF') {
    const perms = user.permissions ?? [];
    return perms.includes('MANAGE_FINANCE') || perms.includes('VALIDATE_PAYMENTS');
  }
  if (role === 'STUDENT') return studentId === user.userId;
  if (role === 'PARENT') {
    if (!parentRepository) return false;
    return parentRepository.aAccesEleve(user.userId, studentId);
  }
  return false;
}

export async function envoyerRecuPdfParEmail(
  paiementRepository: PaiementRepository,
  renderer: ReceiptPdfRendererPort,
  paymentId: string,
): Promise<void> {
  try {
    const payment = await paiementRepository.findRecuData(paymentId);
    if (!payment || !payment.student?.email) return;

    const pdfBuffer = await renderer.renderReceiptPdf({ payment, language: 'bilingual' });
    const shortId = payment.id.slice(-8).toUpperCase();
    const year = new Date(payment.paidAt ?? payment.createdAt).getFullYear();
    const receiptNum = payment.receiptNumber ?? `REC-${year}-${shortId}`;
    const amountStr = new Intl.NumberFormat('fr-FR').format(payment.amount);
    const schoolName = payment.school?.name ?? 'ZekoulABia';

    await sendTransactionalEmail({
      recipientEmail: payment.student.email,
      recipientUserId: payment.student.id,
      subject: `Reçu de paiement ${receiptNum} — ${schoolName}`,
      html: `<p>Bonjour ${payment.student.firstName},</p><p>Veuillez trouver ci-joint votre reçu de paiement de <b>${amountStr} XAF</b> (Réf. <b>${receiptNum}</b>).</p><p>Merci de votre confiance.</p><p><i>${schoolName}</i></p>`,
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

export async function creerEntreeCarnetPaiement(params: {
  schoolId: string;
  studentId: string;
  actorId: string;
  actorRole: string;
  paymentId: string;
  amount: number;
  receiptNumber?: string;
  carnetRepository?: CarnetLiaisonRepository;
  creerEntreeCarnet?: CreerEntreeCarnetUseCase;
}): Promise<void> {
  if (!params.carnetRepository || !params.creerEntreeCarnet) return;
  try {
    const isPrimary = await params.carnetRepository.estNiveauPrimaire(params.schoolId);
    if (!isPrimary) return;

    const ref = params.receiptNumber ?? params.paymentId.slice(-8).toUpperCase();
    const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(params.amount));
    await params.creerEntreeCarnet.execute({
      schoolId: params.schoolId,
      authorId: params.actorId,
      authorRole: params.actorRole,
      studentId: params.studentId,
      category: 'PAYMENT_RECEIPT',
      title: `Reçu de paiement ${ref}`,
      content: `Paiement scolarité enregistré pour un montant de ${formatted} XAF (Reçu n° ${ref}).`,
      requiresConfirmation: false,
      paymentId: params.paymentId,
    });
  } catch (err) {
    console.warn('[Carnet paiement auto]', err instanceof Error ? err.message : String(err));
  }
}

export async function notifierCreationPlanFraisHelper(params: {
  schoolId: string;
  createur: { userId: string; role: string };
  resume: string;
  userRepository: UserRepository;
  schoolRepository: SchoolRepository;
  notificationService: NotificationService;
}): Promise<void> {
  if (params.createur.role === 'ADMIN') return;
  try {
    const auteur = await params.userRepository.findById(params.createur.userId);
    const nomAuteur = auteur ? `${auteur.firstName} ${auteur.lastName}`.trim() : 'Un membre du personnel';
    const titre = 'Nouveau plan de frais créé';
    const corps = `${nomAuteur} a ${params.resume} le ${new Date().toLocaleDateString('fr-FR')}.`;
    await params.notificationService.envoyerAuRole({
      schoolId: params.schoolId, role: 'ADMIN', type: 'FEE_PLAN_CREATED', titre, corps, urgency: 'NORMAL',
    });
    const digest = await params.schoolRepository.isEmailDigestAdminEnabled(params.schoolId);
    if (digest) {
      const admins = await params.userRepository.findByRole(params.schoolId, 'ADMIN');
      for (const admin of admins) {
        if (!admin.email) continue;
        await sendTransactionalEmail({
          recipientEmail: admin.email,
          subject: titre,
          html: `<p>${corps}</p>`,
          text: corps,
          template: 'fee_plan_created',
          eventType: 'payment_reminder',
          metadata: { schoolId: params.schoolId },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Notification] Échec notification création plan de frais:', err);
  }
}

import { notifyPaymentSms } from '@infrastructure/services/sms/SmsNotificationService';

export async function dispatchCampaySuccessNotifications(params: {
  reference: string;
  phoneNumber?: string;
  paiementRepository: PaiementRepository;
  userRepository: UserRepository;
  receiptRenderer: ReceiptPdfRendererPort;
  carnetRepository?: CarnetLiaisonRepository;
  creerEntreeCarnet?: CreerEntreeCarnetUseCase;
}): Promise<void> {
  try {
    const paiement = await params.paiementRepository.findByCampayRef(params.reference);
    if (!paiement) return;
    const student = await params.userRepository.findById(paiement.studentId);
    await notifyPaymentSms({
      schoolId: paiement.schoolId,
      studentId: paiement.studentId,
      studentName: student ? `${student.firstName} ${student.lastName}`.trim() : '',
      amount: paiement.amount,
      parentPhone: params.phoneNumber ?? paiement.phoneNumber ?? undefined,
    });
    void envoyerRecuPdfParEmail(params.paiementRepository, params.receiptRenderer, paiement.id);
    void creerEntreeCarnetPaiement({
      schoolId: paiement.schoolId,
      studentId: paiement.studentId,
      actorId: paiement.recordedById ?? paiement.paidById ?? paiement.studentId,
      actorRole: 'STAFF',
      paymentId: paiement.id,
      amount: paiement.amount,
      receiptNumber: paiement.receiptNumber,
      carnetRepository: params.carnetRepository,
      creerEntreeCarnet: params.creerEntreeCarnet,
    });
  } catch (err) {
    console.error('[SMS Payment fire-and-forget]', err);
  }
}

export function dispatchCashSuccessHooks(params: {
  schoolId: string;
  studentId: string;
  actorId: string;
  actorRole: string;
  paymentId: string;
  amount: number;
  receiptNumber?: string;
  paiementRepository: PaiementRepository;
  receiptRenderer: ReceiptPdfRendererPort;
  carnetRepository?: CarnetLiaisonRepository;
  creerEntreeCarnet?: CreerEntreeCarnetUseCase;
}): void {
  void envoyerRecuPdfParEmail(params.paiementRepository, params.receiptRenderer, params.paymentId);
  void creerEntreeCarnetPaiement({
    schoolId: params.schoolId,
    studentId: params.studentId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    paymentId: params.paymentId,
    amount: params.amount,
    receiptNumber: params.receiptNumber,
    carnetRepository: params.carnetRepository,
    creerEntreeCarnet: params.creerEntreeCarnet,
  });
}

export function handleFinanceControllerError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof SeuilLegalDepasseError) {
    res.status(422).json({ success: false, code: 'SEUIL_LEGAL_DEPASSE', message: error.message });
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
    res.status(403).json({ success: false, code: 'SEPARATION_ORDONNATEUR', message: error.message });
    return;
  }
  if (error instanceof TransitionStatutPlanFraisError) {
    res.status(409).json({ success: false, code: 'TRANSITION_STATUT_INVALIDE', message: error.message });
    return;
  }
  if (error instanceof Error) {
    const m = error.message;
    if (m.includes('déjà en cours')) { res.status(409).json({ success: false, message: m }); return; }
    if (m.includes('clôturée')) { res.status(409).json({ success: false, message: m }); return; }
    if (m.includes('introuvable')) { res.status(404).json({ success: false, message: m }); return; }
    if (m.includes('ne peut plus être payée') || m.includes('dépasse le solde restant')) {
      res.status(422).json({ success: false, message: m }); return;
    }
    if (m.includes("n'est pas publié")) {
      res.status(422).json({ success: false, code: 'PLAN_NON_PUBLIE', message: m }); return;
    }
    if (m.includes("n'appartient pas à votre établissement") || m.includes('Permission')) {
      res.status(403).json({ success: false, message: m }); return;
    }
  }
  next(error);
}

export async function handleVerifyMobilePaymentHelper(params: {
  req: Request;
  res: Response;
  next: NextFunction;
  user: AuthPayload;
  audit: AIActionAuditPort;
  useCase?: VerifierStatutPaiementUseCase;
}): Promise<void> {
  const { req, res, next, user, audit, useCase } = params;
  if (!useCase) {
    res.status(503).json({ success: false, message: 'Service de vérification Mobile Money indisponible' });
    return;
  }
  const body = req.body as { invoiceId?: string; factureId?: string; paymentId?: string; campayRef?: string; campayReference?: string };
  const invoiceId = body.invoiceId ?? body.factureId;
  const campayRef = body.campayRef ?? body.campayReference;
  if (!invoiceId && !body.paymentId && !campayRef) {
    res.status(400).json({ success: false, message: 'invoiceId, paymentId ou campayRef requis' });
    return;
  }
  try {
    const resultat = await useCase.execute({
      schoolId: user.schoolId,
      invoiceId,
      paymentId: body.paymentId,
      campayRef,
    });
    audit.journaliser({
      actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
      actionName: 'verifier_statut_paiement_mobile', targetType: 'Payment', targetId: body.paymentId ?? invoiceId ?? campayRef,
      origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { invoiceId, paymentId: body.paymentId, campayRef, statut: resultat.statut },
    });
    res.json({ success: true, data: resultat });
  } catch (error) {
    handleFinanceControllerError(error, res, next);
  }
}
