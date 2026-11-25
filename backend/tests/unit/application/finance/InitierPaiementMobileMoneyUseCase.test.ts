/**
 * Tests de `InitierPaiementMobileMoneyUseCase` — zone à risque n°3 de l'audit.
 *
 * Ce use case déclenche une VRAIE transaction Mobile Money (Campay) : une erreur ici ne se
 * rattrape pas côté application, elle débite réellement un parent. Les propriétés vérifiées sont
 * donc celles qui touchent à l'argent :
 *  - aucun appel Campay n'est émis quand une précondition échoue (facture inexistante, non
 *    payable, paiement déjà en cours) — un appel de trop est un débit de trop ;
 *  - le montant envoyé à Campay provient TOUJOURS de la facture, jamais de l'appelant ;
 *  - un échec Campay ne laisse aucun paiement fantôme en base.
 *
 * Le `FakePaiementService` enregistre les appels au lieu de contacter Campay — aucun réseau.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { InitierPaiementMobileMoneyUseCase } from '../../../../src/application/finance/InitierPaiementMobileMoneyUseCase.ts';
import { InMemoryFactureRepository } from '../../../helpers/repositories/InMemoryFactureRepository.ts';
import { InMemoryPaiementRepository } from '../../../helpers/repositories/InMemoryPaiementRepository.ts';
import { FakePaiementService } from '../../../helpers/services/FakePaiementService.ts';
import { Facture } from '@domain/entities/Facture';
import { Paiement } from '@domain/entities/Paiement';

describe('InitierPaiementMobileMoneyUseCase', () => {
  let factureRepo: InMemoryFactureRepository;
  let paiementRepo: InMemoryPaiementRepository;
  let paiementService: FakePaiementService;
  let useCase: InitierPaiementMobileMoneyUseCase;
  let facture: Facture;

  const commande = () => ({
    schoolId: 'school-1',
    factureId: facture.id,
    studentId: 'eleve-1',
    phoneNumber: '237677000001',
    method: 'MTN_MOMO' as const,
  });

  beforeEach(() => {
    factureRepo = new InMemoryFactureRepository();
    paiementRepo = new InMemoryPaiementRepository();
    paiementService = new FakePaiementService();
    useCase = new InitierPaiementMobileMoneyUseCase(factureRepo, paiementRepo, paiementService);

    facture = Facture.create({ schoolId: 'school-1', studentId: 'eleve-1', amount: 30000 });
    factureRepo.ajouter(facture);
  });

  describe('chemin nominal', () => {
    it('initie le paiement et le persiste en attente avec la référence Campay', async () => {
      const resultat = await useCase.execute(commande());

      expect(resultat.paiementId).toBeDefined();
      expect(resultat.campayRef).toStartWith('FAKE-REF-');
      expect(resultat.statut).toBe('PENDING');

      const paiement = await paiementRepo.findById(resultat.paiementId);
      expect(paiement).not.toBeNull();
      expect(paiement!.estEnAttente()).toBe(true);
      expect(paiement!.campayRef).toBe(resultat.campayRef);
    });

    it("ARGENT — le montant débité provient de la FACTURE, jamais de l'appelant", async () => {
      await useCase.execute(commande());

      expect(paiementService.appels).toHaveLength(1);
      expect(paiementService.appels[0]!.montant).toBe(30000);
      expect(paiementService.appels[0]!.devise).toBe('XAF');
      // Le téléphone et la méthode, eux, viennent bien de la commande.
      expect(paiementService.appels[0]!.telephone).toBe('237677000001');
      expect(paiementService.appels[0]!.methode).toBe('MTN_MOMO');
    });

    it('le paiement enregistré porte le montant de la facture', async () => {
      const resultat = await useCase.execute(commande());
      const paiement = await paiementRepo.findById(resultat.paiementId);
      expect(paiement!.amount).toBe(30000);
    });
  });

  describe('préconditions — aucun appel Campay ne doit partir', () => {
    it('facture introuvable → rejet, et AUCUN appel Campay', async () => {
      await expect(
        useCase.execute({ ...commande(), factureId: 'facture-inexistante' }),
      ).rejects.toThrow('introuvable');

      expect(paiementService.appels).toHaveLength(0);
    });

    it('facture déjà payée → rejet, et AUCUN appel Campay', async () => {
      const payee = Facture.reconstituer({
        ...facture.toObject(), id: 'facture-payee', status: 'PAID',
      });
      factureRepo.ajouter(payee);

      await expect(
        useCase.execute({ ...commande(), factureId: 'facture-payee' }),
      ).rejects.toThrow('ne peut plus être payée');

      expect(paiementService.appels).toHaveLength(0);
    });

    it('facture annulée → rejet, et AUCUN appel Campay', async () => {
      const annulee = Facture.reconstituer({
        ...facture.toObject(), id: 'facture-annulee', status: 'CANCELLED',
      });
      factureRepo.ajouter(annulee);

      await expect(
        useCase.execute({ ...commande(), factureId: 'facture-annulee' }),
      ).rejects.toThrow('ne peut plus être payée');

      expect(paiementService.appels).toHaveLength(0);
    });

    it('DOUBLE DÉBIT — un paiement déjà en attente bloque toute nouvelle tentative', async () => {
      // Première tentative : passe.
      await useCase.execute(commande());
      expect(paiementService.appels).toHaveLength(1);

      // Seconde tentative sur la MÊME facture : refusée avant tout appel Campay.
      await expect(useCase.execute(commande())).rejects.toThrow('déjà en cours');

      expect(paiementService.appels).toHaveLength(1); // toujours 1, pas 2
      const paiements = await paiementRepo.findByFacture(facture.id);
      expect(paiements).toHaveLength(1);
    });

    it("une facture PARTIAL reste payable (le solde peut être réglé)", async () => {
      const partielle = Facture.reconstituer({
        ...facture.toObject(), id: 'facture-partielle', status: 'PARTIAL',
      });
      factureRepo.ajouter(partielle);

      const resultat = await useCase.execute({ ...commande(), factureId: 'facture-partielle' });
      expect(resultat.paiementId).toBeDefined();
    });
  });

  describe('échec Campay', () => {
    it("ne laisse AUCUN paiement fantôme en base si Campay échoue", async () => {
      paiementService.simulerEchec = true;

      await expect(useCase.execute(commande())).rejects.toThrow('Campay indisponible');

      // Le paiement n'est créé qu'APRÈS le retour de Campay — rien ne doit subsister.
      const paiements = await paiementRepo.findByFacture(facture.id);
      expect(paiements).toHaveLength(0);
    });

    it("après un échec Campay, une nouvelle tentative reste possible (pas de blocage résiduel)", async () => {
      paiementService.simulerEchec = true;
      await expect(useCase.execute(commande())).rejects.toThrow();

      paiementService.simulerEchec = false;
      const resultat = await useCase.execute(commande());
      expect(resultat.paiementId).toBeDefined();
    });
  });

  describe('isolation entre factures', () => {
    it("un paiement en attente sur une AUTRE facture ne bloque pas celle-ci", async () => {
      const autre = Facture.create({ schoolId: 'school-1', studentId: 'eleve-2', amount: 15000 });
      factureRepo.ajouter(autre);
      paiementRepo.ajouter(Paiement.create({
        schoolId: 'school-1', invoiceId: autre.id, studentId: 'eleve-2',
        amount: 15000, method: 'MTN_MOMO', feeType: 'TUITION',
        campayRef: 'REF-AUTRE', phoneNumber: '237677000002',
      }));

      const resultat = await useCase.execute(commande());
      expect(resultat.paiementId).toBeDefined();
    });
  });
});
