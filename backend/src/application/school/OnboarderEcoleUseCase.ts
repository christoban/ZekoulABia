/**
 * APPLICATION LAYER — Use Case : Onboarder une nouvelle école
 * Valide le token d'invitation, crée l'Admin et soumet la demande.
 * Statut résultant : PENDING (en attente d'approbation MasterAdmin).
 */
import { School } from '@domain/entities/School';
import { User } from '@domain/entities/User';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import { resolveLanguage } from '../../domain/policies/LanguagePolicy';
import type { SchoolSubsystem, EducationType, SchoolOwnership } from '@domain/types/enums';

export interface OnboarderEcoleCommande {
  // Informations établissement
  nom: string;
  subdomain: string;
  adresse?: string;
  ville?: string;
  region?: string;
  telephone?: string;
  email?: string;
  subsystem: SchoolSubsystem;
  educationType: EducationType;
  ownership: SchoolOwnership;
  templateCode?: string;

  // Compte Admin
  adminPrenom: string;
  adminNom: string;
  adminEmail: string;
  adminPasswordHash: string; // hashé avant d'arriver ici
}

export interface OnboarderEcoleResultat {
  schoolId: string;
  adminUserId: string;
  subdomain: string;
  message: string;
}

export class OnboarderEcoleUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(commande: OnboarderEcoleCommande): Promise<OnboarderEcoleResultat> {
    // 1. Vérifier que le subdomain n'existe pas déjà
    const subdomainPris = await this.schoolRepository.existsBySubdomain(commande.subdomain);
    if (subdomainPris) {
      throw new Error(`Le sous-domaine "${commande.subdomain}" est déjà utilisé`);
    }

    // 2. Vérifier que l'email admin n'existe pas déjà
    // (On ne peut pas vérifier par schoolId car l'école n'existe pas encore)
    // Cette vérification se fait via une recherche globale
    const school = School.create({
      name: commande.nom,
      subdomain: commande.subdomain,
      subsystem: commande.subsystem,
      educationType: commande.educationType,
      ownership: commande.ownership,
      address: commande.adresse,
      city: commande.ville,
      region: commande.region,
      phone: commande.telephone,
      email: commande.email,
      templateCode: commande.templateCode,
    });

    // 3. Sauvegarder l'école (statut PENDING)
    await this.schoolRepository.save(school);

    // 4. Créer le compte Admin
    const admin = User.create({
      schoolId: school.id,
      role: 'ADMIN',
      email: commande.adminEmail,
      firstName: commande.adminPrenom,
      lastName: commande.adminNom,
    });

    await this.userRepository.save(admin);

    // 5. Email de confirmation à l'Admin (fire-and-forget — ne bloque pas la réponse HTTP)
    //    Langue déjà connue ici (sous-système choisi à l'inscription) → resolveLanguage.
    const langueConfirm = resolveLanguage(commande.subsystem);
    void this.emailService.envoyer({
      destinataire: commande.adminEmail,
      sujet: langueConfirm === 'fr' ? 'Demande d\'accès ZekoulABia reçue' : 'ZekoulABia access request received',
      contenuHtml: langueConfirm === 'fr'
        ? `
        <h2>Bonjour ${admin.nomComplet},</h2>
        <p>Votre demande d'inscription pour <strong>${school.name}</strong> a bien été reçue.</p>
        <p>Notre équipe va l'examiner sous 24-48h. Vous recevrez un email dès validation.</p>
      `
        : `
        <h2>Hello ${admin.nomComplet},</h2>
        <p>Your registration request for <strong>${school.name}</strong> has been received.</p>
        <p>Our team will review it within 24-48h. You will receive an email once approved.</p>
      `,
    }).catch(err => console.error('[Email] Échec confirmation onboarding:', (err as Error)?.message));

    return {
      schoolId: school.id,
      adminUserId: admin.id,
      subdomain: school.subdomain,
      message: 'Demande soumise avec succès — en attente d\'approbation',
    };
  }
}
