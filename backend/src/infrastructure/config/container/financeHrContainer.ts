import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaPlanFraisRepository } from '@infrastructure/persistence/prisma/PrismaPlanFraisRepository';
import { PrismaPaiementRepository } from '@infrastructure/persistence/prisma/PrismaPaiementRepository';
import { PrismaDepenseRepository } from '@infrastructure/persistence/prisma/PrismaDepenseRepository';
import { CampayPaiementService } from '@infrastructure/services/payment/CampayPaiementService';
import { ReceiptPdfRenderer } from '@infrastructure/pdf/finance/ReceiptPdfRenderer';
import { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import { ModifierPlanFraisUseCase } from '@application/finance/ModifierPlanFraisUseCase';
import { ChangerStatutPlanFraisUseCase } from '@application/finance/ChangerStatutPlanFraisUseCase';
import { CopierPlansFraisAnneePrecedenteUseCase } from '@application/finance/CopierPlansFraisAnneePrecedenteUseCase';
import { GenererFactureUseCase } from '@application/finance/GenererFactureUseCase';
import { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';
import { RembourserCautionUseCase } from '@application/finance/RembourserCautionUseCase';
import { EnregistrerDepenseUseCase } from '@application/finance/EnregistrerDepenseUseCase';
import { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import { VerifierStatutPaiementUseCase } from '@application/finance/VerifierStatutPaiementUseCase';
import { ConfigurerEcheancierFactureUseCase } from '@application/finance/ConfigurerEcheancierFactureUseCase';
import { AppliquerRemiseEleveUseCase } from '@application/finance/AppliquerRemiseEleveUseCase';
import { AnnulerPaiementUseCase } from '@application/finance/AnnulerPaiementUseCase';
import { CloturerCaisseUseCase } from '@application/finance/CloturerCaisseUseCase';
import { PrismaStaffProfileRepository } from '@infrastructure/persistence/prisma/PrismaStaffProfileRepository';
import { PrismaLeaveRepository } from '@infrastructure/persistence/prisma/PrismaLeaveRepository';
import { PrismaEmployeeFileRepository } from '@infrastructure/persistence/prisma/PrismaEmployeeFileRepository';
import { PrismaCareerEventRepository } from '@infrastructure/persistence/prisma/PrismaCareerEventRepository';
import { PrismaMissionOrderRepository } from '@infrastructure/persistence/prisma/PrismaMissionOrderRepository';
import type { CoreContainerContext } from './coreContext';

export function createFinanceHrContainer(core: CoreContainerContext) {
  const planFraisRepository = new PrismaPlanFraisRepository(prisma);
  const paiementRepository = new PrismaPaiementRepository(prisma);
  const depenseRepository = new PrismaDepenseRepository(prisma);
  const campayPaiementService = new CampayPaiementService();
  const receiptPdfRenderer = new ReceiptPdfRenderer();

  const genererFacturesEnMasseUseCase = new GenererFacturesEnMasseUseCase(
    core.factureRepository,
    planFraisRepository,
    core.userRepository,
  );

  const finance = {
    creerPlanFrais: new CreerPlanFraisUseCase(planFraisRepository),
    modifierPlanFrais: new ModifierPlanFraisUseCase(planFraisRepository, genererFacturesEnMasseUseCase),
    genererFacture: new GenererFactureUseCase(core.factureRepository, planFraisRepository),
    genererFacturesEnMasse: genererFacturesEnMasseUseCase,
    initierPaiement: new InitierPaiementMobileMoneyUseCase(
      core.factureRepository,
      paiementRepository,
      campayPaiementService,
      core.schoolConfigRepository,
    ),
    traiterWebhook: new TraiterWebhookCampayUseCase(paiementRepository, core.factureRepository),
    rembourserCaution: new RembourserCautionUseCase(paiementRepository),
    enregistrerDepense: new EnregistrerDepenseUseCase(depenseRepository, core.userRepository),
    enregistrerPaiementCash: new EnregistrerPaiementCashUseCase(core.factureRepository, paiementRepository),
    copierPlansFraisAnneePrecedente: new CopierPlansFraisAnneePrecedenteUseCase(planFraisRepository),
    changerStatutPlanFrais: new ChangerStatutPlanFraisUseCase(planFraisRepository, genererFacturesEnMasseUseCase),
    verifierStatutPaiement: new VerifierStatutPaiementUseCase(
      paiementRepository,
      core.factureRepository,
      campayPaiementService,
    ),
    configurerEcheancier: new ConfigurerEcheancierFactureUseCase(core.factureRepository),
    appliquerRemise: new AppliquerRemiseEleveUseCase(core.factureRepository),
    annulerPaiement: new AnnulerPaiementUseCase(paiementRepository),
    cloturerCaisse: new CloturerCaisseUseCase(paiementRepository),
    receiptPdfRenderer,
    factureRepository: core.factureRepository,
  };

  const hr = {
    userRepository: core.userRepository,
    schoolRepository: core.schoolRepository,
    sectionRepository: core.sectionRepository,
    staffProfileRepository: new PrismaStaffProfileRepository(prisma),
    leaveRepository: new PrismaLeaveRepository(prisma),
    employeeFileRepository: new PrismaEmployeeFileRepository(prisma),
    careerEventRepository: new PrismaCareerEventRepository(prisma),
    staffAttendanceRepository: core.staffAttendanceRepository,
    missionOrderRepository: new PrismaMissionOrderRepository(prisma),
  };

  return {
    finance,
    hr,
  };
}
