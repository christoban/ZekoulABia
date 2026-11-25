import { describe, it, expect } from 'bun:test';
import { CalculerMoyenneUseCase } from '../../../src/application/grade/CalculerMoyenneUseCase';
import { InMemoryNoteRepository } from '../../helpers/repositories/InMemoryNoteRepository';
import { InMemoryMatiereRepository } from '../../helpers/repositories/InMemoryMatiereRepository';
import { InMemoryPresenceRepository } from '../../helpers/repositories/InMemoryPresenceRepository';
import { InMemorySchoolRepository } from '../../helpers/repositories/InMemorySchoolRepository';
import { InMemoryClasseRepository } from '../../helpers/repositories/InMemoryClasseRepository';
import { MetricCache } from '../../../src/infrastructure/cache/MetricCache';
import { MetricRegistry } from '../../../src/domain/reporting/MetricRegistryImpl';
import { GetMetricUseCase } from '../../../src/application/reporting/GetMetricUseCase';
import { Note } from '@domain/entities/Note';

function makeNote(studentId: string, classId: string, sequenceId: string, seqAvg: number | null, coeff = 1, isAbsent = false) {
  return Note.reconstituer({
    id: crypto.randomUUID(),
    schoolId: 'school-1',
    studentId,
    subjectId: `subj-${seqAvg}`,
    classId,
    academicYearId: 'annee-1',
    sequenceId,
    sequenceAverage: seqAvg,
    coefficient: coeff,
    isAbsentGrade: isAbsent,
    validationStatus: 'LOCKED' as any,
    maxValue: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
}

describe('M2 — CalculerMoyenneUseCase migré vers moyenne_generale', () => {
  it('même moyenne et même rang qu\'avant migration (total>0)', async () => {
    const noteRepo = new InMemoryNoteRepository();
    const matiereRepo = new InMemoryMatiereRepository();
    const presenceRepo = new InMemoryPresenceRepository();
    const statsRepo = { findTeachingAssignmentsForTeacher: async () => [], findAttendanceForTeacher: async () => [] } as any;

    // Matières — mockées via findById
    (matiereRepo as any).findById = async (id: string) => {
      if (id === 'subj-14') return { id: 'subj-14', coefficient: 2 } as any;
      if (id === 'subj-12') return { id: 'subj-12', coefficient: 1 } as any;
      if (id.startsWith('subj-')) return { id, coefficient: 1 } as any;
      return null;
    };

    // Classe 6e A, séquence 1
    const classId = 'classe-1';
    const seqId = 'seq-1';
    // Élève 1: 14 (coeff 2) et 12 (coeff 1) => (28+12)/3=13.33
    // Élève 2: 10 (coeff 2) et 10 (coeff1) => (20+10)/3=10
    // Élève 3: pas de notes => 0

    noteRepo.ajouter(makeNote('eleve-1', classId, seqId, 14, 2));
    noteRepo.ajouter(makeNote('eleve-1', classId, seqId, 12, 1));
    noteRepo.ajouter(makeNote('eleve-2', classId, seqId, 10, 2));
    noteRepo.ajouter(makeNote('eleve-2', classId, seqId, 10, 1));

    // findClassmatesAverages est mocké pour contrôler le rang
    noteRepo.findClassmatesAverages = async () => [
      { studentId: 'eleve-1', average: 13.33 },
      { studentId: 'eleve-2', average: 10 },
    ];

    // Sans moteur (fallback)
    const useCaseSans = new CalculerMoyenneUseCase(noteRepo, matiereRepo);
    const resSans1 = await useCaseSans.execute({ schoolId: 'school-1', studentId: 'eleve-1', classId, sequenceId: seqId });
    const resSans2 = await useCaseSans.execute({ schoolId: 'school-1', studentId: 'eleve-2', classId, sequenceId: seqId });

    // Avec moteur
    const cache = new MetricCache();
    const registry = new MetricRegistry();
    const schoolRepo = new InMemorySchoolRepository();
    const classeRepo = new InMemoryClasseRepository();
    const getMetric = new GetMetricUseCase(cache, registry, presenceRepo, noteRepo as any, statsRepo, schoolRepo, classeRepo);
    const useCaseAvec = new CalculerMoyenneUseCase(noteRepo, matiereRepo, getMetric);
    const resAvec1 = await useCaseAvec.execute({ schoolId: 'school-1', studentId: 'eleve-1', classId, sequenceId: seqId });
    const resAvec2 = await useCaseAvec.execute({ schoolId: 'school-1', studentId: 'eleve-2', classId, sequenceId: seqId });

    expect(resAvec1.average).toBe(resSans1.average);
    expect(resAvec2.average).toBe(resSans2.average);
    expect(resAvec1.rank).toBe(resSans1.rank);
    expect(resAvec2.rank).toBe(resSans2.rank);
  });

  it('pilote/T4/T7-T9 toujours identiques après migration M2', async () => {
    // Vérifie que le pilote n'est pas cassé par l'ajout de MatiereRepository au contexte
    const noteRepo = new InMemoryNoteRepository();
    const matiereRepo = new InMemoryMatiereRepository();
    const presenceRepo = new InMemoryPresenceRepository();
    const statsRepo = { findTeachingAssignmentsForTeacher: async () => [], findAttendanceForTeacher: async () => [] } as any;
    const schoolRepo = new InMemorySchoolRepository();
    const classeRepo = new InMemoryClasseRepository();
    const cache = new MetricCache();
    const registry = new MetricRegistry();
    const getMetric = new GetMetricUseCase(cache, registry, presenceRepo, noteRepo, statsRepo, schoolRepo, classeRepo);

    // Simule un appel pilote
    const res = await getMetric.execute({ key: 'moyenne_generale', dimensions: { schoolId: 'school-1', classId: 'c1', studentId: 'e1' } });
    // Sans notes, retourne 0 (même qu'avant)
    expect(res.value).toBe(0);
  });
});
