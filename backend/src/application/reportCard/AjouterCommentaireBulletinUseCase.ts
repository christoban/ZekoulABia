/**
 * APPLICATION LAYER — Use Case : Ajouter le commentaire du Professeur Principal
 * RBAC : ADMIN ou professorPrincipalId de la classe du bulletin.
 */
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface AjouterCommentaireCommande {
  bulletinId: string;
  schoolId: string;
  demandeurId: string;
  demandeurRole: string;
  classMasterComment: string;
}

export class AjouterCommentaireBulletinUseCase {
  constructor(
    private readonly bulletinRepository: BulletinRepository,
    private readonly classeRepository?: ClasseRepository,
  ) {}

  async execute(commande: AjouterCommentaireCommande): Promise<void> {
    const commentaire = commande.classMasterComment?.trim();
    if (!commentaire) {
      throw new Error('classMasterComment (string non vide) requis');
    }

    const ctx = await this.bulletinRepository.findWithClasseContext(commande.bulletinId, commande.schoolId);
    if (!ctx) {
      throw new Error('Bulletin introuvable');
    }

    const role = (commande.demandeurRole as string).toUpperCase();
    if (role !== 'ADMIN') {
      let isPP = ctx.professorPrincipalId === commande.demandeurId;
      // Fallback via ClasseRepository si disponible et pas déjà PP
      if (!isPP && this.classeRepository) {
        const classePP = await this.classeRepository.findClasseDeProfPrincipal(commande.demandeurId);
        // Si le demandeur est PP d'une classe, vérifier que c'est bien la même classe que celle du bulletin :
        // on ne peut pas comparer classId directement (ctx n'expose pas classId), donc on se rabat
        // sur le professorPrincipalId déjà résolu — cette branche ne sert que si ctx.professorPrincipalId
        // était null/incohérent mais que le repo sait que le demandeur est PP quelque part.
        // Par sécurité on considère que si le demandeur est PP quelque part ET que ctx.professorPrincipalId
        // est null, on refuse (pas de faux positif). Le vrai check reste ctx.professorPrincipalId.
        isPP = false;
        void classePP;
      }
      if (!isPP) {
        throw Object.assign(
          new Error('Seul le Professeur Principal de cette classe ou un Admin peut écrire ce commentaire'),
          { status: 403 },
        );
      }
    }

    ctx.bulletin.ajouterCommentaireProfesseurPrincipal(commentaire);
    await this.bulletinRepository.update(ctx.bulletin);
  }
}
