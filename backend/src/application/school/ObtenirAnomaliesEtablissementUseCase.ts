/**
 * APPLICATION LAYER — Use Case : Obtenir les anomalies d'établissement pour l'ADMIN
 *
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) — bannière affichée à la
 * connexion, indépendante du copilot conversationnel. Réutilise exactement la même
 * logique que les actions copilot `classes_sans_edt_publie` et `classes_sans_conseil_tenu`
 * (adminActionCatalog.ts) plutôt que d'inventer un nouveau calcul.
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export interface AnomaliesEtablissement {
  classesSansEdtPublie: string[];
  classesSansConseilTenu: string[];
}

export class ObtenirAnomaliesEtablissementUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly timetableRepository: TimetableRepository,
    private readonly classCouncilRepository: ClassCouncilRepository,
  ) {}

  async execute(params: { schoolId: string; userId: string }): Promise<AnomaliesEtablissement> {
    const classes = await this.classeRepository.findBySchool(params.schoolId);
    const classesLite = classes.map((c) => ({ id: c.id, name: c.name }));

    const [classesSansEdtPublie, classesSansConseilTenu] = await Promise.all([
      this.sansEdtPublie(params.schoolId, classesLite),
      this.sansConseilTenu(params.schoolId, classesLite),
    ]);

    return { classesSansEdtPublie, classesSansConseilTenu };
  }

  private async sansEdtPublie(schoolId: string, classes: { id: string; name: string }[]): Promise<string[]> {
    const year = await this.anneeRepository.findCourante(schoolId).catch(() => null);
    if (!year) return [];
    const publishedIds = new Set(await this.timetableRepository.findClassIdsAvecEdtPublie(schoolId, year.id));
    return classes.filter((c) => !publishedIds.has(c.id)).map((c) => c.name);
  }

  private async sansConseilTenu(schoolId: string, classes: { id: string; name: string }[]): Promise<string[]> {
    const period = await this.anneeRepository.findPeriodeCourante(schoolId).catch(() => null);
    if (!period) return [];

    // Règle métier : le conseil de classe délibère sur les notes séquentielles en clôture de trimestre.
    // Il n'est exigible que lorsque la période touche à sa fin (dans les 10 jours précédant la date de fin
    // du trimestre ou après celle-ci). En début ou milieu de période (quand les cours et évaluations séquentielles ont lieu),
    // l'absence de conseil verrouillé est l'état normal et attendu et ne constitue pas une anomalie.
    const now = Date.now();
    const finPeriode = new Date(period.endDate).getTime();
    const estFinDePeriode = !isNaN(finPeriode) && now >= (finPeriode - 10 * 24 * 3600 * 1000);

    if (!estFinDePeriode) {
      return [];
    }

    const lockedIds = new Set(await this.classCouncilRepository.findClassIdsAvecConseilVerrouille(schoolId, period.id));
    return classes.filter((c) => !lockedIds.has(c.id)).map((c) => c.name);
  }
}
