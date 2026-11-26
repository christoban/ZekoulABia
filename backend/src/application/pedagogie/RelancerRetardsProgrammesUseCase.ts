/**
 * APPLICATION LAYER — Use Case Lot 3 : Notifications automatiques ciblées (propose / apply)
 * sur les retards de progression calculés d'après le rythme réel des leçons actives
 * (excluant les modules désactivés et intégrant coches directes + cahiers de texte).
 *
 * Destinataires résolus par alerte :
 * - L'enseignant affecté à (classId, subjectId) ;
 * - L'Animateur Pédagogique chef du département contenant subjectId.
 */
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type {
  AlerteRetardProgramme,
  CalculerProgressionProgrammeUseCase,
} from './CalculerProgressionProgrammeUseCase';

export interface RelancerRetardsInput {
  schoolId: string;
  academicYearId?: string;
  seuilPct?: number;
  /** Optionnel : restreindre aux retards CRITIQUE uniquement. */
  critiquesSeulement?: boolean;
}

export interface DestinataireRelanceCible {
  userId: string;
  nomComplet: string;
  roleCible: 'ENSEIGNANT' | 'ANIMATEUR_PEDAGOGIQUE';
  programmeId: string;
  programmeTitre: string;
  classId: string;
  className: string;
  subjectName: string;
  niveau: 'CRITIQUE' | 'MODERE';
  progressionPct: number;
  attenduPct: number;
  retardPct: number;
  leconsRealisees: number;
  leconsTotal: number;
  modulesDesactivesCount: number;
}

export interface RelanceRetardsProposition {
  seuilPct: number;
  totalAlertes: number;
  totalDestinataires: number;
  alertesSansDestinataire: number;
  destinataires: DestinataireRelanceCible[];
}

export interface RelanceRetardsResultat extends RelanceRetardsProposition {
  notificationsEnvoyees: number;
  echecsEnvoi: number;
}

export class RelancerRetardsProgrammesUseCase {
  constructor(
    private readonly calculerProgression: CalculerProgressionProgrammeUseCase,
    private readonly departmentRepository: DepartmentRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async proposer(input: RelancerRetardsInput): Promise<RelanceRetardsProposition> {
    const seuilPct = input.seuilPct ?? 15;
    let alertes = await this.calculerProgression.calculerAlertesRetardProgramme(
      input.schoolId,
      input.academicYearId,
      seuilPct,
    );
    if (input.critiquesSeulement) {
      alertes = alertes.filter((a) => a.niveau === 'CRITIQUE');
    }

    if (alertes.length === 0) {
      return {
        seuilPct,
        totalAlertes: 0,
        totalDestinataires: 0,
        alertesSansDestinataire: 0,
        destinataires: [],
      };
    }

    const subjectIds = Array.from(new Set(alertes.map((a) => a.subjectId)));
    const [departments, assignments] = await Promise.all([
      this.departmentRepository.findBySchool(input.schoolId),
      this.departmentRepository.findAssignmentsForSubjectIds(input.schoolId, subjectIds),
    ]);

    const apParSubject = new Map<string, { userId: string; nomComplet: string }>();
    for (const dept of departments) {
      if (!dept.headId) continue;
      const nom = dept.head
        ? `${dept.head.firstName} ${dept.head.lastName}`.trim()
        : `AP ${dept.name}`;
      for (const sub of dept.subjects ?? []) {
        apParSubject.set(sub.id, { userId: dept.headId, nomComplet: nom });
      }
    }

    const dedup = new Set<string>();
    const destinataires: DestinataireRelanceCible[] = [];
    let alertesSansDestinataire = 0;

    for (const alerte of alertes) {
      const ciblesPourAlerte = this.resoudreCiblesPourAlerte(alerte, assignments, apParSubject);
      if (ciblesPourAlerte.length === 0) {
        alertesSansDestinataire += 1;
        continue;
      }

      for (const cible of ciblesPourAlerte) {
        const cle = `${cible.userId}:${alerte.programmeId}:${alerte.classId}`;
        if (dedup.has(cle)) continue;
        dedup.add(cle);
        destinataires.push({
          userId: cible.userId,
          nomComplet: cible.nomComplet,
          roleCible: cible.roleCible,
          programmeId: alerte.programmeId,
          programmeTitre: alerte.programmeTitre,
          classId: alerte.classId,
          className: alerte.className,
          subjectName: alerte.subjectName,
          niveau: alerte.niveau,
          progressionPct: alerte.progressionPct,
          attenduPct: alerte.attenduPct,
          retardPct: alerte.retardPct,
          leconsRealisees: alerte.chapitresRealises,
          leconsTotal: alerte.chapitresTotal,
          modulesDesactivesCount: alerte.modulesDesactivesCount,
        });
      }
    }

    return {
      seuilPct,
      totalAlertes: alertes.length,
      totalDestinataires: destinataires.length,
      alertesSansDestinataire,
      destinataires,
    };
  }

  async appliquer(input: RelancerRetardsInput): Promise<RelanceRetardsResultat> {
    const proposition = await this.proposer(input);
    let notificationsEnvoyees = 0;
    let echecsEnvoi = 0;

    for (const d of proposition.destinataires) {
      const suffixeModules =
        d.modulesDesactivesCount > 0
          ? ` (${d.modulesDesactivesCount} module(s) désactivé(s) exclus du calcul)`
          : '';
      const titre = `Retard de progression (${d.niveau}) — ${d.className} · ${d.subjectName}`;
      const corps =
        `Avancement actuel : ${d.leconsRealisees}/${d.leconsTotal} leçons actives (${d.progressionPct}% contre ${d.attenduPct}% attendu, écart -${d.retardPct}%)${suffixeModules}. ` +
        `Pensez à mettre à jour votre onglet Programme ou le cahier de texte.`;

      try {
        await this.notificationService.envoyer({
          schoolId: input.schoolId,
          userId: d.userId,
          type: 'ACADEMIC_EVENT',
          titre,
          corps,
          urgency: d.niveau === 'CRITIQUE' ? 'HIGH' : 'NORMAL',
          metadata: {
            programmeId: d.programmeId,
            classId: d.classId,
            roleCible: d.roleCible,
            retardPct: d.retardPct,
          },
        });
        notificationsEnvoyees += 1;
      } catch {
        echecsEnvoi += 1;
      }
    }

    return {
      ...proposition,
      notificationsEnvoyees,
      echecsEnvoi,
    };
  }

  private resoudreCiblesPourAlerte(
    alerte: AlerteRetardProgramme,
    assignments: ReadonlyArray<{
      teacherId: string;
      subjectId: string;
      classId: string;
      teacher: { firstName: string; lastName: string };
    }>,
    apParSubject: ReadonlyMap<string, { userId: string; nomComplet: string }>,
  ): Array<{ userId: string; nomComplet: string; roleCible: 'ENSEIGNANT' | 'ANIMATEUR_PEDAGOGIQUE' }> {
    const out: Array<{
      userId: string;
      nomComplet: string;
      roleCible: 'ENSEIGNANT' | 'ANIMATEUR_PEDAGOGIQUE';
    }> = [];

    for (const a of assignments) {
      if (a.classId === alerte.classId && a.subjectId === alerte.subjectId) {
        out.push({
          userId: a.teacherId,
          nomComplet: `${a.teacher.firstName} ${a.teacher.lastName}`.trim(),
          roleCible: 'ENSEIGNANT',
        });
      }
    }

    const ap = apParSubject.get(alerte.subjectId);
    if (ap) {
      out.push({
        userId: ap.userId,
        nomComplet: ap.nomComplet,
        roleCible: 'ANIMATEUR_PEDAGOGIQUE',
      });
    }

    return out;
  }
}
