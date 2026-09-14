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
import { NodemailerEmailService } from "@infrastructure/services/email/NodemailerEmailService";

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
    const { schoolId, timetableId, seances } = event.data as {
      schoolId: string;
      timetableId: string;
      nbSeances: number;
      seances: { subjectId: string }[];
    };

    // AssessmentScheduled : matières liées à un examen à venir (filtré par schoolId + date).
    await step.run("check-upcoming-exams", async () => {
      const subjectIds = [...new Set((seances ?? []).map(s => s.subjectId))];
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
            corps: `${(seances ?? []).length} séance(s) appliquée(s).`,
            urgency: "NORMAL" as any,
          })
          .catch(() => {});
      }
    });

    return { timetableId, nbSeances: (seances ?? []).length };
  }
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
