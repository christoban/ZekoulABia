export interface PlatformSettings {
  id: string;
  outboundMessagingEnabled: boolean;
  disabledSchoolIds?: string[];
  updatedAt: Date;
}

export interface PlatformSettingsRepository {
  get(): Promise<PlatformSettings>;
  updateOutboundMessaging(enabled: boolean): Promise<PlatformSettings>;
  updateDisabledSchools?(disabledSchoolIds: string[]): Promise<PlatformSettings>;
}
