export interface SuppressedOutboundMessageEntry {
  id: string;
  channel: string;
  eventType: string;
  recipientMasked: string;
  schoolId?: string | null;
  createdAt: Date;
}

export interface SuppressedOutboundMessageRepository {
  enregistrer(params: {
    channel: string;
    eventType: string;
    recipientMasked: string;
    schoolId?: string | null;
  }): Promise<void>;
  lister(limit: number, schoolId?: string | null): Promise<SuppressedOutboundMessageEntry[]>;
}
