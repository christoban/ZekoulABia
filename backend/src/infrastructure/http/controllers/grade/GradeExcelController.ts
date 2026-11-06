import type { Request, Response, NextFunction } from 'express';
import type { ImporterNotesExcelUseCase } from '@application/grade/ImporterNotesExcelUseCase';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import * as XLSX from 'xlsx';

export class GradeExcelController {
  constructor(
    private readonly importerNotesExcel: ImporterNotesExcelUseCase,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly matiereRepository: MatiereRepository,
  ) {}

  // GET /api/v2/grades/template?classId=&subjectId=&sequenceId=
  // ponytail: génération d'Excel depuis données brutes — pas de use case nécessaire.
  genererTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId } = req.query as Record<string, string>;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      const [classe, matiere, sequence] = await Promise.all([
        this.classeRepository.findById(classId),
        this.matiereRepository.findById(subjectId),
        this.anneeRepository.findSequenceById(sequenceId, user.schoolId),
      ]);

      // ponytail: la query studentProfile reste en Prisma — aucun repository ne couvre
      // les profils élèves par classe avec matricule + nom. À extraire si un Use Case
      // template ou un StudentProfileRepository.findByClasse est ajouté.
      const { prisma } = await import('@infrastructure/persistence/prisma/prisma.client');
      const students = await prisma.studentProfile.findMany({
        where: {
          user: { schoolId: user.schoolId },
          enrollmentsYearScoped: { some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } } },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { lastName: 'asc' } },
      });

      const wb = XLSX.utils.book_new();

      const headers = ['matricule', 'nom', 'prenom', 'note (/20)', 'observation'];
      const dataRows = students.map((s) => [
        s.matricule ?? '',
        s.user.lastName,
        s.user.firstName,
        '',
        '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Notes');

      const ws2 = XLSX.utils.aoa_to_sheet([
        [`Classe : ${classe?.name ?? classId}`],
        [`Matière : ${matiere?.name ?? subjectId}`],
        [`Séquence : ${sequence?.name ?? sequenceId}`],
        [''],
        ['Instructions :'],
        ['  • Remplissez la colonne "note (/20)" pour chaque élève (0 à 20)'],
        ['  • La colonne "observation" est optionnelle'],
        ['  • Ne modifiez pas le matricule, le nom ou le prénom'],
        ['  • Les lignes sans note seront ignorées à l\'import'],
        ['  • Les élèves sans matricule ne peuvent pas être importés'],
        ['  • Ne supprimez pas la première ligne (en-têtes)'],
      ]);
      ws2['!cols'] = [{ wch: 64 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const safeName = (s?: string) => (s ?? '').replace(/[^a-z0-9]/gi, '-');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="notes-${safeName(classe?.name)}-${safeName(matiere?.name)}.xlsx"`,
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/grades/import (multipart/form-data)
  importerDepuisExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, sequenceId } = req.body;

      if (!classId || !subjectId || !sequenceId) {
        res.status(400).json({ success: false, message: 'classId, subjectId et sequenceId sont requis' });
        return;
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier Excel requis (champ "file")' });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        res.status(400).json({ success: false, message: 'Le fichier est vide ou ne contient pas de données' });
        return;
      }

      const headers = rows[0].map((h) => h.toString().toLowerCase().trim());
      const matriculeIdx = headers.findIndex((h) => h.includes('matricule'));
      const noteIdx = headers.findIndex((h) => h.includes('note'));
      const obsIdx = headers.findIndex((h) => h.includes('observation'));

      if (matriculeIdx === -1 || noteIdx === -1) {
        res.status(400).json({
          success: false,
          message: 'Colonnes "matricule" et "note" introuvables — utilisez le template téléchargé',
        });
        return;
      }

      const sequence = await this.anneeRepository.findSequenceById(sequenceId, user.schoolId);
      if (!sequence) {
        res.status(400).json({ success: false, message: 'Séquence introuvable' });
        return;
      }
      const periode = await this.anneeRepository.findPeriodeById(sequence.academicPeriodId, user.schoolId);
      const academicYearId = periode?.academicYearId;

      const parsedRows: { matricule: string; value: number | null; observation: string; line: number }[] = [];
      const parseErrors: { line: number; matricule: string; error: string }[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const matricule = row[matriculeIdx]?.toString().trim() ?? '';
        const noteRaw = row[noteIdx];
        const observation = obsIdx >= 0 ? (row[obsIdx]?.toString().trim() ?? '') : '';

        if (!matricule && (noteRaw === '' || noteRaw === undefined || noteRaw === null)) continue;

        if (!matricule) {
          parseErrors.push({ line: i + 1, matricule: '', error: 'Matricule manquant' });
          continue;
        }

        if (noteRaw === '' || noteRaw === undefined || noteRaw === null) {
          parsedRows.push({ matricule, value: null, observation, line: i + 1 });
          continue;
        }

        const value = Number(noteRaw);
        if (isNaN(value) || value < 0 || value > 20) {
          parseErrors.push({ line: i + 1, matricule, error: `Note invalide : "${noteRaw}" (doit être entre 0 et 20)` });
          continue;
        }

        parsedRows.push({ matricule, value, observation, line: i + 1 });
      }

      const resultat = await this.importerNotesExcel.execute({
        schoolId: user.schoolId,
        userId: user.userId,
        userRole: user.role,
        classId,
        subjectId,
        sequenceId,
        academicYearId,
        rows: parsedRows,
      });

      res.json({
        success: true,
        imported: resultat.imported,
        updated: resultat.updated,
        errors: [...parseErrors, ...resultat.errors],
        total: parsedRows.length + parseErrors.length,
        skipped: resultat.skipped + parseErrors.length,
      });
    } catch (error) {
      next(error);
    }
  };
}
