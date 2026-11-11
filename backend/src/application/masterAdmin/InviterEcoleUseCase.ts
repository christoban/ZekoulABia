/**
 * APPLICATION LAYER — Use Case : Inviter une école
 * Logique extraite de controllers/masterAdmin.ts → inviteSchool
 * - Crée/réutilise une école en PENDING
 * - Expire les anciennes invitations PENDING
 * - Génère un token UUID valide 72h
 * - Envoie l'email d'invitation
 */
import { School } from '@domain/entities/School';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { InvitationRepository, InvitationProps } from '@domain/ports/repositories/InvitationRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { EmailTemplatePort } from '@domain/ports/services/EmailTemplatePort';
import type { PlanType, SchoolSubsystem } from '@domain/types/enums';

export interface InviterEcoleCommande {
  email: string;
  schoolName: string;
  plan: PlanType;
  masterAdminId: string;
  notes?: string;
  /** Sous-système visé (langue de l'email d'invitation). Défaut FRANCOPHONE. */
  subsystem?: SchoolSubsystem;
}

export interface InviterEcoleResultat {
  invitationId: string;
  token: string;
  expiresAt: Date;
  schoolId: string;
  activationUrl: string;
}

export class InviterEcoleUseCase {
  constructor(
    private readonly schoolRepository: SchoolRepository,
    private readonly invitationRepository: InvitationRepository,
    private readonly emailService: EmailService,
    private readonly emailTemplate: EmailTemplatePort,
  ) {}

  async execute(commande: InviterEcoleCommande): Promise<InviterEcoleResultat> {
    // 1. Vérifier si une invitation PENDING existe déjà pour cet email
    const invitationExistante = await this.invitationRepository.findPendingByEmail(commande.email);

    // 2. Créer l'école en PENDING si elle n'existe pas encore
    let schoolId: string;
    // Sous-système déterminant la langue de l'email d'invitation.
    let subsystemInvite: SchoolSubsystem = commande.subsystem ?? 'FRANCOPHONE';

    if (invitationExistante?.schoolId) {
      schoolId = invitationExistante.schoolId;
      // Expirer l'ancienne invitation
      await this.invitationRepository.expireToutes(schoolId);
      // Réutilisation d'une école existante → on suit SON sous-système réel.
      const existante = await this.schoolRepository.findById(schoolId);
      if (existante) subsystemInvite = existante.subsystem;
    } else {
      const subdomain = commande.schoolName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30);

      const school = School.create({
        name: commande.schoolName,
        subdomain: `${subdomain}-${Date.now()}`,
        subsystem: subsystemInvite,
        educationType: 'GENERAL',
        ownership: 'PRIVATE_SECULAR',
        plan: commande.plan,
        createdByMasterId: commande.masterAdminId,
      });

      await this.schoolRepository.save(school);
      schoolId = school.id;
    }

    // 3. Générer nouvelle invitation (token UUID, 72h)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const invitation: InvitationProps = {
      id: crypto.randomUUID(),
      email: commande.email,
      schoolName: commande.schoolName,
      token: crypto.randomUUID(),
      schoolId,
      invitedByMasterId: commande.masterAdminId,
      plan: commande.plan,
      status: 'PENDING',
      expiresAt,
      notes: commande.notes,
      createdAt: new Date(),
    };

    await this.invitationRepository.save(invitation);

    // 4. Envoyer l'email d'invitation (fire-and-forget — ne bloque pas la réponse HTTP)
    const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const activationUrl = `${frontendUrl}/onboarding/${invitation.token}`;
    const inviteTemplate = this.emailTemplate.buildSchoolInviteTemplate({
      schoolName: commande.schoolName,
      requestedAdminName: 'Administrateur',
      activationUrl,
      // Langue du destinataire encore inconnue à l'invitation → email bilingue FR + EN.
      language: 'bilingual',
    });

    void this.emailService.envoyer({
      destinataire: commande.email,
      sujet: inviteTemplate.subject,
      contenuHtml: inviteTemplate.html,
      contenuTexte: inviteTemplate.text,
      eventType: 'school_invite',
      metadata: { schoolId, token: invitation.token },
    }).catch(err => console.error('[Email] Échec envoi invitation:', (err as Error)?.message));

    return {
      invitationId: invitation.id,
      token: invitation.token,
      expiresAt,
      schoolId,
      activationUrl,
    };
  }
}
