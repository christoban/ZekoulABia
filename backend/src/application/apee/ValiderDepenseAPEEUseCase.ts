/**
 * APPLICATION — Use case : valider une dépense APEE. Refuse toute validation tant qu'aucun
 * justificatif n'a été joint (règle du Module 11 de la carte : "chaque dépense APEE exige un
 * justificatif joint avant validation") — protège contre une dépense fantôme ou non tracée.
 */
import type { ApeeRepository } from '@domain/ports/repositories/ApeeRepository';

export interface ValiderDepenseAPEECommande {
  schoolId: string;
  transactionId: string;
  valideParId: string;
}

export class ValiderDepenseAPEEUseCase {
  constructor(private readonly apeeRepository: ApeeRepository) {}

  async execute(cmd: ValiderDepenseAPEECommande) {
    const transaction = await this.apeeRepository.trouverParId(cmd.transactionId, cmd.schoolId);

    if (!transaction) {
      throw new Error('Transaction APEE introuvable.');
    }
    if (transaction.type !== 'DEPENSE') {
      throw new Error('Seule une dépense a besoin d\'être validée — une collecte est déjà valide dès sa saisie.');
    }
    if (transaction.valide) {
      throw new Error('Cette dépense est déjà validée.');
    }
    if (!transaction.justificatifUrl) {
      throw new Error('Impossible de valider : aucun justificatif joint à cette dépense.');
    }
    if (transaction.creeParId === cmd.valideParId) {
      throw new Error('Le créateur d\'une dépense ne peut pas la valider lui-même (séparation 4 yeux).');
    }

    return this.apeeRepository.valider(cmd.transactionId, cmd.valideParId);
  }
}
