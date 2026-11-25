import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import type { Container } from '@infrastructure/config/container';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaElectifsQueryRepository } from '@infrastructure/persistence/prisma/PrismaElectifsQueryRepository';
import { AffecterMatieresALevelEleveUseCase } from '@application/student/AffecterMatieresALevelEleveUseCase';
import { PreremplirDepuisCombinaisonUseCase } from '@application/student/PreremplirDepuisCombinaisonUseCase';
import { GetElevesParMatiereALevelUseCase } from '@application/student/GetElevesParMatiereALevelUseCase';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { ElectifsLv2PebsController } from '@infrastructure/http/controllers/ElectifsLv2PebsController';
import { ElectifsALevelRosterController } from '@infrastructure/http/controllers/ElectifsALevelRosterController';
import { creerElectifsRoutes } from '@infrastructure/http/routes/electifs.routes';

export function registerElectifsRoutes(app: Application, p: typeof prisma = prisma, c: Container): void {
  const db = p ?? prisma;
  const electifsQueryRepository = new PrismaElectifsQueryRepository(db);
  const studentAffectationRepositoryForALevel = new PrismaStudentAffectationRepository(db);

  const affecterALevelUseCase = new AffecterMatieresALevelEleveUseCase(studentAffectationRepositoryForALevel);
  const preremplirALevelUseCase = new PreremplirDepuisCombinaisonUseCase(studentAffectationRepositoryForALevel);
  const getElevesALevelUseCase = new GetElevesParMatiereALevelUseCase(studentAffectationRepositoryForALevel);

  const lv2PebsController = new ElectifsLv2PebsController(
    c.lv2pebs.affecterLV2Eleve,
    c.lv2pebs.affecterLV2EnMasse,
    c.lv2pebs.affecterPEBSEleve,
    c.lv2pebs.affecterPEBSEnMasse,
    electifsQueryRepository,
    new AIActionAuditAdapter(db),
  );

  const aLevelRosterController = new ElectifsALevelRosterController(
    c.timetable.resoudreParticipantsSeance,
    affecterALevelUseCase,
    preremplirALevelUseCase,
    getElevesALevelUseCase,
    electifsQueryRepository,
  );

  app.use('/api/v2', creerElectifsRoutes(lv2PebsController, aLevelRosterController));
}
