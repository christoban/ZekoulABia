import { describe, it, expect } from 'bun:test';
import { ProposerEmploiDuTempsUseCase } from '../../../../src/application/timetable/ProposerEmploiDuTempsUseCase.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { Room } from '@domain/entities/Room';
import { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';
import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { RoomRepository } from '@domain/ports/repositories/RoomRepository';
import type { ClassRoomAssignmentRepository } from '@domain/ports/repositories/ClassRoomAssignmentRepository';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';
import type {
  CreneauOccupe,
  ProposerEmploiDuTempsInput,
  PropositionEmploiDuTemps,
  SchedulingSolverPort,
} from '@domain/ports/services/SchedulingSolverPort';
import type { SchedulingGridPort } from '@domain/ports/services/SchedulingGridPort';

const stubSchedulingGrid: SchedulingGridPort = {
  calculerSqelette: (cfg) => {
    const periods: Array<{ ordre: number; debut: string; fin: string; type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'; duree: number }> = [];
    let ordre = 1;
    let minutes = parseInt(cfg.heureDebut.split(':')[0]) * 60 + parseInt(cfg.heureDebut.split(':')[1]);
    for (let i = 0; i < cfg.periodesAvantP1; i++) {
      const debut = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      minutes += cfg.dureePeriode;
      const fin = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      periods.push({ ordre: ordre++, debut, fin, type: 'COURS', duree: cfg.dureePeriode });
    }
    return periods;
  },
};

function edtDraft() {
  return EmploiDuTemps.reconstituer({
    id: 'edt-1', schoolId: 'school-1', classId: 'classe-1', academicYearId: 'annee-1',
    status: 'DRAFT' as const, generatedByAI: false, createdAt: new Date(),
  });
}

function salleActive() {
  return Room.create({ schoolId: 'school-1', name: 'Salle 1', type: 'NORMAL', capacity: 40 });
}

function roomRepositoryStub(): RoomRepository {
  return {
    findById: async () => null,
    findBySchool: async () => [salleActive()],
    existsByName: async () => false,
    save: async () => {},
    update: async () => {},
    supprimerAvecCascade: async () => {},
    restaurer: async () => {},
  };
}

function classRoomAssignmentRepositoryStub(): ClassRoomAssignmentRepository {
  return {
    findByClasseAndAnnee: async () => null,
    findBySchool: async () => [],
    upsert: async () => {},
    delete: async () => {},
  };
}

/** Stub complet de TimetableRepository : toutes les méthodes en no-op, sauf celles du solveur. */
function timetableRepositoryStub(edt: EmploiDuTemps, occupation: CreneauOccupe[] = [], options: {
  affectations?: unknown[];
  gridConfig?: unknown;
  nomsEnseignants?: { id: string; nomComplet: string }[];
} = {}): TimetableRepository {
  const {
    affectations = [
      { teacherId: 'prof-1', subjectId: 'maths', subjectType: 'THEORETICAL', hoursPerWeek: 2, name: 'Maths', blocDureeCases: null },
    ],
    gridConfig = {
      joursActifs: ['LUNDI'],
      heureDebut: '08:00',
      dureePeriode: 60,
      periodesAvantP1: 2,
      dureePetitePause: 0,
      periodesAvantP2: 0,
      dureeGrandePause: 0,
      periodesApresP2: 0,
    },
    nomsEnseignants = [{ id: 'prof-1', nomComplet: 'Prof Un' }],
  } = options;

  return {
    findById: async () => edt,
    findByClasse: async () => null,
    findSubmittedBySchool: async () => [],
    save: async () => {},
    update: async () => {},
    publishSubmittedBySchool: async () => [],
    countCreneaux: async () => 0,
    findCreneauById: async () => null,
    findCreneauxByTimetable: async () => [],
    saveCreneaux: async () => {},
    updateCreneau: async () => {},
    deleteCreneau: async () => {},
    deleteCreneauxTimetable: async () => 0,
    findCreneauxEnseignantParJour: async () => [],
    calculerVolumeHoraireHebdo: async () => 0,
    getInfosEnseignant: async () => null,
    getInfosSalle: async () => null,
    findCreneauxSalleParJour: async () => [],
    sousGroupeAppartientAClasse: async () => false,
    findOccupationEcole: async () => occupation,
    creerCreneauxEnLot: async () => ({ creneauxCrees: 0 }),
    getGridConfig: async () => gridConfig as never,
    saveGridConfig: async (_s: string, d: never) => d,
    countTimetablesBySchool: async () => 0,
    classeAppartientAEcole: async () => true,
    findSlotAvecContexte: async () => null,
    findElevesClasseAvecProfils: async () => [],
    findAffectationsSolver: async () => affectations as never,
    findNomsEnseignants: async () => nomsEnseignants,
    compterEnseignants: async () => 0,
    compterSalles: async () => 0,
    compterMatieres: async () => 0,
    findClassIdsAvecEdtPublie: async () => [],
    findSlotsEnseignantJour: async () => [],
    findContexteAdjustIA: async () => null,
    findSlotActuelParSalleEtEnseignant: async () => null,
    findRoomIdDeSlot: async () => null,
  };
}

function teacherUnavailabilityRepositoryStub(
  indisponibilites: { teacherId: string; dayOfWeek: number; startTime: string; endTime: string }[] = [],
): TeacherUnavailabilityRepository {
  return {
    findById: async () => null,
    findBySchool: async () => indisponibilites.map((i, idx) =>
      TeacherUnavailability.reconstituer({
        id: `u-${idx}`, schoolId: 'school-1', teacherId: i.teacherId, dayOfWeek: i.dayOfWeek,
        startTime: i.startTime, endTime: i.endTime, reason: null, active: true, createdAt: new Date(),
      }),
    ),
    findByTeacher: async () => [],
    save: async () => {},
    update: async () => {},
    delete: async () => {},
  };
}

describe('ProposerEmploiDuTempsUseCase — chargement des indisponibilités (V2.4)', () => {
  it('transmet les indisponibilités actives de l\'école au solveur', async () => {
    let inputRecu: ProposerEmploiDuTempsInput | null = null;
    const solver: SchedulingSolverPort = {
      proposer: async (input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> => {
        inputRecu = input;
        return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
      },
    };

    const useCase = new ProposerEmploiDuTempsUseCase(
      timetableRepositoryStub(edtDraft()),
      roomRepositoryStub(),
      classRoomAssignmentRepositoryStub(),
      teacherUnavailabilityRepositoryStub([{ teacherId: "prof-1", dayOfWeek: 0, startTime: "08:00", endTime: "09:00" }]),
      solver,
      stubSchedulingGrid,
    );

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(inputRecu!.indisponibilitesEnseignants).toEqual([
      { teacherId: 'prof-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
    ]);
  });

  it('transmet une liste vide si aucune indisponibilité', async () => {
    let inputRecu: ProposerEmploiDuTempsInput | null = null;
    const solver: SchedulingSolverPort = {
      proposer: async (input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> => {
        inputRecu = input;
        return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
      },
    };

    const useCase = new ProposerEmploiDuTempsUseCase(
      timetableRepositoryStub(edtDraft()),
      roomRepositoryStub(),
      classRoomAssignmentRepositoryStub(),
      teacherUnavailabilityRepositoryStub(),
      solver,
      stubSchedulingGrid,
    );

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(inputRecu!.indisponibilitesEnseignants).toEqual([]);
  });
});

describe('ProposerEmploiDuTempsUseCase — volume horaire exact multi-séances (V2.5)', () => {
  function solverCapturant(): { solver: SchedulingSolverPort; input: () => ProposerEmploiDuTempsInput | null } {
    let inputRecu: ProposerEmploiDuTempsInput | null = null;
    return {
      solver: {
        proposer: async (input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> => {
          inputRecu = input;
          return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
        },
      },
      input: () => inputRecu,
    };
  }

  function construireUseCase(solver: SchedulingSolverPort, options: {
    hoursPerWeek?: number | null;
    blocDureeCases?: number | null;
    nbPeriodesParJour?: number;
    joursActifs?: string[];
    subjectName?: string;
    subjectType?: 'THEORETICAL' | 'PRACTICAL' | 'MIXED';
  } = {}) {
    const {
      hoursPerWeek = 2,
      blocDureeCases = null,
      nbPeriodesParJour = 2,
      joursActifs = ['LUNDI'],
      subjectName = 'Maths',
      subjectType = 'THEORETICAL',
    } = options;

    const affectations = [{
      teacherId: 'prof-1', subjectId: 'maths', subjectType,
      hoursPerWeek, name: subjectName, blocDureeCases,
    }];
    const gridConfig = {
      joursActifs,
      heureDebut: '08:00',
      dureePeriode: 60,
      periodesAvantP1: nbPeriodesParJour,
      dureePetitePause: 0,
      periodesAvantP2: 0,
      dureeGrandePause: 0,
      periodesApresP2: 0,
    };

    return new ProposerEmploiDuTempsUseCase(
      timetableRepositoryStub(edtDraft(), [], { affectations, gridConfig }),
      roomRepositoryStub(),
      classRoomAssignmentRepositoryStub(),
      teacherUnavailabilityRepositoryStub(),
      solver,
      stubSchedulingGrid,
    );
  }

  it('hoursPerWeek=4 sur cases d\'1 h → 4 exigences pour cette matière', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, { hoursPerWeek: 4, nbPeriodesParJour: 4 });

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const exigences = input()!.exigences;
    expect(exigences).toHaveLength(4);
    expect(exigences.every(e => e.subjectId === 'maths' && e.teacherId === 'prof-1')).toBe(true);
    // Chaque séance porte un identifiant interne distinct (dédoublonnage / explicatifs).
    expect(new Set(exigences.map(e => e.seanceId)).size).toBe(4);
  });

  it('hoursPerWeek non renseigné → défaut 2 (schéma Prisma)', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, { hoursPerWeek: null, nbPeriodesParJour: 4 });

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(input()!.exigences).toHaveLength(2);
  });

  it('volume > capacité de la grille → erreur explicite (Fail Fast)', async () => {
    const { solver } = solverCapturant();
    // Grille : 1 jour × 2 cases = 2 cases plaçables, mais hoursPerWeek=4 → 4 séances.
    const useCase = construireUseCase(solver, { hoursPerWeek: 4, nbPeriodesParJour: 2, joursActifs: ['LUNDI'] });

    await expect(useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' }))
      .rejects.toThrow('Le volume hebdomadaire des matières (4 séances) dépasse la capacité de la grille (2 cases)');
  });

  it('expansion remplit subjectName, teacherName et durationMinutes', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, { hoursPerWeek: 2, nbPeriodesParJour: 2 });

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const e = input()!.exigences[0]!;
    expect(e.subjectName).toBe('Maths');
    expect(e.teacherName).toBe('Prof Un');
    expect(e.durationMinutes).toBe(60);
  });

  it('bloc=2 : nombre de séances arrondi au pair inférieur, champ propagé', async () => {
    const { solver, input } = solverCapturant();
    // 3 h/semaine sur cases d'1 h → 3 séances, arrondies à 2 (pair) pour former un bloc.
    const useCase = construireUseCase(solver, { hoursPerWeek: 3, blocDureeCases: 2, nbPeriodesParJour: 4 });

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    const exigences = input()!.exigences;
    expect(exigences).toHaveLength(2);
    expect(exigences.every(e => e.blocDureeCases === 2)).toBe(true);
  });

  it('calcule volume, occurrences et catégorie EPS/TM depuis le nom normalisé', async () => {
    for (const subjectName of [
      'Éducation Physique et Sportive',
      'Physical Education and Sports',
      'Travaux Manuels / Technologie',
      'Manual Work and Technology',
    ]) {
      const { solver, input } = solverCapturant();
      const useCase = construireUseCase(solver, { subjectName, hoursPerWeek: 2, blocDureeCases: 2, joursActifs: ['LUNDI', 'MARDI'] });

      await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

      expect(input()!.exigences[0]).toMatchObject({
        subjectName,
        volumeHebdomadaire: 2,
        nbOccurrencesHebdomadaires: 2,
        categorieJoursDistincts: 'EPS_TM',
      });
    }
  });

  it('ne décide jamais EPS/TM avec subjectType seul', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, { subjectName: 'Maths', subjectType: 'PRACTICAL' });

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(input()!.exigences[0]!.categorieJoursDistincts).toBeUndefined();
  });

  it('contraintes douces transmises telles quelles au solveur', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, { nbPeriodesParJour: 2 });

    await useCase.execute({
      timetableId: 'edt-1', schoolId: 'school-1',
      contraintes: { trouEnseignant: true, volumeMaxEnseignantParJour: 240 },
    });

     expect(input()!.contraintes).toEqual({ trouEnseignant: true, volumeMaxEnseignantParJour: 240, reglesPedagogiques: false, explicatifs: true });

  });

  it('active la séparation des temps libres même sans autres contraintes', async () => {
    const { solver, input } = solverCapturant();
    const useCase = construireUseCase(solver, { nbPeriodesParJour: 2 });

    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1' });

    expect(input()!.contraintes).toEqual({ reglesPedagogiques: false, explicatifs: true });
  });
});
