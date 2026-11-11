export interface SuppressedOutboundMessageEntry {
  id: string;
  channel: string;
  eventType: string;
  recipientMasked: string;
  createdAt: Date;
}

export interface SuppressedOutboundMessageRepository {
  enregistrer(params: { channel: string; eventType: string; recipientMasked: string }): Promise<void>;
  lister(limit: number): Promise<SuppressedOutboundMessageEntry[]>;
}
