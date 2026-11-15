/**
 * APPLICATION LAYER — CreerPublicationUseCase
 */

import { Publication, type PublicationProps, type PublicationDureeVisibilite, type PublicationPriorite, type PublicationCategorie, type PublicationCorpsFormat, type PublicationType, type PieceJointe, type PublicationAudience } from '../../domain/entities/Publication';
import type { PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import type { EventPublisher } from '../../domain/ports/services/EventPublisher';
import type { NotificationService } from '../../domain/ports/services/NotificationService';
import type { SmsNotificationPort } from '../../domain/ports/services/SmsNotificationPort';
import { peutPublierBabillard, peutEpinglerBabillard } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export interface CreerPublicationCommande {
  user: UtilisateurContexte;
  titre: string;
  corps: string;
  corpsFormat?: PublicationCorpsFormat;
  categorie?: PublicationCategorie;
  priorite?: PublicationPriorite;
  audience: PublicationAudience;
  epinglee?: boolean;
  estBrouillon?: boolean;
  programmeeLe?: string | null;
  dureeVisibilite?: PublicationDureeVisibilite;
  dateExpirationCustom?: string | null;
  piecesJointes?: PieceJointe[];
}

export class CreerPublicationUseCase {
  constructor(
    private readonly repo: PublicationRepository,
    private readonly eventPublisher?: EventPublisher,
    private readonly notificationService?: NotificationService,
    private readonly smsNotification?: SmsNotificationPort,
  ) {}

  async execute(cmd: CreerPublicationCommande): Promise<Publication> {
    if (!peutPublierBabillard(cmd.user)) {
      throw new Error('FORBIDDEN_PUBLISH_ANNOUNCEMENT');
    }

    if (!cmd.titre || cmd.titre.trim().length === 0) {
      throw new Error('TITLE_REQUIRED');
    }
    if (cmd.titre.length > 120) {
      throw new Error('TITLE_TOO_LONG');
    }
    if (!cmd.corps || cmd.corps.trim().length === 0) {
      throw new Error('CONTENT_REQUIRED');
    }
    if (!cmd.audience?.roles || cmd.audience.roles.length === 0) {
      throw new Error('AUDIENCE_ROLES_REQUIRED');
    }

    let epinglee = !!cmd.epinglee;
    if (epinglee) {
      if (!peutEpinglerBabillard(cmd.user)) {
        epinglee = false;
      } else {
        const nbEpingles = await this.repo.compterEpinglesActifs(cmd.user.schoolId);
        if (nbEpingles >= 3) {
          // Règle des 3 max : désépingle la plus ancienne pour faire place à la nouvelle
          await this.repo.desepinglerLaPlusAncienne(cmd.user.schoolId);
        }
      }
    }

    const maintenant = new Date();
    const programmeeDate = cmd.programmeeLe ? new Date(cmd.programmeeLe) : null;
    let statut: PublicationProps['statut'] = 'PUBLIEE';
    if (cmd.estBrouillon) {
      statut = 'BROUILLON';
    } else if (programmeeDate && programmeeDate > maintenant) {
      statut = 'PROGRAMMEE';
    }

    const duree = cmd.dureeVisibilite ?? 'PERMANENT';
    let expireLe: Date | null = null;
    if (cmd.dateExpirationCustom) {
      expireLe = new Date(cmd.dateExpirationCustom);
    } else {
      expireLe = this.calculerExpiration(duree, maintenant);
    }

    const id = `pub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const publication = new Publication({
      id,
      tenantId: cmd.user.schoolId,
      type: 'ANNONCE',
      titre: cmd.titre.trim(),
      corps: cmd.corps.trim(),
      corpsFormat: cmd.corpsFormat ?? 'HTML_SAFE',
      categorie: cmd.categorie ?? 'COMMUNIQUE',
      priorite: cmd.priorite ?? 'NORMALE',
      audience: {
        roles: cmd.audience.roles,
        niveauIds: cmd.audience.niveauIds ?? [],
        classeIds: cmd.audience.classeIds ?? [],
      },
      epinglee,
      statut,
      publieeLe: maintenant,
      programmeeLe: programmeeDate,
      dureeVisibilite: duree,
      expireLe,
      auteurId: cmd.user.userId,
      auteurRole: cmd.user.role,
      auteurTitre: cmd.user.titre ?? null,
      piecesJointes: cmd.piecesJointes ?? [],
      createdAt: maintenant,
      updatedAt: maintenant,
    });

    const created = await this.repo.creer(publication);

    // Audit trail
    await this.repo.enregistrerAudit({
      schoolId: cmd.user.schoolId,
      publicationId: created.id,
      userId: cmd.user.userId,
      action: 'CREATE',
      details: {
        titre: created.titre,
        statut: created.statut,
        epinglee: created.epinglee,
        audience: created.audience,
      },
    });

    // Émission d'événement Inngest si la publication est active immédiatement
    if (created.statut === 'PUBLIEE' && this.eventPublisher) {
      this.eventPublisher.emit('babillard/publication.published', {
        publicationId: created.id,
        schoolId: created.tenantId,
        titre: created.titre,
        priorite: created.priorite,
        audienceRoles: created.audience.roles,
        classeIds: created.audience.classeIds ?? [],
      }).catch((err) => {
        console.warn('[CreerPublicationUseCase] Erreur non bloquante lors de l\'émission d\'événement:', err?.message || err);
      });
    }

    // Dispatch direct Push/In-App + SMS secours si publiée immédiatement
    if (created.statut === 'PUBLIEE' && (this.notificationService || this.smsNotification)) {
      this.notifierPublication(created).catch((err) => {
        console.warn('[CreerPublicationUseCase] Erreur non bloquante notification publication:', err instanceof Error ? err.message : String(err));
      });
    }

    return created;
  }

  private async notifierPublication(publication: Publication): Promise<void> {
    const details = await this.repo.listerDestinatairesLecture(publication);
    const targets = details.nonVus.filter((d) => d.userId !== publication.auteurId);
    if (targets.length === 0) return;

    const isUrgent = publication.priorite === 'URGENTE';
    const urgency = isUrgent ? 'URGENT' : publication.priorite === 'IMPORTANTE' ? 'HIGH' : 'NORMAL';
    const extrait = publication.corps.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

    if (this.notificationService) {
      await Promise.allSettled(
        targets
          .filter((d) => d.accessMode !== 'NO_LOGIN')
          .map((d) =>
            this.notificationService!.envoyer({
              schoolId: publication.tenantId,
              userId: d.userId,
              type: 'COMMUNICATION',
              titre: publication.titre,
              corps: extrait || publication.titre,
              urgency,
              metadata: {
                publicationId: publication.id,
                priorite: publication.priorite,
                categorie: publication.categorie,
              },
            }),
          ),
      );
    }

    if (this.smsNotification?.notifyGenericAlertSms) {
      const phones = Array.from(
        new Set(
          targets
            .filter((d) => Boolean(d.phone) && (d.accessMode === 'SMS_ONLY' || isUrgent))
            .map((d) => d.phone!)
            .filter((p) => p.trim().length > 0),
        ),
      );
      if (phones.length > 0) {
        await this.smsNotification.notifyGenericAlertSms({
          schoolId: publication.tenantId,
          phones,
          message: `[Babillard] ${publication.titre} — ${extrait}`.slice(0, 300),
        });
      }
    }
  }

  private calculerExpiration(duree: PublicationDureeVisibilite, dateBase: Date): Date | null {
    const d = new Date(dateBase);
    switch (duree) {
      case 'J3': d.setDate(d.getDate() + 3); return d;
      case 'J7': d.setDate(d.getDate() + 7); return d;
      case 'J15': d.setDate(d.getDate() + 15); return d;
      case 'J30': d.setDate(d.getDate() + 30); return d;
      case 'PERMANENT': return null;
      default: return null;
    }
  }
}
