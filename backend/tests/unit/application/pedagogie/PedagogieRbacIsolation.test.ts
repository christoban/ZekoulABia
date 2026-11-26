import { describe, expect, it } from 'bun:test';
import { ListerProgrammeUseCase } from '@application/pedagogie/ListerProgrammeUseCase';
import { GererProgrammeUseCase } from '@application/pedagogie/GererProgrammeUseCase';
import { GererChapitreUseCase } from '@application/pedagogie/GererChapitreUseCase';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import { GenererRapportAvancementProgrammesUseCase } from '@application/pedagogie/GenererRapportAvancementProgrammesUseCase';
import { PedagogieForbiddenError } from '@application/pedagogie/errors';
import type { ProgrammeProps, ProgrammeRepository } from '@domain/ports/repositories/ProgrammeRepository';
import type { ChapitreProps, ChapitreRepository } from '@domain/ports/repositories/ChapitreRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { ChapitreAvancementRepository } from '@domain/ports/repositories/ChapitreAvancementRepository';

describe('RBAC strict Pédagogie — Isolation par département des Animateurs Pédagogiques', () => {
  const now = new Date();

  const progAnglais: ProgrammeProps = {
    id: 'prog_en',
    schoolId: 'sch_1',
    subjectId: 'sub_en',
    classId: 'cls_6eA',
    level: '6e',
    academicYearId: 'ay_1',
    titre: 'Anglais 6e',
    source: 'national',
    subject: { id: 'sub_en', name: 'Anglais' },
    class: { id: 'cls_6eA', name: '6e A' },
    chapitres: [
      { id: 'ch_en_1', titre: 'Greetings', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Family', createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const progFrancais: ProgrammeProps = {
    id: 'prog_fr',
    schoolId: 'sch_1',
    subjectId: 'sub_fr',
    classId: 'cls_6eA',
    level: '6e',
    academicYearId: 'ay_1',
    titre: 'Français 6e',
    source: 'national',
    subject: { id: 'sub_fr', name: 'Français' },
    class: { id: 'cls_6eA', name: '6e A' },
    chapitres: [
      { id: 'ch_fr_1', titre: 'La phrase simple', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Grammaire', createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const progEspagnol: ProgrammeProps = {
    id: 'prog_es',
    schoolId: 'sch_1',
    subjectId: 'sub_es',
    classId: 'cls_4eA',
    level: '4e',
    academicYearId: 'ay_1',
    titre: 'Espagnol 4e',
    source: 'national',
    subject: { id: 'sub_es', name: 'Espagnol' },
    class: { id: 'cls_4eA', name: '4e A' },
    chapitres: [
      { id: 'ch_es_1', titre: 'Saludos', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Vida diaria', createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const allProgrammes = [progAnglais, progFrancais, progEspagnol];

  const departmentRepo = {
    findBySchool: async () => [
      { id: 'dept_en', name: 'Anglais', color: '#000', headId: 'ap_anglais', subjects: [{ id: 'sub_en', name: 'Anglais' }] },
      { id: 'dept_fr', name: 'Français', color: '#111', headId: 'ap_francais', subjects: [{ id: 'sub_fr', name: 'Français' }] },
      { id: 'dept_es', name: 'Langues Vivantes', color: '#222', headId: 'ap_lv2', subjects: [{ id: 'sub_es', name: 'Espagnol' }] },
    ],
  } as unknown as DepartmentRepository;

  const programmeRepo = {
    findByFilters: async (_schoolId: string, filters: { subjectId?: string }) =>
      filters.subjectId ? allProgrammes.filter((p) => p.subjectId === filters.subjectId) : allProgrammes,
    findByIdAndSchool: async (id: string) => allProgrammes.find((p) => p.id === id) ?? null,
    save: async (data: Omit<ProgrammeProps, 'id' | 'createdAt' | 'updatedAt'>) => ({
      ...data,
      id: 'prog_new',
      createdAt: now,
      updatedAt: now,
    }),
    update: async (data: { id: string; titre?: string }) => ({
      ...allProgrammes.find((p) => p.id === data.id)!,
      titre: data.titre ?? 'Maj',
    }),
    delete: async () => undefined,
  } as unknown as ProgrammeRepository;

  const chapitreRepo = {
    findByIdAndSchool: async (id: string) => {
      if (id === 'ch_en_1') {
        return { id, programmeId: 'prog_en', titre: 'Greetings', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, createdAt: now, programme: { schoolId: 'sch_1', subjectId: 'sub_en' } };
      }
      if (id === 'ch_fr_1') {
        return { id, programmeId: 'prog_fr', titre: 'La phrase simple', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, createdAt: now, programme: { schoolId: 'sch_1', subjectId: 'sub_fr' } };
      }
      return null;
    },
    findNextOrdre: async () => 2,
    create: async (data: Omit<ChapitreProps, 'id' | 'createdAt'>) => ({ ...data, id: 'ch_new', createdAt: now }),
    update: async (data: { id: string; titre?: string }) => ({
      id: data.id,
      programmeId: 'prog_en',
      titre: data.titre ?? 'Maj',
      ordre: 1,
      volumeHeuresPrevu: null,
      sequenceCibleFin: null,
      createdAt: now,
    }),
    delete: async () => undefined,
  } as unknown as ChapitreRepository;

  const anneeRepo = {
    findCourante: async () => ({ id: 'ay_1' }),
    findById: async () => ({
      id: 'ay_1',
      startDate: new Date(Date.now() - 80 * 86400000),
      endDate: new Date(Date.now() + 20 * 86400000),
    }),
  } as unknown as AnneeAcademiqueRepository;

  const cahierRepo = {
    findByFilters: async () => [],
  } as unknown as CahierDeTexteRepository;

  const classeRepo = {
    findBySchoolAndYear: async () => [
      { id: 'cls_6eA', schoolId: 'sch_1', name: '6e A', level: '6e', filiere: 'FR_GENERAL' },
      { id: 'cls_4eA', schoolId: 'sch_1', name: '4e A', level: '4e', filiere: 'FR_GENERAL' },
    ],
    findById: async (id: string) => ({ id, schoolId: 'sch_1', name: id, level: '6e' }),
  } as unknown as ClasseRepository;

  const avancementRepo = {
    findModuleEtatsByProgrammes: async () => [],
    findAvancementsByClassAndChapitres: async () => [],
  } as unknown as ChapitreAvancementRepository;

  const actorApAnglais = { userId: 'ap_anglais', role: 'TEACHER', permissions: [] };
  const actorProfSimple = { userId: 'prof_lambda', role: 'TEACHER', permissions: [] };
  const actorCenseur = { userId: 'censeur_1', role: 'STAFF', permissions: ['MANAGE_CLASSES'] };
  const actorAdmin = { userId: 'admin_1', role: 'ADMIN', permissions: [] };
  const actorEleve = { userId: 'eleve_1', role: 'STUDENT', permissions: [] };

  it("un AP d'Anglais ne voit QUE les programmes, alertes et rapports d'Anglais (zéro Français, zéro Espagnol)", async () => {
    const lister = new ListerProgrammeUseCase(programmeRepo, departmentRepo);
    const progs = await lister.execute({ schoolId: 'sch_1', actor: actorApAnglais });
    expect(progs.map((p) => p.subjectId)).toEqual(['sub_en']);

    // Même s'il demande explicitement subjectId=sub_fr → vide
    const progsFr = await lister.execute({ schoolId: 'sch_1', subjectId: 'sub_fr', actor: actorApAnglais });
    expect(progsFr).toEqual([]);

    const progUC = new CalculerProgressionProgrammeUseCase(
      programmeRepo,
      cahierRepo,
      classeRepo,
      anneeRepo,
      avancementRepo,
      departmentRepo,
    );
    const alertes = await progUC.calculerAlertesRetardProgramme('sch_1', 'ay_1', 15, actorApAnglais);
    expect(alertes.map((a) => a.subjectId)).toEqual(['sub_en']);

    const rapportUC = new GenererRapportAvancementProgrammesUseCase(
      programmeRepo,
      cahierRepo,
      classeRepo,
      anneeRepo,
      avancementRepo,
      departmentRepo,
    );
    const rapport = await rapportUC.execute({
      schoolId: 'sch_1',
      userId: actorApAnglais.userId,
      role: actorApAnglais.role,
      permissions: actorApAnglais.permissions,
    });
    expect(rapport.lignes.map((l) => l.subjectId)).toEqual(['sub_en']);

    // Demander explicitement le département Français → 403
    await expect(
      rapportUC.execute({
        schoolId: 'sch_1',
        userId: actorApAnglais.userId,
        role: actorApAnglais.role,
        permissions: actorApAnglais.permissions,
        departmentId: 'dept_fr',
      }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
  });

  it("un AP d'Anglais peut modifier l'Anglais mais est bloqué (403) sur Français et Espagnol", async () => {
    const gererProg = new GererProgrammeUseCase(programmeRepo, anneeRepo, departmentRepo);
    const gererChap = new GererChapitreUseCase(chapitreRepo, programmeRepo, departmentRepo);

    // Autorisé sur Anglais
    await expect(
      gererProg.creer({ schoolId: 'sch_1', titre: 'Anglais 5e', subjectId: 'sub_en', actor: actorApAnglais }),
    ).resolves.toBeDefined();
    await expect(
      gererProg.mettreAJour({ schoolId: 'sch_1', id: 'prog_en', titre: 'Anglais 6e v2', actor: actorApAnglais }),
    ).resolves.toBeDefined();
    await expect(
      gererChap.ajouter({ schoolId: 'sch_1', programmeId: 'prog_en', titre: 'Unit 2', actor: actorApAnglais }),
    ).resolves.toBeDefined();
    await expect(
      gererChap.mettreAJour({ schoolId: 'sch_1', id: 'ch_en_1', titre: 'Greetings v2', actor: actorApAnglais }),
    ).resolves.toBeDefined();

    // Refusé (403) sur Français et Espagnol
    await expect(
      gererProg.creer({ schoolId: 'sch_1', titre: 'Pirate FR', subjectId: 'sub_fr', actor: actorApAnglais }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
    await expect(
      gererProg.mettreAJour({ schoolId: 'sch_1', id: 'prog_fr', titre: 'Pirate FR', actor: actorApAnglais }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
    await expect(
      gererProg.supprimer({ schoolId: 'sch_1', id: 'prog_es', actor: actorApAnglais }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
    await expect(
      gererChap.ajouter({ schoolId: 'sch_1', programmeId: 'prog_fr', titre: 'Pirate', actor: actorApAnglais }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
    await expect(
      gererChap.mettreAJour({ schoolId: 'sch_1', id: 'ch_fr_1', titre: 'Pirate', actor: actorApAnglais }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
    await expect(
      gererChap.supprimer({ schoolId: 'sch_1', id: 'ch_fr_1', actor: actorApAnglais }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
  });

  it('Admin et Censeur (MANAGE_CLASSES) voient toute l école ; Enseignant simple et Élève sont bloqués (403)', async () => {
    const lister = new ListerProgrammeUseCase(programmeRepo, departmentRepo);
    const gererProg = new GererProgrammeUseCase(programmeRepo, anneeRepo, departmentRepo);

    expect((await lister.execute({ schoolId: 'sch_1', actor: actorAdmin })).length).toBe(3);
    expect((await lister.execute({ schoolId: 'sch_1', actor: actorCenseur })).length).toBe(3);

    await expect(lister.execute({ schoolId: 'sch_1', actor: actorProfSimple })).rejects.toBeInstanceOf(
      PedagogieForbiddenError,
    );
    await expect(lister.execute({ schoolId: 'sch_1', actor: actorEleve })).rejects.toBeInstanceOf(
      PedagogieForbiddenError,
    );
    await expect(
      gererProg.creer({ schoolId: 'sch_1', titre: 'Non autorisé', subjectId: 'sub_en', actor: actorProfSimple }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
  });
});
