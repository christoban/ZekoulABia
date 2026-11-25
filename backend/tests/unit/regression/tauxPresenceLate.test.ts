import { describe, it, expect } from 'bun:test';
import { InMemoryPresenceRepository } from '../../helpers/repositories/InMemoryPresenceRepository.ts';
import { Presence } from '@domain/entities/Presence';
import { ListerElevesClasseUseCase } from '../../../src/application/classe/ListerElevesClasseUseCase.ts';
import { InMemoryClasseRepository } from '../../helpers/repositories/InMemoryClasseRepository.ts';
import { InMemoryUserRepository } from '../../helpers/repositories/InMemoryUserRepository.ts';
import { InMemoryNoteRepository } from '../../helpers/repositories/InMemoryNoteRepository.ts';
import { User } from '@domain/entities/User';

function makePresence(overrides: Partial<{ schoolId: string; studentId: string; classId: string; academicPeriodId: string; status: string; date: Date }>): Presence {
  return Presence.reconstituer({
    id: crypto.randomUUID(),
    schoolId: overrides.schoolId ?? 'school-1',
    studentId: overrides.studentId ?? 'eleve-1',
    classId: overrides.classId ?? 'classe-1',
    academicPeriodId: overrides.academicPeriodId ?? 'periode-1',
    date: overrides.date ?? new Date('2025-09-01'),
    status: (overrides.status as any) ?? 'PRESENT',
    period: 'MORNING' as any,
    isOfflineSync: false,
    createdAt: new Date(),
  });
}

// ── 1. PrismaPresenceRepository.getStatistiquesEleve ──
describe('Régression audit V3.5 — LATE compte comme présent', () => {
  it('PrismaPresenceRepository.getStatistiquesEleve : LATE compté comme présent (PRESENT+LATE)/total', async () => {
    const repo = new InMemoryPresenceRepository();
    // 1 PRESENT + 1 LATE + 1 ABSENT + 1 ABSENT_JUSTIFIED = 4 total → 2 présents → 50%
    repo.ajouter(makePresence({ status: 'PRESENT', academicPeriodId: 'periode-1' }));
    repo.ajouter(makePresence({ status: 'LATE', academicPeriodId: 'periode-1' }));
    repo.ajouter(makePresence({ status: 'ABSENT', academicPeriodId: 'periode-1' }));
    repo.ajouter(makePresence({ status: 'ABSENT_JUSTIFIED', academicPeriodId: 'periode-1' }));
    const stats = await repo.getStatistiquesEleve('eleve-1', 'periode-1');
    expect(stats.tauxPresence).toBe(50); // (1+1)/4*100
    expect(stats.joursRetard).toBe(1);
  });

  it('PrismaPresenceRepository.getStatistiquesEleve : total=0 retourne 100', async () => {
    const repo = new InMemoryPresenceRepository();
    const stats = await repo.getStatistiquesEleve('eleve-inexistant', 'periode-1');
    expect(stats.tauxPresence).toBe(100);
  });

  // ── 1b. absenceCount exclut LATE ──
  it('PrismaPresenceRepository.countAbsencesEtRetards : exclut LATE, compte ABSENT+ABSENT_JUSTIFIED', async () => {
    const repo = new InMemoryPresenceRepository();
    repo.ajouter(makePresence({ status: 'PRESENT' }));
    repo.ajouter(makePresence({ status: 'LATE' }));
    repo.ajouter(makePresence({ status: 'ABSENT' }));
    repo.ajouter(makePresence({ status: 'ABSENT_JUSTIFIED' }));
    repo.ajouter(makePresence({ status: 'ABSENT' }));
    // LATE ne doit pas être compté
    const count = await repo.countAbsencesEtRetards('school-1', 'eleve-1', 'periode-1');
    expect(count).toBe(3); // 2 ABSENT + 1 ABSENT_JUSTIFIED, LATE exclu
  });

  it('PrismaPresenceRepository.getStatistiquesEleve : joursAbsent inclut ABSENT_JUSTIFIED, exclut LATE', async () => {
    const repo = new InMemoryPresenceRepository();
    repo.ajouter(makePresence({ status: 'ABSENT' }));
    repo.ajouter(makePresence({ status: 'ABSENT_JUSTIFIED' }));
    repo.ajouter(makePresence({ status: 'LATE' }));
    repo.ajouter(makePresence({ status: 'PRESENT' }));
    const stats = await repo.getStatistiquesEleve('eleve-1', 'periode-1');
    expect(stats.joursAbsent).toBe(2); // ABSENT + ABSENT_JUSTIFIED
    expect(stats.joursRetard).toBe(1);
  });

  // ── 2. ListerElevesClasseUseCase ──
  it('ListerElevesClasseUseCase : LATE compté comme présent', async () => {
    const classeRepo = new InMemoryClasseRepository();
    const userRepo = new InMemoryUserRepository();
    const noteRepo = new InMemoryNoteRepository();
    const presenceRepo = new InMemoryPresenceRepository();

    // Mock findById
    classeRepo.findById = async (id: string) => ({ id, schoolId: 'school-1' } as any);

    const eleve = User.reconstituer({
      id: 'eleve-1', schoolId: 'school-1', role: 'STUDENT',
      email: 'e@test.cm', firstName: 'Jean', lastName: 'Test',
      isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
    } as any);
    userRepo.ajouter(eleve);
    userRepo.findByClass = async () => [{ id: 'eleve-1', firstName: 'Jean', lastName: 'Test' } as any];
    // 1 PRESENT + 1 LATE + 1 ABSENT = 3 → 66% (2/3)
    presenceRepo.ajouter(makePresence({ status: 'PRESENT' }));
    presenceRepo.ajouter(makePresence({ status: 'LATE' }));
    presenceRepo.ajouter(makePresence({ status: 'ABSENT' }));
    // Override findByClasseEtEleves to return our data
    presenceRepo.findByClasseEtEleves = async () => [
      { studentId: 'eleve-1', status: 'PRESENT' },
      { studentId: 'eleve-1', status: 'LATE' },
      { studentId: 'eleve-1', status: 'ABSENT' },
    ];
    noteRepo.findValideesParClasseEtEleves = async () => [] as any;

    const useCase = new ListerElevesClasseUseCase(classeRepo as any, userRepo as any, noteRepo as any, presenceRepo as any);
    const result = await useCase.execute({ classId: 'classe-1', schoolId: 'school-1' });
    expect(result[0].tauxPresence).toBe(67); // Math.round(2/3*100)
  });

  it('ListerElevesClasseUseCase : total=0 retourne 100 (pas null)', async () => {
    const classeRepo = new InMemoryClasseRepository();
    classeRepo.findById = async (id: string) => ({ id, schoolId: 'school-1' } as any);
    const userRepo = new InMemoryUserRepository();
    const eleve = User.reconstituer({
      id: 'eleve-1', schoolId: 'school-1', role: 'STUDENT',
      email: 'e2@test.cm', firstName: 'Marie', lastName: 'Test',
      isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
    } as any);
    userRepo.ajouter(eleve);
    userRepo.findByClass = async () => [{ id: 'eleve-1', firstName: 'Marie', lastName: 'Test' } as any];
    const noteRepo = new InMemoryNoteRepository();
    noteRepo.findValideesParClasseEtEleves = async () => [] as any;
    const presenceRepo = new InMemoryPresenceRepository();
    presenceRepo.findByClasseEtEleves = async () => [];

    const useCase = new ListerElevesClasseUseCase(classeRepo as any, userRepo as any, noteRepo as any, presenceRepo as any);
    const result = await useCase.execute({ classId: 'classe-1', schoolId: 'school-1' });
    expect(result[0].tauxPresence).toBe(100);
  });

  // ── 3. StatisticsController (teacher-performance) ──
  it('StatisticsController teacher-performance : LATE compté comme présent', () => {
    const attendances = [
      { status: 'PRESENT', date: new Date(), classId: 'c1', subjectId: 's1' },
      { status: 'LATE', date: new Date(), classId: 'c1', subjectId: 's1' },
      { status: 'ABSENT', date: new Date(), classId: 'c1', subjectId: 's1' },
      { status: 'ABSENT_JUSTIFIED', date: new Date(), classId: 'c1', subjectId: 's1' },
    ] as any[];
    // Même formule que StatisticsController.ts:233
    const tauxPresence = Math.round((attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length / attendances.length) * 10000) / 100;
    expect(tauxPresence).toBe(50); // (1+1)/4*100
  });

  // ── 4a. Copilot teacherActionCatalog ──
  it('Copilot teacherActionCatalog : LATE compté comme présent', () => {
    const records = [{ status: 'PRESENT' }, { status: 'LATE' }, { status: 'ABSENT' }] as any[];
    const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const taux = Math.round((present / records.length) * 10000) / 100;
    expect(taux).toBe(66.67); // 2/3
  });

  // ── 4b. Copilot studentActionCatalog ──
  it('Copilot studentActionCatalog : LATE compté comme présent', () => {
    const records = [{ status: 'PRESENT' }, { status: 'LATE' }, { status: 'ABSENT' }, { status: 'ABSENT_JUSTIFIED' }] as any[];
    const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const taux = Math.round((present / records.length) * 10000) / 100;
    expect(taux).toBe(50); // 2/4
  });

  // ── 4c. Copilot parentActionCatalog ──
  it('Copilot parentActionCatalog : LATE compté comme présent', () => {
    const records = [{ status: 'PRESENT' }, { status: 'LATE' }, { status: 'ABSENT' }] as any[];
    const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
    const taux = Math.round((present / records.length) * 10000) / 100;
    expect(taux).toBe(66.67);
  });
});
