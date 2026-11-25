import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { DocumentAiPort } from '@domain/ports/services/DocumentAiPort';

interface ScannedCandidate {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  examScore?: number;
  confidence: 'high' | 'medium' | 'low';
}


interface ScannedCandidateBrut {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  examScore?: number;
  confidence?: 'high' | 'medium' | 'low';
}

const CONSIGNES = `Pour chaque candidat visible, extrais :
- firstName (prénom)
- lastName (nom de famille)
- dateOfBirth (date de naissance si visible, au format YYYY-MM-DD)
- examScore (note globale ou par matière si visible)

Retourne UNIQUEMENT un JSON strict, sans markdown, avec un tableau "candidats" contenant ces champs.
Si un champ n'est pas visible ou lisible, mets-le à null.
Si l'écriture est peu lisible, mets confidence à "low" pour ce candidat.
Ne fabrique jamais de données — préfère null à une devinette.

Format attendu :
{"candidats": [{"firstName": "...", "lastName": "...", "dateOfBirth": null, "examScore": null, "confidence": "high"}]}`;

export class ScannerListeCandidatsUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly documentAi: DocumentAiPort,
  ) {}

  async execute(schoolId: string, sessionId: string, imageBase64: string, mimeType?: string): Promise<{ candidats: ScannedCandidate[]; warnings: string[] }> {
    // Vérifier la session
    const session = await this.entranceRepository.trouverSession(sessionId);
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    // Passe par l'orchestrateur OCR-d'abord (DocumentAiOrchestrator) — une liste de candidats
    // est un document texte, PaddleOCR suffit dans la grande majorité des cas ; le modèle vision
    // Groq ne sert que si l'OCR échoue à lire correctement (photo floue, écriture peu lisible).
    const resultat = await this.documentAi.extraireDocument({
      imageBase64,
      mimeType,
      maxTokens: 2048,
      promptOcrTexte: (texte) => `Tu es un assistant d'administration scolaire camerounaise. Voici le texte extrait par OCR d'une liste de candidats à un concours d'entrée en 6e :

"""
${texte}
"""

${CONSIGNES}`,
      promptVision: `Tu es un assistant d'administration scolaire camerounaise. Analyse cette image d'une liste de candidats à un concours d'entrée en 6e.

${CONSIGNES}`,
    });

    if (resultat.source === 'ECHEC' || !resultat.reponseTexte) {
      return { candidats: [], warnings: resultat.warnings };
    }

    const warnings = [...resultat.warnings];
    const jsonMatch = resultat.reponseTexte.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      warnings.push('Impossible de parser la réponse de l\'IA. Veuillez réessayer avec une image plus claire.');
      return { candidats: [], warnings };
    }

    let parsed: { candidats?: ScannedCandidateBrut[] };
    try {
      parsed = JSON.parse(jsonMatch[0]) as { candidats?: ScannedCandidateBrut[] };
    } catch {
      warnings.push('Impossible de parser la réponse de l\'IA. Veuillez réessayer avec une image plus claire.');
      return { candidats: [], warnings };
    }

    const candidats: ScannedCandidate[] = (parsed.candidats ?? []).map((c) => ({
      firstName: String(c.firstName ?? '').trim(),
      lastName: String(c.lastName ?? '').trim(),
      dateOfBirth: c.dateOfBirth ?? undefined,
      examScore: typeof c.examScore === 'number' ? c.examScore : undefined,
      confidence: (c.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    }));

    if (candidats.length === 0) {
      warnings.push('Aucun candidat détecté dans l\'image. Vérifiez la qualité de la photo.');
    }
    const lowConfidence = candidats.filter(c => c.confidence === 'low');
    if (lowConfidence.length > 0) {
      warnings.push(`${lowConfidence.length} candidat(s) avec confiance faible — vérifiez manuellement.`);
    }

    return { candidats, warnings };
  }
}
