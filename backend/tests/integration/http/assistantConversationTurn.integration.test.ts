/**
 * Test d'intégration — AssistantController.saveTurn, touché par le retrait du cast
 * `(this.prisma as any)` sur la colonne JSON `AssistantConversationTurn.toolCalls`.
 * Vérifie sur la vraie base de test que l'écriture (fire-and-forget) persiste bien un tableau
 * d'appels d'outils une fois le cast remplacé par un typage `Prisma.InputJsonValue` précis, et
 * que la relecture (loadHistoryBlock) restitue le contenu correctement.
 *
 * `saveTurn`/`loadHistoryBlock` sont privées et ne passent pas par une route HTTP dédiée
 * (elles ne sont invoquées qu'à l'intérieur du flux `/assistant/chat`, qui appelle un modèle
 * Groq externe — non déterministe en test). On instancie donc directement le contrôleur
 * (dépendances : prisma + catalog, tous deux disponibles) et on appelle ces méthodes via un
 * cast, contre la vraie base Prisma — ce qui exerce réellement l'écriture concernée par le
 * correctif, sans dépendre d'un appel réseau externe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'crypto';
import { AssistantController } from '../../../src/infrastructure/http/controllers/AssistantController.ts';
import { PrismaAssistantContextQueryRepository } from '@infrastructure/persistence/prisma/PrismaAssistantContextQueryRepository';
import { PrismaCopilotDataGateway } from '@infrastructure/persistence/prisma/copilot/PrismaCopilotDataGateway';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

interface AssistantControllerTestAccess {
  saveTurn(conversationId: string, schoolId: string, userId: string, role: 'user' | 'assistant', content: string, toolCalls?: unknown): void;
  loadHistoryBlock(conversationId: string | null, schoolId: string, userId: string): Promise<string>;
}

let schoolId: string;
let userId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'assistantTurns');
  schoolId = school.id;
  const user = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  userId = user.id;
});

afterAll(async () => {
  await prismaTest.assistantConversationTurn.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

const attendreEcriture = async (predicate: () => Promise<boolean>, timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('Timeout en attendant l\'écriture asynchrone du tour de conversation');
};

describe('AssistantController.saveTurn — écriture JSON toolCalls sans cast', () => {
  it('persiste un tour utilisateur puis un tour assistant avec ses toolCalls, relisibles via loadHistoryBlock', async () => {
    const controller = new AssistantController(
      new PrismaAssistantContextQueryRepository(prismaTest),
      [],
      new AIActionAuditAdapter(prismaTest),
      new PrismaCopilotDataGateway(prismaTest),
    ) as unknown as AssistantControllerTestAccess;
    const conversationId = randomUUID();
    const toolCalls = [{ name: 'creer_classe', input: { name: '6ème A', capacity: 45 } }];

    controller.saveTurn(conversationId, schoolId, userId, 'user', 'Crée une classe de 6ème A');
    await attendreEcriture(async () => (await prismaTest.assistantConversationTurn.count({ where: { conversationId } })) === 1);
    controller.saveTurn(conversationId, schoolId, userId, 'assistant', 'Classe créée. [Action exécutée : Créer 6ème A]', toolCalls);
    await attendreEcriture(async () => (await prismaTest.assistantConversationTurn.count({ where: { conversationId } })) === 2);

    const turns = await prismaTest.assistantConversationTurn.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    expect(turns).toHaveLength(2);
    const turnUser = turns.find(t => t.role === 'user');
    const turnAssistant = turns.find(t => t.role === 'assistant');
    expect(turnUser?.toolCalls).toBeNull();
    expect(turnAssistant?.toolCalls).toEqual(toolCalls);

    const historyBlock = await controller.loadHistoryBlock(conversationId, schoolId, userId);
    expect(historyBlock).toContain('Crée une classe de 6ème A');
    expect(historyBlock).toContain('Classe créée');
  });
});
