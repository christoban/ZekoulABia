import type { SuppressedOutboundMessageRepository } from '@domain/ports/repositories/SuppressedOutboundMessageRepository';
import { PrismaSuppressedOutboundMessageRepository } from '../../persistence/prisma/PrismaSuppressedOutboundMessageRepository';
import { prisma } from '../../../config/prisma';

const depot: SuppressedOutboundMessageRepository = new PrismaSuppressedOutboundMessageRepository(prisma);

// Masquage du destinataire : jamais de contenu ni d'adresse complète en base (décision 4).
export function masquerDestinataire(destinataire: string): string {
  const valeur = destinataire.trim();
  if (valeur.includes('@')) {
    const [local, domaine] = valeur.split('@');
    return `${local.slice(0, 2)}***@${domaine}`;
  }
  const chiffres = valeur.replace(/\D/g, '');
  if (chiffres.length >= 5) return `${chiffres.slice(0, 3)}***${chiffres.slice(-2)}`;
  return '***';
}

export async function enregistrerMessageSupprime(params: {
  channel: string;
  eventType: string;
  recipient: string;
  schoolId?: string | null;
}): Promise<void> {
  try {
    await depot.enregistrer({
      channel: params.channel,
      eventType: params.eventType,
      recipientMasked: masquerDestinataire(params.recipient),
      schoolId: params.schoolId ?? null,
    });
  } catch (error) {
    // Jamais bloquant : la suppression d'envoi ne doit pas faire échouer le flux métier.
    console.error('[Mode test] enregistrement du message supprimé échoué:', error instanceof Error ? error.message : error);
  }
}
