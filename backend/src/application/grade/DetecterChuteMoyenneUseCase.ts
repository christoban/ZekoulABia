/**
 * APPLICATION LAYER — Use Case : Détecter une chute de moyenne par matière
 * Extrait de backend/src/infrastructure/inngest/functions/reportCards.ts
 *
 * Logique métier : compare la moyenne de la séquence courante vs précédente,
 * seuil configurable par école (SchoolConfig.subjectDropThreshold, défaut 3).
 * Si chute >= seuil → notification enseignant + conseil IA persisté.
 */
import { messageErreur } from '@application/shared/messageErreur';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { IAService } from '@domain/ports/services/IAService';
import type { AnneeAcademiqueRepository, SequenceAcademiqueProps } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentRecommendationRepository } from '@domain/ports/repositories/StudentRecommendationRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';
import type { TeachingAssignmentRepository } from '@domain/ports/repositories/TeachingAssignmentRepository';
import type { StudentProfileRepository } from '@domain/ports/repositories/StudentProfileRepository';

export interface DetecterChuteCommande {
  studentId: string;
  subjectId: string;
  schoolId: string;
  sequenceId: string;
}

export interface DetecterChuteResultat {
  studentId: string;
  subjectId: string;
  teacherId: string | null;
  nomComplet: string;
  className: string | null;
  matiere: string;
  avant: number;
  apres: number;
  corpsIndividuel: string;
}

export interface BatchChuteCommande {
  schoolId: string;
  grades: Array<{ studentId: string; subjectId: string; sequenceId: string }>;
}

export async function trouverSequencePrecedente(
  anneeRepository: AnneeAcademiqueRepository,
  sequenceId: string,
  schoolId: string,
): Promise<SequenceAcademiqueProps | null> {
  const courante = await anneeRepository.findSequenceById(sequenceId, schoolId);
  if (!courante) return null;

  const toutes = await anneeRepository.findSequencesByPeriode(courante.academicPeriodId);
  const triees = toutes.sort((a, b) =>
    a.orderIndex - b.orderIndex
  );
  const idx = triees.findIndex((s) => s.id === sequenceId);
  return idx > 0 ? triees[idx - 1]! : null;
}

export class DetecterChuteMoyenneUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly notificationService: NotificationService,
    private readonly iaService: IAService | undefined,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly studentRecommendationRepository: StudentRecommendationRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly schoolConfigRepository: SchoolConfigRepository,
    private readonly teachingAssignmentRepository: TeachingAssignmentRepository,
    private readonly studentProfileRepository: StudentProfileRepository,
  ) {}

  async resolveStudentContext(studentId: string, schoolId: string) {
    const profile = await this.studentProfileRepository.findForDocument(studentId, schoolId);
    if (!profile) {
      return {
        nomComplet: 'Élève',
        classId: null,
        className: null,
        professorPrincipalId: null,
      };
    }
    return {
      nomComplet: `${profile.user.firstName} ${profile.user.lastName}`,
      classId: null,
      className: profile.enrollmentsYearScoped?.[0]?.class?.name ?? null,
      professorPrincipalId: null,
    };
  }

  private async detecterChutePourNote(commande: DetecterChuteCommande): Promise<DetecterChuteResultat | null> {
    // Use repository for grade queries (hexagonal) — post-filter by schoolId + validation status
    const noteActuelle = await this.noteRepository.findByEleveEtMatiere(commande.studentId, commande.subjectId, commande.sequenceId);
    if (!noteActuelle || noteActuelle.schoolId !== commande.schoolId) return null;
    if (noteActuelle.validationStatus !== 'LOCKED') return null;
    if (noteActuelle.sequenceAverage == null) return null;

    const precedente = await trouverSequencePrecedente(this.anneeRepository, commande.sequenceId, commande.schoolId);
    if (!precedente) return null;

    const noteAvant = await this.noteRepository.findByEleveEtMatiere(commande.studentId, commande.subjectId, precedente.id);
    if (!noteAvant || noteAvant.schoolId !== commande.schoolId) return null;
    if (noteAvant.validationStatus !== 'LOCKED') return null;
    if (noteAvant.sequenceAverage == null) return null;

    const config = await this.schoolConfigRepository.findBySchool(commande.schoolId);
    if (config?.aiAlertsEnabled === false) return null;
    const seuil = config?.subjectDropThreshold ?? 3;

    const chute = noteAvant.sequenceAverage - noteActuelle.sequenceAverage;
    if (chute < seuil) return null;

    const [contexte, subject] = await Promise.all([
      this.resolveStudentContext(commande.studentId, commande.schoolId),
      this.matiereRepository.findById(commande.subjectId),
    ]);
    const matiere = subject?.name ?? 'une matière';
    const corpsGenerique = `${contexte.nomComplet} (${contexte.className ?? 'N/A'}) a chuté de ${chute.toFixed(1)} points en ${matiere} (${noteAvant.sequenceAverage.toFixed(1)} → ${noteActuelle.sequenceAverage.toFixed(1)}/20) entre les deux dernières séquences.`;
    const conseilEnseignant = await this.genererEtPersisterConseil(this.iaService, {
      schoolId: commande.schoolId,
      studentId: commande.studentId,
      subjectId: commande.subjectId,
      nomEleve: contexte.nomComplet,
      contexte: corpsGenerique,
      recipientRole: 'TEACHER',
      contextType: 'SUBJECT_DROP',
      destinataire: 'ENSEIGNANT',
    });

    let teacherId: string | null = null;
    if (contexte.classId) {
      const assignment = await this.teachingAssignmentRepository.findByClassSubjectAndSchool(
        contexte.classId,
        commande.subjectId,
        commande.schoolId
      );
      teacherId = assignment?.teacherId ?? null;
    }

    return {
      studentId: commande.studentId,
      subjectId: commande.subjectId,
      teacherId,
      nomComplet: contexte.nomComplet,
      className: contexte.className,
      matiere,
      avant: noteAvant.sequenceAverage,
      apres: noteActuelle.sequenceAverage,
      corpsIndividuel: conseilEnseignant ?? corpsGenerique,
    };
  }

  async execute(commande: DetecterChuteCommande): Promise<DetecterChuteResultat | null> {
    const resultat = await this.detecterChutePourNote(commande);
    if (!resultat) return null;
    if (resultat.teacherId) {
      await this.notificationService.envoyer({
        schoolId: commande.schoolId,
        userId: resultat.teacherId,
        type: 'STUDENT_RISK_ALERT',
        titre: `Chute en ${resultat.matiere}`,
        corps: resultat.corpsIndividuel,
        urgency: 'HIGH',
      }).catch((err) => console.error('[DetecterChute] notification:', messageErreur(err)));
    }
    return resultat;
  }

  async executeBatch(commande: BatchChuteCommande): Promise<{ enseignantsNotifies: number; parEnseignant: Map<string, string[]> }> {
    const parEnseignant = new Map<string, string[]>();
    for (const g of commande.grades) {
      const resultat = await this.detecterChutePourNote({
        studentId: g.studentId,
        subjectId: g.subjectId,
        schoolId: commande.schoolId,
        sequenceId: g.sequenceId,
      }).catch(() => null);
      if (!resultat || !resultat.teacherId) continue;
      const lignes = parEnseignant.get(resultat.teacherId) ?? [];
      lignes.push(`${resultat.nomComplet} (${resultat.className ?? 'N/A'}) — ${resultat.matiere} : ${resultat.avant.toFixed(1)} → ${resultat.apres.toFixed(1)}/20`);
      parEnseignant.set(resultat.teacherId, lignes);
    }

    for (const [teacherId, lignes] of parEnseignant) {
      const corps =
        lignes.length === 1 ? lignes[0]! : `${lignes.length} élèves en chute lors de cette validation :\n${lignes.join('\n')}`;
      await this.notificationService
        .envoyer({
          schoolId: commande.schoolId,
          userId: teacherId,
          type: 'STUDENT_RISK_ALERT',
          titre: 'Chutes détectées lors de votre validation',
          corps,
          urgency: 'HIGH',
        })
        .catch((err) => console.error('[DetecterChute batch] notification:', messageErreur(err)));
    }

    return { enseignantsNotifies: parEnseignant.size, parEnseignant };
  }

  private async genererEtPersisterConseil(iaService: IAService | undefined, params: {
    schoolId: string;
    studentId: string;
    subjectId: string;
    nomEleve: string;
    contexte: string;
    recipientRole: 'STUDENT' | 'PARENT' | 'TEACHER';
    contextType: string;
    destinataire: 'ELEVE' | 'PARENT' | 'ENSEIGNANT';
  }): Promise<string | null> {
    if (!iaService) return null;
    try {
      const content = await iaService.genererConseilPersonnalise({
        nomEleve: params.nomEleve,
        contexte: params.contexte,
        destinataire: params.destinataire,
      });
      await this.studentRecommendationRepository.create({
        schoolId: params.schoolId,
        studentId: params.studentId,
        subjectId: params.subjectId ?? null,
        recipientRole: params.recipientRole,
        contextType: params.contextType,
        content,
      });
      return content;
    } catch (err) {
      console.error('[Conseil IA]', messageErreur(err));
      return null;
    }
  }
}