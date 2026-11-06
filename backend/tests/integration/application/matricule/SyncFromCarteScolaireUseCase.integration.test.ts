/**
 * Test d'intégration — SyncFromCarteScolaireUseCase, touché par le retrait du cast
 * `(this.prisma as any)` sur le champ enum `PaiementMinesec.operateur`. Vérifie sur la vraie
 * base de test que l'écriture Prisma fonctionne toujours une fois le cast remplacé par un
 * typage `OperateurMinesec` précis.
 *
 * Le port CarteScolaireService dépend d'un scraping HTTP réel vers cartescolaire.cm (non
 * déterministe, non maîtrisable en test) — la couche contrôleur/routes ne fait qu'un
 * pass-through sans logique propre (schoolId du JWT, body → execute()), donc ce test
 * instancie directement le use case avec un faux adaptateur, contre la vraie base Prisma,
 * ce qui exerce réellement l'écriture concernée par le correctif.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SyncFromCarteScolaireUseCase } from '../../../../src/application/matricule/SyncFromCarteScolaireUseCase.ts';
import type { CarteScolaireService, CarteScolairePaymentStatus } from '@domain/ports/services/CarteScolaireService';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { PrismaMatriculeImportRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaMatriculeImportRepository.ts';
import { PrismaPaiementMinesecRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaPaiementMinesecRepository.ts';

const ANNEE_SCOLAIRE = '2025-2026';

type FakeReponse = Omit<CarteScolairePaymentStatus, 'matricule' | 'anneeScolaire'>;

class FakeCarteScolaireService implements CarteScolaireService {
  constructor(private readonly reponses: Record<string, FakeReponse>) {}
  async rechercherMatricule(): Promise<never> { throw new Error('non utilisé par ce test'); }
  async checkPaiementStatus(matricule: string, anneeScolaire: string): Promise<CarteScolairePaymentStatus> {
    const reponse = this.reponses[matricule] ?? { paye: false, verified: false };
    return { matricule, anneeScolaire, ...reponse };
  }
}

let schoolId: string;
let studentPayeUserId: string;
let studentPayeProfileId: string;
let studentImpayeUserId: string;
let studentImpayeProfileId: string;
let studentEchecUserId: string;
let studentEchecProfileId: string;
let paiementPayeId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'syncCarteScolaire');
  schoolId = school.id;

  const studentPaye = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'sync-paye' });
  studentPayeUserId = studentPaye.id;
  const profilePaye = await prismaTest.studentProfile.create({ data: { userId: studentPaye.id, schoolId, matricule: 'SYNC-PAYE-001', studentStatus: 'ACTIVE' } });
  studentPayeProfileId = profilePaye.id;

  const studentImpaye = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'sync-impaye' });
  studentImpayeUserId = studentImpaye.id;
  const profileImpaye = await prismaTest.studentProfile.create({ data: { userId: studentImpaye.id, schoolId, matricule: 'SYNC-IMPAYE-002', studentStatus: 'ACTIVE' } });
  studentImpayeProfileId = profileImpaye.id;

  const studentEchec = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'sync-echec' });
  studentEchecUserId = studentEchec.id;
  const profileEchec = await prismaTest.studentProfile.create({ data: { userId: studentEchec.id, schoolId, matricule: 'SYNC-ECHEC-003', studentStatus: 'ACTIVE' } });
  studentEchecProfileId = profileEchec.id;

  const enrollmentPaye = await prismaTest.inscriptionMinesec.create({
    data: { studentId: profilePaye.id, schoolId, anneeScolaire: ANNEE_SCOLAIRE, classe: '3ème', status: 'ACTIVE' },
  });
  const enrollmentImpaye = await prismaTest.inscriptionMinesec.create({
    data: { studentId: profileImpaye.id, schoolId, anneeScolaire: ANNEE_SCOLAIRE, classe: '3ème', status: 'ACTIVE' },
  });
  const enrollmentEchec = await prismaTest.inscriptionMinesec.create({
    data: { studentId: profileEchec.id, schoolId, anneeScolaire: ANNEE_SCOLAIRE, classe: '3ème', status: 'ACTIVE' },
  });

  const paiementPaye = await prismaTest.paiementMinesec.create({
    data: {
      studentId: profilePaye.id, enrollmentId: enrollmentPaye.id, schoolId, anneeScolaire: ANNEE_SCOLAIRE,
      typeFrais: 'SCOLARITE_PREMIER_CYCLE', montantAttendu: 15000, status: 'IMPAYE',
    },
  });
  paiementPayeId = paiementPaye.id;

  await prismaTest.paiementMinesec.create({
    data: {
      studentId: profileImpaye.id, enrollmentId: enrollmentImpaye.id, schoolId, anneeScolaire: ANNEE_SCOLAIRE,
      typeFrais: 'SCOLARITE_PREMIER_CYCLE', montantAttendu: 15000, status: 'IMPAYE',
    },
  });

  await prismaTest.paiementMinesec.create({
    data: {
      studentId: profileEchec.id, enrollmentId: enrollmentEchec.id, schoolId, anneeScolaire: ANNEE_SCOLAIRE,
      typeFrais: 'SCOLARITE_PREMIER_CYCLE', montantAttendu: 15000, status: 'IMPAYE',
    },
  });
});

afterAll(async () => {
  await prismaTest.paiementMinesec.deleteMany({ where: { schoolId } });
  await prismaTest.inscriptionMinesec.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { userId: { in: [studentPayeUserId, studentImpayeUserId, studentEchecUserId] } } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('SyncFromCarteScolaireUseCase — écriture PaiementMinesec.operateur (enum) sans cast', () => {
  it('marque VERIFIE avec operateur MTN_MOMO un paiement confirmé payé, laisse les autres cas intacts', async () => {
    const fakeService = new FakeCarteScolaireService({
      'SYNC-PAYE-001': { paye: true, verified: true, montant: 15000, datePaiement: new Date('2026-01-15'), operateur: 'MTN_MOMO' },
      'SYNC-IMPAYE-002': { paye: false, verified: true },
      'SYNC-ECHEC-003': { paye: false, verified: false },
    });
    const useCase = new SyncFromCarteScolaireUseCase(
    new PrismaMatriculeImportRepository(prismaTest),
    new PrismaPaiementMinesecRepository(prismaTest),
    fakeService,
  );

    const report = await useCase.execute(schoolId, ANNEE_SCOLAIRE);

    expect(report.errors).toEqual([]);
    expect(report.nouveauxPaiements).toBe(1);
    expect(report.elevesImpayes).toBe(1);
    expect(report.verificationEchouee).toBe(1);

    const paiement = await prismaTest.paiementMinesec.findUnique({ where: { id: paiementPayeId } });
    expect(paiement?.status).toBe('VERIFIE');
    expect(paiement?.operateur).toBe('MTN_MOMO');
    expect(paiement?.montantPaye).toBe(15000);
    expect(paiement?.recuVerifie).toBe(true);
  });
});
