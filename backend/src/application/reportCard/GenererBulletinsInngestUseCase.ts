/**
 * APPLICATION LAYER — Use Case : Génération des bulletins via Inngest (batch)
 *
 * Unifié sur BulletinSnapshotBuilder + bulletinSnapshotEnricher avec GenererBulletinUseCase :
 * mêmes Lois 4 / 5b / 6, même calcul pondéré, même filtrage LV2/A-Level et même snapshot v2.
 */
import { Bulletin } from '@domain/entities/Bulletin';
import { ErreurNonRetriable } from '@application/shared/ErreurNonRetriable';
import type { AnneeAcademiqueRepository, AnneeAcademiqueProps, PeriodeAcademiqueProps } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { StudentProfileRepository } from '@domain/ports/repositories/StudentProfileRepository';
import type { ClasseCoefficientRepository } from '@domain/ports/repositories/ClasseCoefficientRepository';
import type { TeachingAssignmentRepository } from '@domain/ports/repositories/TeachingAssignmentRepository';
import type { DisciplineRepository } from '@domain/ports/repositories/DisciplineRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { BulletinTemplateSpecRepository } from '@domain/ports/repositories/BulletinTemplateSpecRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import type { SequenceAbsenceSummaryRepository } from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';
import type { SchoolIdentityKitRepository } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { BulletinTemplate } from '@domain/types/enums';
import { resolveHasCoefficientForClass } from '@domain/subsystems/SubsystemDefaults';
import { buildLongTokenVerifyUrl } from '@domain/policies/BulletinVerifyCrypto';
import { resolveLanguage } from '../../domain/policies/LanguagePolicy';
import {
  chargerNotesEtSequencesClasse,
  construireEtEnrichirSnapshotsClasse,
  resoudreVerifyBaseUrl,
  snapshotToLignesMatiere,
} from './bulletinSnapshotEnricher';
import {
  createBatchSchoolIdentityContextCache,
  normalizeSequenceCalculationMode,
  renderAndStoreBulletinIfSpecActive,
  resolveClassGenerationPlan,
} from './bulletinPdfLifecycle';

export interface GenererBulletinsInngestCommande {
  yearId: string;
  periodId?: string | null;
  classId?: string | null;
  studentId?: string | null;
  template?: BulletinTemplate;
}

export interface GenererBulletinsInngestResultat {
  message: string;
  generated: number;
  generatedStudents: string[];
}

function resolveDefaultTemplate(school: { subsystem: string; educationType?: string }, periodeName: string): BulletinTemplate {
  if (periodeName.toLowerCase().includes('annu')) return 'ANNUAL';
  if (school.educationType === 'TECHNICAL' || school.educationType === 'PROFESSIONAL') return 'TECHNICAL_FR';
  if (school.subsystem === 'ANGLOPHONE') return 'EN_SECONDARY';
  return 'FR_SECONDARY';
}

export class GenererBulletinsInngestUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly userRepository: UserRepository,
    private readonly noteRepository: NoteRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly emailService: EmailService,
    private readonly classeRepository: ClasseRepository,
    private readonly classCouncilRepository: ClassCouncilRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly studentProfileRepository?: StudentProfileRepository,
    private readonly classeCoefficientRepository?: ClasseCoefficientRepository,
    private readonly teachingAssignmentRepository?: TeachingAssignmentRepository,
    private readonly disciplineRepository?: DisciplineRepository,
    private readonly schoolConfigRepository?: SchoolConfigRepository,
    private readonly assignmentRepository?: BulletinTemplateAssignmentRepository,
    private readonly bulletinRenderer?: BulletinRendererPort,
    private readonly fileStorage?: FileStoragePort,
    private readonly sequenceAbsenceRepository?: SequenceAbsenceSummaryRepository,
    private readonly schoolIdentityKitRepository?: SchoolIdentityKitRepository,
    private readonly templateSpecRepository?: BulletinTemplateSpecRepository,
  ) {}

  async generer(
    commande: GenererBulletinsInngestCommande,
  ): Promise<GenererBulletinsInngestResultat & { academicYear: AnneeAcademiqueProps; academicPeriod: PeriodeAcademiqueProps }> {
    const { yearId, periodId, classId, studentId } = commande;
    if (!periodId) throw new ErreurNonRetriable('periodId is required');

    const academicYear = await this.anneeRepository.findById(yearId);
    if (!academicYear) throw new ErreurNonRetriable('Academic year not found');

    const periode = await this.anneeRepository.findPeriodeById(periodId, academicYear.schoolId);
    if (!periode || periode.academicYearId !== yearId) throw new ErreurNonRetriable('Academic period not found');

    const school = await this.schoolRepository.findById(academicYear.schoolId);
    if (!school) throw new ErreurNonRetriable('School not found');

    const requestedStudents = await this.userRepository.findStudentsForBulletinGeneration(academicYear.schoolId, {
      classId: classId ?? null,
      studentId: studentId ?? null,
    });
    if (!requestedStudents.length) {
      return { message: 'No students found', generated: 0, generatedStudents: [], academicYear, academicPeriod: periode };
    }

    const template = commande.template ?? resolveDefaultTemplate(school.toObject(), periode.name);
    const targetClassIds = [...new Set(requestedStudents.map((s) => s.classId).filter((id): id is string => Boolean(id)))];
    const allStudentsSchool = await this.userRepository.findByRole(academicYear.schoolId, 'STUDENT');
    const generatedStudents: string[] = [];

    for (const currentClassId of targetClassIds) {
      const classe = await this.classeRepository.findById(currentClassId);
      if (!classe) continue;

      const plan = await resolveClassGenerationPlan({
        schoolId: academicYear.schoolId,
        classId: currentClassId,
        classLevel: classe.level ?? null,
        periodName: periode.name,
        requestedTemplate: template,
        schoolConfigRepository: this.schoolConfigRepository,
        assignmentRepository: this.assignmentRepository,
        templateSpecRepository: this.templateSpecRepository,
      });

      const ctx = await chargerNotesEtSequencesClasse({
        classId: currentClassId,
        academicYearId: yearId,
        academicPeriodId: periode.id,
        isAnnual: plan.template === 'ANNUAL',
        anneeRepository: this.anneeRepository,
        noteRepository: this.noteRepository,
      });

      // Loi 4 — toutes les notes doivent être LOCKED
      Bulletin.verifierPrerequisGeneration(ctx.notesNonValidees, classe.nomComplet);

      // Loi 5b — le conseil de classe doit être LOCKED
      const conseilVerrouille = await this.classCouncilRepository.sessionVerrouilleeExiste(currentClassId, periode.id);
      if (!conseilVerrouille) {
        throw new ErreurNonRetriable(
          `Le Conseil de Classe de "${classe.nomComplet}" doit être tenu et verrouillé avant de générer les bulletins.`,
        );
      }

      const gradedIds = new Set(ctx.notesDeClasse.map((n) => n.studentId));
      const elevesClasse = allStudentsSchool.filter((e) => e.isActive && gradedIds.has(e.id));
      if (!elevesClasse.length) continue;

      const section = classe.sectionId ? await this.sectionRepository.findById(classe.sectionId) : null;
      const sectionCode = section?.code ?? null;
      const langue = resolveLanguage(school.subsystem, sectionCode);
      const hasCoefficientBySubject = resolveHasCoefficientForClass(school, classe.level ?? null, sectionCode);

      const bundle = await construireEtEnrichirSnapshotsClasse({
        school,
        classe,
        academicPeriodId: periode.id,
        periodIds: ctx.periodIds,
        sequences: ctx.sequences,
        notesDeClasse: ctx.notesDeClasse,
        elevesClasse,
        hasCoefficientBySubject,
        template: plan.template,
        langue,
        matiereRepository: this.matiereRepository,
        userRepository: this.userRepository,
        presenceRepository: this.presenceRepository,
        classCouncilRepository: this.classCouncilRepository,
        studentProfileRepository: this.studentProfileRepository,
        classeCoefficientRepository: this.classeCoefficientRepository,
        teachingAssignmentRepository: this.teachingAssignmentRepository,
        disciplineRepository: this.disciplineRepository,
        sequenceAbsenceRepository: this.sequenceAbsenceRepository,
        groupingScheme: plan.groupingScheme,
        passThresholdOn20: plan.passThresholdOn20,
        calculationMode: plan.spec?.calculationMode,
        sequenceCalculationMode: normalizeSequenceCalculationMode(plan.gradingPolicy.mode),
      });

      const verifyBase = resoudreVerifyBaseUrl();
      const rawPhotoByStudent = new Map<string, string | null>();
      if (this.studentProfileRepository && plan.useMeasuredRenderer) {
        const opts = await this.studentProfileRepository.findBulletinOptionsByStudentIds(elevesClasse.map((e) => e.id));
        for (const o of opts) rawPhotoByStudent.set(o.studentId, o.photoUrl);
      }
      const identityKit =
        plan.useMeasuredRenderer && this.schoolIdentityKitRepository
          ? await this.schoolIdentityKitRepository.findBySchoolId(academicYear.schoolId)
          : null;
      const schoolObj = school.toObject();
      const cachedBatchSchoolIdentity = plan.useMeasuredRenderer
        ? await createBatchSchoolIdentityContextCache({
            schoolId: academicYear.schoolId,
            schoolName: schoolObj.name,
            fallbackCity: schoolObj.city,
            fallbackPhone: schoolObj.phone,
            fallbackLogoUrl: schoolObj.logoUrl,
            kit: identityKit,
            fileStorage: this.fileStorage,
          }).getForLanguage(langue)
        : undefined;

      const targets = studentId ? elevesClasse.filter((e) => e.id === studentId) : elevesClasse;
      for (const eleve of targets) {
        const bulletinExistant = await this.bulletinRepository.findByEleveEtPeriode(eleve.id, periode.id);
        if (bulletinExistant?.estGenere()) continue;

        const entry = bundle.entriesByStudentId.get(eleve.id);
        if (!entry) continue;

        const bulletin = Bulletin.create({
          schoolId: academicYear.schoolId,
          studentId: eleve.id,
          academicYearId: yearId,
          academicPeriodId: periode.id,
          sectionId: classe.sectionId,
          template: plan.template,
        });

        bulletin.definirLignesMatiere(snapshotToLignesMatiere(entry.snapshot));
        bulletin.definirResultats({
          generalAverage: entry.snapshot.generalAverage,
          rank: entry.snapshot.rank,
          totalStudents: entry.snapshot.totalStudents,
          mention: entry.mention,
          absenceCount: entry.absenceCount,
          rankTrimestre1: entry.snapshot.rankTrimestre1,
          rankTrimestre2: entry.snapshot.rankTrimestre2,
          rankTrimestre3: entry.snapshot.rankTrimestre3,
        });
        bulletin.scellerSnapshot({
          snapshotData: entry.snapshot,
          contentHash: entry.contentHash,
          verifyToken: entry.verifyToken,
          shortVerifyCode: entry.shortVerifyCode,
          computationVersion: 2,
          templateSpecId: plan.templateSpecId ?? undefined,
          templateVersion: plan.templateVersion,
        });

        const storedKey = await renderAndStoreBulletinIfSpecActive({
          bulletinId: bulletin.id,
          schoolId: academicYear.schoolId,
          academicPeriodId: periode.id,
          snapshot: entry.snapshot,
          spec: plan.spec,
          school: school.toObject(),
          schoolIdentity: cachedBatchSchoolIdentity,
          className: classe.nomComplet,
          periodName: periode.name,
          yearName: academicYear.name,
          mention: entry.mention,
          classMasterComment: entry.snapshot.councilDecision?.observations ?? undefined,
          language: langue,
          isAnnual: plan.template === 'ANNUAL',
          gradingPolicy: plan.gradingPolicy,
          verifyUrl: buildLongTokenVerifyUrl(verifyBase, entry.verifyToken),
          verifyToken: entry.verifyToken,
          shortVerifyCode: entry.shortVerifyCode,
          studentPhotoUrl: rawPhotoByStudent.get(eleve.id),
          bulletinRenderer: this.bulletinRenderer,
          fileStorage: this.fileStorage,
        });

        bulletin.marquerGenere(storedKey);

        if (bulletinExistant) {
          await this.bulletinRepository.delete(bulletinExistant.toObject().id);
        }
        await this.bulletinRepository.save(bulletin);

        // Loi 6 — verrouiller les notes après génération
        for (const pid of ctx.periodIds) {
          await this.noteRepository.verrouillerNotesValidees(eleve.id, currentClassId, pid);
        }
        generatedStudents.push(eleve.id);
      }
    }

    return {
      message: 'Report cards generated',
      generated: generatedStudents.length,
      generatedStudents,
      academicYear,
      academicPeriod: periode,
    };
  }

  async notifier(params: { schoolId: string; academicPeriod: { id: string; name: string }; generatedStudents: string[] }): Promise<{ sent: number }> {
    if (!params.generatedStudents.length) return { sent: 0 };
    let sent = 0;
    const school = await this.schoolRepository.findById(params.schoolId);
    const subsystem = school?.subsystem ?? null;

    for (const stdId of params.generatedStudents) {
      const ctx = await this.userRepository.findStudentNotificationContext(stdId);
      if (!ctx?.email) continue;
      const studentName = `${ctx.firstName} ${ctx.lastName}`.trim();
      const lang = resolveLanguage(subsystem, ctx.sectionCode);
      const parentRecipients = ctx.parents.filter((r) => Boolean(r.email));

      const subject = lang === 'fr'
        ? `Bulletin disponible — ${params.academicPeriod.name}`
        : `Report card available — ${params.academicPeriod.name}`;
      const html = lang === 'fr'
        ? `<p>Bonjour,<br><br>Le bulletin de <b>${studentName}</b> pour la période <b>${params.academicPeriod.name}</b> est disponible sur ZekoulABia.</p>`
        : `<p>Hello,<br><br>${studentName}'s report card for <b>${params.academicPeriod.name}</b> is now available on ZekoulABia.</p>`;
      const text = lang === 'fr'
        ? `Le bulletin de ${studentName} pour ${params.academicPeriod.name} est disponible.`
        : `${studentName}'s report card for ${params.academicPeriod.name} is available.`;

      const recipients = [{ email: ctx.email!, userId: ctx.id }, ...parentRecipients];
      for (const recipient of recipients) {
        try {
          await this.emailService.envoyer({
            destinataire: recipient.email,
            recipientUserId: recipient.userId,
            sujet: subject,
            contenuHtml: html,
            contenuTexte: text,
            eventType: 'report_card_available',
          });
          sent++;
        } catch {
          // Non-bloquant
        }
      }
    }
    return { sent };
  }
}
