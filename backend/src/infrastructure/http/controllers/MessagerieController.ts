import type { Request, Response, NextFunction } from 'express';
import type { EnvoyerMessageUseCase } from '@application/messagerie/EnvoyerMessageUseCase';
import type { ListerConversationsUseCase } from '@application/messagerie/ListerConversationsUseCase';
import type { ListerMessagesUseCase } from '@application/messagerie/ListerMessagesUseCase';
import type { MarquerMessagesLusUseCase } from '@application/messagerie/MarquerMessagesLusUseCase';
import type { ModererMessageUseCase } from '@application/messagerie/ModererMessageUseCase';
import type { ListerMessagesEnAttenteModerationUseCase } from '@application/messagerie/ListerMessagesEnAttenteModerationUseCase';
import type { ListerContactsMessagerieUseCase } from '@application/messagerie/ListerContactsMessagerieUseCase';
import type { CompterMessagesNonLusUseCase } from '@application/messagerie/CompterMessagesNonLusUseCase';
import type { ChangerParametresCanalUseCase } from '@application/messagerie/ChangerParametresCanalUseCase';
import type { InitialiserCanauxManquantsUseCase } from '@application/messagerie/InitialiserCanauxManquantsUseCase';
import type { CreerConversationPriveeUseCase } from '@application/messagerie/CreerConversationPriveeUseCase';

export class MessagerieController {
  constructor(
    private readonly envoyerMessage: EnvoyerMessageUseCase,
    private readonly listerConversations: ListerConversationsUseCase,
    private readonly listerMessages: ListerMessagesUseCase,
    private readonly marquerLus: MarquerMessagesLusUseCase,
    private readonly modererMessage: ModererMessageUseCase,
    private readonly listerEnAttenteModeration: ListerMessagesEnAttenteModerationUseCase,
    private readonly listerContacts: ListerContactsMessagerieUseCase,
    private readonly compterMessagesNonLus: CompterMessagesNonLusUseCase,
    private readonly changerParametresCanalUseCase: ChangerParametresCanalUseCase,
    private readonly initialiserCanaux?: InitialiserCanauxManquantsUseCase,
    private readonly creerConversationPrivee?: CreerConversationPriveeUseCase,
  ) {}

  creerConversationPriveeDirecte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { destinataireId } = req.body as { destinataireId?: string };
      if (!destinataireId) {
        res.status(400).json({ success: false, message: 'destinataireId est requis' });
        return;
      }
      if (!this.creerConversationPrivee) {
        res.status(500).json({ success: false, message: 'Service non disponible' });
        return;
      }
      const conv = await this.creerConversationPrivee.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        destinataireId,
      });
      res.json({ success: true, data: conv });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  envoyer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { content, conversationId, destinataireId, clientMessageId } = req.body as {
        content?: string;
        conversationId?: string;
        destinataireId?: string;
        clientMessageId?: string;
      };

      const message = await this.envoyerMessage.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        content: content ?? '',
        conversationId,
        destinataireId,
        clientMessageId: clientMessageId ?? '',
      });

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const conversations = await this.listerConversations.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  };

  listerMessagesConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { page, since } = req.query as { page?: string; since?: string };

      const resultat = await this.listerMessages.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        conversationId: String(req.params['id']),
        page: page ? Number(page) : undefined,
        since: since ? new Date(since) : undefined,
      });

      res.json({ success: true, data: resultat.messages, meta: { mode: resultat.mode } });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  marquerCommeLus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { jusquAMessageId } = req.body as { jusquAMessageId?: string };

      const resultat = await this.marquerLus.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        conversationId: String(req.params['id']),
        jusquAMessageId,
      });

      res.json({ success: true, data: resultat });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  moderer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { decision, motif } = req.body as { decision?: 'APPROVED' | 'REJECTED'; motif?: string };

      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        res.status(400).json({ success: false, message: 'Décision de modération invalide.' });
        return;
      }

      const message = await this.modererMessage.execute({
        schoolId: user.schoolId,
        moderateurId: user.userId,
        moderateurRole: user.role,
        messageId: String(req.params['id']),
        decision,
        motif,
      });

      res.json({ success: true, data: message });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  listerModeration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const messages = await this.listerEnAttenteModeration.execute({
        schoolId: user.schoolId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: messages });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  contacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { q } = req.query as { q?: string };
      const contacts = await this.listerContacts.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        recherche: q,
      });
      res.json({ success: true, data: contacts });
    } catch (error) {
      next(error);
    }
  };

  compterNonLus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const resultat = await this.compterMessagesNonLus.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      next(error);
    }
  };

  changerParametresCanal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { announcementsOnly } = req.body as { announcementsOnly?: boolean };

      if (typeof announcementsOnly !== 'boolean') {
        res.status(400).json({ success: false, message: 'Le paramètre announcementsOnly doit être un booléen.' });
        return;
      }

      const conversation = await this.changerParametresCanalUseCase.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        conversationId: String(req.params['id']),
        announcementsOnly,
      });

      res.json({ success: true, data: conversation });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  initialiserCanauxManquants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
        res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
        return;
      }
      if (!this.initialiserCanaux) {
        res.status(501).json({ success: false, message: 'Initialisation non configurée.' });
        return;
      }
      const result = await this.initialiserCanaux.execute(user.schoolId);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };
}
