import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { CreerCanalClasseUseCase } from '@application/messagerie/CreerCanalClasseUseCase';
import type { CreerCanalParentsUseCase } from '@application/messagerie/CreerCanalParentsUseCase';
import { CYCLE2_LEVELS, NIVEAU_MAP } from '@application/school/SubjectAssignmentHelper';

// Re-export pour ne casser les imports existants dans le reste du codebase
export type { CreerClasseCommande, CreerClasseResultat } from '@domain/ports/services/CreerClasseService';
import type { CreerClasseService, CreerClasseCommande, CreerClasseResultat } from '@domain/ports/services/CreerClasseService';

export class CreerClasseUseCase implements CreerClasseService {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly anneeAcademiqueRepository?: AnneeAcademiqueRepository,
    private readonly matiereRepository?: MatiereRepository,
    // Optionnels : une classe doit avoir ses canaux de messagerie dès sa création (jamais créés
    // à la main), mais ce use case reste testable/utilisable sans messagerie câblée (voir
    // CreerClasseUseCase.test.ts, qui l'instancie avec un seul argument).
    private readonly creerCanalClasseUseCase?: CreerCanalClasseUseCase,
    private readonly creerCanalParentsUseCase?: CreerCanalParentsUseCase,
  ) {}

  async execute(commande: CreerClasseCommande): Promise<CreerClasseResultat> {
    // Résolution de l'année académique courante (ex-prisma.academicYear.findFirst dans controller)
    let academicYearId = commande.academicYearId;
    if (!academicYearId) {
      if (!this.anneeAcademiqueRepository) {
        throw new Error("Aucune année académique courante — impossible de créer une classe.");
      }
      const anneeCourante = await this.anneeAcademiqueRepository.findCourante(commande.schoolId);
      if (!anneeCourante) {
        throw new Error("Aucune année académique courante — impossible de créer une classe.");
      }
      academicYearId = anneeCourante.id;
    }

    // Validation MINESEC pour le 2nd cycle (ex-prisma.bacCoefficient.findFirst dans controller)
    if (commande.level && commande.serie && (CYCLE2_LEVELS as string[]).includes(commande.level)) {
      const niveauBac = NIVEAU_MAP[commande.level];
      if (niveauBac && this.matiereRepository) {
        const seriePart = commande.serie.includes('-') ? commande.serie.split('-')[0]! : commande.serie;
        const coeffs = await this.matiereRepository.getCoefficientsBACParSerie(seriePart);
        if (coeffs.length === 0) {
          throw new Error(
            `La série "${commande.serie}" n'existe pas au niveau "${commande.level}" dans le programme officiel MINESEC. Vérifiez la combinaison niveau/série.`
          );
        }
      }
    }

    const dejaExiste = await this.classeRepository.existsByName(
      commande.schoolId,
      commande.name
    );
    if (dejaExiste) {
      throw new Error(
        `Une classe avec le nom "${commande.name}" existe déjà dans cet établissement`
      );
    }

    const classe = Classe.create({
      schoolId: commande.schoolId,
      academicYearId: academicYearId!,
      name: commande.name,
      level: commande.level,
      serie: commande.serie,
      filiere: commande.filiere,
      sectionId: commande.sectionId,
      capacity: commande.capacity,
    });

    await this.classeRepository.save(classe);

    if (this.creerCanalClasseUseCase && this.creerCanalParentsUseCase) {
      const params = { schoolId: commande.schoolId, classId: classe.id, className: classe.nomComplet };
      // Ne doit jamais faire échouer la création de la classe — un canal manquant se répare en
      // rouvrant la messagerie, une classe non créée est bien plus grave.
      await Promise.allSettled([
        this.creerCanalClasseUseCase.execute(params),
        this.creerCanalParentsUseCase.execute(params),
      ]);
    }

    return {
      classeId: classe.id,
      name: classe.name,
      nomComplet: classe.nomComplet,
    };
  }
}
