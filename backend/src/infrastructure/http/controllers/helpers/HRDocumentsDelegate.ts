import type { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { StaffProfileRepository } from '@domain/ports/repositories/StaffProfileRepository';
import type { EmployeeFileData, EmployeeFileRepository } from '@domain/ports/repositories/EmployeeFileRepository';
import type { MissionOrderRepository } from '@domain/ports/repositories/MissionOrderRepository';
import type { CreerOrdreMissionUseCase } from '@application/hr/CreerOrdreMissionUseCase';
import {
  generateAttestationTravailPdf,
  generateCertificatTravailPdf,
  generateMissionOrderPdf,
  type AttestationTravailInput,
} from '@infrastructure/pdf/hr/HrDocumentPdfRenderer';
import { resolveLanguage } from '@domain/policies/LanguagePolicy';

export type LeaveStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

export function normalizeDateInput(value?: string | null): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function normalizeDateKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatEmployeeName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function gererErreurHR(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof Error) {
    if (error.message.includes('introuvable')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('requis')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (
      error.message.includes('Permission') ||
      error.message.includes('Auto-approbation') ||
      error.message.includes('non autorisé') ||
      error.message.includes('seulement')
    ) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('déjà été traitée')) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
  }
  next(error as Error);
}

/** Délégué spécialisé : exports MINESEC, attestations/certificats PDF et ordres de mission RH. */
export class HRDocumentsDelegate {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly staffProfileRepository: StaffProfileRepository,
    private readonly employeeFileRepository: EmployeeFileRepository,
    private readonly missionOrderRepository: MissionOrderRepository,
    private readonly creerOrdreMissionUseCase: CreerOrdreMissionUseCase,
  ) {}

  private async getEmployeeSectionCode(userId: string): Promise<string | null> {
    try {
      const sectionId = await this.staffProfileRepository.findSectionIdByUserId(userId);
      if (!sectionId) return null;
      const section = await this.sectionRepository.findById(sectionId);
      return section?.code ?? null;
    } catch {
      return null;
    }
  }

  private sendPdf(res: Response, filename: string, buffer: Buffer): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  private async sendEmploymentCertificatePdf(
    req: Request,
    res: Response,
    kind: 'attestation' | 'certificat',
  ): Promise<void> {
    const schoolId = req.user?.schoolId;
    const employeeId = String(req.params.id);

    const employee = await this.userRepository.findEmployeeById(employeeId, schoolId);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employé introuvable' });
      return;
    }

    const file = await this.employeeFileRepository.findByUser(employeeId);
    const sectionCode = await this.getEmployeeSectionCode(employeeId);
    const lang = resolveLanguage(employee.school?.subsystem ?? 'FRANCOPHONE', sectionCode);
    const employeeName = formatEmployeeName(employee);
    const payload: AttestationTravailInput = {
      schoolName: employee.school?.name ?? '',
      employeeName,
      roleLabel: employee.role === 'TEACHER' ? 'enseignant(e)' : 'membre du personnel',
      roleLabelEn: employee.role === 'TEACHER' ? 'teacher' : 'staff member',
      dateEmbauche: file?.dateEmbauche ?? null,
      dateNaissance: file?.dateNaissance ?? null,
      numeroCNPS: file?.numeroCNPS ?? null,
      typeContrat: file?.typeContrat ?? null,
      echelonActuel: file?.echelonActuel ?? null,
      signataire: null,
      language: lang,
    };

    const pdf = kind === 'attestation'
      ? await generateAttestationTravailPdf(payload)
      : await generateCertificatTravailPdf(payload);
    const prefix = kind === 'attestation' ? 'attestation-travail' : 'certificat-travail';
    this.sendPdf(res, `${prefix}-${slugify(employeeName)}.pdf`, pdf);
  }

  exportListeNominaleMinesec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user?.schoolId;
      const school = await this.schoolRepository.findById(schoolId);

      const users = await this.userRepository.findEmployees(schoolId, true);
      const files = await this.employeeFileRepository.findManyByUserIds(users.map((u) => u.id));
      const fileByUserId = new Map<string, EmployeeFileData>(files.map((f) => [f.userId, f]));

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Liste nominale');
      sheet.columns = [
        { header: 'N°', key: 'index', width: 5 },
        { header: 'Nom', key: 'lastName', width: 20 },
        { header: 'Prénom', key: 'firstName', width: 20 },
        { header: 'Fonction', key: 'fonction', width: 25 },
        { header: 'N° CNPS', key: 'numeroCNPS', width: 18 },
        { header: 'Date de prise de service', key: 'dateEmbauche', width: 22 },
        { header: 'Statut', key: 'statut', width: 15 },
      ];
      sheet.getRow(1).font = { bold: true };

      users.forEach((employee, idx) => {
        const file = fileByUserId.get(employee.id);
        sheet.addRow({
          index: idx + 1,
          lastName: employee.lastName,
          firstName: employee.firstName,
          fonction: employee.staffProfile?.title
            || (employee.role === 'TEACHER'
              ? (employee.teacherProfile?.specialization?.length ? employee.teacherProfile.specialization.join(', ') : 'Enseignant')
              : 'Personnel'),
          numeroCNPS: file?.numeroCNPS ?? '',
          dateEmbauche: file?.dateEmbauche ? new Date(file.dateEmbauche).toLocaleDateString('fr-FR') : '',
          statut: 'En service',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `liste-nominale-minesec-${slugify(school?.name ?? schoolId)}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  };

  getAttestationTravail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.sendEmploymentCertificatePdf(req, res, 'attestation');
    } catch (error) {
      next(error);
    }
  };

  getCertificatTravail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.sendEmploymentCertificatePdf(req, res, 'certificat');
    } catch (error) {
      next(error);
    }
  };

  createMissionOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user?.schoolId;
      const body = req.body as { userId?: string; motif?: string; lieu?: string; dateDebut?: string; dateFin?: string; signataire?: string };

      const result = await this.creerOrdreMissionUseCase.execute({
        schoolId,
        demandeurId: req.user?.userId ?? '',
        userId: body.userId ?? '',
        motif: body.motif ?? '',
        lieu: body.lieu ?? '',
        dateDebut: body.dateDebut ? normalizeDateInput(body.dateDebut) : (new Date('') as unknown as Date),
        dateFin: body.dateFin ? normalizeDateInput(body.dateFin) : (new Date('') as unknown as Date),
        signataire: body.signataire,
      });
      res.status(201).json({ success: true, data: result.missionOrder });
    } catch (error) {
      gererErreurHR(error, res, next);
    }
  };

  getMissionOrderPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user?.schoolId;
      const missionId = String(req.params.id);

      const missionOrder = await this.missionOrderRepository.findByIdAndSchool(missionId, schoolId);
      if (!missionOrder) {
        res.status(404).json({ success: false, message: 'Ordre de mission introuvable' });
        return;
      }

      const employee = await this.userRepository.findEmployeeById(missionOrder.userId, schoolId);
      const sectionCode = await this.getEmployeeSectionCode(missionOrder.userId);
      const lang = resolveLanguage(employee?.school?.subsystem ?? 'FRANCOPHONE', sectionCode);
      const employeeName = employee ? formatEmployeeName(employee) : missionOrder.userId;
      const pdf = await generateMissionOrderPdf({
        schoolName: employee?.school?.name ?? '',
        employeeName,
        motif: missionOrder.motif,
        lieu: missionOrder.lieu,
        dateDebut: missionOrder.dateDebut,
        dateFin: missionOrder.dateFin,
        signataire: missionOrder.signataire ?? null,
        language: lang,
      });

      this.sendPdf(res, `ordre-mission-${slugify(employeeName)}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };
}
