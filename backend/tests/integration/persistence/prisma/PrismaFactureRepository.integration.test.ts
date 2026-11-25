/**
 * Tests d'intégration — PrismaFactureRepository
 * Prérequis : bun test --env-file .env.test
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { PrismaFactureRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaFactureRepository.ts';
import { Facture } from '@domain/entities/Facture';

const repo = new PrismaFactureRepository(prismaTest);

let schoolId: string;
let studentId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'facture');
  schoolId = school.id;
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'eleve' });
  studentId = student.id;
});

afterEach(async () => {
  await prismaTest.payment.deleteMany({ where: { schoolId } });
  await prismaTest.invoice.deleteMany({ where: { schoolId } });
});

afterAll(async () => {
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaFactureRepository — intégration', () => {
  describe('save() + findById()', () => {
    it('devrait persister une facture et la retrouver intacte', async () => {
      const facture = Facture.create({
        schoolId,
        studentId,
        amount: 15000,
        currency: 'XAF',
        description: 'Frais de scolarité T1',
      });

      await repo.save(facture);
      const trouvee = await repo.findById(facture.id);

      expect(trouvee).not.toBeNull();
      expect(trouvee!.id).toBe(facture.id);
      expect(trouvee!.amount).toBe(15000);
      expect(trouvee!.status).toBe('PENDING');
      expect(trouvee!.schoolId).toBe(schoolId);
      expect(trouvee!.studentId).toBe(studentId);
    });

    it('devrait retourner null pour un id inexistant', async () => {
      const result = await repo.findById('id-inexistant-xxx');
      expect(result).toBeNull();
    });
  });

  describe('findByStatut()', () => {
    it('devrait filtrer les factures par statut SQL', async () => {
      const f1 = Facture.reconstituer({ id: crypto.randomUUID(), schoolId, studentId, amount: 5000, currency: 'XAF', status: 'PENDING', createdAt: new Date() });
      const f2 = Facture.reconstituer({ id: crypto.randomUUID(), schoolId, studentId, amount: 5000, currency: 'XAF', status: 'PAID', createdAt: new Date() });
      const f3 = Facture.reconstituer({ id: crypto.randomUUID(), schoolId, studentId, amount: 5000, currency: 'XAF', status: 'PENDING', createdAt: new Date() });

      await repo.save(f1);
      await repo.save(f2);
      await repo.save(f3);

      const pending = await repo.findByStatut(schoolId, 'PENDING');
      const paid = await repo.findByStatut(schoolId, 'PAID');

      expect(pending).toHaveLength(2);
      expect(paid).toHaveLength(1);
    });
  });

  describe('calculerTotalPayeAvecSucces() — fix du bug', () => {
    it('ne doit comptabiliser QUE les paiements SUCCESS (pas PENDING ni FAILED)', async () => {
      const facture = Facture.create({ schoolId, studentId, amount: 10000 });
      await repo.save(facture);

      // Paiement SUCCESS = 3 000 XAF
      await prismaTest.payment.create({
        data: { schoolId, studentId, invoiceId: facture.id, amount: 3000, status: 'SUCCESS' },
      });
      // Paiement PENDING = 5 000 XAF → ne doit pas compter
      await prismaTest.payment.create({
        data: { schoolId, studentId, invoiceId: facture.id, amount: 5000, status: 'PENDING' },
      });
      // Paiement FAILED = 2 000 XAF → ne doit pas compter
      await prismaTest.payment.create({
        data: { schoolId, studentId, invoiceId: facture.id, amount: 2000, status: 'FAILED' },
      });

      const totalPaye = await repo.calculerTotalPayeAvecSucces(facture.id);

      expect(totalPaye).toBe(3000); // pas 10 000
    });

    it('devrait retourner 0 si aucun paiement SUCCESS', async () => {
      const facture = Facture.create({ schoolId, studentId, amount: 8000 });
      await repo.save(facture);

      await prismaTest.payment.create({
        data: { schoolId, studentId, invoiceId: facture.id, amount: 4000, status: 'PENDING' },
      });

      const total = await repo.calculerTotalPayeAvecSucces(facture.id);
      expect(total).toBe(0);
    });
  });

  describe('aFactureImpayeeBloquante()', () => {
    it('devrait retourner true si élève a une facture PENDING', async () => {
      const facture = Facture.create({ schoolId, studentId, amount: 5000 });
      await repo.save(facture);

      const bloquant = await repo.aFactureImpayeeBloquante(studentId);
      expect(bloquant).toBe(true);
    });

    it('devrait retourner false si toutes les factures sont PAID', async () => {
      const facture = Facture.reconstituer({
        id: crypto.randomUUID(), schoolId, studentId,
        amount: 5000, currency: 'XAF', status: 'PAID', createdAt: new Date(),
      });
      await repo.save(facture);

      const bloquant = await repo.aFactureImpayeeBloquante(studentId);
      expect(bloquant).toBe(false);
    });
  });

  describe('update()', () => {
    it('devrait mettre à jour le statut en base', async () => {
      const facture = Facture.create({ schoolId, studentId, amount: 7500 });
      await repo.save(facture);

      facture.mettreAJourStatut(7500); // → PAID
      await repo.update(facture);

      const maj = await repo.findById(facture.id);
      expect(maj!.status).toBe('PAID');
    });
  });
});
