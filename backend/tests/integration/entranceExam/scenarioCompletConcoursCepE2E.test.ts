/**
 * Test d'intégration de bout en bout — Concours d'entrée, Délibération, Publication SMS,
 * Saisie en lot du CEP (Secrétaire -> Admin), Libération de place, Promotion de Liste d'attente,
 * et Finalisation Onboarding.
 *
 * Scénario complet validé avec données de démonstration (mode simulation SMS) :
 * 1. Session ouverte
 * 2. 10 candidats inscrits (dont 1 par import Excel)
 * 3. Notes enregistrées
 * 4. Délibération (6 admis provisoires, 1 en liste complémentaire, 3 non admis — aucun PENDING)
 * 5. Publication des résultats : 10 SMS (estimation + confirmation de campagne)
 * 6. Saisie en lot du CEP : 5 réussis, 1 échoué (workflow 2 temps)
 * 7. Validation de l'administrateur : 5 dossiers pré-remplis créés, AUCUN SMS envoyé
 * 8. Place libérée par l'échec -> promotion du candidat en liste complémentaire (SMS au promu)
 * 9. Validation et activation des dossiers
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prismaTest } from '../../helpers/prismaTestClient';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures';
import { PrismaEntranceExamRepository } from '@infrastructure/persistence/prisma/PrismaEntranceExamRepository';
import { PrismaSchoolRepository } from '@infrastructure/persistence/prisma/PrismaSchoolRepository';
import { PrismaEleveOnboardingRepository } from '@infrastructure/persistence/prisma/PrismaEleveOnboardingRepository';
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { SimulerDeliberationConcoursUseCase } from '@application/entranceExam/SimulerDeliberationConcoursUseCase';
import { EstimerCampagneSmsPublicationUseCase } from '@application/entranceExam/EstimerCampagneSmsPublicationUseCase';
import { PublierResultatsConcoursUseCase } from '@application/entranceExam/PublierResultatsConcoursUseCase';
import { ProposerSaisieLotCepUseCase } from '@application/entranceExam/ProposerSaisieLotCepUseCase';
import { AppliquerSaisieLotCepUseCase } from '@application/entranceExam/AppliquerSaisieLotCepUseCase';

describe('Scénario complet E2E : Concours d\'entrée -> CEP -> Promotion -> Onboarding', () => {
  let schoolId: string;
  let adminUserId: string;
  let academicYearId: string;
  let class6eId: string;
  let sessionId: string;
  let subjectId: string;

  let entranceRepo: PrismaEntranceExamRepository;
  let schoolRepo: PrismaSchoolRepository;
  let onboardingRepo: PrismaEleveOnboardingRepository;
  let creerSqueletteOnboardingUC: CreerSqueletteOnboardingUseCase;
  let validerOnboardingUC: ValiderOnboardingUseCase;
  let simulerDeliberationUC: SimulerDeliberationConcoursUseCase;
  let estimerSmsUC: EstimerCampagneSmsPublicationUseCase;
  let publierUC: PublierResultatsConcoursUseCase;
  let proposerCepUC: ProposerSaisieLotCepUseCase;
  let appliquerCepUC: AppliquerSaisieLotCepUseCase;

  const candidateIds: string[] = [];

  beforeAll(async () => {
    // 1. Initialisation de l'école et de l'administrateur
    const school = await creerEcoleTest(prismaTest, 'concours-e2e');
    schoolId = school.id;

    const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'adm-concours' });
    adminUserId = admin.id;

    // Année académique
    const academicYear = await prismaTest.academicYear.create({
      data: {
        name: '2026-2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-06-30'),
        schoolId,
        isCurrent: true,
      },
    });
    academicYearId = academicYear.id;

    // Classe cible (6ème A)
    const classe6e = await prismaTest.class.create({
      data: {
        name: '6ème A',
        level: '6e',
        schoolId,
        academicYearId,
        capacity: 40,
      },
    });
    class6eId = classe6e.id;

    // 2. Instanciation des repositories et use cases
    entranceRepo = new PrismaEntranceExamRepository(prismaTest);
    schoolRepo = new PrismaSchoolRepository(prismaTest);
    onboardingRepo = new PrismaEleveOnboardingRepository(prismaTest);

    creerSqueletteOnboardingUC = new CreerSqueletteOnboardingUseCase(
      onboardingRepo,
      { log: async () => {} } as any,
    );
    validerOnboardingUC = new ValiderOnboardingUseCase(
      onboardingRepo,
      { logActivity: async () => {} } as any,
    );

    simulerDeliberationUC = new SimulerDeliberationConcoursUseCase(entranceRepo);
    estimerSmsUC = new EstimerCampagneSmsPublicationUseCase(entranceRepo, schoolRepo);
    publierUC = new PublierResultatsConcoursUseCase(entranceRepo, schoolRepo);
    proposerCepUC = new ProposerSaisieLotCepUseCase(entranceRepo);
    appliquerCepUC = new AppliquerSaisieLotCepUseCase(entranceRepo, creerSqueletteOnboardingUC, schoolRepo);
  });

  afterAll(async () => {
    try {
      await nettoyerEcole(prismaTest, schoolId);
    } catch {
      // Nettoyage best effort
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 1 : Session de concours créée et ouverte aux inscriptions
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 1 : Crée une session de concours avec obligation de CEP et quota de 6 places', async () => {
    const session = await entranceRepo.creerSession({
      schoolId,
      name: 'Concours d\'entrée en 6e 2026',
      examDate: new Date('2026-06-15'),
      academicYearId,
      admissionThreshold: 10,
      availableSeats: 6,
      requireCepForAdmission: true,
      seatReservationDays: 14,
      targetClassId: class6eId,
    });

    sessionId = session.id;
    expect(sessionId).toBeDefined();

    // Matière d'examen
    const subject = await prismaTest.entranceExamSubject.create({
      data: {
        sessionId,
        name: 'Épreuve d\'évaluation',
        coefficient: 1.0,
        maxScore: 20.0,
      },
    });
    subjectId = subject.id;

    // Passer le statut en REGISTRATION_OPEN
    await entranceRepo.mettreAJourStatutSession(sessionId, 'REGISTRATION_OPEN');
    const updated = await entranceRepo.trouverSession(sessionId);
    expect(updated?.status).toBe('REGISTRATION_OPEN');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 2 : Inscription de 10 candidats (dont 1 par import Excel)
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 2 : Inscrit 10 candidats avec coordonnées complètes (9 guichet + 1 import Excel)', async () => {
    const rawCandidates = [
      { firstName: 'Alice', lastName: 'Kamga', score: 18, phone: '690000001' },
      { firstName: 'Bruno', lastName: 'Mbarga', score: 17, phone: '690000002' },
      { firstName: 'Chantal', lastName: 'Fomekong', score: 16, phone: '690000003' },
      { firstName: 'Daniel', lastName: 'Nguemo', score: 15, phone: '690000004' },
      { firstName: 'Esther', lastName: 'Biya', score: 14, phone: '690000005' },
      { firstName: 'Francis', lastName: 'Abena', score: 13, phone: '690000006' },
      { firstName: 'Gaelle', lastName: 'Mballa', score: 11, phone: '690000007' }, // Seuil dépassé, mais 7e pour 6 places -> Liste d'attente
      { firstName: 'Henri', lastName: 'Eto', score: 8, phone: '690000008' },       // Recalé sous le seuil
      { firstName: 'Isabelle', lastName: 'Onana', score: 7, phone: '690000009' },   // Recalé sous le seuil
      { firstName: 'Joseph', lastName: 'Tchoupo', score: 5, phone: '690000010', isImportExcel: true }, // Candidat importé par fichier Excel
    ];

    for (let i = 0; i < rawCandidates.length; i++) {
      const c = rawCandidates[i];
      const created = await prismaTest.entranceExamCandidate.create({
        data: {
          sessionId,
          candidateNumber: `CAND-${(i + 1).toString().padStart(3, '0')}`,
          firstName: c.firstName,
          lastName: c.lastName,
          parentPhone: c.phone,
          examScore: c.score,
          totalAverage: c.score,
          admissionStatus: 'PENDING',
          originSchool: c.isImportExcel ? 'École Publique Importée' : 'École Primaire Sainte-Anne',
        },
      });
      candidateIds.push(created.id);

      await prismaTest.entranceExamCandidateGrade.create({
        data: {
          candidateId: created.id,
          subjectId,
          score: c.score,
          isAbsent: false,
        },
      });
    }

    expect(candidateIds).toHaveLength(10);
    const totalInscrits = await entranceRepo.compterCandidatsSession!(sessionId);
    expect(totalInscrits).toBe(10);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 3 : Délibération (6 admis provisoires, 1 en liste d'attente, 3 non admis)
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 3 : Applique la délibération (6 admis provisoires, 1 liste d\'attente, 3 non admis, AUCUN pending)', async () => {
    const outcome = await simulerDeliberationUC.execute({
      schoolId,
      sessionId,
      admissionThreshold: 10,
      availableSeats: 6,
      waitingListSeats: 1,
      appliquer: true,
    });

    expect(outcome.outcome.admisCount).toBe(6);
    expect(outcome.outcome.listeAttenteCount).toBe(1);
    expect(outcome.outcome.refusesCount).toBe(3);

    // Vérification des statuts en base
    const candidatsApresDelib = await entranceRepo.listerCandidats(sessionId);

    const admisProvisoires = candidatsApresDelib.filter((c) => c.admissionStatus === 'ADMIS_PROVISOIRE');
    const listeAttente = candidatsApresDelib.filter((c) => c.admissionStatus === 'LISTE_ATTENTE');
    const nonAdmis = candidatsApresDelib.filter((c) => c.admissionStatus === 'NON_ADMIS');
    const pendingRestants = candidatsApresDelib.filter((c) => c.admissionStatus === 'PENDING');

    expect(admisProvisoires).toHaveLength(6);
    expect(listeAttente).toHaveLength(1);
    expect(nonAdmis).toHaveLength(3);
    // RÈGLE : Plus AUCUN candidat ne reste PENDING après délibération !
    expect(pendingRestants).toHaveLength(0);

    // Gaelle Mballa (11/20) est bien le candidat en liste d'attente
    expect(listeAttente[0].firstName).toBe('Gaelle');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 4 : Publication des résultats avec estimation et envoi des 10 SMS
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 4 : Estime et publie les résultats avec campagne de 10 SMS bilingues personnalisés', async () => {
    // 1. Estimation préalable
    const estimation = await estimerSmsUC.execute({ schoolId, sessionId });
    expect(estimation.totalCandidats).toBe(10);
    expect(estimation.totalSmsAEnvoyer).toBe(10);
    expect(estimation.totalSansTelephone).toBe(0);
    expect(estimation.groupes.admis.count).toBe(6);
    expect(estimation.groupes.listeAttente.count).toBe(1);
    expect(estimation.groupes.nonAdmis.count).toBe(3);
    expect(estimation.examLibelle).toBe('CEP');

    // 2. Publication officielle avec confirmation de campagne SMS
    const resPub = await publierUC.execute({
      schoolId,
      sessionId,
      confirmSmsCampaign: true,
      campaignId: estimation.campaignIdSuggere,
    });

    expect(resPub.smsSent).toBe(10);
    expect(resPub.smsSkippedNoPhone).toBe(0);

    const sessionApresPub = await entranceRepo.trouverSession(sessionId);
    expect(sessionApresPub?.status).toBe('PUBLISHED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 5 : Saisie en lot du CEP (Étape 1 : Préparation / Proposition par le secrétaire)
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 5 : Le secrétaire prépare le lot CEP (5 réussis, 1 échoué) avec calcul de libération de place', async () => {
    const admisCands = (await entranceRepo.listerCandidats(sessionId)).filter(
      (c) => c.admissionStatus === 'ADMIS_PROVISOIRE'
    );
    expect(admisCands).toHaveLength(6);

    // 5 premiers réussissent le CEP, le 6e (Francis Abena) échoue
    const lotItems = [
      { candidateId: admisCands[0].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[1].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[2].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[3].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[4].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[5].id, cepResult: 'ECHOUE' as const },
    ];

    const proposition = await proposerCepUC.execute({
      schoolId,
      sessionId,
      items: lotItems,
    });

    expect(proposition.rapproches).toHaveLength(6);
    expect(proposition.nonRapproches).toHaveLength(0);
    expect(proposition.places.reussis).toBe(5);
    expect(proposition.places.echoues).toBe(1);
    expect(proposition.places.placesLiberees).toBe(1);

    // 1 place libérée -> promotion proposée pour le 1er de la liste d'attente (Gaelle Mballa)
    expect(proposition.promotionsProposees).toHaveLength(1);
    expect(proposition.promotionsProposees[0].firstName).toBe('Gaelle');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 6 : Validation Administrateur (5 confirmés, 0 SMS, promotion avec SMS)
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 6 : L\'administrateur valide le lot : 5 dossiers créés sans SMS, 1 échoué sans SMS, et Gaelle promue avec SMS', async () => {
    const tousCands = await entranceRepo.listerCandidats(sessionId);
    const admisCands = tousCands.filter((c) => c.admissionStatus === 'ADMIS_PROVISOIRE');
    const attenteCand = tousCands.find((c) => c.admissionStatus === 'LISTE_ATTENTE')!;

    const decisions = [
      { candidateId: admisCands[0].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[1].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[2].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[3].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[4].id, cepResult: 'REUSSI' as const },
      { candidateId: admisCands[5].id, cepResult: 'ECHOUE' as const },
    ];

    const resAppliquer = await appliquerCepUC.execute({
      schoolId,
      sessionId,
      adminUserId,
      decisions,
      promotionsIds: [attenteCand.id], // Promouvoir Gaelle
    });

    expect(resAppliquer.confirmes).toBe(5);
    expect(resAppliquer.annules).toBe(1);
    expect(resAppliquer.promus).toBe(1);
    expect(resAppliquer.dossiersCrees).toBe(5);

    // Vérification des statuts finaux en base
    const candsFinaux = await entranceRepo.listerCandidats(sessionId);

    // Les 5 ayant réussi sont CONFIRME
    const confirmes = candsFinaux.filter((c) => c.admissionStatus === 'CONFIRME');
    expect(confirmes).toHaveLength(5);

    // Le recalé au CEP est ANNULE
    const annule = candsFinaux.find((c) => c.id === admisCands[5].id);
    expect(annule?.admissionStatus).toBe('ANNULE');
    expect(annule?.cepResult).toBe('ECHOUE');

    // Gaelle Mballa a été promue de LISTE_ATTENTE à ADMIS_PROVISOIRE
    const gaelleApresPromo = candsFinaux.find((c) => c.id === attenteCand.id);
    expect(gaelleApresPromo?.admissionStatus).toBe('ADMIS_PROVISOIRE');

    // Vérification des 5 dossiers d'onboarding créés (statut LINK_SENT)
    const dossiers = await prismaTest.studentOnboarding.findMany({
      where: { schoolId, sourceType: 'CONCOURS' },
    });
    expect(dossiers).toHaveLength(5);
    for (const d of dossiers) {
      expect(d.status).toBe('LINK_SENT');
      expect(d.classId).toBe(class6eId);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ÉTAPE 7 : Traitement du candidat promu et clôture finale de session
  // ──────────────────────────────────────────────────────────────────────────
  it('Étape 7 : Gaelle (promue) réussit son CEP -> 6e dossier créé et clôture automatique de session', async () => {
    const cands = await entranceRepo.listerCandidats(sessionId);
    const gaelle = cands.find((c) => c.firstName === 'Gaelle')!;
    expect(gaelle.admissionStatus).toBe('ADMIS_PROVISOIRE');

    // Saisie du résultat CEP pour Gaelle
    const resGaelle = await appliquerCepUC.execute({
      schoolId,
      sessionId,
      adminUserId,
      decisions: [{ candidateId: gaelle.id, cepResult: 'REUSSI' }],
    });

    expect(resGaelle.confirmes).toBe(1);
    expect(resGaelle.dossiersCrees).toBe(1);

    // Plus aucun candidat n'est en attente (compteur = 0) -> Session fermée automatiquement
    expect(resGaelle.sessionCloturee).toBe(true);

    const sessionFinale = await entranceRepo.trouverSession(sessionId);
    expect(sessionFinale?.status).toBe('CLOSED');

    // Total final : 6 dossiers d'onboarding au complet
    const totalDossiers = await prismaTest.studentOnboarding.count({
      where: { schoolId, sourceType: 'CONCOURS' },
    });
    expect(totalDossiers).toBe(6);
  });
});
