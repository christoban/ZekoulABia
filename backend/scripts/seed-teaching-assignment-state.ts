import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const schoolId = 'fixture-teaching-assignment-state-school';
const yearId = 'fixture-teaching-assignment-state-year';
const classes = [
  { id: 'fixture-teaching-assignment-state-class-6e-a', name: '6e A' },
  { id: 'fixture-teaching-assignment-state-class-6e-b', name: '6e B' },
];
const teachers = [
  { id: 'fixture-teaching-assignment-state-alice', firstName: 'Alice', lastName: 'TEST', maxWeeklyHours: 8 },
  { id: 'fixture-teaching-assignment-state-bob', firstName: 'Bob', lastName: 'TEST', maxWeeklyHours: 2 },
];
const subjects = [
  { id: 'fixture-teaching-assignment-state-math', name: 'Mathématiques', code: 'STATE-MATH', hoursPerWeek: 4 },
  { id: 'fixture-teaching-assignment-state-french', name: 'Français', code: 'STATE-FRENCH', hoursPerWeek: 2 },
];

async function main() {
  await prisma.school.upsert({
    where: { id: schoolId },
    update: { name: 'Fixture affectations état', subdomain: 'fixture-teaching-assignment-state', status: 'ACTIVE', defaultMaxWeeklyHours: 12 },
    create: { id: schoolId, name: 'Fixture affectations état', subdomain: 'fixture-teaching-assignment-state', status: 'ACTIVE', defaultMaxWeeklyHours: 12 },
  });
  await prisma.academicYear.upsert({
    where: { id: yearId },
    update: { schoolId, name: '2026-2027', isCurrent: true, status: 'ACTIVE' },
    create: { id: yearId, schoolId, name: '2026-2027', startDate: new Date('2026-09-01T00:00:00.000Z'), endDate: new Date('2027-07-30T23:59:59.000Z'), isCurrent: true, status: 'ACTIVE' },
  });
  await prisma.timetableGridConfig.upsert({
    where: { schoolId },
    update: { heureDebut: '07:30', dureePeriode: 60, periodesAvantP1: 3, dureePetitePause: 10, periodesAvantP2: 2, dureeGrandePause: 20, periodesApresP2: 2, joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'], periodesCoursParJour: { LUNDI: 7, MARDI: 7, MERCREDI: 6, JEUDI: 7, VENDREDI: 7, SAMEDI: 4 } },
    create: { schoolId, heureDebut: '07:30', dureePeriode: 60, periodesAvantP1: 3, dureePetitePause: 10, periodesAvantP2: 2, dureeGrandePause: 20, periodesApresP2: 2, joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'], periodesCoursParJour: { LUNDI: 7, MARDI: 7, MERCREDI: 6, JEUDI: 7, VENDREDI: 7, SAMEDI: 4 } },
  });

  for (const teacher of teachers) {
    await prisma.user.upsert({
      where: { id: teacher.id },
      update: { schoolId, firstName: teacher.firstName, lastName: teacher.lastName, role: 'TEACHER', isActive: true },
      create: { id: teacher.id, schoolId, firstName: teacher.firstName, lastName: teacher.lastName, role: 'TEACHER', isActive: true },
    });
    const profile = await prisma.teacherProfile.upsert({
      where: { userId: teacher.id },
      update: { maxWeeklyHours: teacher.maxWeeklyHours },
      create: { id: `${teacher.id}-profile`, userId: teacher.id, specialization: [], maxWeeklyHours: teacher.maxWeeklyHours },
    });
  }

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      update: { schoolId, name: subject.name, code: subject.code, hoursPerWeek: subject.hoursPerWeek, deletedAt: null },
      create: { id: subject.id, schoolId, name: subject.name, code: subject.code, hoursPerWeek: subject.hoursPerWeek, subjectType: 'THEORETICAL', coefficient: 1 },
    });
    await prisma.subjectCoefficient.upsert({
      where: { id: `${subject.id}-coefficient-6e` },
      update: { schoolId, subjectId: subject.id, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 1, weeklyPeriods: subject.hoursPerWeek },
      create: { id: `${subject.id}-coefficient-6e`, schoolId, subjectId: subject.id, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 1, weeklyPeriods: subject.hoursPerWeek },
    });
  }

  for (const teacher of teachers) {
    const profile = await prisma.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id } });
    for (const subject of subjects) {
      await prisma.teacherSubject.upsert({
        where: { teacherProfileId_subjectId: { teacherProfileId: profile.id, subjectId: subject.id } },
        update: {},
        create: { teacherProfileId: profile.id, subjectId: subject.id },
      });
    }
  }

  for (const classe of classes) {
    await prisma.class.upsert({
      where: { id: classe.id },
      update: { schoolId, academicYearId: yearId, name: classe.name, level: '6e', serie: null, filiere: 'FR_GENERAL', capacity: 40, status: 'ACTIVE' },
      create: { id: classe.id, schoolId, academicYearId: yearId, name: classe.name, level: '6e', filiere: 'FR_GENERAL', capacity: 40, status: 'ACTIVE' },
    });
  }

  const assignments = [
    { classId: classes[0]!.id, subjectId: subjects[0]!.id, teacherId: teachers[0]!.id, source: 'GENERATED' as const, createdAt: new Date('2026-09-01T08:00:00.000Z') },
    { classId: classes[1]!.id, subjectId: subjects[0]!.id, teacherId: teachers[0]!.id, source: 'GENERATED' as const, createdAt: new Date('2026-09-01T08:00:00.000Z') },
    { classId: classes[0]!.id, subjectId: subjects[1]!.id, teacherId: teachers[1]!.id, source: 'UNKNOWN' as const, createdAt: null },
  ];
  for (const assignment of assignments) {
    await prisma.teachingAssignment.upsert({
      where: { classId_subjectId: { classId: assignment.classId, subjectId: assignment.subjectId } },
      update: { schoolId, academicYearId: yearId, teacherId: assignment.teacherId, source: assignment.source, createdAt: assignment.createdAt },
      create: { id: `fixture-teaching-assignment-state-${assignment.classId}-${assignment.subjectId}`, schoolId, academicYearId: yearId, ...assignment },
    });
  }

  const count = await prisma.teachingAssignment.count({ where: { schoolId, academicYearId: yearId } });
  console.log(JSON.stringify({ schoolId, yearId, classes: classes.length, teachers: teachers.length, assignments: count, correction: 'Réaffectation recommandée sans suppression des lignes existantes' }, null, 2));
}

main().finally(() => prisma.$disconnect());
