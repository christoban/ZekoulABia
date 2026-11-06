/**
 * INFRASTRUCTURE LAYER — Configuration Express
 * Branche le container hexagonal sur les routes Express.
 */
import express, { type Application } from 'express';
import { creerContainer } from '@infrastructure/config/container';
import { GradeController } from '@infrastructure/http/controllers/GradeController';
import { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerGradeRoutes } from '@infrastructure/http/routes/grade.routes';
import { creerAttendanceRoutes } from '@infrastructure/http/routes/attendance.routes';
import { creerOnboardingRoutes } from '@infrastructure/http/routes/onboarding.routes';
import { creerReportCardRoutes } from '@infrastructure/http/routes/reportCard.routes';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';

export function creerApp(): Application {
  const app = express();
  app.use(express.json());

  const container = creerContainer();

  const gradeController = new GradeController(
    container.grade.saisirNote,
    container.grade.verrouillerNote,
    container.grade.verrouillerNotesEnMasse,
    container.grade.modifierNote,
    container.grade.draftEnMasse,
    container.grade.listerNotes,
    container.grade.listerNotesEnAttente,
    container.grade.statutParClasse,
    container.grade.calculerMoyenne,
    container.grade.importerNotesExcel,
    container.school.anneeRepository,
    container.school.classeRepository,
    container.school.matiereRepository,
    container.events.publisher,
  );

  const attendanceController = new AttendanceController(
    container.attendance.enregistrerPresence,
    container.attendance.presenceRepository,
    container.attendance.userRepository,
    container.attendance.parentRepository,
    container.school.matiereRepository,
    new AIActionAuditAdapter(prisma),
  );

  const onboardingController = new SchoolOnboardingController(
    container.school.onboarder,
    container.school.approuver,
  );

  const reportCardController = new ReportCardController(
    container.reportCard.generer,
    container.reportCard.envoyer,
    new GroqIAService(),
    container.school.schoolRepository,
    container.school.classeRepository,
    container.school.anneeRepository,
    container.school.sectionRepository,
    container.reportCard.bulletinRepository,
    container.reportCard.parentRepository,
    new AIActionAuditAdapter(prisma),
  );

  app.use('/api/v2/grades', creerGradeRoutes(gradeController));
  app.use('/api/v2/attendance', creerAttendanceRoutes(attendanceController));
  app.use('/api/v2/onboarding', creerOnboardingRoutes(onboardingController));
  app.use('/api/v2/report-cards', creerReportCardRoutes(reportCardController));

  app.use(errorHandler);

  return app;
}
