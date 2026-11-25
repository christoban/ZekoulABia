/**
 * APPLICATION LAYER — Use Case : Générer les bulletins d'une classe
 *
 * Lois appliquées :
 * - Loi 4 : bloqué si une note de la classe n'est pas LOCKED.
 * - Loi 5b : bloqué si le Conseil de Classe n'est pas LOCKED.
 * - Loi 6 : verrouille les notes LOCKED après génération du bulletin.
 * - Régénération contrôlée : réservée ADMIN avec motif obligatoire (archive REVOKED tracée).
 */
import { Bulletin } from '@domain/entities/Bulletin';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { PresenceRepository } from '@domain/ports/repositories/PresenceRepository';
import type { PdfService } from '@domain/ports/services/PdfService';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { StudentProfileRepository } from '@domain/ports/repositories/StudentProfileRepository';
import type { ClasseCoefficientRepository } from '@domain/ports/repositories/ClasseCoefficientRepository';
import type { TeachingAssignmentRepository } from '@domain/ports/repositories/TeachingAssignmentRepository';
import type { DisciplineRepository } from '@domain/ports/repositories/DisciplineRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { BulletinTemplateAssignmentRepository } from '@domain/ports/repositories/BulletinTemplateAssignmentRepository';
import type { BulletinTemplateSpecRepository } from '@domain/ports/repositories/BulletinTemplateSpecRepository';
import type { BulletinRendererPort } from '@domain/ports/services/BulletinRendererPort';
import type { BulletinPdfStoragePort } from '@domain/ports/services/BulletinPdfStoragePort';
import type { SequenceAbsenceSummaryRepository } from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';
import type { SchoolIdentityKitRepository } from '@domain/ports/repositories/SchoolIdentityKitRepository';
import type { SchoolAssetStoragePort } from '@domain/ports/services/SchoolAssetStoragePort';
import type { BulletinTemplate } from '@domain/types/enums';
import { resolveHasCoefficientForClass } from '@domain/subsystems/SubsystemDefaults';
import { buildLongTokenVerifyUrl } from '@domain/policies/BulletinVerifyCrypto';
import { resolveLanguage } from '../../domain/policies/LanguagePolicy';
import {
  createBatchSchoolIdentityContextCache,
  normalizeSequenceCalculationMode,
  renderAndStoreBulletinIfSpecActive,
  resolveClassGenerationPlan,
} from './bulletinPdfLifecycle';
import {
  chargerNotesEtSequencesClasse,
  construireEtEnrichirSnapshotsClasse,
  resoudreVerifyBaseUrl,
  snapshotToLignesMatiere,
} from './bulletinSnapshotEnricher';

export interface GenererBulletinCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  academicYearId: string;
  template: BulletinTemplate;
  nomEtablissement: string;
  schoolMotto?: string;
  logoUrl?: string;
  demandeurId: string;
  demandeurRole?: string;
  forceRegenerate?: boolean;
  motifRegeneration?: string;
}

export interface GenererBulletinResultat {
  bulletinsGeneres: number;
  bulletinsIgnores: number;
  message: string;
}

export class GenererBulletinUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly userRepository: UserRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly pdfService: PdfService,
    private readonly classCouncilRepository: ClassCouncilRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly sectionRepository: SectionRepository,
    private readonly studentProfileRepository: StudentProfileRepository,
    private readonly classeCoefficientRepository?: ClasseCoefficientRepository,
    private readonly teachingAssignmentRepository?: TeachingAssignmentRepository,
    private readonly disciplineRepository?: DisciplineRepository,
    private readonly schoolConfigRepository?: SchoolConfigRepository,
    private readonly assignmentRepository?: BulletinTemplateAssignmentRepository,
    private readonly bulletinRenderer?: BulletinRendererPort,
    private readonly bulletinPdfStorage?: BulletinPdfStoragePort,
    private readonly sequenceAbsenceRepository?: SequenceAbsenceSummaryRepository,
    private readonly schoolIdentityKitRepository?: SchoolIdentityKitRepository,
    private readonly schoolAssetStorage?: SchoolAssetStoragePort,
    private readonly templateSpecRepository?: BulletinTemplateSpecRepository,
  ) {}

  async execute(commande: GenererBulletinCommande): Promise<GenererBulletinResultat> {
    if (commande.forceRegenerate) {
      if (commande.demandeurRole !== 'ADMIN') {
        throw new Error('Seul un administrateur (ADMIN) peut révoquer et régénérer un bulletin existant.');
      }
      if (!commande.motifRegeneration || commande.motifRegeneration.trim().length === 0) {
        throw new Error('Un motif obligatoire (motifRegeneration) est requis pour régénérer un bulletin.');
      }
    }

    const classe = await this.classeRepository.findById(commande.classId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classId}`);

    const periode = await this.anneeRepository.findPeriodeById(commande.academicPeriodId, commande.schoolId);
    if (!periode) throw new Error('Période académique introuvable');

    const annee = await this.anneeRepository.findById(commande.academicYearId);
    if (!annee) throw new Error('Année académique introuvable');

    const plan = await resolveClassGenerationPlan({
      schoolId: commande.schoolId,
      classId: commande.classId,
      classLevel: classe.level ?? null,
      periodName: periode.name,
      requestedTemplate: commande.template,
      schoolConfigRepository: this.schoolConfigRepository,
      assignmentRepository: this.assignmentRepository,
      templateSpecRepository: this.templateSpecRepository,
    });
    const effectiveTemplate = plan.template;

    const isAnnual = effectiveTemplate === 'ANNUAL';
    const ctx = await chargerNotesEtSequencesClasse({
      classId: commande.classId,
      academicYearId: commande.academicYearId,
      academicPeriodId: commande.academicPeriodId,
      isAnnual,
      anneeRepository: this.anneeRepository,
      noteRepository: this.noteRepository,
    });

    // Loi 4 — toutes les notes doivent être LOCKED
    Bulletin.verifierPrerequisGeneration(ctx.notesNonValidees, classe.nomComplet);

    // Loi 5b — le conseil de classe doit être LOCKED avant la génération des bulletins
    const conseilVerrouille = await this.classCouncilRepository.sessionVerrouilleeExiste(
      commande.classId,
      commande.academicPeriodId,
    );
    if (!conseilVerrouille) {
      throw new Error(
        `Le Conseil de Classe de "${classe.nomComplet}" doit être tenu et verrouillé avant de générer les bulletins.`,
      );
    }

    const studentIdsClasse = new Set(ctx.notesDeClasse.map((n) => n.studentId));
    const eleves = await this.userRepository.findByRole(commande.schoolId, 'STUDENT');
    const elevesClasse = eleves.filter((e) => e.isActive && studentIdsClasse.has(e.id));

    if (elevesClasse.length === 0) {
      return { bulletinsGeneres: 0, bulletinsIgnores: 0, message: 'Aucun élève avec des notes validées dans cette classe' };
    }

    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) throw new Error(`Établissement ${commande.schoolId} introuvable`);

    const section = classe.sectionId ? await this.sectionRepository.findById(classe.sectionId) : null;
    const sectionCode = section?.code ?? null;
    const langue = resolveLanguage(school.subsystem, sectionCode);
    const hasCoefficientBySubject = resolveHasCoefficientForClass(school, classe.level ?? null, sectionCode);

    const bundle = await construireEtEnrichirSnapshotsClasse({
      school,
      classe,
      academicPeriodId: commande.academicPeriodId,
      periodIds: ctx.periodIds,
      sequences: ctx.sequences,
      notesDeClasse: ctx.notesDeClasse,
      elevesClasse,
      hasCoefficientBySubject,
      template: effectiveTemplate,
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
        ? await this.schoolIdentityKitRepository.findBySchoolId(commande.schoolId)
        : null;
    const schoolObj = school.toObject();
    const cachedBatchSchoolIdentity = plan.useMeasuredRenderer
      ? await createBatchSchoolIdentityContextCache({
          schoolName: schoolObj.name,
          fallbackMotto: commande.schoolMotto,
          fallbackCity: schoolObj.city,
          fallbackPhone: schoolObj.phone,
          fallbackLogoUrl: schoolObj.logoUrl ?? commande.logoUrl,
          kit: identityKit,
          schoolAssetStorage: this.schoolAssetStorage,
        }).getForLanguage(langue)
      : undefined;
    let generes = 0;
    let ignores = 0;

    for (const eleve of elevesClasse) {
      const bulletinExistant = await this.bulletinRepository.findByEleveEtPeriode(
        eleve.id,
        commande.academicPeriodId,
      );
      if (bulletinExistant?.estGenere() && !commande.forceRegenerate) {
        ignores++;
        continue;
      }

      const entry = bundle.entriesByStudentId.get(eleve.id);
      if (!entry) continue;

      const bulletin = Bulletin.create({
        schoolId: commande.schoolId,
        studentId: eleve.id,
        academicYearId: commande.academicYearId,
        academicPeriodId: commande.academicPeriodId,
        sectionId: classe.sectionId,
        template: effectiveTemplate,
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

      const verifyUrl = buildLongTokenVerifyUrl(verifyBase, entry.verifyToken);
      const storedKey = await renderAndStoreBulletinIfSpecActive({
        bulletinId: bulletin.id,
        schoolId: commande.schoolId,
        academicPeriodId: commande.academicPeriodId,
        snapshot: entry.snapshot,
        spec: plan.spec,
        school: school.toObject(),
        schoolIdentity: cachedBatchSchoolIdentity,
        className: classe.nomComplet,
        periodName: periode.name,
        yearName: annee.name,
        mention: entry.mention,
        classMasterComment: entry.snapshot.councilDecision?.observations ?? undefined,
        language: langue,
        isAnnual: effectiveTemplate === 'ANNUAL',
        gradingPolicy: plan.gradingPolicy,
        schoolMotto: commande.schoolMotto,
        verifyUrl,
        verifyToken: entry.verifyToken,
        shortVerifyCode: entry.shortVerifyCode,
        studentPhotoUrl: rawPhotoByStudent.get(eleve.id),
        bulletinRenderer: this.bulletinRenderer,
        bulletinPdfStorage: this.bulletinPdfStorage,
      });

      if (!storedKey) {
        await this.pdfService.genererBulletin({
          bulletin: bulletin.toObject(),
          nomEleve: eleve.nomComplet,
          nomClasse: classe.nomComplet,
          nomEtablissement: commande.nomEtablissement,
          schoolMotto: commande.schoolMotto,
          logoUrl: commande.logoUrl,
          anneeAcademique: annee.name,
          nomPeriode: periode.name,
          nomProfesseurPrincipal: bundle.mainTeacherName ?? undefined,
          moyenneClasse: bundle.classProfile.classAverage,
          moyennePremier: bundle.classProfile.topAverage,
          moyenneDernier: bundle.classProfile.lowAverage,
          nbAdmis: bundle.classProfile.passCount,
          tauxReussite: bundle.classProfile.passRate,
          langue,
          verifyUrl,
          seq1Label: ctx.rawSeqNames[0],
          seq2Label: ctx.rawSeqNames[1],
          snapshot: entry.snapshot,
        });
      }

      bulletin.marquerGenere(storedKey ?? `bulletins/${commande.schoolId}/${bulletin.id}.pdf`);

      if (bulletinExistant?.estGenere()) {
        bulletinExistant.revoquer({
          revokedById: commande.demandeurId,
          reason: commande.motifRegeneration!.trim(),
        });
        await this.bulletinRepository.archiverEtRemplacerRevoque(bulletinExistant, bulletin);
      } else if (bulletinExistant) {
        await this.bulletinRepository.delete(bulletinExistant.toObject().id);
        await this.bulletinRepository.save(bulletin);
      } else {
        await this.bulletinRepository.save(bulletin);
      }

      // Loi 6 — verrouiller les notes LOCKED sur chaque période source après génération
      for (const pid of ctx.periodIds) {
        await this.noteRepository.verrouillerNotesValidees(eleve.id, commande.classId, pid);
      }
      generes++;
    }

    return {
      bulletinsGeneres: generes,
      bulletinsIgnores: ignores,
      message: `${generes} bulletin(s) généré(s) avec succès${ignores > 0 ? ` (${ignores} déjà généré(s) ignoré(s))` : ''}`,
    };
  }
}
