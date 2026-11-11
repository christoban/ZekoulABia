export interface OutboundMessagingContext {
  schoolId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
}

export interface OutboundMessagingPolicy {
  estActive(contexte?: OutboundMessagingContext): Promise<boolean>;
}
