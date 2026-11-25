import { messageErreur } from '@application/shared/messageErreur';
import type { HealthJobsRepository } from '@domain/ports/repositories/HealthJobsRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';

export class EnvoyerDigestProfPrincipalUseCase {
  constructor(private readonly healthJobsRepository: HealthJobsRepository, private readonly notificationService: NotificationService) {}

  private async notifierPersonnelDirect(userId: string, schoolId: string, titre: string, corps: string) {
    await this.notificationService
      .envoyer({ schoolId, userId, type: "STUDENT_RISK_ALERT", titre, corps, urgency: "NORMAL" })
      .catch((err) => console.error("[HealthAlert] personnel:", messageErreur(err)));
  }

  async execute(): Promise<{ digestSent: boolean }> {
    const schools = await this.healthJobsRepository.findActiveSchools();

    for (const school of schools) {
      const config = await this.healthJobsRepository.getSchoolConfig(school.id);
      if (config?.aiAlertsEnabled === false) continue;
      const warningThreshold = config?.aiRiskThreshold ?? 50;
      const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

      type Digest = { critiques: string[]; vigilances: string[]; chutes: string[] };
      const parPP = new Map<string, Digest>();
      const ajouter = (ppId: string | null | undefined, champ: keyof Digest, ligne: string) => {
        if (!ppId) return;
        const d = parPP.get(ppId) ?? { critiques: [], vigilances: [], chutes: [] };
        d[champ].push(ligne);
        parPP.set(ppId, d);
      };

      const eleves = await this.healthJobsRepository.findStudentsWithHealthScoreLte(school.id, warningThreshold);
      for (const e of eleves) {
        const nom = `${e.user.firstName} ${e.user.lastName}`;
        const ligne = `${nom} (${e.enrollmentsYearScoped[0]?.class?.name ?? "N/A"}) — indice ${e.healthScore}/100`;
        ajouter(e.enrollmentsYearScoped[0]?.class?.professorPrincipalId, (e.healthScore ?? 0) <= criticalThreshold ? "critiques" : "vigilances", ligne);
      }

      const depuis = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const chutes = await this.healthJobsRepository.findTeacherRecommendationsSince(school.id, depuis);
      if (chutes.length > 0) {
        const studentIds = Array.from(new Set(chutes.map((c) => c.studentId)));
        const subjectIds = Array.from(new Set(chutes.map((c) => c.subjectId).filter((s): s is string => !!s)));
        const [profils, matieres] = await Promise.all([
          this.healthJobsRepository.findStudentProfilesForDigest(school.id, studentIds),
          this.healthJobsRepository.findSubjectsByIds(subjectIds),
        ]);
        const profilParEleve = new Map(profils.map((p) => [p.userId, p]));
        const nomMatiere = new Map(matieres.map((m) => [m.id, m.name]));
        for (const c of chutes) {
          const profil = profilParEleve.get(c.studentId);
          if (!profil?.enrollmentsYearScoped[0]) continue;
          const nom = `${profil.user.firstName} ${profil.user.lastName}`;
          const matiere = c.subjectId ? (nomMatiere.get(c.subjectId) ?? "une matière") : "une matière";
          ajouter(profil.enrollmentsYearScoped[0].class.professorPrincipalId, "chutes", `${nom} (${profil.enrollmentsYearScoped[0].class.name}) — chute en ${matiere}`);
        }
      }

      for (const [ppId, d] of parPP) {
        const sections: string[] = [];
        if (d.critiques.length) sections.push(`Critique (${d.critiques.length}) :\n${d.critiques.join("\n")}`);
        if (d.vigilances.length) sections.push(`Vigilance (${d.vigilances.length}) :\n${d.vigilances.join("\n")}`);
        if (d.chutes.length) sections.push(`Chutes de matière hier (${d.chutes.length}) :\n${d.chutes.join("\n")}`);
        if (sections.length === 0) continue;
        await this.notifierPersonnelDirect(ppId, school.id, "Votre digest quotidien — élèves à suivre", sections.join("\n\n"));
      }
    }

    return { digestSent: true };
  }
}
