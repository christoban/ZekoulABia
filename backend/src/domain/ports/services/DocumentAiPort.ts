export interface DocumentAiResultat {
  reponseTexte: string | null;
  source: 'OCR_TEXTE' | 'VISION' | 'ECHEC';
  ocrConfidence: number | null;
  warnings: string[];
}

export interface DocumentAiPort {
  extraireDocument(params: {
    imageBase64: string;
    mimeType?: string;
    promptOcrTexte: (texteExtrait: string) => string;
    promptVision: string;
    seuilConfiance?: number;
    maxTokens?: number;
  }): Promise<DocumentAiResultat>;
}
