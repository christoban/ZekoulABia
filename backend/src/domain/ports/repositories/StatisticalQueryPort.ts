/**
 * StatisticalQueryPort — lectures massives pour les déclarations statistiques MINESEC/MINEDUB.
 * Port de lecture dédié : les fonctions `resolve*` (resolveAutoFields, resolvePersonnelFields,
 * resolvePrimaryAutoFields) ne font que du matching/calcul métier en couche application ; la
 * récupération des données brutes (effectifs, identification, finances, personnels) vit ici.
 */

/** Niveaux du cycle secondaire couverts par la feuille ESG. */
export const NIVEAUX_ESG = ['6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle'] as const;

/** Niveaux anglophones du secondaire couverts par la feuille Students_ESG_Eng. */
export const NIVEAUX_ESG_EN = ['Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'LowerSixth', 'UpperSixth'] as const;

/** Niveaux du cycle primaire (FR + EN) couverts par le rapport MINEDUB. */
export const NIVEAUX_PRIMAIRES_FR = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;
export const NIVEAUX_PRIMAIRES_EN = ['Class1', 'Class2', 'Class3', 'Class4', 'Class5', 'Class6'] as const;
export const NIVEAUX_PRIMAIRES = [...NIVEAUX_PRIMAIRES_FR, ...NIVEAUX_PRIMAIRES_EN] as const;

export interface EleveEsgRow {
  gender: string | null;
  dateOfBirth: Date | null;
  niveau: string;
  serie: string | null;
  filiere: string | null;
  lv2Name: string | null;
}

export interface ElevePrimaireRow {
  gender: string | null;
  dateOfBirth: Date | null;
  niveau: string;
}

export interface EcoleIdentification {
  name: string;
  subdomain: string;
  city: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  educationType: string;
  ownership: string;
  subsystem: string;
}

export interface FeePlanRow {
  feeType: string;
  level: string | null;
  amount: number;
}

export interface PersonnelRow {
  firstName: string;
  lastName: string;
  staffTitle: string | null;
  specialization: string[];
  employeeFile: {
    dateNaissance: Date | null;
    gender: string | null;
    diplomes: unknown[];
    numeroCNPS: string | null;
    typeContrat: string | null;
    echelonActuel: string | null;
    dateEmbauche: Date | null;
  } | null;
}

export interface StatisticalQueryPort {
  /** Élèves actifs des niveaux secondaires (ESG) : gender, naissance, niveau/série/filière, LV2. */
  listerElevesEsg(schoolId: string): Promise<EleveEsgRow[]>;

  /** Élèves actifs des niveaux primaires : gender, naissance, niveau. */
  listerElevesPrimaire(schoolId: string): Promise<ElevePrimaireRow[]>;

  /** Identification de l'établissement (nom, ville, adresse, téléphone, type, propriété). */
  trouverEcole(schoolId: string): Promise<EcoleIdentification | null>;

  /** Plans de frais APEE_PTA / INSCRIPTION (cycle → montant). */
  listerFeePlans(schoolId: string): Promise<FeePlanRow[]>;

  /** Personnel actif (TEACHER/STAFF/ADMIN) avec fiche employé complète. */
  listerPersonnel(schoolId: string): Promise<PersonnelRow[]>;
}
