import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type {
  SchedulingSolverPort,
  PropositionEmploiDuTemps,
  ExigenceSeance,
  CaseGrille,
  IndisponibiliteEnseignant,
  ContraintesDoucesOptions,
  CreneauOccupe,
  SalleDisponible,
  SeanceGroupeProposee,
  SeanceProposee,
  TempsLibrePropose,
} from '@domain/ports/services/SchedulingSolverPort';
import type { SchedulingGridPort } from '@domain/ports/services/SchedulingGridPort';
import { joursActifsVersIndex } from '@domain/types/joursSemaine';
import type { SubjectType } from '@domain/types/enums';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import { calculerCategorieJoursDistincts } from '@domain/rules/ReglesPedagogiquesEmploiDuTemps';

export interface ProposerEmploiDuTempsCommande {
  timetableId: string;
  schoolId: string;
  /** Contraintes douces V2.5 (optionnelles) — transmises telles quelles au solveur. */
  contraintes?: ContraintesDoucesOptions;
}

/** Contexte complet nécessaire au solveur — extrait pour être réutilisé par le what-if. */
export interface ContexteEmploiDuTemps {
  classId: string;
  academicYearId: string;
  salleHabituelleId?: string;
  exigences: ExigenceSeance[];
  grille: CaseGrille[];
  sallesDisponibles: SalleDisponible[];
  occupationExistante: CreneauOccupe[];
  occupationLocale?: CreneauOccupe[];
  salleIdsHabituelles?: string[];
  groupesLV2?: GroupeLV2Plan[];
  indisponibilitesEnseignants: IndisponibiliteEnseignant[];
}

export interface GroupeLV2Plan {
  groupId: string;
  groupSetId: string;
  groupName: string;
  subjectId: string;
  teacherId: string;
  participantsCount: number;
}

export class ProposerEmploiDuTempsUseCase {
  constructor(
    private readonly timetableRepository: TimetableRepository,
    private readonly roomRepository: RoomRepository,
    private readonly classRoomAssignmentRepository: ClassRoomAssignmentRepository,
     private readonly teacherUnavailabilityRepository: TeacherUnavailabilityRepository,
     private readonly solver: SchedulingSolverPort,
     private readonly schedulingGrid: SchedulingGridPort,
     private readonly studentGroupSetRepository?: StudentGroupSetRepository,
     private readonly studentGroupRepository?: StudentGroupRepository,
     private readonly studentGroupMembershipRepository?: StudentGroupMembershipRepository,
   ) {}

  async execute(commande: ProposerEmploiDuTempsCommande): Promise<PropositionEmploiDuTemps> {
    const contexte = await this.chargerContexte(commande);
    const proposition = await this.solver.proposer({
      classId: contexte.classId,
      salleHabituelleId: contexte.salleHabituelleId,
      exigences: contexte.exigences,
      grille: contexte.grille,
      sallesDisponibles: contexte.sallesDisponibles,
      occupationExistante: contexte.occupationExistante,
      indisponibilitesEnseignants: contexte.indisponibilitesEnseignants,
      contraintes: commande.contraintes,
    });
    if (proposition.statut === 'INFAISABLE') return proposition;
    const seancesGroupes = await this.calculerSeancesGroupes(contexte, proposition.seances);
    const tempsLibres = this.calculerTempsLibres(contexte, [...proposition.seances, ...seancesGroupes]);
    return { ...proposition, seancesGroupes, tempsLibres };
  }

  /** Charge et valide tout le contexte du solveur, sans résoudre — réutilisé par le what-if. */
  async chargerContexte(commande: { timetableId: string; schoolId: string }): Promise<ContexteEmploiDuTemps> {
    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible de proposer un emploi du temps pour un EDT déjà publié");
    }

    const grille = await this.chargerGrille(commande.schoolId);
    if (grille.length === 0) {
      throw new Error(
        "Aucune grille horaire configurée pour cet établissement — configurez-la avant de proposer un emploi du temps.",
      );
    }
    // Durée de référence d'une case : PGCD des durées de TOUTES les cases (la grille est
    // aujourd'hui homogène par construction — dureePeriode unique — mais le PGCD reste juste
    // si elle devient hétérogène, au lieu de silently se tromper sur la 1ʳᵉ case).
    const durees = grille.map(g =>
      CreneauHoraire.heureEnMinutes(g.endTime) - CreneauHoraire.heureEnMinutes(g.startTime),
    );
    if (durees.some(d => d <= 0)) {
      throw new Error(
        "La grille horaire contient une case de durée invalide (≤ 0 minute) — vérifiez la configuration des créneaux.",
      );
    }
    const dureeCase = durees.reduce(pgcd);

    const exigences = await this.chargerExigences(emploiDuTemps.classId, commande.schoolId, dureeCase);
    if (exigences.length === 0) {
      throw new Error(
        "Aucune affectation pédagogique (matière + enseignant) pour cette classe — affectez les enseignants aux matières avant de proposer un emploi du temps.",
      );
    }
    // Fail Fast : le volume hebdomadaire demandé doit tenir dans la grille, sinon le solveur
    // échouerait de toute façon avec un INFAISABLE moins explicite.
    if (exigences.length > grille.length) {
      throw new Error(
        `Le volume hebdomadaire des matières (${exigences.length} séances) dépasse la capacité de la grille (${grille.length} cases) — réduisez des heures par semaine ou ajoutez des créneaux.`,
      );
    }

    const salles = (await this.roomRepository.findBySchool(commande.schoolId))
      .filter(salle => salle.estDisponible())
      .map(salle => ({ roomId: salle.id, type: salle.type, capacity: salle.capacity, roomName: salle.name }));
    if (salles.length === 0) {
      throw new Error("Aucune salle active dans cet établissement — créez au moins une salle.");
    }

     const assignation = await this.classRoomAssignmentRepository.findByClasseAndAnnee(
       emploiDuTemps.classId, emploiDuTemps.academicYearId,
     );
     const assignationsEcole = await this.classRoomAssignmentRepository.findBySchool(
       commande.schoolId, emploiDuTemps.academicYearId,
     );

     const occupationExistante = await this.timetableRepository.findOccupationEcole(
       commande.schoolId, emploiDuTemps.academicYearId, commande.timetableId,
     );
     const occupationLocale = (await this.timetableRepository.findCreneauxByTimetable(commande.timetableId))
       .filter(creneau => creneau.groupId === undefined || creneau.groupId === null)
       .map(creneau => ({
         teacherId: creneau.teacherId,
         roomId: creneau.roomId,
         dayOfWeek: creneau.dayOfWeek,
         startTime: creneau.startTime,
         endTime: creneau.endTime,
       }));
     const groupesLV2 = await this.chargerGroupesLV2(emploiDuTemps.classId, commande.schoolId, emploiDuTemps.academicYearId);

     const indisponibilitesEnseignants = await this.chargerIndisponibilitesEnseignants(commande.schoolId);

    return {
      classId: emploiDuTemps.classId,
      academicYearId: emploiDuTemps.academicYearId,
      salleHabituelleId: assignation?.roomId,
      exigences,
      grille,
      sallesDisponibles: salles,
       occupationExistante,
       occupationLocale,
       salleIdsHabituelles: assignationsEcole.map(assignation => assignation.roomId),
       groupesLV2,
       indisponibilitesEnseignants,
    };
  }

  private calculerTempsLibres(contexte: ContexteEmploiDuTemps, seances: SeanceProposee[]): TempsLibrePropose[] {
    const occupees = new Set(seances.map(seance => `${seance.dayOfWeek}|${seance.startTime}|${seance.endTime}`));
    return contexte.grille
      .filter(grilleCase => !occupees.has(`${grilleCase.dayOfWeek}|${grilleCase.startTime}|${grilleCase.endTime}`))
      .map(grilleCase => ({ kind: 'FREE', ...grilleCase }));
  }

  private async chargerGroupesLV2(classId: string, schoolId: string, academicYearId: string): Promise<GroupeLV2Plan[]> {
    if (!this.studentGroupSetRepository || !this.studentGroupRepository || !this.studentGroupMembershipRepository) return [];

    const groupSets = (await this.studentGroupSetRepository.findBySchool(schoolId))
      .filter(groupSet => /lv2|langue(?:s)? vivante(?:s)? 2/i.test(`${groupSet.code} ${groupSet.name}`));
    if (groupSets.length === 0) return [];

    const affectations = await this.timetableRepository.findAffectationsSolver(classId, schoolId, true);
    const teacherBySubject = new Map(affectations.map(affectation => [affectation.subjectId, affectation.teacherId]));
    const groupes: GroupeLV2Plan[] = [];

    for (const groupSet of groupSets) {
      const groups = await this.studentGroupRepository.findByGroupSet(groupSet.id);
      const counts = await this.studentGroupMembershipRepository.countMembersByGroupForClass(
        groupSet.id, classId, academicYearId,
      );
      const countByGroup = new Map(counts.map(count => [count.groupId, count.count]));
      for (const group of groups) {
        const participantsCount = countByGroup.get(group.id) ?? 0;
        if (!group.subjectId || participantsCount === 0) continue;
        const teacherId = teacherBySubject.get(group.subjectId);
        if (!teacherId) {
          throw new Error(`Aucun enseignant affecté pour la langue ${group.name}`);
        }
        groupes.push({
          groupId: group.id,
          groupSetId: groupSet.id,
          groupName: group.name,
          subjectId: group.subjectId,
          teacherId,
          participantsCount,
        });
      }
    }

    return groupes.sort((a, b) =>
      b.participantsCount - a.participantsCount || a.groupName.localeCompare(b.groupName, 'fr'),
    );
  }

  async calculerSeancesGroupes(
    contexte: ContexteEmploiDuTemps,
    seancesClasse: SeanceProposee[],
  ): Promise<SeanceGroupeProposee[]> {
    const groupes = contexte.groupesLV2 ?? [];
    if (groupes.length === 0) return [];
    if (!contexte.salleHabituelleId) {
      throw new Error('Aucune salle habituelle assignée à cette classe — impossible de placer les LV2');
    }

    const sallePrincipale = contexte.sallesDisponibles.find(salle => salle.roomId === contexte.salleHabituelleId);
    if (!sallePrincipale) {
      throw new Error('La salle habituelle de la classe est introuvable ou inactive — impossible de placer les LV2');
    }

    const sallesHabituelles = new Set(contexte.salleIdsHabituelles ?? []);
    const sallesFlottantes = contexte.sallesDisponibles
      .filter(salle => salle.type === 'NORMAL' && !sallesHabituelles.has(salle.roomId) && salle.roomId !== sallePrincipale.roomId)
      .sort((a, b) => a.capacity - b.capacity || a.roomId.localeCompare(b.roomId));
    const occupation = [...(contexte.occupationExistante ?? []), ...(contexte.occupationLocale ?? [])];
    const indisponibilites = contexte.indisponibilitesEnseignants;

    for (const grilleCase of contexte.grille) {
      if (seancesClasse.some(seance => this.chevauche(seance, grilleCase))) continue;
      if (groupes.some(groupe =>
        indisponibilites.some(indisponibilite =>
          indisponibilite.teacherId === groupe.teacherId && this.chevauche(indisponibilite, grilleCase),
        ) || occupation.some(occupe =>
          occupe.teacherId === groupe.teacherId && this.chevauche(occupe, grilleCase),
        ) || seancesClasse.some(seance =>
          seance.teacherId === groupe.teacherId && this.chevauche(seance, grilleCase),
        ),
      )) continue;
      if (occupation.some(occupe => occupe.roomId === sallePrincipale.roomId && this.chevauche(occupe, grilleCase))) continue;
      if (seancesClasse.some(seance => seance.roomId === sallePrincipale.roomId && this.chevauche(seance, grilleCase))) continue;

      const rooms = [sallePrincipale.roomId];
      const floatingUsed = new Set<string>();
      let possible = true;
      for (const groupe of groupes.slice(1)) {
        const room = sallesFlottantes.find(salle =>
          salle.capacity >= groupe.participantsCount &&
          !floatingUsed.has(salle.roomId) &&
          !occupation.some(occupe => occupe.roomId === salle.roomId && this.chevauche(occupe, grilleCase)) &&
          !seancesClasse.some(seance => seance.roomId === salle.roomId && this.chevauche(seance, grilleCase)),
        );
        if (!room) {
          possible = false;
          break;
        }
        floatingUsed.add(room.roomId);
        rooms.push(room.roomId);
      }
      if (!possible) continue;

      return groupes.map((groupe, index) => ({
        subjectId: groupe.subjectId,
        teacherId: groupe.teacherId,
        roomId: rooms[index]!,
        dayOfWeek: grilleCase.dayOfWeek,
        startTime: grilleCase.startTime,
        endTime: grilleCase.endTime,
        groupId: groupe.groupId,
        groupName: groupe.groupName,
        participantsCount: groupe.participantsCount,
        isLV2Slot: true,
      }));
    }

    throw new Error('Aucune case de la grille ne peut accueillir toutes les séances LV2 de cette classe');
  }

  private chevauche(a: { dayOfWeek: number; startTime: string; endTime: string }, b: { dayOfWeek: number; startTime: string; endTime: string }): boolean {
    return a.dayOfWeek === b.dayOfWeek &&
      CreneauHoraire.heureEnMinutes(a.startTime) < CreneauHoraire.heureEnMinutes(b.endTime) &&
      CreneauHoraire.heureEnMinutes(a.endTime) > CreneauHoraire.heureEnMinutes(b.startTime);
  }

  /** Plages actives où un enseignant est indisponible — contrainte DURE du solveur (V2.4). */
  private async chargerIndisponibilitesEnseignants(schoolId: string): Promise<IndisponibiliteEnseignant[]> {
    const indisponibilites = await this.teacherUnavailabilityRepository.findBySchool(schoolId);
    return indisponibilites.map(i => ({
      teacherId: i.teacherId,
      dayOfWeek: i.dayOfWeek,
      startTime: i.startTime,
      endTime: i.endTime,
    }));
  }

  /**
   * Une exigence = une affectation pédagogique (TeachingAssignment) de cette classe.
   *
   * EXCLUSIONS explicites — ces matières ne sont PAS des séances classe-entière et relèvent de
   * GenererSeancesGroupeUseCase (fan-out par StudentGroupSet), pas du solveur :
   *   - matière rattachée à un StudentGroup (ex. "Allemand" comme valeur du GroupSet "LV2") :
   *     rien dans le schéma n'empêche un TeachingAssignment classe-entière sur une telle matière
   *     (@@unique([classId, subjectId]) l'autorise), donc l'exclusion doit être EXPLICITE et non
   *     déduite d'une absence de données ;
   *   - matière restreinte à un Group précis (Subject.restrictedToGroupId, ex. English Literature
   *     réservée au programme bilingue) : seule une partie de la classe y assiste.
   */
  private async chargerExigences(classId: string, schoolId: string, dureeCase: number): Promise<ExigenceSeance[]> {
    // Récupération des affectations avec les informations de la matière
    const affectations = await this.timetableRepository.findAffectationsSolver(classId, schoolId);

    // Regroupement par matière (subjectId) pour gérer hoursPerWeek
    const groupedBySubject = new Map<string, {
      subjectId: string;
      subjectType: SubjectType;
      teacherIds: string[];
      subjectName: string;
      hoursPerWeek: number;
      blocDureeCases: number | null;
    }>();

    for (const a of affectations) {
      const key = a.subjectId;
      const existing = groupedBySubject.get(key);
      if (existing) {
        existing.teacherIds.push(a.teacherId);
      } else {
        groupedBySubject.set(key, {
          subjectId: a.subjectId,
          subjectType: a.subjectType as SubjectType,
          teacherIds: [a.teacherId],
          subjectName: a.name || `Matière ${a.subjectId}`,
          hoursPerWeek: a.hoursPerWeek ?? 2,
          blocDureeCases: a.blocDureeCases ?? null,
        });
      }
    }

    // Noms des enseignants — UNE seule requête groupée (pas de N+1).
    const teacherIds = [...new Set(affectations.map(a => a.teacherId))];
    const enseignants = await this.timetableRepository.findNomsEnseignants(teacherIds);
    const nomParEnseignant = new Map(enseignants.map(u => [u.id, u.nomComplet]));

    const exigences: ExigenceSeance[] = [];

    // Pour chaque matière, générer le nombre de séances basé sur hoursPerWeek
    for (const [, groupe] of groupedBySubject) {
      let nbSeances = Math.max(1, Math.round(groupe.hoursPerWeek * 60 / dureeCase));

      // Blocs de 2 h : le nombre de séances doit être PAIR (une séance = un demi-bloc). Si impair,
      // arrondir au pair inférieur — jamais casser un bloc, et jamais laisser une séance orpheline.
      if (groupe.blocDureeCases === 2 && nbSeances % 2 !== 0) {
        nbSeances -= 1;
      }
      // Défensif : une matière à bloc avec 1 h/semaine garde au moins 1 séance (libre, non bloquée).
      if (nbSeances < 1) nbSeances = 1;

      // Création d'identifiants uniques pour chaque séance de cette matière
      for (let i = 0; i < nbSeances; i++) {
        const seanceId = `${groupe.subjectId}#${groupe.teacherIds[0]}#${i}`;
        exigences.push({
          subjectId: groupe.subjectId,
          subjectType: groupe.subjectType,
          teacherId: groupe.teacherIds[0],
          durationMinutes: dureeCase,
          // Champs étendus V2.5
          subjectName: groupe.subjectName,
          teacherName: nomParEnseignant.get(groupe.teacherIds[0]),
          seanceId: seanceId,
          blocDureeCases: groupe.blocDureeCases,
          volumeHebdomadaire: groupe.hoursPerWeek,
          nbOccurrencesHebdomadaires: nbSeances,
          categorieJoursDistincts: calculerCategorieJoursDistincts(groupe.subjectName),
        });
      }
    }

    return exigences;
  }

  /** Grille = jours actifs × périodes de COURS (les pauses ne sont jamais des cases plaçables). */
  private async chargerGrille(schoolId: string): Promise<CaseGrille[]> {
    const config = await this.timetableRepository.getGridConfig(schoolId);
    if (!config) return [];

    return config.joursActifs.flatMap(jour => {
      const dayOfWeek = joursActifsVersIndex([jour])[0]!;
      return this.schedulingGrid.calculerSqelette(config, jour)
        .filter(p => p.type === 'COURS')
        .map(p => ({ dayOfWeek, startTime: p.debut, endTime: p.fin }));
    });
  }
}

/** PGCD d'Euclide — helper simple, pas de lib (le plan exige le PGCD des durées de cases). */
function pgcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}
