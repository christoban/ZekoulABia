import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { PdfService } from '@domain/ports/services/PdfService';

export interface GenererTableauHonneurAnnuelCommande {
  classId: string;
  schoolId: string;
  top?: number;
}

export class GenererTableauHonneurAnnuelUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly anneeAcademiqueRepository: AnneeAcademiqueRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly classCouncilRepository: ClassCouncilRepository,
    private readonly pdfService: PdfService,
  ) {}

  async execute(cmd: GenererTableauHonneurAnnuelCommande): Promise<Buffer> {
    const top = Math.min(20, Math.max(1, cmd.top ?? 10));

    const classe = await this.classeRepository.findById(cmd.classId);
    if (!classe || classe.schoolId !== cmd.schoolId) throw new Error('Classe introuvable');

    const school = await this.schoolRepository.findById(cmd.schoolId);
    const schoolName = school ? school.toObject().name : 'Établissement';
    const schoolCity = school ? (school.toObject().city ?? '') : '';

    const academicYear = await this.anneeAcademiqueRepository.findCourante(cmd.schoolId);
    if (!academicYear) throw new Error('Aucune année scolaire courante ou sans trimestres');

    const periods = await this.anneeAcademiqueRepository.findPeriodesByAnnee(academicYear.id);
    if (periods.length === 0) throw new Error('Aucune année scolaire courante ou sans trimestres');

    const lockedIds = await this.classCouncilRepository.listLockedPeriodIdsForClasse(cmd.classId, cmd.schoolId);
    const lockedSet = new Set(lockedIds);
    const allLocked = periods.every((p) => lockedSet.has(p.id));
    if (!allLocked) {
      const missingCount = periods.filter((p) => !lockedSet.has(p.id)).length;
      throw new Error(`${missingCount} conseil(s) de classe non encore verrouillé(s). Le tableau annuel n'est disponible qu'une fois tous les conseils clôturés.`);
    }

    const allRcs = await this.bulletinRepository.findForAnnual({
      classId: cmd.classId,
      schoolId: cmd.schoolId,
      periodIds: periods.map((p) => p.id),
    });

    const byStudent = new Map<string, { name: string; avgs: number[] }>();
    for (const rc of allRcs) {
      if (!byStudent.has(rc.studentId)) {
        byStudent.set(rc.studentId, { name: `${rc.student.lastName} ${rc.student.firstName}`, avgs: [] });
      }
      if (rc.generalAverage != null) byStudent.get(rc.studentId)!.avgs.push(rc.generalAverage);
    }

    const ranked = Array.from(byStudent.entries())
      .filter(([, d]) => d.avgs.length > 0)
      .map(([, d]) => ({ name: d.name, annualAvg: d.avgs.reduce((a, b) => a + b, 0) / d.avgs.length }))
      .sort((a, b) => b.annualAvg - a.annualAvg)
      .slice(0, top);

    if (ranked.length === 0) throw new Error('Aucun bulletin annuel disponible pour cette classe');

    return this.pdfService.genererTableauHonneurAnnuel({
      className: classe.name,
      yearName: academicYear.name,
      schoolName,
      schoolCity,
      ranked,
    });
  }
}
