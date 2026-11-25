/**
 * Bootstrap hexagonal — barrel composition root
 *
 * Délègue le câblage aux 5 composition roots par bounded context.
 * Seule mécanique de câblage déplacée, aucune logique métier.
 * ponytail: 1 seul caller `server.ts` -> `bootstrapHexagonal(app)`
 */
import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { registerGrade } from './bootstrap/grade';
import { registerUser } from './bootstrap/user';
import { registerFinance } from './bootstrap/finance';
import { registerAcademic } from './bootstrap/academic';
import { registerCore } from './bootstrap/core';
import { registerHr } from './bootstrap/hr';
import { registerInfra } from './bootstrap/infra';

export function bootstrapHexagonal(app: Application): void {
  const container = creerContainer();
  // Ordre conservé : grade -> user -> finance -> academic -> core -> hr -> infra (infra dernier = errorHandler + dev)
  registerGrade(app, prisma, container);
  registerUser(app, prisma, container);
  registerFinance(app, prisma, container);
  registerAcademic(app, prisma, container);
  registerCore(app, prisma, container);
  registerHr(app, prisma, container);
  registerInfra(app, prisma, container);
}
