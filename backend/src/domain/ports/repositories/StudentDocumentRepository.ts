export interface VerifiableDocumentData {
  id: string;
  type: string;
  schoolId: string;
  generatedAt: Date;
  dataSnapshot: unknown;
}

export interface StudentDocumentRepository {
  create(data: { type: string; studentId: string; schoolId: string; dataSnapshot: unknown }): Promise<{ id: string }>;
  findById(id: string): Promise<VerifiableDocumentData | null>;
}
