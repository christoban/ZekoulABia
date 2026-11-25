/**
 * SERVICE PORT — Création de classe
 * Interface minimaliste pour l'injection de dépendance (hexagonal).
 * Les types sont définis ici (domaine) pour que les couches supérieures
 * importent depuis domain, jamais l'inverse.
 */

export interface CreerClasseCommande {
  schoolId: string;
  academicYearId?: string;
  name: string;
  level?: string;
  serie?: string;
  filiere?: string;
  sectionId?: string;
  capacity?: number;
}

export interface CreerClasseResultat {
  classeId: string;
  name: string;
  nomComplet: string;
}

export interface CreerClasseService {
  execute(commande: CreerClasseCommande): Promise<CreerClasseResultat>;
}
