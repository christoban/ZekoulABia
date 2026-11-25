import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { PdfService } from '@domain/ports/services/PdfService';

export interface GenererTableauHonneurCommande {
  classId: string;
  schoolId: string;
  academicPeriodId: string;
  top?: number;
}

export class GenererTableauHonneurUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly anneeAcademiqueRepository: AnneeAcademiqueRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly classCouncilRepository: ClassCouncilRepository,
    private readonly pdfService: PdfService,
  ) {}

  async execute(cmd: GenererTableauHonneurCommande): Promise<Buffer> {
    const top = Math.min(20, Math.max(1, cmd.top ?? 10));

    if (!cmd.academicPeriodId) throw new Error('periodId est requis');

    const classe = await this.classeRepository.findById(cmd.classId);
    if (!classe || classe.schoolId !== cmd.schoolId) throw new Error('Classe introuvable');

    const periode = await this.anneeAcademiqueRepository.findPeriodeById(cmd.academicPeriodId, cmd.schoolId);
    let periodName = '—';
    let yearName = '—';
    if (periode) {
      periodName = periode.name;
      const annee = await this.anneeAcademiqueRepository.findById(periode.academicYearId);
      if (annee) yearName = annee.name;
    }

    const school = await this.schoolRepository.findById(cmd.schoolId);
    const schoolName = school ? school.toObject().name : 'Établissement';
    const schoolCity = school ? (school.toObject().city ?? '') : '';

    // ClassCouncilRepository injected for symmetry (allLocked not required for trimester view)
    void this.classCouncilRepository;

    const reportCards = await this.bulletinRepository.findTableauHonneur({
      classId: cmd.classId,
      schoolId: cmd.schoolId,
      academicPeriodId: cmd.academicPeriodId,
      top,
    });

    if (reportCards.length === 0) {
      throw new Error('Aucun bulletin généré pour cette classe et cette période');
    }

    const mapped = reportCards.map((rc) => ({
      lastName: rc.student.lastName,
      firstName: rc.student.firstName,
      generalAverage: rc.generalAverage,
      mention: rc.mention,
    }));

    return this.pdfService.genererTableauHonneur({
      className: classe.name,
      periodName,
      yearName,
      schoolName,
      schoolCity,
      reportCards: mapped,
    });
  }
}
