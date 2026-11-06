import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { StaffProfileRepository } from '@domain/ports/repositories/StaffProfileRepository';
import type { LeaveRepository } from '@domain/ports/repositories/LeaveRepository';
import type { EmployeeFileData, EmployeeFileRepository } from '@domain/ports/repositories/EmployeeFileRepository';
import type { AuthPayload } from '../middlewares/auth';
import type { CareerEventRepository } from '@domain/ports/repositories/CareerEventRepository';
import type { StaffAttendanceRepository } from '@domain/ports/repositories/StaffAttendanceRepository';
import type { MissionOrderRepository } from '@domain/ports/repositories/MissionOrderRepository';
import type { AjouterEvenementCarriereUseCase } from '@application/hr/AjouterEvenementCarriereUseCase';
import type { ListerEvenementsCarriereUseCase } from '@application/hr/ListerEvenementsCarriereUseCase';
import type { CreerDemandeCongeUseCase } from '@application/hr/CreerDemandeCongeUseCase';
import type { TraiterDemandeCongeUseCase } from '@application/hr/TraiterDemandeCongeUseCase';
import type { ListerDemandesCongeUseCase } from '@application/hr/ListerDemandesCongeUseCase';
import type { CreerOrdreMissionUseCase } from '@application/hr/CreerOrdreMissionUseCase';
import ExcelJS from 'exceljs';
import {
  generateAttestationTravailPdf,
  generateCertificatTravailPdf,
  generateMissionOrderPdf,
} from '../../pdf/hr/HrDocumentPdfRenderer';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';

type LeaveStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

function normalizeDateInput(value?: string | null): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeDateKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatEmployeeName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export class HRController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly staffProfileRepository: StaffProfileRepository,
    private readonly leaveRepository: LeaveRepository,
    private readonly employeeFileRepository: EmployeeFileRepository,
    private readonly careerEventRepository: CareerEventRepository,
    private readonly staffAttendanceRepository: StaffAttendanceRepository,
    private readonly missionOrderRepository: MissionOrderRepository,
    private readonly audit: AIActionAuditPort,
    private readonly ajouterEvenementCarriereUseCase: AjouterEvenementCarriereUseCase,
    private readonly listerEvenementsCarriereUseCase: ListerEvenementsCarriereUseCase,
    private readonly creerDemandeCongeUseCase: CreerDemandeCongeUseCase,
    private readonly traiterDemandeCongeUseCase: TraiterDemandeCongeUseCase,
    private readonly listerDemandesCongeUseCase: ListerDemandesCongeUseCase,
    private readonly creerOrdreMissionUseCase: CreerOrdreMissionUseCase,
  ) {}

  private getSchoolId(req: Request): string {
    return req.user?.schoolId;
  }

  private getCurrentUser(req: Request): AuthPayload | undefined {
    return req.user;
  }

  private async loadEmployeeOrFail(userId: string, schoolId: string) {
    return this.userRepository.findEmployeeById(userId, schoolId);
  }

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

  private async fetchEmployeeFile(userId: string) {
    return this.employeeFileRepository.findByUser(userId);
  }

  private async getCurrentLeaveBalance(userId: string, schoolId: string) {
    const year = new Date().getFullYear();
    const balance = await this.leaveRepository.findBalanceForYear(userId, year);
    if (balance) return balance;

    const fallback = await this.leaveRepository.findLatestBalance(userId, schoolId);
    if (fallback) return fallback;

    return this.leaveRepository.createBalance({ userId, schoolId, annee: year });
  }

  private async sendPdf(res: Response, filename: string, buffer: Buffer): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  listEmployees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const users = await this.userRepository.findEmployees(schoolId);
      const files = await this.employeeFileRepository.findManyByUserIds(users.map((employee) => employee.id));
      const fileByUserId = new Map<string, EmployeeFileData>(files.map((file) => [file.userId, file]));

      res.json({
        success: true,
        data: users.map((employee) => ({
          ...employee,
          fullName: formatEmployeeName(employee),
          file: fileByUserId.get(employee.id) ?? null,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  exportListeNominaleMinesec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
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

  getEmployee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const [file, careerEvents, leaveRequests, leaveBalance] = await Promise.all([
        this.fetchEmployeeFile(employeeId),
        this.careerEventRepository.findByUserOrdered(employeeId, schoolId),
        this.leaveRepository.findRequestsBySchool(schoolId, employeeId),
        this.getCurrentLeaveBalance(employeeId, schoolId),
      ]);

      res.json({
        success: true,
        data: {
          employee: { ...employee, fullName: formatEmployeeName(employee) },
          file,
          careerEvents,
          leaveRequests,
          leaveBalance,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getEmployeeFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const file = await this.fetchEmployeeFile(employeeId);
      res.json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  };

  saveEmployeeFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);
      const body = req.body as {
        dateNaissance?: string | null;
        diplomes?: unknown;
        numeroCNPS?: string | null;
        typeContrat?: string | null;
        dateEmbauche?: string | null;
        echelonActuel?: string | null;
      };

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const existing = await this.fetchEmployeeFile(employeeId);
      const data = {
        id: existing?.id ?? '',
        userId: employeeId,
        schoolId,
        dateNaissance: body.dateNaissance ? normalizeDateInput(body.dateNaissance) : null,
        gender: null,
        diplomes: body.diplomes ?? [],
        numeroCNPS: body.numeroCNPS?.trim() || null,
        typeContrat: body.typeContrat?.trim() || null,
        dateEmbauche: body.dateEmbauche ? normalizeDateInput(body.dateEmbauche) : null,
        echelonActuel: body.echelonActuel?.trim() || null,
        documentsUrls: [],
        selfServiceCompletedAt: null,
        remindersSentCount: 0,
        lastReminderAt: null,
        escalatedAt: null,
      };
      const file = await this.employeeFileRepository.save(data);

      res.status(existing ? 200 : 201).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  };

  addCareerEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);
      const body = req.body as { type?: string; date?: string; observation?: string };

      const result = await this.ajouterEvenementCarriereUseCase.execute({
        schoolId,
        demandeurId: this.getCurrentUser(req)?.userId ?? '',
        userId: employeeId,
        type: body.type ?? '',
        date: body.date ? normalizeDateInput(body.date) : (new Date('') as unknown as Date),
        observation: body.observation,
      });
      res.status(201).json({ success: true, data: result.event });
    } catch (error) {
      this.gererErreurHR(error, res, next);
    }
  };

  listCareerEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);

      const result = await this.listerEvenementsCarriereUseCase.execute({
        schoolId,
        demandeurId: this.getCurrentUser(req)?.userId ?? '',
        userId: employeeId,
      });
      res.json({ success: true, data: result.events });
    } catch (error) {
      this.gererErreurHR(error, res, next);
    }
  };

  private gererErreurHR(error: unknown, res: Response, next: NextFunction): void {
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

  recordAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const body = req.body as { date?: string; attendances?: Array<{ userId: string; statut: string; note?: string | null }> };

      if (!body.date || !Array.isArray(body.attendances) || body.attendances.length === 0) {
        res.status(400).json({ success: false, message: 'date et attendances sont requis' });
        return;
      }

      const date = normalizeDateInput(body.date);
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      const results = await Promise.all(body.attendances.map(async (entry) => {
        const employee = await this.loadEmployeeOrFail(entry.userId, schoolId);
        if (!employee) return null;

        return this.staffAttendanceRepository.upsert({
          userId: entry.userId,
          schoolId,
          date: normalizedDate,
          statut: entry.statut,
          note: entry.note?.trim() || null,
        });
      }));

      res.status(201).json({
        success: true,
        data: results.filter(Boolean),
        meta: { recordedBy: currentUser?.userId ?? null, date: normalizedDate.toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  listAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const { date, userId } = req.query as Record<string, string>;

      const normalizedDate = normalizeDateKey(date) ?? new Date().toISOString().slice(0, 10);
      const start = new Date(`${normalizedDate}T00:00:00.000Z`);
      const end = new Date(`${normalizedDate}T23:59:59.999Z`);

      const records = await this.staffAttendanceRepository.findBySchool(schoolId, { userId, debut: start, fin: end });

      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  };

  createLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const body = req.body as { userId?: string; type?: string; dateDebut?: string; dateFin?: string; motif?: string };

      const result = await this.creerDemandeCongeUseCase.execute({
        schoolId,
        demandeurId: currentUser?.userId ?? '',
        demandeurRole: currentUser?.role,
        userId: body.userId ?? '',
        type: body.type ?? '',
        dateDebut: body.dateDebut ? normalizeDateInput(body.dateDebut) : (new Date('') as unknown as Date),
        dateFin: body.dateFin ? normalizeDateInput(body.dateFin) : (new Date('') as unknown as Date),
        motif: body.motif,
      });
      res.status(201).json({ success: true, data: result.leaveRequest });
    } catch (error) {
      this.gererErreurHR(error, res, next);
    }
  };

  updateLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const { id } = req.params;
      const body = req.body as { statut?: LeaveStatusValue };

      const result = await this.traiterDemandeCongeUseCase.execute({
        schoolId,
        demandeurId: currentUser?.userId ?? '',
        demandeurRole: currentUser?.role,
        leaveRequestId: String(id),
        statut: (body.statut ?? '') as 'APPROVED' | 'REJECTED',
      });
      res.json({ success: true, data: result.leaveRequest });
    } catch (error) {
      this.gererErreurHR(error, res, next);
    }
  };

  listLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const { userId } = req.query as Record<string, string>;
      const currentUser = this.getCurrentUser(req);

      const result = await this.listerDemandesCongeUseCase.lister({
        schoolId,
        demandeurId: currentUser?.userId ?? '',
        demandeurRole: currentUser?.role,
        filtreUserId: userId,
      });
      res.json({ success: true, data: result.leaveRequests });
    } catch (error) {
      next(error);
    }
  };

  getLeaveBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const userId = String(req.params.userId);

      const result = await this.listerDemandesCongeUseCase.obtenirSolde({
        schoolId,
        demandeurId: this.getCurrentUser(req)?.userId ?? '',
        userId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      this.gererErreurHR(error, res, next);
    }
  };

  getAttestationTravail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const file = await this.fetchEmployeeFile(employeeId);
      const sectionCode = await this.getEmployeeSectionCode(employeeId);
      const lang = resolveLanguage(employee.school?.subsystem ?? 'FRANCOPHONE', sectionCode);
      const roleLabelEn = employee.role === 'TEACHER' ? 'teacher' : 'staff member';
      const pdf = await generateAttestationTravailPdf({
        schoolName: employee.school?.name ?? '',
        employeeName: formatEmployeeName(employee),
        roleLabel: employee.role === 'TEACHER' ? 'enseignant(e)' : 'membre du personnel',
        roleLabelEn,
        dateEmbauche: file?.dateEmbauche ?? null,
        dateNaissance: file?.dateNaissance ?? null,
        numeroCNPS: file?.numeroCNPS ?? null,
        typeContrat: file?.typeContrat ?? null,
        echelonActuel: file?.echelonActuel ?? null,
        signataire: null,
        language: lang,
      });

      await this.sendPdf(res, `attestation-travail-${slugify(formatEmployeeName(employee))}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };

  getCertificatTravail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const file = await this.fetchEmployeeFile(employeeId);
      const sectionCode = await this.getEmployeeSectionCode(employeeId);
      const lang = resolveLanguage(employee.school?.subsystem ?? 'FRANCOPHONE', sectionCode);
      const roleLabelEn = employee.role === 'TEACHER' ? 'teacher' : 'staff member';
      const pdf = await generateCertificatTravailPdf({
        schoolName: employee.school?.name ?? '',
        employeeName: formatEmployeeName(employee),
        roleLabel: employee.role === 'TEACHER' ? 'enseignant(e)' : 'membre du personnel',
        roleLabelEn,
        dateEmbauche: file?.dateEmbauche ?? null,
        dateNaissance: file?.dateNaissance ?? null,
        numeroCNPS: file?.numeroCNPS ?? null,
        typeContrat: file?.typeContrat ?? null,
        echelonActuel: file?.echelonActuel ?? null,
        signataire: null,
        language: lang,
      });

      await this.sendPdf(res, `certificat-travail-${slugify(formatEmployeeName(employee))}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };

  createMissionOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const body = req.body as { userId?: string; motif?: string; lieu?: string; dateDebut?: string; dateFin?: string; signataire?: string };

      const result = await this.creerOrdreMissionUseCase.execute({
        schoolId,
        demandeurId: this.getCurrentUser(req)?.userId ?? '',
        userId: body.userId ?? '',
        motif: body.motif ?? '',
        lieu: body.lieu ?? '',
        dateDebut: body.dateDebut ? normalizeDateInput(body.dateDebut) : (new Date('') as unknown as Date),
        dateFin: body.dateFin ? normalizeDateInput(body.dateFin) : (new Date('') as unknown as Date),
        signataire: body.signataire,
      });
      res.status(201).json({ success: true, data: result.missionOrder });
    } catch (error) {
      this.gererErreurHR(error, res, next);
    }
  };

  getMissionOrderPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const missionId = String(req.params.id);

      const missionOrder = await this.missionOrderRepository.findByIdAndSchool(missionId, schoolId);

      if (!missionOrder) {
        res.status(404).json({ success: false, message: 'Ordre de mission introuvable' });
        return;
      }

      const employee = await this.loadEmployeeOrFail(missionOrder.userId, schoolId);
      const sectionCode = await this.getEmployeeSectionCode(missionOrder.userId);
      const lang = resolveLanguage(employee?.school?.subsystem ?? 'FRANCOPHONE', sectionCode);
      const pdf = await generateMissionOrderPdf({
        schoolName: employee?.school?.name ?? '',
        employeeName: employee ? formatEmployeeName(employee) : missionOrder.userId,
        motif: missionOrder.motif,
        lieu: missionOrder.lieu,
        dateDebut: missionOrder.dateDebut,
        dateFin: missionOrder.dateFin,
        signataire: missionOrder.signataire ?? null,
        language: lang,
      });

      await this.sendPdf(res, `ordre-mission-${slugify(employee ? formatEmployeeName(employee) : missionOrder.userId)}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };
}
