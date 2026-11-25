/**
 * INFRASTRUCTURE LAYER — Écran Corbeille (Couche 1, PLAN_IMPLEMENTATION_BACKUP.md §1.3).
 *
 * ADMIN uniquement pour l'instant : les 3 use cases de suppression (utilisateur/classe/matière)
 * exigent tous `demandeurRole === 'ADMIN'` aujourd'hui — la nuance "chaque rôle habilité voit
 * uniquement ce qu'il a lui-même supprimé" du plan ne s'applique pas encore puisqu'aucun autre
 * rôle ne peut supprimer quoi que ce soit. À revoir si cette capacité s'étend un jour à d'autres
 * rôles (Censeur, etc.) — l'admin resterait alors le seul à voir l'ensemble de l'établissement.
 */
import type { Request, Response, NextFunction } from 'express';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

type TypeCorbeille = 'utilisateur' | 'classe' | 'matiere';

export class CorbeilleController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly audit: AIActionAuditPort,
  ) {}

  // GET /api/v2/corbeille
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { type } = req.query as { type?: TypeCorbeille };

      const [utilisateurs, classes, matieres] = await Promise.all([
        (!type || type === 'utilisateur')
          ? this.userRepository.listerSupprimes(user.schoolId)
          : [],
        (!type || type === 'classe')
          ? this.classeRepository.listerSupprimes(user.schoolId)
          : [],
        (!type || type === 'matiere')
          ? this.matiereRepository.listerSupprimes(user.schoolId)
          : [],
      ]);

      const deletedByIds = [...new Set([...utilisateurs, ...classes, ...matieres].map((r) => r.deletedById).filter((id): id is string => !!id))];
      const auteurs = deletedByIds.length > 0
        ? await this.userRepository.findByIds(deletedByIds)
        : [];
      const nomAuteur = (id: string | null) => {
        if (!id) return null;
        const a = auteurs.find((x) => x.id === id);
        return a ? `${a.firstName} ${a.lastName}` : null;
      };

      const GRACE_DAYS = parseInt(process.env.PURGE_GRACE_PERIOD_DAYS || '30', 10);
      const purgeLe = (deletedAt: Date) => new Date(deletedAt.getTime() + GRACE_DAYS * 86400000);

      res.json({
        success: true,
        data: {
          utilisateurs: utilisateurs.map((u) => ({
            id: u.id, type: 'utilisateur', role: u.role, nom: `${u.firstName} ${u.lastName}`, email: u.email,
            deletedAt: u.deletedAt, deletedByNom: nomAuteur(u.deletedById), purgeLe: purgeLe(u.deletedAt!),
          })),
          classes: classes.map((c) => ({
            id: c.id, type: 'classe', nom: c.name, niveau: c.level,
            deletedAt: c.deletedAt, deletedByNom: nomAuteur(c.deletedById), purgeLe: purgeLe(c.deletedAt!),
          })),
          matieres: matieres.map((m) => ({
            id: m.id, type: 'matiere', nom: m.name, code: m.code,
            deletedAt: m.deletedAt, deletedByNom: nomAuteur(m.deletedById), purgeLe: purgeLe(m.deletedAt!),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/corbeille/:type/:id/restore
  restaurer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { type, id } = req.params as { type: TypeCorbeille; id: string };

      let cible: { id: string } | null = null;
      let modele: 'user' | 'class' | 'subject';
      let restorer: (id: string) => Promise<void>;
      if (type === 'utilisateur') {
        modele = 'user';
        cible = await this.userRepository.trouverSupprime(id, user.schoolId);
        restorer = (restoreId) => this.userRepository.restaurer(restoreId);
      } else if (type === 'classe') {
        modele = 'class';
        cible = await this.classeRepository.trouverSupprime(id, user.schoolId);
        restorer = (restoreId) => this.classeRepository.restaurer(restoreId);
      } else if (type === 'matiere') {
        modele = 'subject';
        cible = await this.matiereRepository.trouverSupprime(id, user.schoolId);
        restorer = (restoreId) => this.matiereRepository.restaurer(restoreId);
      } else {
        res.status(400).json({ success: false, message: 'Type de corbeille inconnu' });
        return;
      }

      if (!cible) {
        res.status(404).json({ success: false, message: 'Élément introuvable dans la corbeille' });
        return;
      }

      await restorer(id);

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: `restaurer_${type}`, targetType: modele, targetId: id,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
      });

      res.json({ success: true, message: 'Élément restauré' });
    } catch (error) {
      next(error);
    }
  };
}
