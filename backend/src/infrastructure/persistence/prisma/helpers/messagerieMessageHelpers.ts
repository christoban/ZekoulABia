import type { ModerationStatus, Prisma, PrismaClient } from '@prisma/client';
import type { MessageData } from '@domain/ports/repositories/MessagerieRepository';
import { USER_PARTICIPANT_SELECT, toParticipantFormat } from './messagerieBroadcastHelpers';

const TAILLE_PAGE = 30;
const TAILLE_RATTRAPAGE_MAX = 200;

const MESSAGE_INCLUDE = {
  sender: { select: USER_PARTICIPANT_SELECT },
  readStatuses: { select: { userId: true, readAt: true } },
} as const;

type MessageAvecRelations = Prisma.MessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;

function mapperMessage(m: MessageAvecRelations): MessageData {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content,
    moderationStatus: m.moderationStatus,
    createdAt: m.createdAt,
    sender: m.sender ? toParticipantFormat(m.sender) : undefined,
    readStatuses: m.readStatuses ?? [],
    isRead: Array.isArray(m.readStatuses) && m.readStatuses.some((r) => r.userId !== m.senderId),
  };
}

export async function listerMessagesPourConversationOp(
  prisma: PrismaClient,
  cmd: { conversationId: string; estSupervision: boolean; appelantId: string; since?: Date; page: number },
): Promise<{ messages: MessageData[]; mode: 'rattrapage' | 'page'; page?: number }> {
  const filtreModeration: Prisma.MessageWhereInput = cmd.estSupervision
    ? {}
    : { OR: [{ moderationStatus: 'APPROVED' as ModerationStatus }, { senderId: cmd.appelantId }] };

  if (cmd.since) {
    const messages = await prisma.message.findMany({
      where: { conversationId: cmd.conversationId, createdAt: { gt: cmd.since }, ...filtreModeration },
      orderBy: { createdAt: 'asc' },
      take: TAILLE_RATTRAPAGE_MAX,
      include: MESSAGE_INCLUDE,
    });
    return { messages: messages.map(mapperMessage), mode: 'rattrapage' };
  }

  const page = Math.max(1, cmd.page);
  const messagesDesc = await prisma.message.findMany({
    where: { conversationId: cmd.conversationId, ...filtreModeration },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * TAILLE_PAGE,
    take: TAILLE_PAGE,
    include: MESSAGE_INCLUDE,
  });
  return { messages: messagesDesc.reverse().map(mapperMessage), mode: 'page', page };
}

export async function listerEnAttenteModerationOp(prisma: PrismaClient, schoolId: string): Promise<unknown[]> {
  return prisma.message.findMany({
    where: { moderationStatus: 'PENDING', conversation: { schoolId } },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      conversation: { select: { id: true, type: true, name: true, classId: true } },
    },
  });
}

export async function modererMessageOp(
  prisma: PrismaClient,
  messageId: string,
  data: { moderationStatus: string; moderatedById: string; moderationReason: string | null },
): Promise<MessageData> {
  return prisma.message.update({
    where: { id: messageId },
    data: {
      moderationStatus: data.moderationStatus as ModerationStatus,
      moderatedById: data.moderatedById,
      moderationReason: data.moderationReason,
    },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });
}

export async function trouverMessagesNonLusOp(
  prisma: PrismaClient,
  conversationId: string,
  seuilDate: Date,
  userId: string,
): Promise<{ id: string }[]> {
  return prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { lte: seuilDate },
      senderId: { not: userId },
      readStatuses: { none: { userId } },
    },
    select: { id: true },
  });
}

export async function marquerMessagesLusOp(
  prisma: PrismaClient,
  messageIds: string[],
  userId: string,
): Promise<number> {
  const resultat = await prisma.messageReadStatus.createMany({
    data: messageIds.map((messageId) => ({ messageId, userId })),
    skipDuplicates: true,
  });
  return resultat.count;
}

export async function marquerNotificationsConversationLuesOp(
  prisma: PrismaClient,
  params: { userId: string; schoolId: string; conversationId: string },
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      userId: params.userId,
      schoolId: params.schoolId,
      type: 'COMMUNICATION',
      readAt: null,
      metadata: { path: ['conversationId'], equals: params.conversationId },
    },
    data: { readAt: new Date() },
  });
}
