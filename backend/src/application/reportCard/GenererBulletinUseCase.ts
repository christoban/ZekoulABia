/**
 * APPLICATION LAYER — Use Case : Générer les bulletins d'une classe
 *
 * Loi 4 : bloqué si une note n'est pas LOCKED.
 * Calcule les moyennes, rangs, mentions puis génère les PDFs.
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
import type { BulletinTemplate } from '@domain/types/enums';
import { BulletinSnapshotBuilder } from '@domain/services/bulletin/BulletinSnapshotBuilder';
import type { SnapshotNoteInput, SnapshotSubjectInput } from '@domain/types/bulletinSnapshot';
import { resolveHasCoefficientForClass } from '@domain/subsystems/SubsystemDefaults';
import { resolveLanguage } from '../../domain/policies/LanguagePolicy';

export interface GenererBulletinCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  academicYearId: string;
  template: BulletinTemplate;
  nomEtablissement: string;
  logoUrl?: string;
  demandeurId: string;
}

export interface GenererBulletinResultat {
  bulletinsGeneres: number;
  bulletinsIgnores: number; // déjà générés
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
  ) {}

  async execute(commande: GenererBulletinCommande): Promise<GenererBulletinResultat> {
    // 1. Vérifier Loi 4 — toutes les notes doivent être LOCKED
    const notesNonValidees = await this.noteRepository.findNotesNonValideesParClasse(
      commande.classId,
      commande.academicPeriodId
    );

    const classe = await this.classeRepository.findById(commande.classId);
    if (!classe) throw new Error(`Classe introuvable : ${commande.classId}`);

    // Période/année inexistantes — vérifié ICI, avant le calcul des élèves ayant des notes :
    // sinon un academicPeriodId invalide fait tomber silencieusement dans le early-return "Aucun
    // élève avec des notes validées" (aucune séquence ne peut matcher une période qui n'existe
    // pas), masquant la vraie cause derrière un message trompeur.
    const periode = await this.anneeRepository.findPeriodeById(commande.academicPeriodId, commande.schoolId);
    if (!periode) throw new Error('Période académique introuvable');

    const annee = await this.anneeRepository.findById(commande.academicYearId);
    if (!annee) throw new Error('Année académique introuvable');

    // Lance BulletinBloqueError si des notes ne sont pas validées
    Bulletin.verifierPrerequisGeneration(notesNonValidees, classe.nomComplet);

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

    // 2. Récupérer les élèves ayant des notes dans cette classe sur la période
    // findByRole renvoie TOUS les élèves de l'école — on filtre via les notes par séquence
    const sequences = await this.anneeRepository.findSequencesByPeriode(commande.academicPeriodId);
    const notesDeClasse: import('@domain/entities/Note').Note[] = [];
    for (const seq of sequences) {
      const notes = await this.noteRepository.findByClasse(commande.classId, seq.id);
      notesDeClasse.push(...notes);
    }
    const studentIdsClasse = [...new Set(notesDeClasse.map((n) => n.studentId))];

    const eleves = await this.userRepository.findByRole(commande.schoolId, 'STUDENT');
    const elevesClasse = eleves.filter((e) => e.isActive && studentIdsClasse.includes(e.id));

    if (elevesClasse.length === 0) {
      return { bulletinsGeneres: 0, bulletinsIgnores: 0, message: 'Aucun élève avec des notes validées dans cette classe' };
    }

    // 3. Récupérer l'école, la section et les matières
    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) {
      throw new Error(`Établissement ${commande.schoolId} introuvable`);
    }

    let sectionCode: string | null = null;
    if (classe.sectionId) {
      const section = await this.sectionRepository.findById(classe.sectionId);
      if (section) {
        sectionCode = section.code;
      }
    }

    const langue = resolveLanguage(school.subsystem, sectionCode);
    const hasCoefficientBySubject = resolveHasCoefficientForClass(school, classe.level ?? null, sectionCode);
    const matieres = await this.matiereRepository.findBySchool(commande.schoolId);
    const matiereParId = new Map(matieres.map((m) => [m.id, m]));

    // 4. Charger LV2 + A-Level pour filtrage strict en amont de tout calcul
    const lv2Map = new Map<string, string | null>();
    const lv2SubjectIds = new Set<string>(await this.matiereRepository.findIdsLV2BySchool(commande.schoolId));
    const alevelMap = new Map<string, string[]>();

    const profiles = await this.studentProfileRepository.findBulletinOptionsByStudentIds(
      elevesClasse.map((eleve) => eleve.id),
    );
    for (const profile of profiles) {
      lv2Map.set(profile.studentId, profile.lv2SubjectId);
      if (profile.alevelSubjectIds.length > 0) {
        alevelMap.set(profile.studentId, profile.alevelSubjectIds);
      }
    }

    // 5. Construire les snapshots de toute la classe via l'unique moteur mathématique du domaine
    const subjectsInput: SnapshotSubjectInput[] = matieres.map((m) => ({
      id: m.id,
      name: m.name,
      coefficient: m.coefficient,
      isLV2: lv2SubjectIds.has(m.id),
      subjectType: m.subjectType,
    }));
    const knownSubjectIds = new Set(subjectsInput.map((s) => s.id));
    for (const n of notesDeClasse) {
      if (!knownSubjectIds.has(n.subjectId)) {
        knownSubjectIds.add(n.subjectId);
        subjectsInput.push({
          id: n.subjectId,
          name: matiereParId.get(n.subjectId)?.name ?? `Matière (${n.subjectId.slice(0, 6)})`,
          coefficient: n.coefficient,
          isLV2: lv2SubjectIds.has(n.subjectId),
        });
      }
    }

    const notesInput: SnapshotNoteInput[] = notesDeClasse.map((n) => {
      const obj = n.toObject();
      return {
        id: obj.id,
        studentId: obj.studentId,
        subjectId: obj.subjectId,
        sequenceId: obj.sequenceId,
        coefficient: obj.coefficient,
        maxValue: obj.maxValue,
        sequenceScore: obj.sequenceScore,
        classTestScore: obj.classTestScore,
        terminalExamScore: obj.terminalExamScore,
        theoreticalScore: obj.theoreticalScore,
        practicalScore: obj.practicalScore,
        professionalAttitude: obj.professionalAttitude,
        oralScore: obj.oralScore,
        selfDevelopmentScore: obj.selfDevelopmentScore,
        sequenceAverage: obj.sequenceAverage,
        validationStatus: obj.validationStatus,
        isAbsentGrade: obj.isAbsentGrade,
        observation: obj.observation,
      };
    });

    const orderedSeqs = [...sequences].sort((a, b) => a.orderIndex - b.orderIndex);
    const { snapshotsByStudentId, classProfile } = BulletinSnapshotBuilder.buildClassSnapshots({
      students: elevesClasse.map((e) => ({
        id: e.id,
        lv2SubjectId: lv2Map.get(e.id) ?? null,
        alevelSubjectIds: alevelMap.get(e.id) ?? null,
      })),
      subjects: subjectsInput,
      sequences: orderedSeqs.map((s) => ({ id: s.id, name: s.name, orderIndex: s.orderIndex })),
      notes: notesInput,
      hasCoefficientBySubject,
      excludeAbsentGrades: true,
      isAnnual: commande.template === 'ANNUAL',
    });

    // 6. Calculer la mention selon le template et la langue
    const mentionEn = (m: number): string =>
      m >= 18 ? 'Excellent' : m >= 16 ? 'Very Good' : m >= 14 ? 'Good' : m >= 12 ? 'Fair' : m >= 10 ? 'Pass' : 'Poor';
    const mentionApc = (m: number): string =>
      m >= 18 ? 'Expert' : m >= 15 ? 'Acquis' : m >= 11 ? 'ECA' : 'NA';
    const mentionFr = (m: number): string =>
      m >= 18 ? 'Excellent' : m >= 16 ? 'Très Bien' : m >= 14 ? 'Bien' : m >= 12 ? 'Assez Bien'
        : m >= 10 ? 'Passable' : m >= 8 ? 'Insuffisant' : m >= 6 ? 'Très Insuffisant' : 'Médiocre';

    const calculerMention = (moyenne: number): string => {
      if (commande.template === 'EN_SECONDARY') return mentionEn(moyenne);
      if (commande.template === 'MONTHLY') return mentionApc(moyenne);
      if (commande.template === 'PRIMARY') return langue === 'en' ? mentionEn(moyenne) : mentionApc(moyenne);
      if (commande.template === 'ANNUAL') return langue === 'en' ? mentionEn(moyenne) : mentionFr(moyenne);
      return mentionFr(moyenne);
    };

    const [seqA, seqB] = orderedSeqs;
    const seq1Label = seqA?.name || 'SÉQ 1';
    const seq2Label = seqB?.name || 'SÉQ 2';

    const professorPrincipal = classe.professorPrincipalId
      ? await this.userRepository.findById(classe.professorPrincipalId)
      : null;
    const verifyBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');

    // 7. Générer et persister le bulletin pour chaque élève (un bulletin déjà GENERATED est immuable)
    let generes = 0;
    let ignores = 0;

    for (const eleve of elevesClasse) {
      const bulletinExistant = await this.bulletinRepository.findByEleveEtPeriode(
        eleve.id,
        commande.academicPeriodId,
      );
      if (bulletinExistant?.estGenere()) {
        ignores++;
        continue;
      }

      const snapshot = snapshotsByStudentId.get(eleve.id);
      if (!snapshot || snapshot.subjectLines.length === 0) {
        continue;
      }

      const statsPresence = await this.presenceRepository.getStatistiquesEleve(
        eleve.id,
        commande.academicPeriodId,
      );

      const bulletin = Bulletin.create({
        schoolId: commande.schoolId,
        studentId: eleve.id,
        academicYearId: commande.academicYearId,
        academicPeriodId: commande.academicPeriodId,
        template: commande.template,
      });

      bulletin.definirLignesMatiere(
        snapshot.subjectLines.map((l) => ({
          id: crypto.randomUUID(),
          subjectId: l.subjectId,
          subjectName: l.subjectName,
          coefficient: l.coefficient,
          seq1Score: l.seq1Score,
          seq2Score: l.seq2Score,
          seq3Score: l.seq3Score,
          seq4Score: l.seq4Score,
          seq5Score: l.seq5Score,
          seq6Score: l.seq6Score,
          classTestScore: l.classTestScore,
          terminalExamScore: l.terminalExamScore,
          theoreticalScore: l.theoreticalScore,
          practicalScore: l.practicalScore,
          professionalAttitude: l.professionalAttitude,
          oralScore: l.oralScore,
          selfDevelopmentScore: l.selfDevelopmentScore,
          subjectAverage: l.subjectAverage,
          weightedScore: l.weightedScore,
          subjectRank: l.subjectRank,
          teacherComment: l.teacherComment,
          competenceLabel: l.competenceLabel,
        })),
      );

      bulletin.definirResultats({
        generalAverage: snapshot.generalAverage,
        rank: snapshot.rank,
        totalStudents: snapshot.totalStudents,
        mention: calculerMention(snapshot.generalAverage),
        absenceCount: statsPresence.joursAbsent,
        rankTrimestre1: snapshot.rankTrimestre1,
        rankTrimestre2: snapshot.rankTrimestre2,
        rankTrimestre3: snapshot.rankTrimestre3,
      });

      const verifyUrl = `${verifyBase}/verify/${bulletin.id}`;

      await this.pdfService.genererBulletin({
        bulletin: bulletin.toObject(),
        nomEleve: eleve.nomComplet,
        nomClasse: classe.nomComplet,
        nomEtablissement: commande.nomEtablissement,
        logoUrl: commande.logoUrl,
        anneeAcademique: annee.name,
        nomPeriode: periode.name,
        nomProfesseurPrincipal: professorPrincipal?.nomComplet,
        moyenneClasse: classProfile.classAverage,
        moyennePremier: classProfile.topAverage,
        moyenneDernier: classProfile.lowAverage,
        nbAdmis: classProfile.passCount,
        tauxReussite: classProfile.passRate,
        langue,
        verifyUrl,
        seq1Label,
        seq2Label,
      });

      const pdfUrl = `bulletins/${commande.schoolId}/${bulletin.id}.pdf`;
      bulletin.marquerGenere(pdfUrl);

      if (bulletinExistant) {
        await this.bulletinRepository.delete(bulletinExistant.toObject().id);
      }
      await this.bulletinRepository.save(bulletin);

      // Loi 6 — verrouiller les notes LOCKED après génération du bulletin
      await this.noteRepository.verrouillerNotesValidees(
        eleve.id,
        commande.classId,
        commande.academicPeriodId,
      );

      generes++;
    }

    return {
      bulletinsGeneres: generes,
      bulletinsIgnores: ignores,
      message: `${generes} bulletin(s) généré(s) avec succès${ignores > 0 ? ` (${ignores} déjà généré(s) ignoré(s))` : ''}`,
    };
  }
}