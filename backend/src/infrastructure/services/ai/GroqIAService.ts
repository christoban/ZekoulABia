/**
 * INFRASTRUCTURE LAYER — Adapter IA via Groq
 * Implémente IAService.
 */
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import type {
  IAService,
  DonneesIndiceSante,
  ResultatIndiceSante,
} from '@domain/ports/services/IAService';
import type { Language } from '@domain/policies/LanguagePolicy';
import { instructionLangue } from './prompts/LanguagePrompt.ts';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY ?? '',
});

// gpt-oss-120b : moins cher et plus rapide que llama-3.3-70b-versatile sur Groq pour ce type
// d'usage texte, sans perte de qualité constatée dans la doc Groq. Texte seul.
const GROQ_MODEL = 'openai/gpt-oss-120b';

function nettoyerMarkdown(texte: string): string {
  return texte
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s/gm, '')
    .replace(/^[-*+]\s/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function genererAvecGroq(prompt: string, lang: Language = 'fr'): Promise<string> {
  const { text } = await generateText({
    model: groq(GROQ_MODEL),
    system: `Tu es un conseiller pédagogique camerounais. N'utilise pas de Markdown. ${instructionLangue(lang)}`,
    prompt,
    maxOutputTokens: 1000,
  });
  return nettoyerMarkdown(text);
}

export class GroqIAService implements IAService {
  async calculerIndiceSante(donnees: DonneesIndiceSante): Promise<ResultatIndiceSante> {
    const niveaux: Array<{ max: number; niveau: ResultatIndiceSante['niveau'] }> = [
      { max: 30,  niveau: 'CRITIQUE' },
      { max: 50,  niveau: 'ELEVE' },
      { max: 70,  niveau: 'MOYEN' },
      { max: 85,  niveau: 'STABLE' },
      { max: 100, niveau: 'PROGRESSION' },
    ];

    const score = Math.round(
      (donnees.moyenneGenerale / 20) * 100 * 0.35 +
      donnees.tauxPresence * 0.25 +
      50 * 0.20 +
      Math.max(0, 100 - donnees.nombreSanctions * 20) * 0.10 +
      donnees.tauxPaiement * 0.10
    );

    const niveau = niveaux.find(n => score <= n.max)?.niveau ?? 'PROGRESSION';

    const prompt = `
Élève avec : moyenne ${donnees.moyenneGenerale.toFixed(1)}/20, présence ${donnees.tauxPresence.toFixed(0)}%, ${donnees.nombreSanctions} sanction(s).
Niveau de santé scolaire : ${niveau} (score ${score}/100).
Donne 2-3 recommandations courtes et concrètes pour l'enseignant.
    `.trim();

    const analyse = await genererAvecGroq(prompt, donnees.langue ?? 'fr');
    const recommandations = analyse
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .slice(0, 3);

    return { score: Math.max(0, Math.min(100, score)), niveau, recommandations };
  }

  async genererCommentaireBulletin(params: {
    nomEleve: string;
    moyenneGenerale: number;
    evolution: 'HAUSSE' | 'BAISSE' | 'STABLE';
    pointsForts: string[];
    pointsFaibles: string[];
    langue: 'FR' | 'EN';
  }): Promise<string> {
    const lang: Language = params.langue === 'EN' ? 'en' : 'fr';
    const langue = lang === 'en' ? 'English' : 'français';
    const prompt = `
Génère un commentaire de bulletin scolaire en ${langue} pour ${params.nomEleve}.
Moyenne : ${params.moyenneGenerale.toFixed(2)}/20. Tendance : ${params.evolution}.
Points forts : ${params.pointsForts.join(', ') || 'aucun identifié'}.
Points faibles : ${params.pointsFaibles.join(', ') || 'aucun identifié'}.
2-3 phrases, ton encourageant et professionnel.
    `.trim();

    return genererAvecGroq(prompt, lang);
  }

  async genererEmploiDuTemps(
    contraintes: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const prompt = `
Génère un emploi du temps scolaire respectant ces contraintes :
${JSON.stringify(contraintes, null, 2)}
Retourne un JSON structuré avec les créneaux.
    `.trim();

    const resultat = await genererAvecGroq(prompt);
    try {
      return JSON.parse(resultat) as Record<string, unknown>;
    } catch {
      return { raw: resultat };
    }
  }

  async genererConseilPersonnalise(params: {
    nomEleve: string;
    contexte: string;
    destinataire: 'ELEVE' | 'PARENT' | 'ENSEIGNANT';
    langue?: 'fr' | 'en';
  }): Promise<string> {
    const lang: Language = params.langue ?? 'fr';

    const consignesParDestinataire: Record<typeof params.destinataire, string> = {
      ELEVE: `Adresse-toi directement à ${params.nomEleve} en le/la tutoyant. Ton encourageant, jamais culpabilisant. Propose 2-3 actions concrètes et réalisables que l'élève peut faire lui-même dès cette semaine.`,
      PARENT: `Adresse-toi au parent de ${params.nomEleve}, ton factuel et respectueux. Explique la situation simplement puis propose 2-3 actions concrètes que le parent peut faire à la maison (suivi des devoirs, dialogue, appui d'un répétiteur, prise de contact avec l'enseignant, etc.).`,
      ENSEIGNANT: `Adresse-toi à l'enseignant de ${params.nomEleve}, ton pédagogique entre collègues. Propose 2-3 pistes pédagogiques concrètes en classe ou en suivi individuel pour cet élève.`,
    };

    const prompt = `
Situation de l'élève ${params.nomEleve} : ${params.contexte}
${consignesParDestinataire[params.destinataire]}
Réponds en 3-4 phrases maximum, sans formule de politesse d'ouverture ni de signature.
    `.trim();

    return genererAvecGroq(prompt, lang);
  }
}
