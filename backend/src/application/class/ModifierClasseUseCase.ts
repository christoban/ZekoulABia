import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import { Classe } from '@domain/entities/Classe';

export interface ModifierClasseCommande {
  classeId: string;
  schoolId: string;
  name?: string;
  level?: string;
  serie?: string;
  filiere?: string;
  sectionId?: string;
  capacity?: number;
}

export class ModifierClasseUseCase {
  constructor(private readonly classeRepository: ClasseRepository) {}

  async execute(commande: ModifierClasseCommande): Promise<void> {
    const classe = await this.classeRepository.findById(commande.classeId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classeId}`);

    if (classe.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : classe hors de votre établissement');
    }

    if (commande.name && commande.name !== classe.name) {
      const dejaExiste = await this.classeRepository.existsByName(
        commande.schoolId,
        commande.name,
        commande.classeId
      );
      if (dejaExiste) {
        throw new Error(
          `Une autre classe avec le nom "${commande.name}" existe déjà`
        );
      }
    }

    const donneesMisesAJour = {
      ...classe.toObject(),
      ...(commande.name && { name: commande.name }),
      ...(commande.level !== undefined && { level: commande.level }),
      ...(commande.serie !== undefined && { serie: commande.serie }),
      ...(commande.filiere !== undefined && { filiere: commande.filiere }),
      ...(commande.sectionId !== undefined && { sectionId: commande.sectionId }),
      ...(commande.capacity !== undefined && { capacity: commande.capacity }),
    };

    const classeMisAJour = Classe.reconstituer(donneesMisesAJour);
    await this.classeRepository.update(classeMisAJour);
  }
}
