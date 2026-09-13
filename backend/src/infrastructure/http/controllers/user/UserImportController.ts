import type { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import type { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type {
  ImportTargetType,
  ImportPreviewResponse,
  ImportValidateRequest,
  ImportValidateResponse,
  ImportConfirmRequest,
  ImportConfirmResponse,
} from '@application/user/dto/ImportUserDtos';
import { detecterColumnMapping, getTargetFieldsForType } from '@application/user/helpers/importColumnMapper';
import { normalizeRowKeys } from '@application/user/helpers/importColumnMapper';
import { validerLignesImport } from '@application/user/helpers/importRowValidator';
import { gererErreurUser } from './userAuthHelper';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';

export class UserImportController {
  constructor(
    private readonly importer: ImporterUtilisateursUseCase,
    private readonly importRepository: ImportUtilisateursRepository,
    private readonly activityLog?: ActivityLogPort,
  ) {}

  // POST /api/v2/users/import
  importUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role = req.body.role as string;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis (.xlsx ou .xls)' });
        return;
      }
      if (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'STAFF' && role !== 'PARENT' && role !== 'CLASSE') {
        res.status(400).json({ success: false, message: "role doit être 'STUDENT', 'TEACHER', 'STAFF', 'PARENT' ou 'CLASSE'" });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const rows = rowsJson.map((r) => ({
        nom: String(r.nom || '').trim(),
        prenom: String(r.prenom || '').trim(),
        email: String(r.email || '').trim(),
        telephone: String(r.telephone || '').trim(),
        matricule: String(r.matricule || '').trim(),
        dateNaissance: String(r.date_naissance || '').trim(),
        sexe: String(r.sexe ?? r.genre ?? r.sex ?? '').trim(),
        classe: String(r.classe || '').trim(),
        nomParent: String(r.nom_parent || '').trim(),
        prenomParent: String(r.prenom_parent || '').trim(),
        emailParent: String(r.email_parent || '').trim(),
        telephoneParent: String(r.telephone_parent || '').trim(),
        matieres: String(r.matieres || '').trim(),
        classePrincipale: String(r.classe_principale || '').trim(),
        pebs: String(r.pebs ?? r.PEBS ?? '').trim(),
        lv2: String(r.lv2 ?? r.LV2 ?? '').trim(),
      }));

      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'Aucune ligne trouvée dans le fichier' });
        return;
      }

      const resultat = await this.importer.execute(user.schoolId, role as 'STUDENT' | 'TEACHER' | 'STAFF' | 'PARENT' | 'CLASSE', rows);

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };

  // POST /api/v2/users/import/preview
  previewImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const targetType = req.body.targetType as ImportTargetType;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ success: false, message: 'Fichier requis (.xlsx ou .xls)' });
        return;
      }
      if (!targetType || !['STUDENT', 'TEACHER', 'STAFF', 'PARENT', 'CLASSE'].includes(targetType)) {
        res.status(400).json({ success: false, message: "targetType doit être 'STUDENT', 'TEACHER', 'STAFF', 'PARENT' ou 'CLASSE'" });
        return;
      }

      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      const headers = rowsJson.length > 0 ? Object.keys(rowsJson[0]) : [];
      const totalRows = rowsJson.length;

      const autoMapping = detecterColumnMapping(headers, targetType);
      const targetFields = getTargetFieldsForType(targetType);
      const sampleRows = rowsJson.slice(0, 5);

      const response: ImportPreviewResponse = {
        headers,
        autoMapping,
        targetFields,
        sampleRows,
        totalRows,
      };

      res.json({ success: true, data: response });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };

  // POST /api/v2/users/import/validate
  validateImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { targetType, rows, columnMapping } = req.body as ImportValidateRequest;

      if (!targetType || !['STUDENT', 'TEACHER', 'STAFF', 'PARENT', 'CLASSE'].includes(targetType)) {
        res.status(400).json({ success: false, message: "targetType doit être 'STUDENT', 'TEACHER', 'STAFF', 'PARENT' ou 'CLASSE'" });
        return;
      }
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ success: false, message: 'Aucune ligne à valider' });
        return;
      }

      const normalizedRows = columnMapping ? rows.map((r) => normalizeRowKeys(r, columnMapping)) : rows;

      const contexte = await this.importRepository.chargerContexteValidation(user.schoolId);
      const result = validerLignesImport(targetType, normalizedRows, contexte);

      const response: ImportValidateResponse = {
        total: result.total,
        validCount: result.validCount,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        validatedRows: result.validatedRows,
      };

      res.json({ success: true, data: result });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };

  // POST /api/v2/users/import/confirm
  confirmImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { targetType, confirmedRows, columnMapping } = req.body as ImportConfirmRequest;

      if (!targetType || !['STUDENT', 'TEACHER', 'STAFF', 'PARENT', 'CLASSE'].includes(targetType)) {
        res.status(400).json({ success: false, message: "targetType doit être 'STUDENT', 'TEACHER', 'STAFF', 'PARENT' ou 'CLASSE'" });
        return;
      }
      if (!confirmedRows || !Array.isArray(confirmedRows) || confirmedRows.length === 0) {
        res.status(400).json({ success: false, message: 'Aucune ligne à importer' });
        return;
      }

      const normalizedRows = columnMapping ? confirmedRows.map((r) => normalizeRowKeys(r, columnMapping)) : confirmedRows;

      const resultat = await this.importer.execute(user.schoolId, targetType, normalizedRows);

      void this.activityLog?.log({
        userId: user.userId,
        schoolId: user.schoolId,
        action: 'PEDAGOGY_STUDENT_IMPORT',
        details: `Importation confirmée de ${normalizedRows.length} enregistrements (${targetType})`,
      });

      res.json({ success: true, data: resultat });
    } catch (error) {
      gererErreurUser(error, res, next);
    }
  };
}
