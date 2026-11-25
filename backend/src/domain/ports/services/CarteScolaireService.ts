/**
 * DOMAIN — Port : recherche de matricule et vérification de paiement sur cartescolaire.cm
 *
 * Deux implémentations possibles : scraping automatique ou saisie manuelle.
 *
 * IMPORTANT — sens réel de la recherche publique (confirmé par inspection directe du site,
 * 2026-07) : on donne NOM COMPLET + CODE ÉTABLISSEMENT MINESEC, le site retourne le matricule
 * (et la classe, la date de naissance, le sexe). Ce n'est PAS "je donne un matricule, on me
 * confirme l'identité" — c'est l'inverse. `rechercherMatricule` reflète ce sens réel.
 */
export interface RechercheMatriculeResult {
  trouve: boolean;
  /** true seulement si la requête a réellement abouti (site joignable, page reconnue). */
  verified: boolean;
  matricule?: string;
  nomComplet?: string;
  classe?: string;
  /** Format ISO (AAAA-MM-JJ), tel que retourné par le site. */
  dateOfBirth?: string;
  gender?: 'M' | 'F';
  etablissement?: string;
}

export interface CarteScolairePaymentStatus {
  matricule: string;
  anneeScolaire: string;
  paye: boolean;
  /**
   * true seulement si la requête a réellement abouti et a été interprétée avec succès.
   * false = on n'a AUCUNE information fiable (site injoignable, circuit ouvert, page non
   * reconnue) — dans ce cas `paye: false` ne doit JAMAIS être lu comme "confirmé impayé".
   */
  verified: boolean;
  montant?: number;
  typeFrais?: string;
  datePaiement?: Date;
  operateur?: string;
}

export interface CarteScolaireService {
  /**
   * @param studentName Nom complet de l'élève (nom + prénom, dans l'ordre habituel local).
   * @param schoolCode Code officiel MINESEC de l'établissement (School.minesecSchoolCode).
   */
  rechercherMatricule(studentName: string, schoolCode: string): Promise<RechercheMatriculeResult>;
  checkPaiementStatus(matricule: string, anneeScolaire: string): Promise<CarteScolairePaymentStatus>;
}
