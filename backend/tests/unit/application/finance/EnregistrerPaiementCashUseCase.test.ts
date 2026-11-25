/**
 * Tests de `EnregistrerPaiementCashUseCase` — V3.2 « Stratégie de conflits ».
 *
 * Un encaissement en espèces débite réellement un parent : les propriétés vérifiées
 * sont celles qui touchent à l'argent :
 *  - double-encaissement refusé (transaction atomique) : 6000+6000 sur une facture
 *    de 10000 ne peut PAS passer ;
 *  - conflit de version détecté si la facture a changé depuis l'affichage (baseUpdatedAt),
 *    jamais de résolution silencieuse ;
 *  - compatibilité rétro : sans baseUpdatedAt, l'encaissement fonctionne toujours.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { EnregistrerPaiementCashUseCase } from '../../../../src/application/finance/EnregistrerPaiementCashUseCase.ts';
import { InMemoryFactureRepository } from '../../../helpers/repositories/InMemoryFactureRepository.ts';
import { InMemoryPaiementRepository } from '../../../helpers/repositories/InMemoryPaiementRepository.ts';
import { Facture } from '@domain/entities/Facture';
import { ConflitVersionPaiementError } from '@domain/errors/ConflitVersionPaiementError';

describe('EnregistrerPaiementCashUseCase', () => {
  let factureRepo: InMemoryFactureRepository;
  let paiementRepo: InMemoryPaiementRepository;
  let useCase: EnregistrerPaiementCashUseCase;
  let facture: Facture;

  const commande = (montant: number) => ({
    schoolId: 'school-1',
    factureId: facture.id,
    studentId: 'eleve-1',
    montant,
    enregistreurId: 'intendant-1',
  });

  beforeEach(() => {
    factureRepo = new InMemoryFactureRepository();
    paiementRepo = new InMemoryPaiementRepository();
    useCase = new EnregistrerPaiementCashUseCase(factureRepo, paiementRepo);

    facture = Facture.reconstituer({
      id: 'facture-1',
      schoolId: 'school-1',
      studentId: 'eleve-1',
      amount: 10000,
      currency: 'XAF',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    factureRepo.ajouter(facture);
  });

  it('encaisse un paiement partiel et met la facture en PARTIAL', async () => {
    const resultat = await useCase.execute(commande(4000));

    expect(resultat.nouveauStatutFacture).toBe('PARTIAL');
    expect(resultat.totalPaye).toBe(4000);
    expect(resultat.resteARegler).toBe(6000);
  });

  it('passe la facture en PAID quand le total est atteint', async () => {
    const resultat = await useCase.execute(commande(10000));

    expect(resultat.nouveauStatutFacture).toBe('PAID');
    expect(resultat.resteARegler).toBe(0);
  });

  it('ARGENT — refuse le double-encaissement qui dépasse le solde', async () => {
    await useCase.execute(commande(6000));

    expect(() => useCase.execute(commande(6000))).toThrow(/dépasse le solde restant/);
    // Aucun second paiement en base
    const paiements = await paiementRepo.findByFacture(facture.id);
    expect(paiements).toHaveLength(1);
  });

  it('ARGENT — le paiement cumulé ne dépasse jamais le total de la facture', async () => {
    await useCase.execute(commande(6000));
    await useCase.execute(commande(4000));
    // Un troisième encaissement, même partiel, est impossible (PAID)
    expect(() => useCase.execute(commande(1))).toThrow(/ne peut plus être payée/);
  });

  it('V3.2 — refuse l\'encaissement si la facture a changé depuis l\'affichage (baseUpdatedAt obsolète)', async () => {
    // Un premier encaissement a modifié la facture (updatedAt avance côté serveur)
    facture.mettreAJourStatut(3000);
    const nouvelleVersion = new Date('2026-01-02T00:00:00Z');
    factureRepo.update(Facture.reconstituer({
      id: facture.id,
      schoolId: 'school-1',
      studentId: 'eleve-1',
      amount: 10000,
      currency: 'XAF',
      status: facture.status,
      createdAt: facture.createdAt,
      updatedAt: nouvelleVersion,
    }));

    // Le client encaisse toujours avec l'ancienne version affichée
    expect(() =>
      useCase.execute({
        ...commande(3000),
        baseUpdatedAt: new Date('2026-01-01T00:00:00Z'),
      })
    ).toThrow(ConflitVersionPaiementError);
  });

  it('V3.2 — encaisse sans erreur quand baseUpdatedAt correspond à la version serveur', async () => {
    const resultat = await useCase.execute({
      ...commande(3000),
      baseUpdatedAt: facture.updatedAt,
    });

    expect(resultat.totalPaye).toBe(3000);
  });

  it('V3.2 — compatibilité rétro : sans baseUpdatedAt, l\'encaissement fonctionne', async () => {
    const resultat = await useCase.execute(commande(3000));

    expect(resultat.nouveauStatutFacture).toBe('PARTIAL');
    expect(resultat.totalPaye).toBe(3000);
  });
});