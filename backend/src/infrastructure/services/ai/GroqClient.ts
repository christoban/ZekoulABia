import { createGroq } from "@ai-sdk/groq";
import { messageErreur } from '@application/shared/messageErreur';
import { generateText } from "ai";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// gpt-oss-120b : moins cher et plus rapide que llama-3.3-70b-versatile sur Groq pour ce type
// d'usage texte (chat, raisonnement), sans perte de qualité constatée dans la doc Groq. Texte
// seul — jamais d'image ici, voir DocumentAiOrchestrator.ts pour le pipeline de scan de document.
export const groqModel = groq("openai/gpt-oss-120b");

const cleanMarkdownArtifacts = (text: string): string => {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const generateWithGroq = async (prompt: string, systemPrompt?: string): Promise<string> => {
  try {
    const { text } = await generateText({
      model: groqModel,
      system:
        systemPrompt ||
        // Défaut volontairement SANS langue imposée : la langue est injectée par
        // l'appelant via instructionLangue() selon le sous-système de l'école.
        // Ne consigne ici que le style/format.
        "Tu es l'assistant pédagogique de ZekoulABia pour les établissements scolaires camerounais. Réponds de façon concise, naturelle et bienveillante. N'utilise pas de Markdown, pas d'astérisques, pas de dièses, pas de listes décorées, et pas de blocs de code sauf si l'utilisateur le demande explicitement.",
      prompt,
      maxOutputTokens: 1000,
    });
    return cleanMarkdownArtifacts(text);
  } catch (error) {
    console.error("Groq error:", messageErreur(error));
    throw new Error("Service IA temporairement indisponible");
  }
};
