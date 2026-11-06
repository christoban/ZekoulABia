/**
 * APPLICATION LAYER — Use Case : Génération des bulletins via Inngest
 * Extrait de backend/src/infrastructure/inngest/functions/reportCards.ts
 *
 * Préserve exactement la logique historique du job "Generate-Report-Cards"
 * mais sans aucun `prisma.` direct : tout passe par les ports.
 */
import { ErreurNonRetriable } from "@application/shared/ErreurNonRetriable";
import type { AnneeAcademiqueRepository, AnneeAcademiqueProps, PeriodeAcademiqueProps } from "@domain/ports/repositories/AnneeAcademiqueRepository";
import type { UserRepository } from "@domain/ports/repositories/UserRepository";
import type { NoteRepository } from "@domain/ports/repositories/NoteRepository";
import type { PresenceRepository } from "@domain/ports/repositories/PresenceRepository";
import type { BulletinRepository } from "@domain/ports/repositories/BulletinRepository";
import type { SchoolRepository } from "@domain/ports/repositories/SchoolRepository";
import type { MatiereRepository } from "@domain/ports/repositories/MatiereRepository";
import type { EmailService } from "@domain/ports/services/EmailService";
import { resolveLanguage } from "../../domain/policies/LanguagePolicy";

export interface GenererBulletinsInngestCommande {
  yearId: string;
  periodId?: string | null;
  classId?: string | null;
  studentId?: string | null;
}

export interface GenererBulletinsInngestResultat {
  message: string;
  generated: number;
  generatedStudents: string[];
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
  ) {}

  async generer(commande: GenererBulletinsInngestCommande): Promise<GenererBulletinsInngestResultat & { academicYear: AnneeAcademiqueProps; academicPeriod: PeriodeAcademiqueProps }> {
    const { yearId, periodId, classId, studentId } = commande;
    if (!periodId) throw new ErreurNonRetriable("periodId is required");

    const academicYear = await this.anneeRepository.findById(yearId);
    if (!academicYear) throw new ErreurNonRetriable("Academic year not found");

    const periode = await this.anneeRepository.findPeriodeById(periodId, academicYear.schoolId);
    if (!periode) throw new ErreurNonRetriable("Academic period not found");
    if (periode.academicYearId !== yearId) throw new ErreurNonRetriable("Academic period not found");

    const students = await this.userRepository.findStudentsForBulletinGeneration(academicYear.schoolId, {
      classId: classId ?? null,
      studentId: studentId ?? null,
    });

    if (!students.length) {
      return { message: "No students found", generated: 0, generatedStudents: [], academicYear, academicPeriod: periode };
    }

    const generatedStudents: string[] = [];

    for (const student of students) {
      const studentClassId = student.classId ?? null;
      if (!studentClassId) continue;

      const sequences = await this.anneeRepository.findSequencesByPeriode(periode.id);
      if (!sequences.length) continue;
      const sequenceIds = sequences.map((s) => s.id);

      const grades = await this.noteRepository.findForBulletin({
        schoolId: academicYear.schoolId,
        studentId: student.id,
        academicYearId: yearId,
        classId: studentClassId,
        sequenceIds,
      });

      if (!grades.length) continue;

      // Besoin des infos matière pour coefficient et nom : charger toutes les matières de l'école une fois
      // et mapper par subjectId. Plus hexagonal que de s'appuyer sur grade.include.subject.
      // On charge à la volée si besoin et cache par école pour la boucle.
      // Pour minimalisme on charge ici par élève (petites écoles) — O(n) acceptable pour l'Inngest.
      const gradesBySubject = new Map<string, typeof grades>();
      for (const grade of grades) {
        const existing = gradesBySubject.get(grade.subjectId) || [];
        existing.push(grade);
        gradesBySubject.set(grade.subjectId, existing);
      }

      const matieres = await this.matiereRepository.findBySchool(academicYear.schoolId);
      const matiereParId = new Map(matieres.map((m) => [m.id, m]));

      const subjectAverages: { subjectId: string; average: number; coefficient: number }[] = [];
      for (const [subjectId, subjectGrades] of gradesBySubject.entries()) {
        const validScores = subjectGrades
          .map((g) => g.sequenceAverage ?? g.sequenceScore)
          .filter((v): v is number => v !== null && v !== undefined);
        if (!validScores.length) continue;
        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        const matiere = matiereParId.get(subjectId);
        // L'entité Note porte déjà le coefficient historique ; fallback sur matière
        const coeff = Number(subjectGrades[0].coefficient ?? matiere?.coefficient ?? 1);
        subjectAverages.push({ subjectId, average: avg, coefficient: coeff });
      }

      if (!subjectAverages.length) continue;

      const totalWeighted = subjectAverages.reduce((sum, s) => sum + s.average * s.coefficient, 0);
      const totalCoeff = subjectAverages.reduce((sum, s) => sum + s.coefficient, 0);
      const generalAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

      const classmates = await this.noteRepository.groupMoyennesPourPeriode({
        schoolId: academicYear.schoolId,
        classId: studentClassId,
        academicYearId: yearId,
        sequenceIds,
      });

      const rank = classmates.findIndex((c) => c.studentId === student.id) + 1;
      // totalStudents = classmates.length (peut être 0 si aucune note validée pour la classe)
      let mention = "Insuffisant";
      if (generalAverage >= 18) mention = "Excellent";
      else if (generalAverage >= 16) mention = "Très Bien";
      else if (generalAverage >= 14) mention = "Bien";
      else if (generalAverage >= 12) mention = "Assez Bien";
      else if (generalAverage >= 10) mention = "Passable";
      else if (generalAverage >= 6) mention = "Très Insuffisant";
      else mention = "Médiocre";

      const absenceCount = await this.presenceRepository.countAbsencesEtRetards(
        academicYear.schoolId,
        student.id,
        periode.id,
      );

      const { id: reportCardId } = await this.bulletinRepository.upsertBulletin({
        schoolId: academicYear.schoolId,
        studentId: student.id,
        academicYearId: yearId,
        academicPeriodId: periode.id,
        generalAverage: Math.round(generalAverage * 100) / 100,
        rank: rank || null,
        mention,
        absenceCount,
      });

      for (const { subjectId, average, coefficient } of subjectAverages) {
        const subjectGrades = gradesBySubject.get(subjectId) || [];
        const matiere = matiereParId.get(subjectId);
        const subjectName = matiere?.name || "";
        const seq1 = subjectGrades.find((g) => sequences[0] && g.sequenceId === sequences[0].id);
        const seq2 = subjectGrades.find((g) => sequences[1] && g.sequenceId === sequences[1].id);

        await this.bulletinRepository.upsertLigneMatiere(reportCardId, {
          subjectId,
          subjectName,
          coefficient,
          seq1Score: seq1?.sequenceScore ?? null,
          seq2Score: seq2?.sequenceScore ?? null,
          subjectAverage: Math.round(average * 100) / 100,
        });
      }

      generatedStudents.push(student.id);
    }

    return {
      message: "Report cards generated",
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

      const subject = lang === "fr"
        ? `Bulletin disponible — ${params.academicPeriod.name}`
        : `Report card available — ${params.academicPeriod.name}`;
      const html = lang === "fr"
        ? `<p>Bonjour,<br><br>Le bulletin de <b>${studentName}</b> pour la période <b>${params.academicPeriod.name}</b> est disponible sur ZekoulABia.</p>`
        : `<p>Hello,<br><br>${studentName}'s report card for <b>${params.academicPeriod.name}</b> is now available on ZekoulABia.</p>`;
      const text = lang === "fr"
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
            eventType: "report_card_available",
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
