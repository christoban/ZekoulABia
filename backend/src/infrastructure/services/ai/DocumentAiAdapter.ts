import type { DocumentAiPort, DocumentAiResultat } from '@domain/ports/services/DocumentAiPort';
import { extraireDocument } from './DocumentAiOrchestrator';

export class DocumentAiAdapter implements DocumentAiPort {
  async extraireDocument(params: {
    imageBase64: string;
    mimeType?: string;
    promptOcrTexte: (texteExtrait: string) => string;
    promptVision: string;
    seuilConfiance?: number;
    maxTokens?: number;
  }): Promise<DocumentAiResultat> {
    return extraireDocument(params);
  }
}
