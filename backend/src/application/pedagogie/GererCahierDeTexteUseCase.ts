import type { CahierDeTexteRepository, CahierDeTexteProps } from '@domain/ports/repositories/CahierDeTexteRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';
import { PedagogieForbiddenError, PedagogieValidationError } from './errors';
import type { VerifierPresenceAvantCahierDeTexte } from '@application/staffAttendance/VerifierPresenceAvantCahierDeTexte';

export interface CreerCahierDeTexteInput {
  schoolId: string;
  teacherId: string;
  role: string;
  classId: string;
  subjectId: string;
  chapitreId?: string;
  date?: string;
  contenuRealise?: string;
  contenuLibre?: string;
  devoirsDonnes?: string;
  academicYearId?: string;
}

export interface ListerCahierDeTexteInput {
  schoolId: string;
  userId: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  role: string;
  academicYearId?: string;
  since?: Date;
  limit?: string;
}

export class GererCahierDeTexteUseCase {
  constructor(
    private readonly cahierRepository: CahierDeTexteRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly rattachementRepository: RattachementEnseignantRepository,
    private readonly verifierPresence?: VerifierPresenceAvantCahierDeTexte,
  ) {}

  async creer(input: CreerCahierDeTexteInput): Promise<CahierDeTexteProps> {
    if (!input.classId || !input.subjectId || (!input.contenuRealise?.trim() && !input.contenuLibre?.trim())) {
      throw new PedagogieValidationError('classId, subjectId et au moins un contenu (contenuRealise ou contenuLibre) sont requis');
    }

    // V2.11 — Gate présence enseignant (scope TEACHER uniquement) avant saisie du cahier de textes.
    // Non bloquante : ne bloque que si un mode fiable (QR configuré non scanné) était disponible.
    if (input.role === 'TEACHER' && this.verifierPresence) {
      try {
        await this.verifierPresence.execute({
          teacherId: input.teacherId,
          schoolId: input.schoolId,
          now: input.date ? new Date(input.date) : undefined,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('poin')) {
          throw new PedagogieForbiddenError(err.message);
        }
        throw err;
      }
    }

    if (input.role === 'TEACHER') {
      const rattache = await this.rattachementRepository.estRattacheALaClasse(
        input.teacherId,
        input.classId,
        input.subjectId,
        { autoriserProfesseurPrincipal: false },
      );
      if (!rattache) {
        throw new PedagogieForbiddenError("Vous n'êtes pas assigné à l'enseignement de cette matière pour cette classe");
      }
    }

    const anneeId = input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id;
    if (!anneeId) {
      throw new PedagogieValidationError('Aucune année académique active');
    }

    return this.cahierRepository.create({
      schoolId: input.schoolId,
      teacherId: input.teacherId,
      classId: input.classId,
      subjectId: input.subjectId,
      academicYearId: anneeId,
      chapitreId: input.chapitreId ?? null,
      date: input.date ? new Date(input.date) : new Date(),
      contenuRealise: input.contenuRealise?.trim() ?? null,
      contenuLibre: input.contenuLibre?.trim() ?? null,
      devoirsDonnes: input.devoirsDonnes?.trim() ?? null,
    });
  }

  async lister(input: ListerCahierDeTexteInput): Promise<CahierDeTexteProps[]> {
    const anneeId = input.academicYearId ?? (await this.anneeRepository.findCourante(input.schoolId))?.id;

    return this.cahierRepository.findByFilters(input.schoolId, {
      academicYearId: anneeId,
      classId: input.classId,
      subjectId: input.subjectId,
      enseignantId: input.teacherId ?? (input.role === 'TEACHER' ? input.userId : undefined),
      since: input.since,
      take: input.limit ? parseInt(input.limit, 10) : 100,
      orderDate: 'desc',
    });
  }
}
