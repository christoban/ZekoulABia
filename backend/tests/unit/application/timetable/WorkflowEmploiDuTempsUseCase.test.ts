import { describe, expect, it } from 'bun:test';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import { SoumettreEmploiDuTempsUseCase } from '../../../../src/application/timetable/SoumettreEmploiDuTempsUseCase.ts';
import { PublierTousEmploisDuTempsUseCase } from '../../../../src/application/timetable/PublierTousEmploisDuTempsUseCase.ts';
import { RouvrirEmploiDuTempsUseCase } from '../../../../src/application/timetable/RouvrirEmploiDuTempsUseCase.ts';
import { ModifierCreneauUseCase } from '../../../../src/application/timetable/ModifierCreneauUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';

const activityLog = { log: async () => {} };
const creerEdt = (id: string, status: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' = 'DRAFT', classId = id) =>
  EmploiDuTemps.reconstituer({
    id,
    classId,
    schoolId: 'school-1',
    academicYearId: 'annee-1',
    status,
    generatedByAI: false,
    createdAt: new Date(),
  });

describe('Workflow EDT', () => {
  it('laisse STAFF soumettre mais pas publier', async () => {
    const repo = new InMemoryTimetableRepository();
    repo.ajouterEDT(creerEdt('edt-1'));
    repo.ajouterCreneau(CreneauHoraire.create({ timetableId: 'edt-1', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }));
    const soumettre = new SoumettreEmploiDuTempsUseCase(repo, activityLog);

    await soumettre.execute({
      timetableId: 'edt-1', schoolId: 'school-1', demandeurId: 'censeur-1',
      demandeurRole: 'STAFF', demandeurPermissions: ['MANAGE_TIMETABLE'],
    });
    expect((await repo.findById('edt-1'))?.status).toBe('SUBMITTED');
    await expect(soumettre.execute({
      timetableId: 'edt-1', schoolId: 'school-1', demandeurId: 'censeur-1',
      demandeurRole: 'STAFF', demandeurPermissions: ['MANAGE_TIMETABLE'],
    })).rejects.toThrow('déjà soumis');
    expect((await repo.findById('edt-1'))?.status).toBe('SUBMITTED');
  });

  it('refuse la soumission STAFF sans permission EDT', async () => {
    const repo = new InMemoryTimetableRepository();
    repo.ajouterEDT(creerEdt('edt-1'));
    const soumettre = new SoumettreEmploiDuTempsUseCase(repo, activityLog);
    await expect(soumettre.execute({
      timetableId: 'edt-1', schoolId: 'school-1', demandeurId: 'staff-1',
      demandeurRole: 'STAFF', demandeurPermissions: [],
    })).rejects.toThrow('MANAGE_TIMETABLE');
  });

  it('ADMIN rouvre seulement un PUBLISHED vers DRAFT', async () => {
    const repo = new InMemoryTimetableRepository();
    repo.ajouterEDT(creerEdt('edt-1', 'PUBLISHED'));
    const rouvrir = new RouvrirEmploiDuTempsUseCase(repo, activityLog);
    await rouvrir.execute({ timetableId: 'edt-1', schoolId: 'school-1', demandeurId: 'admin-1', demandeurRole: 'ADMIN' });
    expect((await repo.findById('edt-1'))?.status).toBe('DRAFT');
  });

  it('rend un EDT PUBLISHED immuable pour la modification des créneaux', async () => {
    const repo = new InMemoryTimetableRepository();
    repo.ajouterEDT(creerEdt('edt-1', 'PUBLISHED'));
    const slot = CreneauHoraire.create({ timetableId: 'edt-1', subjectId: 'maths', dayOfWeek: 0, startTime: '08:00', endTime: '09:00' });
    repo.ajouterCreneau(slot);
    const modifier = new ModifierCreneauUseCase(repo);
    await expect(modifier.execute({
      creneauId: slot.id, timetableId: 'edt-1', schoolId: 'school-1', startTime: '09:30', endTime: '10:30',
    })).rejects.toThrow('EDT publié');
  });

  it('publie tous les EDT soumis du tenant et refuse un lot vide', async () => {
    const repo = new InMemoryTimetableRepository();
    repo.ajouterEDT(creerEdt('edt-1', 'SUBMITTED'));
    repo.ajouterEDT(creerEdt('edt-2', 'SUBMITTED'));
    const publierTous = new PublierTousEmploisDuTempsUseCase(repo, activityLog);
    const resultat = await publierTous.execute({ schoolId: 'school-1', demandeurId: 'admin-1', demandeurRole: 'ADMIN' });
    expect(resultat.publies).toBe(2);
    expect((await repo.findById('edt-1'))?.status).toBe('PUBLISHED');
    await expect(publierTous.execute({ schoolId: 'school-1', demandeurId: 'admin-1', demandeurRole: 'ADMIN' })).rejects.toThrow('Aucun EDT');
  });
});
