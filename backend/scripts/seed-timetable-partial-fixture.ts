import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const schoolId = 'fixture-edt-global-partial-school';
const yearId = 'fixture-edt-global-partial-year';
const staffId = 'fixture-edt-global-partial-staff';
const gaelleId = 'fixture-edt-global-partial-gaelle';
const danielId = 'fixture-edt-global-partial-daniel';
const classes = ['3e A', '3e B', '3e C', '4e A', '4e B', '4e C', '5e A', '5e B', '5e C', '6e A', '6e B', '6e C'];
const classIds = Object.fromEntries(classes.map(name => [name, `fixture-edt-global-partial-class-${name.replace(' ', '-').toLowerCase()}`]));
const subjects = [
  { name: 'Mathématiques', hours: 4, group: 'math' },
  { name: 'Français', hours: 5, group: 'francais' },
  { name: 'Anglais', hours: 3, group: 'anglais' },
  { name: 'Histoire-Géographie', hours: 4, group: 'humanites' },
  { name: 'Sciences de la vie et de la Terre', hours: 3, group: 'sciences' },
  { name: 'EPS', hours: 2, group: 'eps' },
  { name: 'Informatique', hours: 2, group: 'gaelle' },
  { name: 'Travail Manuel', hours: 2, group: 'gaelle' },
  { name: 'Lettres classiques (Latin/Grec)', hours: 2, group: 'daniel' },
  { name: 'Éducation à la Citoyenneté et à la Morale', hours: 2, group: 'civisme' },
  { name: 'Éducation Artistique et Culturelle', hours: 1, group: 'arts' },
  { name: 'Technologie', hours: 2, group: 'technologie' },
  { name: 'Économie', hours: 2, group: 'economie', lowerOnly: true },
];
const teacherPools: Record<string, string[]> = {
  math: ['Fixture Maths A', 'Fixture Maths B', 'Fixture Maths C'],
  francais: ['Fixture Français A', 'Fixture Français B', 'Fixture Français C'],
  anglais: ['Fixture Anglais A', 'Fixture Anglais B', 'Fixture Anglais C'],
  humanites: ['Fixture HG A', 'Fixture HG B', 'Fixture HG C'],
  sciences: ['Fixture SVT A', 'Fixture SVT B', 'Fixture SVT C'],
  eps: ['Fixture EPS A', 'Fixture EPS B', 'Fixture EPS C'],
  civisme: ['Fixture Civisme A', 'Fixture Civisme B', 'Fixture Civisme C'],
  arts: ['Fixture Arts A', 'Fixture Arts B', 'Fixture Arts C'],
  technologie: ['Fixture Technologie A', 'Fixture Technologie B', 'Fixture Technologie C'],
  economie: ['Fixture Économie A', 'Fixture Économie B', 'Fixture Économie C'],
};
const teacherIds = new Map<string, string>();
const subjectIds = new Map<string, string>();
const roomIds = new Map<string, string>();

async function upsertTeacher(name: string): Promise<string> {
  const existing = teacherIds.get(name);
  if (existing) return existing;
  const id = `fixture-edt-global-partial-teacher-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  await prisma.user.upsert({ where: { id }, update: { schoolId, firstName: name.split(' ')[0]!, lastName: name.split(' ').slice(1).join(' '), role: 'TEACHER', isActive: true }, create: { id, schoolId, firstName: name.split(' ')[0]!, lastName: name.split(' ').slice(1).join(' '), role: 'TEACHER', isActive: true } });
  teacherIds.set(name, id);
  return id;
}

async function main() {
  await prisma.school.upsert({ where: { id: schoolId }, update: { name: 'Fixture EDT global PARTIEL', subdomain: 'fixture-edt-global-partial', status: 'ACTIVE' }, create: { id: schoolId, name: 'Fixture EDT global PARTIEL', subdomain: 'fixture-edt-global-partial', status: 'ACTIVE' } });
  await prisma.academicYear.upsert({ where: { id: yearId }, update: { schoolId, name: '2026-2027', isCurrent: true, status: 'ACTIVE' }, create: { id: yearId, schoolId, name: '2026-2027', startDate: new Date('2026-09-01T00:00:00.000Z'), endDate: new Date('2027-07-30T23:59:59.000Z'), isCurrent: true, status: 'ACTIVE' } });
  const passwordHash = await bcrypt.hash('Fixture-EDT-2026!', 10);
  await prisma.user.upsert({ where: { id: staffId }, update: { schoolId, firstName: 'Fixture', lastName: 'Staff', role: 'STAFF', email: 'fixture-staff@edt.local', passwordHash, mustChangePassword: false }, create: { id: staffId, schoolId, firstName: 'Fixture', lastName: 'Staff', role: 'STAFF', email: 'fixture-staff@edt.local', passwordHash, mustChangePassword: false } });
  const staffProfile = await prisma.staffProfile.upsert({ where: { userId: staffId }, update: { schoolId, title: 'Fixture Censeur' }, create: { id: 'fixture-edt-global-partial-staff-profile', schoolId, userId: staffId, title: 'Fixture Censeur' } });
  await prisma.staffPermission.upsert({ where: { staffProfileId_permission: { staffProfileId: staffProfile.id, permission: 'MANAGE_TIMETABLE' } }, update: {}, create: { staffProfileId: staffProfile.id, permission: 'MANAGE_TIMETABLE' } });
  await upsertTeacher('Gaelle MBALLA');
  await upsertTeacher('Daniel NGUEMA');
  teacherIds.set('Gaelle MBALLA', gaelleId);
  teacherIds.set('Daniel NGUEMA', danielId);
  await prisma.user.upsert({ where: { id: gaelleId }, update: { schoolId, firstName: 'Gaelle', lastName: 'MBALLA', role: 'TEACHER' }, create: { id: gaelleId, schoolId, firstName: 'Gaelle', lastName: 'MBALLA', role: 'TEACHER' } });
  await prisma.user.upsert({ where: { id: danielId }, update: { schoolId, firstName: 'Daniel', lastName: 'NGUEMA', role: 'TEACHER' }, create: { id: danielId, schoolId, firstName: 'Daniel', lastName: 'NGUEMA', role: 'TEACHER' } });
  for (const className of classes) {
    const classId = classIds[className]!;
    await prisma.class.upsert({ where: { id: classId }, update: { schoolId, academicYearId: yearId, name: className, level: className.slice(0, 2), status: 'ACTIVE', capacity: 40 }, create: { id: classId, schoolId, academicYearId: yearId, name: className, level: className.slice(0, 2), status: 'ACTIVE', capacity: 40 } });
    const roomId = `fixture-edt-global-partial-room-${className.replace(' ', '-').toLowerCase()}`;
    roomIds.set(className, roomId);
    await prisma.room.upsert({ where: { id: roomId }, update: { schoolId, name: `Salle ${className}`, type: 'NORMAL', status: 'ACTIVE', capacity: 40 }, create: { id: roomId, schoolId, name: `Salle ${className}`, type: 'NORMAL', status: 'ACTIVE', capacity: 40 } });
    await prisma.classRoomAssignment.upsert({ where: { classId_academicYearId: { classId, academicYearId: yearId } }, update: { schoolId, roomId }, create: { id: `fixture-edt-global-partial-room-assignment-${className.replace(' ', '-').toLowerCase()}`, schoolId, classId, roomId, academicYearId: yearId } });
    await prisma.timetable.upsert({ where: { schoolId_classId_academicYearId: { schoolId, classId, academicYearId: yearId } }, update: { status: 'DRAFT' }, create: { id: `fixture-edt-global-partial-timetable-${className.replace(' ', '-').toLowerCase()}`, schoolId, classId, academicYearId: yearId, status: 'DRAFT' } });
  }
  await prisma.timetableGridConfig.upsert({ where: { schoolId }, update: { heureDebut: '07:30', dureePeriode: 60, periodesAvantP1: 3, dureePetitePause: 10, periodesAvantP2: 2, dureeGrandePause: 20, periodesApresP2: 2, joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'], periodesCoursParJour: { LUNDI: 7, MARDI: 7, MERCREDI: 6, JEUDI: 7, VENDREDI: 7, SAMEDI: 4 } }, create: { schoolId, heureDebut: '07:30', dureePeriode: 60, periodesAvantP1: 3, dureePetitePause: 10, periodesAvantP2: 2, dureeGrandePause: 20, periodesApresP2: 2, joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'], periodesCoursParJour: { LUNDI: 7, MARDI: 7, MERCREDI: 6, JEUDI: 7, VENDREDI: 7, SAMEDI: 4 } } });
  for (const subject of subjects) {
    const subjectId = `fixture-edt-global-partial-subject-${subject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    subjectIds.set(subject.name, subjectId);
    await prisma.subject.upsert({ where: { id: subjectId }, update: { schoolId, name: subject.name, hoursPerWeek: subject.hours, subjectType: 'THEORETICAL', coefficient: 1, deletedAt: null }, create: { id: subjectId, schoolId, name: subject.name, hoursPerWeek: subject.hours, subjectType: 'THEORETICAL', coefficient: 1 } });
    for (const level of ['3e', '4e', '5e', '6e']) {
      const weeklyPeriods = level === '3e' || level === '4e' ? subject.hours : subject.hours;
      const coefficientId = `fixture-edt-global-partial-coefficient-${level}-${subject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      await prisma.subjectCoefficient.upsert({ where: { id: coefficientId }, update: { schoolId, subjectId, classLevel: level, serieCode: null, coefficient: 1, weeklyPeriods }, create: { id: coefficientId, schoolId, subjectId, classLevel: level, serieCode: null, coefficient: 1, weeklyPeriods } });
    }
  }
  for (const [index, className] of classes.entries()) {
    const classId = classIds[className]!;
    const level = className.slice(0, 2);
    const includeEconomy = level === '3e' || level === '4e';
    for (const subject of subjects.filter(item => includeEconomy || !item.lowerOnly)) {
      const subjectId = subjectIds.get(subject.name)!;
      const teacherId = subject.group === 'gaelle' ? gaelleId : subject.group === 'daniel' ? danielId : (await upsertTeacher(teacherPools[subject.group]![index % 3]!));
      await prisma.teachingAssignment.upsert({ where: { classId_subjectId: { classId, subjectId } }, update: { schoolId, academicYearId: yearId, teacherId, source: 'GENERATED', createdAt: new Date() }, create: { id: `fixture-edt-global-partial-assignment-${className.replace(' ', '-').toLowerCase()}-${subject.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, classId, subjectId, teacherId, schoolId, academicYearId: yearId, source: 'GENERATED', createdAt: new Date() } });
    }
  }
  const counts = await prisma.teachingAssignment.groupBy({ by: ['classId'], where: { schoolId, academicYearId: yearId }, _count: { _all: true } });
  console.log(JSON.stringify({ schoolId, yearId, staffId, staffEmail: 'fixture-staff@edt.local', staffPassword: 'Fixture-EDT-2026!', classes: classes.length, gridCases: 38, teachingAssignments: counts.reduce((sum, item) => sum + item._count._all, 0), gaelleId, danielId }, null, 2));
}

main().finally(() => prisma.$disconnect());
