import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { UserController } from '@infrastructure/http/controllers/UserController';
import { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import { MasterAuthController } from '@infrastructure/http/controllers/MasterAuthController';
import { GroupAuthController } from '@infrastructure/http/controllers/GroupAuthController';
import { GroupDashboardController } from '@infrastructure/http/controllers/GroupDashboardController';
import { GroupTransferController } from '@infrastructure/http/controllers/GroupTransferController';
import { AdminGroupTransferController } from '@infrastructure/http/controllers/AdminGroupTransferController';
import { creerUserRoutes } from '@infrastructure/http/routes/user.routes';
import { creerMasterAdminHexRoutes } from '@infrastructure/http/routes/masterAdminHex.routes';
import { creerMasterAuthRoutes } from '@infrastructure/http/routes/masterAuth.routes';
import { creerGroupAuthRoutes } from '@infrastructure/http/routes/groupAuth.routes';
import { creerGroupDashboardRoutes } from '@infrastructure/http/routes/groupDashboard.routes';
import { creerGroupTransferRoutes } from '@infrastructure/http/routes/groupTransfer.routes';
import { creerAdminGroupTransferRoutes } from '@infrastructure/http/routes/adminGroupTransfer.routes';
import { SchoolTemplateAdminController } from '@infrastructure/http/controllers/SchoolTemplateAdminController';
import { creerSchoolTemplateAdminRoutes } from '@infrastructure/http/routes/schoolTemplateAdmin.routes';
import { PublierVersionTemplateUseCase } from '@application/schoolSettings/PublierVersionTemplateUseCase';
import { ProposerReapplicationToutesEcolesUseCase } from '@application/schoolSettings/ProposerReapplicationToutesEcolesUseCase';
import { AppliquerReapplicationToutesEcolesUseCase } from '@application/schoolSettings/AppliquerReapplicationToutesEcolesUseCase';
import { PrismaSchoolTemplateVersionRepository } from '@infrastructure/persistence/prisma/PrismaSchoolTemplateVersionRepository';
import { PrismaSchoolSettingsRepository } from '@infrastructure/persistence/prisma/PrismaSchoolSettingsRepository';
import { PrismaTemplateReapplicationQueryRepository } from '@infrastructure/persistence/prisma/PrismaTemplateReapplicationQueryRepository';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaMasterUserAuthRepository } from '@infrastructure/persistence/prisma/PrismaMasterUserAuthRepository';
import { PrismaSchoolGroupOwnerAuthRepository } from '@infrastructure/persistence/prisma/PrismaSchoolGroupOwnerAuthRepository';
import { PrismaGroupTransferRepository } from '@infrastructure/persistence/prisma/PrismaGroupTransferRepository';
import { PrismaGroupeScolaireQueryRepository } from '@infrastructure/persistence/prisma/PrismaGroupeScolaireQueryRepository';
import { PrismaStaffProfileRepository } from '@infrastructure/persistence/prisma/PrismaStaffProfileRepository';
import { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import { ActivityLogAdapter } from '@infrastructure/services/audit/ActivityLogAdapter';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';
import { MfaServiceAdapter } from '@infrastructure/services/auth/MfaServiceAdapter';
import { LoginMasterUseCase } from '@application/masterAdmin/LoginMasterUseCase';
import { VerifyMfaUseCase } from '@application/masterAdmin/VerifyMfaUseCase';
import { LoginGroupOwnerUseCase } from '@application/schoolGroup/LoginGroupOwnerUseCase';
import { VerifyGroupOwnerMfaUseCase } from '@application/schoolGroup/VerifyGroupOwnerMfaUseCase';
import { ObtenirKpisGroupeUseCase } from '@application/schoolGroup/ObtenirKpisGroupeUseCase';
import { ListerEcolesGroupeUseCase } from '@application/schoolGroup/ListerEcolesGroupeUseCase';
import { ObtenirDetailEcoleGroupeUseCase } from '@application/schoolGroup/ObtenirDetailEcoleGroupeUseCase';
import { CreerDemandeTransfertGroupeUseCase } from '@application/schoolGroup/CreerDemandeTransfertGroupeUseCase';
import { ListerDemandesTransfertGroupeUseCase } from '@application/schoolGroup/ListerDemandesTransfertGroupeUseCase';
import { RechercherPersonneEcoleGroupeUseCase } from '@application/schoolGroup/RechercherPersonneEcoleGroupeUseCase';
import { ListerDemandesTransfertEntrantesUseCase } from '@application/schoolGroup/ListerDemandesTransfertEntrantesUseCase';
import { AccepterTransfertEleveUseCase } from '@application/schoolGroup/AccepterTransfertEleveUseCase';
import { AccepterTransfertEnseignantUseCase } from '@application/schoolGroup/AccepterTransfertEnseignantUseCase';
import { RejeterTransfertGroupeUseCase } from '@application/schoolGroup/RejeterTransfertGroupeUseCase';
import { LoginEmailOtpUseCase } from '@application/user/LoginEmailOtpUseCase';
import { VerifierMfaConnexionUseCase } from '@application/user/VerifierMfaConnexionUseCase';
import { MfaUseCase } from '@application/user/MfaUseCase';
import { sendTransactionalEmail } from '../../services/email/EmailService';

type Container = ReturnType<typeof creerContainer>;

export function registerUser(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerUserRoutes(app, _prisma, container);
}

export function registerUserRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const designerAPUseCase = new DesignerAPUseCase(new PrismaStaffProfileRepository(p as any), new ActivityLogAdapter());

  const userRepository = new PrismaUserRepository(p as any);
  const loginEmailOtpUseCase = new LoginEmailOtpUseCase(
    userRepository,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'ZekoulABia — Code de vérification connexion',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'user-login-otp',
        eventType: 'user_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifierMfaConnexionUseCase = new VerifierMfaConnexionUseCase(userRepository);
  const mfaService = new MfaServiceAdapter();
  const mfaUseCase = new MfaUseCase(userRepository, mfaService);
  const classeRepositoryForUser = new PrismaClasseRepository(p as any);
  const enrollmentRepositoryForUser = new PrismaEnrollmentRepository(p as any);
  const auditForUser = new AIActionAuditAdapter(p as any);

  const userController = new UserController(
    c.user.connecter,
    c.user.inscrire,
    c.user.rafraichir,
    c.user.deconnecter,
    c.user.modifier,
    c.user.supprimer,
    c.user.transferer,
    c.user.tokenService,
    c.user.schoolRepository,
    designerAPUseCase,
    c.user.importer,
    loginEmailOtpUseCase,
    c.user.importUtilisateursRepository,
    verifierMfaConnexionUseCase,
    auditForUser,
    userRepository,
    mfaUseCase,
    classeRepositoryForUser,
    enrollmentRepositoryForUser,
    c.activityLog,
  );

  const masterAdminHexController = new MasterAdminHexController(
    c.masterAdmin.inviter,
    c.masterAdmin.suspendre,
    c.masterAdmin.reactiver,
    c.masterAdmin.rejeter,
    c.masterAdmin.changerPlan,
    c.masterAdmin.queryRepository,
    c.masterAdmin.supprimerEcole,
    c.masterAdmin.renvoyerInvitation,
    c.masterAdmin.changerStatut,
    c.masterAdmin.synchroniserMatieres,
    c.masterAdmin.reinitialiserMfa,
    c.events.publisher,
  );

  app.use('/api/v2/users', creerUserRoutes(userController));

  const masterUserAuthRepository = new PrismaMasterUserAuthRepository(p as any);
  const loginMasterUseCase = new LoginMasterUseCase(
    masterUserAuthRepository,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'ZekoulABia — Code de vérification connexion administrateur',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'master-login-otp',
        eventType: 'master_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifyMfaUseCase = new VerifyMfaUseCase(masterUserAuthRepository);
  const masterAuthController = new MasterAuthController(loginMasterUseCase, verifyMfaUseCase, masterUserAuthRepository);
  app.use('/api/v2/master/auth', creerMasterAuthRoutes(masterAuthController));
  app.use('/api/v2/master', creerMasterAdminHexRoutes(masterAdminHexController));

  // V0.4 — Publication de versions + ré-application en masse (master-admin)
  const templateVersionRepo = new PrismaSchoolTemplateVersionRepository(prisma);
  const schoolSettingsRepoMaster = new PrismaSchoolSettingsRepository(prisma);
  const templateReapplicationQueryRepo = new PrismaTemplateReapplicationQueryRepository(prisma);
  const publierVersionUseCase = new PublierVersionTemplateUseCase(templateVersionRepo);
  const proposerToutesUseCase = new ProposerReapplicationToutesEcolesUseCase(
    templateReapplicationQueryRepo, schoolSettingsRepoMaster, templateVersionRepo,
  );
  const appliquerToutesUseCase = new AppliquerReapplicationToutesEcolesUseCase(
    templateReapplicationQueryRepo, templateVersionRepo, c.schoolSettings.appliquerReapplication,
  );
  const schoolTemplateAdminController = new SchoolTemplateAdminController(
    publierVersionUseCase, templateVersionRepo, proposerToutesUseCase, appliquerToutesUseCase,
  );
  app.use('/api/v2/master', creerSchoolTemplateAdminRoutes(schoolTemplateAdminController));

  const schoolGroupOwnerAuthRepository = new PrismaSchoolGroupOwnerAuthRepository(p as any);
  const groupTransferRepository = new PrismaGroupTransferRepository(p as any);
  const groupeScolaireQueryRepository = new PrismaGroupeScolaireQueryRepository(p as any);

  const loginGroupOwnerUseCase = new LoginGroupOwnerUseCase(
    schoolGroupOwnerAuthRepository,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'ZekoulABia — Code de vérification connexion (Groupe Scolaire)',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'group-owner-login-otp',
        eventType: 'group_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifyGroupOwnerMfaUseCase = new VerifyGroupOwnerMfaUseCase(schoolGroupOwnerAuthRepository);
  const groupAuthController = new GroupAuthController(loginGroupOwnerUseCase, verifyGroupOwnerMfaUseCase, schoolGroupOwnerAuthRepository);
  app.use('/api/v2/group/auth', creerGroupAuthRoutes(groupAuthController));

  const groupDashboardController = new GroupDashboardController(
    new ObtenirKpisGroupeUseCase(groupeScolaireQueryRepository),
    new ListerEcolesGroupeUseCase(groupeScolaireQueryRepository),
    new ObtenirDetailEcoleGroupeUseCase(groupeScolaireQueryRepository),
  );
  app.use('/api/v2/group/dashboard', creerGroupDashboardRoutes(groupDashboardController));

  const groupTransferController = new GroupTransferController(
    new CreerDemandeTransfertGroupeUseCase(groupTransferRepository, groupeScolaireQueryRepository),
    new ListerDemandesTransfertGroupeUseCase(groupTransferRepository, groupeScolaireQueryRepository),
    new RechercherPersonneEcoleGroupeUseCase(groupeScolaireQueryRepository),
  );
  app.use('/api/v2/group/transfers', creerGroupTransferRoutes(groupTransferController));

  const adminGroupTransferController = new AdminGroupTransferController(
    groupTransferRepository,
    groupeScolaireQueryRepository,
    new ListerDemandesTransfertEntrantesUseCase(groupTransferRepository, groupeScolaireQueryRepository),
    new AccepterTransfertEleveUseCase(groupTransferRepository, groupeScolaireQueryRepository, c.eleveOnboarding.creerSquelette),
    new AccepterTransfertEnseignantUseCase(groupTransferRepository, groupeScolaireQueryRepository, c.user.inscrire),
    new RejeterTransfertGroupeUseCase(groupTransferRepository),
  );
  app.use('/api/v2/group-transfers', creerAdminGroupTransferRoutes(adminGroupTransferController));
}
