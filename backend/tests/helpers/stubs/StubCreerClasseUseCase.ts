import type { CreerClasseCommande, CreerClasseResultat } from '@application/class/CreerClasseUseCase';

// Ne pas `implements CreerClasseUseCase` — classeRepository est private dans la classe
// et le check structural échoue. Duck typing suffisant pour les tests.
export class StubCreerClasseUseCase {
  appels: CreerClasseCommande[] = [];

  async execute(commande: CreerClasseCommande): Promise<CreerClasseResultat> {
    this.appels.push(commande);
    return { classeId: `classe-${this.appels.length}`, name: commande.name, nomComplet: commande.name };
  }
}
