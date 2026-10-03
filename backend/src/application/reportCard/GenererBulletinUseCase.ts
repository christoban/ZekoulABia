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
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
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

    // 3. Récupérer les matières (période/année déjà résolues plus haut)
    const matieres = await this.matiereRepository.findBySchool(commande.schoolId);

    // Lookup rapide matière par subjectId
    const matiereParId = new Map(matieres.map(m => [m.id, m]));

    // 4. Calculer les moyennes générales de tous les élèves (pour les rangs)
    const schoolForCoeff = await this.schoolRepository.findById(commande.schoolId);
    const classeForCoeff = await this.classeRepository.findById(commande.classId);
    const hasCoefficientBySubject = schoolForCoeff && classeForCoeff
      ? resolveHasCoefficientForClass(schoolForCoeff as any, (classeForCoeff as any).level ?? null)
      : true;
    // On utilise notesDeClasse (déjà chargé par findByClasse — classId garanti correct)
    const moyennesEleves: { studentId: string; moyenne: number }[] = [];

    for (const eleve of elevesClasse) {
      const notesEleve = notesDeClasse.filter((n) =>
        n.studentId === eleve.id &&
        n.validationStatus === 'LOCKED'
      );

      const moyenneBrute = calculateAverageScoreOn20(
        notesEleve
          .filter((n) => n.sequenceAverage !== undefined)
          .map((n) => ({
            scoreOn20: n.sequenceAverage!,
            percentage: n.sequenceAverage! * 5,
            coefficient: n.coefficient,
            isAbsentGrade: n.isAbsentGrade,
          })),
        hasCoefficientBySubject,
        true,
      );
      const moyenne = Number.isNaN(moyenneBrute) ? 0 : moyenneBrute === 0 ? 0 : moyenneBrute;

      moyennesEleves.push({ studentId: eleve.id, moyenne });
    }

    // 5. Calculer les rangs (tri décroissant)
    const classeesParMoyenne = [...moyennesEleves].sort((a, b) => b.moyenne - a.moyenne);
    const rangs = new Map<string, number>();
    classeesParMoyenne.forEach((item, index) => {
      rangs.set(item.studentId, index + 1);
    });

    // 6. Résoudre la langue de rendu (sous-système + section pour le bilingue).
    //    Templates PARTAGÉS (PRIMARY/ANNUAL) : la langue vient d'ici. Les autres
    //    templates encodent déjà leur langue via commande.template.
    const school = await this.schoolRepository.findById(commande.schoolId);
    if (!school) {
      throw new Error(`Établissement ${commande.schoolId} introuvable`);
    }

    let sectionCode: string | null = null;
    if (classe?.sectionId) {
      const section = await this.sectionRepository.findById(classe.sectionId);
      if (section) {
        sectionCode = section.code;
      }
    }

    const langue = resolveLanguage(school.subsystem, sectionCode);

    // 6bis. Calculer la mention selon le template et la langue
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
      // Partagés entre sous-systèmes : la langue décide.
      if (commande.template === 'PRIMARY') return langue === 'en' ? mentionEn(moyenne) : mentionApc(moyenne);
      if (commande.template === 'ANNUAL') return langue === 'en' ? mentionEn(moyenne) : mentionFr(moyenne);
      // FR_SECONDARY, TECHNICAL_FR
      return mentionFr(moyenne);
    };

    // 7. Charger les lv2SubjectId de tous les élèves + l'ensemble des matières isLV2 (label "(LV2)")
    //    + la sélection A-Level de chaque élève (pour ne montrer que ses matières choisies).
    const lv2Map = new Map<string, string | null>(); // userId → lv2SubjectId
    const lv2SubjectIds = new Set<string>();          // subjectId des matières taggées isLV2
    const alevelMap = new Map<string, Set<string>>(); // userId → set des subjectId A-Level choisis

    const profiles =
      await this.studentProfileRepository.findBulletinOptionsByStudentIds(
        elevesClasse.map(eleve => eleve.id),
      );

    for (const profile of profiles) {
      lv2Map.set(profile.studentId, profile.lv2SubjectId);

      if (profile.alevelSubjectIds.length > 0) {
        alevelMap.set(profile.studentId, new Set(profile.alevelSubjectIds));
      }
    }

    for (const subjectId of await this.matiereRepository.findIdsLV2BySchool(commande.schoolId)) {
      lv2SubjectIds.add(subjectId);
    }

    const [seqA, seqB] = sequences;
    const seq1Label = seqA?.name || 'SÉQ 1';
    const seq2Label = seqB?.name || 'SÉQ 2';

    // 7b. Générer le bulletin pour chaque élève
    let generes = 0;
    let ignores = 0;

    for (const eleve of elevesClasse) {
      // Vérifier si bulletin déjà généré
      const bulletinExistant = await this.bulletinRepository.findByEleveEtPeriode(
        eleve.id,
        commande.academicPeriodId
      );

      const moyenneEleve = moyennesEleves.find((m) => m.studentId === eleve.id)?.moyenne ?? 0;
      const rang = rangs.get(eleve.id) ?? elevesClasse.length;
      const mention = calculerMention(moyenneEleve);

      // Statistiques présences
      const statsPresence = await this.presenceRepository.getStatistiquesEleve(
        eleve.id,
        commande.academicPeriodId
      );

      // Créer une nouvelle instance de bulletin
      const bulletin = Bulletin.create({
        schoolId: commande.schoolId,
        studentId: eleve.id,
        academicYearId: commande.academicYearId,
        academicPeriodId: commande.academicPeriodId,
        template: commande.template,
      });

      // Construire les lignes matière depuis notesDeClasse (classId garanti correct)
      const notesEleve = notesDeClasse.filter((n) =>
        n.studentId === eleve.id &&
        n.validationStatus === 'LOCKED' &&
        n.sequenceAverage !== undefined
      );

      // Grouper par subjectId — collecter toutes les notes de l'élève pour la période
      const notesParSubject = new Map<string, typeof notesEleve>();
      for (const n of notesEleve) {
        const list = notesParSubject.get(n.subjectId) ?? [];
        list.push(n);
        notesParSubject.set(n.subjectId, list);
      }

      const eleveClv2 = lv2Map.get(eleve.id) ?? null;
      const alevelSelection = alevelMap.get(eleve.id) ?? null; // non-null ⇒ élève A-Level

      const lignes = Array.from(notesParSubject.entries()).flatMap(([subjectId, notesList]) => {
        const matiere = matiereParId.get(subjectId);
        const coeff = matiere?.coefficient ?? notesList[0]?.coefficient ?? 1;
        const baseName = matiere?.name ?? `Matière (${subjectId.slice(0, 6)})`;
        const subjectEstLV2 = lv2SubjectIds.has(subjectId);

        // Élève A-Level : n'afficher que les matières réellement choisies (coeff A-Level officiel via matiere).
        if (alevelSelection && !alevelSelection.has(subjectId)) {
          return [];
        }

        // Anomalie : note dans une matière LV2 qui n'est pas la LV2 de l'élève → exclure + warning.
        if (subjectEstLV2 && eleveClv2 !== subjectId) {
          console.warn(
            `[Bulletin] Élève ${eleve.id} possède une note dans la LV2 "${baseName}" (${subjectId}) ` +
            `qui n'est pas sa LV2 affectée (${eleveClv2 ?? 'aucune'}) — ligne exclue du bulletin.`,
          );
          return [];
        }

        const isLignLV2 = subjectEstLV2 && eleveClv2 === subjectId;

        // Associer les notes de chaque séquence de la période
        const nSeq1 = seqA ? notesList.find((n) => n.sequenceId === seqA.id) : undefined;
        const nSeq2 = seqB ? notesList.find((n) => n.sequenceId === seqB.id) : undefined;

        const s1 = nSeq1 ? (nSeq1.toObject().sequenceScore ?? nSeq1.sequenceAverage ?? null) : null;
        const s2 = nSeq2 ? (nSeq2.toObject().sequenceScore ?? nSeq2.sequenceAverage ?? null) : null;

        // Calcul de la moyenne de la matière pour la période
        let subjAvg = 0;
        if (s1 !== null && s2 !== null) {
          subjAvg = Math.round(((s1 + s2) / 2) * 100) / 100;
        } else if (s1 !== null) {
          subjAvg = s1;
        } else if (s2 !== null) {
          subjAvg = s2;
        } else if (notesList[0]?.sequenceAverage !== undefined) {
          subjAvg = notesList[0].sequenceAverage;
        }

        const wScore = Math.round(subjAvg * coeff * 100) / 100;
        const teacherComment = nSeq2?.toObject().observation || nSeq1?.toObject().observation || null;

        return [{
          id: crypto.randomUUID(),
          subjectId,
          subjectName: isLignLV2 ? `${baseName} (LV2)` : baseName,
          coefficient: coeff,
          seq1Score: s1 ?? undefined,
          seq2Score: s2 ?? undefined,
          subjectAverage: subjAvg,
          weightedScore: wScore,
          teacherComment: teacherComment ?? undefined,
        }];
      });

      bulletin.definirLignesMatiere(lignes);
      bulletin.definirResultats({
        generalAverage: moyenneEleve,
        rank: rang,
        totalStudents: elevesClasse.length,
        mention,
        absenceCount: statsPresence.joursAbsent,
      });

      // Générer le PDF
      const professorPrincipal = classe.professorPrincipalId
        ? await this.userRepository.findById(classe.professorPrincipalId)
        : null;

      const verifyBase = process.env.CLIENT_URL || 'http://localhost:3000';
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
        moyenneClasse: moyennesEleves.reduce((s, m) => s + m.moyenne, 0) / elevesClasse.length,
        langue,
        verifyUrl,
        seq1Label,
        seq2Label,
      });

      const pdfUrl = `bulletins/${commande.schoolId}/${bulletin.id}.pdf`;
      bulletin.marquerGenere(pdfUrl);

      // Sauvegarder (si un ancien bulletin existait, le remplacer proprement)
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
      message: `${generes} bulletin(s) généré(s) avec succès`,
    };
  }
}