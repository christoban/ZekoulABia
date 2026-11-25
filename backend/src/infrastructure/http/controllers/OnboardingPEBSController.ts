/**
 * INFRASTRUCTURE LAYER — Controller : analyse PEBS via Groq
 *
 * POST /api/v2/onboarding/analyze-pebs
 * Reçoit une description en langage libre de l'organisation du PEBS,
 * la soumet à Groq, et retourne une structure classe par classe.
 */
import type { Request, Response, NextFunction } from 'express';
import { generateWithGroq } from '../../services/ai/GroqClient.ts';

interface PEBSOrgRule {
  className: string;
  level: string;
  statut: 'PEBS_PUR' | 'NON_PEBS' | 'MIXTE';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnalyzePebsBody {
  description: string;
  conversationHistory?: ChatMessage[];
  context: {
    subSystem?: string;
    cycles?: string[];
    levels: string[];
    classesPerLevel?: Record<string, number>;
    conventionNommage?: string;
    hasPEBSFrancophone?: boolean;
    hasPEBSAnglophone?: boolean;
  };
}

function generateClassList(levels: string[], perLevel: Record<string, number> | undefined, convention: string): string[] {
  const conv = convention ?? 'LETTRES';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const names: string[] = [];
  for (const level of levels) {
    const count = perLevel?.[level] ?? 2;
    for (let i = 0; i < Math.min(count, 26); i++) {
      const suffix = conv === 'CHIFFRES' ? `${i + 1}`
        : conv === 'MIXTE' ? `${LETTERS[i]}1`
        : `${LETTERS[i]}`;
      names.push(`${level} ${suffix}`);
    }
  }
  return names;
}

export class OnboardingPEBSController {
  analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { description, conversationHistory, context } = req.body as AnalyzePebsBody;
      if (!description?.trim()) {
        res.status(400).json({ success: false, message: 'Description requise.' });
        return;
      }
      if (!context?.levels?.length) {
        res.status(400).json({ success: false, message: 'Contexte (niveaux) requis.' });
        return;
      }

      const classList = generateClassList(context.levels, context.classesPerLevel, context.conventionNommage ?? 'LETTRES');
      const pebsLabel = context.hasPEBSFrancophone ? 'PEBS Francophone' : 'PEBS Anglophone';

      const systemPrompt = `Tu es un assistant de configuration scolaire pour le système éducatif camerounais (MINESEC).
Tu reçois une description de l'organisation du Programme Spécial Bilingue (PEBS) dans un établissement.
Ta mission est d'analyser la description et de déterminer pour chaque classe de la liste si elle est :
- PEBS_PUR : tous les élèves de cette classe suivent le PEBS
- NON_PEBS : aucun élève de cette classe ne suit le PEBS  
- MIXTE : des élèves PEBS et non-PEBS sont mélangés dans cette même classe

La liste des classes de l'établissement est fournie.
Utilise la logique et le bon sens pour déduire le statut de chaque classe.

IMPORTANT — Conservation du contexte :
Tu reçois ci-dessous l'HISTORIQUE COMPLET de la conversation avec l'utilisateur.
Ne te base PAS uniquement sur le dernier message : intègre TOUTE l'information déjà donnée dans les messages précédents.
Si un niveau/classe a été mentionné dans un tour antérieur, il fait toujours partie de la description — ne l'oublie pas.
Construis ta compréhension PROGRESSIVEMENT en cumulant toutes les informations de l'historique.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans texte autour) au format suivant :
{
  "pebsOrganisation": [
    { "className": "4e 1", "level": "4e", "statut": "PEBS_PUR" }
  ],
  "reformulation": "Résumé en français de ce que tu as compris de l'organisation décrite.",
  "clarificationNeeded": false,
  "clarifications": ["Question de clarification si ambigu, sinon tableau vide"]
}

Si la description est trop vague ou ambiguë, mets clarificationNeeded à true et donne des questions de clarification ciblées.
Si tu peux déterminer sans ambiguïté, mets clarificationNeeded à false.`;

      const historyBlock = (conversationHistory ?? []).length > 0
        ? conversationHistory!.map((m, i) =>
            m.role === 'user'
              ? `[UTILISATEUR, tour ${i + 1}] : "${m.content}"`
              : `[ASSISTANT, tour ${i + 1}] : "${m.content}"`
          ).join('\n')
        : `[UTILISATEUR] : "${description}"`;

      const prompt = `Établissement : ${pebsLabel}
Niveaux concernés : ${context.levels.join(', ')}
Classes de l'établissement : ${classList.join(', ')}

HISTORIQUE COMPLET de la conversation avec l'utilisateur :
${historyBlock}

Analyse TOUT l'historique ci-dessus et détermine le statut PEBS de chaque classe en cumulant les informations de tous les tours.`;

      const raw = await generateWithGroq(prompt, systemPrompt);
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const result = JSON.parse(cleaned);

      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof SyntaxError) {
        res.status(422).json({ success: false, message: "Impossible d'analyser la description. Veuillez reformuler." });
        return;
      }
      next(error);
    }
  };
}
