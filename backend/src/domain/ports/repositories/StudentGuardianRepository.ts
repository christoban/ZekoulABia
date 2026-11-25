export interface GuardianCandidate {
  studentProfileId: string;
  schoolId: string;
  parentProfileId: string;
  phone: string | null;
  phoneVerified: boolean;
}

export interface StudentGuardianRepository {
  findGuardiansByStudent(studentProfileId: string, schoolId: string): Promise<GuardianCandidate[]>;
  setPrimaryGuardian(command: {
    studentProfileId: string;
    schoolId: string;
    parentProfileId: string;
  }): Promise<void>;
}
