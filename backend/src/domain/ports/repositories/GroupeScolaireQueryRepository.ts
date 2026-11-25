export type SchoolKpis = {
  effectifs: number;
  tauxReussite: number;
  revenus: number;
  tauxAbsenteisme: number;
};

export interface SourceUserInfo {
  id: string;
  schoolId: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  studentProfile?: {
    id: string;
    niveau?: string | null;
    parentContacts?: { email: string | null; phone: string | null }[];
  } | null;
}

export interface SourceTeacherInfo {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

export interface GroupeScolaireQueryRepository {
  listerEcolesDuGroupe(groupId: string): Promise<{ id: string; name: string; city?: string | null; region?: string | null; type?: string | null; plan?: string | null; status?: string | null }[]>;
  listerEcolesDuGroupeIds(groupId: string): Promise<{ id: string }[]>;
  ecoleAppartientAuGroupe(groupId: string, schoolId: string): Promise<boolean>;
  trouverSourceUserAvecProfil(userId: string): Promise<SourceUserInfo | null>;
  trouverSourceEnseignant(userId: string): Promise<SourceTeacherInfo | null>;
  trouverClasseParNiveau(schoolId: string, niveau: string): Promise<{ id: string } | null>;
  trouverEcoleDetail(schoolId: string): Promise<{ id: string; name: string; city?: string | null; region?: string | null; type?: string | null; plan?: string | null; status?: string | null } | null>;
  rechercherPersonne(cmd: { schoolId: string; role: 'STUDENT' | 'TEACHER'; recherche: string }): Promise<{ id: string; name: string }[]>;
  calculerKpisEcole(schoolId: string): Promise<SchoolKpis>;
  listerNomsEcoles(ids: string[]): Promise<{ id: string; name: string }[]>;
  listerNomsUsers(ids: string[]): Promise<{ id: string; firstName: string; lastName: string; role?: string }[]>;
}