import { prisma } from "../src/config/prisma";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Ce script est interdit en production (destruction de données).");
  }

  const schoolName = "Lycée la Réussite";
  const school = await prisma.school.findFirst({ where: { name: { contains: schoolName, mode: "insensitive" } } });

  if (!school) {
    console.log("École introuvable — rien à supprimer.");
    return;
  }

  const students = [
    { firstName: "Alice", lastName: "Alpha" },
    { firstName: "Bob", lastName: "Beta" },
    { firstName: "Charlie", lastName: "Gamma" },
  ];

  for (const s of students) {
    const user = await prisma.user.findFirst({ where: { schoolId: school.id, firstName: s.firstName, lastName: s.lastName } });
    if (user) {
      // Remove dependent attendance records first (FK RESTRICT)
      await prisma.attendance.deleteMany({ where: { studentId: user.id } }).catch(() => {});
      await prisma.studentProfile.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`Supprimé étudiant: ${s.firstName} ${s.lastName} (${user.id})`);
    } else {
      console.log(`Étudiant non trouvé: ${s.firstName} ${s.lastName}`);
    }
  }

  // Supprimer l'enseignant de test (phone contains 677123456)
  const teacher = await prisma.user.findFirst({ where: { schoolId: school.id, phone: { contains: "677123456" } } });
  if (teacher) {
    await prisma.attendance.deleteMany({ where: { OR: [{ recordedById: teacher.id }, { teacherId: teacher.id }] } }).catch(() => {});
    await prisma.user.delete({ where: { id: teacher.id } });
    console.log(`Supprimé enseignant de test: ${teacher.firstName} ${teacher.lastName} (${teacher.id})`);
  } else {
    console.log("Enseignant de test non trouvé.");
  }

  console.log("Suppression des données de test terminée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
