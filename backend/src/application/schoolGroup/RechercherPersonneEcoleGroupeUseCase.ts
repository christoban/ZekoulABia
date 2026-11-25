/**
 * APPLICATION LAYER — Recherche d'un élève/enseignant dans UNE école du groupe, pour permettre
 * au Fondateur de Groupe de sélectionner qui transférer (Section 5 du plan). Exception délibérée
 * au principe "jamais d'enregistrement individuel" de la Section 4 : ce n'est pas le dashboard
 * agrégé, c'est un formulaire de sélection ciblé, limité à nom+id+rôle — rien de plus (pas de
 * notes, pas de finances, pas de présence).
 */
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';

export interface RechercherPersonneEcoleGroupeCommande {
  groupId: string;
  schoolId: string;
  role: 'STUDENT' | 'TEACHER';
  recherche: string;
}

export class RechercherPersonneEcoleGroupeUseCase {
  constructor(private readonly queryRepository: GroupeScolaireQueryRepository) {}

  async execute(cmd: RechercherPersonneEcoleGroupeCommande) {
    const appartient = await this.queryRepository.ecoleAppartientAuGroupe(cmd.groupId, cmd.schoolId);
    if (!appartient) throw new Error("Cette école n'appartient pas à votre groupe");

    if (cmd.recherche.trim().length < 2) return [];

    return this.queryRepository.rechercherPersonne({
      schoolId: cmd.schoolId,
      role: cmd.role,
      recherche: cmd.recherche,
    });
  }
}
