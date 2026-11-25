import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { GetMetricUseCase } from '@application/reporting/GetMetricUseCase';

export interface ListerElevesClasseCommande {
  classId: string;
  schoolId: string;
}

export interface EleveClasseDto {
  id: string;
  firstName: string;
  lastName: string;
  moyenne: number | null;
  tauxPresence: number;
  rang: number;
}

export class ListerElevesClasseUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly userRepository: UserRepository,
    private readonly noteRepository: NoteRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly getMetricUseCase?: GetMetricUseCase,
  ) {}

  async execute(cmd: ListerElevesClasseCommande): Promise<EleveClasseDto[]> {
    const classe = await this.classeRepository.findById(cmd.classId);
    if (!classe || classe.schoolId !== cmd.schoolId) {
      throw new Error('Classe introuvable');
    }

    const students = await this.userRepository.findByClass(cmd.schoolId, cmd.classId);
    if (students.length === 0) return [];

    const studentIds = students.map(s => s.id);

    const [grades, attendances] = await Promise.all([
      this.noteRepository.findValideesParClasseEtEleves(cmd.schoolId, cmd.classId, studentIds),
      this.presenceRepository.findByClasseEtEleves(cmd.classId, studentIds),
    ]);

    const gradesByStudent = new Map<string, { sequenceAverage: number | null; coefficient: number; isAbsentGrade: boolean }[]>();
    for (const g of grades) {
      if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, []);
      gradesByStudent.get(g.studentId)!.push(g);
    }

    const attByStudent = new Map<string, string[]>();
    for (const a of attendances) {
      if (!attByStudent.has(a.studentId)) attByStudent.set(a.studentId, []);
      attByStudent.get(a.studentId)!.push(a.status);
    }

    // Pilote MetricDefinition v1 : si GetMetricUseCase injecté, utiliser le moteur (cache + compute)
    if (this.getMetricUseCase) {
      const result = await Promise.all(
        students.map(async s => {
          const sg = gradesByStudent.get(s.id) ?? [];
          const [tauxRes, moyRes] = await Promise.all([
            this.getMetricUseCase!.execute({ key: 'taux_presence', dimensions: { schoolId: cmd.schoolId, classId: cmd.classId, studentId: s.id } }),
            sg.length > 0
              ? this.getMetricUseCase!.execute({ key: 'moyenne_generale', dimensions: { schoolId: cmd.schoolId, classId: cmd.classId, studentId: s.id } })
              : Promise.resolve<{ value: number; fromCache: boolean; computedAt: Date }>({ value: 0, fromCache: false, computedAt: new Date() }),
          ]);
          const moyenne = sg.length > 0 ? moyRes.value : null;
          return { id: s.id, firstName: s.firstName, lastName: s.lastName, moyenne, tauxPresence: tauxRes.value };
        }),
      );
      result.sort((a, b) => {
        if (a.moyenne === null && b.moyenne === null) return 0;
        if (a.moyenne === null) return 1;
        if (b.moyenne === null) return -1;
        return b.moyenne - a.moyenne;
      });
      return result.map((s, i) => ({ ...s, rang: i + 1 }));
    }

    const result = students.map(s => {
      const sg = gradesByStudent.get(s.id) ?? [];
      const moyenne = sg.length > 0
        ? calculateAverageScoreOn20(
            sg.map(g => ({ scoreOn20: g.sequenceAverage ?? 0, percentage: 0, coefficient: g.coefficient ?? 1, isAbsentGrade: g.isAbsentGrade })),
            true,
            true,
          )
        : null;

      const att = attByStudent.get(s.id) ?? [];
      const presents = att.filter(a => a === 'PRESENT' || a === 'LATE').length;
      const tauxPresence = att.length > 0 ? Math.round((presents / att.length) * 100) : 100;

      return { id: s.id, firstName: s.firstName, lastName: s.lastName, moyenne, tauxPresence };
    });

    result.sort((a, b) => {
      if (a.moyenne === null && b.moyenne === null) return 0;
      if (a.moyenne === null) return 1;
      if (b.moyenne === null) return -1;
      return b.moyenne - a.moyenne;
    });

    return result.map((s, i) => ({ ...s, rang: i + 1 }));
  }
}
