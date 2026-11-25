import { describe, it, expect, beforeEach } from 'bun:test';
import { TraiterWebhookCampayUseCase } from '../../../../src/application/finance/TraiterWebhookCampayUseCase.ts';
import { InMemoryPaiementRepository } from '../../../helpers/repositories/InMemoryPaiementRepository.ts';
import { InMemoryFactureRepository } from '../../../helpers/repositories/InMemoryFactureRepository.ts';
import { Paiement } from '@domain/entities/Paiement';
import { Facture } from '@domain/entities/Facture';

describe('TraiterWebhookCampayUseCase', () => {
  let paiementRepo: InMemoryPaiementRepository;
  let factureRepo: InMemoryFactureRepository;
  let useCase: TraiterWebhookCampayUseCase;

  beforeEach(() => {
    paiementRepo = new InMemoryPaiementRepository();
    factureRepo = new InMemoryFactureRepository();
    useCase = new TraiterWebhookCampayUseCase(paiementRepo, factureRepo);

    // Fixtures recréées à chaque test — évite les mutations inter-tests
    factureRepo.ajouter(Facture.reconstituer({
      id: 'facture-1',
      schoolId: 'school-1',
      studentId: 'eleve-1',
      amount: 10000,
      currency: 'XAF',
      status: 'PENDING',
      createdAt: new Date(),
    }));
    paiementRepo.ajouter(Paiement.reconstituer({
      id: 'paiement-1',
      schoolId: 'school-1',
      invoiceId: 'facture-1',
      studentId: 'eleve-1',
      amount: 10000,
      currency: 'XAF',
      method: 'MTN_MOMO',
      status: 'PENDING',
      feeType: 'TUITION',
      campayRef: 'CAMPAY-REF-001',
      createdAt: new Date(),
    }));
  });

  it('devrait confirmer le paiement et passer la facture en PAID', async () => {
    factureRepo.definirTotalPaye('facture-1', 10000);

    await useCase.execute({
      campayRef: 'CAMPAY-REF-001',
      statut: 'SUCCESS',
      montant: 10000,
      telephone: '237670000001',
      donneesRaw: {},
    });

    const paiement = await paiementRepo.findById('paiement-1');
    expect(paiement?.status).toBe('SUCCESS');
    expect(paiement?.estReussi()).toBe(true);

    const factureApres = await factureRepo.findById('facture-1');
    expect(factureApres?.status).toBe('PAID');
  });

  it('devrait passer la facture en PARTIAL si paiement partiel', async () => {
    factureRepo.definirTotalPaye('facture-1', 5000);

    await useCase.execute({
      campayRef: 'CAMPAY-REF-001',
      statut: 'SUCCESS',
      montant: 5000,
      telephone: '237670000001',
      donneesRaw: {},
    });

    const factureApres = await factureRepo.findById('facture-1');
    expect(factureApres?.status).toBe('PARTIAL');
  });

  it('devrait marquer le paiement FAILED si webhook FAILED', async () => {
    await useCase.execute({
      campayRef: 'CAMPAY-REF-001',
      statut: 'FAILED',
      montant: 0,
      telephone: '237670000001',
      donneesRaw: {},
    });

    const paiement = await paiementRepo.findById('paiement-1');
    expect(paiement?.status).toBe('FAILED');
  });

  it('devrait rejeter si référence Campay introuvable', async () => {
    await expect(useCase.execute({
      campayRef: 'REF-INEXISTANTE',
      statut: 'SUCCESS',
      montant: 10000,
      telephone: '237670000001',
      donneesRaw: {},
    })).rejects.toThrow('introuvable');
  });
});
