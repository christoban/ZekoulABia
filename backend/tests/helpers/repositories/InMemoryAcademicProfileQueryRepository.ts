import type {
  AcademicProfileQueryPort,
  AcademicProfileData,
} from '@domain/ports/repositories/AcademicProfileQueryPort';

export class InMemoryAcademicProfileQueryRepository implements AcademicProfileQueryPort {
  private data: AcademicProfileData[] = [];

  constructor(data: AcademicProfileData[] = []) {
    this.data = data;
  }

  async obtenirProfilAcademique(
    _studentId: string,
    _schoolId: string,
    _academicYearId: string,
  ): Promise<AcademicProfileData | null> {
    return this.data[0] ?? null;
  }
}
