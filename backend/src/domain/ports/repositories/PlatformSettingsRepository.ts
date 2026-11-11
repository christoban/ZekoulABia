export interface PlatformSettings {
  id: string;
  outboundMessagingEnabled: boolean;
  updatedAt: Date;
}

export interface PlatformSettingsRepository {
  get(): Promise<PlatformSettings>;
  updateOutboundMessaging(enabled: boolean): Promise<PlatformSettings>;
}
