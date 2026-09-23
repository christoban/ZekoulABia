export type PublicationType = 'ANNONCE' | 'RESULTATS';

export type PublicationPriorite = 'NORMALE' | 'IMPORTANTE' | 'URGENTE';

export type PublicationCategorie =
  | 'COMMUNIQUE'
  | 'CIRCULAIRE'
  | 'EXAMENS'
  | 'EVENEMENT'
  | 'VIE_SCOLAIRE'
  | 'ADMINISTRATIF';

export type PublicationStatut =
  | 'BROUILLON'
  | 'EN_ATTENTE'
  | 'PROGRAMMEE'
  | 'PUBLIEE'
  | 'ARCHIVEE';

export interface PieceJointe {
  id: string;
  nomOriginal: string;
  mime: string;
  taille: number;
  cleStockage: string;
  miniatureCle?: string | null;
  nbPages?: number | null;
  largeur?: number | null;
  hauteur?: number | null;
  ordre: number;
  texteAlternatif?: string | null;
}

export interface PublicationAudience {
  roles: string[];
  niveauIds?: string[];
  classeIds?: string[];
}

export interface PublicationItem {
  id: string;
  tenantId?: string;
  schoolId?: string;
  type: PublicationType;
  titre: string;
  corps: string;
  contenu?: string;
  corpsFormat?: 'MARKDOWN' | 'HTML_SAFE';
  categorie: PublicationCategorie;
  priorite: PublicationPriorite;
  audience?: PublicationAudience;
  audienceRoles?: string[];
  audienceClasses?: string[];
  targetRoles?: string[];
  targetClasses?: string[];
  epinglee?: boolean;
  isPinned?: boolean;
  statut: PublicationStatut;
  publieeLe: string;
  programmeeLe?: string | null;
  dureeVisibilite?: string;
  expireLe?: string | null;
  expiresAt?: string | null;
  auteurId?: string;
  auteurRole?: string | null;
  auteurTitre?: string | null;
  auteur?: {
    id: string;
    nom?: string;
    prenom?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    titreOfficiel?: string;
  };
  numeroReference?: string | null;
  etablissement?: {
    nom?: string;
    logoUrl?: string | null;
    ville?: string | null;
    sousSysteme?: string | null;
    devisesActives?: boolean;
    ministereActif?: boolean;
    cachetUrl?: string | null;
  };
  piecesJointes: PieceJointe[];
  payload?: Record<string, unknown> | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  modifieLe?: string | null;
  isRead?: boolean;
  lecturesCount?: number;
  destinatairesCount?: number;
}

export type Publication = PublicationItem;

export const ROLE_LABELS_FR: Record<string, string> = {
  ADMIN: 'Administration',
  STAFF: 'Personnel administratif',
  TEACHER: 'Enseignants',
  PARENT: "Parents d'élèves",
  STUDENT: 'Élèves',
};

export interface CategorieDetails {
  label: string;
  badgeBg: string;
  badgeColor: string;
}

export const CATEGORIE_CONFIG: Record<PublicationCategorie | 'GENERAL', CategorieDetails> = {
  COMMUNIQUE: { label: 'Communiqué', badgeBg: 'rgba(59, 130, 246, 0.12)', badgeColor: '#2563eb' },
  CIRCULAIRE: { label: 'Circulaire', badgeBg: 'rgba(147, 51, 234, 0.12)', badgeColor: '#9333ea' },
  EXAMENS: { label: 'Examens', badgeBg: 'rgba(245, 158, 11, 0.12)', badgeColor: '#d97706' },
  EVENEMENT: { label: 'Événement', badgeBg: 'rgba(47,143,91,0.12)', badgeColor: 'var(--primary)' },
  VIE_SCOLAIRE: { label: 'Vie scolaire', badgeBg: 'rgba(47,143,91,0.12)', badgeColor: 'var(--primary)' },
  ADMINISTRATIF: { label: 'Administratif', badgeBg: 'rgba(107, 114, 128, 0.12)', badgeColor: '#4b5563' },
  GENERAL: { label: 'Général', badgeBg: 'rgba(107, 114, 128, 0.12)', badgeColor: '#4b5563' },
};

export const BABILLARD_CATEGORIES = CATEGORIE_CONFIG;
