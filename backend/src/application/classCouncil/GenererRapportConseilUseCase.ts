import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { RapportConseilData } from './dto/RapportConseilData';

export interface GenererRapportCommande {
  sessionId: string;
  schoolId: string;
}

export class GenererRapportConseilUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: GenererRapportCommande): Promise<RapportConseilData | null> {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) return null;

    const decisions = session.decisions ?? [];
    const totalStudents = decisions.length;
    const passCount = decisions.filter(d => d.decision === 'PASS').length;
    const repeatCount = decisions.filter(d => d.decision === 'REPEAT').length;
    const deliberationCount = decisions.filter(d => d.decision === 'DELIBERATION').length;

    const moyennes = await this.repo.obtenirMoyennesElevesParClasse(
      session.classId,
      session.academicPeriodId,
    );

    const averages = decisions
      .map(d => moyennes.get(d.studentId))
      .filter((a): a is number => a !== undefined);
    const classAverage = averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0;
    const highestAverage = averages.length > 0 ? Math.max(...averages) : 0;
    const lowestAverage = averages.length > 0 ? Math.min(...averages) : 0;
    const successRate = totalStudents > 0 ? Math.round(((passCount + deliberationCount) / totalStudents) * 100) : 0;

    const dateConseil = session.validatedAt
      ? new Date(session.validatedAt).toLocaleDateString('fr-FR')
      : new Date(session.createdAt).toLocaleDateString('fr-FR');

    return {
      school: { name: session.school?.name ?? 'Établissement' },
      academicYear: session.academicPeriod?.academicYear?.name ?? '—',
      academicPeriod: session.academicPeriod?.name ?? '—',
      className: session.class?.name ?? '—',
      classLevel: session.class?.level,
      presidedBy: session.presidedBy ? `${session.presidedBy.firstName} ${session.presidedBy.lastName}` : '—',
      status: session.status,
      date: dateConseil,
      students: decisions.map(d => ({
        studentId: d.studentId,
        lastName: d.student?.lastName ?? '',
        firstName: d.student?.firstName ?? '',
        average: moyennes.get(d.studentId) ?? null,
        decision: d.decision,
        observations: d.observations,
      })),
      statistics: { totalStudents, passCount, repeatCount, deliberationCount, successRate, classAverage, highestAverage, lowestAverage },
    };
  }
}
