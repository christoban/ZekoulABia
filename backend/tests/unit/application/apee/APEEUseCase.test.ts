import { describe, it, expect } from 'bun:test';
import { CreerTransactionAPEEUseCase } from '../../../../src/application/apee/CreerTransactionAPEEUseCase.ts';
import { ValiderDepenseAPEEUseCase } from '../../../../src/application/apee/ValiderDepenseAPEEUseCase.ts';
import type { ApeeRepository, ApeeTransactionData } from '../../../../src/domain/ports/repositories/ApeeRepository.ts';

function apeeCreerMock() {
  let tx: ApeeTransactionData | null = null;
  return {
    creer: async (data: { schoolId: string; creeParId: string; type: string; montant: number; categorie?: string; description?: string; date: Date; valide: boolean }) => {
      tx = { id: 'tx1', schoolId: data.schoolId, creeParId: data.creeParId, type: data.type, montant: data.montant, categorie: data.categorie ?? null, description: data.description ?? null, date: data.date, valide: data.valide, valideParId: null, valideAt: null, justificatifUrl: null, createdAt: new Date() };
      return tx;
    },
    trouverParId: async () => tx,
    valider: async (id: string, valideParId: string) => {
      if (tx) { tx.valide = true; tx.valideParId = valideParId; tx.valideAt = new Date(); }
      return tx!;
    },
    listerTransactions: async () => (tx ? [tx] : []),
    attacherJustificatif: async () => tx!,
    obtenirSolde: async () => ({ totalCollectes: 0, totalDepenses: 0, depensesEnAttente: 0 }),
  } as ApeeRepository;
}

function apeeValiderMock(overrides: Partial<{ creeParId: string; valide: boolean; justificatifUrl: string | null; type: string }> = {}) {
  const tx: ApeeTransactionData = {
    id: 'tx1', schoolId: 'school-1', creeParId: 'user-crea', type: 'DEPENSE', montant: 1000, categorie: null, description: null, date: new Date(), valide: false, valideParId: null, valideAt: null, justificatifUrl: 'http://justif.pdf', createdAt: new Date(),
    ...overrides,
  };
  return {
    creer: async () => tx,
    trouverParId: async () => tx,
    valider: async (id: string, valideParId: string) => ({ ...tx, valide: true, valideParId, valideAt: new Date() }),
    listerTransactions: async () => [tx],
    attacherJustificatif: async () => tx,
    obtenirSolde: async () => ({ totalCollectes: 0, totalDepenses: 0, depensesEnAttente: 0 }),
  } as ApeeRepository;
}

describe('APEE — CreerTransactionAPEEUseCase', () => {
  it('crée une collecte valide d emblée', async () => {
    const apeeRepo = apeeCreerMock();
    const useCase = new CreerTransactionAPEEUseCase(apeeRepo);
    const tx = await useCase.execute({ schoolId: 'school-1', creeParId: 'u1', type: 'COLLECTE', montant: 5000 });
    expect((tx as { valide: boolean }).valide).toBe(true);
  });
  it('crée une dépense non validée', async () => {
    const apeeRepo = apeeCreerMock();
    const useCase = new CreerTransactionAPEEUseCase(apeeRepo);
    const tx = await useCase.execute({ schoolId: 'school-1', creeParId: 'u1', type: 'DEPENSE', montant: 2000 });
    expect((tx as { valide: boolean }).valide).toBe(false);
  });
  it('rejette un montant non positif', async () => {
    const apeeRepo = apeeCreerMock();
    const useCase = new CreerTransactionAPEEUseCase(apeeRepo);
    await expect(useCase.execute({ schoolId: 'school-1', creeParId: 'u1', type: 'DEPENSE', montant: 0 })).rejects.toThrow('strictement positif');
  });
});

describe('APEE — ValiderDepenseAPEEUseCase (4 yeux + justificatif)', () => {
  it('valide une dépense avec justificatif par un autre utilisateur', async () => {
    const apeeRepo = apeeValiderMock({ creeParId: 'user-crea', justificatifUrl: 'http://justif.pdf' });
    const useCase = new ValiderDepenseAPEEUseCase(apeeRepo);
    const result = await useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' });
    expect((result as { valide: boolean }).valide).toBe(true);
  });
  it('rejette si le créateur tente de valider lui-même (4 yeux)', async () => {
    const apeeRepo = apeeValiderMock({ creeParId: 'user-1', justificatifUrl: 'http://justif.pdf' });
    const useCase = new ValiderDepenseAPEEUseCase(apeeRepo);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-1' })).rejects.toThrow('4 yeux');
  });
  it('rejette si aucun justificatif joint', async () => {
    const apeeRepo = apeeValiderMock({ creeParId: 'user-crea', justificatifUrl: null });
    const useCase = new ValiderDepenseAPEEUseCase(apeeRepo);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' })).rejects.toThrow('aucun justificatif');
  });
  it('rejette une dépense déjà validée', async () => {
    const apeeRepo = apeeValiderMock({ creeParId: 'user-crea', valide: true, justificatifUrl: 'http://justif.pdf' });
    const useCase = new ValiderDepenseAPEEUseCase(apeeRepo);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' })).rejects.toThrow('déjà validée');
  });
  it('rejette une collecte (pas besoin de validation)', async () => {
    const apeeRepo = apeeValiderMock({ creeParId: 'user-crea', type: 'COLLECTE', justificatifUrl: null });
    const useCase = new ValiderDepenseAPEEUseCase(apeeRepo);
    await expect(useCase.execute({ schoolId: 'school-1', transactionId: 'tx1', valideParId: 'user-valideur' })).rejects.toThrow('Seule une dépense');
  });
});
