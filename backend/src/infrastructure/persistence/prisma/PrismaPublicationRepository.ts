/**
 * INFRASTRUCTURE LAYER — PrismaPublicationRepository
 * Implémente le port PublicationRepository via Prisma Client.
 */

import type { PrismaClient } from '@prisma/client';
import {
  Publication,
  type PublicationProps,
  type PieceJointe,
} from '../../../domain/entities/Publication';
import type {
  PublicationRepository,
  PublicationFiltres,
  StatistiquesLecture,
} from '../../../domain/ports/repositories/PublicationRepository';
import { peutVoir, type UtilisateurContexte } from '../../../domain/rules/BabillardVisibilityRules';

export class PrismaPublicationRepository implements PublicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async creer(publication: Publication): Promise<Publication> {
    const raw = await this.prisma.announcement.create({
      data: {
        id: publication.id,
        schoolId: publication.tenantId,
        title: publication.titre,
        content: publication.corps,
        targetRoles: publication.audience.roles as any,
        isPinned: publication.epinglee,
        authorId: publication.auteurId,
        createdAt: publication.createdAt,
        updatedAt: publication.updatedAt,
        expiresAt: publication.expireLe,
        type: publication.type as any,
        format: publication.corpsFormat as any,
        categorie: publication.categorie as any,
        priorite: publication.priorite as any,
        statut: publication.statut as any,
        dureeVisibilite: publication.dureeVisibilite as any,
        publieeLe: publication.publieeLe,
        programmeeLe: publication.programmeeLe,
        modifieLe: publication.modifieLe,
        deletedAt: publication.deletedAt,
        auteurRole: publication.auteurRole,
        auteurTitre: publication.auteurTitre,
        targetNiveaux: publication.audience.niveauIds ?? [],
        targetClasses: publication.audience.classeIds ?? [],
        piecesJointes: publication.piecesJointes as any,
        payload: publication.payload as any,
        referenceType: publication.referenceType,
        referenceId: publication.referenceId,
      },
    });

    return this.mapperVersEntite(raw);
  }

  async modifier(
    id: string,
    schoolId: string,
    data: Partial<PublicationProps>
  ): Promise<Publication> {
    const updateData: any = {};

    if (data.titre !== undefined) updateData.title = data.titre;
    if (data.corps !== undefined) updateData.content = data.corps;
    if (data.corpsFormat !== undefined) updateData.format = data.corpsFormat;
    if (data.categorie !== undefined) updateData.categorie = data.categorie;
    if (data.priorite !== undefined) updateData.priorite = data.priorite;
    if (data.epinglee !== undefined) updateData.isPinned = data.epinglee;
    if (data.statut !== undefined) updateData.statut = data.statut;
    if (data.publieeLe !== undefined) updateData.publieeLe = data.publieeLe;
    if (data.programmeeLe !== undefined) updateData.programmeeLe = data.programmeeLe;
    if (data.dureeVisibilite !== undefined) updateData.dureeVisibilite = data.dureeVisibilite;
    if (data.expireLe !== undefined) updateData.expiresAt = data.expireLe;
    if (data.modifieLe !== undefined) updateData.modifieLe = data.modifieLe;
    if (data.deletedAt !== undefined) updateData.deletedAt = data.deletedAt;
    if (data.piecesJointes !== undefined) updateData.piecesJointes = data.piecesJointes;
    if (data.payload !== undefined) updateData.payload = data.payload;

    if (data.audience) {
      if (data.audience.roles) updateData.targetRoles = data.audience.roles;
      if (data.audience.niveauIds) updateData.targetNiveaux = data.audience.niveauIds;
      if (data.audience.classeIds) updateData.targetClasses = data.audience.classeIds;
    }

    updateData.updatedAt = new Date();

    const raw = await this.prisma.announcement.update({
      where: { id },
      data: updateData,
    });

    return this.mapperVersEntite(raw);
  }

  async trouverParId(id: string, schoolId: string): Promise<Publication | null> {
    const raw = await this.prisma.announcement.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        school: { select: { id: true, name: true, logoUrl: true, city: true, subsystem: true, features: true } },
      },
    });
    if (!raw) return null;
    return this.mapperVersEntite(raw);
  }

  async lister(
    schoolId: string,
    filtres: PublicationFiltres = {}
  ): Promise<{ publications: Publication[]; curseurSuivant?: string }> {
    const limite = filtres.limite ?? 20;
    const where: any = {
      schoolId,
      deletedAt: null,
    };

    if (filtres.categorie) {
      where.categorie = filtres.categorie;
    }

    const andConditions: any[] = [];

    if (filtres.recherche && filtres.recherche.trim().length > 0) {
      const q = filtres.recherche.trim();
      andConditions.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const maintenant = new Date();
    if (filtres.filtre === 'archives') {
      andConditions.push({
        OR: [
          { statut: 'ARCHIVEE' },
          { expiresAt: { lte: maintenant } },
        ],
      });
    } else {
      andConditions.push({
        statut: { notIn: ['ARCHIVEE'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: maintenant } }],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const queryOptions: any = {
      where,
      take: limite + 1,
      orderBy: [
        { isPinned: 'desc' },
        { publieeLe: 'desc' },
      ],
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        school: { select: { id: true, name: true, logoUrl: true, city: true, subsystem: true, features: true } },
      },
    };

    if (filtres.curseur) {
      queryOptions.cursor = { id: filtres.curseur };
      queryOptions.skip = 1;
    }

    const rawList = await this.prisma.announcement.findMany(queryOptions);

    let curseurSuivant: string | undefined = undefined;
    let items = rawList;
    if (rawList.length > limite) {
      const nextItem = rawList[limite];
      curseurSuivant = nextItem.id;
      items = rawList.slice(0, limite);
    }

    return {
      publications: items.map((r) => this.mapperVersEntite(r)),
      curseurSuivant,
    };
  }

  async supprimerLogique(id: string, schoolId: string): Promise<void> {
    await this.prisma.announcement.updateMany({
      where: { id, schoolId },
      data: { deletedAt: new Date() },
    });
  }

  async compterEpinglesActifs(schoolId: string): Promise<number> {
    return this.prisma.announcement.count({
      where: {
        schoolId,
        isPinned: true,
        deletedAt: null,
        statut: 'PUBLIEE',
      },
    });
  }

  async desepinglerLaPlusAncienne(schoolId: string): Promise<void> {
    const plusAncienne = await this.prisma.announcement.findFirst({
      where: {
        schoolId,
        isPinned: true,
        deletedAt: null,
      },
      orderBy: { publieeLe: 'asc' },
    });
    if (plusAncienne) {
      await this.prisma.announcement.update({
        where: { id: plusAncienne.id },
        data: { isPinned: false },
      });
    }
  }

  async epingler(id: string, schoolId: string, epinglee: boolean): Promise<Publication> {
    const raw = await this.prisma.announcement.update({
      where: { id },
      data: { isPinned: epinglee },
    });
    return this.mapperVersEntite(raw);
  }

  async marquerCommeLu(publicationId: string, userId: string, schoolId: string): Promise<void> {
    await this.prisma.publicationLecture.upsert({
      where: {
        publicationId_userId: { publicationId, userId },
      },
      create: {
        publicationId,
        userId,
        schoolId,
      },
      update: {
        luLe: new Date(),
      },
    });
  }

  async estLuParUtilisateur(publicationId: string, userId: string): Promise<boolean> {
    const record = await this.prisma.publicationLecture.findUnique({
      where: { publicationId_userId: { publicationId, userId } },
    });
    return !!record;
  }

  async getIdsLusParUtilisateur(userId: string, publicationIds: string[]): Promise<Set<string>> {
    if (publicationIds.length === 0) return new Set();
    const records = await this.prisma.publicationLecture.findMany({
      where: {
        userId,
        publicationId: { in: publicationIds },
      },
      select: { publicationId: true },
    });
    return new Set(records.map((r) => r.publicationId));
  }

  async compterNonLus(schoolId: string, user: UtilisateurContexte): Promise<number> {
    const maintenant = new Date();
    const publications = await this.prisma.announcement.findMany({
      where: {
        schoolId,
        deletedAt: null,
        statut: 'PUBLIEE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: maintenant } }],
      },
    });

    const entites = publications.map((p) => this.mapperVersEntite(p));
    const visibles = entites.filter((p) => peutVoir(user, p));

    if (visibles.length === 0) return 0;

    const visibleIds = visibles.map((p) => p.id);
    const lus = await this.getIdsLusParUtilisateur(user.userId, visibleIds);

    return visibleIds.filter((id) => !lus.has(id)).length;
  }

  async compterLectures(publicationId: string, schoolId: string): Promise<number> {
    return this.prisma.publicationLecture.count({
      where: { publicationId, schoolId },
    });
  }

  async compterDestinatairesEligibles(publication: Publication): Promise<number> {
    const audienceRoles = publication.audience.roles ?? [];
    if (audienceRoles.length === 0) return 0;

    const classesCiblees = publication.audience.classeIds ?? [];

    if (classesCiblees.length > 0) {
      // Comptage affiné par classes ciblées
      let total = 0;
      if (audienceRoles.includes('STUDENT')) {
        const eleves = await this.prisma.enrollment.count({
          where: {
            schoolId: publication.tenantId,
            classId: { in: classesCiblees },
            status: 'ACTIVE',
          },
        });
        total += eleves;
      }

      if (audienceRoles.includes('PARENT')) {
        const parents = await this.prisma.parentStudent.count({
          where: {
            studentProfile: {
              enrollmentsYearScoped: {
                some: {
                  schoolId: publication.tenantId,
                  classId: { in: classesCiblees },
                  status: 'ACTIVE',
                },
              },
            },
          },
        });
        total += parents;
      }

      // Pour les enseignants et admin/staff ciblés dans cette école
      const autresRoles = audienceRoles.filter((r) => r !== 'STUDENT' && r !== 'PARENT');
      if (autresRoles.length > 0) {
        const autres = await this.prisma.user.count({
          where: {
            schoolId: publication.tenantId,
            deletedAt: null,
            role: { in: autresRoles as any },
          },
        });
        total += autres;
      }

      return Math.max(1, total);
    }

    // Ciblage global par rôles
    return this.prisma.user.count({
      where: {
        schoolId: publication.tenantId,
        deletedAt: null,
        role: { in: audienceRoles as any },
      },
    });
  }

  async obtenirStatistiquesLecture(publication: Publication): Promise<StatistiquesLecture> {
    const [lecturesCount, destinatairesEligiblesCount] = await Promise.all([
      this.compterLectures(publication.id, publication.tenantId),
      this.compterDestinatairesEligibles(publication),
    ]);

    return {
      lecturesCount,
      destinatairesEligiblesCount,
    };
  }

  async enregistrerAudit(data: {
    schoolId: string;
    publicationId: string;
    userId: string;
    action: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.babillardAudit.create({
        data: {
          schoolId: data.schoolId,
          publicationId: data.publicationId,
          userId: data.userId,
          action: data.action,
          details: data.details as any,
        },
      });
    } catch {
      // Ne fait pas échouer l'opération métier si l'audit rencontre un souci
    }
  }

  private mapperVersEntite(raw: any): Publication {
    let piecesJointes: PieceJointe[] = [];
    if (Array.isArray(raw.piecesJointes)) {
      piecesJointes = raw.piecesJointes as PieceJointe[];
    }

    let auteur = undefined;
    if (raw.author) {
      auteur = {
        id: raw.author.id,
        nom: raw.author.lastName || '',
        prenom: raw.author.firstName || '',
        role: raw.auteurRole || raw.author.role,
        titreOfficiel: raw.auteurTitre || (raw.author.role === 'ADMIN' ? 'Le Proviseur' : null),
      };
    }

    let etablissement = undefined;
    if (raw.school) {
      const features = (raw.school.features as Record<string, any>) || {};
      etablissement = {
        nom: raw.school.name,
        logoUrl: raw.school.logoUrl,
        ville: raw.school.city,
        sousSysteme: raw.school.subsystem,
        devisesActives: features.enTeteRepublique !== false,
        ministereActif: features.ministereActif === true,
        cachetUrl: features.cachetUrl ?? null,
      };
    }

    return new Publication({
      id: raw.id,
      tenantId: raw.schoolId,
      type: raw.type ?? 'ANNONCE',
      titre: raw.title,
      corps: raw.content,
      corpsFormat: raw.format ?? 'HTML_SAFE',
      categorie: raw.categorie ?? 'COMMUNIQUE',
      priorite: raw.priorite ?? 'NORMALE',
      audience: {
        roles: raw.targetRoles ?? [],
        niveauIds: raw.targetNiveaux ?? [],
        classeIds: raw.targetClasses ?? [],
      },
      epinglee: raw.isPinned,
      statut: raw.statut ?? 'PUBLIEE',
      publieeLe: raw.publieeLe ?? raw.createdAt,
      programmeeLe: raw.programmeeLe,
      dureeVisibilite: raw.dureeVisibilite ?? 'PERMANENT',
      expireLe: raw.expiresAt,
      auteurId: raw.authorId,
      auteurRole: raw.auteurRole,
      auteurTitre: raw.auteurTitre,
      piecesJointes,
      payload: raw.payload,
      referenceType: raw.referenceType,
      referenceId: raw.referenceId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      modifieLe: raw.modifieLe,
      deletedAt: raw.deletedAt,
      auteur,
      etablissement,
    });
  }
}
