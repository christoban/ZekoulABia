/**
 * APPLICATION — Use case : Générer les paiements MINESEC pour TOUTE l'école
 *
 * En pratique, un admin ne va jamais déclencher la génération élève par élève pour
 * un établissement de plusieurs centaines d'enfants. Ce use case boucle sur tous les
 * élèves actifs et réutilise GenererPaiementsMinesecUseCase (qui crée l'Enrollment
 * manquant au passage) pour chacun d'eux.
 */
import type { PaiementMinesecRepository } from '@domain/ports/repositories/PaiementMinesecRepository';
import { GenererPaiementsMinesecUseCase } from './GenererPaiementsMinesecUseCase';
import { messageErreur } from '@application/shared/messageErreur';
import type { GenererPaiementsEcoleCommande, GenererPaiementsEcoleResultat } from './types';

export class GenererPaiementsMinesecPourEcoleUseCase {
  constructor(
    private readonly paiementRepository: PaiementMinesecRepository,
    private readonly genererPourEleve: GenererPaiementsMinesecUseCase,
  ) {}

  async execute(cmd: GenererPaiementsEcoleCommande): Promise<GenererPaiementsEcoleResultat> {
    const eleves = await this.paiementRepository.listerProfilsActifs(cmd.schoolId);

    const resultat: GenererPaiementsEcoleResultat = {
      elevesTraites: 0,
      enrollmentsCrees: 0,
      paiementsGeneres: 0,
      paiementsIgnores: 0,
      erreurs: [],
    };

    for (const eleve of eleves) {
      try {
        const r = await this.genererPourEleve.execute({
          schoolId: cmd.schoolId,
          studentProfileId: eleve.id,
          anneeScolaire: cmd.anneeScolaire,
        });
        resultat.elevesTraites++;
        if (r.enrollmentCreated) resultat.enrollmentsCrees++;
        resultat.paiementsGeneres += r.generated;
        resultat.paiementsIgnores += r.skipped;
      } catch (err) {
        resultat.erreurs.push(`Élève ${eleve.id}: ${err.message}`);
      }
    }

    return resultat;
  }
}
