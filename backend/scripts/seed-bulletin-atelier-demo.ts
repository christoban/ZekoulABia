/**
 * Script de seed local — Atelier & cycle complet des bulletins ZekoulABia.
 * Crée une école de démonstration, un kit d'identité, 1 classe (3ème A),
 * 4 matières, 3 élèves fictifs, 2 séquences de notes LOCKED et 1 conseil LOCKED.
 *
 * Usage :
 *   cd backend && bun scripts/seed-bulletin-atelier-demo.ts
 */
import type { PrismaClient } from '@prisma/client';
import { PrismaClient as RuntimePrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaEnrollmentRepository } from '../src/infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { creerEleveAvecClasse } from '../src/application/shared/studentEnrollment';

export interface SeedBulletinDemoResult {
  schoolId: string;
  schoolName: string;
  adminId: string;
  teacherId: string;
  parentId: string;
  studentIds: string[];
  classId: string;
  academicYearId: string;
  academicPeriodId: string;
  sequenceIds: [string, string];
  mathSubjectId: string;
}

export async function seedBulletinAtelierDemo(
  prisma: PrismaClient,
  opts?: { uniqueSuffix?: string },
): Promise<SeedBulletinDemoResult> {
  const suffix = opts?.uniqueSuffix ?? `demo-${Date.now()}`;
  const enrollmentRepo = new PrismaEnrollmentRepository(prisma);
  const pwdHash = await bcrypt.hash('DemoPass2026!', 10);

  const school = await prisma.school.create({
    data: {
      name: `Collège Bilingue Démo Atelier (${suffix})`,
      subdomain: `demo-atelier-${suffix}`.slice(0, 48),
      status: 'ACTIVE',
      plan: 'PREMIUM',
      subsystem: 'BILINGUAL',
      educationType: 'GENERAL',
      ownership: 'PRIVATE_SECULAR',
      city: 'Yaoundé',
      phone: '+237 670 00 00 00',
    },
  });

  await prisma.schoolConfig.create({
    data: {
      schoolId: school.id,
      bulletinTemplate: 'FR_SECONDARY',
      bulletinGroupingScheme: 'SCI_LIT_OTHER',
      useMeasuredBulletinRenderer: true,
      sequenceCalculationMode: 'single',
      passMark: 10,
    },
  });

  await prisma.schoolIdentityKit.create({
    data: {
      schoolId: school.id,
      regionalDelegationFr: 'DÉLÉGATION RÉGIONALE DU CENTRE',
      regionalDelegationEn: 'CENTRE REGIONAL DELEGATION',
      departmentalDelegationFr: 'DÉLÉGATION DÉPARTEMENTALE DU MFOUNDI',
      departmentalDelegationEn: 'MFOUNDI DIVISIONAL DELEGATION',
      mottoFr: 'Discipline — Travail — Réussite',
      mottoEn: 'Discipline — Hard Work — Success',
      poBox: 'BP 4210 Yaoundé',
      city: 'Yaoundé',
      phone: '+237 670 00 00 00',
      foundingYear: 2012,
      authorizationNumber: 'N° 124/MINESEC/CAB',
      accentColor: '#1e3a8a',
    },
  });

  await prisma.bulletinTemplateAssignment.create({
    data: {
      schoolId: school.id,
      classLevel: '3e',
      periodKind: 'TRIMESTER',
      template: 'FR_SECONDARY',
      templateSpecId: 'GENERAL_GROUPED_V1',
      templateVersion: 1,
      groupingScheme: 'SCI_LIT_OTHER',
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: 'ADMIN',
      firstName: 'Hélène',
      lastName: 'Directrice',
      email: `admin-${suffix}@zekoulabia.cm`,
      passwordHash: pwdHash,
      isActive: true,
    },
  });

  const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: 'TEACHER',
      firstName: 'Paul',
      lastName: 'Titulaire',
      email: `teacher-${suffix}@zekoulabia.cm`,
      passwordHash: pwdHash,
      isActive: true,
    },
  });

  const parent = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: 'PARENT',
      firstName: 'Marc',
      lastName: 'Mvondo',
      email: `parent-${suffix}@zekoulabia.cm`,
      passwordHash: pwdHash,
      isActive: true,
    },
  });
  const parentProfile = await prisma.parentProfile.create({ data: { userId: parent.id } });

  const year = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: '2026-2027',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      isCurrent: true,
    },
  });

  const period = await prisma.academicPeriod.create({
    data: {
      academicYearId: year.id,
      name: 'Trimestre 1',
      type: 'TRIMESTER',
      orderIndex: 1,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-15'),
      isCurrent: true,
    },
  });

  const seq1 = await prisma.academicSequence.create({
    data: {
      academicPeriodId: period.id,
      schoolId: school.id,
      name: 'Séquence 1',
      type: 'DS',
      orderIndex: 1,
      isCurrent: false,
    },
  });
  const seq2 = await prisma.academicSequence.create({
    data: {
      academicPeriodId: period.id,
      schoolId: school.id,
      name: 'Séquence 2',
      type: 'DS',
      orderIndex: 2,
      isCurrent: true,
    },
  });

  const sectionFr = await prisma.section.create({
    data: { schoolId: school.id, name: 'Section Francophone', code: 'FR' },
  });

  const classe = await prisma.class.create({
    data: {
      schoolId: school.id,
      academicYearId: year.id,
      name: '3ème A Démo',
      level: '3e',
      sectionId: sectionFr.id,
      professorPrincipalId: teacher.id,
    },
  });

  const studentDefs = [
    { firstName: 'Alice', lastName: 'Mvondo', email: `alice-${suffix}@zekoulabia.cm`, gender: 'F' as const, scores: [[15, 16], [14, 15], [13, 14], [12, 13]] },
    { firstName: 'Bruno', lastName: 'Kamga', email: `bruno-${suffix}@zekoulabia.cm`, gender: 'M' as const, scores: [[11, 12], [10, 11], [12, 13], [11, 12]] },
    { firstName: 'Clarisse', lastName: 'Ndi', email: `clarisse-${suffix}@zekoulabia.cm`, gender: 'F' as const, scores: [[17, 18], [16, 17], [15, 16], [14, 15]] },
  ];

  const subjectDefs = [
    { name: 'Mathématiques', code: 'MATH', coefficient: 4, hoursPerWeek: 4 },
    { name: 'Physique-Chimie', code: 'PCT', coefficient: 3, hoursPerWeek: 3 },
    { name: 'Français', code: 'FR', coefficient: 4, hoursPerWeek: 4 },
    { name: 'Histoire-Géographie', code: 'HIST', coefficient: 2, hoursPerWeek: 2 },
  ];

  const subjects = await Promise.all(
    subjectDefs.map((s) =>
      prisma.subject.create({
        data: { schoolId: school.id, name: s.name, code: s.code, coefficient: s.coefficient, hoursPerWeek: s.hoursPerWeek },
      }),
    ),
  );

  const studentIds: string[] = [];
  for (let sIdx = 0; sIdx < studentDefs.length; sIdx++) {
    const def = studentDefs[sIdx]!;
    const stu = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: 'STUDENT',
        firstName: def.firstName,
        lastName: def.lastName,
        email: def.email,
        passwordHash: pwdHash,
        isActive: true,
      },
    });
    studentIds.push(stu.id);
    await creerEleveAvecClasse(enrollmentRepo, { userId: stu.id, classId: classe.id, enrolledById: admin.id });
    await prisma.studentProfile.update({
      where: { userId: stu.id },
      data: { matricule: `ZK-26-${sIdx + 1}`, gender: def.gender },
    });
    if (sIdx === 0) {
      const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: stu.id } });
      await prisma.parentStudent.create({
        data: { parentProfileId: parentProfile.id, studentProfileId: profile.id, relation: 'PERE', contactPrincipal: true },
      });
    }

    for (let mIdx = 0; mIdx < subjects.length; mIdx++) {
      const subj = subjects[mIdx]!;
      const [s1, s2] = def.scores[mIdx]!;
      for (const [seq, score] of [[seq1, s1], [seq2, s2]] as const) {
        await prisma.grade.create({
          data: {
            schoolId: school.id,
            studentId: stu.id,
            subjectId: subj.id,
            classId: classe.id,
            academicYearId: year.id,
            sequenceId: seq.id,
            sequenceScore: score,
            coefficient: subj.coefficient,
            maxValue: 20,
            sequenceAverage: score,
            validationStatus: 'LOCKED',
            validatedById: admin.id,
            validatedAt: new Date(),
            recordedById: teacher.id,
          },
        });
      }
    }
  }

  await prisma.classCouncilSession.create({
    data: {
      schoolId: school.id,
      classId: classe.id,
      academicPeriodId: period.id,
      presidedById: admin.id,
      status: 'LOCKED',
      validatedAt: new Date(),
    },
  });

  return {
    schoolId: school.id,
    schoolName: school.name,
    adminId: admin.id,
    teacherId: teacher.id,
    parentId: parent.id,
    studentIds,
    classId: classe.id,
    academicYearId: year.id,
    academicPeriodId: period.id,
    sequenceIds: [seq1.id, seq2.id],
    mathSubjectId: subjects[0]!.id,
  };
}

if (import.meta.main) {
  const client = new RuntimePrismaClient();
  seedBulletinAtelierDemo(client)
    .then(async (res) => {
      console.log('Seed Atelier Bulletins terminé :', JSON.stringify(res, null, 2));
      await client.$disconnect();
    })
    .catch(async (err) => {
      console.error('Erreur seed Atelier Bulletins :', err);
      await client.$disconnect();
      process.exit(1);
    });
}
