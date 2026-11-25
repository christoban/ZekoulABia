import type {
  DiscountView,
  FactureRepository,
  InstallmentView,
} from '@domain/ports/repositories/FactureRepository';
import type { DiscountReasonType } from '@domain/types/enums';

export interface AppliquerRemiseCommande {
  schoolId: string;
  invoiceId: string;
  reasonType: DiscountReasonType;
  amount?: number;
  percentage?: number;
  justification: string;
  grantedById: string;
}

export interface AppliquerRemiseResultat {
  invoiceId: string;
  netAmount: number;
  grossAmount: number;
  discountTotal: number;
  status: string;
  discount: DiscountView;
  installments: InstallmentView[];
}

export class AppliquerRemiseEleveUseCase {
  constructor(private readonly factureRepository: FactureRepository) {}

  async execute(commande: AppliquerRemiseCommande): Promise<AppliquerRemiseResultat> {
    if (!commande.justification || commande.justification.trim().length < 3) {
      throw new Error('Une justification écrite est obligatoire pour accorder une remise');
    }

    const invoice = await this.factureRepository.findById(commande.invoiceId);
    if (!invoice || invoice.schoolId !== commande.schoolId) {
      throw new Error('Facture introuvable dans cet établissement');
    }

    const currentAmount = Math.round(invoice.amount);
    let computedAmount = 0;
    if (commande.percentage !== undefined && commande.percentage > 0) {
      if (commande.percentage > 100) {
        throw new Error('Le pourcentage de remise ne peut pas dépasser 100 %');
      }
      computedAmount = Math.round((currentAmount * commande.percentage) / 100);
    } else if (commande.amount !== undefined && commande.amount > 0) {
      computedAmount = Math.round(commande.amount);
    } else {
      throw new Error('Le montant ou pourcentage de remise doit être supérieur à 0');
    }

    const res = await this.factureRepository.appliquerRemise({
      schoolId: commande.schoolId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      reasonType: commande.reasonType,
      amount: computedAmount,
      percentage: commande.percentage ?? null,
      justification: commande.justification.trim(),
      grantedById: commande.grantedById,
    });

    return {
      invoiceId: res.invoice.id,
      netAmount: res.invoice.amount,
      grossAmount: res.invoice.grossAmount ?? res.invoice.amount,
      discountTotal: res.invoice.discountTotal ?? computedAmount,
      status: res.invoice.status,
      discount: res.discount,
      installments: res.installments,
    };
  }
}

