export interface ConvocationPdfData {
  schoolName: string;
  sessionName: string;
  examDate: Date;
  candidateNumber: string;
  candidateFullName: string;
  dateOfBirth?: Date | null;
  originSchool?: string | null;
  roomName?: string | null;
  deskNumber?: number | null;
  subjects?: { name: string; coefficient: number; maxScore: number }[];
  instructions?: string[];
  verificationUrl?: string;
}

export interface EmargementRoomPdfData {
  schoolName: string;
  sessionName: string;
  examDate: Date;
  roomName: string;
  candidates: {
    candidateNumber: string;
    fullName: string;
    deskNumber?: number | null;
    dateOfBirth?: Date | null;
    originSchool?: string | null;
  }[];
}

export interface EntranceExamPdfPort {
  genererConvocationPdf(data: ConvocationPdfData): Promise<Buffer>;
  genererListeEmargementPdf(data: EmargementRoomPdfData): Promise<Buffer>;
}
