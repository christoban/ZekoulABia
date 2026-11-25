import { describe, it, expect } from 'bun:test';
import { CalculerScoresSanteUseCase } from '@application/sante/CalculerScoresSanteUseCase';
import type { HealthJobsRepository } from '@domain/ports/repositories/HealthJobsRepository';
import type { SanteEleveRepository } from '@domain/ports/repositories/SanteEleveRepository';
import type { IAService, ResultatIndiceSante } from '@domain/ports/services/IAService';

class FakeHealthJobsRepository implements HealthJobsRepository {
  schools: { id: string }[] = [];
  schoolConfigs: Record<string, { aiAlertsEnabled: boolean; aiRiskThreshold: number; aiRiskThresholdCritical: number } | null> = {};
  academicYears: Record<string, { id: string } | null> = {};
  students: Record<string, { userId: string }[]> = {};

  async findActiveSchools() { return this.schools; }
  async getSchoolConfig(schoolId: string) { return this.schoolConfigs[schoolId] ?? null; }
  async findCurrentAcademicYear(schoolId: string) { return this.academicYears[schoolId] ?? null; }
  async findStudentIdsForSchool(schoolId: string) { return this.students[schoolId] ?? []; }
  async findStudentContext() { return { nomComplet: '', classId: null, className: null, professorPrincipalId: null }; }
  async createRecommendation() {}
  async countCriticalRecommendations() { return 0; }
  async findFicheOrientation() { return null; }
  async findStaffByPermission() { return []; }
  async findStudentsWithHealthScoreLte() { return []; }
  async findTeacherRecommendationsSince() { return []; }
  async findStudentProfilesForDigest() { return []; }
  async findSubjectsByIds() { return []; }
}

class FakeSanteEleveRepository implements SanteEleveRepository {
  scores: { studentId: string; score: number }[] = [];
  async getDonneesSante(_studentId: string, _schoolId: string, _academicYearId: string) {
    return { studentId: 's1', moyenneGenerale: 12, joursPresent: 80, joursTotaux: 100, moyennesPrecedentes: [10, 11, 12], nombreSanctions: 0, nombrePeriodes: 3, fraisRegles: 50000, fraisTotaux: 50000 };
  }
  async sauvegarderScore(studentId: string, score: number) { this.scores.push({ studentId, score }); }
}

class FakeIAService implements IAService {
  async calculerIndiceSante(): Promise<ResultatIndiceSante> { return { score: 75, niveau: 'STABLE', recommandations: [] }; }
  async genererCommentaireBulletin() { return ''; }
  async genererEmploiDuTemps() { return {}; }
  async genererConseilPersonnalise() { return ''; }
}

describe('CalculerScoresSanteUseCase', () => {
  it('aucune école active → computed true, events vide', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [];
    const uc = new CalculerScoresSanteUseCase(hj, new FakeSanteEleveRepository(), new FakeIAService());
    const result = await uc.execute();
    expect(result.computed).toBe(true);
    expect(result.events).toHaveLength(0);
  });

  it('école sans année académique → ignorée', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [{ id: 's1' }];
    hj.schoolConfigs['s1'] = { aiAlertsEnabled: true, aiRiskThreshold: 50, aiRiskThresholdCritical: 30 };
    hj.academicYears['s1'] = null;
    hj.students['s1'] = [{ userId: 'u1' }];
    const uc = new CalculerScoresSanteUseCase(hj, new FakeSanteEleveRepository(), new FakeIAService());
    const result = await uc.execute();
    expect(result.events).toHaveLength(0);
  });

  it('score critique → événement ai/alert.critical', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [{ id: 's1' }];
    hj.schoolConfigs['s1'] = { aiAlertsEnabled: true, aiRiskThreshold: 50, aiRiskThresholdCritical: 30 };
    hj.academicYears['s1'] = { id: 'ay1' };
    hj.students['s1'] = [{ userId: 'u1' }];
    const santeRepo = new FakeSanteEleveRepository();
    santeRepo.getDonneesSante = async () => ({
      studentId: 'u1', moyenneGenerale: 5, joursPresent: 20, joursTotaux: 100,
      moyennesPrecedentes: [6, 5, 4], nombreSanctions: 5, nombrePeriodes: 3,
      fraisRegles: 0, fraisTotaux: 50000,
    });
    const ia = new FakeIAService();
    ia.calculerIndiceSante = async () => ({ score: 20, niveau: 'CRITIQUE', recommandations: [] });
    const uc = new CalculerScoresSanteUseCase(hj, santeRepo, ia);
    const result = await uc.execute();
    const crit = result.events.filter(e => e.name === 'ai/alert.critical');
    expect(crit.length).toBeGreaterThanOrEqual(1);
    expect(crit[0].data.studentId).toBe('u1');
  });

  it('score warning (entre critical et warning threshold) → événement ai/alert.warning', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [{ id: 's1' }];
    hj.schoolConfigs['s1'] = { aiAlertsEnabled: true, aiRiskThreshold: 50, aiRiskThresholdCritical: 30 };
    hj.academicYears['s1'] = { id: 'ay1' };
    hj.students['s1'] = [{ userId: 'u1' }];
    const santeRepo = new FakeSanteEleveRepository();
    santeRepo.getDonneesSante = async () => ({
      studentId: 'u1', moyenneGenerale: 9, joursPresent: 60, joursTotaux: 100,
      moyennesPrecedentes: [10, 9, 8], nombreSanctions: 2, nombrePeriodes: 3,
      fraisRegles: 25000, fraisTotaux: 50000,
    });
    const ia = new FakeIAService();
    ia.calculerIndiceSante = async () => ({ score: 40, niveau: 'ELEVE', recommandations: [] });
    const uc = new CalculerScoresSanteUseCase(hj, santeRepo, ia);
    const result = await uc.execute();
    const warn = result.events.filter(e => e.name === 'ai/alert.warning');
    expect(warn.length).toBeGreaterThanOrEqual(1);
  });

  it('tendance positive → événement ai/alert.positive', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [{ id: 's1' }];
    hj.schoolConfigs['s1'] = { aiAlertsEnabled: true, aiRiskThreshold: 50, aiRiskThresholdCritical: 30 };
    hj.academicYears['s1'] = { id: 'ay1' };
    hj.students['s1'] = [{ userId: 'u1' }];
    const santeRepo = new FakeSanteEleveRepository();
    santeRepo.getDonneesSante = async () => ({
      studentId: 'u1', moyenneGenerale: 15, joursPresent: 90, joursTotaux: 100,
      moyennesPrecedentes: [10, 14, 16], nombreSanctions: 0, nombrePeriodes: 3,
      fraisRegles: 50000, fraisTotaux: 50000,
    });
    const ia = new FakeIAService();
    ia.calculerIndiceSante = async () => ({ score: 85, niveau: 'PROGRESSION', recommandations: [] });
    const uc = new CalculerScoresSanteUseCase(hj, santeRepo, ia);
    const result = await uc.execute();
    const pos = result.events.filter(e => e.name === 'ai/alert.positive');
    expect(pos.length).toBeGreaterThanOrEqual(1);
  });

  it('alerts désactivées → aucun événement d\'alerte même si score critique', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [{ id: 's1' }];
    hj.schoolConfigs['s1'] = { aiAlertsEnabled: false, aiRiskThreshold: 50, aiRiskThresholdCritical: 30 };
    hj.academicYears['s1'] = { id: 'ay1' };
    hj.students['s1'] = [{ userId: 'u1' }];
    const santeRepo = new FakeSanteEleveRepository();
    santeRepo.getDonneesSante = async () => ({
      studentId: 'u1', moyenneGenerale: 3, joursPresent: 10, joursTotaux: 100,
      moyennesPrecedentes: [4, 3, 2], nombreSanctions: 8, nombrePeriodes: 3,
      fraisRegles: 0, fraisTotaux: 50000,
    });
    const ia = new FakeIAService();
    ia.calculerIndiceSante = async () => ({ score: 15, niveau: 'CRITIQUE', recommandations: [] });
    const uc = new CalculerScoresSanteUseCase(hj, santeRepo, ia);
    const result = await uc.execute();
    expect(result.events).toHaveLength(0);
  });

  it('erreur sur un élève → continue avec les autres', async () => {
    const hj = new FakeHealthJobsRepository();
    hj.schools = [{ id: 's1' }];
    hj.schoolConfigs['s1'] = { aiAlertsEnabled: true, aiRiskThreshold: 50, aiRiskThresholdCritical: 30 };
    hj.academicYears['s1'] = { id: 'ay1' };
    hj.students['s1'] = [{ userId: 'u-error' }, { userId: 'u-ok' }];
    const santeRepo = new FakeSanteEleveRepository();
    let callCount = 0;
    santeRepo.getDonneesSante = async (sid) => {
      callCount++;
      if (sid === 'u-error') throw new Error('DB error');
      return { studentId: 'u-ok', moyenneGenerale: 15, joursPresent: 90, joursTotaux: 100, moyennesPrecedentes: [12, 14, 15], nombreSanctions: 0, nombrePeriodes: 3, fraisRegles: 50000, fraisTotaux: 50000 };
    };
    const ia = new FakeIAService();
    ia.calculerIndiceSante = async () => ({ score: 80, niveau: 'STABLE', recommandations: [] });
    const uc = new CalculerScoresSanteUseCase(hj, santeRepo, ia);
    const result = await uc.execute();
    expect(result.computed).toBe(true);
  });
});
