import { describe, it, expect } from 'bun:test';
import { ListerElevesClasseUseCase } from '../../../src/application/classe/ListerElevesClasseUseCase';
import { InMemoryClasseRepository } from '../../helpers/repositories/InMemoryClasseRepository';
import { InMemoryUserRepository } from '../../helpers/repositories/InMemoryUserRepository';
import { InMemoryNoteRepository } from '../../helpers/repositories/InMemoryNoteRepository';
import { InMemoryPresenceRepository } from '../../helpers/repositories/InMemoryPresenceRepository';
import { User } from '@domain/entities/User';
import { Presence } from '@domain/entities/Presence';
import { Note } from '@domain/entities/Note';
import { MetricCache } from '../../../src/infrastructure/cache/MetricCache';
import { MetricRegistry } from '../../../src/domain/reporting/MetricRegistryImpl';
import { GetMetricUseCase } from '../../../src/application/reporting/GetMetricUseCase';
import { EnregistrerPresenceUseCase } from '../../../src/application/attendance/EnregistrerPresenceUseCase';

function makeUser(id: string, schoolId = 'school-1') {
  return User.reconstituer({
    id, schoolId, role: 'STUDENT', email: `${id}@test.cm`, firstName: 'Prenom', lastName: id,
    isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
  } as any);
}

function makePresence(studentId: string, status: string, classId = 'classe-1') {
  return Presence.reconstituer({
    id: crypto.randomUUID(), schoolId: 'school-1', studentId, classId,
    academicPeriodId: 'periode-1', date: new Date('2025-09-01'), status: status as any, period: 'MORNING' as any,
    isOfflineSync: false, createdAt: new Date(),
  });
}

describe('Régression pilote MetricDefinition — ListerElevesClasse', () => {
  it('retourne mêmes valeurs avec et sans moteur (comparaison pré-moteur)', async () => {
    const classeRepo1 = new InMemoryClasseRepository();
    const classeRepo2 = new InMemoryClasseRepository();
    // @ts-ignore
    const fakeClasse = { id: 'classe-1', schoolId: 'school-1' };
    classeRepo1.findById = async () => fakeClasse as any;
    classeRepo2.findById = async () => fakeClasse as any;

    const userRepo1 = new InMemoryUserRepository();
    const userRepo2 = new InMemoryUserRepository();
    const e1 = makeUser('eleve-1');
    const e2 = makeUser('eleve-2');
    userRepo1.ajouter(e1); userRepo1.ajouter(e2);
    userRepo2.ajouter(e1); userRepo2.ajouter(e2);
    userRepo1.findByClass = async () => [{ id: 'eleve-1', firstName: 'Prenom', lastName: 'eleve-1' } as any, { id: 'eleve-2', firstName: 'Prenom', lastName: 'eleve-2' } as any];
    userRepo2.findByClass = async () => [{ id: 'eleve-1', firstName: 'Prenom', lastName: 'eleve-1' } as any, { id: 'eleve-2', firstName: 'Prenom', lastName: 'eleve-2' } as any];

    const noteRepo1 = new InMemoryNoteRepository();
    const noteRepo2 = new InMemoryNoteRepository();
    // On ajoute des notes directement via prisma fake pour GetMetric — mais pour le fallback on passe par InMemoryNoteRepository
    // Pour le test pré-moteur, on utilise InMemoryNoteRepository.findValideesParClasseEtEleves
    // On va mocker GetMetric pour qu'il lise les mêmes données que le fallback, en utilisant un fake prisma qui retourne les mêmes grades
    // Simplification : on teste que sans GetMetric, le fallback donne les valeurs attendues, et avec GetMetric mocké, on obtient les mêmes.

    // Présences : e1 = PRESENT+LATE (100%), e2 = ABSENT (0%)
    const presenceRepo1 = new InMemoryPresenceRepository();
    presenceRepo1.ajouter(makePresence('eleve-1', 'PRESENT'));
    presenceRepo1.ajouter(makePresence('eleve-1', 'LATE'));
    presenceRepo1.ajouter(makePresence('eleve-2', 'ABSENT'));
    // Pour le pilote, GetMetric interroge prisma, pas InMemory — on va mocker GetMetric directement
    const presenceRepo2 = presenceRepo1;

    // Sans moteur
    const useCaseSans = new ListerElevesClasseUseCase(classeRepo1 as any, userRepo1 as any, noteRepo1 as any, presenceRepo1 as any);
    // Mock grades : e1 a 14, e2 a 10
    noteRepo1.findValideesParClasseEtEleves = async () => [
      { studentId: 'eleve-1', sequenceAverage: 14, coefficient: 1, isAbsentGrade: false } as any,
      { studentId: 'eleve-2', sequenceAverage: 10, coefficient: 1, isAbsentGrade: false } as any,
    ];
    noteRepo2.findValideesParClasseEtEleves = noteRepo1.findValideesParClasseEtEleves;

    const resSans = await useCaseSans.execute({ schoolId: 'school-1', classId: 'classe-1' });
    // e1 moyenne 14 rang 1, e2 moyenne 10 rang2
    expect(resSans[0].id).toBe('eleve-1');
    expect(resSans[0].moyenne).toBe(14);
    expect(resSans[0].tauxPresence).toBe(100);
    expect(resSans[1].moyenne).toBe(10);
    expect(resSans[1].tauxPresence).toBe(0);

    // Avec moteur — on mock GetMetric pour retourner les mêmes valeurs sans toucher à prisma
    const fakeGetMetric = {
      execute: async ({ key, dimensions }: any) => {
        if (key === 'taux_presence') {
          if (dimensions.studentId === 'eleve-1') return { value: 100, fromCache: false, computedAt: new Date() };
          return { value: 0, fromCache: false, computedAt: new Date() };
        }
        if (key === 'moyenne_generale') {
          if (dimensions.studentId === 'eleve-1') return { value: 14, fromCache: false, computedAt: new Date() };
          return { value: 10, fromCache: false, computedAt: new Date() };
        }
        return { value: 0, fromCache: false, computedAt: new Date() };
      },
    } as any;

    const useCaseAvec = new ListerElevesClasseUseCase(classeRepo2 as any, userRepo2 as any, noteRepo2 as any, presenceRepo2 as any, fakeGetMetric);
    const resAvec = await useCaseAvec.execute({ schoolId: 'school-1', classId: 'classe-1' });
    expect(resAvec).toEqual(resSans);
  });

  it('invalidation événementielle : après EnregistrerPresence, Lister via cache reflète le changement', async () => {
    const cache = new MetricCache();
    // Pré-remplir le cache avec une ancienne valeur
    await cache.set('taux_presence', { schoolId: 'school-1', classId: 'classe-1', studentId: 'eleve-1' }, 0);
    expect((await cache.get('taux_presence', { schoolId: 'school-1', classId: 'classe-1', studentId: 'eleve-1' }))?.value).toBe(0);

    // Simuler EnregistrerPresenceUseCase qui invalide
    const presenceRepo = new InMemoryPresenceRepository();
    const userRepo = new InMemoryUserRepository();
    const teacher = User.reconstituer({
      id: 'teacher-1', schoolId: 'school-1', role: 'TEACHER', email: 't@test.cm', firstName: 'T', lastName: 'T',
      isActive: true, refreshTokenVersion: 0, createdAt: new Date(), updatedAt: new Date(),
    } as any);
    userRepo.ajouter(teacher);
    // Mock rattachement
    const rattachementRepo = { estRattacheALaClasse: async () => true } as any;
    const notif = { envoyer: async () => {} } as any;

    const enregistrer = new EnregistrerPresenceUseCase(presenceRepo as any, userRepo as any, notif, rattachementRepo, cache);
    await enregistrer.execute({
      schoolId: 'school-1', classId: 'classe-1', academicPeriodId: 'periode-1',
      teacherId: 'teacher-1', recordedById: 'teacher-1', date: new Date('2025-09-02'), period: 'MORNING' as any,
      presences: [{ studentId: 'eleve-1', statut: 'PRESENT' as any }],
    });

    // Après invalidation par classId, le cache pour cet élève doit être miss
    expect(await cache.get('taux_presence', { schoolId: 'school-1', classId: 'classe-1', studentId: 'eleve-1' })).toBeNull();
  });
});
