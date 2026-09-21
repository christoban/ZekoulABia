/**
 * Tests de caractérisation — ScannerListeCandidatsUseCase
 */
import { describe, it, expect } from 'bun:test';
import { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import type { EntranceExamRepository, EntranceSessionData } from '@domain/ports/repositories/EntranceExamRepository';
import type { DocumentAiPort, DocumentAiResultat } from '@domain/ports/services/DocumentAiPort';

const SCHOOL_ID = 'school-1';
const SESSION_ID = 'session-1';

function makeSession(overrides: Partial<EntranceSessionData> = {}): EntranceSessionData {
  return {
    id: SESSION_ID,
    schoolId: SCHOOL_ID,
    name: 'Concours 6e 2026',
    examDate: new Date('2026-06-01'),
    academicYearId: 'year-1',
    admissionThreshold: 10,
    availableSeats: null,
    status: 'RESULTS_PENDING',
    targetClassId: null,
    ...overrides,
  };
}

describe('ScannerListeCandidatsUseCase', () => {
  it('rejette si la session de concours est introuvable', async () => {
    const entranceRepo = {
      trouverSession: async () => null,
    } as unknown as EntranceExamRepository;

    const useCase = new ScannerListeCandidatsUseCase(entranceRepo, {} as DocumentAiPort);

    expect(
      useCase.execute(SCHOOL_ID, SESSION_ID, 'base64-image'),
    ).rejects.toThrow('Session de concours introuvable');
  });

  it('rejette si la session n’appartient pas à l’établissement', async () => {
    const entranceRepo = {
      trouverSession: async () => makeSession({ schoolId: 'other-school' }),
    } as unknown as EntranceExamRepository;

    const useCase = new ScannerListeCandidatsUseCase(entranceRepo, {} as DocumentAiPort);

    expect(
      useCase.execute(SCHOOL_ID, SESSION_ID, 'base64-image'),
    ).rejects.toThrow('Accès refusé');
  });

  it('retourne une liste vide avec avertissements si l’OCR / Vision échoue', async () => {
    const entranceRepo = {
      trouverSession: async () => makeSession(),
    } as unknown as EntranceExamRepository;

    const documentAi: DocumentAiPort = {
      extraireDocument: async (): Promise<DocumentAiResultat> => ({
        source: 'ECHEC',
        reponseTexte: null,
        ocrConfidence: null,
        warnings: ['Impossible de lire le document'],
      }),
    };

    const useCase = new ScannerListeCandidatsUseCase(entranceRepo, documentAi);
    const result = await useCase.execute(SCHOOL_ID, SESSION_ID, 'base64-image');

    expect(result.candidats).toHaveLength(0);
    expect(result.warnings).toContain('Impossible de lire le document');
  });

  it('extrait et valide la liste des candidats depuis la réponse IA', async () => {
    const entranceRepo = {
      trouverSession: async () => makeSession(),
    } as unknown as EntranceExamRepository;

    const documentAi: DocumentAiPort = {
      extraireDocument: async (): Promise<DocumentAiResultat> => ({
        source: 'OCR_TEXTE',
        reponseTexte: JSON.stringify({
          candidats: [
            {
              firstName: 'Jean',
              lastName: 'Eto\'o',
              dateOfBirth: '2014-05-12',
              examScore: 16.5,
              confidence: 'high',
            },
            {
              firstName: 'Marie',
              lastName: 'Mbarga',
              dateOfBirth: null,
              examScore: 12,
              confidence: 'medium',
            },
          ],
        }),
        ocrConfidence: 0.95,
        warnings: [],
      }),
    };

    const useCase = new ScannerListeCandidatsUseCase(entranceRepo, documentAi);
    const result = await useCase.execute(SCHOOL_ID, SESSION_ID, 'base64-image', 'image/jpeg');

    expect(result.candidats).toHaveLength(2);
    expect(result.candidats[0].firstName).toBe('Jean');
    expect(result.candidats[0].examScore).toBe(16.5);
    expect(result.candidats[0].confidence).toBe('high');
    expect(result.candidats[1].lastName).toBe('Mbarga');
    expect(result.warnings).toHaveLength(0);
  });

  it('gère une réponse IA avec markdown englobant le JSON', async () => {
    const entranceRepo = {
      trouverSession: async () => makeSession(),
    } as unknown as EntranceExamRepository;

    const documentAi: DocumentAiPort = {
      extraireDocument: async (): Promise<DocumentAiResultat> => ({
        source: 'VISION',
        reponseTexte: '```json\n{"candidats": [{"firstName": "Samuel", "lastName": "Song", "confidence": "high"}]}\n```',
        ocrConfidence: null,
        warnings: ['Fallback vision utilisé'],
      }),
    };

    const useCase = new ScannerListeCandidatsUseCase(entranceRepo, documentAi);
    const result = await useCase.execute(SCHOOL_ID, SESSION_ID, 'base64-image');

    expect(result.candidats).toHaveLength(1);
    expect(result.candidats[0].firstName).toBe('Samuel');
    expect(result.warnings).toContain('Fallback vision utilisé');
  });
});
