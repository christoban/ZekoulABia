import { describe, expect, it } from 'bun:test';
import {
  formaterRapportAvancementCsv,
  GenererRapportAvancementProgrammesUseCase,
} from '@application/pedagogie/GenererRapportAvancementProgrammesUseCase';
import { RelancerRetardsProgrammesUseCase } from '@application/pedagogie/RelancerRetardsProgrammesUseCase';
import type { ProgrammeProps, ProgrammeRepository } from '@domain/ports/repositories/ProgrammeRepository';
import type { CahierDeTexteRepository } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ChapitreAvancementRepository } from '@domain/ports/repositories/ChapitreAvancementRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { EnvoiNotificationOptions, NotificationService } from '@domain/ports/services/NotificationService';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';

describe('Lot 3 — Rapport consolidé par niveau/département, export CSV et relances ciblées', () => {
  const now = new Date();
  const programmes: ProgrammeProps[] = [
    {
      id: 'prog_tm',
      schoolId: 'sch_1',
      subjectId: 'sub_tm',
      classId: 'cls_6eA',
      level: '6e',
      academicYearId: 'ay_1',
      titre: '=Travail Manuel 6e',
      source: 'national',
      filiere: 'FR_GENERAL',
      subject: { id: 'sub_tm', name: 'Travail Manuel' },
      class: { id: 'cls_6eA', name: '6e A' },
      chapitres: [
        { id: 'c1', titre: 'Atelier 1 — L1', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Atelier 1', createdAt: now },
        { id: 'c2', titre: 'Atelier 1 — L2', ordre: 2, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Atelier 1', createdAt: now },
        { id: 'c3', titre: 'Atelier 2 — L1', ordre: 3, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 2, moduleTitre: 'Atelier 2', createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prog_math',
      schoolId: 'sch_1',
      subjectId: 'sub_math',
      classId: 'cls_6eA',
      level: '6e',
      academicYearId: 'ay_1',
      titre: 'Mathématiques 6e',
      source: 'national',
      filiere: 'FR_GENERAL',
      subject: { id: 'sub_math', name: 'Mathématiques' },
      class: { id: 'cls_6eA', name: '6e A' },
      chapitres: [
        { id: 'm1', titre: 'Entiers', ordre: 1, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Nombres', createdAt: now },
        { id: 'm2', titre: 'Fractions', ordre: 2, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 1, moduleTitre: 'Nombres', createdAt: now },
        { id: 'm3', titre: 'Angles', ordre: 3, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 2, moduleTitre: 'Géométrie', createdAt: now },
        { id: 'm4', titre: 'Triangles', ordre: 4, volumeHeuresPrevu: null, sequenceCibleFin: null, moduleOrdre: 2, moduleTitre: 'Géométrie', createdAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const programmeRepo = {
    findByFilters: async () => programmes,
    findByClassSubject: async () => programmes[0],
  } as unknown as ProgrammeRepository;

  const cahierRepo = {
    findByFilters: async (_schoolId: string, filters: { subjectId?: string }) =>
      filters.subjectId === 'sub_tm'
        ? [{ id: 'e1', chapitreId: 'c1', date: now }]
        : [],
  } as unknown as CahierDeTexteRepository;

  const classeRepo = {
    findBySchoolAndYear: async () => [{ id: 'cls_6eA', schoolId: 'sch_1', name: '6e A', level: '6e', filiere: 'FR_GENERAL' }],
    findById: async () => ({ id: 'cls_6eA', schoolId: 'sch_1', name: '6e A', level: '6e' }),
  } as unknown as ClasseRepository;

  const anneeRepo = {
    findCourante: async () => ({ id: 'ay_1' }),
    findById: async () => ({
      id: 'ay_1',
      startDate: new Date(Date.now() - 80 * 86400000),
      endDate: new Date(Date.now() + 20 * 86400000),
    }),
  } as unknown as AnneeAcademiqueRepository;

  const avancementRepo = {
    findModuleEtatsByProgrammes: async () => [
      { id: 'me_1', schoolId: 'sch_1', programmeId: 'prog_tm', moduleOrdre: 2, actif: false, modifieParId: 't1', modifieLe: now },
    ],
    findAvancementsByClassAndChapitres: async (_s: string, _c: string, ids: string[]) =>
      ids.includes('c2')
        ? [{ id: 'av_1', schoolId: 'sch_1', classId: 'cls_6eA', chapitreId: 'c2', academicYearId: 'ay_1', statut: 'FAIT', cocheParId: 't1', cocheLe: now }]
        : [],
  } as unknown as ChapitreAvancementRepository;

  const departmentRepo = {
    findBySchool: async () => [
      { id: 'dept_math', name: 'Mathématiques', color: '#000', headId: 'ap_math', head: { id: 'ap_math', firstName: 'Jean', lastName: 'AP' }, subjects: [{ id: 'sub_math', name: 'Mathématiques' }] },
      { id: 'dept_tm', name: 'Activités Pratiques', color: '#111', headId: 'ap_tm', head: { id: 'ap_tm', firstName: 'Paul', lastName: 'AP' }, subjects: [{ id: 'sub_tm', name: 'Travail Manuel' }] },
    ],
    findAssignmentsForSubjectIds: async () => [
      { teacherId: 'prof_math', subjectId: 'sub_math', classId: 'cls_6eA', teacher: { firstName: 'Alice', lastName: 'Prof' }, subject: { name: 'Mathématiques' }, class: { name: '6e A' } },
    ],
  } as unknown as DepartmentRepository;

  it('consolide par niveau/département, exclut les modules désactivés, scope l AP et sécurise l export CSV', async () => {
    const useCase = new GenererRapportAvancementProgrammesUseCase(
      programmeRepo,
      cahierRepo,
      classeRepo,
      anneeRepo,
      avancementRepo,
      departmentRepo,
    );

    // Vue Admin : voit les 2 départements
    const rapportAdmin = await useCase.execute({
      schoolId: 'sch_1',
      userId: 'admin_1',
      role: 'ADMIN',
      permissions: [],
    });

    expect(rapportAdmin.resumeGlobal.totalProgrammes).toBe(2);
    expect(rapportAdmin.resumeGlobal.totalModulesDesactives).toBe(1);
    // Travail Manuel : 2 leçons actives (Atelier 2 désactivé exclu), 2 faites (c1 cahier + c2 coche) → 100%
    const ligneTm = rapportAdmin.lignes.find((l) => l.programmeId === 'prog_tm')!;
    expect(ligneTm.leconsTotal).toBe(2);
    expect(ligneTm.leconsRealisees).toBe(2);
    expect(ligneTm.progressionPct).toBe(100);
    expect(ligneTm.modulesDesactivesCount).toBe(1);
    expect(ligneTm.statut).toBe('A_JOUR');

    // Mathématiques : 0/4 → 0% contre 80% attendu → CRITIQUE
    const ligneMath = rapportAdmin.lignes.find((l) => l.programmeId === 'prog_math')!;
    expect(ligneMath.statut).toBe('CRITIQUE');
    expect(rapportAdmin.parNiveau).toHaveLength(1);
    expect(rapportAdmin.parDepartement).toHaveLength(2);

    // Vue AP Mathématiques : strictement scopée au département Mathématiques
    const rapportAp = await useCase.execute({
      schoolId: 'sch_1',
      userId: 'ap_math',
      role: 'TEACHER',
      permissions: ['SUPERVISE_LESSON_PLANS'],
    });
    expect(rapportAp.lignes).toHaveLength(1);
    expect(rapportAp.lignes[0].programmeId).toBe('prog_math');

    // Export CSV : BOM UTF-8 + séparateur ';' + neutralisation formule '=' sur '=Travail Manuel 6e'
    const csv = formaterRapportAvancementCsv(rapportAdmin);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=Travail Manuel 6e");
  });

  it('RelancerRetardsProgrammesUseCase prévisualise sans envoi puis notifie enseignant affecté et AP', async () => {
    const envoyees: EnvoiNotificationOptions[] = [];
    const notifService = {
      envoyer: async (opts: EnvoiNotificationOptions) => {
        envoyees.push(opts);
      },
    } as unknown as NotificationService;

    const calculerProg = new CalculerProgressionProgrammeUseCase(
      programmeRepo,
      cahierRepo,
      classeRepo,
      anneeRepo,
      avancementRepo,
    );

    const relancer = new RelancerRetardsProgrammesUseCase(
      calculerProg,
      departmentRepo,
      notifService,
    );

    // Dry-run : 0 envoi, 2 destinataires pour Mathématiques (prof_math + ap_math), 0 pour Travail Manuel (100% grâce à l'exclusion du module 2)
    const prop = await relancer.proposer({ schoolId: 'sch_1' });
    expect(envoyees).toHaveLength(0);
    expect(prop.totalAlertes).toBe(1);
    expect(prop.totalDestinataires).toBe(2);
    expect(prop.destinataires.map((d) => d.userId).sort()).toEqual(['ap_math', 'prof_math']);

    // Apply : 2 notifications envoyées avec urgence HIGH (CRITIQUE)
    const applied = await relancer.appliquer({ schoolId: 'sch_1' });
    expect(applied.notificationsEnvoyees).toBe(2);
    expect(applied.echecsEnvoi).toBe(0);
    expect(envoyees).toHaveLength(2);
    expect(envoyees.every((n) => n.urgency === 'HIGH')).toBe(true);
  });
});
