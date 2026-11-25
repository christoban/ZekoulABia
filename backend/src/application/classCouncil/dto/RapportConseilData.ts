export interface RapportConseilData {
  school: { name: string };
  academicYear: string;
  academicPeriod: string;
  className: string;
  classLevel?: string | null;
  presidedBy: string;
  status: string;
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
    classAverage: number;
    highestAverage: number;
    lowestAverage: number;
  };
}
