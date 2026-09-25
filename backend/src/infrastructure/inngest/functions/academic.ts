import { inngest } from "../client/index.ts";
import { prisma } from "../../../config/prisma.ts";
import { SocketNotificationService } from '../../services/notification/SocketNotificationService.ts';
import { PrismaSanteEleveRepository } from "../../persistence/prisma/PrismaSanteEleveRepository";
import { CalculerIndiceSanteUseCase } from "@application/ai/CalculerIndiceSanteUseCase";
import { GroqIAService } from '../../services/ai/GroqIAService.ts';
import { ajouterJoursOuvresScolaires, prolongerSiFermetureAujourdhui } from "../../services/school-calendar/SchoolCalendarService";
import { notifierEvenementAcademique } from "../../services/notification/AcademicEventNotificationService";
import { SmsNotificationAdapter } from '../../services/sms/SmsNotificationAdapter';
import { PrismaOrientationRepository } from "../../persistence/prisma/PrismaOrientationRepository";
import { PrismaGradeOrientationRepository } from "../../persistence/prisma/PrismaGradeOrientationRepository";
import { PrismaLv2ChoiceRepository } from "../../persistence/prisma/PrismaLv2ChoiceRepository";
import { PrismaAnneeAcademiqueRepository } from "../../persistence/prisma/PrismaAnneeAcademiqueRepository";
import { PrismaAcademicEventRepository } from "../../persistence/prisma/PrismaAcademicEventRepository";
import { PrismaSchoolRepository } from "../../persistence/prisma/PrismaSchoolRepository";
import { PrismaTimetableRepository } from "../../persistence/prisma/PrismaTimetableRepository";
import { SchedulingGridAdapter } from "../../scheduling/SchedulingGridAdapter";
import { GenererSqueletteEmploiDuTempsUseCase } from "@application/timetable/GenererSqueletteEmploiDuTempsUseCase";
import { PrismaStaffProfileRepository } from "../../persistence/prisma/PrismaStaffProfileRepository";
import { PrismaUserRepository } from "../../persistence/prisma/PrismaUserRepository";
import { PrismaExamRepository } from "../../persistence/prisma/PrismaExamRepository";
import { PrismaAssessmentScopeRepository } from "../../persistence/prisma/PrismaAssessmentScopeRepository";
import { PrismaHarmonizedAssessmentSessionRepository } from "../../persistence/prisma/PrismaHarmonizedAssessmentSessionRepository";
import { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';
import { VerifierEvenementsAcademiquesUseCase } from "@application/academicEvent/VerifierEvenementsAcademiquesUseCase";
import { VerifierOrientationCheckpointsUseCase } from "@application/orientation/VerifierOrientationCheckpointsUseCase";
import { DetecterPatternSuspicieuxUseCase } from "@application/ai/DetecterPatternSuspicieuxUseCase";
import { PrismaAIActionAuditQueryAdapter } from "../../persistence/prisma/PrismaAIActionAuditQueryAdapter";
import { ProposerEmploisDuTempsGlobalUseCase } from '@application/timetable/ProposerEmploisDuTempsGlobalUseCase';
import { PrismaTimetableGenerationRunRepository } from '../../persistence/prisma/PrismaTimetableGenerationRunRepository';
import { PrismaTimetableGenerationTargetProvider } from '../../persistence/prisma/PrismaTimetableGenerationTargetProvider';
import { creerContainer } from '@infrastructure/config/container';
import { NodemailerEmailService } from "@infrastructure/services/email/NodemailerEmailService";
import { setWorkerBridgeEnabled } from 'or-tools-wasm/cp-sat';

const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(prisma);
const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);

const iaService = new GroqIAService();
const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
  new PrismaSanteEleveRepository(prisma),
  iaService,
);

async function notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
  const socketService = new SocketNotificationService();
  await socketService
    .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, urgency: "NORMAL" })
    .catch((err) => console.error("[HealthAlert] IN_APP personnel:", err?.message));
  const { notifierUtilisateurPush } = await import('../../services/notification/PushNotificationService.ts');
  await notifierUtilisateurPush({ userId, title: titre, body: corps }).catch(() => {});
}

const FENETRE_ALERTE_MS = 10 * 60 * 1000;
const SEUIL_REFUS = 3;

export const checkAcademicEvents = inngest.createFunction(
  { id: "check-academic-events", name: "Vérification quotidienne des événements académiques", triggers: [{ cron: "0 6 * * *" }] },
  async ({ event, step }) => {
    await step.run("process-academic-events", async () => {
      const schoolCalendarPort = {
        ajouterJoursOuvresScolaires: (schoolId: string, date: Date, jours: number) => ajouterJoursOuvresScolaires(prisma, schoolId, date, jours),
        prolongerSiFermetureAujourdhui: (schoolId: string, closeDate: Date, aujourd: Date) => prolongerSiFermetureAujourdhui(prisma, schoolId, closeDate, aujourd),
      };
      const notificationPort = {
        notifierEvenementAcademique: (schoolId: string, targetRoles: string[], titre: string, corps: string) =>
          notifierEvenementAcademique(prisma, schoolId, targetRoles, titre, corps),
      };
      const useCase = new VerifierEvenementsAcademiquesUseCase({
        academicEventRepository: new PrismaAcademicEventRepository(prisma),
        schoolRepository: new PrismaSchoolRepository(prisma),
        lv2ChoiceRepository,
        anneeRepository,
        schoolCalendarPort,
        notificationPort,
        smsPort: new SmsNotificationAdapter(),
      });
      const schoolId = (event as any)?.data?.schoolId as string | undefined;
      return useCase.execute(schoolId ? { schoolId } : undefined);
    });
    return { checked: true };
  },
);

export const checkOrientationCheckpoints = inngest.createFunction(
  { id: "check-orientation-checkpoints", name: "Vérification quotidienne des checkpoints d'orientation", triggers: [{ cron: "0 7 * * *" }] },
  async ({ event, step }) => {
    await step.run("process-orientation-checkpoints", async () => {
      const personnelNotificationPort = {
        notifierPersonnel: (userId: string, schoolId: string, titre: string, corps: string) =>
          notifierPersonnelDirect(userId, schoolId, titre, corps),
      };
      const useCase = new VerifierOrientationCheckpointsUseCase({
        schoolRepository: new PrismaSchoolRepository(prisma),
        orientationRepository: new PrismaOrientationRepository(prisma),
        gradeOrientationRepository: new PrismaGradeOrientationRepository(prisma),
        anneeRepository: new PrismaAnneeAcademiqueRepository(prisma),
        staffProfileRepository: new PrismaStaffProfileRepository(prisma),
        userRepository: new PrismaUserRepository(prisma),
        personnelNotificationPort,
      });
      const schoolId = (event as any)?.data?.schoolId as string | undefined;
      return useCase.execute(schoolId ? { schoolId } : undefined);
    });
    return { checked: true };
  },
);

export const checkSuspiciousAiActionPattern = inngest.createFunction(
  { id: "check-suspicious-ai-action-pattern", name: "Détection de refus répétés — sécurité assistant IA", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    await step.run("detect-and-alert", async () => {
      const adapter = new PrismaAIActionAuditQueryAdapter(prisma);
      const useCase = new DetecterPatternSuspicieuxUseCase(adapter, new NodemailerEmailService());
      await useCase.execute({});
    });
    return { checked: true };
  },
);

export const handleTimetableSeancesAppliquees = inngest.createFunction(
  { id: "Handle-Timetable-Seances-Appliquees", triggers: [{ event: "timetable/seances.appliquees" }] },
  async ({ event, step }) => {
     const { schoolId, timetableId, seances, seancesGroupes } = event.data as {
       schoolId: string;
       timetableId: string;
       nbSeances: number;
       seances: { subjectId: string }[];
       seancesGroupes?: { subjectId: string }[];
     };
     const toutesSeances = [...(seances ?? []), ...(seancesGroupes ?? [])];

    // AssessmentScheduled : matières liées à un examen à venir (filtré par schoolId + date).
    await step.run("check-upcoming-exams", async () => {
       const subjectIds = [...new Set(toutesSeances.map(s => s.subjectId))];
      if (subjectIds.length === 0) return;
      const examRepository = new PrismaExamRepository(prisma);
      const exams = await examRepository.findUpcomingBySubjects(schoolId, subjectIds);
      for (const exam of exams) {
        await inngest.send({
          name: "assessment/scheduled",
          data: { schoolId, examId: exam.id, classId: exam.classId, subjectId: exam.subjectId, timetableId },
        });
      }
    });

    // Notification admin (isolée par schoolId).
    await step.run("notify-admins", async () => {
      const userRepository = new PrismaUserRepository(prisma);
      const admins = await userRepository.findByRole(schoolId, "ADMIN" as any);
      const actifs = (admins as any[]).filter((u: any) => u.isActive !== false);
      const cibles = actifs.length > 0 ? actifs : admins;
      const notificationService = new SocketNotificationService();
      for (const admin of cibles as any[]) {
        await notificationService
          .envoyer({
            schoolId,
            userId: (admin as any).id,
            type: "SYSTEM" as any,
            titre: "Emploi du temps appliqué",
             corps: `${toutesSeances.length} séance(s) appliquée(s).`,
            urgency: "NORMAL" as any,
          })
          .catch(() => {});
      }
    });

     return { timetableId, nbSeances: toutesSeances.length };
  }
);

export const generateAllTimetableSkeletons = inngest.createFunction(
  { id: "Generate-All-Timetable-Skeletons", triggers: [{ event: "timetable/grille.sauvee" }] },
  async ({ event, step }) => {
    const { schoolId } = event.data as { schoolId: string };
    return step.run("generate-skeletons-for-classes", async () => {
      const annee = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!annee) return { schoolId, created: 0, existing: 0, errors: 0, skipped: true };

      const classes = await prisma.class.findMany({
        where: { schoolId, academicYearId: annee.id, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const useCase = new GenererSqueletteEmploiDuTempsUseCase(
        new PrismaTimetableRepository(prisma),
        new PrismaAnneeAcademiqueRepository(prisma),
        new SchedulingGridAdapter(),
      );
      let created = 0;
      let existing = 0;
      let errors = 0;
      for (const classe of classes) {
        try {
          await useCase.execute({ schoolId, classId: classe.id });
          created += 1;
        } catch (error) {
          if (error instanceof Error && error.message.includes("existe déjà")) existing += 1;
          else errors += 1;
        }
      }
      return { schoolId, total: classes.length, created, existing, errors };
    });
  },
);

export const proposeTimetablesGlobally = inngest.createFunction(
  { id: "Propose-Timetables-Globally", triggers: [{ event: "timetable/generation.requested" }] },
  async ({ event, step }) => {
    const { runId, schoolId } = event.data as { runId: string; schoolId: string };
    setWorkerBridgeEnabled(true);
    const runs = new PrismaTimetableGenerationRunRepository(prisma);
    const run = await runs.findById(runId, schoolId);
    if (!run) return { runId, status: "NOT_FOUND" };
    const targets = ((run.progress as { targets?: { classId: string }[] } | null)?.targets ?? []);
    const container = creerContainer();
    const targetsProvider = new PrismaTimetableGenerationTargetProvider(prisma);
    const useCase = new ProposerEmploisDuTempsGlobalUseCase(
      targetsProvider,
      runs,
      container.timetable.proposerEmploiDuTemps,
      container.timetable.genererSquelette,
    );
    await runs.markRunning(runId, schoolId);
    for (const target of targets) {
      const resultat = await step.run(`propose-${target.classId}`, async () => useCase.processClass(runId, target.classId, schoolId));
      if (resultat.status === "CANCELLED") break;
    }
    const current = await runs.findById(runId, schoolId);
    if (current?.status === "CANCELLED") return { runId, status: "CANCELLED" };
    await runs.markFinished(runId, schoolId, current?.status === "PARTIAL" ? "PARTIAL" : "COMPLETED");
    return { runId, status: (await runs.findById(runId, schoolId))?.status ?? "UNKNOWN" };
  },
);

export const handleAssessmentScheduled = inngest.createFunction(
  { id: "Handle-Assessment-Scheduled", triggers: [{ event: "assessment/scheduled" }] },
  async ({ event, step }) => {
    const { schoolId, examId, classId, subjectId, timetableId } = event.data as {
      schoolId: string;
      examId: string;
      classId: string;
      subjectId: string;
      timetableId: string;
    };

    await step.run("create-assessment-session", async () => {
      const scopeRepo = new PrismaAssessmentScopeRepository(prisma);
      const sessionRepo = new PrismaHarmonizedAssessmentSessionRepository(prisma);

      // Chercher un scope existant pour ce couple subjectId/classId/academicYearId
      const examRepo = new PrismaExamRepository(prisma);
      const exam = await examRepo.findById(examId);
      if (!exam) {
        console.log(`[Handle-Assessment-Scheduled] Exam ${examId} introuvable — skip`);
        return;
      }

      const scopes = await scopeRepo.findBySchoolAndYear(schoolId, exam.academicYearId);
      const matchingScope = scopes.find(
        (s) => s.subjectIds.includes(subjectId) && s.classIds.includes(classId),
      );

      if (!matchingScope) {
        console.log(
          `[Handle-Assessment-Scheduled] Aucun AssessmentScope pour subjectId=${subjectId}, classId=${classId}, yearId=${exam.academicYearId} — skip`,
        );
        return;
      }

      // Créer la session d'évaluation harmonisée
      const session = HarmonizedAssessmentSession.create({
        schoolId,
        assessmentScopeId: matchingScope.id,
        subjectId,
        classId,
        scheduledDate: exam.scheduledAt ?? new Date(),
        durationMinutes: exam.duration,
        status: 'PLANNED',
      });

      await sessionRepo.save(session);
    });

    return { examId, subjectId, classId };
  }
);

export const checkYearEndClosingProximity = inngest.createFunction(
  { id: "check-year-end-closing-proximity", name: "Vérification quotidienne de proximité de fin d'année (6 semaines)", triggers: [{ cron: "0 5 * * *" }] },
  async ({ step }) => {
    await step.run("detect-and-notify-closing", async () => {
      const now = new Date();

      // Récupérer le calendrier officiel national actif
      const officialCal = await (prisma as any).officialAcademicCalendar.findFirst({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
      });

      // Récupérer toutes les écoles avec leur année active
      const activeYears = await prisma.academicYear.findMany({
        where: { isCurrent: true, status: 'ACTIVE' },
        include: {
          school: {
            include: {
              users: {
                where: { role: 'ADMIN' },
                select: { id: true, schoolId: true },
              },
            },
          },
        },
      });

      for (const ay of activeYears) {
        // Date de clôture : priorité au calendrier officiel national, sinon date de l'année scolaire
        const closingDate = officialCal?.dateClotureOfficielle
          ? new Date(officialCal.dateClotureOfficielle)
          : new Date(ay.endDate);

        const diffMs = closingDate.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));

        // Seuil : uniquement dans la fenêtre de 6 semaines (42 jours) avant la clôture officielle
        if (diffDays <= 42 && diffDays >= 0) {
          const admins = ay.school?.users || [];
          for (const admin of admins) {
            // Vérifier l'idempotence : notification unique, jamais de répétition
            const existingNotif = await prisma.notification.findFirst({
              where: {
                schoolId: ay.schoolId,
                userId: admin.id,
                type: 'ACADEMIC',
                metadata: {
                  path: ['action'],
                  equals: 'OPEN_CLOTURE_MODAL',
                },
              },
            });

            if (!existingNotif) {
              await prisma.notification.create({
                data: {
                  schoolId: ay.schoolId,
                  userId: admin.id,
                  type: 'ACADEMIC',
                  urgency: 'HIGH',
                  channel: 'IN_APP',
                  title: "Préparation & Clôture de l'Année Scolaire N+1",
                  body: `La clôture officielle approche (${closingDate.toLocaleDateString('fr-FR')}). La proposition de structure N+1 est prête pour validation.`,
                  metadata: {
                    action: 'OPEN_CLOTURE_MODAL',
                    academicYearId: ay.id,
                    targetClosingDate: closingDate.toISOString(),
                  },
                },
              });

              // Notification en temps réel via WebSocket
              const socketService = new SocketNotificationService();
              await socketService
                .envoyer({
                  schoolId: ay.schoolId,
                  userId: admin.id,
                  type: 'ACADEMIC_EVENT',
                  titre: "Préparation & Clôture de l'Année Scolaire N+1",
                  corps: `La clôture officielle approche (${closingDate.toLocaleDateString('fr-FR')}). La proposition de structure N+1 est prête pour validation.`,
                  urgency: 'HIGH',
                })
                .catch(() => {});
            }
          }
        }
      }
    });

    return { processed: true };
  }
);
