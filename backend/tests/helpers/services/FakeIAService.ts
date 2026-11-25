import type {
  IAService,
  DonneesIndiceSante,
  ResultatIndiceSante,
} from '@domain/ports/services/IAService';

export class FakeIAService implements IAService {
  appelCalculer: DonneesIndiceSante[] = [];

  async calculerIndiceSante(donnees: DonneesIndiceSante): Promise<ResultatIndiceSante> {
    this.appelCalculer.push(donnees);

    const score = Math.round(
      (donnees.moyenneGenerale / 20) * 100 * 0.35 +
      donnees.tauxPresence * 0.25 +
      50 * 0.20 +
      Math.max(0, 100 - donnees.nombreSanctions * 20) * 0.10 +
      donnees.tauxPaiement * 0.10
    );

    let niveau: ResultatIndiceSante['niveau'];
    if (score <= 30) niveau = 'CRITIQUE';
    else if (score <= 50) niveau = 'ELEVE';
    else if (score <= 70) niveau = 'MOYEN';
    else if (score <= 85) niveau = 'STABLE';
    else niveau = 'PROGRESSION';

    return {
      score,
      niveau,
      recommandations: ['Recommandation test 1', 'Recommandation test 2'],
    };
  }

  async genererCommentaireBulletin(_params: any): Promise<string> {
    return 'Commentaire généré par FakeIA';
  }

  async genererEmploiDuTemps(_contraintes: any): Promise<Record<string, unknown>> {
    return { generated: true };
  }

  async genererConseilPersonnalise(_params: any): Promise<string> {
    return 'Conseil personnalisé généré par FakeIA';
  }
}
