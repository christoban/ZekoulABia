/**
 * APPLICATION LAYER — Use Case : Initier un paiement Mobile Money
 * Appelle Campay via PaiementService.
 * Empêche les doublons de tentatives PENDING.
 */
import { Paiement } from '@domain/entities/Paiement';
import { ConflitVersionPaiementError } from '@domain/errors/ConflitVersionPaiementError';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { PaiementService } from '@domain/ports/services/PaiementService';
import type { PaymentMethod } from '@domain/types/enums';

export interface InitierPaiementCommande {
  schoolId: string;
  factureId: string;
  studentId: string;
  phoneNumber: string;
  method: PaymentMethod;
  amount?: number;
  /** V3.2 — version locale optionnelle (compat offline retro) */
  baseUpdatedAt?: Date | string | null;
  versionLocale?: Date | string | null;
  versionClient?: Date | string | null;
}

export interface InitierPaiementResultat {
  paiementId: string;
  campayRef: string;
  statut: string;
}

export class InitierPaiementMobileMoneyUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly paiementRepository: PaiementRepository,
    private readonly paiementService: PaiementService,
  ) {}

  async execute(commande: InitierPaiementCommande): Promise<InitierPaiementResultat> {
    // 1. Vérifier la facture
    const facture = await this.factureRepository.findById(commande.factureId);
    if (!facture) throw new Error(`Facture introuvable : ${commande.factureId}`);
    if (facture.schoolId !== commande.schoolId) {
      throw new Error("Cette facture n'appartient pas à votre établissement");
    }
    if (!facture.peutEtrePayee()) {
      throw new Error('Cette facture ne peut plus être payée (annulée ou déjà payée)');
    }

    // 1b. V3.2 — Conflit de version (offline) — même garde-fou que cash, si client envoie une version
    const versionLocaleRaw = (commande.versionLocale ?? commande.baseUpdatedAt ?? commande.versionClient ?? null) as Date | string | null | undefined;
    if (versionLocaleRaw && facture.updatedAt) {
      const versionClient = versionLocaleRaw instanceof Date ? versionLocaleRaw : new Date(versionLocaleRaw as string);
      if (!Number.isNaN(versionClient.getTime()) && facture.updatedAt.getTime() !== versionClient.getTime()) {
        const totalPayeActuel = await this.factureRepository.calculerTotalPayeAvecSucces(commande.factureId);
        throw new ConflitVersionPaiementError({
          factureId: commande.factureId,
          versionServeur: facture.updatedAt,
          versionLocale: versionClient,
          montantSaisi: facture.amount,
          totalPaye: totalPayeActuel,
          resteARegler: Math.max(0, facture.amount - totalPayeActuel),
        });
      }
    }

    // 2. Éviter les doublons — pas deux PENDING pour la même facture
    const dejaEnAttente = await this.paiementRepository.existePaiementEnAttente(
      commande.factureId
    );
    if (dejaEnAttente) {
      throw new Error(
        'Un paiement est déjà en cours pour cette facture. Attendez la confirmation.'
      );
    }

    // 2b. Calcul du montant réel à payer (solde restant dû ou montant saisi)
    const totalPayeActuel = await this.factureRepository.calculerTotalPayeAvecSucces(commande.factureId);
    const resteARegler = Math.max(0, facture.amount - totalPayeActuel);
    if (resteARegler <= 0) {
      throw new Error('Cette facture a déjà été intégralement réglée');
    }

    const montantAPayer = (commande.amount && commande.amount > 0)
      ? Math.min(commande.amount, resteARegler)
      : resteARegler;

    // 3. Initier via Campay
    const resultatCampay = await this.paiementService.initierPaiement({
      montant: montantAPayer,
      devise: 'XAF',
      telephone: commande.phoneNumber,
      methode: commande.method,
      description: `Paiement facture ${commande.factureId}`,
      referenceInterne: commande.factureId,
      schoolId: commande.schoolId,
    });

    // 4. Créer le paiement en PENDING
    const paiement = Paiement.create({
      schoolId: commande.schoolId,
      invoiceId: commande.factureId,
      studentId: commande.studentId,
      amount: montantAPayer,
      method: commande.method,
      feeType: 'TUITION',
      campayRef: resultatCampay.reference,
      phoneNumber: commande.phoneNumber,
    });

    await this.paiementRepository.save(paiement);

    return {
      paiementId: paiement.id,
      campayRef: resultatCampay.reference,
      statut: resultatCampay.statut,
    };
  }
}
