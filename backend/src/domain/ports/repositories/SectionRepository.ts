export interface SectionRepository {
  findById(id: string): Promise<{
    id: string;
    schoolId: string;
    code: string;
  } | null>;
}