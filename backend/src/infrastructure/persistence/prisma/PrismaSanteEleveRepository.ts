import type { PrismaClient } from '@prisma/client';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import { resolveHasCoefficientForClass } from '@domain/subsystems/SubsystemDefaults';
import type {
  SanteEleveRepository,
  DonneesSanteEleve,
} from '@domain/ports/repositories/SanteEleveRepository';

export class PrismaSanteEleveRepository implements SanteEleveRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getDonneesSante(
    studentId: string,
    schoolId: string,
    academicYearId: string
  ): Promise<DonneesSanteEleve | null> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });
    if (!student || student.schoolId !== schoolId) return null;

    // Résolution hasCoefficient au niveau classe (un élève de primaire dans un complexe scolaire)
    let hasCoefficientBySubject = true;
    try {
      const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } });
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { studentId, academicYearId, status: 'ACTIVE' },
        select: { class: { select: { level: true } } },
      });
      const level = enrollment?.class?.level ?? null;
      if (school) hasCoefficientBySubject = resolveHasCoefficientForClass(school, level);
    } catch {
      // best-effort fallback
    }

    // 1. Moyenne générale pondérée (notes VALIDATED/LOCKED)
    const notes = await this.prisma.grade.findMany({
      where: {
        studentId,
        academicYearId,
        validationStatus: { in: ['LOCKED'] },
      },
      select: { sequenceAverage: true, coefficient: true },
    });

    const moyenneGenerale = calculateAverageScoreOn20(
      notes.map((n) => ({
        scoreOn20: n.sequenceAverage ?? 0,
        percentage: (n.sequenceAverage ?? 0) * 5,
        coefficient: n.coefficient,
      })),
      hasCoefficientBySubject,
    );

    // 2. Assiduité (30 derniers jours)
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - 30);
    const presences = await this.prisma.attendance.findMany({
      where: { studentId, schoolId, date: { gte: dateDebut } },
      select: { status: true },
    });
    const joursPresent = presences.filter(p => p.status === 'PRESENT').length;
    const joursTotaux = presences.length;

    // 3. Tendance (3 dernières périodes de l'année)
    const periodes = await this.prisma.academicPeriod.findMany({
      where: { academicYear: { schoolId, id: academicYearId } },
      orderBy: { orderIndex: 'asc' },
      take: 3,
      select: { id: true },
    });

    const moyennesPrecedentes: number[] = [];
    for (const periode of periodes) {
      const sequences = await this.prisma.academicSequence.findMany({
        where: { academicPeriodId: periode.id },
        select: { id: true },
      });
      const seqIds = sequences.map(s => s.id);
      if (seqIds.length === 0) continue;

      const notesPeriode = await this.prisma.grade.findMany({
        where: {
          studentId,
          sequenceId: { in: seqIds },
        validationStatus: { in: ['LOCKED'] },
        },
        select: { sequenceAverage: true, coefficient: true },
      });
      if (notesPeriode.length > 0) {
        moyennesPrecedentes.push(
          calculateAverageScoreOn20(
            notesPeriode.map((n) => ({
              scoreOn20: n.sequenceAverage ?? 0,
              percentage: (n.sequenceAverage ?? 0) * 5,
              coefficient: n.coefficient,
            })),
            hasCoefficientBySubject,
          ),
        );
      }
    }

    // 4. Comportement — sanctions de l'ANNÉE SCOLAIRE COURANTE uniquement (DisciplineRecord n'a
    // pas de academicYearId direct, on borne donc par les dates de l'année). Auparavant compté
    // depuis toujours (bug d'incohérence trouvé en vérification — voir
    // PLAN_VERIFICATION_ET_ACTIONS_SUIVI.md A.1) : une sanction en 6e pénalisait encore le score
    // en Terminale, alors que nombrePeriodes (dénominateur de la même composante, ci-dessous) ne
    // regarde lui que les périodes de l'année en cours — les deux bornes doivent coïncider.
    const anneeScolaire = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { startDate: true, endDate: true },
    });
    const nombreSanctions = anneeScolaire
      ? await this.prisma.disciplineRecord.count({
          where: { studentId, schoolId, createdAt: { gte: anneeScolaire.startDate, lte: anneeScolaire.endDate } },
        })
      : 0;

    // 5. Paiements
    const factures = await this.prisma.invoice.findMany({
      where: { studentId, schoolId },
      select: { amount: true, status: true },
    });
    const fraisTotaux = factures.reduce((s, f) => s + f.amount, 0);
    const fraisRegles = factures
      .filter(f => f.status === 'PAID')
      .reduce((s, f) => s + f.amount, 0);

    return {
      studentId,
      moyenneGenerale,
      joursPresent,
      joursTotaux,
      moyennesPrecedentes,
      nombreSanctions,
      nombrePeriodes: periodes.length,
      fraisRegles,
      fraisTotaux,
    };
  }

  async sauvegarderScore(studentId: string, score: number): Promise<void> {
    await this.prisma.studentProfile.update({
      where: { userId: studentId },
      data: { healthScore: score },
    });
  }
}
