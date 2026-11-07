export interface TransferFeatureFlagPort {
  isEnabled(schoolId: string): Promise<boolean>;
}
