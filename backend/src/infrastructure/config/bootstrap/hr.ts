import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { HRController } from '@infrastructure/http/controllers/HRController';
import { HRSelfServiceController } from '@infrastructure/http/controllers/HRSelfServiceController';
import { StaffAttendanceController } from '@infrastructure/http/controllers/StaffAttendanceController';
import { AjouterEvenementCarriereUseCase } from '@application/hr/AjouterEvenementCarriereUseCase';
import { ListerEvenementsCarriereUseCase } from '@application/hr/ListerEvenementsCarriereUseCase';
import { CreerDemandeCongeUseCase } from '@application/hr/CreerDemandeCongeUseCase';
import { TraiterDemandeCongeUseCase } from '@application/hr/TraiterDemandeCongeUseCase';
import { ListerDemandesCongeUseCase } from '@application/hr/ListerDemandesCongeUseCase';
import { CreerOrdreMissionUseCase } from '@application/hr/CreerOrdreMissionUseCase';
import { TraiterCongeServiceAdapter } from '@infrastructure/services/hr/TraiterCongeServiceAdapter';
import { creerHrRoutes } from '@infrastructure/http/routes/hr.routes';
import { creerHrSelfServiceRoutes } from '@infrastructure/http/routes/hrSelfService.routes';
import { creerStaffAttendanceRoutes } from '@infrastructure/http/routes/staffAttendance.routes';
import { requireAuth, requireRole } from '../../http/middlewares/auth';


type Container = ReturnType<typeof creerContainer>;

export function registerHr(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerHrRoutes(app, _prisma, container);
}

export function registerHrRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  // ── Module RH (C.2) — extraction Congé → application/hr/
  const ajouterEvenementCarriereUseCase = new AjouterEvenementCarriereUseCase(
    c.hr.careerEventRepository,
    c.hr.userRepository,
  );
  const listerEvenementsCarriereUseCase = new ListerEvenementsCarriereUseCase(
    c.hr.careerEventRepository,
    c.hr.userRepository,
  );
  const creerDemandeCongeUseCase = new CreerDemandeCongeUseCase(
    c.hr.leaveRepository,
    c.hr.userRepository,
  );
  const traiterCongeService = new TraiterCongeServiceAdapter(c.hr.leaveRepository);
  const traiterDemandeCongeUseCase = new TraiterDemandeCongeUseCase(
    traiterCongeService,
    new AIActionAuditAdapter(p),
    c.hr.leaveRepository,
  );
  const listerDemandesCongeUseCase = new ListerDemandesCongeUseCase(
    c.hr.leaveRepository,
    c.hr.userRepository,
  );
  const creerOrdreMissionUseCase = new CreerOrdreMissionUseCase(
    c.hr.missionOrderRepository,
    c.hr.userRepository,
  );
  const hrController = new HRController(
    c.hr.userRepository,
    c.hr.schoolRepository,
    c.hr.sectionRepository,
    c.hr.staffProfileRepository,
    c.hr.leaveRepository,
    c.hr.employeeFileRepository,
    c.hr.careerEventRepository,
    c.hr.staffAttendanceRepository,
    c.hr.missionOrderRepository,
    new AIActionAuditAdapter(p),
    ajouterEvenementCarriereUseCase,
    listerEvenementsCarriereUseCase,
    creerDemandeCongeUseCase,
    traiterDemandeCongeUseCase,
    listerDemandesCongeUseCase,
    creerOrdreMissionUseCase,
  );
  app.use('/api/v2/hr', requireAuth, requireRole('ADMIN', 'STAFF'), creerHrRoutes(hrController));

  // ── Module RH — self-service employé (accès ADMIN/STAFF/TEACHER, scopé à soi-même) ──
  const hrSelfServiceController = new HRSelfServiceController(c.hr.employeeFileRepository, c.fileStorage);
  app.use('/api/v2/hr-self-service', creerHrSelfServiceRoutes(hrSelfServiceController));

  // ── V2.11 — Pointage présence enseignants (QR / GPS / manuel + RH requalification) ──
  const staffAttendanceController = new StaffAttendanceController(
    c.staffAttendance.pointerPresenceEnseignant,
    c.staffAttendance.staffAttendanceRepository,
    new AIActionAuditAdapter(p),
  );
  app.use('/api/v2/staff-attendance', creerStaffAttendanceRoutes(staffAttendanceController));


}
