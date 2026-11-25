/**
 * DOMAIN LAYER — Entité Publication (Babillard Officiel)
 * Respecte les conventions d'architecture hexagonale du projet ZekoulABia.
 */

export type PublicationType = 'ANNONCE' | 'RESULTATS';

export type PublicationCorpsFormat = 'MARKDOWN' | 'HTML_SAFE';

export type PublicationCategorie =
  | 'COMMUNIQUE'
  | 'CIRCULAIRE'
  | 'EXAMENS'
  | 'EVENEMENT'
  | 'VIE_SCOLAIRE'
  | 'ADMINISTRATIF';

export type PublicationPriorite = 'NORMALE' | 'IMPORTANTE' | 'URGENTE';

export type PublicationStatut =
  | 'BROUILLON'
  | 'EN_ATTENTE'
  | 'PROGRAMMEE'
  | 'PUBLIEE'
  | 'ARCHIVEE';

export type PublicationDureeVisibilite =
  | 'PERMANENT'
  | 'J3'
  | 'J7'
  | 'J15'
  | 'J30'
  | 'PERSONNALISEE';

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

export interface PublicationProps {
  id: string;
  tenantId: string;
  type: PublicationType;
  titre: string;
  corps: string;
  corpsFormat: PublicationCorpsFormat;
  categorie: PublicationCategorie;
  priorite: PublicationPriorite;
  audience: PublicationAudience;
  epinglee: boolean;
  statut: PublicationStatut;
  publieeLe: Date;
  programmeeLe?: Date | null;
  dureeVisibilite: PublicationDureeVisibilite;
  expireLe?: Date | null;
  auteurId: string;
  auteurRole?: string | null;
  auteurTitre?: string | null;
  piecesJointes: PieceJointe[];
  payload?: Record<string, unknown> | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  modifieLe?: Date | null;
  deletedAt?: Date | null;
  auteur?: {
    id: string;
    nom: string;
    prenom: string;
    role: string;
    titreOfficiel?: string | null;
  };
  etablissement?: {
    nom: string;
    logoUrl?: string | null;
    ville?: string | null;
    sousSysteme?: string | null;
    devisesActives?: boolean;
    ministereActif?: boolean;
    cachetUrl?: string | null;
  };
}

export class Publication {
  constructor(public readonly props: PublicationProps) {}

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get type(): PublicationType { return this.props.type; }
  get titre(): string { return this.props.titre; }
  get corps(): string { return this.props.corps; }
  get corpsFormat(): PublicationCorpsFormat { return this.props.corpsFormat; }
  get categorie(): PublicationCategorie { return this.props.categorie; }
  get priorite(): PublicationPriorite { return this.props.priorite; }
  get audience(): PublicationAudience { return this.props.audience; }
  get epinglee(): boolean { return this.props.epinglee; }
  get statut(): PublicationStatut { return this.props.statut; }
  get publieeLe(): Date { return this.props.publieeLe; }
  get programmeeLe(): Date | null | undefined { return this.props.programmeeLe; }
  get dureeVisibilite(): PublicationDureeVisibilite { return this.props.dureeVisibilite; }
  get expireLe(): Date | null | undefined { return this.props.expireLe; }
  get auteurId(): string { return this.props.auteurId; }
  get auteurRole(): string | null | undefined { return this.props.auteurRole; }
  get auteurTitre(): string | null | undefined { return this.props.auteurTitre; }
  get piecesJointes(): PieceJointe[] { return this.props.piecesJointes; }
  get payload(): Record<string, unknown> | null | undefined { return this.props.payload; }
  get referenceType(): string | null | undefined { return this.props.referenceType; }
  get referenceId(): string | null | undefined { return this.props.referenceId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get modifieLe(): Date | null | undefined { return this.props.modifieLe; }
  get deletedAt(): Date | null | undefined { return this.props.deletedAt; }

  estExpiree(maintenant: Date = new Date()): boolean {
    if (!this.expireLe) return false;
    return maintenant > this.expireLe;
  }

  estActive(maintenant: Date = new Date()): boolean {
    if (this.deletedAt) return false;
    if (this.statut === 'ARCHIVEE' || this.statut === 'BROUILLON') return false;
    if (this.statut === 'PROGRAMMEE') {
      return !!this.programmeeLe && maintenant >= this.programmeeLe;
    }
    if (this.estExpiree(maintenant)) return false;
    return this.statut === 'PUBLIEE';
  }
}
