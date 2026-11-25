export type Language = "fr" | "en";

export type SchoolInfo = {
  name: string;
  ville?: string;
  motto?: string;
  logoUrl?: string;
  bp?: string;
  tel?: string;
};

export type CertificatData = {
  documentId: string;
  school: SchoolInfo;
  studentName: string;
  matricule?: string;
  className: string;
  yearName: string;
  dateOfBirth?: string;
  gender?: string;
  status: string;
  generatedAt: Date;
  verifyUrl: string;
  language?: Language;
};

export type CarteData = {
  documentId: string;
  school: SchoolInfo;
  studentName: string;
  matricule?: string;
  className: string;
  yearName: string;
  photoUrl?: string;
  photoBuffer?: Buffer | null;
  emergencyContact?: string;
  emergencyPhone?: string;
  generatedAt: Date;
  verifyUrl: string;
  language?: Language;
};

export type LettreTransfertData = {
  documentId: string;
  school: SchoolInfo;
  studentName: string;
  matricule?: string;
  className: string;
  yearName: string;
  motif: string;
  lastAverage?: number;
  generatedAt: Date;
  verifyUrl: string;
  language?: Language;
};
