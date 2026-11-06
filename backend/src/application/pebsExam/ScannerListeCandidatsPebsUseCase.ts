import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';
import type { DocumentAiPort } from '@domain/ports/services/DocumentAiPort';

interface ScannedCandidate {
  firstName: string;
  lastName: string;
  examScore?: number;
  confidence: 'high' | 'medium' | 'low';
}


interface ScannedCandidateBrut {
  firstName?: string;
  lastName?: string;
  examScore?: number;
  confidence?: 'high' | 'medium' | 'low';
}

const CONSIGNES = `Pour chaque candidat visible, extrais :
- firstName (prénom)
- lastName (nom de famille)
- examScore (note si visible)

Retourne UNIQUEMENT un JSON strict, sans markdown, avec un tableau "candidats" contenant ces champs.
Si un champ n'est pas visible ou lisible, mets-le à null.
Si l'écriture est peu lisible, mets confidence à "low".
Ne fabrique jamais de données.

Format : {"candidats": [{"firstName": "...", "lastName": "...", "examScore": null, "confidence": "high"}]}`;

export class ScannerListeCandidatsPebsUseCase {
  constructor(
    private readonly pebsRepository: PebsExamRepository,
    private readonly documentAi: DocumentAiPort,
  ) {}

  async execute(schoolId: string, sessionId: string, imageBase64: string, mimeType?: string): Promise<{ candidats: ScannedCandidate[]; warnings: string[] }> {
    const session = await this.pebsRepository.trouverSession(sessionId);
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    // Passe par l'orchestrateur OCR-d'abord (DocumentAiOrchestrator) — même logique que
    // ScannerListeCandidatsUseCase (entranceExam) : une liste de candidats est un document
    // texte, PaddleOCR suffit dans la grande majorité des cas.
    const resultat = await this.documentAi.extraireDocument({
      imageBase64,
      mimeType,
      maxTokens: 2048,
      promptOcrTexte: (texte) => `Tu es un assistant d'administration scolaire camerounaise. Voici le texte extrait par OCR d'une liste de candidats à un examen de sélection PEBS :

"""
${texte}
"""

${CONSIGNES}`,
      promptVision: `Tu es un assistant d'administration scolaire camerounaise. Analyse cette image d'une liste de candidats à un examen de sélection PEBS.

${CONSIGNES}`,
    });

    if (resultat.source === 'ECHEC' || !resultat.reponseTexte) {
      return { candidats: [], warnings: resultat.warnings };
    }

    const warnings = [...resultat.warnings];
    const jsonMatch = resultat.reponseTexte.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      warnings.push('Impossible de parser la réponse de l\'IA.');
      return { candidats: [], warnings };
    }

    let parsed: { candidats?: ScannedCandidateBrut[] };
    try {
      parsed = JSON.parse(jsonMatch[0]) as { candidats?: ScannedCandidateBrut[] };
    } catch {
      warnings.push('Impossible de parser la réponse de l\'IA.');
      return { candidats: [], warnings };
    }

    const candidats: ScannedCandidate[] = (parsed.candidats ?? []).map((c) => ({
      firstName: String(c.firstName ?? '').trim(),
      lastName: String(c.lastName ?? '').trim(),
      examScore: typeof c.examScore === 'number' ? c.examScore : undefined,
      confidence: (c.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    }));

    if (candidats.length === 0) warnings.push('Aucun candidat détecté.');
    const lowConf = candidats.filter(c => c.confidence === 'low');
    if (lowConf.length > 0) warnings.push(`${lowConf.length} candidat(s) avec confiance faible.`);

    return { candidats, warnings };
  }
}
