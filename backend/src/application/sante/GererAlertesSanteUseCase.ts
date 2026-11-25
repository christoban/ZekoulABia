import { messageErreur } from '@application/shared/messageErreur';
import type { HealthJobsRepository } from '@domain/ports/repositories/HealthJobsRepository';
import type { IAService } from '@domain/ports/services/IAService';
import type { NotificationService } from '@domain/ports/services/NotificationService';

export class GererAlertesSanteUseCase {
  constructor(
    private readonly healthJobsRepository: HealthJobsRepository,
    private readonly iaService: IAService,
    private readonly notificationService: NotificationService,
  ) {}

  private async notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
    await this.notificationService
      .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, urgency: "HIGH" })
      .catch((err) => console.error("[HealthAlert] personnel:", messageErreur(err)));
  }

  private async notifierParents(opts: { schoolId: string; studentId: string; titre: string; corps: string }) {
    if (this.notificationService.notifierParents) {
      await this.notificationService.notifierParents({
        schoolId: opts.schoolId,
        studentId: opts.studentId,
        type: "STUDENT_RISK_ALERT",
        titre: opts.titre,
        corps: opts.corps,
      }).catch((err) => console.error("[HealthAlert] parent:", messageErreur(err)));
    } else {
      // Fallback: try direct envoyer if parent resolution not available via port
      console.warn("[HealthAlert] notifierParents not implemented on NotificationService");
    }
  }

  private async genererEtPersisterConseil(params: {
    schoolId: string;
    studentId: string;
    subjectId?: string | null;
    nomEleve: string;
    contexte: string;
    recipientRole: "STUDENT" | "PARENT" | "TEACHER";
    contextType: "HEALTH_CRITICAL" | "HEALTH_WARNING" | "HEALTH_POSITIVE" | "SUBJECT_DROP";
    destinataire: "ELEVE" | "PARENT" | "ENSEIGNANT";
  }): Promise<string | null> {
    try {
      const content = await this.iaService.genererConseilPersonnalise({
        nomEleve: params.nomEleve,
        contexte: params.contexte,
        destinataire: params.destinataire,
      });
      await this.healthJobsRepository.createRecommendation({
        schoolId: params.schoolId,
        studentId: params.studentId,
        subjectId: params.subjectId ?? null,
        recipientRole: params.recipientRole,
        contextType: params.contextType,
        content,
      });
      return content;
    } catch (err) {
      console.error("[Conseil IA]", messageErreur(err));
      return null;
    }
  }

  private async suggererOrientationSiRisquePersistant(
    studentId: string, schoolId: string, nomComplet: string, className: string | null,
  ): Promise<void> {
    try {
      const seuilDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const occurrences = await this.healthJobsRepository.countCriticalRecommendations(studentId, schoolId, seuilDate);
      if (occurrences < 2) return;
      const anneeCourante = await this.healthJobsRepository.findCurrentAcademicYear(schoolId);
      if (!anneeCourante) return;
      const ficheExistante = await this.healthJobsRepository.findFicheOrientation(studentId, anneeCourante.id);
      if (ficheExistante) return;
      const conseillers = await this.healthJobsRepository.findStaffByPermission(schoolId, "MANAGE_ORIENTATION");
      for (const c of conseillers) {
        await this.notifierPersonnelDirect(c.userId, schoolId, "Suivi Orientation suggéré",
          `${nomComplet} (${className ?? "N/A"}) est en risque critique de façon répétée (${occurrences} alerte(s) récente(s)). Une fiche d'orientation pourrait être ouverte.`);
      }
    } catch (err) {
      console.error("[Orientation] suggestion:", messageErreur(err));
    }
  }

  async handleCritical(params: { studentId: string; schoolId: string; healthScore: number }): Promise<{ notified: boolean }> {
    const { studentId, schoolId, healthScore } = params;
    const ctx = await this.healthJobsRepository.findStudentContext(studentId, schoolId);
    const { nomComplet, className, professorPrincipalId } = ctx;
    const contexte = `Indice de santé scolaire au niveau critique (${healthScore}/100), dans la classe ${className ?? "N/A"}. Une période difficile qui nécessite un accompagnement rapproché.`;

    const conseilParent = await this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_CRITICAL", destinataire: "PARENT",
    });
    await this.notifierParents({
      schoolId, studentId,
      titre: "Alerte — suivi urgent recommandé",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) traverse une période difficile (indice de santé scolaire : ${healthScore}/100). Un échange avec l'établissement est recommandé.`,
    });

    void this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_CRITICAL", destinataire: "ELEVE",
    });

    if (professorPrincipalId) {
      void this.genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_CRITICAL", destinataire: "ENSEIGNANT",
      });
    }

    const censeurs = await this.healthJobsRepository.findStaffByPermission(schoolId, "VALIDATE_GRADES");
    for (const c of censeurs) {
      await this.notifierPersonnelDirect(c.userId, schoolId, "Élève en risque critique", `${nomComplet} (${className ?? "N/A"}) — indice de santé scolaire : ${healthScore}/100.`);
    }

    void this.suggererOrientationSiRisquePersistant(studentId, schoolId, nomComplet, className);
    return { notified: true };
  }

  async handleWarning(params: { studentId: string; schoolId: string; healthScore: number }): Promise<{ notified: boolean }> {
    const { studentId, schoolId, healthScore } = params;
    const ctx = await this.healthJobsRepository.findStudentContext(studentId, schoolId);
    const { nomComplet, className, professorPrincipalId } = ctx;
    const contexte = `Indice de santé scolaire à surveiller (${healthScore}/100), dans la classe ${className ?? "N/A"}. Des signes méritent une attention particulière avant que la situation ne se dégrade.`;

    const conseilParent = await this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_WARNING", destinataire: "PARENT",
    });
    await this.notifierParents({
      schoolId, studentId,
      titre: "Vigilance recommandée",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) montre des signes à surveiller (indice de santé scolaire : ${healthScore}/100).`,
    });

    void this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_WARNING", destinataire: "ELEVE",
    });

    if (professorPrincipalId) {
      void this.genererEtPersisterConseil({
        schoolId, studentId, nomEleve: nomComplet, contexte,
        recipientRole: "TEACHER", contextType: "HEALTH_WARNING", destinataire: "ENSEIGNANT",
      });
    }

    return { notified: true };
  }

  async handlePositive(params: { studentId: string; schoolId: string; healthScore: number }): Promise<{ notified: boolean }> {
    const { studentId, schoolId, healthScore } = params;
    const ctx = await this.healthJobsRepository.findStudentContext(studentId, schoolId);
    const { nomComplet, className } = ctx;
    const contexte = `Nette amélioration récente de l'indice de santé scolaire (désormais ${healthScore}/100), dans la classe ${className ?? "N/A"}. Un progrès à valoriser et à encourager.`;

    const conseilParent = await this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "PARENT", contextType: "HEALTH_POSITIVE", destinataire: "PARENT",
    });
    await this.notifierParents({
      schoolId, studentId,
      titre: "Belle progression 🎉",
      corps: conseilParent ?? `${nomComplet} (${className ?? "sa classe"}) montre une nette amélioration récente (indice de santé scolaire : ${healthScore}/100). Continuez à l'encourager !`,
    });

    void this.genererEtPersisterConseil({
      schoolId, studentId, nomEleve: nomComplet, contexte,
      recipientRole: "STUDENT", contextType: "HEALTH_POSITIVE", destinataire: "ELEVE",
    });

    return { notified: true };
  }
}
