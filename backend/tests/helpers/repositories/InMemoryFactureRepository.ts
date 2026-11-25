import { Facture } from '@domain/entities/Facture';
import type {
  DiscountInput,
  DiscountView,
  FactureEnRetard,
  FactureRepository,
  InstallmentInput,
  InstallmentView,
  PromisePaymentInput,
} from '@domain/ports/repositories/FactureRepository';
import type { InvoiceStatus } from '@domain/types/enums';

export class InMemoryFactureRepository implements FactureRepository {
  private store = new Map<string, Facture>();
  private totauxPaies = new Map<string, number>();
  private classesParEleve = new Map<string, string>();
  private installments = new Map<string, InstallmentView[]>();
  private discounts = new Map<string, DiscountView[]>();
  private credits = new Map<string, number>();
  public defaultInstallmentsCount = 3;

  ajouter(facture: Facture): void {
    this.store.set(facture.id, facture);
    if (!this.installments.has(facture.id)) {
      this.createDefaultInstallments(facture, this.defaultInstallmentsCount);
    }
  }

  definirTotalPaye(factureId: string, montant: number): void {
    this.totauxPaies.set(factureId, montant);
    this.reallocateInstallments(factureId, montant);
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  addStudentCredit(schoolId: string, studentId: string, delta: number): void {
    const key = `${schoolId}:${studentId}`;
    this.credits.set(key, (this.credits.get(key) ?? 0) + Math.round(delta));
  }

  private createDefaultInstallments(facture: Facture, count: number): void {
    const n = Math.max(1, Math.round(count || 3));
    const total = Math.round(facture.amount);
    const base = Math.floor(total / n);
    const finalDue = facture.dueDate ?? new Date(Date.now() + 90 * 86400_000);
    const list: InstallmentView[] = Array.from({ length: n }, (_, idx) => {
      const trancheNumber = idx + 1;
      const amount = trancheNumber === n ? total - base * (n - 1) : base;
      return {
        id: `${facture.id}-inst-${trancheNumber}`,
        invoiceId: facture.id,
        trancheNumber,
        label: `Tranche ${trancheNumber}/${n}`,
        amount,
        paidAmount: 0,
        dueDate: finalDue,
        status: 'PENDING',
      };
    });
    this.installments.set(facture.id, list);
  }

  reallocateInstallments(invoiceId: string, totalPaid?: number): void {
    const list = this.installments.get(invoiceId);
    if (!list) return;
    let remaining = Math.round(totalPaid ?? (this.totauxPaies.get(invoiceId) ?? 0));
    const updated: InstallmentView[] = list.map((inst) => {
      const paidAmount = Math.min(inst.amount, Math.max(0, remaining));
      remaining = Math.max(0, remaining - paidAmount);
      const status: InvoiceStatus =
        paidAmount >= inst.amount && inst.amount > 0
          ? 'PAID'
          : paidAmount > 0
            ? 'PARTIAL'
            : inst.dueDate < new Date()
              ? 'OVERDUE'
              : 'PENDING';
      return { ...inst, paidAmount, status };
    });
    this.installments.set(invoiceId, updated);
  }

  async findById(id: string): Promise<Facture | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string): Promise<Facture[]> {
    return [...this.store.values()].filter((f) => f.studentId === studentId);
  }

  async findBySchool(schoolId: string): Promise<Facture[]> {
    return [...this.store.values()].filter((f) => f.schoolId === schoolId);
  }

  async findByStatut(schoolId: string, statut: InvoiceStatus): Promise<Facture[]> {
    return [...this.store.values()].filter((f) => f.schoolId === schoolId && f.status === statut);
  }

  async findByClasse(classId: string): Promise<Facture[]> {
    const studentIds = [...this.classesParEleve.entries()]
      .filter(([, classeId]) => classeId === classId)
      .map(([studentId]) => studentId);
    return [...this.store.values()].filter((facture) => studentIds.includes(facture.studentId));
  }

  async findByPlanFrais(feePlanId: string): Promise<Facture[]> {
    return [...this.store.values()].filter((f) => f.feePlanId === feePlanId);
  }

  async calculerTotalPayeAvecSucces(factureId: string): Promise<number> {
    return this.totauxPaies.get(factureId) ?? 0;
  }

  async getElevesEnRetard(schoolId: string): Promise<FactureEnRetard[]> {
    const factures = [...this.store.values()].filter((facture) => {
      const dueDate = facture.toObject().dueDate;
      return (
        facture.schoolId === schoolId &&
        (facture.status === 'PENDING' || facture.status === 'PARTIAL' || facture.status === 'OVERDUE') &&
        dueDate !== undefined &&
        dueDate < new Date()
      );
    });

    const parEleve = new Map<string, FactureEnRetard>();
    for (const facture of factures) {
      const totalPaye = this.totauxPaies.get(facture.id) ?? 0;
      const existant = parEleve.get(facture.studentId);
      if (existant) {
        existant.totalDu += facture.amount;
        existant.totalPaye += totalPaye;
        existant.solde += facture.amount - totalPaye;
        existant.nombreFacturesEnRetard += 1;
      } else {
        parEleve.set(facture.studentId, {
          studentId: facture.studentId,
          studentNom: facture.studentId,
          totalDu: facture.amount,
          totalPaye,
          solde: facture.amount - totalPaye,
          nombreFacturesEnRetard: 1,
        });
      }
    }
    return [...parEleve.values()];
  }

  async aFactureImpayeeBloquante(studentId: string): Promise<boolean> {
    return [...this.store.values()].some(
      (facture) =>
        facture.studentId === studentId &&
        (facture.status === 'PENDING' || facture.status === 'PARTIAL' || facture.status === 'OVERDUE'),
    );
  }

  async save(facture: Facture): Promise<void> {
    this.store.set(facture.id, facture);
    this.createDefaultInstallments(facture, this.defaultInstallmentsCount);
  }

  async update(facture: Facture): Promise<void> {
    this.store.set(facture.id, facture);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
    this.installments.delete(id);
    this.discounts.delete(id);
  }

  async getInstallments(invoiceId: string): Promise<InstallmentView[]> {
    return this.installments.get(invoiceId) ?? [];
  }

  async getDiscounts(invoiceId: string): Promise<DiscountView[]> {
    return this.discounts.get(invoiceId) ?? [];
  }

  async configurerEcheancier(
    invoiceId: string,
    schoolId: string,
    tranches: InstallmentInput[],
  ): Promise<{ invoiceId: string; netAmount: number; installments: InstallmentView[] }> {
    const invoice = this.store.get(invoiceId);
    if (!invoice || invoice.schoolId !== schoolId) {
      throw new Error('Facture introuvable');
    }
    const netAmount = Math.round(invoice.amount);
    const sum = tranches.reduce((s, t) => s + Math.round(t.amount), 0);
    if (sum !== netAmount) {
      throw new Error(`La somme des tranches (${sum}) doit égaler le montant net (${netAmount})`);
    }
    const items: InstallmentView[] = tranches.map((t, i) => ({
      id: `${invoiceId}-inst-${i + 1}`,
      invoiceId,
      trancheNumber: t.trancheNumber ?? i + 1,
      label: t.label,
      amount: Math.round(t.amount),
      paidAmount: 0,
      dueDate: t.dueDate,
      status: 'PENDING',
    }));
    this.installments.set(invoiceId, items);
    this.reallocateInstallments(invoiceId);
    return { invoiceId, netAmount, installments: this.installments.get(invoiceId) ?? items };
  }

  async appliquerRemise(input: DiscountInput): Promise<{
    invoice: Facture;
    discount: DiscountView;
    installments: InstallmentView[];
  }> {
    const invoice = this.store.get(input.invoiceId);
    if (!invoice || invoice.schoolId !== input.schoolId) {
      throw new Error('Facture introuvable');
    }
    if (!input.justification || input.justification.trim().length < 3) {
      throw new Error('Justification de remise obligatoire');
    }
    const props = invoice.toObject();
    const gross = Math.round(props.grossAmount ?? props.amount);
    const prevDiscount = Math.round(props.discountTotal ?? 0);
    const discountAmount = Math.max(0, Math.round(input.amount));
    const totalPaid = this.totauxPaies.get(invoice.id) ?? 0;
    const newNet = Math.max(0, gross - (prevDiscount + discountAmount));
    const excessCredit = Math.max(0, totalPaid - newNet);
    if (excessCredit > 0) {
      this.addStudentCredit(input.schoolId, invoice.studentId, excessCredit);
    }

    const updated = Facture.reconstituer({
      ...props,
      grossAmount: gross,
      discountTotal: prevDiscount + discountAmount,
      amount: newNet,
      updatedAt: new Date(),
    });
    updated.mettreAJourStatut(totalPaid);
    this.store.set(updated.id, updated);

    const disc: DiscountView = {
      id: crypto.randomUUID(),
      schoolId: input.schoolId,
      invoiceId: input.invoiceId,
      studentId: input.studentId,
      reasonType: input.reasonType,
      amount: discountAmount,
      percentage: input.percentage ?? null,
      justification: input.justification,
      grantedById: input.grantedById,
      createdAt: new Date(),
    };
    const existingDiscs = this.discounts.get(input.invoiceId) ?? [];
    this.discounts.set(input.invoiceId, [...existingDiscs, disc]);

    const currentInsts = this.installments.get(invoice.id) ?? [];
    if (currentInsts.length > 0 && updated.amount >= 0) {
      const n = currentInsts.length;
      const base = Math.floor(newNet / n);
      this.installments.set(
        invoice.id,
        currentInsts.map((inst, idx) => ({
          ...inst,
          amount: idx === n - 1 ? newNet - base * (n - 1) : base,
        })),
      );
      this.reallocateInstallments(invoice.id, totalPaid);
    }

    return {
      invoice: updated,
      discount: disc,
      installments: this.installments.get(invoice.id) ?? [],
    };
  }

  async enregistrerPromessePaiement(input: PromisePaymentInput): Promise<Facture> {
    const invoice = this.store.get(input.invoiceId);
    if (!invoice || invoice.schoolId !== input.schoolId) {
      throw new Error('Facture introuvable');
    }
    const updated = Facture.reconstituer({
      ...invoice.toObject(),
      promisedPaymentDate: input.promisedDate,
      promisedPaymentNote: input.note,
      updatedAt: new Date(),
    });
    this.store.set(updated.id, updated);
    return updated;
  }

  async calculerAvoirDisponible(schoolId: string, studentId: string): Promise<number> {
    return Math.max(0, this.credits.get(`${schoolId}:${studentId}`) ?? 0);
  }
}
