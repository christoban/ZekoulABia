/**
 * APPLICATION — Use case : Rechercher le matricule d'un élève sur cartescolaire.cm
 *
 * Sens réel confirmé par inspection du site (2026-07) : on donne nom complet + code
 * établissement MINESEC, le site retourne le matricule (+ classe, date de naissance, sexe).
 * Ne modifie JAMAIS le profil élève directement — retourne l'information trouvée pour que
 * l'admin la confirme explicitement (même principe que la confirmation fuzzy matching :
 * jamais d'association automatique sans validation humaine). La confirmation elle-même se
 * fait via l'endpoint existant PATCH /students/:id/matricule, pas ici.
 */
import type { MatriculeImportRepository } from '@domain/ports/repositories/MatriculeImportRepository';
import type { CarteScolaireService } from '@domain/ports/services/CarteScolaireService';

export interface VerifierMatriculeResultat {
  trouve: boolean;
  /** true si la requête a réellement abouti (site joignable, page reconnue). */
  verified: boolean;
  matricule?: string;
  nomComplet?: string;
  classe?: string;
  dateOfBirth?: string;
  gender?: 'M' | 'F';
  etablissement?: string;
  /** Matricule déjà enregistré en base, si différent de celui trouvé — signale un conflit à trancher. */
  conflitMatriculeExistant?: string;
  message: string;
}

export class VerifierMatriculeUseCase {
  constructor(
    private readonly matriculeRepository: MatriculeImportRepository,
    private readonly carteScolaireService: CarteScolaireService,
  ) {}

  async execute(schoolId: string, studentProfileId: string): Promise<VerifierMatriculeResultat> {
    const profile = await this.matriculeRepository.trouverProfilParId(studentProfileId, schoolId);
    if (!profile) throw new Error('Élève introuvable');

    const school = await this.matriculeRepository.trouverEcoleCodeMinesec(schoolId);
    if (!school?.minesecSchoolCode) {
      throw new Error(
        "Le code établissement MINESEC n'est pas configuré pour cette école. " +
        "Renseignez-le dans les paramètres avant de pouvoir rechercher un matricule sur cartescolaire.cm."
      );
    }

    const studentName = `${profile.user?.lastName ?? ''} ${profile.user?.firstName ?? ''}`.trim();
    const result = await this.carteScolaireService.rechercherMatricule(studentName, school.minesecSchoolCode);

    if (!result.verified) {
      return {
        trouve: false,
        verified: false,
        message: 'Vérification automatique impossible (site injoignable ou format inattendu). Vérifiez manuellement sur cartescolaire.cm.',
      };
    }

    if (!result.trouve) {
      return {
        trouve: false,
        verified: true,
        message: `Aucun résultat trouvé sur cartescolaire.cm pour "${studentName}". Vérifiez l'orthographe ou le code établissement.`,
      };
    }

    const conflitMatriculeExistant = profile.matricule && profile.matricule !== result.matricule
      ? profile.matricule
      : undefined;

    return {
      trouve: true,
      verified: true,
      matricule: result.matricule,
      nomComplet: result.nomComplet,
      classe: result.classe,
      dateOfBirth: result.dateOfBirth,
      gender: result.gender,
      etablissement: result.etablissement,
      conflitMatriculeExistant,
      message: conflitMatriculeExistant
        ? `Trouvé : ${result.matricule} — différent du matricule déjà enregistré ("${conflitMatriculeExistant}"). Vérifiez avant de confirmer.`
        : `Trouvé : ${result.matricule}. Confirmez pour l'associer à cet élève.`,
    };
  }
}
