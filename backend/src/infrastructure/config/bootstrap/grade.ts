import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { GradeController } from '@infrastructure/http/controllers/GradeController';
import { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { SequenceAbsenceController } from '@infrastructure/http/controllers/SequenceAbsenceController';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { TimetableAutoController } from '@infrastructure/http/controllers/TimetableAutoController';
import { TimetableSlotActionsController } from '@infrastructure/http/controllers/TimetableSlotActionsController';
import { ProposerEmploisDuTempsGlobalUseCase } from '@application/timetable/ProposerEmploisDuTempsGlobalUseCase';
import { AppliquerLotEmploiDuTempsUseCase } from '@application/timetable/AppliquerLotEmploiDuTempsUseCase';
import { PrismaTimetableGenerationRunRepository } from '@infrastructure/persistence/prisma/PrismaTimetableGenerationRunRepository';
import { PrismaTimetableGenerationTargetProvider } from '@infrastructure/persistence/prisma/PrismaTimetableGenerationTargetProvider';
import { PrismaTimetableSlotActionsRepository } from '@infrastructure/persistence/prisma/PrismaTimetableSlotActionsRepository';
import { creerGradeRoutes } from '@infrastructure/http/routes/grade.routes';
import { creerAttendanceRoutes } from '@infrastructure/http/routes/attendance.routes';
import { creerTimetableRoutes } from '@infrastructure/http/routes/timetable.routes';
import { creerTimetableSlotActionsRoutes } from '@infrastructure/http/routes/timetableSlotActions.routes';
import { creerTimetableAutoRoutes } from '@infrastructure/http/routes/timetableAuto.routes';

type Container = ReturnType<typeof creerContainer>;

export function registerGrade(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerGradeRoutes(app, _prisma, container);
}

export function registerGradeRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const gradeController = new GradeController(
    c.grade.saisirNote,
    c.grade.verrouillerNote,
    c.grade.verrouillerNotesEnMasse,
    c.grade.modifierNote,
    c.grade.draftEnMasse,
    c.grade.listerNotes,
    c.grade.listerNotesEnAttente,
    c.grade.statutParClasse,
    c.grade.calculerMoyenne,
    c.grade.importerNotesExcel,
    c.school.anneeRepository,
    c.school.classeRepository,
    c.school.matiereRepository,
    c.events.publisher,
  );

  const attendanceController = new AttendanceController(
    c.attendance.enregistrerPresence,
    c.attendance.presenceRepository,
    c.attendance.userRepository,
    c.attendance.parentRepository,
    c.school.matiereRepository,
    new AIActionAuditAdapter(p),
    c.attendance.rattachementRepository,
    c.attendance.schoolConfigRepository,
    c.carnetLiaison.repository,
    c.carnetLiaison.creerEntree,
  );

  const timetableGenerationRuns = new PrismaTimetableGenerationRunRepository(p);
  const timetableGenerationTargets = new PrismaTimetableGenerationTargetProvider(p);
  const timetableGenerationGlobal = new ProposerEmploisDuTempsGlobalUseCase(
    timetableGenerationTargets,
    timetableGenerationRuns,
    c.timetable.proposerEmploiDuTemps,
    c.timetable.genererSquelette,
  );
  const timetableApplyAll = new AppliquerLotEmploiDuTempsUseCase(
    c.timetable.timetableRepository,
    c.timetable.proposerEmploiDuTemps,
  );

  const timetableController = new TimetableController(
    c.timetable.creer,
     c.timetable.ajouterCreneau,
     c.timetable.modifierCreneau,
      c.timetable.supprimerCreneau,
      c.timetable.viderCreneaux,
      c.timetable.soumettre,

    c.timetable.publier,
    c.timetable.publierTous,
    c.timetable.rouvrir,
    c.timetable.demanderRattrapage,
    c.timetable.genererSeancesGroupe,
    c.timetable.proposerEmploiDuTemps,
     c.timetable.appliquerProposition,
     c.timetable.simulerEmploiDuTemps,
      c.events.publisher,
      timetableApplyAll,
      timetableGenerationGlobal,
      timetableGenerationRuns,
   );

  const timetableSlotActionsController = new TimetableSlotActionsController(
    c.timetable.genererSquelette,
    new PrismaTimetableSlotActionsRepository(p),
  );
  app.use('/api/v2/timetables', creerTimetableSlotActionsRoutes(timetableSlotActionsController));

  const timetableAutoController = new TimetableAutoController(
    c.timetable.timetableRepository,
    c.timetable.modifierCreneau,
  );
  app.use('/api/v2/timetables', creerTimetableAutoRoutes(timetableAutoController));

  const sequenceAbsenceController = new SequenceAbsenceController(
    c.attendance.saisirHeuresSequence,
    c.attendance.sequenceAbsenceRepository,
  );

  app.use('/api/v2/grades', creerGradeRoutes(gradeController));
  app.use('/api/v2/attendance', creerAttendanceRoutes(attendanceController, sequenceAbsenceController));
  app.use('/api/v2/timetables', creerTimetableRoutes(timetableController));
}
