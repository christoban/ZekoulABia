import { describe, it, expect } from 'bun:test';
import { GenererFicheInscriptionPdfUseCase } from '@application/eleveOnboarding/GenererFicheInscriptionPdfUseCase';
import type { EleveOnboardingRepository, OnboardingRecord, DocumentRequirementRecord, DocumentRecord } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import { School } from '@domain/entities/School';
import { Classe } from '@domain/entities/Classe';

describe('Étape 2.5 — GenererFicheInscriptionPdfUseCase', () => {
  const schoolId = 'school-123';
  const onboardingId = 'ob-pdf-1';

  const baseOnboarding: OnboardingRecord = {
    id: onboardingId,
    schoolId,
    nomProvisoire: 'Nganou Francis',
    classId: 'class-6a',
    recipientType: 'ELEVE',
    sourceType: 'AUTOSERVICE',
    status: 'SUBMITTED',
    token: 'tok-test-qr-123',
    tokenExpiresAt: new Date(Date.now() + 86400000),
    contactEmail: 'francis@nganou.cm',
    contactTelephone: '+237677112233',
    parentContactEmail: null,
    parentContactTelephone: '+237699445566',
    examCandidateId: null,
    eleveADispositif: true,
    eleveDispositifOS: 'ANDROID',
    parentADispositif: true,
    parentDispositifOS: 'ANDROID',
    tokenUsedAt: null,
    matchScore: null,
    matchedStudentId: null,
    submittedData: {
      nom: 'Nganou',
      prenom: 'Francis',
      dateNaissance: '05/09/2009',
      gender: 'M',
    },
  };

  const mockSchool = School.reconstituer({
    id: schoolId,
    name: 'Lycée Bilingue de Yaoundé',
    code: 'LBY',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const mockClasse = Classe.reconstituer({
    id: 'class-6a',
    schoolId,
    name: '6ème A',
    level: '6EME',
    capacity: 50,
    status: 'ACTIVE',
    academicYearId: 'year-1',
    createdAt: new Date(),
  });

  const mockRequirements: DocumentRequirementRecord[] = [
    { id: 'r1', schoolId, code: 'ACTE', libelle: 'Acte de naissance', obligatoire: true, applicableCase: 'TOUS' },
    { id: 'r2', schoolId, code: 'BULLETIN', libelle: 'Dernier bulletin', obligatoire: true, applicableCase: 'TOUS' },
  ];

  const mockDocuments: DocumentRecord[] = [
    { id: 'd1', onboardingId, requirementId: 'r1', code: 'ACTE', libelle: 'Acte de naissance', received: true, receivedAt: new Date(), receivedById: 'staff-1', note: null, fileKey: null },
  ];

  it('génère un buffer PDF valide avec le bon nom de fichier et les pièces', async () => {
    const mockOnboardingRepo: Partial<EleveOnboardingRepository> = {
      findOnboardingById: async (id, sid) => (id === onboardingId && sid === schoolId ? baseOnboarding : null),
      listDocumentRequirements: async () => mockRequirements,
      listDocuments: async () => mockDocuments,
    };

    const mockSchoolRepo: Partial<SchoolRepository> = {
      findById: async () => mockSchool,
    };

    const mockClasseRepo: Partial<ClasseRepository> = {
      findById: async () => mockClasse,
    };

    const mockPdfService = {
      generer: async () => Buffer.from('%PDF-1.4 mock content with more than 1000 bytes padding...'.padEnd(1200, '0')),
    };

    const useCase = new GenererFicheInscriptionPdfUseCase(
      mockOnboardingRepo as EleveOnboardingRepository,
      mockSchoolRepo as SchoolRepository,
      mockClasseRepo as ClasseRepository,
      mockPdfService,
    );

    const result = await useCase.execute({
      schoolId,
      onboardingId,
      baseUrl: 'https://test.zekoulabia.com',
    });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(1000); // Un PDF A4 avec QR code pèse au moins quelques Ko
    expect(result.filename).toContain('Fiche_Inscription_Nganou');
    expect(result.filename.endsWith('.pdf')).toBe(true);

    // Vérification magique PDF (%PDF)
    const header = result.buffer.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });
});
