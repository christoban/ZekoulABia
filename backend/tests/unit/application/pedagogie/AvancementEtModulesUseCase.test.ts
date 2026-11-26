import { describe, expect, it } from 'bun:test';
import { BasculerAvancementChapitreUseCase } from '@application/pedagogie/BasculerAvancementChapitreUseCase';
import { BasculerModuleActifUseCase } from '@application/pedagogie/BasculerModuleActifUseCase';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import { PedagogieForbiddenError } from '@application/pedagogie/errors';
import type {
  ChapitreAvancementProps,
  ChapitreAvancementRepository,
  ProgrammeModuleEtatProps,
} from '@domain/ports/repositories/ChapitreAvancementRepository';
import type { ProgrammeProps, ProgrammeRepository } from '@domain/ports/repositories/ProgrammeRepository';
import type { CahierDeTexteProps, CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';

class FakeAvancementRepo implements ChapitreAvancementRepository {
  public avancements: ChapitreAvancementProps[] = [];
  public moduleEtats: ProgrammeModuleEtatProps[] = [];

  constructor(
    private readonly programme: ProgrammeProps,
    private readonly apUserIds: Set<string>,
  ) {}

  async findAvancementsByClass(schoolId: string, classId: string, academicYearId: string) {
    return this.avancements.filter(
      (a) => a.schoolId === schoolId && a.classId === classId && a.academicYearId === academicYearId,
    );
  }

  async findAvancementsByClassAndChapitres(schoolId: string, classId: string, chapitreIds: string[]) {
    const set = new Set(chapitreIds);
    return this.avancements.filter(
      (a) => a.schoolId === schoolId && a.classId === classId && set.has(a.chapitreId),
    );
  }

  async marquerFait(data: {
    schoolId: string;
    classId: string;
    chapitreId: string;
    academicYearId: string;
    cocheParId: string;
  }) {
    const existing = this.avancements.find(
      (a) => a.classId === data.classId && a.chapitreId === data.chapitreId,
    );
    if (existing) {
      existing.cocheParId = data.cocheParId;
      existing.cocheLe = new Date();
      return existing;
    }
    const created: ChapitreAvancementProps = {
      id: `av_${this.avancements.length + 1}`,
      schoolId: data.schoolId,
      classId: data.classId,
      chapitreId: data.chapitreId,
      academicYearId: data.academicYearId,
      statut: 'FAIT',
      cocheParId: data.cocheParId,
      cocheLe: new Date(),
    };
    this.avancements.push(created);
    return created;
  }

  async retirerCocheDirecte(schoolId: string, classId: string, chapitreId: string) {
    const before = this.avancements.length;
    this.avancements = this.avancements.filter(
      (a) => !(a.schoolId === schoolId && a.classId === classId && a.chapitreId === chapitreId),
    );
    return this.avancements.length < before;
  }

  async findModuleEtatsByProgramme(schoolId: string, programmeId: string) {
    return this.moduleEtats.filter((m) => m.schoolId === schoolId && m.programmeId === programmeId);
  }

  async findModuleEtatsByProgrammes(schoolId: string, programmeIds: string[]) {
    const set = new Set(programmeIds);
    return this.moduleEtats.filter((m) => m.schoolId === schoolId && set.has(m.programmeId));
  }

  async definirModuleActif(data: {
    schoolId: string;
    programmeId: string;
    moduleOrdre: number;
    actif: boolean;
    modifieParId: string;
  }) {
    const existing = this.moduleEtats.find(
      (m) => m.programmeId === data.programmeId && m.moduleOrdre === data.moduleOrdre,
    );
    if (existing) {
      existing.actif = data.actif;
      existing.modifieParId = data.modifieParId;
      existing.modifieLe = new Date();
      return existing;
    }
    const created: ProgrammeModuleEtatProps = {
      id: `mod_${this.moduleEtats.length + 1}`,
      schoolId: data.schoolId,
      programmeId: data.programmeId,
      moduleOrdre: data.moduleOrdre,
      actif: data.actif,
      modifieParId: data.modifieParId,
      modifieLe: new Date(),
    };
    this.moduleEtats.push(created);
    return created;
  }

  async findChapitreContextePourCoche(schoolId: string, chapitreId: string) {
    if (this.programme.schoolId !== schoolId) return null;
    const ch = (this.programme.chapitres ?? []).find((c) => c.id === chapitreId);
    if (!ch) return null;
    return {
      chapitreId: ch.id,
      programmeId: this.programme.id,
      schoolId: this.programme.schoolId,
      subjectId: this.programme.subjectId,
      classId: this.programme.classId,
      level: this.programme.level,
      academicYearId: this.programme.academicYearId,
      moduleOrdre: ch.moduleOrdre ?? null,
    };
  }

  async findProgrammeContextePourModule(schoolId: string, programmeId: string) {
    if (this.programme.schoolId !== schoolId || this.programme.id !== programmeId) return null;
    const ordres = Array.from(
      new Set(
        (this.programme.chapitres ?? [])
          .map((c) => c.moduleOrdre)
          .filter((x): x is number => x !== null && x !== undefined),
      ),
    );
    return {
      programmeId: this.programme.id,
      schoolId: this.programme.schoolId,
      subjectId: this.programme.subjectId,
      classId: this.programme.classId,
      level: this.programme.level,
      academicYearId: this.programme.academicYearId,
      modulesOrdresExistants: ordres,
    };
  }

  async estAnimateurPedagogiqueDeMatiere(_schoolId: string, userId: string, _subjectId: string) {
    return this.apUserIds.has(userId);
  }
}

function buildHarness(options?: {
  withHours?: boolean;
  cahierChapitreIds?: string[];
  assignedTeachers?: string[];
  apUsers?: string[];
}) {
  const now = new Date();
  const programme: ProgrammeProps = {
    id: 'prog_tm_6e',
    schoolId: 'sch_1',
    subjectId: 'sub_tm',
    classId: 'cls_6e1',
    level: '6e',
    academicYearId: 'ay_1',
    titre: 'Travail Manuel 6e',
    source: 'national',
    officialProgressionId: 'off_tm_6e',
    chapitres: [
      {
        id: 'ch_m1_1',
        titre: 'Atelier Agriculture — Leçon 1',
        ordre: 1,
        volumeHeuresPrevu: options?.withHours ? 2 : null,
        sequenceCibleFin: null,
        moduleOrdre: 1,
        moduleTitre: 'Atelier Agriculture',
        numeroAffiche: 'Leçon 1',
        createdAt: now,
      },
      {
        id: 'ch_m1_2',
        titre: 'Atelier Agriculture — Leçon 2',
        ordre: 2,
        volumeHeuresPrevu: options?.withHours ? 3 : null,
        sequenceCibleFin: null,
        moduleOrdre: 1,
        moduleTitre: 'Atelier Agriculture',
        numeroAffiche: 'Leçon 2',
        createdAt: now,
      },
      {
        id: 'ch_m2_1',
        titre: 'Atelier Élevage — Leçon 1',
        ordre: 3,
        volumeHeuresPrevu: options?.withHours ? 2 : null,
        sequenceCibleFin: null,
        moduleOrdre: 2,
        moduleTitre: 'Atelier Élevage',
        numeroAffiche: 'Leçon 1',
        createdAt: now,
      },
      {
        id: 'ch_m3_1',
        titre: 'Atelier Couture — Leçon 1',
        ordre: 4,
        volumeHeuresPrevu: options?.withHours ? 2 : null,
        sequenceCibleFin: null,
        moduleOrdre: 3,
        moduleTitre: 'Atelier Couture',
        numeroAffiche: 'Leçon 1',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const cahierEntries: CahierDeTexteProps[] = (options?.cahierChapitreIds ?? []).map((cid, idx) => ({
    id: `cah_${idx}`,
    schoolId: 'sch_1',
    teacherId: 'teacher_assigned',
    classId: 'cls_6e1',
    subjectId: 'sub_tm',
    academicYearId: 'ay_1',
    chapitreId: cid,
    date: now,
    contenuRealise: 'Séance faite',
    contenuLibre: null,
    devoirsDonnes: null,
    createdAt: now,
  }));

  const assignedSet = new Set(options?.assignedTeachers ?? ['teacher_assigned']);
  const avancementRepo = new FakeAvancementRepo(programme, new Set(options?.apUsers ?? ['user_ap']));

  const cahierRepo = {
    findByFilters: async () => cahierEntries,
  } as unknown as CahierDeTexteRepository;

  const programmeRepo = {
    findByClassSubject: async () => programme,
    findByFilters: async () => [programme],
  } as unknown as ProgrammeRepository;

  const classeRepo = {
    findById: async () => ({ id: 'cls_6e1', schoolId: 'sch_1', name: '6e 1', level: '6e' }),
  } as unknown as ClasseRepository;

  const anneeRepo = {
    findCourante: async () => ({ id: 'ay_1' }),
    findById: async () => ({
      id: 'ay_1',
      startDate: new Date(Date.now() - 60 * 86400000),
      endDate: new Date(Date.now() + 60 * 86400000),
    }),
  } as unknown as AnneeAcademiqueRepository;

  const rattachementRepo = {
    estRattacheALaClasse: async (teacherId: string) => assignedSet.has(teacherId),
  } as unknown as RattachementEnseignantRepository;

  return {
    programme,
    avancementRepo,
    basculerAvancement: new BasculerAvancementChapitreUseCase(avancementRepo, cahierRepo, rattachementRepo),
    basculerModule: new BasculerModuleActifUseCase(avancementRepo, rattachementRepo),
    calculerProgression: new CalculerProgressionProgrammeUseCase(
      programmeRepo,
      cahierRepo,
      classeRepo,
      anneeRepo,
      avancementRepo,
    ),
  };
}

describe('Coche directe, coexistence cahier, modules désactivés, RBAC et heures null', () => {
  it('gère la coexistence coche directe + cahier de texte et conserve CAHIER après décoche', async () => {
    const h = buildHarness({ cahierChapitreIds: ['ch_m1_1'] });

    // Cocher directement une leçon déjà référencée dans le cahier de texte → LES_DEUX
    const coche = await h.basculerAvancement.execute({
      schoolId: 'sch_1',
      userId: 'teacher_assigned',
      role: 'TEACHER',
      chapitreId: 'ch_m1_1',
      classId: 'cls_6e1',
      fait: true,
    });
    expect(coche.realise).toBe(true);
    expect(coche.cocheDirecte).toBe(true);
    expect(coche.sourceRealisation).toBe('LES_DEUX');

    // Décocher ne retire que la coche directe : la leçon reste validée via CAHIER
    const decoche = await h.basculerAvancement.execute({
      schoolId: 'sch_1',
      userId: 'teacher_assigned',
      role: 'TEACHER',
      chapitreId: 'ch_m1_1',
      classId: 'cls_6e1',
      fait: false,
    });
    expect(decoche.cocheDirecte).toBe(false);
    expect(decoche.realise).toBe(true);
    expect(decoche.sourceRealisation).toBe('CAHIER');
  });

  it('exclut les modules désactivés du taux de progression sans jamais les supprimer', async () => {
    const h = buildHarness({ cahierChapitreIds: [] });

    // Cocher 1 leçon sur 2 dans le module 1 (Agriculture)
    await h.basculerAvancement.execute({
      schoolId: 'sch_1',
      userId: 'teacher_assigned',
      role: 'TEACHER',
      chapitreId: 'ch_m1_1',
      classId: 'cls_6e1',
      fait: true,
    });

    // Avant désactivation : 1/4 = 25%
    const avant = await h.calculerProgression.calculerProgression({
      schoolId: 'sch_1',
      classId: 'cls_6e1',
      subjectId: 'sub_tm',
    });
    expect(avant.leconsTotal).toBe(4);
    expect(avant.leconsRealisees).toBe(1);
    expect(avant.progressionPct).toBe(25);
    expect(avant.modulesDesactivesCount).toBe(0);

    // Désactiver les ateliers 2 (Élevage) et 3 (Couture)
    await h.basculerModule.execute({
      schoolId: 'sch_1',
      userId: 'teacher_assigned',
      role: 'TEACHER',
      programmeId: 'prog_tm_6e',
      moduleOrdre: 2,
      actif: false,
    });
    await h.basculerModule.execute({
      schoolId: 'sch_1',
      userId: 'user_ap',
      role: 'STAFF',
      programmeId: 'prog_tm_6e',
      moduleOrdre: 3,
      actif: false,
    });

    // Après désactivation : 1/2 = 50%, 2 modules désactivés, mais les 4 chapitres restent en base
    const apres = await h.calculerProgression.calculerProgression({
      schoolId: 'sch_1',
      classId: 'cls_6e1',
      subjectId: 'sub_tm',
    });
    expect(apres.leconsTotal).toBe(2);
    expect(apres.leconsRealisees).toBe(1);
    expect(apres.progressionPct).toBe(50);
    expect(apres.modulesDesactivesCount).toBe(2);
    expect(apres.chapitres).toHaveLength(4);
    expect(apres.chapitres.filter((c) => !c.moduleActif)).toHaveLength(2);
  });

  it('applique strictement le RBAC (enseignant non affecté refusé, AP autorisé, Admin lecture seule sur modules)', async () => {
    const h = buildHarness();

    // Enseignant non affecté refusé sur coche
    await expect(
      h.basculerAvancement.execute({
        schoolId: 'sch_1',
        userId: 'teacher_other',
        role: 'TEACHER',
        chapitreId: 'ch_m1_1',
        classId: 'cls_6e1',
        fait: true,
      }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);

    // AP du département autorisé sur coche
    const resAp = await h.basculerAvancement.execute({
      schoolId: 'sch_1',
      userId: 'user_ap',
      role: 'TEACHER',
      chapitreId: 'ch_m1_1',
      classId: 'cls_6e1',
      fait: true,
    });
    expect(resAp.cocheDirecte).toBe(true);

    // Admin refusé (lecture seule) sur bascule de module
    await expect(
      h.basculerModule.execute({
        schoolId: 'sch_1',
        userId: 'admin_1',
        role: 'ADMIN',
        programmeId: 'prog_tm_6e',
        moduleOrdre: 2,
        actif: false,
      }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);

    // Enseignant non affecté refusé sur bascule de module
    await expect(
      h.basculerModule.execute({
        schoolId: 'sch_1',
        userId: 'teacher_other',
        role: 'TEACHER',
        programmeId: 'prog_tm_6e',
        moduleOrdre: 2,
        actif: false,
      }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
  });

  it('ne retourne jamais 0h ou NaN quand volumeHeuresPrevu est null, et somme correctement quand renseigné', async () => {
    const sansHeures = buildHarness({ withHours: false, cahierChapitreIds: ['ch_m1_1'] });
    const progNull = await sansHeures.calculerProgression.calculerProgression({
      schoolId: 'sch_1',
      classId: 'cls_6e1',
      subjectId: 'sub_tm',
    });
    expect(progNull.hasHeuresPrevu).toBe(false);
    expect(progNull.totalHeuresPrevu).toBeNull();
    expect(progNull.heuresRealisees).toBeNull();

    const avecHeures = buildHarness({ withHours: true, cahierChapitreIds: ['ch_m1_1'] });
    const progHeures = await avecHeures.calculerProgression.calculerProgression({
      schoolId: 'sch_1',
      classId: 'cls_6e1',
      subjectId: 'sub_tm',
    });
    expect(progHeures.hasHeuresPrevu).toBe(true);
    expect(progHeures.totalHeuresPrevu).toBe(9);
    expect(progHeures.heuresRealisees).toBe(2);
  });
});
