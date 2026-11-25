import { describe, it, expect, beforeEach } from 'bun:test';
import { EnvoyerMessageUseCase } from '@application/messagerie/EnvoyerMessageUseCase';
import { ChangerParametresCanalUseCase } from '@application/messagerie/ChangerParametresCanalUseCase';
import { InMemoryMessagerieRepository } from '../../../helpers/repositories/InMemoryMessagerieRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { RealtimeSocketPort } from '@domain/ports/services/RealtimeSocketPort';

class FakeNotificationService implements NotificationService {
  envoyes: any[] = [];
  async envoyer(payload: any): Promise<void> {
    this.envoyes.push(payload);
  }
  async envoyerAuRole(): Promise<void> {}
  async marquerLue(): Promise<void> {}
  async marquerDelivree(): Promise<boolean> { return true; }
  async marquerConfirmee(): Promise<boolean> { return true; }
}

class FakeRealtimeSocket implements RealtimeSocketPort {
  emits: { room: string; event: string; data: any }[] = [];
  emitter(room: string, event: string, data: any): void {
    this.emits.push({ room, event, data });
  }
}

describe('Messagerie Canaux & Permissions Scolaires', () => {
  let repo: InMemoryMessagerieRepository;
  let notifications: FakeNotificationService;
  let realtime: FakeRealtimeSocket;
  let envoyerUseCase: EnvoyerMessageUseCase;
  let changerSettingsUseCase: ChangerParametresCanalUseCase;

  const schoolId = 'school-1';
  const eleveId = 'student-42';
  const profId = 'teacher-10';
  const classId = 'class-6A';

  beforeEach(async () => {
    repo = new InMemoryMessagerieRepository();
    notifications = new FakeNotificationService();
    realtime = new FakeRealtimeSocket();
    envoyerUseCase = new EnvoyerMessageUseCase(repo, notifications, realtime);
    changerSettingsUseCase = new ChangerParametresCanalUseCase(repo, realtime);

    // Initialiser le canal de classe 6A avec announcementsOnly: true
    await repo.creerCanalClasse(schoolId, classId, '6ème A');
  });

  it('interdit formellement aux élèves de créer ou envoyer des messages privés (DM)', async () => {
    expect(async () => {
      await envoyerUseCase.execute({
        schoolId,
        appelantId: eleveId,
        appelantRole: 'STUDENT',
        clientMessageId: 'msg-private-1',
        content: 'Salut camarade',
        destinataireId: 'student-99',
      });
    }).toThrow('Les élèves ne sont pas autorisés à créer ou utiliser des conversations privées.');
  });

  it('bloque les messages d’élèves dans un canal de classe quand announcementsOnly est activé', async () => {
    expect(async () => {
      await envoyerUseCase.execute({
        schoolId,
        appelantId: eleveId,
        appelantRole: 'STUDENT',
        clientMessageId: 'msg-class-blocked',
        content: 'Est-ce qu’on a cours demain ?',
        conversationId: `conv-class-${classId}`,
      });
    }).toThrow('Ce canal est actuellement réservé aux annonces des enseignants.');
  });

  it('autorise un enseignant à poster un message dans le canal même en mode announcementsOnly', async () => {
    const msg = await envoyerUseCase.execute({
      schoolId,
      appelantId: profId,
      appelantRole: 'TEACHER',
      clientMessageId: 'msg-prof-1',
      content: 'Rappel : devoir de mathématiques demain matin.',
      conversationId: `conv-class-${classId}`,
    });

    expect(msg).toBeDefined();
    expect(msg.content).toBe('Rappel : devoir de mathématiques demain matin.');
  });

  it('permet à l’élève de poster dès que le canal est basculé en discussion ouverte (announcementsOnly: false)', async () => {
    // L'enseignant/admin ouvre la discussion
    await repo.changerParametresCanal(`conv-class-${classId}`, { announcementsOnly: false });

    const msg = await envoyerUseCase.execute({
      schoolId,
      appelantId: eleveId,
      appelantRole: 'STUDENT',
      clientMessageId: 'msg-eleve-allowed',
      content: 'Merci Monsieur pour le rappel !',
      conversationId: `conv-class-${classId}`,
    });

    expect(msg).toBeDefined();
    expect(msg.content).toBe('Merci Monsieur pour le rappel !');
  });

  it('interdit à un élève de modifier les paramètres du canal', async () => {
    expect(async () => {
      await changerSettingsUseCase.execute({
        schoolId,
        appelantId: eleveId,
        appelantRole: 'STUDENT',
        conversationId: `conv-class-${classId}`,
        announcementsOnly: false,
      });
    }).toThrow("Vous n'avez pas l'autorisation de modifier les paramètres de ce groupe.");
  });

  describe('CreerConversationPriveeUseCase', () => {
    let creerConversationPriveeUseCase: any;

    beforeEach(async () => {
      const { CreerConversationPriveeUseCase } = await import('@application/messagerie/CreerConversationPriveeUseCase');
      creerConversationPriveeUseCase = new CreerConversationPriveeUseCase(repo);
    });

    it('interdit à un élève d’initier une conversation privée', async () => {
      expect(async () => {
        await creerConversationPriveeUseCase.execute({
          schoolId,
          appelantId: eleveId,
          appelantRole: 'STUDENT',
          destinataireId: profId,
        });
      }).toThrow('Les élèves ne sont pas autorisés à créer de message privé.');
    });

    it('interdit de créer une conversation avec soi-même', async () => {
      expect(async () => {
        await creerConversationPriveeUseCase.execute({
          schoolId,
          appelantId: profId,
          appelantRole: 'TEACHER',
          destinataireId: profId,
        });
      }).toThrow('Impossible de créer une conversation privée avec soi-même.');
    });

    it('crée une nouvelle conversation privée entre un enseignant et un parent', async () => {
      const parentId = 'parent-1';
      const conv = await creerConversationPriveeUseCase.execute({
        schoolId,
        appelantId: profId,
        appelantRole: 'TEACHER',
        destinataireId: parentId,
      });

      expect(conv).toBeDefined();
      expect(conv.id).toBeDefined();
      expect(conv.type).toBe('PRIVATE');
    });

    it('retourne la conversation existante de façon idempotente sans doublon', async () => {
      const parentId = 'parent-1';
      const conv1 = await creerConversationPriveeUseCase.execute({
        schoolId,
        appelantId: profId,
        appelantRole: 'TEACHER',
        destinataireId: parentId,
      });

      const conv2 = await creerConversationPriveeUseCase.execute({
        schoolId,
        appelantId: profId,
        appelantRole: 'TEACHER',
        destinataireId: parentId,
      });

      expect(conv2.id).toBe(conv1.id);
    });
  });
});

