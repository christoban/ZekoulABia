import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { PrismaStaffDirectoryQueryRepository } from '@infrastructure/persistence/prisma/PrismaStaffDirectoryQueryRepository';
import { PrismaStudentPortalQueryRepository } from '@infrastructure/persistence/prisma/PrismaStudentPortalQueryRepository';
import { PrismaTimetableReadQueryRepository } from '@infrastructure/persistence/prisma/PrismaTimetableReadQueryRepository';
import { StaffDirectoryQueriesController } from '@infrastructure/http/controllers/StaffDirectoryQueriesController';
import { StudentPortalQueriesController } from '@infrastructure/http/controllers/StudentPortalQueriesController';
import { TimetableReadQueriesController } from '@infrastructure/http/controllers/TimetableReadQueriesController';
import { creerStaffDirectoryQueriesRoutes } from '@infrastructure/http/routes/staffDirectoryQueries.routes';
import { creerStudentPortalQueriesRoutes } from '@infrastructure/http/routes/studentPortalQueries.routes';
import { creerTimetableReadQueriesRoutes } from '@infrastructure/http/routes/timetableReadQueries.routes';

type Container = ReturnType<typeof creerContainer>;

export function registerListsRoutes(
  app: Application,
  prismaParam: typeof prisma = prisma,
  container?: Container,
): void {
  const db = prismaParam ?? prisma;
  const c = container ?? (creerContainer() as Container);

  const staffDirectoryQueriesController = new StaffDirectoryQueriesController(
    new PrismaStaffDirectoryQueryRepository(db),
    c.fileStorage,
    c.parent.parentRepository,
  );
  const studentPortalQueriesController = new StudentPortalQueriesController(
    new PrismaStudentPortalQueryRepository(db),
    c.fileStorage,
  );
  const timetableReadQueriesController = new TimetableReadQueriesController(
    new PrismaTimetableReadQueryRepository(db),
  );

  app.use('/api/v2', creerStaffDirectoryQueriesRoutes(staffDirectoryQueriesController));
  app.use('/api/v2', creerStudentPortalQueriesRoutes(studentPortalQueriesController));
  app.use('/api/v2', creerTimetableReadQueriesRoutes(timetableReadQueriesController));
}
