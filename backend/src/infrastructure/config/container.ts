/**
 * INFRASTRUCTURE LAYER — Container d'injection de dépendances ZekoulABia
 *
 * Ce fichier assemble les sous-conteneurs métier qui branchent les implémentations
 * concrètes (Prisma, SendGrid, Campay, Inngest, etc.) sur les interfaces (ports).
 *
 * Principe :
 *   Adapters (Prisma, services) → injectés dans → Use Cases → injectés dans → Controllers
 */

import { createCoreContainerContext } from './container/coreContext';
import { createAssessmentGradeContainer } from './container/assessmentGradeContainer';
import { createAcademicContainer } from './container/academicContainer';
import { createTimetableContainer } from './container/timetableContainer';
import { createFinanceHrContainer } from './container/financeHrContainer';
import { createCommunicationContainer } from './container/communicationContainer';
import { createOnboardingUserContainer } from './container/onboardingUserContainer';
import { createExamsCampaignContainer } from './container/examsCampaignContainer';

// ─────────────────────────────────────────────
// Factory principale
// ─────────────────────────────────────────────

export function creerContainer() {
  const core = createCoreContainerContext();
  const assessmentGrade = createAssessmentGradeContainer(core);
  const timetable = createTimetableContainer(core);
  const academic = createAcademicContainer(core, timetable.pedagogie.autoMaterialisation);
  const financeHr = createFinanceHrContainer(core);
  const communication = createCommunicationContainer(core);
  const onboardingUser = createOnboardingUserContainer(
    core,
    academic.class.creer,
    timetable.pedagogie.autoMaterialisation,
  );
  const examsCampaign = createExamsCampaignContainer(core, onboardingUser.eleveOnboarding.creerSquelette);

  return {
    grade: assessmentGrade.grade,
    attendance: communication.attendance,
    school: onboardingUser.school,
    reportCard: academic.reportCard,
    classCouncil: academic.classCouncil,
    user: onboardingUser.user,
    masterAdmin: onboardingUser.masterAdmin,
    class: academic.class,
    pedagogie: timetable.pedagogie,
    hr: financeHr.hr,
    staffAttendance: timetable.staffAttendance,
    subject: academic.subject,
    room: timetable.room,
    teacherUnavailability: timetable.teacherUnavailability,
    studentGroup: timetable.studentGroup,
    timetable: timetable.timetable,
    academicYear: academic.academicYear,
    finance: financeHr.finance,
    ai: communication.ai,
    prediction: communication.prediction,
    parent: communication.parent,
    schoolSettings: onboardingUser.schoolSettings,
    academicProfile: academic.academicProfile,
    orientation: communication.orientation,
    matricule: onboardingUser.matricule,
    eleveOnboarding: onboardingUser.eleveOnboarding,
    credentialsNotificationService: core.credentialsNotificationService,
    notificationService: core.notificationService,
    statisticalCampaign: examsCampaign.statisticalCampaign,
    statisticalCampaignMinedub: examsCampaign.statisticalCampaignMinedub,
    paiementMinesec: examsCampaign.paiementMinesec,
    examen: examsCampaign.examen,
    lv2Choice: examsCampaign.lv2Choice,
    entranceExam: examsCampaign.entranceExam,
    pebsExam: examsCampaign.pebsExam,
    pushNotification: communication.pushNotification,
    notification: communication.notification,
    carnetLiaison: communication.carnetLiaison,
    assessment: assessmentGrade.assessment,
    task: communication.task,
    lv2pebs: examsCampaign.lv2pebs,
    studentDocument: academic.studentDocument,
    metric: {
      cache: core.metricCache,
      registry: core.metricRegistry,
      getMetric: core.getMetricUseCase,
    },
    events: {
      publisher: core.eventPublisher,
    },
    activityLog: core.activityLog,
    fileStorage: core.fileStorage,
  };
}

export type Container = ReturnType<typeof creerContainer>;
