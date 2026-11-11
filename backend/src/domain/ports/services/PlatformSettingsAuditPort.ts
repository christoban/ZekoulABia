export interface PlatformSettingsAuditPort {
  enregistrerChangement(params: {
    masterUserId: string;
    ipAddress?: string | null;
    avant: boolean;
    apres: boolean;
  }): Promise<void>;
}
