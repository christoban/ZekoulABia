export interface TransferSnapshotBuildResult {
  snapshotId: string;
  payloadEncrypted: string;
  schemaVersion: string;
  categories: string[];
  checksum: string;
  generatedAt: Date;
  deleteAfter: Date;
}

export interface TransferSnapshotBuilderPort {
  buildApprovedSnapshot(input: {
    transferRequestId: string;
    sourceSchoolId: string;
    targetSchoolId: string;
    sourceStudentProfileId: string;
  }): Promise<TransferSnapshotBuildResult>;

  readForTargetSchool(input: {
    snapshotId: string;
    transferRequestId: string;
    targetSchoolId: string;
  }): Promise<TransferSnapshotBuildResult>;

  deleteExpired(now: Date): Promise<number>;
}
