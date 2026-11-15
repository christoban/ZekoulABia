import type { FactureRepository, InstallmentView } from '@domain/ports/repositories/FactureRepository';

export interface ConfigurerEcheancierCommande {
  schoolId: string;
  invoiceId: string;
  tranches: { label: string; amount: number; dueDate: Date | string }[];
}

export interface ConfigurerEcheancierResultat {
  invoiceId: string;
  netAmount: number;
  installments: InstallmentView[];
}

export class ConfigurerEcheancierFactureUseCase {
  constructor(private readonly factureRepository: FactureRepository) {}

  async execute(commande: ConfigurerEcheancierCommande): Promise<ConfigurerEcheancierResultat> {
    if (!Array.isArray(commande.tranches) || commande.tranches.length === 0) {
      throw new Error('Au moins une tranche est requise');
    }

    const parsedTranches = commande.tranches.map((t, idx) => {
      const dueDate = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        throw new Error(`Date d'échéance invalide pour la tranche ${idx + 1}`);
      }
      if (!t.label?.trim()) {
        throw new Error(`Libellé requis pour la tranche ${idx + 1}`);
      }
      if (!Number.isFinite(t.amount) || t.amount < 0) {
        throw new Error(`Montant invalide pour la tranche ${idx + 1}`);
      }
      return {
        trancheNumber: idx + 1,
        label: t.label.trim(),
        amount: Math.round(t.amount),
        dueDate,
      };
    });

    return this.factureRepository.configurerEcheancier(
      commande.invoiceId,
      commande.schoolId,
      parsedTranches,
    );
  }
}

