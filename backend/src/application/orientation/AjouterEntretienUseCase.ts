import type { IOrientationRepository, EntretienDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { TypeEntretien, MotifEntretien, StatutEntretien } from '@domain/entities/FicheOrientation';

export interface AjouterEntretienCommande {
  ficheId:        string;
  schoolId:       string;
  date:           Date;
  type:           TypeEntretien;
  motif:          MotifEntretien;
  notes?:         string;
  recommendations?: string;
  nextActions?:   string;
  parentNotified?: boolean;
  followUpDate?:  Date;
  status?:        StatutEntretien;
}

export class AjouterEntretienUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: AjouterEntretienCommande): Promise<EntretienDetail> {
    const fiche = await this.repo.findFicheById(cmd.ficheId, cmd.schoolId);
    if (!fiche) throw new Error('Fiche d\'orientation introuvable');
    fiche.verifierPeutRecevoirEntretien();

    return this.repo.createEntretien(cmd.ficheId, {
      date:           cmd.date,
      type:           cmd.type,
      motif:          cmd.motif,
      notes:          cmd.notes,
      recommendations: cmd.recommendations,
      nextActions:    cmd.nextActions,
      parentNotified: cmd.parentNotified ?? false,
      followUpDate:   cmd.followUpDate,
      status:         cmd.status ?? 'PLANIFIE',
    });
  }
}
