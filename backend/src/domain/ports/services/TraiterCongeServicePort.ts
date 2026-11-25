export interface TraiterCongeServicePort {
  traiterDemandeConge(
    schoolId: string,
    requestId: string,
    statut: 'APPROVED' | 'REJECTED',
    validatedById: string | undefined,
  ): Promise<{ id: string; statut: string }>;
}
