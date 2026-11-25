import crypto from 'node:crypto';
import { describe, it, expect, beforeEach } from 'bun:test';
import type { NextFunction, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { ConfigurerEcheancierFactureUseCase } from '@application/finance/ConfigurerEcheancierFactureUseCase';
import { AppliquerRemiseEleveUseCase } from '@application/finance/AppliquerRemiseEleveUseCase';
import { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import { AnnulerPaiementUseCase } from '@application/finance/AnnulerPaiementUseCase';
import { CloturerCaisseUseCase } from '@application/finance/CloturerCaisseUseCase';
import { FinanceOperationsController } from '@infrastructure/http/controllers/FinanceOperationsController';
import { FinanceController } from '@infrastructure/http/controllers/FinanceController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { canReadStudentFinanceRecord, verifyCampayWebhookSignature } from '@infrastructure/http/controllers/helpers/financeControllerHelpers';
import { ReceiptPdfRenderer } from '@infrastructure/pdf/finance/ReceiptPdfRenderer';
import { Facture } from '@domain/entities/Facture';
import { prisma } from '../../src/config/prisma.ts';
import type { AuthPayload } from '@infrastructure/http/middlewares/auth';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { PaiementRecuData } from '@domain/ports/repositories/PaiementRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinExportData } from '@domain/ports/repositories/BulletinRepository';
import { InMemoryFactureRepository } from '../helpers/repositories/InMemoryFactureRepository.ts';
import { InMemoryPaiementRepository } from '../helpers/repositories/InMemoryPaiementRepository.ts';
import { InMemoryParentRepository } from '../helpers/repositories/InMemoryParentRepository.ts';
import { InMemoryUserRepository } from '../helpers/repositories/InMemoryUserRepository.ts';
import { InMemorySchoolRepository } from '../helpers/repositories/InMemorySchoolRepository.ts';
import { InMemoryBulletinRepository } from '../helpers/repositories/InMemoryBulletinRepository.ts';
import { InMemoryNotificationService } from '../helpers/services/InMemoryNotificationService.ts';
import { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';

interface MockResState {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | number>;
  endedBuffer: Buffer | null;
  status: (code: number) => MockResState;
  json: (data: unknown) => MockResState;
  setHeader: (k: string, v: string | number) => void;
  end: (chunk?: Buffer | string) => void;
}

function makeRes(): MockResState {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    endedBuffer: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
    setHeader(k: string, v: string | number) {
      this.headers[k] = v;
    },
    end(chunk?: Buffer | string) {
      if (Buffer.isBuffer(chunk)) this.endedBuffer = chunk;
    },
  };
}

function makeReq(
  user: AuthPayload | undefined,
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): Request {
  return { user, body, params, headers, query: {} } as unknown as Request;
}

const noopNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};

const AUDIT_STUB: AIActionAuditPort = { journaliser: () => {} };
const SCHOOL_ID = 'school-1';

describe('Finance, Reçus PDF bilingues, RBAC & Blocage Bulletin', () => {
  let factureRepo: InMemoryFactureRepository;
  let paiementRepo: InMemoryPaiementRepository;
  let parentRepo: InMemoryParentRepository;
  let userRepo: InMemoryUserRepository;
  let schoolRepo: InMemorySchoolRepository;
  let notifService: InMemoryNotificationService;
  let opsController: FinanceOperationsController;
  let facture: Facture;

  beforeEach(async () => {
    factureRepo = new InMemoryFactureRepository();
    paiementRepo = new InMemoryPaiementRepository(factureRepo);
    parentRepo = new InMemoryParentRepository();
    userRepo = new InMemoryUserRepository();
    schoolRepo = new InMemorySchoolRepository();
    notifService = new InMemoryNotificationService();

    facture = Facture.reconstituer({
      id: 'inv-100',
      schoolId: SCHOOL_ID,
      studentId: 'student-1',
      amount: 90_000,
      grossAmount: 90_000,
      discountTotal: 0,
      currency: 'XAF',
      status: 'PENDING',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
    });
    await factureRepo.save(facture);
    parentRepo.definirRelation('parent-ok', ['student-1'], SCHOOL_ID);

    opsController = new FinanceOperationsController(
      factureRepo,
      paiementRepo,
      new ConfigurerEcheancierFactureUseCase(factureRepo),
      new AppliquerRemiseEleveUseCase(factureRepo),
      new AnnulerPaiementUseCase(paiementRepo),
      new CloturerCaisseUseCase(paiementRepo),
      userRepo,
      parentRepo,
      AUDIT_STUB,
      notifService,
    );
  });

  it('valide les échéanciers (3 tranches) et applique des remises avec justification obligatoire', async () => {
    const configUc = new ConfigurerEcheancierFactureUseCase(factureRepo);
    await expect(
      configUc.execute({ schoolId: SCHOOL_ID, invoiceId: 'inv-100', tranches: [] }),
    ).rejects.toThrow();
    await expect(
      configUc.execute({
        schoolId: SCHOOL_ID,
        invoiceId: 'inv-100',
        tranches: [{ label: 'Unique', amount: 50_000, dueDate: '2026-10-01' }],
      }),
    ).rejects.toThrow();

    const okPlan = await configUc.execute({
      schoolId: SCHOOL_ID,
      invoiceId: 'inv-100',
      tranches: [
        { label: 'Tranche 1', amount: 40_000, dueDate: '2026-09-15' },
        { label: 'Tranche 2', amount: 30_000, dueDate: '2026-12-15' },
        { label: 'Tranche 3', amount: 20_000, dueDate: '2027-03-15' },
      ],
    });
    expect(okPlan.installments).toHaveLength(3);
    expect(okPlan.installments.map((t) => t.trancheNumber)).toEqual([1, 2, 3]);

    const remiseUc = new AppliquerRemiseEleveUseCase(factureRepo);
    await expect(
      remiseUc.execute({
        schoolId: SCHOOL_ID,
        invoiceId: 'inv-100',
        reasonType: 'SCHOLARSHIP',
        amount: 10_000,
        justification: 'OK',
        grantedById: 'intendant-1',
      }),
    ).rejects.toThrow();

    await expect(
      remiseUc.execute({
        schoolId: SCHOOL_ID,
        invoiceId: 'inv-100',
        reasonType: 'SIBLING',
        percentage: 120,
        justification: 'Fratrie 3 enfants',
        grantedById: 'intendant-1',
      }),
    ).rejects.toThrow();

    const remRes = await remiseUc.execute({
      schoolId: SCHOOL_ID,
      invoiceId: 'inv-100',
      reasonType: 'SIBLING',
      percentage: 10,
      justification: 'Réduction fratrie 10%',
      grantedById: 'intendant-1',
    });
    expect(remRes.discount.amount).toBe(9_000);
    expect(remRes.netAmount).toBe(81_000);
  });

  it('gère cash + PROV-..., trop-perçu en avoir, annulation et blocage après clôture caisse (409)', async () => {
    const cashUc = new EnregistrerPaiementCashUseCase(factureRepo, paiementRepo);
    const overpaid = await cashUc.execute({
      schoolId: SCHOOL_ID,
      factureId: 'inv-100',
      studentId: 'student-1',
      montant: 100_000,
      enregistreurId: 'intendant-1',
      provisionalReceiptNumber: 'PROV-OFF123',
      clientRecordedAt: new Date('2026-10-05T09:00:00Z'),
      allowOverpayment: true,
    });
    expect(overpaid.nouveauStatutFacture).toBe('PAID');
    expect(await factureRepo.calculerAvoirDisponible(SCHOOL_ID, 'student-1')).toBe(10_000);

    const annulUc = new AnnulerPaiementUseCase(paiementRepo);
    await expect(
      annulUc.execute({ schoolId: SCHOOL_ID, paymentId: overpaid.paiementId, cancelledById: 'intendant-1', reason: 'ab' }),
    ).rejects.toThrow();

    // Clôture du jour du paiement => bloque annulation et doublon de clôture (409)
    const staffFin: AuthPayload = {
      userId: 'intendant-1',
      schoolId: SCHOOL_ID,
      role: 'STAFF',
      permissions: ['MANAGE_FINANCE'],
      tokenType: 'access',
    };
    const paidObj = await paiementRepo.findById(overpaid.paiementId);
    const dayStr = (paidObj?.paidAt ?? new Date()).toISOString().slice(0, 10);

    const closeRes = makeRes();
    await opsController.cloturerCaisseHandler(
      makeReq(staffFin, { closureDate: dayStr, declaredCash: 100_000, notes: 'RAS' }),
      closeRes as unknown as Response,
      noopNext,
    );
    expect(closeRes.statusCode).toBe(201);

    const dupCloseRes = makeRes();
    await opsController.cloturerCaisseHandler(
      makeReq(staffFin, { closureDate: dayStr }),
      dupCloseRes as unknown as Response,
      noopNext,
    );
    expect(dupCloseRes.statusCode).toBe(409);

    const lockedCancelRes = makeRes();
    await opsController.annulerPaiementHandler(
      makeReq(staffFin, { reason: 'Erreur de saisie' }, { paymentId: overpaid.paiementId }),
      lockedCancelRes as unknown as Response,
      noopNext,
    );
    expect(lockedCancelRes.statusCode).toBe(409);
  });

  it('vérifie la signature HMAC Campay (401), met en file non rapprochée puis rapproche', async () => {
    const prevSecret = process.env.CAMPAY_WEBHOOK_SECRET;
    process.env.CAMPAY_WEBHOOK_SECRET = 'super-secret-campay';
    try {
      const webhookUc = new TraiterWebhookCampayUseCase(paiementRepo, factureRepo);
      const finCtrl = new FinanceController(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        webhookUc,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        paiementRepo,
        schoolRepo,
        userRepo,
        AUDIT_STUB,
        notifService,
      );

      const badReq = makeReq(undefined, { reference: 'CAMP-404', status: 'SUCCESSFUL', amount: 25_000 }, {}, { 'x-campay-signature': 'wrong-sig' });
      expect(verifyCampayWebhookSignature(badReq)).toBe(false);
      const badRes = makeRes();
      await finCtrl.webhookCampay(badReq, badRes as unknown as Response, noopNext);
      expect(badRes.statusCode).toBe(401);

      const validBody = { reference: 'CAMP-UNMATCHED-1', status: 'SUCCESSFUL', amount: 25_000, operator: 'MTN', phone_number: '237670000001' };
      const validSig = crypto.createHmac('sha256', 'super-secret-campay').update(JSON.stringify(validBody)).digest('hex');
      const okReq = makeReq(undefined, validBody, {}, { 'x-campay-signature': validSig });
      const okRes = makeRes();
      await finCtrl.webhookCampay(okReq, okRes as unknown as Response, noopNext);
      expect(okRes.statusCode).toBe(200);
      expect(okRes.body).toEqual({ success: true, unmatched: true });

      const staffFin: AuthPayload = {
        userId: 'intendant-1',
        schoolId: SCHOOL_ID,
        role: 'STAFF',
        permissions: ['MANAGE_FINANCE'],
        tokenType: 'access',
      };
      const listRes = makeRes();
      await opsController.listerPaiementsNonRapprochesHandler(makeReq(staffFin), listRes as unknown as Response, noopNext);
      const unmatched = (listRes.body as { data: { id: string }[] }).data;
      expect(unmatched).toHaveLength(1);

      const recRes = makeRes();
      await opsController.rapprocherPaiementHandler(
        makeReq(staffFin, { invoiceId: 'inv-100' }, { paymentId: unmatched[0].id }),
        recRes as unknown as Response,
        noopNext,
      );
      expect(recRes.statusCode).toBe(200);
    } finally {
      if (prevSecret === undefined) delete process.env.CAMPAY_WEBHOOK_SECRET;
      else process.env.CAMPAY_WEBHOOK_SECRET = prevSecret;
    }
  });

  it('applique le RBAC strict Finance (TEACHER/STAFF sans permission/PARENT tiers => 403)', async () => {
    const teacher: AuthPayload = { userId: 't-1', schoolId: SCHOOL_ID, role: 'TEACHER', permissions: [], tokenType: 'access' };
    const plainStaff: AuthPayload = { userId: 's-1', schoolId: SCHOOL_ID, role: 'STAFF', permissions: ['MANAGE_ATTENDANCE'], tokenType: 'access' };
    const foreignParent: AuthPayload = { userId: 'p-bad', schoolId: SCHOOL_ID, role: 'PARENT', permissions: [], tokenType: 'access' };
    const legitimateParent: AuthPayload = { userId: 'parent-ok', schoolId: SCHOOL_ID, role: 'PARENT', permissions: [], tokenType: 'access' };

    expect(await canReadStudentFinanceRecord({ user: teacher, recordSchoolId: SCHOOL_ID, studentId: 'student-1', parentRepository: parentRepo })).toBe(false);
    expect(await canReadStudentFinanceRecord({ user: plainStaff, recordSchoolId: SCHOOL_ID, studentId: 'student-1', parentRepository: parentRepo })).toBe(false);
    expect(await canReadStudentFinanceRecord({ user: foreignParent, recordSchoolId: SCHOOL_ID, studentId: 'student-1', parentRepository: parentRepo })).toBe(false);
    expect(await canReadStudentFinanceRecord({ user: legitimateParent, recordSchoolId: SCHOOL_ID, studentId: 'student-1', parentRepository: parentRepo })).toBe(true);

    const res403 = makeRes();
    await opsController.obtenirDetailsFacture(
      makeReq(foreignParent, {}, { invoiceId: 'inv-100' }),
      res403 as unknown as Response,
      noopNext,
    );
    expect(res403.statusCode).toBe(403);

    const res200 = makeRes();
    await opsController.obtenirDetailsFacture(
      makeReq(legitimateParent, {}, { invoiceId: 'inv-100' }),
      res200 as unknown as Response,
      noopNext,
    );
    expect(res200.statusCode).toBe(200);
  });

  it('génère le PDF officiel avec REC-..., PROV-..., DUPLICATA et ANNULÉ capturés via PDFDocument.prototype.text', async () => {
    const renderer = new ReceiptPdfRenderer();
    const drawnTexts: string[] = [];
    const origText = PDFDocument.prototype.text;

    const baseData: PaiementRecuData = {
      id: 'pay-pdf-1',
      schoolId: SCHOOL_ID,
      studentId: 'student-1',
      amount: 45_000,
      method: 'CASH',
      status: 'SUCCESS',
      paidAt: new Date('2026-10-05T10:00:00Z'),
      createdAt: new Date('2026-10-05T10:00:00Z'),
      receiptNumber: 'REC-2026-00007',
      provisionalReceiptNumber: 'PROV-OFFLINE01',
      student: { id: 'student-1', email: null, firstName: 'Jean', lastName: 'Atangana' },
      invoice: { amount: 90_000, grossAmount: 90_000, discountTotal: 0, feePlan: { name: 'Scolarité' }, payments: [{ amount: 45_000, status: 'SUCCESS' }] },
      school: { name: 'Collège Bilingue Test', city: 'Yaoundé', phone: '+237600000000' },
    };

    try {
      PDFDocument.prototype.text = function patchedText(
        this: InstanceType<typeof PDFDocument>,
        text?: string,
        x?: unknown,
        y?: unknown,
        options?: unknown,
      ) {
        if (typeof text === 'string') drawnTexts.push(text);
        return origText.call(this, text as string, x as number, y as number, options as Record<string, unknown>);
      } as typeof PDFDocument.prototype.text;

      await renderer.renderReceiptPdf({ payment: baseData, isDuplicate: true, language: 'bilingual' });
      const duplicateDump = drawnTexts.join('\n');
      expect(duplicateDump).toContain('N° REC-2026-00007');
      expect(duplicateDump).toContain('PROV-OFFLINE01');
      expect(duplicateDump).toContain('DUPLICATA / DUPLICATE COPY');

      drawnTexts.length = 0;
      await renderer.renderReceiptPdf({
        payment: { ...baseData, status: 'REFUNDED', cancellationReason: 'Double encaissement' },
        isDuplicate: true,
        language: 'bilingual',
      });
      const cancelledDump = drawnTexts.join('\n');
      expect(cancelledDump).toContain('ANNULÉ / CANCELLED');
      expect(cancelledDump).toContain('Double encaissement');
    } finally {
      PDFDocument.prototype.text = origText;
    }
  });

  it('bloque le téléchargement du bulletin (403 BULLETIN_BLOCKED_UNPAID_FEES) pour parent/élève mais autorise ADMIN', async () => {
    const exportSample: BulletinExportData = {
      id: 'bul-1',
      schoolId: SCHOOL_ID,
      studentId: 'student-1',
      academicYearId: 'year-1',
      academicPeriodId: 'period-1',
      template: 'FRANCOPHONE',
      generalAverage: 14.5,
      rank: 2,
      totalStudents: 30,
      absenceCount: 0,
      mention: 'Bien',
      classMasterComment: null,
      academicYear: { id: 'year-1', name: '2026-2027' },
      academicPeriod: { id: 'period-1', name: 'Trimestre 1' },
      student: {
        id: 'student-1',
        firstName: 'Jean',
        lastName: 'Atangana',
        studentProfile: { enrollmentsYearScoped: [{ class: { name: '3e A', section: { code: 'FR' } } }] },
      },
      subjectLines: [],
      school: { id: SCHOOL_ID, name: 'Lycée Test', subsystem: 'FRANCOPHONE', schoolConfig: null, schoolSettings: null },
      section: { code: 'FR' },
    };
    const bulletinRepoForPdf = {
      findForPdf: async (id: string, sId: string) => (id === 'bul-1' && sId === SCHOOL_ID ? exportSample : null),
    } as unknown as InMemoryBulletinRepository;

    const schoolCfgRepo: SchoolConfigRepository = {
      findBySchool: async () => ({ aiAlertsEnabled: true, subjectDropThreshold: 2, bulletinBlockOnUnpaidFees: true }),
      findBySchoolId: async () => ({ aiAlertsEnabled: true, subjectDropThreshold: 2, bulletinBlockOnUnpaidFees: true }),
    };

    const reportCtrl = new ReportCardController(
      {} as never,
      {} as never,
      {} as never,
      schoolRepo,
      {} as never,
      {} as never,
      {} as never,
      bulletinRepoForPdf,
      parentRepo,
      AUDIT_STUB,
      undefined,
      undefined,
      factureRepo,
      schoolCfgRepo,
    );

    const parentRes = makeRes();
    await reportCtrl.telechargerPdf(
      makeReq({ userId: 'parent-ok', schoolId: SCHOOL_ID, role: 'PARENT', permissions: [], tokenType: 'access' }, {}, { id: 'bul-1' }),
      parentRes as unknown as Response,
      noopNext,
    );
    expect(parentRes.statusCode).toBe(403);
    expect((parentRes.body as { code: string }).code).toBe('BULLETIN_BLOCKED_UNPAID_FEES');

    const studentRes = makeRes();
    await reportCtrl.telechargerPdf(
      makeReq({ userId: 'student-1', schoolId: SCHOOL_ID, role: 'STUDENT', permissions: [], tokenType: 'access' }, {}, { id: 'bul-1' }),
      studentRes as unknown as Response,
      noopNext,
    );
    expect(studentRes.statusCode).toBe(403);
    expect((studentRes.body as { code: string }).code).toBe('BULLETIN_BLOCKED_UNPAID_FEES');

    const origSettingsFindFirst = prisma.schoolSettings.findFirst;
    const origCfgFindFirst = prisma.schoolConfig.findFirst;
    const origSchoolFindUnique = prisma.school.findUnique;
    const settingsDelegate = prisma.schoolSettings as unknown as { findFirst: () => Promise<null> };
    const cfgDelegate = prisma.schoolConfig as unknown as { findFirst: () => Promise<null> };
    const schoolDelegate = prisma.school as unknown as { findUnique: () => Promise<{ id: string; name: string; logoUrl: null }> };

    settingsDelegate.findFirst = async () => null;
    cfgDelegate.findFirst = async () => null;
    schoolDelegate.findUnique = async () => ({ id: SCHOOL_ID, name: 'Lycée Test', logoUrl: null });

    try {
      const adminRes = makeRes();
      await reportCtrl.telechargerPdf(
        makeReq({ userId: 'admin-1', schoolId: SCHOOL_ID, role: 'ADMIN', permissions: [], tokenType: 'access' }, {}, { id: 'bul-1' }),
        adminRes as unknown as Response,
        noopNext,
      );
      expect(adminRes.statusCode).toBe(200);
      expect(adminRes.headers['Content-Type']).toBe('application/pdf');
      expect(adminRes.endedBuffer?.subarray(0, 4).toString()).toBe('%PDF');
    } finally {
      (prisma.schoolSettings as unknown as { findFirst: typeof origSettingsFindFirst }).findFirst = origSettingsFindFirst;
      (prisma.schoolConfig as unknown as { findFirst: typeof origCfgFindFirst }).findFirst = origCfgFindFirst;
      (prisma.school as unknown as { findUnique: typeof origSchoolFindUnique }).findUnique = origSchoolFindUnique;
    }
  });
});
