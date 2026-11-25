import { prisma } from "../src/config/prisma";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Ce script est interdit en production (destruction de données).");
  }

  const schoolName = "Lycée la Réussite";
  const school = await prisma.school.findFirst({ where: { name: { contains: schoolName, mode: "insensitive" } } });
  if (!school) {
    console.log("École de test introuvable. Rien à supprimer.");
    return;
  }

  // Targets created by create-test-data.ts
  const teacherPhoneLocal = "677123456"; // teacher phone without country code
  const studentPhones = ["650000001", "650000002", "650000003"];
  const studentNames = [
    { firstName: "Alice", lastName: "Alpha" },
    { firstName: "Bob", lastName: "Beta" },
    { firstName: "Charlie", lastName: "Gamma" },
  ];

  const deleted: string[] = [];

  // Delete teacher by phone
  const teacher = await prisma.user.findFirst({ where: { schoolId: school.id, phone: { contains: teacherPhoneLocal } } });
  if (teacher) {
    await prisma.studentProfile.deleteMany({ where: { userId: teacher.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: teacher.id } });
    deleted.push(`teacher:${teacher.id}`);
    console.log("Deleted teacher:", teacher.id);
  } else {
    console.log("Teacher not found, skipping.");
  }

  // Delete students by phone
  for (const phone of studentPhones) {
    const u = await prisma.user.findFirst({ where: { schoolId: school.id, phone } });
    if (u) {
      await prisma.studentProfile.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } });
      deleted.push(`student:${u.id}`);
      console.log("Deleted student (by phone):", u.id);
    }
  }

  // Also attempt to delete students by name if they were created without phone
  for (const n of studentNames) {
    const u = await prisma.user.findFirst({ where: { schoolId: school.id, firstName: n.firstName, lastName: n.lastName } });
    if (u) {
      await prisma.studentProfile.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } });
      deleted.push(`student:${u.id}`);
      console.log("Deleted student (by name):", u.id);
    }
  }

  console.log("Delete summary:", deleted);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
