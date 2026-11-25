import bcrypt from "bcryptjs";
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import { PrismaEnrollmentRepository } from '../src/infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prisma } from "../src/config/prisma";

const enrollmentRepo = new PrismaEnrollmentRepository(prisma);

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Ce script est interdit en production (création de données de test).");
  }

  const schoolName = "Lycée la Réussite";
  let school = await prisma.school.findFirst({ where: { name: { contains: schoolName, mode: "insensitive" } } });

  if (!school) {
    school = await prisma.school.create({ data: { name: schoolName, subdomain: "lycee-la-reussite" } });
    console.log("Created school:", school.id);
  } else {
    console.log("Found school:", school.id);
  }

  // Admin user
  const adminEmail = "ndzanachristophe12@gmail.com";
  const adminPassword = "menedona2005";

  let admin = await prisma.user.findFirst({ where: { schoolId: school.id, email: adminEmail } });
  if (!admin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    admin = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: "ADMIN",
        email: adminEmail,
        passwordHash,
        firstName: "Christoph",
        lastName: "Endzana",
        phone: null,
      },
    });
    console.log("Created admin user:", admin.id);
  } else {
    console.log("Admin already exists:", admin.id);
  }

  // Create a teacher with phone matching test sender
  const teacherPhone = "677123456"; // local part, webhook sends 237677123456
  let teacher = await prisma.user.findFirst({ where: { schoolId: school.id, phone: { contains: teacherPhone } } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: "TEACHER",
        firstName: "Test",
        lastName: "Teacher",
        phone: teacherPhone,
      },
    });
    console.log("Created teacher:", teacher.id);
  } else {
    console.log("Teacher exists:", teacher.id);
  }

  // Année académique courante (nécessaire pour year-scoper la classe créée ci-dessous)
  let anneeScolaire = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true } });
  if (!anneeScolaire) {
    anneeScolaire = await prisma.academicYear.create({
      data: {
        schoolId: school.id,
        name: "2025-2026",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-06-30"),
        isCurrent: true,
      },
    });
    console.log("Created academic year:", anneeScolaire.id);
  }

  // Create class 6e A
  const className = "6e A";
  let cls = await prisma.class.findFirst({ where: { schoolId: school.id, name: className } });
  if (!cls) {
    cls = await prisma.class.create({ data: { schoolId: school.id, name: className, academicYearId: anneeScolaire.id } });
    console.log("Created class:", cls.id);
  } else {
    console.log("Class exists:", cls.id);
  }

  // Create 3 students
  const studentsData = [
    { firstName: "Alice", lastName: "Alpha", phone: "650000001" },
    { firstName: "Bob", lastName: "Beta", phone: "650000002" },
    { firstName: "Charlie", lastName: "Gamma", phone: "650000003" },
  ];

  for (const s of studentsData) {
    let user = await prisma.user.findFirst({ where: { schoolId: school.id, firstName: s.firstName, lastName: s.lastName } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          schoolId: school.id,
          role: "STUDENT",
          firstName: s.firstName,
          lastName: s.lastName,
          phone: s.phone,
        },
      });
      console.log("Created student user:", user.id);
    } else {
      console.log("Student user exists:", user.id);
    }

    // create StudentProfile linking to class
    const existingProfile = await prisma.studentProfile.findFirst({ where: { userId: user.id } });
    if (!existingProfile) {
      await creerEleveAvecClasse(enrollmentRepo, { userId: user.id, classId: cls.id, enrolledById: user.id });
      console.log("Created StudentProfile for", user.id);
    }
  }

  console.log("Test data ready.\nSchool:", school.name, "Class:", className);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
