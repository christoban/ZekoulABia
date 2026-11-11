export interface OutboundMessagingPolicy {
  estActive(): Promise<boolean>;
}
