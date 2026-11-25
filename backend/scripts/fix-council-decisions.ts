import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const sessions = await prisma.classCouncilSession.findMany({
    include: { _count: { select: { decisions: true } } },
  })

  const sessionsVides = sessions.filter(s => s._count.decisions === 0)
  console.log(`Sessions sans décisions : ${sessionsVides.length}`)

  let totalCreees = 0

  for (const session of sessionsVides) {
    const students = await prisma.enrollment.findMany({
      where: { classId: session.classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      select: { student: { select: { userId: true } } },
    }).then((rows) => rows.map((r) => r.student))

    if (students.length === 0) {
      console.log(`⚠️  Session ${session.id} (classId=${session.classId}) : aucun élève dans la classe`)
      continue
    }

    await prisma.classCouncilDecision.createMany({
      data: students.map(s => ({
        sessionId: session.id,
        studentId: s.userId,
        decision: 'DELIBERATION' as any,
        observations: null,
      })),
      skipDuplicates: true,
    })

    totalCreees += students.length
    console.log(`✅ Session ${session.id} : ${students.length} décisions créées`)
  }

  console.log(`\nTerminé. ${totalCreees} décisions créées au total.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
