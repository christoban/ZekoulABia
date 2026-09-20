/**
 * APPLICATION LAYER — CreerPublicationUseCase
 */

import { Publication, type PublicationProps, type PublicationDureeVisibilite, type PublicationPriorite, type PublicationCategorie, type PublicationCorpsFormat, type PublicationType, type PieceJointe, type PublicationAudience } from '../../domain/entities/Publication';
import type { PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import type { EventPublisher } from '../../domain/ports/services/EventPublisher';
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
    private readonly eventPublisher?: EventPublisher
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

    return created;
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
