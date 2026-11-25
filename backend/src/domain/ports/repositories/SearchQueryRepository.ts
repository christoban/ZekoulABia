/**
 * DOMAIN LAYER — Port de lecture pour la recherche globale (SearchController).
 *
 * Regroupe toutes les lectures Prisma du controller (users / classes / subjects
 * / activites). Lecture seule — jamais d'écriture. Existe séparément pour ne pas
 * injecter PrismaClient dans le controller (cohérence hexagonale).
 */

export interface SearchUserRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  createdAt: Date;
}

export interface SearchClassRow {
  id: string;
  name: string;
  createdAt: Date;
}

export interface SearchSubjectRow {
  id: string;
  name: string;
  code: string | null;
  createdAt: Date;
}

export interface SearchActivityRow {
  id: string;
  action: string;
  description: string | null;
  createdAt: Date;
}

export interface SearchQueryRepository {
  searchUsers(schoolId: string | null, q: string, take: number): Promise<SearchUserRow[]>;
  searchClasses(schoolId: string | null, q: string, take: number): Promise<SearchClassRow[]>;
  searchSubjects(schoolId: string | null, q: string, take: number): Promise<SearchSubjectRow[]>;
  searchActivities(schoolId: string | null, q: string, take: number): Promise<SearchActivityRow[]>;
}
