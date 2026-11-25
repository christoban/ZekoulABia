import type { DocumentAiPort } from '@domain/ports/services/DocumentAiPort';

/**
 * APPLICATION — Use case : analyse par IA d'une photo/scan de diplôme, pour PRÉ-REMPLIR le
 * formulaire self-service RH — jamais pour écrire directement en base.
 *
 * Passe par l'orchestrateur OCR-d'abord (DocumentAiOrchestrator) : un diplôme est un document
 * texte, PaddleOCR suffit dans la grande majorité des cas ; le modèle vision Groq ne sert que si
 * l'OCR échoue à lire correctement (photo floue, inclinée, etc.).
 *
 * Consigne stricte "ne jamais inventer, préférer null à une devinette", confiance par champ pour
 * que le frontend puisse mettre en évidence ce qui mérite une relecture humaine avant
 * confirmation.
 *
 * L'employé reste TOUJOURS le dernier mot : la suggestion est affichée dans le champ texte,
 * modifiable, jamais auto-enregistrée sans un clic explicite sur "Enregistrer".
 */
interface DiplomeAnalyse {
  intitule: string | null;
  institution: string | null;
  anneeObtention: string | null;
  suggestionTermeOfficiel: string | null; // ex. "DIPES II", "CAPIEMP" si reconnaissable
  confidence: 'high' | 'medium' | 'low';
}

const CONSIGNES = `Extrais :
- intitule (intitulé complet du diplôme tel qu'écrit sur le document, ex. "Licence en Lettres Modernes")
- institution (établissement ou université ayant délivré le diplôme)
- anneeObtention (année d'obtention, au format YYYY)
- suggestionTermeOfficiel : UNIQUEMENT si tu reconnais avec certitude un diplôme professionnel de l'enseignement camerounais correspondant à une abréviation officielle connue (ex. DIPES I, DIPES II, CAPIEMP, CAPIEG, CAPI, CAPIET, CAPIA, CAPIAEG, CAPIAET). Sinon, laisse à null — ne force jamais une correspondance approximative.
- confidence : "high" si le texte est net et complet, "medium" si partiellement lisible, "low" si tu dois deviner une partie importante.

Retourne UNIQUEMENT un JSON strict, sans markdown :
{"intitule": "...", "institution": "...", "anneeObtention": "...", "suggestionTermeOfficiel": null, "confidence": "high"}

Si le document n'est manifestement pas un diplôme/attestation, retourne tous les champs à null avec confidence "low".
Ne fabrique JAMAIS une information absente — préfère null à une supposition.`;

export class AnalyserDiplomeUseCase {
  constructor(private readonly documentAi: DocumentAiPort) {}

  async execute(imageBase64: string, mimeType?: string): Promise<{ analyse: DiplomeAnalyse | null; warnings: string[] }> {
    const resultat = await this.documentAi.extraireDocument({
      imageBase64,
      mimeType,
      maxTokens: 512,
      promptOcrTexte: (texte) => `Tu es un assistant RH pour un établissement scolaire camerounais. Voici le texte extrait par OCR d'un diplôme ou d'une attestation académique/professionnelle :

"""
${texte}
"""

${CONSIGNES}`,
      promptVision: `Tu es un assistant RH pour un établissement scolaire camerounais. Analyse cette image d'un diplôme ou d'une attestation académique/professionnelle.

${CONSIGNES}`,
    });

    if (resultat.source === 'ECHEC' || !resultat.reponseTexte) {
      return { analyse: null, warnings: resultat.warnings };
    }

    const warnings = [...resultat.warnings];
    const jsonMatch = resultat.reponseTexte.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      warnings.push("Impossible de parser la réponse de l'IA. Veuillez réessayer avec une image plus claire.");
      return { analyse: null, warnings };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      warnings.push("Impossible de parser la réponse de l'IA. Veuillez réessayer avec une image plus claire.");
      return { analyse: null, warnings };
    }

    const analyse: DiplomeAnalyse = {
      intitule: parsed.intitule ? String(parsed.intitule).trim() : null,
      institution: parsed.institution ? String(parsed.institution).trim() : null,
      anneeObtention: parsed.anneeObtention ? String(parsed.anneeObtention).trim() : null,
      suggestionTermeOfficiel: parsed.suggestionTermeOfficiel ? String(parsed.suggestionTermeOfficiel).trim() : null,
      confidence: (parsed.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    };

    if (!analyse.intitule) warnings.push("Aucun intitulé de diplôme détecté — vérifiez la qualité de l'image.");
    if (analyse.confidence === 'low') warnings.push('Confiance faible — relisez attentivement avant de confirmer.');

    return { analyse, warnings };
  }
}
