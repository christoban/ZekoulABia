import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { ProcesVerbalData } from './dto/ProcesVerbalData';

export interface GenererPVCommande {
  sessionId: string;
  schoolId: string;
}

export class GenererProcesVerbalUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: GenererPVCommande): Promise<ProcesVerbalData | null> {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) return null;

    const decisions = session.decisions ?? [];
    const totalStudents = decisions.length;
    const passCount = decisions.filter(d => d.decision === 'PASS').length;
    const repeatCount = decisions.filter(d => d.decision === 'REPEAT').length;
    const deliberationCount = decisions.filter(d => d.decision === 'DELIBERATION').length;
    const successRate = totalStudents > 0 ? Math.round(((passCount + deliberationCount) / totalStudents) * 100) : 0;

    const moyennes = await this.repo.obtenirMoyennesElevesParClasse(
      session.classId,
      session.academicPeriodId,
    );

    const dateConseil = session.validatedAt
      ? new Date(session.validatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date(session.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    return {
      school: { name: session.school?.name ?? 'Établissement', city: session.school?.city },
      academicYear: session.academicPeriod?.academicYear?.name ?? '—',
      academicPeriod: session.academicPeriod?.name ?? '—',
      className: session.class?.name ?? '—',
      presidedBy: session.presidedBy ? `${session.presidedBy.firstName} ${session.presidedBy.lastName}` : '—',
      date: dateConseil,
      students: decisions.map(d => ({
        studentId: d.studentId,
        lastName: d.student?.lastName ?? '',
        firstName: d.student?.firstName ?? '',
        average: moyennes.get(d.studentId) ?? null,
        decision: d.decision,
        observations: d.observations,
      })),
      statistics: { totalStudents, passCount, repeatCount, deliberationCount, successRate },
    };
  }
}
