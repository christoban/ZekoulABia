import type { IOrientationRepository, FicheListItem, ListeFichesFilters } from '@domain/ports/repositories/IOrientationRepository';

export interface ListerFichesCommande {
  schoolId:        string;
  classId?:        string;
  riskLevel?:      string;
  status?:         string;
  academicYearId?: string;
  page?:           number;
  limit?:          number;
}

export interface ListerFichesResultat {
  fiches: FicheListItem[];
  total:  number;
  page:   number;
  pages:  number;
}

export class ListerFichesOrientationUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: ListerFichesCommande): Promise<ListerFichesResultat> {
    const page  = Math.max(1, cmd.page ?? 1);
    const limit = Math.min(100, Math.max(1, cmd.limit ?? 20));

    const filters: ListeFichesFilters = {
      schoolId:       cmd.schoolId,
      classId:        cmd.classId,
      riskLevel:      cmd.riskLevel,
      status:         cmd.status,
      academicYearId: cmd.academicYearId,
      page,
      limit,
    };

    const { fiches, total } = await this.repo.findFiches(filters);
    return { fiches, total, page, pages: Math.ceil(total / limit) };
  }
}
