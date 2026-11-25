import { Note } from '@domain/entities/Note';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { MatriculeImportRepository } from '@domain/ports/repositories/MatriculeImportRepository';
import type { RattachementEnseignantRepository } from '@domain/ports/repositories/RattachementEnseignantRepository';

export interface ExcelRow {
  matricule: string;
  value: number | null;
  observation?: string;
  line: number;
}

export interface ImporterNotesExcelCommande {
  schoolId: string;
  userId: string;
  userRole: string;
  classId: string;
  subjectId: string;
  sequenceId: string;
  academicYearId: string;
  rows: ExcelRow[];
}

export interface ImportError {
  line: number;
  matricule: string;
  error: string;
}

export interface ImporterNotesExcelResultat {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  errors: ImportError[];
}

export class ImporterNotesExcelUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly matriculeRepository: MatriculeImportRepository,
    private readonly rattachementRepository: RattachementEnseignantRepository,
  ) {}

  async execute(commande: ImporterNotesExcelCommande): Promise<ImporterNotesExcelResultat> {
    if (commande.userRole === 'TEACHER') {
      const rattache = await this.rattachementRepository.estRattacheALaClasse(
        commande.userId,
        commande.classId,
        commande.subjectId,
        { autoriserProfesseurPrincipal: false },
      );
      if (!rattache) {
        throw new Error("L'enseignant n'est pas assigné à l'enseignement de cette matière pour cette classe");
      }
    }

    const matiere = await this.matiereRepository.findById(commande.subjectId);
    const coefficient = matiere?.coefficient ?? 1;

    const uniqueMatricules = [...new Set(
      commande.rows
        .map(r => r.matricule.trim())
        .filter(m => m.length > 0),
    )];

    const resolved = await this.matriculeRepository.findByMatricules(
      commande.schoolId,
      uniqueMatricules,
      commande.classId,
    );
    const matriculeToUserId = new Map(resolved.map(r => [r.matricule, r.userId]));

    const existingGrades = await this.noteRepository.findByClasse(
      commande.classId,
      commande.sequenceId,
    );
    const gradesByStudentId = new Map(
      existingGrades
        .filter(n => n.subjectId === commande.subjectId)
        .map(n => [n.studentId, n]),
    );

    const errors: ImportError[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of commande.rows) {
      const matricule = row.matricule.trim();

      if (!matricule) {
        skipped++;
        continue;
      }

      if (row.value === null || row.value === undefined) {
        skipped++;
        continue;
      }

      if (row.value < 0 || row.value > 20) {
        errors.push({ line: row.line, matricule, error: `Note invalide : ${row.value} (doit être entre 0 et 20)` });
        continue;
      }

      const studentUserId = matriculeToUserId.get(matricule);
      if (!studentUserId) {
        errors.push({ line: row.line, matricule, error: 'Élève introuvable pour ce matricule dans la classe' });
        continue;
      }

      const noteExistante = gradesByStudentId.get(studentUserId);

      if (noteExistante) {
        if (!noteExistante.peutEtreModifiee()) {
          errors.push({
            line: row.line,
            matricule,
            error: `Note existante non modifiable (statut : ${noteExistante.validationStatus})`,
          });
          continue;
        }
        noteExistante.definirScore(row.value);
        await this.noteRepository.update(noteExistante);
        updated++;
      } else {
        const note = Note.create({
          schoolId: commande.schoolId,
          studentId: studentUserId,
          subjectId: commande.subjectId,
          classId: commande.classId,
          academicYearId: commande.academicYearId,
          sequenceId: commande.sequenceId,
          recordedById: commande.userId,
          sequenceScore: row.value,
          coefficient,
        });
        await this.noteRepository.save(note);
        imported++;
      }
    }

    return {
      imported,
      updated,
      skipped,
      total: commande.rows.length,
      errors,
    };
  }
}
