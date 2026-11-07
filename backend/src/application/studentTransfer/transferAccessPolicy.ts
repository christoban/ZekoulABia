export interface TransferredStudentAccess {
  canLogin: boolean;
  canReadHistory: boolean;
  canMutateCurrentData: boolean;
  preservePastAttendance: boolean;
  preservePastGrades: boolean;
  preservePayments: boolean;
}

export function getTransferredStudentAccess(status: 'ACTIVE' | 'TRANSFERRED'): TransferredStudentAccess {
  if (status === 'TRANSFERRED') {
    return {
      canLogin: true,
      canReadHistory: true,
      canMutateCurrentData: false,
      preservePastAttendance: true,
      preservePastGrades: true,
      preservePayments: true,
    };
  }

  return {
    canLogin: true,
    canReadHistory: true,
    canMutateCurrentData: true,
    preservePastAttendance: true,
    preservePastGrades: true,
    preservePayments: true,
  };
}
