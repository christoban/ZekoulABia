import { describe, expect, it } from 'bun:test';
import { GererChapitreUseCase } from '@application/pedagogie/GererChapitreUseCase';
import type {
  ChapitreCreateData,
  ChapitreProps,
  ChapitreRepository,
  ChapitreUpdateData,
} from '@domain/ports/repositories/ChapitreRepository';
import type { ProgrammeProps, ProgrammeRepository } from '@domain/ports/repositories/ProgrammeRepository';

describe('Audit Chapitre.volumeHeuresPrevu — défaut 2h sur programmes manuels vs null autorisé sur national', () => {
  const now = new Date();
  const progManuel: ProgrammeProps = {
    id: 'prog_man',
    schoolId: 'sch_1',
    subjectId: 'sub_1',
    classId: 'cls_1',
    level: '6e',
    academicYearId: 'ay_1',
    titre: 'Programme Manuel',
    source: 'manuel',
    createdAt: now,
    updatedAt: now,
  };
  const progNational: ProgrammeProps = {
    ...progManuel,
    id: 'prog_nat',
    titre: 'Programme National',
    source: 'national',
    officialProgressionId: 'off_1',
  };

  function buildUseCase() {
    const created: ChapitreCreateData[] = [];
    const updated: ChapitreUpdateData[] = [];

    const programmeRepo = {
      findByIdAndSchool: async (id: string) =>
        id === 'prog_man' ? progManuel : id === 'prog_nat' ? progNational : null,
    } as unknown as ProgrammeRepository;

    const chapitreRepo = {
      findNextOrdre: async () => 1,
      create: async (data: ChapitreCreateData): Promise<ChapitreProps> => {
        created.push(data);
        return { ...data, id: `ch_${created.length}`, createdAt: now };
      },
      findByIdAndSchool: async (id: string) => {
        if (id === 'ch_man') {
          return {
            id,
            programmeId: 'prog_man',
            titre: 'Ch Manuel',
            ordre: 1,
            volumeHeuresPrevu: 4,
            sequenceCibleFin: 1,
            createdAt: now,
            programme: { schoolId: 'sch_1', subjectId: 'sub_1', source: 'manuel' },
          };
        }
        if (id === 'ch_nat') {
          return {
            id,
            programmeId: 'prog_nat',
            titre: 'Leçon Nationale',
            ordre: 1,
            volumeHeuresPrevu: 2,
            sequenceCibleFin: null,
            createdAt: now,
            programme: { schoolId: 'sch_1', subjectId: 'sub_1', source: 'national' },
          };
        }
        return null;
      },
      update: async (data: ChapitreUpdateData): Promise<ChapitreProps> => {
        updated.push(data);
        return {
          id: data.id,
          programmeId: 'prog_man',
          titre: data.titre ?? 'Ch',
          ordre: data.ordre ?? 1,
          volumeHeuresPrevu: data.volumeHeuresPrevu ?? null,
          sequenceCibleFin: data.sequenceCibleFin ?? null,
          createdAt: now,
        };
      },
    } as unknown as ChapitreRepository;

    return {
      useCase: new GererChapitreUseCase(chapitreRepo, programmeRepo),
      created,
      updated,
    };
  }

  it('applique toujours 2h par défaut sur un programme manuel si volumeHeuresPrevu est absent, null, 0 ou NaN', async () => {
    const { useCase, created } = buildUseCase();

    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_man', titre: 'Sans heure' });
    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_man', titre: 'Null', volumeHeuresPrevu: null });
    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_man', titre: 'Zero', volumeHeuresPrevu: 0 });
    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_man', titre: 'NaN', volumeHeuresPrevu: Number.NaN });
    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_man', titre: 'Valide', volumeHeuresPrevu: 6 });

    expect(created.map((c) => c.volumeHeuresPrevu)).toEqual([2, 2, 2, 2, 6]);
  });

  it('autorise null explicitement sur un programme national, mais garde 2h si omis (undefined)', async () => {
    const { useCase, created } = buildUseCase();

    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_nat', titre: 'Ajout national null', volumeHeuresPrevu: null });
    await useCase.ajouter({ schoolId: 'sch_1', programmeId: 'prog_nat', titre: 'Ajout national sans param' });

    expect(created[0].volumeHeuresPrevu).toBeNull();
    expect(created[1].volumeHeuresPrevu).toBe(2);
  });

  it('empêche une mise à jour de passer volumeHeuresPrevu à null involontairement sur un chapitre manuel, mais l autorise sur un national', async () => {
    const { useCase, updated } = buildUseCase();

    await useCase.mettreAJour({ schoolId: 'sch_1', id: 'ch_man', volumeHeuresPrevu: null });
    await useCase.mettreAJour({ schoolId: 'sch_1', id: 'ch_nat', volumeHeuresPrevu: null });

    expect(updated[0].volumeHeuresPrevu).toBe(4);
    expect(updated[1].volumeHeuresPrevu).toBeNull();
  });
});
