import { Paiement } from '@domain/entities/Paiement';
import type { Facture } from '@domain/entities/Facture';
import type { InvoiceStatus } from '@domain/types/enums';
import type {
  CancelPaymentResult,
  CashClosureView,
  PaiementRecuData,
  PaiementRepository,
  RevenusParPeriode,
  UnmatchedPaymentView,
} from '@domain/ports/repositories/PaiementRepository';
import type { InMemoryFactureRepository } from './InMemoryFactureRepository';

export class InMemoryPaiementRepository implements PaiementRepository {
  private store = new Map<string, Paiement>();
  private closures: CashClosureView[] = [];
  private receiptSeqBySchoolYear = new Map<string, number>();

  constructor(private readonly factureRepo?: InMemoryFactureRepository) {}

  ajouter(p: Paiement): void {
    this.store.set(p.id, p);
  }

  parRef(ref: string): Paiement | undefined {
    return [...this.store.values()].find((p) => p.campayRef === ref);
  }

  private nextReceiptNumber(schoolId: string, date: Date): string {
    const year = date.getUTCFullYear();
    const key = `${schoolId}:${year}`;
    const next = (this.receiptSeqBySchoolYear.get(key) ?? 0) + 1;
    this.receiptSeqBySchoolYear.set(key, next);
    return `REC-${year}-${String(next).padStart(5, '0')}`;
  }

  private assertDateOpen(schoolId: string, date: Date): void {
    const dayKey = date.toISOString().slice(0, 10);
    const closed = this.closures.some(
      (c) => c.schoolId === schoolId && c.closureDate.toISOString().slice(0, 10) === dayKey,
    );
    if (closed) {
      throw new Error('La caisse de cette journée est déjà clôturée — encaissement en espèces refusé');
    }
  }

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }

  async findByFacture(factureId: string) {
    return [...this.store.values()].filter((p) => p.invoiceId === factureId);
  }

  async findByEleve(studentId: string) {
    return [...this.store.values()].filter((p) => p.studentId === studentId);
  }

  async findByCampayRef(ref: string) {
    return [...this.store.values()].find((p) => p.campayRef === ref) ?? null;
  }

  async existePaiementEnAttente(factureId: string) {
    return [...this.store.values()].some((p) => p.invoiceId === factureId && p.estEnAttente());
  }

  async findCautionsActives(schoolId: string) {
    return [...this.store.values()].filter(
      (p) => p.schoolId === schoolId && p.estCaution() && p.cautionStatus === 'HELD',
    );
  }

  async getRevenusParPeriode(schoolId: string, d: Date, f: Date): Promise<RevenusParPeriode> {
    const items = [...this.store.values()].filter(
      (p) => p.schoolId === schoolId && p.status === 'SUCCESS' && p.paidAt && p.paidAt >= d && p.paidAt <= f,
    );
    const parMethode: Record<string, number> = {};
    let total = 0;
    for (const p of items) {
      total += p.amount;
      parMethode[p.method] = (parMethode[p.method] ?? 0) + p.amount;
    }
    return { total, nombrePaiements: items.length, parMethode };
  }

  async save(p: Paiement) {
    this.store.set(p.id, p);
  }

  async update(p: Paiement) {
    this.store.set(p.id, p);
  }

  async encaisserCash(
    p: Paiement,
    facture: Facture,
    options?: { allowOverpayment?: boolean },
  ): Promise<number> {
    const txDate = p.paidAt ?? new Date();
    this.assertDateOpen(p.schoolId, txDate);
    const paye = [...this.store.values()]
      .filter((pay) => pay.invoiceId === facture.id && pay.status === 'SUCCESS')
      .reduce((s, pay) => s + pay.amount, 0);
    const reste = Math.max(0, facture.amount - paye);
    if (!options?.allowOverpayment && p.amount > reste) {
      throw new Error(`Le montant encaissé (${p.amount}) dépasse le solde restant de la facture (${reste})`);
    }
    const excess = options?.allowOverpayment ? Math.max(0, p.amount - reste) : 0;
    if (!p.receiptNumber) {
      p.assignReceiptNumber(this.nextReceiptNumber(p.schoolId, txDate));
    }
    this.store.set(p.id, p);
    const nouveauTotal = paye + p.amount;
    facture.mettreAJourStatut(nouveauTotal);
    if (this.factureRepo) {
      this.factureRepo.definirTotalPaye(facture.id, nouveauTotal);
      if (excess > 0) this.factureRepo.addStudentCredit(p.schoolId, p.studentId, excess);
    }
    return nouveauTotal;
  }

  async confirmerMobileMoneyAtomique(
    paiement: Paiement,
    campayRef: string,
    operatorRef?: string,
  ): Promise<{ paiement: Paiement; totalPaye: number; creditAdded: number }> {
    if (!paiement.estEnAttente()) {
      const existing = await this.findByFacture(paiement.invoiceId ?? '');
      const sum = existing.filter((x) => x.status === 'SUCCESS').reduce((s, x) => s + x.amount, 0);
      return { paiement, totalPaye: sum, creditAdded: 0 };
    }
    paiement.confirmer(campayRef, operatorRef);
    if (!paiement.receiptNumber) {
      paiement.assignReceiptNumber(this.nextReceiptNumber(paiement.schoolId, new Date()));
    }
    this.store.set(paiement.id, paiement);

    let totalBefore = 0;
    let creditAdded = 0;
    if (paiement.invoiceId) {
      totalBefore = [...this.store.values()]
        .filter((x) => x.id !== paiement.id && x.invoiceId === paiement.invoiceId && x.status === 'SUCCESS')
        .reduce((s, x) => s + x.amount, 0);
      const facture = this.factureRepo ? await this.factureRepo.findById(paiement.invoiceId) : null;
      if (facture) {
        const reste = Math.max(0, facture.amount - totalBefore);
        creditAdded = Math.max(0, paiement.amount - reste);
        facture.mettreAJourStatut(totalBefore + paiement.amount);
        this.factureRepo?.definirTotalPaye(facture.id, totalBefore + paiement.amount);
        if (creditAdded > 0) {
          this.factureRepo?.addStudentCredit(paiement.schoolId, paiement.studentId, creditAdded);
        }
      }
    }
    return { paiement, totalPaye: totalBefore + paiement.amount, creditAdded };
  }

  async annulerPaiement(params: {
    schoolId: string;
    paymentId: string;
    cancelledById: string;
    reason: string;
  }): Promise<CancelPaymentResult> {
    if (!params.reason || params.reason.trim().length < 3) {
      throw new Error("Le motif d'annulation est obligatoire");
    }
    const existing = this.store.get(params.paymentId);
    if (!existing || existing.schoolId !== params.schoolId) {
      throw new Error('Paiement introuvable');
    }
    if (existing.status === 'REFUNDED') {
      throw new Error('Ce paiement a déjà été annulé');
    }
    if (existing.status !== 'SUCCESS') {
      throw new Error('Seuls les paiements validés peuvent être annulés');
    }
    this.assertDateOpen(params.schoolId, existing.paidAt ?? new Date());
    const obj = existing.toObject();
    const cancelled = Paiement.reconstituer({
      ...obj,
      status: 'REFUNDED',
      cancellationReason: params.reason.trim(),
      refundedById: params.cancelledById,
      refundedAt: new Date(),
    });
    this.store.set(cancelled.id, cancelled);

    let totalPaid = 0;
    let invoiceStatus: InvoiceStatus | null = null;
    if (cancelled.invoiceId) {
      totalPaid = [...this.store.values()]
        .filter((p) => p.invoiceId === cancelled.invoiceId && p.status === 'SUCCESS')
        .reduce((s, p) => s + p.amount, 0);
      const inv = this.factureRepo ? await this.factureRepo.findById(cancelled.invoiceId) : null;
      if (inv) {
        inv.mettreAJourStatut(totalPaid);
        invoiceStatus = inv.status;
        this.factureRepo?.definirTotalPaye(inv.id, totalPaid);
      }
    }

    return {
      cancelledPaymentId: cancelled.id,
      receiptNumber: cancelled.receiptNumber ?? null,
      invoiceStatus,
      totalPaid,
      reversedCreditAmount: 0,
    };
  }

  async cloturerCaisse(params: {
    schoolId: string;
    closureDate: Date;
    closedById: string;
    declaredCash?: number | null;
    notes?: string | null;
  }): Promise<CashClosureView> {
    const dayKey = params.closureDate.toISOString().slice(0, 10);
    if (this.closures.some((c) => c.schoolId === params.schoolId && c.closureDate.toISOString().slice(0, 10) === dayKey)) {
      throw new Error('Une clôture de caisse existe déjà pour cette date');
    }
    const daySuccess = [...this.store.values()].filter(
      (p) => p.schoolId === params.schoolId && p.status === 'SUCCESS' && (p.paidAt ?? new Date()).toISOString().slice(0, 10) === dayKey,
    );
    const totalCash = daySuccess.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0);
    const totalMobileMoney = daySuccess.filter((p) => p.estMobileMoney()).reduce((s, p) => s + p.amount, 0);
    const totalOther = daySuccess.filter((p) => p.method !== 'CASH' && !p.estMobileMoney()).reduce((s, p) => s + p.amount, 0);
    const totalCancelled = [...this.store.values()]
      .filter((p) => p.schoolId === params.schoolId && p.status === 'REFUNDED')
      .reduce((s, p) => s + p.amount, 0);
    const declaredCash = params.declaredCash ?? null;
    const variance = declaredCash !== null ? Math.round(declaredCash) - totalCash : null;
    const view: CashClosureView = {
      id: crypto.randomUUID(),
      schoolId: params.schoolId,
      closureDate: new Date(`${dayKey}T00:00:00.000Z`),
      closedById: params.closedById,
      totalCash,
      totalMobileMoney,
      totalOther,
      totalCancelled,
      paymentCount: daySuccess.length,
      declaredCash,
      variance,
      notes: params.notes ?? null,
      createdAt: new Date(),
    };
    this.closures.push(view);
    return view;
  }

  async listerCloturesCaisse(schoolId: string): Promise<CashClosureView[]> {
    return this.closures.filter((c) => c.schoolId === schoolId);
  }

  async enregistrerPaiementNonRapproche(params: {
    schoolId?: string;
    campayRef: string;
    montant: number;
    telephone: string;
    operateurRef?: string;
  }): Promise<void> {
    if ([...this.store.values()].some((p) => p.campayRef === params.campayRef)) return;
    const orphan = Paiement.reconstituer({
      id: crypto.randomUUID(),
      schoolId: params.schoolId ?? 'school-1',
      studentId: 'unmatched-student',
      amount: Math.round(params.montant),
      currency: 'XAF',
      method: 'MTN_MOMO',
      status: 'SUCCESS',
      feeType: 'TUITION',
      campayRef: params.campayRef,
      campayStatus: 'SUCCESSFUL',
      operatorRef: params.operateurRef,
      phoneNumber: params.telephone,
      isUnmatched: true,
      paidAt: new Date(),
      createdAt: new Date(),
    });
    this.store.set(orphan.id, orphan);
  }

  async listerPaiementsNonRapproches(schoolId: string): Promise<UnmatchedPaymentView[]> {
    return [...this.store.values()]
      .filter((p) => p.schoolId === schoolId && p.isUnmatched && p.status === 'SUCCESS')
      .map((p) => ({
        id: p.id,
        schoolId: p.schoolId,
        amount: p.amount,
        method: p.method,
        campayRef: p.campayRef ?? null,
        operatorRef: p.toObject().operatorRef ?? null,
        phoneNumber: p.phoneNumber ?? null,
        paidAt: p.paidAt ?? null,
        createdAt: p.toObject().createdAt,
        studentId: p.studentId,
      }));
  }

  async rapprocherPaiementMobile(params: {
    schoolId: string;
    paymentId: string;
    invoiceId: string;
    reconciledById: string;
  }): Promise<{ paymentId: string; receiptNumber: string; invoiceStatus: InvoiceStatus }> {
    const p = this.store.get(params.paymentId);
    if (!p || p.schoolId !== params.schoolId || !p.isUnmatched) {
      throw new Error('Paiement non rapproché introuvable');
    }
    const inv = this.factureRepo ? await this.factureRepo.findById(params.invoiceId) : null;
    if (!inv || inv.schoolId !== params.schoolId) {
      throw new Error('Facture cible introuvable dans cet établissement');
    }
    const receiptNumber = p.receiptNumber ?? this.nextReceiptNumber(params.schoolId, new Date());
    const obj = p.toObject();
    const updated = Paiement.reconstituer({
      ...obj,
      invoiceId: inv.id,
      studentId: inv.studentId,
      isUnmatched: false,
      recordedById: params.reconciledById,
      receiptNumber,
    });
    this.store.set(updated.id, updated);
    const totalPaid = [...this.store.values()]
      .filter((x) => x.invoiceId === inv.id && x.status === 'SUCCESS')
      .reduce((s, x) => s + x.amount, 0);
    inv.mettreAJourStatut(totalPaid);
    this.factureRepo?.definirTotalPaye(inv.id, totalPaid);
    return { paymentId: updated.id, receiptNumber, invoiceStatus: inv.status };
  }

  async findRecuData(paymentId: string): Promise<PaiementRecuData | null> {
    const p = this.store.get(paymentId);
    if (!p) return null;
    const obj = p.toObject();
    return {
      id: p.id,
      schoolId: p.schoolId,
      studentId: p.studentId,
      amount: p.amount,
      method: p.method,
      status: p.status,
      paidAt: p.paidAt ?? null,
      createdAt: obj.createdAt,
      receiptNumber: p.receiptNumber ?? null,
      provisionalReceiptNumber: p.provisionalReceiptNumber ?? null,
      operatorFee: p.operatorFee ?? 0,
      feeBearer: p.feeBearer ?? null,
      cancellationReason: p.cancellationReason ?? null,
      campayRef: p.campayRef ?? null,
      operatorRef: obj.operatorRef ?? null,
    };
  }
}
