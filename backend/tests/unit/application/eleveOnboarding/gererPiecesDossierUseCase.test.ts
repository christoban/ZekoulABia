import { describe, it, expect } from 'bun:test';
import {
  GererPiecesDossierUseCase,
  type InitialiserPiecesCommande,
  type MarquerPieceCommande,
} from '@application/eleveOnboarding/GererPiecesDossierUseCase';
import type {
  EleveOnboardingRepository,
  OnboardingRecord,
  DocumentRequirementRecord,
  DocumentRecord,
} from '@domain/ports/repositories/EleveOnboardingRepository';

describe('GererPiecesDossierUseCase (Étape 2.3b)', () => {
  const schoolId = 'school-123';
  const onboardingId = 'ob-123';

  const baseOnboarding: OnboardingRecord = {
    id: onboardingId,
    schoolId,
    nomProvisoire: 'Mbappe Kylian',
    classId: 'class-6e',
    recipientType: 'ELEVE',
    sourceType: 'AUTOSERVICE',
    status: 'DRAFT',
    token: 'tok-123',
    tokenExpiresAt: new Date(Date.now() + 86400000),
    contactEmail: 'kylian@paris.com',
    contactTelephone: '+237699000000',
    parentContactEmail: null,
    parentContactTelephone: null,
    examCandidateId: null,
    eleveADispositif: true,
    eleveDispositifOS: 'ANDROID',
    parentADispositif: null,
    parentDispositifOS: null,
    tokenUsedAt: null,
    matchScore: null,
    matchedStudentId: null,
    submittedData: null,
  };

  const defaultRequirements: DocumentRequirementRecord[] = [
    { id: 'req-1', schoolId, code: 'ACTE_NAISSANCE', libelle: 'Acte de naissance', obligatoire: true, applicableCase: 'TOUS' },
    { id: 'req-2', schoolId, code: 'BULLETIN_N_MOINS_1', libelle: 'Dernier bulletin scolaire', obligatoire: true, applicableCase: 'TOUS' },
    { id: 'req-3', schoolId, code: 'PHOTO_4X4', libelle: '2 photos 4x4', obligatoire: true, applicableCase: 'TOUS' },
    { id: 'req-4', schoolId, code: 'CERTIFICAT_MEDICAL', libelle: 'Certificat médical', obligatoire: false, applicableCase: 'TOUS' },
    { id: 'req-5', schoolId, code: 'CERTIFICAT_TRANSFERT', libelle: 'Certificat de transfert', obligatoire: true, applicableCase: 'TRANSFERT' },
  ];

  it('devrait initialiser les pièces selon le cas applicable (TOUS + cas spécifique) sans doublon', async () => {
    let storedDocuments: DocumentRecord[] = [];
    let updatedScore = 0;
    let updatedValidable = false;

    const mockRepo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async (id, sid) => (id === onboardingId && sid === schoolId ? baseOnboarding : null),
      listDocumentRequirements: async () => defaultRequirements,
      listDocuments: async () => storedDocuments,
      initialiserDocuments: async (obId, reqs) => {
        const newDocs: DocumentRecord[] = reqs.map((r, i) => ({
          id: `doc-${i + 1}`,
          onboardingId: obId,
          requirementId: r.id,
          code: r.code,
          libelle: r.libelle,
          received: false,
          receivedAt: null,
          receivedById: null,
          note: null,
          fileKey: null,
        }));
        storedDocuments = [...storedDocuments, ...newDocs];
        return newDocs;
      },
      updateCompletenessScore: async (id, score, validable) => {
        updatedScore = score;
        updatedValidable = validable;
      },
    };

    const useCase = new GererPiecesDossierUseCase(mockRepo as EleveOnboardingRepository);

    // Initialiser pour un cas NOUVEAU (ne doit pas inclure CERTIFICAT_TRANSFERT)
    const result = await useCase.initialiserPieces({
      schoolId,
      onboardingId,
      sourceType: 'NOUVEAU',
    });

    expect(result.documents.length).toBe(4); // ACTE, BULLETIN, PHOTO, MEDICAL
    expect(result.totalObligatoires).toBe(3);
    expect(result.recuesObligatoires).toBe(0);
    expect(result.totalFacultatives).toBe(1);
    expect(result.score).toBe(0);
    expect(result.validableSousReserve).toBe(false);
    expect(updatedScore).toBe(0);
    expect(updatedValidable).toBe(false);

    // Ré-initialisation (idempotence)
    const result2 = await useCase.initialiserPieces({
      schoolId,
      onboardingId,
      sourceType: 'NOUVEAU',
    });
    expect(result2.documents.length).toBe(4);
  });

  it('devrait marquer une pièce reçue et calculer le score et validableSousReserve (>= 70%)', async () => {
    let storedDocuments: DocumentRecord[] = [
      { id: 'doc-1', onboardingId, requirementId: 'req-1', code: 'ACTE_NAISSANCE', libelle: 'Acte', received: false, receivedAt: null, receivedById: null, note: null, fileKey: null },
      { id: 'doc-2', onboardingId, requirementId: 'req-2', code: 'BULLETIN_N_MOINS_1', libelle: 'Bulletin', received: false, receivedAt: null, receivedById: null, note: null, fileKey: null },
      { id: 'doc-3', onboardingId, requirementId: 'req-3', code: 'PHOTO_4X4', libelle: 'Photo', received: false, receivedAt: null, receivedById: null, note: null, fileKey: null },
    ];
    let scorePersiste = 0;
    let reservePersiste = false;

    const mockRepo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async () => baseOnboarding,
      listDocumentRequirements: async () => defaultRequirements.filter(r => ['ACTE_NAISSANCE', 'BULLETIN_N_MOINS_1', 'PHOTO_4X4'].includes(r.code)),
      listDocuments: async () => storedDocuments,
      marquerDocumentRecu: async (obId, code, data) => {
        let updated: DocumentRecord = null as any;
        storedDocuments = storedDocuments.map(d => {
          if (d.code === code) {
            updated = { ...d, received: data.received, receivedById: data.receivedById };
            return updated;
          }
          return d;
        });
        return updated;
      },
      updateCompletenessScore: async (obId, score, validable) => {
        scorePersiste = score;
        reservePersiste = validable;
      },
    };

    const useCase = new GererPiecesDossierUseCase(mockRepo as EleveOnboardingRepository);

    // 1 pièce reçue sur 3 = 33% -> pas validable sous réserve
    const res1 = await useCase.marquerPiece({
      schoolId,
      onboardingId,
      code: 'ACTE_NAISSANCE',
      received: true,
      receivedById: 'staff-1',
    });
    expect(res1.score).toBe(33);
    expect(res1.validableSousReserve).toBe(false);

    // 2 pièces reçues sur 3 = 67% (arrondi) -> < 70%
    const res2 = await useCase.marquerPiece({
      schoolId,
      onboardingId,
      code: 'PHOTO_4X4',
      received: true,
      receivedById: 'staff-1',
    });
    expect(res2.score).toBe(67);
    expect(res2.validableSousReserve).toBe(false);

    // Avec 4 pièces obligatoires dont 3 reçues = 75% -> validableSousReserve = true
    // Simulons 4 obligations :
    const fourReqs: DocumentRequirementRecord[] = [
      { id: 'r1', schoolId, code: 'ACTE', libelle: 'Acte', obligatoire: true, applicableCase: 'TOUS' },
      { id: 'r2', schoolId, code: 'PHOTO', libelle: 'Photo', obligatoire: true, applicableCase: 'TOUS' },
      { id: 'r3', schoolId, code: 'BULLETIN', libelle: 'Bulletin', obligatoire: true, applicableCase: 'TOUS' },
      { id: 'r4', schoolId, code: 'CERTIF', libelle: 'Certif', obligatoire: true, applicableCase: 'TOUS' },
    ];
    let docs4: DocumentRecord[] = [
      { id: 'd1', onboardingId, requirementId: 'r1', code: 'ACTE', libelle: 'Acte', received: true, receivedAt: null, receivedById: null, note: null, fileKey: null },
      { id: 'd2', onboardingId, requirementId: 'r2', code: 'PHOTO', libelle: 'Photo', received: true, receivedAt: null, receivedById: null, note: null, fileKey: null },
      { id: 'd3', onboardingId, requirementId: 'r3', code: 'BULLETIN', libelle: 'Bulletin', received: true, receivedAt: null, receivedById: null, note: null, fileKey: null },
      { id: 'd4', onboardingId, requirementId: 'r4', code: 'CERTIF', libelle: 'Certif', received: false, receivedAt: null, receivedById: null, note: null, fileKey: null },
    ];
    const repo4: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async () => baseOnboarding,
      listDocumentRequirements: async () => fourReqs,
      listDocuments: async () => docs4,
      marquerDocumentRecu: async () => (docs4[0]),
      updateCompletenessScore: async (id, s, v) => {
        scorePersiste = s;
        reservePersiste = v;
      },
    };
    const useCase4 = new GererPiecesDossierUseCase(repo4 as EleveOnboardingRepository);
    const res4 = await useCase4.consulterCompletude(schoolId, onboardingId);
    expect(res4.score).toBe(75);
    expect(res4.validableSousReserve).toBe(true);

    // Si 100% reçues (4/4) -> validableSousReserve = false (car complet sans réserve)
    docs4 = docs4.map(d => ({ ...d, received: true }));
    const resAll = await useCase4.consulterCompletude(schoolId, onboardingId);
    expect(resAll.score).toBe(100);
    expect(resAll.validableSousReserve).toBe(false);
  });
});
