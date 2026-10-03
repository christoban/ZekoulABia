/**
 * DOMAIN LAYER — Port Repository CahierDeTexte
 */
export interface CahierDeTexteProps {
  id: string;
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
  chapitreId: string | null;
  date: Date;
  contenuRealise: string | null;
  contenuLibre: string | null;
  devoirsDonnes: string | null;
  createdAt: Date;
  teacher?: { id: string; firstName: string; lastName: string };
  class?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string | null };
  academicYear?: { id: string; name: string };
}

export type CahierDeTexteCreateData = Omit<CahierDeTexteProps, 'id' | 'createdAt'>;

export interface CahierDeTexteUpdateData {
  id: string;
  contenuRealise?: string | null;
  contenuLibre?: string | null;
  devoirsDonnes?: string | null;
}

export interface CahierDeTexteFilters {
  classId?: string;
  enseignantId?: string;
  subjectId?: string;
  academicYearId?: string;
  depuis?: Date;
  jusqua?: Date;
  since?: Date;
  orderDate?: 'asc' | 'desc';
  take?: number;
}

export interface RapportCahierEntry {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  date: Date;
  chapitreId: string | null;
  teacher: CahierDeTexteProps['teacher'];
  class: CahierDeTexteProps['class'];
  subject: CahierDeTexteProps['subject'];
}

export interface RapportFilters {
  academicYearId?: string;
  teacherId?: string;
  classId?: string;
  subjectIds?: string[];
}

export interface CahierDeTexteRepository {
  findByFilters(schoolId: string, filters: CahierDeTexteFilters): Promise<CahierDeTexteProps[]>;
  create(data: CahierDeTexteCreateData): Promise<CahierDeTexteProps>;
  findForRapport(schoolId: string, filters: RapportFilters): Promise<RapportCahierEntry[]>;
}
