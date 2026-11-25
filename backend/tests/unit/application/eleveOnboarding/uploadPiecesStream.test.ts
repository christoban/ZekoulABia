import { describe, it, expect } from 'bun:test';
import { GererPiecesDossierUseCase } from '@application/eleveOnboarding/GererPiecesDossierUseCase';
import { EleveOnboardingDossierController } from '@infrastructure/http/controllers/EleveOnboardingDossierController';
import type {
  EleveOnboardingRepository,
  OnboardingRecord,
  DocumentRequirementRecord,
  DocumentRecord,
} from '@domain/ports/repositories/EleveOnboardingRepository';
import fs from 'fs';
import path from 'path';

describe('Numérisation et Streaming des Pièces Justificatives (Phase 5)', () => {
  const schoolId = 'school-offline-1';
  const onboardingId = 'ob-offline-1';

  const baseOnboarding: OnboardingRecord = {
    id: onboardingId,
    schoolId,
    nomProvisoire: 'Chantal Biya',
    classId: 'class-6e',
    recipientType: 'ELEVE',
    sourceType: 'AUTOSERVICE',
    status: 'DRAFT',
    token: 'tok-123',
    tokenExpiresAt: new Date(Date.now() + 86400000),
    contactEmail: null,
    contactTelephone: '+237699000000',
    parentContactEmail: null,
    parentContactTelephone: null,
    examCandidateId: null,
    eleveADispositif: false,
    eleveDispositifOS: null,
    parentADispositif: true,
    parentDispositifOS: 'ANDROID',
    tokenUsedAt: null,
    matchScore: null,
    matchedStudentId: null,
    submittedData: null,
  };

  const requirements: DocumentRequirementRecord[] = [
    { id: 'req-1', schoolId, code: 'ACTE_NAISSANCE', libelle: 'Acte de naissance', obligatoire: true, applicableCase: 'TOUS' },
    { id: 'req-2', schoolId, code: 'PHOTO_IDENTITE', libelle: 'Photo 4x4', obligatoire: true, applicableCase: 'TOUS' },
  ];

  it('enregistre le fileKey d\'une pièce scannée et augmente le score de complétude', async () => {
    let savedFileKey: string | null | undefined = null;
    let storedDocs: DocumentRecord[] = [
      { id: 'doc-1', onboardingId, requirementId: 'req-1', code: 'ACTE_NAISSANCE', libelle: 'Acte de naissance', received: false, receivedAt: null, receivedById: null, fileKey: null, note: null },
      { id: 'doc-2', onboardingId, requirementId: 'req-2', code: 'PHOTO_IDENTITE', libelle: 'Photo 4x4', received: false, receivedAt: null, receivedById: null, fileKey: null, note: null },
    ];

    const mockRepo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async (id, sid) => (id === onboardingId && sid === schoolId ? baseOnboarding : null),
      listDocumentRequirements: async () => requirements,
      listDocuments: async () => storedDocs,
      marquerDocumentRecu: async (_id, code, data) => {
        savedFileKey = data.fileKey;
        const doc = storedDocs.find(d => d.code === code);
        if (doc) {
          doc.received = data.received;
          doc.fileKey = data.fileKey ?? null;
        }
        return doc!;
      },
      updateCompletenessScore: async () => {},
    };

    const useCase = new GererPiecesDossierUseCase(mockRepo as EleveOnboardingRepository);
    const result = await useCase.marquerPiece({
      schoolId,
      onboardingId,
      code: 'ACTE_NAISSANCE',
      received: true,
      receivedById: 'user-sec-1',
      fileKey: '/storage/enrollment-pieces/school-offline-1/ob-offline-1/ACTE_NAISSANCE-12345.pdf',
    });

    expect(savedFileKey).toBe('/storage/enrollment-pieces/school-offline-1/ob-offline-1/ACTE_NAISSANCE-12345.pdf');
    expect(result.score).toBe(50); // 1 sur 2 obligatoires
    expect(result.recuesObligatoires).toBe(1);
  });

  it('le contrôleur rejette les types de fichiers non autorisés (sécurité)', async () => {
    const mockRepo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async () => baseOnboarding,
      listDocumentRequirements: async () => requirements,
      listDocuments: async () => [],
    };
    const useCase = new GererPiecesDossierUseCase(mockRepo as EleveOnboardingRepository);
    const controller = new EleveOnboardingDossierController(
      useCase,
      {} as any,
      {} as any,
      {} as any
    );

    let statusCalled = 0;
    let jsonCalled: any = null;

    const req: any = {
      user: { schoolId, userId: 'u1' },
      params: { id: onboardingId, code: 'ACTE_NAISSANCE' },
      file: {
        mimetype: 'application/x-msdownload', // .exe
        size: 1024,
        originalname: 'virus.exe',
        buffer: Buffer.from('test'),
      },
    };

    const res: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      },
    };

    await controller.uploadPiece(req, res, () => {});
    expect(statusCalled).toBe(400);
    expect(jsonCalled.message).toContain('Format non supporté');
  });

  it('le contrôleur rejette les fichiers excédant la limite de 5 Mo', async () => {
    const mockRepo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async () => baseOnboarding,
      listDocumentRequirements: async () => requirements,
      listDocuments: async () => [],
    };
    const useCase = new GererPiecesDossierUseCase(mockRepo as EleveOnboardingRepository);
    const controller = new EleveOnboardingDossierController(
      useCase,
      {} as any,
      {} as any,
      {} as any
    );

    let statusCalled = 0;
    let jsonCalled: any = null;

    const req: any = {
      user: { schoolId, userId: 'u1' },
      params: { id: onboardingId, code: 'ACTE_NAISSANCE' },
      file: {
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024, // 6 Mo
        originalname: 'grand_document.pdf',
        buffer: Buffer.alloc(10),
      },
    };

    const res: any = {
      status(code: number) {
        statusCalled = code;
        return this;
      },
      json(data: any) {
        jsonCalled = data;
      },
    };

    await controller.uploadPiece(req, res, () => {});
    expect(statusCalled).toBe(400);
    expect(jsonCalled.message).toContain('Fichier trop volumineux');
  });
});
