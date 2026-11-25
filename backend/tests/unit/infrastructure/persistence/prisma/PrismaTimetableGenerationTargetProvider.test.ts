import { describe, expect, it } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { PrismaTimetableGenerationTargetProvider } from '../../../../../src/infrastructure/persistence/prisma/PrismaTimetableGenerationTargetProvider.ts';

describe('PrismaTimetableGenerationTargetProvider — pré-flight', () => {
  it('déduit la capacité d’un enseignant des créneaux fixes/manualisés', async () => {
    const prisma = {
      teachingAssignment: {
        findMany: async () => [{
          teacherId: 'teacher-1',
          subject: {
            name: 'Mathématiques',
            hoursPerWeek: 2,
            subjectCoefficients: [],
          },
          class: { name: '3e A', level: '3e' },
        }],
      },
      timetableGridConfig: {
        findUnique: async () => ({
          joursActifs: ['LUNDI'],
          periodesCoursParJour: { LUNDI: 2 },
          heureDebut: '08:00',
          dureePeriode: 60,
          periodesAvantP1: 2,
          dureePetitePause: 0,
          periodesAvantP2: 0,
          dureeGrandePause: 0,
          periodesApresP2: 0,
        }),
      },
      teacherUnavailability: { findMany: async () => [] },
      timetableSlot: {
        findMany: async () => [{
          teacherId: 'teacher-1',
          roomId: 'room-1',
          dayOfWeek: 0,
          startTime: '08:00',
          endTime: '09:00',
        }],
      },
      user: {
        findMany: async () => [{ id: 'teacher-1', firstName: 'Marie', lastName: 'Dupont' }],
      },
    } as unknown as PrismaClient;

    const provider = new PrismaTimetableGenerationTargetProvider(prisma);
    const report = await provider.buildPreflight('school-1', 'year-1', [{
      classId: 'class-1',
      className: '3e A',
      requiredHours: 2,
    }]);

    expect(report.capacity).toBe(2);
    expect(report.fixedOccupationCases).toBe(1);
    expect(report.overloaded).toEqual([{
      teacherId: 'teacher-1',
      name: 'Marie Dupont',
      hours: 2,
      capacity: 1,
      overloaded: true,
      deficitHours: 1,
      details: ['3e A — Mathématiques (2h)'],
    }]);
  });
});
