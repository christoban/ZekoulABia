export interface StudentTransferLifecycleRepository {
  markSourceTransferred(command: {
    transferRequestId: string;
    sourceStudentProfileId: string;
    sourceSchoolId: string;
    targetSchoolId: string;
    completedAt: Date;
  }): Promise<void>;

  /** @returns false si le profil est déjà associé (idempotence explicite côté use case). */
  markTargetReceived(command: {
    transferRequestId: string;
    targetStudentProfileId: string;
    targetSchoolId: string;
    academicYearTarget: string;
    completedAt: Date;
  }): Promise<boolean>;
}
