import { describe, it, expect, beforeEach } from 'bun:test';
import { PublierEmploiDuTempsUseCase } from '../../../../src/application/timetable/PublierEmploiDuTempsUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';

const activityLog = { log: async () => {} };

describe('PublierEmploiDuTempsUseCase', () => {
  let repo: InMemoryTimetableRepository;
  let useCase: PublierEmploiDuTempsUseCase;

  const creerEdt = (status: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' = 'SUBMITTED', id = 'edt-1') =>
    EmploiDuTemps.reconstituer({
      id,
      schoolId: 'school-1',
      classId: 'classe-1',
      academicYearId: 'annee-1',
      status,
      generatedByAI: false,
      createdAt: new Date(),
    });

  beforeEach(() => {
    repo = new InMemoryTimetableRepository();
    useCase = new PublierEmploiDuTempsUseCase(repo, activityLog);
    repo.ajouterEDT(creerEdt());
  });

  it('publie un EDT soumis', async () => {
    repo.ajouterCreneau(CreneauHoraire.create({ timetableId: 'edt-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }));
    await useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1', demandeurId: 'admin-1', demandeurRole: 'ADMIN' });
    expect((await repo.findById('edt-1'))?.status).toBe('PUBLISHED');
  });

  it('refuse un rôle STAFF même avec MANAGE_TIMETABLE', async () => {
    await expect(useCase.execute({ timetableId: 'edt-1', schoolId: 'school-1', demandeurId: 'staff-1', demandeurRole: 'STAFF' })).rejects.toThrow('seul ADMIN');
  });

  it('refuse la publication directe d’un DRAFT', async () => {
    const draft = creerEdt('DRAFT', 'edt-draft');
    repo.ajouterEDT(draft);
    await expect(useCase.execute({ timetableId: 'edt-draft', schoolId: 'school-1', demandeurId: 'admin-1', demandeurRole: 'ADMIN' })).rejects.toThrow('doit être soumis');
  });

  it('rejette une publication répétée', async () => {
    repo.ajouterEDT(creerEdt('PUBLISHED', 'edt-publie'));
    await expect(useCase.execute({ timetableId: 'edt-publie', schoolId: 'school-1', demandeurId: 'admin-1', demandeurRole: 'ADMIN' })).rejects.toThrow('déjà publié');
  });

  it('rejette un EDT hors tenant', async () => {
    await expect(useCase.execute({ timetableId: 'edt-1', schoolId: 'school-2', demandeurId: 'admin-1', demandeurRole: 'ADMIN' })).rejects.toThrow('Accès refusé');
  });
});
