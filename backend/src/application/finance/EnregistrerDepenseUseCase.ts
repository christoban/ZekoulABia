/**
 * APPLICATION LAYER — Use Case : Enregistrer une dépense
 * Loi 2 — Art. 34 & 39 : vérification séparation ordonnateur/comptable.
 */
import { Depense } from '@domain/entities/Depense';
import type { DepenseRepository } from '@domain/ports/repositories/DepenseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface EnregistrerDepenseCommande {
  schoolId: string;
  label: string;
  amount: number;
  currency?: string;
  category?: string;
  date?: Date;
  createdById: string;
  ordonnateurId?: string;
}

export class EnregistrerDepenseUseCase {
  constructor(
    private readonly depenseRepository: DepenseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: EnregistrerDepenseCommande): Promise<{ depenseId: string }> {
    // 1. Vérifier que l'exécutant est bien un Intendant/Bursar
    const executant = await this.userRepository.findById(commande.createdById);
    if (!executant) throw new Error('Exécutant introuvable');
    if (
      !executant.aPermission('MANAGE_FINANCE') &&
      !executant.estAdmin()
    ) {
      throw new Error('Permission MANAGE_FINANCE requise pour enregistrer une dépense');
    }

    // 2. Créer la dépense (Loi 2 vérifiée dans l'entité si ordonnateurId fourni)
    const depense = Depense.create({
      schoolId: commande.schoolId,
      label: commande.label,
      amount: commande.amount,
      currency: commande.currency,
      category: commande.category,
      date: commande.date,
      createdById: commande.createdById,
      ordonnateurId: commande.ordonnateurId,
    });

    await this.depenseRepository.save(depense);

    return { depenseId: depense.id };
  }
}
