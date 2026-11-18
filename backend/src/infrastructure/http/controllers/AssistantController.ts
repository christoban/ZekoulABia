import { messageErreur } from '@application/shared/messageErreur';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateText, tool, APICallError } from 'ai';
import { groqModel } from '../../services/ai/GroqClient.ts';
import {
  buildTools,
  filterCatalogForUser,
  selectRelevantActions,
  type ActionContext,
  type ActionDefinition,
} from '@infrastructure/assistant/catalog/catalogShared';
import type { CopilotDataGateway } from '@domain/ports/repositories/CopilotDataGateway';
import type { AssistantContextQueryRepository } from '@domain/ports/repositories/AssistantContextQueryRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';
import { instructionLangue } from '../../services/ai/prompts/LanguagePrompt';
import {
  detecterParametreHallucine,
  executerAnnulationAction,
  executerConfirmationAction,
} from './assistant/assistantExecutionHelper';

/** Contact support affiché lors d'une escalade — placeholder configurable, jamais en dur. */
const SUPPORT_CONTACT = process.env.ASSISTANT_SUPPORT_CONTACT || 'le support ZekoulABia (contact à configurer)';

type ActionExecutee = {
  actionLogId?: string;
  actionType: string;
  label?: string;
  section?: string | null;
  entity?: unknown;
  undoable?: boolean;
  error?: string;
};
type ActionEnAttente = { pendingActionId: string; actionType: string; summary: string };

const ESCALATE_TOOL_NAME = 'escalate_to_support';

/**
 * INFRASTRUCTURE — Assistant IA exécutant (copilot) pour les rôles autorisés.
 *
 * POST /api/v2/assistant/execute        → comprend la demande, exécute (non-destructif)
 *                                          ou renvoie une demande de confirmation (destructif)
 * POST /api/v2/assistant/confirm-action → exécute (ou annule) une action destructive en attente
 * POST /api/v2/assistant/undo-action    → annule une action non-destructive récente
 *
 * La double-vérification RBAC est systématique : le catalogue exposé au modèle est
 * filtré selon le rôle réel, et l'autorisation est RE-vérifiée côté serveur avant
 * toute exécution — on ne fait jamais confiance au prompt.
 */
export class AssistantController {
  /** Construit le contexte d'action du catalogue (école + rôle + passerelle de données). */
  private readonly ctx: (req: Request) => ActionContext;

  constructor(
    private readonly contextRepo: AssistantContextQueryRepository,
    private readonly catalog: ActionDefinition[],
    private readonly audit: AIActionAuditPort,
    /**
     * Passerelle de données requise UNIQUEMENT pour bâtir l'`ActionContext` du catalogue :
     * le contrôleur lui-même ne fait aucune requête directe et passe par `contextRepo`/`audit`.
     */
    copilotData: CopilotDataGateway,
    /**
     * Génération de texte, injectable — production : `generateText` du SDK `ai` (défaut).
     *
     * Ce point d'injection existe pour la SÉCURITÉ, pas pour la couverture : les garde-fous de
     * ce contrôleur (double-vérification RBAC, détection de paramètre halluciné, confirmation
     * obligatoire des actions destructives) ne se déclenchent que face à une sortie de modèle
     * précise. Avec le vrai modèle, on ne peut pas PROVOQUER ces sorties de façon fiable : on ne
     * teste alors que le cas heureux. En injectant un générateur contrôlé, on soumet les
     * garde-fous au pire comportement possible — un modèle qui appelle un outil interdit au
     * rôle, qui invente un paramètre, ou qui obéit à une injection de prompt.
     *
     * Même patron d'optionnalité que `CreerClasseUseCase` : la production ne passe rien.
     */
    private readonly genererTexte: typeof generateText = generateText,
  ) {
    this.ctx = (req: Request): ActionContext => {
      const user = req.user!;
      return { schoolId: user.schoolId, userId: user.userId, role: user.role, data: copilotData };
    };
  }

  /**
   * Charge l'historique persisté d'un fil de conversation et le sérialise en texte.
   * Fenêtré (derniers tours seulement) et tronqué par tour plutôt que réinjecté en
   * intégralité : sur une conversation longue, réinjecter TOUT l'historique brut à
   * chaque appel fait croître le coût en tokens avec la longueur du fil, jusqu'à
   * épuiser le plafond TPM Groq en quelques échanges seulement (constaté en test réel :
   * ~7500/8000 tokens/minute consommés après 7 tours sur un même fil). Une clarification
   * ne porte quasiment toujours que sur le dernier tour assistant — cette fenêtre reste
   * largement suffisante pour ce cas d'usage sans faire exploser le budget de tokens.
   */
  private async loadHistoryBlock(conversationId: string | null, schoolId: string, userId: string): Promise<string> {
    if (!conversationId) return '';
    const MAX_TOURS = 10; // ~5 échanges — au-delà, coût en tokens disproportionné pour un gain de contexte marginal
    const MAX_CARACTERES_PAR_TOUR = 600;

    const tournsDesc = await this.contextRepo.findConversationTurns(conversationId, schoolId, userId, MAX_TOURS);
    if (tournsDesc.length === 0) return '';
    const turns = tournsDesc.reverse();

    const tronquer = (texte: string) =>
      texte.length > MAX_CARACTERES_PAR_TOUR ? `${texte.slice(0, MAX_CARACTERES_PAR_TOUR)}…` : texte;

    const historyBlock = turns
      .map((t, i: number) => `[${t.role === 'user' ? 'UTILISATEUR' : 'ASSISTANT'}, tour ${i + 1}] : "${tronquer(t.content)}"`)
      .join('\n');

    return (
      `\n\n── Historique de cette conversation ──\n` +
      `Tu reçois ci-dessous les derniers échanges avec cet utilisateur, dans ce fil de conversation.\n` +
      `Ne te base PAS uniquement sur le dernier message : intègre l'information déjà donnée dans ces tours précédents.\n` +
      `Si l'utilisateur répond à une question de clarification que TU as posée, comprends sa réponse à la lumière de CETTE question précise.\n` +
      `${historyBlock}`
    );
  }

  /** Persiste un tour (utilisateur ou assistant) dans l'historique du fil de conversation. */
  private saveTurn(conversationId: string, schoolId: string, userId: string, role: 'user' | 'assistant', content: string, toolCalls?: unknown) {
    this.contextRepo
      .createConversationTurn({ conversationId, schoolId, userId, role, content, toolCalls })
      .catch((e) => console.error('[AssistantConversationTurn]', messageErreur(e)));
  }

  /**
   * Construit le contexte établissement + aide contextuelle injectés dans le prompt
   * système. `screenKey` identifie l'écran actif côté frontend (ex. "admin.grades") —
   * les fiches HelpArticle correspondantes sont injectées pour que l'assistant fonde
   * ses réponses dessus plutôt que d'inventer une explication sur le fonctionnement
   * de ZekoulABia.
   */
  private async buildSystemPrompt(
    schoolId: string,
    role: string,
    screenKey: string | null,
  ): Promise<{ system: string; helpArticles: { title: string; content: string; relatedSelectors: unknown }[] }> {
    const [school, classes, subjects, teachers, periods] = await Promise.all([
      this.contextRepo.findSchoolContext(schoolId),
      this.contextRepo.findClassesBySchool(schoolId),
      this.contextRepo.findSubjectsBySchool(schoolId),
      this.contextRepo.findTeachersBySchool(schoolId),
      this.contextRepo.findCurrentPeriods(schoolId),
    ]);

    const classList = classes.map((c) => `${c.name} (${c.enrollmentsCount} élèves)`).join(', ') || 'aucune classe';
    const subjectList = subjects.map((s) => `${s.name} (coeff ${s.coefficient})`).join(', ') || 'aucune matière';
    const teacherList = teachers.map((t) => `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim()).filter(Boolean).join(', ') || 'aucun enseignant';
    const periodList = periods.map((p) => p.name).join(', ') || 'non configurées';
    const langue = resolveLanguage(school?.subsystem);

    const helpArticles = screenKey
      ? await this.contextRepo.findHelpArticles(screenKey, langue, role.toUpperCase())
      : [];

    const helpSection = helpArticles.length > 0
      ? `\n\n── Aide contextuelle pour l'écran actuel (${screenKey}) ──\n` +
        `Ces fiches décrivent le fonctionnement réel de cet écran. Fonde ta réponse dessus en priorité pour toute question sur « comment faire X ici » plutôt que d'inventer une explication.\n` +
        helpArticles.map((a) => `• ${a.title} : ${a.content}`).join('\n')
      : screenKey
        ? `\n\n── Aide contextuelle ──\nAucune fiche d'aide n'existe pour l'écran actuel (${screenKey}). Si la question porte sur le fonctionnement précis de ZekoulABia et que tu n'es pas certain de la réponse, utilise l'outil ${ESCALATE_TOOL_NAME} plutôt que d'inventer.`
        : '';

    // `role` ne servait auparavant qu'à filtrer les fiches d'aide — l'accroche du prompt système
    // était figée sur "administrateur scolaire" quel que soit l'utilisateur réel, ce qui aurait
    // fait que l'assistant se décrive comme un outil d'administrateur même face à un enseignant,
    // un parent ou un élève.
    const descriptionParRole: Record<string, string> = {
      ADMIN: "un copilot intégré au tableau de bord d'un administrateur scolaire camerounais (système MINESEC)",
      STAFF: "un copilot intégré au tableau de bord d'un membre du personnel administratif d'un établissement scolaire camerounais (système MINESEC)",
      TEACHER: "un copilot intégré au tableau de bord d'un enseignant d'un établissement scolaire camerounais (système MINESEC)",
      PARENT: "un copilot intégré à l'espace parent d'un établissement scolaire camerounais (système MINESEC), pour suivre la scolarité de son ou ses enfant(s)",
      STUDENT: "un copilot intégré à l'espace élève d'un établissement scolaire camerounais (système MINESEC)",
    };
    const descriptionRole = descriptionParRole[role.toUpperCase()] ?? descriptionParRole.ADMIN;
    // STUDENT est le seul public dont l'adresse informelle est culturellement attendue (élève
    // s'adressant à un outil de son espace personnel) — tous les autres rôles sont des adultes
    // dans un contexte professionnel. Sans cette règle explicite, le modèle mélange tu/vous d'un
    // tour à l'autre (constaté en test réel : « tu » dans l'auto-présentation, « vous » dans un
    // refus, à quelques tours d'écart).
    const pronomRole = role.toUpperCase() === 'STUDENT' ? 'tu (tutoiement)' : 'vous (vouvoiement)';

    const system =
      `Tu es l'Assistant ZekoulABia, ${descriptionRole}. ` +
      `Tu peux EXÉCUTER des actions dans l'interface via les outils (tools) qui te sont fournis, ou simplement RÉPONDRE aux questions.\n\n` +
      `Règles :\n` +
      `- Adresse-toi à l'utilisateur avec ${pronomRole}, de façon constante sur toute la réponse.\n` +
      `- Si la demande correspond clairement à une action parmi les tools fournis, appelle le ou les tools appropriés. Pour une demande composée, appelle plusieurs tools dans l'ordre logique.\n` +
       `- Si c'est une simple question, réponds en texte à partir du contexte ci-dessous, sans appeler de tool.\n` +
       `- Pour tout problème de génération d'emploi du temps, appelle d'abord l'outil de diagnostic de planification de la classe. Base ensuite tes propositions sur ses heures réelles, indisponibilités, EDT existants et enseignants alternatifs ; n'invente jamais une cause.\n` +

      `- En cas de doute réel entre une question/observation et un ordre d'exécution (ex. « la classe 4eA est en retard de paiement » peut être une simple remarque ou une demande d'action), ne devine JAMAIS l'intention — réponds en texte pour demander ce que l'utilisateur souhaite faire, plutôt que d'appeler un tool.\n` +
      `- N'appelle un tool QUE si tous les paramètres requis sont identifiables avec certitude (nom exact de l'élève/classe/matière, absence d'ambiguïté). Si un élément manque ou qu'un nom correspond à plusieurs résultats possibles, pose la question de clarification au lieu d'appeler le tool avec une supposition.\n` +
      `- Utilise les NOMS exacts des classes, matières et enseignants tels qu'ils apparaissent dans le contexte.\n` +
      `- Ne fabrique jamais de données. Si une information manque, dis-le.\n` +
      `- Ton périmètre est la gestion scolaire de cet établissement. Pour une demande clairement hors sujet (écriture créative, culture générale, code, aide personnelle sans rapport avec l'école...), décline poliment en rappelant en une phrase ce que tu peux faire, sans y répondre sur le fond.\n` +
      `- ${instructionLangue(langue)} Sois concis.\n\n` +
      `── Contexte de l'établissement ──\n` +
      `Établissement : ${school?.name ?? 'N/A'} (${school?.subsystem ?? 'N/A'}, ${school?.educationType ?? 'N/A'}, template ${school?.templateCode ?? 'N/A'}).\n` +
      `Classes (${classes.length}) : ${classList}.\n` +
      `Matières (${subjects.length}) : ${subjectList}.\n` +
      `Enseignants (${teachers.length}) : ${teacherList}.\n` +
      `Périodes de l'année en cours : ${periodList}.` +
      helpSection;

    return { system, helpArticles };
  }

  // ── POST /api/v2/assistant/execute ──────────────────────────────────────────
  execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const message = (req.body?.message as string | undefined)?.trim();
      const screenKey = (req.body?.screenKey as string | undefined)?.trim() || null;
      // Un nouveau fil de conversation démarre côté serveur si le frontend n'en a pas encore
      // un (première question de la session) — réutilisé par le frontend pour tous les
      // messages suivants du même échange, pour que l'historique soit reconstitué à chaque appel.
      const conversationId = (req.body?.conversationId as string | undefined)?.trim() || crypto.randomUUID();
      if (!message) {
        res.status(400).json({ success: false, message: 'Message requis' });
        return;
      }

      // Catalogue filtré selon les permissions réelles — jamais plus que le rôle n'autorise.
      // `allowed` reste la référence complète pour toute résolution ultérieure d'un tool par
      // nom (confirmation d'action, relecture d'un log) : seul ce qui est OFFERT au modèle via
      // `tools` est réduit par domaine, jamais ce qu'il a le DROIT d'exécuter.
      const allowed = filterCatalogForUser(this.catalog, user);
      const tools = buildTools(selectRelevantActions(allowed, message));
      const { system: baseSystem, helpArticles } = await this.buildSystemPrompt(user.schoolId, user.role, screenKey);
      const historyBlock = await this.loadHistoryBlock(conversationId, user.schoolId, user.userId);
      const system = baseSystem + historyBlock;
      const ctx = this.ctx(req);
      this.saveTurn(conversationId, user.schoolId, user.userId, 'user', message);

      // Le tool d'escalade n'est proposé au modèle que si aucune fiche d'aide ne couvre
      // déjà l'écran actuel — on privilégie la réponse fondée quand elle existe.
      if (helpArticles.length === 0) {
        tools[ESCALATE_TOOL_NAME] = tool({
          description: "À utiliser UNIQUEMENT si la question porte sur le fonctionnement précis de ZekoulABia et que tu n'es pas certain de la réponse. N'invente jamais une explication sur le fonctionnement de l'application.",
          inputSchema: z.object({ reason: z.string().describe('Brève reformulation de la question à laquelle tu ne peux pas répondre avec certitude') }),
        });
      }

      const highlightSelectors = Array.from(
        new Set(helpArticles.flatMap((a) => (Array.isArray(a.relatedSelectors) ? (a.relatedSelectors as string[]) : []))),
      );

      const logQuery = (responseType: 'MESSAGE' | 'ACTION' | 'ESCALATE') => {
        this.contextRepo
          .createHelpQueryLog({
            schoolId: user.schoolId,
            userId: user.userId,
            role: user.role,
            screenKey,
            question: message,
            responseType,
            articleFound: helpArticles.length > 0,
          })
          .catch((e) => console.error('[AssistantHelpQueryLog]', messageErreur(e)));
      };

      let result;
      try {
        result = await this.genererTexte({ model: groqModel, system, prompt: message, tools, toolChoice: 'auto' });
      } catch (e) {
        // Le message top-level (ex. « Failed to call a function ») ne dit jamais QUEL tool ni
        // QUELS arguments malformés Groq a tenté de générer — cette information vit dans
        // responseBody (le champ `failed_generation` de l'API Groq). Sans elle, ce log est
        // muet sur la vraie cause (schéma Zod trop strict pour un tool donné, catalogue trop
        // large pour que le modèle choisisse fiablement, etc.) et impossible à diagnostiquer.
        if (APICallError.isInstance(e)) {
          console.error('Assistant Groq error:', e.message, '| responseBody:', e.responseBody);
        } else {
          console.error('Assistant Groq error:', messageErreur(e));
        }
        res.json({ success: true, type: 'message', response: "Le service IA est momentanément indisponible. Réessayez dans un instant.", conversationId });
        return;
      }

      const toolCalls = result.toolCalls ?? [];

      // Escalade explicite vers le support humain — pas d'exécution, pas d'invention.
      const escalateCall = toolCalls.find((tc) => tc.toolName === ESCALATE_TOOL_NAME);
      if (escalateCall) {
        logQuery('ESCALATE');
        const escalateResponse = "Je ne peux pas répondre avec certitude à cette question sur le fonctionnement de ZekoulABia.";
        this.saveTurn(conversationId, user.schoolId, user.userId, 'assistant', `${escalateResponse} [Escalade vers ${SUPPORT_CONTACT}]`);
        res.json({
          success: true,
          type: 'escalate',
          response: escalateResponse,
          supportContact: SUPPORT_CONTACT,
          conversationId,
        });
        return;
      }

      if (toolCalls.length === 0) {
        logQuery('MESSAGE');
        const messageResponse = result.text || 'Je n\'ai pas compris la demande.';
        this.saveTurn(conversationId, user.schoolId, user.userId, 'assistant', messageResponse);
        res.json({
          success: true,
          type: 'message',
          response: messageResponse,
          highlightSelectors: highlightSelectors.length > 0 ? highlightSelectors : undefined,
          conversationId,
        });
        return;
      }

      // Garde-fou avant toute exécution : si un des tool calls a un paramètre dont la valeur
      // est identique à sa propre description Zod, le modèle a inventé une donnée manquante
      // plutôt que de demander une clarification. On n'exécute rien pour ce tour — mieux vaut
      // redemander l'info que d'agir avec un paramètre que l'utilisateur n'a jamais fourni.
      for (const tc of toolCalls) {
        const candidateAction = allowed.find((a) => a.name === tc.toolName);
        if (!candidateAction) continue;
        const champManquant = detecterParametreHallucine(candidateAction, tc.input as Record<string, unknown>);
        if (champManquant) {
          this.audit.journaliser({
            actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
            actionName: candidateAction.name, origin: 'AI_ASSISTANT', outcome: 'REFUSE',
            refusalReason: 'parametre_hallucine', parametersSummary: tc.input, triggeringMessage: message,
          });
          const clarification = `Il me manque une information pour continuer : ${champManquant}. Peux-tu préciser ?`;
          this.saveTurn(conversationId, user.schoolId, user.userId, 'assistant', clarification);
          res.json({ success: true, type: 'message', response: clarification, conversationId });
          return;
        }
      }

      logQuery('ACTION');
      const executed: ActionExecutee[] = [];
      const pending: ActionEnAttente[] = [];

      for (const tc of toolCalls) {
        // DOUBLE-VÉRIFICATION SERVEUR : l'action doit figurer dans le catalogue autorisé.
        const action = allowed.find((a) => a.name === tc.toolName);
        if (!action) {
          this.audit.journaliser({
            actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
            actionName: tc.toolName, origin: 'AI_ASSISTANT', outcome: 'REFUSE',
            refusalReason: 'action_hors_catalogue_autorise', parametersSummary: tc.input, triggeringMessage: message,
          });
          executed.push({ error: `Action « ${tc.toolName} » non autorisée pour votre rôle.`, actionType: tc.toolName });
          continue;
        }
        const input = tc.input;

        if (action.destructive) {
          let summary = 'Cette action est irréversible.';
          try {
            if (action.summarizeDestructive) summary = await action.summarizeDestructive(input, ctx);
          } catch (e) {
            executed.push({ error: messageErreur(e) ?? 'Impossible de préparer l\'action.', actionType: action.name });
            continue;
          }
          const log = await this.contextRepo.createActionLog({
            schoolId: user.schoolId,
            userId: user.userId,
            actionType: action.name,
            parameters: input,
            destructive: true,
            status: 'PENDING_CONFIRMATION',
            undoable: false,
          });
          pending.push({ pendingActionId: log.id, actionType: action.name, summary });
        } else {
          try {
            const r = await action.execute(input, ctx);
            const undoData = { ...(r.undoData ?? {}), __section: r.section ?? null, __entity: r.entity ?? null };
            const log = await this.contextRepo.createActionLog({
              schoolId: user.schoolId,
              userId: user.userId,
              actionType: action.name,
              parameters: input,
              destructive: false,
              status: 'EXECUTED',
              undoable: true,
              undoData,
              resultLabel: r.resultLabel,
            });
            this.audit.journaliser({
              actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
              actionName: action.name, origin: 'AI_ASSISTANT', outcome: 'SUCCES',
              parametersSummary: input, triggeringMessage: message,
            });
            executed.push({
              actionLogId: log.id,
              actionType: action.name,
              label: r.resultLabel,
              section: r.section ?? null,
              entity: r.entity ?? null,
              undoable: true,
            });
          } catch (e) {
            this.audit.journaliser({
              actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
              actionName: action.name, origin: 'AI_ASSISTANT', outcome: 'ERREUR',
              refusalReason: messageErreur(e), parametersSummary: input, triggeringMessage: message,
            });
            executed.push({ error: messageErreur(e) ?? 'Échec de l\'action.', actionType: action.name });
          }
        }
      }

      // Résumé des actions dans l'historique — pour qu'un tour suivant ("annule ça",
      // "fais pareil pour la 4eC") sache ce qui vient réellement de se passer.
      const actionSummary = [
        ...executed.map((e) => e.error ? `[Échec : ${e.error}]` : `[Action exécutée : ${e.label}]`),
        ...pending.map((p) => `[Action en attente de confirmation : ${p.summary}]`),
      ].join(' ');
      this.saveTurn(
        conversationId, user.schoolId, user.userId, 'assistant',
        [result.text, actionSummary].filter(Boolean).join('\n'),
        toolCalls.map((tc) => ({ name: tc.toolName, input: tc.input })),
      );

      res.json({
        success: true,
        type: pending.length > 0 ? 'confirm' : 'executed',
        response: result.text || null,
        executed,
        pending,
        conversationId,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── POST /api/v2/assistant/confirm-action ───────────────────────────────────
  confirmAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await executerConfirmationAction(req, res, {
        contextRepo: this.contextRepo,
        catalog: this.catalog,
        audit: this.audit,
        buildContext: this.ctx,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── POST /api/v2/assistant/undo-action ──────────────────────────────────────
  undoAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await executerAnnulationAction(req, res, {
        contextRepo: this.contextRepo,
        catalog: this.catalog,
        audit: this.audit,
        buildContext: this.ctx,
      });
    } catch (error) {
      next(error);
    }
  };
}
