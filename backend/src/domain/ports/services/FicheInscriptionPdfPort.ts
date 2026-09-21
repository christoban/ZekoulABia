/**
 * DOMAIN LAYER — Port pour la génération de la fiche d'inscription PDF officielle.
 */

export interface PieceDossierFichePdf {
  code: string;
  libelle: string;
  obligatoire: boolean;
  received: boolean;
}

export interface FicheInscriptionPdfData {
  schoolName: string;
  schoolCode?: string | null;
  onboardingId: string;
  token: string;
  formUrl: string;
  status: string;
  nom: string;
  prenom?: string | null;
  dateNaissance?: string | null;
  gender?: string | null;
  classeNom?: string | null;
  numeroInterne?: string | null;
  contactTelephone?: string | null;
  contactEmail?: string | null;
  parentContactTelephone?: string | null;
  parentContactEmail?: string | null;
  completenessScore?: number | null;
  validableSousReserve?: boolean;
  pieces: PieceDossierFichePdf[];
}

export interface FicheInscriptionPdfPort {
  generer(data: FicheInscriptionPdfData): Promise<Buffer>;
}
