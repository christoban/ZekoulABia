export interface AcademicEventData {
  id: string;
  schoolId: string;
  createdById: string;
  type: string;
  category: string;
  title: string;
  description: string | null;
  targetRoles: string[];
  level: string | null;
  openDate: Date | null;
  closeDate: Date | null;
  status: string;
  linkedResourceId: string | null;
  entranceExamSessionId?: string | null;
  triggeredById: string | null;
  triggeredAt: Date | null;
  reminderSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicEventListData extends AcademicEventData {
  createdBy: { firstName: string; lastName: string };
  triggeredBy: { firstName: string; lastName: string } | null;
}

export interface AcademicEventRepository {
  creer(data: {
    schoolId: string;
    createdById: string;
    type: string;
    category: string;
    title: string;
    description?: string;
    targetRoles: string[];
    level?: string;
    openDate?: Date;
    closeDate?: Date;
    status: string;
    linkedResourceId?: string | null;
    entranceExamSessionId?: string | null;
  }): Promise<{ id: string }>;

  trouverParId(id: string, schoolId: string): Promise<AcademicEventData | null>;

  mettreAJour(id: string, data: {
    status?: string;
    openDate?: Date;
    closeDate?: Date;
    triggeredById?: string;
    triggeredAt?: Date;
    linkedResourceId?: string | null;
    entranceExamSessionId?: string | null;
    reminderSentAt?: null;
  }): Promise<void>;

  listerTous(schoolId: string): Promise<AcademicEventListData[]>;

  listerActifs(schoolId: string, role: string, dansQuatorzeJours: Date): Promise<{
    id: string;
    type: string;
    category: string;
    title: string;
    description: string | null;
    openDate: Date | null;
    closeDate: Date | null;
    status: string;
  }[]>;

  // --- Méthodes batch pour VerifierEvenementsAcademiquesUseCase (seuils Inngest) ---
  trouverAOuvrir(schoolId: string, maintenant: Date): Promise<AcademicEventData[]>;
  trouverActifsAvecClotureSansRappel(schoolId: string): Promise<AcademicEventData[]>;
  trouverFenetresGlissantes(schoolId: string, maintenant: Date): Promise<AcademicEventData[]>;
  trouverACloturer(schoolId: string, maintenant: Date): Promise<Pick<AcademicEventData, 'id' | 'type' | 'linkedResourceId'>[]>;
  mettreAJourRappel(id: string, date: Date): Promise<void>;
  mettreAJourCloture(id: string, closeDate: Date): Promise<void>;
  mettreAJourStatutEtRessource(id: string, data: { status: string; linkedResourceId: string | null }): Promise<void>;
  cloturerParIds(ids: string[]): Promise<void>;
}
