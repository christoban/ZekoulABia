/**
 * INFRASTRUCTURE LAYER — BabillardController
 * Contrôleur HTTP pour le Babillard Officiel.
 */

import { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import sanitizeHtml from 'sanitize-html';
import type { PrismaClient } from '@prisma/client';
import type { CreerPublicationUseCase } from '../../../application/babillard/CreerPublicationUseCase';
import type { ModifierPublicationUseCase } from '../../../application/babillard/ModifierPublicationUseCase';
import type { SupprimerPublicationUseCase } from '../../../application/babillard/SupprimerPublicationUseCase';
import type { ListerPublicationsUseCase } from '../../../application/babillard/ListerPublicationsUseCase';
import type { MarquerPublicationLueUseCase } from '../../../application/babillard/MarquerPublicationLueUseCase';
import type { EpinglerPublicationUseCase } from '../../../application/babillard/EpinglerPublicationUseCase';
import type { CalculerStatistiquesLectureUseCase } from '../../../application/babillard/CalculerStatistiquesLectureUseCase';
import type { UploaderPieceJointeUseCase } from '../../../application/babillard/UploaderPieceJointeUseCase';
import type { PublicationRepository } from '../../../domain/ports/repositories/PublicationRepository';
import { peutVoir, type UtilisateurContexte } from '../../../domain/rules/BabillardVisibilityRules';

export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'mark', 'span'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['style', 'class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    b: 'strong',
    i: 'em',
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  },
};

export class BabillardController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repo: PublicationRepository,
    private readonly creerPublication: CreerPublicationUseCase,
    private readonly modifierPublication: ModifierPublicationUseCase,
    private readonly supprimerPublication: SupprimerPublicationUseCase,
    private readonly listerPublications: ListerPublicationsUseCase,
    private readonly marquerLue: MarquerPublicationLueUseCase,
    private readonly epinglerPublication: EpinglerPublicationUseCase,
    private readonly calculerStats: CalculerStatistiquesLectureUseCase,
    private readonly uploaderPj: UploaderPieceJointeUseCase
  ) {}

  lister = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const rawFiltre = (req.query.tab ?? req.query.filtre) as string | undefined;
      let filtre: any = rawFiltre;
      if (rawFiltre === 'all') filtre = 'tous';
      else if (rawFiltre === 'pinned') filtre = 'une';
      else if (rawFiltre === 'unread') filtre = 'nonLus';
      else if (rawFiltre === 'for_me') filtre = 'pourMoi';

      const categorie = req.query.categorie as string | undefined;
      const recherche = (req.query.q ?? req.query.recherche) as string | undefined;
      const curseur = req.query.curseur as string | undefined;
      const limite = req.query.limite ? parseInt(req.query.limite as string, 10) : 100;

      const result = await this.listerPublications.execute(user, {
        filtre,
        categorie,
        recherche,
        curseur,
        limite,
      });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json({
        success: true,
        data: result.items.map((it) => ({
          ...it.publication.props,
          isRead: it.isRead,
        })),
        counts: result.counts,
        curseurSuivant: result.curseurSuivant,
      });
    } catch (err) {
      next(err);
    }
  };

  compteurs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const result = await this.listerPublications.execute(user, { filtre: 'tous' });
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json({ success: true, data: result.counts });
    } catch (err) {
      next(err);
    }
  };

  compteurNonLus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const result = await this.listerPublications.execute(user, { filtre: 'tous' });
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json({ success: true, data: { count: result.counts.nonLus } });
    } catch (err) {
      next(err);
    }
  };

  trouverParId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const id = String(req.params.id);
      const pub = await this.repo.trouverParId(id, user.schoolId);

      if (!pub) {
        res.status(404).json({ success: false, message: 'Publication introuvable' });
        return;
      }

      if (!peutVoir(user, pub, { inclureArchives: true })) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const isRead = await this.repo.estLuParUtilisateur(id, user.userId);

      res.json({
        success: true,
        data: {
          ...pub.props,
          isRead,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  creer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const body = req.body;

      // Sanitization HTML stricte
      const sanitizedCorps = body.corps ? sanitizeHtml(body.corps, SANITIZE_OPTIONS) : '';

      const publication = await this.creerPublication.execute({
        user,
        titre: body.titre ?? body.title,
        corps: sanitizedCorps || body.content,
        corpsFormat: body.corpsFormat ?? 'HTML_SAFE',
        categorie: body.categorie,
        priorite: body.priorite,
        audience: {
          roles: body.audience?.roles ?? body.targetRoles ?? [],
          niveauIds: body.audience?.niveauIds ?? body.targetNiveaux ?? [],
          classeIds: body.audience?.classeIds ?? body.targetClasses ?? [],
        },
        epinglee: body.epinglee ?? body.isPinned ?? false,
        estBrouillon: body.estBrouillon ?? body.statut === 'BROUILLON',
        programmeeLe: body.programmeeLe,
        dureeVisibilite: body.dureeVisibilite,
        dateExpirationCustom: body.dateExpirationCustom ?? body.expiresAt,
        piecesJointes: body.piecesJointes ?? [],
      });

      res.status(201).json({ success: true, data: publication.props });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_PUBLISH_ANNOUNCEMENT') {
        res.status(403).json({ success: false, message: 'Seule la direction est habilitée à publier sur le Babillard Officiel.' });
        return;
      }
      next(err);
    }
  };

  modifier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const id = String(req.params.id);
      const body = req.body;

      const updateData: any = {};
      if (body.titre || body.title) updateData.titre = (body.titre ?? body.title).trim();
      if (body.corps || body.content) {
        updateData.corps = sanitizeHtml(body.corps ?? body.content, SANITIZE_OPTIONS);
      }
      if (body.categorie) updateData.categorie = body.categorie;
      if (body.priorite) updateData.priorite = body.priorite;
      if (body.epinglee !== undefined || body.isPinned !== undefined) {
        updateData.epinglee = body.epinglee ?? body.isPinned;
      }
      if (body.statut) updateData.statut = body.statut;
      if (body.programmeeLe !== undefined) updateData.programmeeLe = body.programmeeLe;
      if (body.dureeVisibilite) updateData.dureeVisibilite = body.dureeVisibilite;
      if (body.piecesJointes) updateData.piecesJointes = body.piecesJointes;
      if (body.audience) updateData.audience = body.audience;

      const modifiee = await this.modifierPublication.execute({
        user,
        id,
        data: updateData,
      });

      res.json({ success: true, data: modifiee.props });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_UPDATE_PUBLICATION') {
        res.status(403).json({ success: false, message: 'Action non autorisée sur cette publication.' });
        return;
      }
      next(err);
    }
  };

  supprimer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const id = String(req.params.id);
      await this.supprimerPublication.execute({ user, id });
      res.json({ success: true, message: 'Publication supprimée.' });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_DELETE_PUBLICATION') {
        res.status(403).json({ success: false, message: 'Action non autorisée.' });
        return;
      }
      next(err);
    }
  };

  marquerLu = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const id = String(req.params.id);
      await this.marquerLue.execute(user, id);
      res.json({ success: true, message: 'Marqué comme lu.' });
    } catch (err) {
      next(err);
    }
  };

  epingler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const id = String(req.params.id);
      const epinglee = req.body.epinglee !== undefined ? !!req.body.epinglee : true;
      const publication = await this.epinglerPublication.execute(user, id, epinglee);
      res.json({ success: true, data: publication.props });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_PIN_PUBLICATION') {
        res.status(403).json({ success: false, message: 'Non autorisé à épingler.' });
        return;
      }
      next(err);
    }
  };

  statistiques = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const id = String(req.params.id);
      const stats = await this.calculerStats.execute(user, id);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN_VIEW_STATISTICS') {
        res.status(403).json({ success: false, message: 'Accès aux statistiques réservé à l’auteur et à la direction.' });
        return;
      }
      next(err);
    }
  };

  uploadPieceJointe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
        return;
      }

      const publicationId = req.body.publicationId as string | undefined;
      const texteAlternatif = req.body.texteAlternatif as string | undefined;
      const ordre = req.body.ordre ? parseInt(req.body.ordre as string, 10) : 0;

      const pieceJointe = await this.uploaderPj.execute({
        user,
        publicationId,
        originalname: file.originalname,
        buffer: file.buffer,
        size: file.size,
        mimetype: file.mimetype,
        ordre,
        texteAlternatif,
      });

      res.status(201).json({ success: true, data: pieceJointe });
    } catch (err: any) {
      if (err.message === 'INVALID_FILE_SIGNATURE') {
        res.status(400).json({ success: false, message: 'Format de fichier non autorisé. Formats acceptés : PDF, PNG, JPG, WebP.' });
        return;
      }
      if (err.message === 'FILE_TOO_LARGE') {
        res.status(400).json({ success: false, message: 'Le fichier dépasse la taille maximale autorisée (10 Mo).' });
        return;
      }
      if (err.message === 'FORBIDDEN_UPLOAD_ATTACHMENT') {
        res.status(403).json({ success: false, message: 'Non autorisé à ajouter des pièces jointes.' });
        return;
      }
      next(err);
    }
  };

  telechargerPieceJointe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.buildUtilisateurContexte(req);
      const publicationId = String(req.params.id);
      const pjId = String(req.params.pjId);

      const pub = await this.repo.trouverParId(publicationId, user.schoolId);
      if (!pub) {
        res.status(404).json({ success: false, message: 'Publication introuvable' });
        return;
      }

      if (!peutVoir(user, pub, { inclureArchives: true })) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const pj = pub.piecesJointes.find((p) => p.id === pjId);
      if (!pj) {
        res.status(404).json({ success: false, message: 'Pièce jointe introuvable' });
        return;
      }

      const fullPath = path.resolve(process.cwd(), 'uploads', pj.cleStockage);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ success: false, message: 'Fichier physique introuvable' });
        return;
      }

      res.setHeader('Content-Type', pj.mime);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pj.nomOriginal)}"`);
      fs.createReadStream(fullPath).pipe(res);
    } catch (err) {
      next(err);
    }
  };

  private async buildUtilisateurContexte(req: Request): Promise<UtilisateurContexte> {
    const user = req.user!;
    let classeIds: string[] = [];
    let niveauIds: string[] = [];
    let enseigneDansClasseIds: string[] = [];
    let titre: string | null = null;

    if (user.role?.toUpperCase() === 'STAFF') {
      const profile = await this.prisma.staffProfile.findUnique({
        where: { userId: user.userId },
        select: { title: true },
      });
      titre = profile?.title ?? null;
    } else if (user.role?.toUpperCase() === 'STUDENT') {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { student: { userId: user.userId }, status: 'ACTIVE', schoolId: user.schoolId },
        select: { classId: true, class: { select: { level: true } } },
      });
      if (enrollment) {
        classeIds = [enrollment.classId];
        if (enrollment.class?.level) niveauIds = [enrollment.class.level];
      }
    } else if (user.role?.toUpperCase() === 'PARENT') {
      const parentProfile = await this.prisma.parentProfile.findUnique({
        where: { userId: user.userId },
        include: {
          children: {
            include: {
              studentProfile: {
                include: {
                  enrollmentsYearScoped: {
                    where: { status: 'ACTIVE', schoolId: user.schoolId },
                    include: { class: true },
                  },
                },
              },
            },
          },
        },
      });
      if (parentProfile) {
        for (const ch of parentProfile.children) {
          for (const en of ch.studentProfile.enrollmentsYearScoped) {
            classeIds.push(en.classId);
            if (en.class?.level) niveauIds.push(en.class.level);
          }
        }
      }
    } else if (user.role?.toUpperCase() === 'TEACHER') {
      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { teacherId: user.userId, schoolId: user.schoolId },
        select: { classId: true },
      });
      enseigneDansClasseIds = assignments.map((a) => a.classId);
    }

    return {
      userId: user.userId,
      schoolId: user.schoolId,
      role: user.role,
      permissions: user.permissions,
      titre,
      classeIds,
      niveauIds,
      enseigneDansClasseIds,
    };
  }
}
