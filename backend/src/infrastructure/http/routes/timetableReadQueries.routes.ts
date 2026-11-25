import { Router } from 'express';
import type { TimetableReadQueriesController } from '../controllers/TimetableReadQueriesController.ts';
import { requireAuth } from '../middlewares/auth.ts';

export function creerTimetableReadQueriesRoutes(controller: TimetableReadQueriesController): Router {
  const router = Router();

  router.get('/classes', requireAuth, controller.listClasses);
  router.get('/subjects', requireAuth, controller.listSubjects);
  router.get('/rooms', requireAuth, controller.listRooms);
  router.get('/student-groups', requireAuth, controller.listStudentGroups);
  router.get('/class-room-assignments', requireAuth, controller.listClassRoomAssignments);
  router.get('/academic-years', requireAuth, controller.listAcademicYears);
  router.get('/timetables', requireAuth, controller.listTimetables);

  return router;
}
