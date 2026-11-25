export interface ProcesVerbalData {
  school: { name: string; city?: string | null };
  academicYear: string;
  academicPeriod: string;
  className: string;
  presidedBy: string;
  date: string;
  students: Array<{
    studentId: string;
    lastName: string;
    firstName: string;
    average: number | null;
    decision: string;
    observations: string | null;
  }>;
  statistics: {
    totalStudents: number;
    passCount: number;
    repeatCount: number;
    deliberationCount: number;
    successRate: number;
  };
}
