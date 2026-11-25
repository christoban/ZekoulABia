/**
 * APPLICATION — Types du module d'interopérabilité statistique MINEDUB (préscolaire/primaire).
 * Voir spec-minedub-interoperabilite.md — format de travail NON OFFICIEL, reconstitué à
 * partir des Annuaires Statistiques MINEDUB publiés (aucun questionnaire officiel
 * téléchargeable n'existe, contrairement à MINESEC). Sortie : rapport PDF de synthèse,
 * jamais un fichier prétendant être le questionnaire officiel.
 */

export interface ChampNonResoluMinedub {
  section: string;
  champ: string;
  raison: string;
}

export interface GenererRapportMinedubCommande {
  schoolId: string;
  generatedByUserId: string;
}

export interface GenererRapportMinedubResultat {
  reportId: string;
  filePath: string;
  champsNonResolus: ChampNonResoluMinedub[];
}
