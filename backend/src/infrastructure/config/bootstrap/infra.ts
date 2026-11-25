import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';
import { registerRegistrationsRoutes } from './registrations';
import { registerListsRoutes } from './lists';


type Container = ReturnType<typeof creerContainer>;

export function registerInfra(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerInfraRoutes(app, _prisma, container);
}

export function registerInfraRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  registerRegistrationsRoutes(app, p, c);
  registerListsRoutes(app, p, c);

  app.use(errorHandler);
}
