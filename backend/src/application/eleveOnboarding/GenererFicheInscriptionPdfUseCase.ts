/**
 * APPLICATION — Use case : Générer la fiche d'inscription PDF officielle avec QR code.
 *
 * Reproduit la structure complète du dossier :
 * - Informations administratives et académiques
 * - QR code du token (pour suivi et complétion sur mobile)
 * - Liste des pièces justificatives avec état de réception
 * - Emplacement visa et signature de la direction
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type {
  FicheInscriptionPdfPort,
  PieceDossierFichePdf,
} from '@domain/ports/services/FicheInscriptionPdfPort';

export interface GenererFicheInscriptionCommande {
  schoolId: string;
  onboardingId: string;
  baseUrl?: string;
}

export interface FicheInscriptionResultat {
  buffer: Buffer;
  filename: string;
}

export class GenererFicheInscriptionPdfUseCase {
  constructor(
    private readonly onboardingRepo: EleveOnboardingRepository,
    private readonly schoolRepo: SchoolRepository,
    private readonly classeRepo: ClasseRepository,
    private readonly pdfService: FicheInscriptionPdfPort,
  ) {}

  async execute(cmd: GenererFicheInscriptionCommande): Promise<FicheInscriptionResultat> {
    const onboarding = await this.onboardingRepo.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier d\'onboarding introuvable');

    const school = await this.schoolRepo.findById(cmd.schoolId);
    const schoolName = school?.name || 'Établissement Scolaire';
    const schoolCode = school?.subdomain || 'SCH';

    let classeNom: string | null = null;
    if (onboarding.classId) {
      const classe = await this.classeRepo.findById(onboarding.classId);
      classeNom = classe?.nomComplet || classe?.name || null;
    }

    // Récupération des pièces
    const requirements = await this.onboardingRepo.listDocumentRequirements(cmd.schoolId);
    const documents = await this.onboardingRepo.listDocuments(cmd.onboardingId);

    const docsByCode = new Map(documents.map(d => [d.code, d]));
    const pieces: PieceDossierFichePdf[] = requirements
      .filter(r => r.applicableCase === 'TOUS' || r.applicableCase === (onboarding.sourceType ?? 'TOUS'))
      .map(r => {
        const doc = docsByCode.get(r.code);
        return {
          code: r.code,
          libelle: r.libelle,
          obligatoire: r.obligatoire,
          received: doc?.received ?? false,
        };
      });

    const baseUrl = (cmd.baseUrl || 'https://zekoulabia.com').replace(/\/$/, '');
    const formUrl = `${baseUrl}/eleve-onboarding/${onboarding.token}`;

    const submitted = (onboarding.submittedData ?? {}) as Record<string, unknown>;
    const nom = typeof submitted['nom'] === 'string' ? submitted['nom'] : onboarding.nomProvisoire || 'Élève';
    const prenom = typeof submitted['prenom'] === 'string' ? submitted['prenom'] : null;
    const dateNaissance = typeof submitted['dateNaissance'] === 'string' ? submitted['dateNaissance'] : null;
    const gender = typeof submitted['gender'] === 'string' ? submitted['gender'] : null;

    const buffer = await this.pdfService.generer({
      schoolName,
      schoolCode,
      onboardingId: onboarding.id,
      token: onboarding.token,
      formUrl,
      status: onboarding.status,
      nom,
      prenom,
      dateNaissance,
      gender,
      classeNom,
      numeroInterne: onboarding.numeroInterne ?? null,
      contactTelephone: onboarding.contactTelephone,
      contactEmail: onboarding.contactEmail,
      parentContactTelephone: onboarding.parentContactTelephone,
      parentContactEmail: onboarding.parentContactEmail,
      completenessScore: onboarding.completenessScore ?? null,
      validableSousReserve: onboarding.validableSousReserve ?? false,
      pieces,
    });

    const cleanNom = nom.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Fiche_Inscription_${cleanNom}_${onboarding.id.slice(0, 6)}.pdf`;

    return { buffer, filename };
  }
}
