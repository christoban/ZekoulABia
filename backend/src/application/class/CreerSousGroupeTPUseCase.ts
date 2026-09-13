import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { SousGroupeRepository } from '@domain/ports/repositories/SousGroupeRepository';

export interface CreerSousGroupeCommande {
  classeId: string;
  name: string;
  schoolId: string;
  demandeurRole: string;
}

export class CreerSousGroupeTPUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly sousGroupeRepository: SousGroupeRepository,
  ) {}

  async execute(commande: CreerSousGroupeCommande): Promise<{ sousGroupeId: string }> {
    const classe = await this.classeRepository.findById(commande.classeId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classeId}`);
    if (classe.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : classe hors de votre établissement');
    }

    const dejaExiste = await this.sousGroupeRepository.existsByName(
      commande.classeId,
      commande.name
    );
    if (dejaExiste) {
      throw new Error(
        `Un sous-groupe "${commande.name}" existe déjà dans cette classe`
      );
    }

    const sousGroupe = {
      id: crypto.randomUUID(),
      classId: commande.classeId,
      name: commande.name,
    };

    await this.sousGroupeRepository.save(sousGroupe);
    return { sousGroupeId: sousGroupe.id };
  }
}
