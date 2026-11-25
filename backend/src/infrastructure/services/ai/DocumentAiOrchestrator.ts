/**
 * INFRASTRUCTURE LAYER — Orchestrateur de scan de document (diplôme, liste de candidats, cahier
 * de textes, etc.), en trois couches plutôt qu'un seul appel Vision systématique :
 *
 *   Image → PaddleOCR (ml-service, local, gratuit) → texte + confiance
 *              │
 *              ├── confiance haute → openai/gpt-oss-120b (texte seul, moins cher, plus rapide)
 *              └── confiance basse → modèle vision Groq (l'image brute, coûte plus cher)
 *
 * Principe : la plupart des documents scannés dans ZekoulABia (diplôme, liste d'élèves, cahier)
 * sont fondamentalement du TEXTE à lire, pas des images à "comprendre" — l'OCR suffit à extraire
 * ce texte, et gpt-oss-120b (texte seul, jamais vu l'image) suffit ensuite à le structurer. Le
 * modèle vision ne sert que quand l'OCR n'a pas réussi à lire correctement (photo floue,
 * inclinée, écriture manuscrite peu lisible) — c'est l'exception, pas la règle.
 *
 * meta-llama/llama-4-scout-17b-16e-instruct (l'ancien modèle vision utilisé partout dans ce
 * fichier avant ce chantier) a été retiré par Groq le 17/07/2026 — remplacé ici par
 * qwen/qwen3.6-27b, seul modèle vision actuellement proposé par Groq. À noter : Groq le classe
 * "preview", pas "production" — moins de garanties de disponibilité à long terme que
 * gpt-oss-120b. Si Groq promeut un jour un autre modèle vision en production, seul ce fichier a
 * besoin d'être modifié (aucun des 4 appelants ne connaît le nom du modèle).
 */
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? process.env.TABPFN_SERVICE_URL ?? 'http://localhost:8001';
const OCR_TIMEOUT_MS = 15000;
const GROQ_TIMEOUT_MS = 30000;

const MODELE_TEXTE = 'openai/gpt-oss-120b';
const MODELE_VISION = 'qwen/qwen3.6-27b';
const SEUIL_CONFIANCE_DEFAUT = 0.75;

// qwen/qwen3.6-27b (contrairement à gpt-oss-120b, qui isole son raisonnement dans un champ
// `reasoning` séparé) inclut son raisonnement directement dans `content`, entouré de balises
// <think>...</think>, avant la réponse finale — vérifié en conditions réelles contre l'API Groq
// lors de ce chantier. Sans ce nettoyage, le JSON attendu par les appelants (parsé via une regex
// sur la première/dernière accolade) risque d'être pollué par du texte de raisonnement.
function retirerBalisesReflexion(texte: string): string {
  return texte.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

interface OcrResponseDTO {
  text: string;
  confidence: number;
  lines: Array<{ text: string; confidence: number }>;
}

export interface OrchestrateurResultat {
  /** Contenu brut renvoyé par le modèle — à parser par l'appelant (chaque document a ses propres champs). */
  reponseTexte: string | null;
  source: 'OCR_TEXTE' | 'VISION' | 'ECHEC';
  ocrConfidence: number | null;
  warnings: string[];
}

async function extraireTexteViaOcr(imageBase64: string): Promise<OcrResponseDTO | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/ocr/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64 }),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as OcrResponseDTO;
  } catch {
    // ml-service indisponible — dégradation gracieuse vers le modèle vision, jamais un échec
    // total juste parce que la brique d'optimisation de coût n'a pas répondu.
    return null;
  }
}

async function appelerGroqTexte(prompt: string, maxTokens: number): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELE_TEXTE,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const contenu = data?.choices?.[0]?.message?.content;
  return typeof contenu === 'string' ? retirerBalisesReflexion(contenu) : null;
}

async function appelerGroqVision(prompt: string, imageBase64: string, mimeType: string, maxTokens: number): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELE_VISION,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const contenu = data?.choices?.[0]?.message?.content;
  return typeof contenu === 'string' ? retirerBalisesReflexion(contenu) : null;
}

export async function extraireDocument(params: {
  imageBase64: string;
  mimeType?: string;
  /** Construit le prompt envoyé à gpt-oss-120b à partir du texte extrait par l'OCR. */
  promptOcrTexte: (texteExtrait: string) => string;
  /** Prompt envoyé tel quel au modèle vision, avec l'image — repris des prompts existants. */
  promptVision: string;
  seuilConfiance?: number;
  maxTokens?: number;
}): Promise<OrchestrateurResultat> {
  const warnings: string[] = [];
  const mimeType = params.mimeType || 'image/jpeg';
  const maxTokens = params.maxTokens ?? 1024;
  const seuil = params.seuilConfiance ?? SEUIL_CONFIANCE_DEFAUT;

  if (!process.env.GROQ_API_KEY) {
    warnings.push('Analyse impossible : clé Groq absente. Veuillez saisir manuellement.');
    return { reponseTexte: null, source: 'ECHEC', ocrConfidence: null, warnings };
  }

  const ocr = await extraireTexteViaOcr(params.imageBase64);
  if (!ocr) warnings.push('Service OCR indisponible — analyse directe par le modèle vision.');

  const confianceSuffisante = !!ocr && ocr.text.trim().length > 0 && ocr.confidence >= seuil;

  if (confianceSuffisante && ocr) {
    const reponse = await appelerGroqTexte(params.promptOcrTexte(ocr.text), maxTokens);
    if (reponse) {
      return { reponseTexte: reponse, source: 'OCR_TEXTE', ocrConfidence: ocr.confidence, warnings };
    }
    warnings.push('Échec de l\'analyse texte — nouvelle tentative via le modèle vision.');
  }

  // qwen/qwen3.6-27b inclut son raisonnement dans le budget de tokens de la réponse (contrairement
  // à gpt-oss-120b, dont le raisonnement est facturé séparément) — vérifié en conditions réelles
  // qu'une réponse triviale consomme déjà ~190 tokens de réflexion. Budget élargi pour ne pas
  // tronquer le JSON final après un raisonnement verbeux.
  const maxTokensVision = Math.max(maxTokens * 2, 1500);
  const reponseVision = await appelerGroqVision(params.promptVision, params.imageBase64, mimeType, maxTokensVision);
  if (!reponseVision) {
    warnings.push('Erreur lors de l\'appel à l\'IA. Veuillez réessayer ou saisir manuellement.');
    return { reponseTexte: null, source: 'ECHEC', ocrConfidence: ocr?.confidence ?? null, warnings };
  }

  return { reponseTexte: reponseVision, source: 'VISION', ocrConfidence: ocr?.confidence ?? null, warnings };
}
