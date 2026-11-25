import type { UserRole } from '@domain/types/enums';

export interface AnnonceData {
  id: string;
  schoolId: string;
  authorId: string;
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  author?: { id: string; firstName: string; lastName: string; role: string } | null;
}

export interface CreerAnnonceData {
  schoolId: string;
  authorId: string;
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned: boolean;
  expiresAt: Date | null;
}

export interface ModifierAnnonceData {
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned: boolean;
  expiresAt: Date | null;
}

export interface AnnonceAuteurRef {
  id: string;
  authorId: string;
}

export interface AnnouncementRepository {
  creer(data: CreerAnnonceData): Promise<AnnonceData>;
  lister(schoolId: string, role: string): Promise<AnnonceData[]>;
  trouverParId(announcementId: string, schoolId: string): Promise<AnnonceAuteurRef | null>;
  modifier(announcementId: string, data: ModifierAnnonceData): Promise<AnnonceData>;
  supprimer(announcementId: string): Promise<AnnonceData | void>;
  purgerExpirees(seuil: Date): Promise<{ count: number }>;
}