import type { Request, Response, NextFunction } from 'express';
import type { AIContextQueryRepository } from '@domain/ports/repositories/AIContextQueryRepository';
import type { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';

interface AtRiskEntry {
  studentId: string;
  name: string;
  classId: string | null;
  className: string;
  source: 'COMPOSITE' | 'SUBJECT_DROP';
  healthScore: number | null;
  alertLevel: 'critical' | 'warning' | null;
  subjectName: string | null;
  conseil: string | null;
  conseilDate: Date | null;
  recommendationId: string | null;
  isProfesseurPrincipal: boolean;
  mesMatieres: { id: string; name: string }[];
}

/** Délégué spécialisé : vues lecture seule de suivi de santé et détection de décrochage scolaire. */
export class AIHealthTrackingDelegate {
  constructor(
    private readonly contextRepo: AIContextQueryRepository,
    private readonly calculerIndiceSante?: CalculerIndiceSanteUseCase,
  ) {}

  /**
   * Gate pour les vues "tous les élèves d'une classe/école" (pas un élève précis) : seuls ADMIN
   * et STAFF avec VALIDATE_GRADES (censeur) ont un motif légitime de parcourir une liste — les
   * autres rôles ont leurs propres routes déjà scopées (getAtRiskStudentsForTeacher,
   * getHealthTracking), jamais besoin de la vue large.
   */
  private peutVoirVueEnsembleSante(user: { role: string; permissions?: string[] }): boolean {
    const role = user.role.toUpperCase();
    if (role === 'ADMIN') return true;
    if (role === 'STAFF') return Array.isArray(user.permissions) && user.permissions.includes('VALIDATE_GRADES');
    return false;
  }

  getStudentsHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;

      if (!this.peutVoirVueEnsembleSante(req.user!)) {
        res.status(403).json({ message: 'Accès réservé à la direction et au personnel habilité' });
        return;
      }

      let students = await this.contextRepo.findStudentsByClass(schoolId, classId);

      // Recalcul à la demande (ex: clic sur "Actualiser les scores" sur le dashboard)
      if (req.query.recalculate === 'true' && this.calculerIndiceSante) {
        try {
          const currentYear = await this.contextRepo.findCurrentAcademicYear(schoolId);
          if (currentYear) {
            for (const s of students) {
              try {
                await this.calculerIndiceSante.calculerScoreSeulement(s.userId, schoolId, currentYear.id);
              } catch {
                // Best-effort par élève
              }
            }
            students = await this.contextRepo.findStudentsByClass(schoolId, classId);
          }
        } catch {
          // Repli gracieux
        }
      }

      const categorized = students.map((s) => {
        const score = s.healthScore ?? 75;
        const alertLevel =
          score <= 30 ? 'critical' : score <= 50 ? 'warning' : score <= 70 ? 'recommendation' : score <= 85 ? 'good' : 'excellent';
        return { studentId: s.userId, name: `${s.firstName} ${s.lastName}`, className: s.className ?? '—', healthScore: score, alertLevel };
      });

      res.json({
        students: categorized,
        summary: {
          critical: categorized.filter((s) => s.alertLevel === 'critical').length,
          warning: categorized.filter((s) => s.alertLevel === 'warning').length,
          recommendation: categorized.filter((s) => s.alertLevel === 'recommendation').length,
          good: categorized.filter((s) => s.alertLevel === 'good').length,
          excellent: categorized.filter((s) => s.alertLevel === 'excellent').length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/ai/at-risk-students — vue enseignant : élèves à risque dans SES classes/matières
  // uniquement (TeachingAssignment + classe(s) dont il est professeur principal), avec le conseil
  // IA déjà généré et persisté pour lui (StudentRecommendation, recipientRole=TEACHER) — jamais
  // de nouvel appel Groq ici, uniquement de la lecture.
  getAtRiskStudentsForTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const teacherId = req.user!.userId;

      const [assignments, ppClasses] = await Promise.all([
        this.contextRepo.findTeachingAssignmentsByTeacher(teacherId, schoolId),
        this.contextRepo.findClassesByProfesseurPrincipal(teacherId, schoolId),
      ]);
      const classIds = Array.from(new Set([...assignments.map((a) => a.classId), ...ppClasses.map((c) => c.id)]));
      if (classIds.length === 0) { res.json({ students: [], summary: { critical: 0, warning: 0 } }); return; }

      const ppClassIds = new Set(ppClasses.map((c) => c.id));
      // Matières enseignées par CE professeur, par classe — pour distinguer "professeur principal"
      // (autorité pleine, voir CreerActionSuiviEleveUseCase) de "enseignant de matière" (observation
      // seulement, restreinte à sa propre matière) sans jamais coder de rôle en dur.
      const mesMatieresParClasse = new Map<string, { id: string; name: string }[]>();
      for (const a of assignments) {
        const liste = mesMatieresParClasse.get(a.classId) ?? [];
        liste.push({ id: a.subjectId, name: a.subjectName });
        mesMatieresParClasse.set(a.classId, liste);
      }

      const config = await this.contextRepo.getSchoolConfig(schoolId);
      const warningThreshold = config?.aiRiskThreshold ?? 50;
      const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

      // Conseiller pédagogique présent dans ~15% des établissements secondaires publics
      // camerounais uniquement — le frontend masque "Signaler au conseiller" quand c'est absent,
      // plutôt que d'offrir une option qui ne mène nulle part (relecture juillet 2026).
      const conseillerPedagogiqueDisponible = (await this.contextRepo.countStaffWithPermission(
        schoolId,
        ['MANAGE_ORIENTATION', 'MANAGE_PEDAGOGICAL_BRIEF'],
      )) > 0;

      // Score composite — UNIQUEMENT sur les classes où l'enseignant est professeur principal
      // ("tout ce qui concerne les élèves de sa classe"). Un enseignant de matière ne doit jamais
      // voir le score général (absences, discipline, paiement ne le concernent pas) — relecture
      // juillet 2026.
      const ppClassIdList = Array.from(ppClassIds);
      const studentsComposite = ppClassIdList.length
        ? await this.contextRepo.findStudentsByClasses(ppClassIdList, { healthScoreLte: warningThreshold })
        : [];

      const studentIds = studentsComposite.map((s) => s.userId);
      const recommendations = studentIds.length
        ? await this.contextRepo.findStudentRecommendations({ studentIds, recipientRole: 'TEACHER' })
        : [];
      const dernierConseilParEleve = new Map<string, (typeof recommendations)[number]>();
      for (const r of recommendations) if (!dernierConseilParEleve.has(r.studentId)) dernierConseilParEleve.set(r.studentId, r);

      const resultComposite: AtRiskEntry[] = studentsComposite.map((s) => {
        const score: number = s.healthScore ?? 75;
        const alertLevel = score <= criticalThreshold ? 'critical' : 'warning';
        const conseil = dernierConseilParEleve.get(s.userId);
        return {
          studentId: s.userId,
          name: `${s.firstName} ${s.lastName}`,
          classId: s.classId,
          className: s.className ?? '—',
          source: 'COMPOSITE' as const,
          healthScore: score,
          alertLevel,
          subjectName: null as string | null,
          conseil: conseil?.content ?? null,
          conseilDate: conseil?.createdAt ?? null,
          recommendationId: conseil?.id ?? null,
          // Autorité pour le suivi (Partie B) : PP = pleine autorité, sinon liste de ses propres
          // matières dans cette classe = observation seulement, restreinte à l'une d'elles.
          isProfesseurPrincipal: s.classId !== null && ppClassIds.has(s.classId),
          mesMatieres: s.classId ? (mesMatieresParClasse.get(s.classId) ?? []) : [],
        };
      });

      // Chutes de matière — pour les classes où l'enseignant n'est QUE enseignant de matière
      // (jamais le score général, seulement ses propres chutes détectées dans sa propre matière).
      // Source : StudentRecommendation persistée par detecterChutePourNote (inngest/functions.ts),
      // fenêtre de 30 jours (choix raisonnable, non confirmé explicitement par l'utilisateur).
      const classIdsMatiereSeule = classIds.filter((id) => !ppClassIds.has(id));
      let resultSubjectDrop: AtRiskEntry[] = [];
      if (classIdsMatiereSeule.length > 0) {
        const elevesMatiereSeule = await this.contextRepo.findStudentsByClasses(classIdsMatiereSeule);
        const profilParEleve = new Map(elevesMatiereSeule.map((e) => [e.userId, e]));

        const depuis = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const chutes = profilParEleve.size
          ? await this.contextRepo.findStudentRecommendations({
              schoolId,
              studentIds: Array.from(profilParEleve.keys()),
              recipientRole: 'TEACHER',
              contextTypes: ['SUBJECT_DROP'],
              since: depuis,
            })
          : [];

        const vueParEleveMatiere = new Map<string, (typeof chutes)[number]>();
        for (const c of chutes) {
          const profil = profilParEleve.get(c.studentId);
          if (!profil || !c.subjectId) continue;
          // Ne garder que si CE professeur enseigne bien CETTE matière dans CETTE classe — pas la
          // chute d'un élève détectée pour un autre enseignant partageant la même classe.
          const classIdProfil = profil.classId;
          if (!classIdProfil) continue;
          const mesMatieresIci = mesMatieresParClasse.get(classIdProfil) ?? [];
          if (!mesMatieresIci.some((m) => m.id === c.subjectId)) continue;
          const cle = `${c.studentId}__${c.subjectId}`;
          if (!vueParEleveMatiere.has(cle)) vueParEleveMatiere.set(cle, c);
        }

        resultSubjectDrop = Array.from(vueParEleveMatiere.values()).map((c): AtRiskEntry => {
          const profil = profilParEleve.get(c.studentId)!;
          const classIdProfil = profil.classId;
          const matiere = (classIdProfil ? mesMatieresParClasse.get(classIdProfil) ?? [] : []).find((m) => m.id === c.subjectId);
          return {
            studentId: c.studentId,
            name: `${profil.firstName} ${profil.lastName}`,
            classId: classIdProfil ?? null,
            className: profil.className ?? '—',
            source: 'SUBJECT_DROP' as const,
            healthScore: null,
            alertLevel: null,
            subjectName: matiere?.name ?? null,
            conseil: c.content,
            conseilDate: c.createdAt,
            recommendationId: c.id,
            isProfesseurPrincipal: false,
            mesMatieres: classIdProfil ? mesMatieresParClasse.get(classIdProfil) ?? [] : [],
          };
        });
      }

      const result = [...resultComposite, ...resultSubjectDrop];

      res.json({
        students: result,
        summary: {
          critical: result.filter((r) => r.alertLevel === 'critical').length,
          warning: result.filter((r) => r.alertLevel === 'warning').length,
        },
        conseillerPedagogiqueDisponible,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/ai/health-tracking — vue Parent (tous ses enfants) ou Élève (lui-même) du suivi
  // de santé scolaire : indice + dernier conseil IA persisté qui LEUR est destiné (recipientRole
  // PARENT ou STUDENT selon l'appelant — jamais le conseil destiné à l'enseignant). Même principe
  // de lecture seule que getAtRiskStudentsForTeacher : aucun appel Groq ici.
  getHealthTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;
      const role = user.role.toUpperCase();

      let cibles: { studentId: string; name: string; className: string }[] = [];

      if (role === 'STUDENT') {
        const profile = await this.contextRepo.findStudentProfile(user.userId, schoolId);
        if (!profile) { res.json({ children: [] }); return; }
        cibles = [{ studentId: user.userId, name: `${profile.firstName} ${profile.lastName}`, className: profile.className ?? '—' }];
      } else if (role === 'PARENT') {
        const children = await this.contextRepo.findParentChildren(user.userId);
        cibles = children.map((c) => ({
          studentId: c.studentId,
          name: `${c.firstName} ${c.lastName}`,
          className: c.className ?? '—',
        }));
      } else {
        res.status(403).json({ success: false, message: 'Accès réservé aux parents et élèves' });
        return;
      }

      if (cibles.length === 0) { res.json({ children: [] }); return; }

      const config = await this.contextRepo.getSchoolConfig(schoolId);
      const warningThreshold = config?.aiRiskThreshold ?? 50;
      const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

      const studentIds = cibles.map((c) => c.studentId);
      // contextType explicitement restreint aux conseils santé — sans ce filtre, une convocation
      // élève (StudentRecommendation contextType CONVOCATION, recipientRole STUDENT, voir
      // StudentFollowUpController.creer) plus récente qu'une vraie alerte santé écrasait le
      // "dernier conseil" affiché ici, masquant le conseil pédagogique tant qu'aucune nouvelle
      // alerte santé n'était générée (trouvé en revue de code). La convocation a désormais son
      // propre champ ci-dessous, distinct, jamais mélangé au conseil santé.
      const CONTEXT_TYPES_CONSEIL_SANTE = ['HEALTH_CRITICAL', 'HEALTH_WARNING', 'HEALTH_POSITIVE'];
      const depuisConvocation = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [scores, recommendations, convocations] = await Promise.all([
        this.contextRepo.findStudentHealthScores(studentIds),
        this.contextRepo.findStudentRecommendations({
          studentIds,
          recipientRole: role === 'STUDENT' ? 'STUDENT' : 'PARENT',
          contextTypes: CONTEXT_TYPES_CONSEIL_SANTE,
        }),
        // Convocations — élève uniquement, jamais destinées au parent (voir
        // StudentFollowUpController.creer). Fenêtre de 30 jours pour éviter d'afficher
        // indéfiniment une convocation dont la date est probablement déjà passée.
        role === 'STUDENT'
          ? this.contextRepo.findStudentRecommendations({
              studentIds,
              recipientRole: 'STUDENT',
              contextTypes: ['CONVOCATION'],
              since: depuisConvocation,
            })
          : Promise.resolve([]),
      ]);
      const scoreParEleve = new Map(scores.map((s) => [s.userId, s.healthScore ?? 75]));
      const dernierConseilParEleve = new Map<string, (typeof recommendations)[number]>();
      for (const r of recommendations) if (!dernierConseilParEleve.has(r.studentId)) dernierConseilParEleve.set(r.studentId, r);
      const derniereConvocationParEleve = new Map<string, (typeof convocations)[number]>();
      for (const c of convocations) if (!derniereConvocationParEleve.has(c.studentId)) derniereConvocationParEleve.set(c.studentId, c);

      const enfants = cibles.map((c) => {
        const score = scoreParEleve.get(c.studentId) ?? 75;
        const alertLevel = score <= criticalThreshold ? 'critical' : score <= warningThreshold ? 'warning' : 'good';
        const conseil = dernierConseilParEleve.get(c.studentId);
        const convocation = derniereConvocationParEleve.get(c.studentId);
        return {
          studentId: c.studentId,
          name: c.name,
          className: c.className,
          healthScore: score,
          alertLevel,
          conseil: conseil?.content ?? null,
          conseilDate: conseil?.createdAt ?? null,
          convocation: convocation ? { message: convocation.content, date: convocation.createdAt } : null,
        };
      });

      res.json({ children: enfants });
    } catch (error) {
      next(error);
    }
  };
}
